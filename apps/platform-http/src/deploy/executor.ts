import type { Buffer } from 'node:buffer';
import { clearInterval, setInterval } from 'node:timers';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { emitProto } from '@rntme/bindings-grpc';
import {
  loadComposedBlueprint,
  materializeBundle,
  type ComposedBlueprint,
} from '@rntme/blueprint';
import type {
  buildProjectDeploymentPlan,
  ComposedProjectInput,
  ProvisionerContract,
  ProvisionerOutput,
  runProvisioners,
} from '@rntme/deploy-core';
import type { applyDokployPlan, renderDokployPlan } from '@rntme/deploy-dokploy';
import {
  runDeployment as orchestrate,
  type ApplyResultEnvelope,
  type DokployClientFactory,
  type ParseTargetSecretResult,
  type ProvisionResultEnvelope,
  type RunDeploymentInputs,
  type SmokeVerifier,
  redact,
} from '@rntme/deploy-runner';
import {
  isOk,
  type BlobStore,
  type DeployTargetRepo,
  type DeployTargetWithSecret,
  type DeploymentProvisionResult,
  type DeploymentRepo,
  type EncryptedSecret,
  type PlatformError,
  type ProjectOperationRepo,
  type ProjectVersionRepo,
  type SecretCipher,
  type TargetSecretsRepo,
  type VerificationReport,
  parseCanonicalBundle,
  parseTargetSecret,
} from '@rntme/platform-core';
import type { Logger } from 'pino';

export { deployErrorsToPlatformError } from '@rntme/deploy-runner';

type ResultLike<T, E = { readonly code: string; readonly message: string }> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly E[] };

export type TxRepos = {
  readonly deployments: DeploymentRepo;
  readonly projectVersions: ProjectVersionRepo;
  readonly deployTargets: DeployTargetRepo;
  readonly projectOperations: ProjectOperationRepo;
};

export type ExecutorDeps = {
  readonly blob: BlobStore;
  readonly withOrgTx: <T>(orgId: string, fn: (repos: TxRepos) => Promise<T>) => Promise<T>;
  readonly orgSlugFor: (orgId: string) => Promise<string>;
  readonly dokployClientFactory: DokployClientFactory;
  readonly smoker: SmokeVerifier;
  readonly logger: Pick<Logger, 'error' | 'warn' | 'info'>;
  readonly loadComposed?: (dir: string) => ResultLike<LoadedDeployProject> | Promise<ResultLike<LoadedDeployProject>>;
  readonly planProject?: typeof buildProjectDeploymentPlan;
  readonly renderPlan?: typeof renderDokployPlan;
  readonly applyPlan?: typeof applyDokployPlan;
  readonly heartbeatMs?: number;
  readonly publicDeployDomain?: string;
  /** Override hook for tests; in production `runProvisioners` from deploy-core is used. */
  readonly runProvisioners?: typeof runProvisioners;
  /** Resolve a provisioner contract from its package name, entry point, and materialized project dir. */
  readonly resolveProvisioner: (packageName: string, entry: string, projectDir: string) => Promise<ProvisionerContract>;
  /** Build a TargetSecretsRepo scoped to the given org context. */
  readonly targetSecretsRepoFor: (orgId: string) => Promise<TargetSecretsRepo>;
  /** Cipher used to encrypt secret outputs from provisioners. */
  readonly secretCipher: SecretCipher;
  /**
   * Returns the prior provisioner outputs for each module key from the last
   * successful deployment.
   * TODO(provisioner): wire prior outputs from last successful deployment
   */
  readonly lastSuccessfulProvisionOutputs: (deploymentId: string) => Promise<Record<string, ProvisionerOutput>>;
};

type DeploymentContext = {
  readonly projectVersionId: string;
  readonly targetId: string;
  readonly configOverrides: Record<string, unknown>;
  readonly bundleBlobKey: string;
  readonly projectVersionSeq: number;
  readonly targetSlug: string;
};

type LoadedDeployProject = ComposedProjectInput | ComposedBlueprint;

const IDENTITY_INTROSPECTION_PROTO = `syntax = "proto3";
package rntme.contracts.identity.v1;

message IntrospectSessionRequest {
  string token = 1;
  string audience = 2;
}

message Session {
  string session_id = 2;
  string user_id = 3;
  string organization_id = 4;
  int32 token_type = 5;
  repeated string roles = 6;
  repeated string permissions = 7;
  repeated string verified_factors = 8;
  int32 status = 9;
  string ip_address = 10;
  string user_agent = 11;
}

service IdentityModule {
  rpc IntrospectSession(IntrospectSessionRequest) returns (Session);
}
`;

export async function runDeployment(
  deploymentId: string,
  orgId: string,
  deps: ExecutorDeps,
): Promise<void> {
  const heartbeat = setInterval(() => {
    void deps
      .withOrgTx(orgId, (repos) => repos.deployments.touchHeartbeat(deploymentId))
      .catch(() => undefined);
  }, deps.heartbeatMs ?? 5_000);
  let tmpDir: string | null = null;

  try {
    const ctx = await startAndResolveContext(deploymentId, orgId, deps);
    await appendLog(
      deps,
      deploymentId,
      orgId,
      'info',
      'init',
      `Starting deployment projectVersionSeq=${ctx.projectVersionSeq} projectVersionId=${ctx.projectVersionId} targetSlug=${ctx.targetSlug} targetId=${ctx.targetId}`,
    );
    await deps.withOrgTx(orgId, (repos) => repos.deployments.touchHeartbeat(deploymentId));

    const raw = await deps.blob.getRaw(ctx.bundleBlobKey);
    if (!isOk(raw)) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BLOB_FETCH_FAILED',
        errorMessage: raw.errors[0]?.message ?? 'unable to fetch project version bundle',
      });
      return;
    }

    let bundleBytes: Buffer;
    try {
      bundleBytes = gunzipSync(raw.value);
    } catch (cause) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BUNDLE_DECOMPRESS_FAILED',
        errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
      });
      return;
    }

    const parsedBundle = parseCanonicalBundle(bundleBytes);
    if (!isOk(parsedBundle)) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: parsedBundle.errors[0]?.code ?? 'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
        errorMessage: redact(errorSummary(parsedBundle.errors)),
      });
      return;
    }

    try {
      tmpDir = await materializeBundle(parsedBundle.value.bundle);
    } catch (cause) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BUNDLE_MATERIALIZE_FAILED',
        errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
      });
      return;
    }

    if (tmpDir === null) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BUNDLE_MATERIALIZE_FAILED',
        errorMessage: 'internal: bundle materialization produced no workspace directory',
      });
      return;
    }
    const bundleDir = tmpDir;

    await appendLog(deps, deploymentId, orgId, 'info', 'plan', 'Re-validating blueprint');
    const composed = await (deps.loadComposed ?? defaultLoadComposed)(bundleDir);
    if (!composed.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BLUEPRINT_REVALIDATION_FAILED',
        errorMessage: redact(errorSummary(composed.errors)),
      });
      return;
    }

    const target = await resolveTarget(deps, orgId, ctx.targetId);
    const orgSlug = await deps.orgSlugFor(orgId);
    const deployInput = await toDeployCoreInput(composed.value, bundleDir);

    // Resolve target secrets eagerly so the runner can validate required
    // secrets and so the schema-mismatch pre-check below has the listing.
    const targetSecretsRepo = await deps.targetSecretsRepoFor(orgId);
    const decryptedTargetSecrets = await targetSecretsRepo.getAllDecrypted(target.id);

    // Resolve API token plaintext for the runner. The runner's dokploy factory
    // signature takes apiToken first, but our existing factory closure decrypts
    // from the target ciphertext directly — pass empty string here and let the
    // closure ignore it. (The runner's apiToken parameter is unused in our
    // closure, see `dokployClientFactory` below.)
    const apiToken = '';

    // Pre-validate required-secret schema-IDs. The runner only checks for
    // presence and parse validity (when parseTargetSecret is provided); it
    // doesn't compare the stored schema-id against the required schema-id.
    // Mirror the legacy behaviour by listing target secrets and validating
    // the schema-id match before invoking the runner.
    const listed = await targetSecretsRepo.list(target.id);
    const listedByName = new Map(listed.map((s) => [s.name, s]));

    // Resolve prior provision outputs.
    const priorOutputs = await deps.lastSuccessfulProvisionOutputs(deploymentId);

    // Track the most recent verify report so we can surface it to finalize.
    let latestVerifyReport: VerificationReport | null = null;

    // The runner doesn't expose secretRef → schema metadata to its parser
    // callback, so we wrap parseTargetSecret to do the schema-mismatch check
    // here against the platform-http target_secrets summary listing. The
    // wrapper preserves the legacy DEPLOY_EXECUTOR_TARGET_SECRET_SCHEMA_MISMATCH
    // error code by returning a DEPLOY_*-prefixed code, which the runner
    // propagates verbatim.
    const parseTargetSecretWithSchemaCheck = (
      schemaId: string,
      value: unknown,
    ): ParseTargetSecretResult => {
      // Find the listing entry by value lookup. The runner only calls this for
      // values that exist in decryptedTargetSecrets (presence-checked first),
      // so we map the value back to its name via the decrypted map.
      const matchingName = Object.entries(decryptedTargetSecrets).find(
        ([, v]) => v === value,
      )?.[0];
      if (matchingName !== undefined) {
        const summary = listedByName.get(matchingName);
        if (summary !== undefined && summary.schema !== schemaId) {
          return {
            ok: false,
            errors: [
              {
                code: 'DEPLOY_EXECUTOR_TARGET_SECRET_SCHEMA_MISMATCH',
                message: `target secret "${matchingName}" has schema "${summary.schema}" but "${schemaId}" is required`,
              },
            ],
          };
        }
      }
      return parseTargetSecret(schemaId, value);
    };

    const inputs: RunDeploymentInputs = {
      composedBlueprint: deployInput,
      bundleDir,
      target,
      resolvedTargetSecrets: { apiToken, extras: decryptedTargetSecrets },
      orgSlug,
      configOverrides: ctx.configOverrides,
      priorProvisionOutputs: priorOutputs,
      resolveProvisioner: deps.resolveProvisioner,
      ...(deps.publicDeployDomain === undefined ? {} : { publicDeployDomain: deps.publicDeployDomain }),
      // The runner's dokployClientFactory takes (apiToken, extras?) but the
      // existing platform-http factory built via createDokployClientFactory
      // already decrypts apiToken from target.apiTokenCiphertext internally.
      // We close over `target` and ignore the runner-supplied apiToken.
      dokployClientFactory: (_apiToken, extras) =>
        deps.dokployClientFactory(target, extras),
      parseTargetSecret: parseTargetSecretWithSchemaCheck,
      hooks: {
        onLog: (line) =>
          appendLog(deps, deploymentId, orgId, line.level, line.step, line.message),
        onProvisionResult: (envelope) =>
          persistProvisionResultViaRepos(deps, deploymentId, orgId, envelope),
        onApplyResult: (envelope) =>
          persistApplyResultViaRepos(deps, deploymentId, orgId, envelope),
        onVerifyResult: (envelope) => {
          const report = envelope.report as VerificationReport | null | undefined;
          if (report !== null && report !== undefined) latestVerifyReport = report;
        },
        onTerminal: async (result) => {
          if (result.ok) {
            if (latestVerifyReport?.partialOk === true) {
              await finalize(deps, deploymentId, orgId, 'succeeded_with_warnings', {
                verificationReport: latestVerifyReport,
                warnings: ['smoke verification completed with warnings'],
              });
            } else {
              await finalize(deps, deploymentId, orgId, 'succeeded', {
                ...(latestVerifyReport === null ? {} : { verificationReport: latestVerifyReport }),
              });
            }
          } else {
            await finalize(deps, deploymentId, orgId, 'failed', {
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
              ...(result.errorTree === undefined
                ? {}
                : { errorTree: result.errorTree as PlatformError }),
              ...(latestVerifyReport === null
                ? {}
                : { verificationReport: latestVerifyReport }),
            });
          }
        },
      },
      ...(deps.runProvisioners === undefined ? {} : { runProvisioners: deps.runProvisioners }),
      ...(deps.planProject === undefined ? {} : { planProject: deps.planProject }),
      ...(deps.renderPlan === undefined ? {} : { renderPlan: deps.renderPlan }),
      ...(deps.applyPlan === undefined ? {} : { applyPlan: deps.applyPlan }),
      smoker: deps.smoker,
    };

    await orchestrate(inputs);
  } catch (cause) {
    deps.logger.error({ deploymentId, cause }, 'deploy executor failed');
    await finalize(deps, deploymentId, orgId, 'failed', {
      errorCode: 'DEPLOY_EXECUTOR_UNCAUGHT',
      errorMessage: redact(cause instanceof Error ? cause.message : String(cause)),
    }).catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function persistProvisionResultViaRepos(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  envelope: ProvisionResultEnvelope,
): Promise<void> {
  const { publicByModule, secretByModule, startedAt, finishedAt } = envelope;
  // Skip the DB write when the runner reports a no-op provision (no
  // discovered provisioner modules). The runner still fires the hook so
  // unit tests can observe the lifecycle in order; the executor decides
  // whether the empty envelope warrants a DeploymentProvisionResult row.
  if (Object.keys(publicByModule).length === 0 && Object.keys(secretByModule).length === 0) {
    return;
  }
  const persistence: DeploymentProvisionResult = {
    modules: {} as DeploymentProvisionResult['modules'],
    startedAt,
    finishedAt,
  };
  for (const [key, publicOutputs] of Object.entries(publicByModule)) {
    (persistence.modules as Record<string, { publicOutputs: Record<string, unknown>; provisionedAt: string }>)[key] = {
      publicOutputs: { ...publicOutputs },
      provisionedAt: finishedAt,
    };
  }

  const secretEnvelope = {
    modules: Object.fromEntries(
      Object.entries(secretByModule).map(([key, secrets]) => [
        key,
        { secretOutputs: { ...secrets }, provisionedAt: finishedAt },
      ]),
    ),
  };
  const enc: EncryptedSecret | null =
    Object.keys(secretEnvelope.modules).length > 0
      ? deps.secretCipher.encrypt(JSON.stringify(secretEnvelope))
      : null;

  await deps.withOrgTx(orgId, (repos) =>
    repos.deployments.setProvisionResult(deploymentId, persistence, enc),
  );
}

async function persistApplyResultViaRepos(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  envelope: ApplyResultEnvelope,
): Promise<void> {
  const actions = envelope.actions as { renderedPlanDigest?: string } & Record<string, unknown>;
  const digest = typeof actions.renderedPlanDigest === 'string' ? actions.renderedPlanDigest : undefined;
  await deps.withOrgTx(orgId, async (repos) => {
    if (digest !== undefined) {
      await repos.deployments.setRenderedDigest(deploymentId, digest);
    }
    await repos.deployments.setApplyResult(deploymentId, actions);
  });
}

async function startAndResolveContext(
  deploymentId: string,
  orgId: string,
  deps: ExecutorDeps,
): Promise<DeploymentContext> {
  return deps.withOrgTx(orgId, async (repos) => {
    const startedAt = new Date();
    const transition = await repos.deployments.transition(deploymentId, 'running', { startedAt });
    if (!isOk(transition)) throw new Error(transition.errors[0]?.code ?? 'DEPLOYMENT_INVALID_TRANSITION');
    const deployment = await repos.deployments.getById(deploymentId);
    if (!isOk(deployment) || !deployment.value) throw new Error('DEPLOYMENT_NOT_FOUND');
    const version = await repos.projectVersions.getById(deployment.value.projectVersionId);
    if (!isOk(version) || !version.value) throw new Error('PROJECT_VERSION_NOT_FOUND');
    const target = await repos.deployTargets.getWithSecretById(deployment.value.targetId);
    if (!isOk(target) || !target.value) throw new Error('DEPLOY_TARGET_NOT_FOUND');
    return {
      projectVersionId: deployment.value.projectVersionId,
      targetId: deployment.value.targetId,
      configOverrides: deployment.value.configOverrides,
      bundleBlobKey: version.value.bundleBlobKey,
      projectVersionSeq: version.value.seq,
      targetSlug: target.value.slug,
    };
  });
}

async function resolveTarget(
  deps: ExecutorDeps,
  orgId: string,
  targetId: string,
): Promise<DeployTargetWithSecret> {
  return deps.withOrgTx(orgId, async (repos) => {
    const target = await repos.deployTargets.getWithSecretById(targetId);
    if (!isOk(target) || !target.value) throw new Error('DEPLOY_TARGET_NOT_FOUND');
    return target.value;
  });
}

async function appendLog(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  level: 'info' | 'warn' | 'error',
  step: string,
  message: string,
): Promise<void> {
  await deps.withOrgTx(orgId, async (repos) => {
    await repos.deployments.appendLog({ deploymentId, orgId, level, step, message: redact(message) });
  });
}

async function finalize(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  status: 'succeeded' | 'succeeded_with_warnings' | 'failed' | 'failed_orphaned',
  args: {
    readonly errorCode?: string;
    readonly errorMessage?: string;
    readonly errorTree?: PlatformError;
    readonly verificationReport?: VerificationReport;
    readonly warnings?: unknown[];
  },
): Promise<void> {
  await deps.withOrgTx(orgId, async (repos) => {
    const result = await repos.deployments.finalize(deploymentId, { status, ...args });
    if (!isOk(result)) deps.logger.warn({ deploymentId, errors: result.errors }, 'finalize failed');

    const operation = await repos.projectOperations.getByDeploymentId(deploymentId);
    if (isOk(operation) && operation.value?.kind === 'update') {
      const opStatus = status === 'succeeded' || status === 'succeeded_with_warnings' ? 'succeeded' : 'failed';
      const finalized = await repos.projectOperations.finalize(operation.value.id, {
        status: opStatus,
        result: { deploymentId, deploymentStatus: status },
        ...(opStatus === 'failed' ? { errorCode: args.errorCode ?? status, errorMessage: args.errorMessage ?? status } : {}),
      });
      if (!isOk(finalized)) deps.logger.warn({ deploymentId, errors: finalized.errors }, 'project operation finalize failed');
    }
  });
}

async function defaultLoadComposed(dir: string): Promise<ResultLike<LoadedDeployProject>> {
  const result = await loadComposedBlueprint(dir);
  return result as ResultLike<LoadedDeployProject>;
}

async function toDeployCoreInput(
  value: LoadedDeployProject,
  rootDir: string,
): Promise<ComposedProjectInput> {
  if (!isComposedBlueprint(value)) return value;

  const uiBuildFiles =
    value.virtualEntrySource === null || value.virtualEntrySource === undefined
      ? {}
      : await bundleVirtualEntrySource(value.virtualEntrySource, rootDir);

  // Build modules map: service slug → { edgeAuth }. catalogManifest is keyed by
  // the resolved module manifest name (for example "@rntme/identity-auth0"),
  // while project.modules may use a local package alias such as
  // "rntme_identity_auth0". categoryToModule bridges the project role key to
  // the canonical manifest name used by the catalog.
  const catalogManifest = value.catalogManifest;
  const moduleEdgeAuth = catalogManifest?.moduleEdgeAuth ?? {};
  const modules: Record<string, { edgeAuth: (typeof moduleEdgeAuth)[string] | null; packageName?: string }> = {};
  for (const [projectKey, moduleRef] of Object.entries(value.project.modules ?? {})) {
    const manifestName = catalogManifest?.categoryToModule[projectKey] ?? moduleRef.package;
    const edgeAuth = moduleEdgeAuth[manifestName] ?? moduleEdgeAuth[moduleRef.package] ?? null;
    const slugs = new Set([manifestName.split('/').pop()!, moduleRef.package.split('/').pop()!]);
    for (const slug of slugs) {
      modules[slug] = { edgeAuth, packageName: manifestName };
    }
  }

  const workflowFiles =
    value.workflows === null || value.workflows === undefined
      ? undefined
      : await readWorkflowDefinitionFiles(value.workflows, rootDir);
  const workflowGrpcServices = workflowGrpcServicesForProject(value);

  return {
    name: value.project.name,
    publicConfigJson: value.publicConfigJson ?? null,
    varsManifest: value.varsManifest,
    services: Object.fromEntries(
      await Promise.all(
        value.project.services.map(async (slug) => [
          slug,
          {
            slug,
            kind: value.services[slug]?.kind ?? 'domain',
            ...(value.services[slug]?.kind === 'domain'
              ? { runtimeFiles: await buildRuntimeArtifactFiles(value, rootDir, slug, uiBuildFiles) }
              : {}),
          },
        ]),
      ),
    ),
    ...(value.project.routes === undefined ? {} : { routes: value.project.routes }),
    ...(value.project.middleware === undefined ? {} : { middleware: value.project.middleware }),
    ...(value.project.mounts === undefined ? {} : { mounts: value.project.mounts }),
    ...(Object.keys(modules).length > 0 ? { modules } : {}),
    ...(value.workflows === undefined ? {} : { workflows: value.workflows }),
    ...(workflowFiles === undefined ? {} : { workflowFiles }),
    ...(Object.keys(workflowGrpcServices).length === 0 ? {} : { workflowGrpcServices }),
  };
}

type WorkflowGrpcServiceRegistry = NonNullable<ComposedProjectInput['workflowGrpcServices']>;
type GrpcShapeRegistry = Parameters<typeof emitProto>[1];
type GrpcResolvedShape = GrpcShapeRegistry[string];

function workflowGrpcServicesForProject(project: ComposedBlueprint): WorkflowGrpcServiceRegistry {
  if (project.workflows === null || project.workflows === undefined) return {};
  const serviceSlugs = new Set(
    project.workflows.serviceTasks
      .map((task) => task.bindingRef.split('.')[0] ?? '')
      .filter((slug) => slug.length > 0),
  );
  const out: Record<string, WorkflowGrpcServiceRegistry[string]> = {};
  for (const serviceSlug of [...serviceSlugs].sort()) {
    const service = project.services[serviceSlug];
    if (service?.bindings === null || service?.bindings === undefined || service.graphSpec === null) continue;
    const packageName = grpcPackageNameForService(serviceSlug);
    const serviceName = grpcServiceNameForService(serviceSlug);
    out[serviceSlug] = {
      packageName,
      serviceName,
      protoSource: emitProto(service.bindings, collectGrpcShapesFromService(service), { packageName, serviceName }),
    };
  }
  return out;
}

function grpcPackageNameForService(serviceSlug: string): string {
  return `rntme.${serviceSlug.trim().toLowerCase().replace(/-/g, '_')}.v1`;
}

function grpcServiceNameForService(serviceSlug: string): string {
  return `${serviceSlug
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')}Service`;
}

function collectGrpcShapesFromService(service: ComposedBlueprint['services'][string]): GrpcShapeRegistry {
  const acc: Record<string, GrpcResolvedShape> = {};
  const addCustomShape = (shapeName: string): void => {
    if (acc[shapeName] !== undefined) return;
    const custom = service.graphSpec?.shapes[shapeName];
    if (custom === undefined) return;
    acc[shapeName] = {
      name: shapeName,
      origin: 'custom',
      fields: Object.fromEntries(
        Object.entries(custom.fields).map(([fieldName, field]) => [
          fieldName,
          {
            type: { kind: 'scalar', primitive: field.type },
            nullable: field.nullable,
          },
        ]),
      ),
    } as GrpcResolvedShape;
  };

  for (const resolved of Object.values(service.bindings?.resolved ?? {})) {
    acc[resolved.outputShape.name] = resolved.outputShape as GrpcResolvedShape;
    for (const input of Object.values(resolved.signature.inputs)) {
      if (input.type.kind === 'row' || input.type.kind === 'rowset') {
        addCustomShape(input.type.shape);
      }
    }
  }
  return acc;
}

async function readWorkflowDefinitionFiles(
  workflows: NonNullable<ComposedBlueprint['workflows']>,
  rootDir: string,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const definition of workflows.definitions) {
    if (Object.hasOwn(files, definition.bpmnFile)) continue;
    const path = workflowDefinitionPath(rootDir, definition.bpmnFile);
    try {
      files[definition.bpmnFile] = await readFile(path, 'utf8');
    } catch (cause) {
      if (errorCode(cause) === 'ENOENT') {
        throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_NOT_FOUND: workflows/${definition.bpmnFile}`);
      }
      throw cause;
    }
  }
  return files;
}

function workflowDefinitionPath(rootDir: string, relativePath: string): string {
  if (!isSafeWorkflowFilePath(relativePath)) {
    throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_PATH_INVALID: workflows/${relativePath}`);
  }
  const workflowRoot = join(rootDir, 'workflows');
  const filePath = join(workflowRoot, relativePath);
  const backToRoot = relative(workflowRoot, filePath).split('\\').join('/');
  if (backToRoot === '..' || backToRoot.startsWith('../')) {
    throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_PATH_INVALID: workflows/${relativePath}`);
  }
  return filePath;
}

function isSafeWorkflowFilePath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

async function buildRuntimeArtifactFiles(
  project: ComposedBlueprint,
  rootDir: string,
  serviceSlug: string,
  uiBuildFiles: Record<string, string>,
): Promise<Record<string, string>> {
  const service = project.services[serviceSlug];
  if (service === undefined) throw new Error(`DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_NOT_FOUND:${serviceSlug}`);
  if (service.graphSpec === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_GRAPHS_NOT_FOUND:${serviceSlug}`);
  if (service.qsmValidated === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_QSM_NOT_FOUND:${serviceSlug}`);
  if (service.bindings === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_BINDINGS_NOT_FOUND:${serviceSlug}`);

  const files: Record<string, string> = {};
  const modules = runtimeModulesForService(project, serviceSlug);
  addJsonFile(files, 'manifest.json', {
    rntmeVersion: '1.0',
    service: { name: serviceSlug, version: '1.0.0' },
    surface: { http: { enabled: true, port: 3000 }, grpc: { enabled: true, port: 50051 } },
    seed: { enabled: service.seed !== null, path: 'seed.json' },
    modules,
  });
  for (const module of modules) {
    files[module.protoPath] = IDENTITY_INTROSPECTION_PROTO;
  }
  addJsonFile(files, 'pdm.json', project.pdm);
  addJsonFile(files, 'qsm.json', service.qsmValidated);
  addJsonFile(files, 'bindings.json', service.bindings.artifact);
  addJsonFile(files, 'shapes.json', service.graphSpec.shapes);

  for (const [graphId, graph] of Object.entries(service.graphSpec.graphs)) {
    addJsonFile(files, `graphs/${graphId}.json`, graph);
  }

  const hasServiceUi = await addOptionalDirectoryFiles(files, rootDir, `services/${serviceSlug}/ui`, 'ui');
  if (!hasServiceUi) addDefaultUiFiles(files, serviceSlug);
  Object.assign(files, uiBuildFiles);
  if (service.seed !== null) {
    await addOptionalTextFile(files, rootDir, `services/${serviceSlug}/seed/seed.json`, 'seed.json');
  }

  return files;
}

async function bundleVirtualEntrySource(
  virtualEntrySource: string,
  rootDir: string,
): Promise<Record<string, string>> {
  const workspaceRoot = findWorkspaceRoot();
  const outdir = join(rootDir, '.rntme-ui-build');
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  const entrypoint = join(outdir, '__rntme_ui_entry.tsx');
  await writeFile(entrypoint, virtualEntrySource);

  const result = await Bun.build({
    entrypoints: [entrypoint],
    root: workspaceRoot,
    target: 'browser',
    format: 'esm',
    splitting: true,
    sourcemap: 'none',
    minify: true,
    outdir,
    naming: { entry: 'main.js', chunk: 'chunks/[name]-[hash].[ext]' },
    env: 'disable',
    plugins: [workspacePackageResolver(workspaceRoot)],
    throw: false,
  });
  if (!result.success) {
    const logs = result.logs.map((log) => log.message).join('\n');
    throw new Error(`DEPLOY_EXECUTOR_UI_BUNDLE_FAILED${logs === '' ? '' : `:${logs}`}`);
  }

  const js = result.outputs.find((file) => file.path.endsWith('/main.js') || file.path.endsWith('\\main.js'));
  if (js === undefined) throw new Error('DEPLOY_EXECUTOR_UI_BUNDLE_MISSING_MAIN_JS');

  const files: Record<string, string> = { 'ui-build/main.css': readUiRuntimeCss(workspaceRoot) };
  for (const file of result.outputs) {
    const rel = relative(outdir, file.path).split('\\').join('/');
    if (rel.startsWith('..') || rel === '') continue;
    files[`ui-build/${rel}`] = await file.text();
  }
  return files;
}

function workspacePackageResolver(workspaceRoot: string): Bun.BunPlugin {
  const packageDirs = discoverWorkspacePackageDirs(workspaceRoot);
  return {
    name: 'rntme-workspace-package-resolver',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@rntme\// }, (args) => {
        const packageName = packageNameFromImport(args.path);
        const packageDir = packageDirs.get(packageName);
        if (packageDir === undefined) return undefined;
        const subpath = args.path.slice(packageName.length);
        return { path: resolveWorkspaceExport(packageDir, subpath.length === 0 ? '.' : `.${subpath}`) };
      });
      buildApi.onResolve({ filter: /^\..*\.js$/ }, (args) => {
        const jsPath = join(args.resolveDir, args.path);
        if (existsSync(jsPath)) return undefined;
        const withoutJs = jsPath.slice(0, -'.js'.length);
        for (const candidate of [`${withoutJs}.ts`, `${withoutJs}.tsx`]) {
          if (existsSync(candidate)) return { path: candidate };
        }
        return undefined;
      });
      buildApi.onResolve({ filter: /\.css$/ }, (args) => ({
        path: args.path,
        namespace: 'rntme-empty-css',
      }));
      buildApi.onLoad({ filter: /.*/, namespace: 'rntme-empty-css' }, () => ({
        contents: '',
        loader: 'js',
      }));
    },
  };
}

function discoverWorkspacePackageDirs(workspaceRoot: string): Map<string, string> {
  const dirs = new Map<string, string>();
  for (const parent of ['packages', 'modules']) {
    collectPackageDirs(join(workspaceRoot, parent), dirs);
  }
  return dirs;
}

function collectPackageDirs(dir: string, output: Map<string, string>): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    const packageJsonPath = join(path, 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: unknown };
      if (typeof pkg.name === 'string') output.set(pkg.name, path);
      continue;
    }
    collectPackageDirs(path, output);
  }
}

function packageNameFromImport(value: string): string {
  const [scope, name] = value.split('/');
  return `${scope}/${name}`;
}

function resolveWorkspaceExport(packageDir: string, subpath: string): string {
  const packageJsonPath = join(packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: unknown;
    main?: unknown;
  };
  const target = exportTargetForSubpath(pkg.exports, subpath) ?? (subpath === '.' ? pkg.main : undefined);
  if (typeof target === 'string') return resolveWorkspaceTarget(packageDir, target);
  return join(packageDir, subpath === '.' ? 'index.js' : subpath.slice(2));
}

function resolveWorkspaceTarget(packageDir: string, target: string): string {
  const normalized = target.replace(/^\.\//, '');
  const direct = join(packageDir, normalized);
  if (existsSync(direct)) return direct;

  for (const candidate of sourceFallbacks(packageDir, normalized)) {
    if (existsSync(candidate)) return candidate;
  }

  return direct;
}

function sourceFallbacks(packageDir: string, normalized: string): string[] {
  const withoutJs = normalized.endsWith('.js') ? normalized.slice(0, -'.js'.length) : normalized;
  const candidates: string[] = [];

  if (withoutJs.startsWith('dist/client/')) {
    const rest = withoutJs.slice('dist/client/'.length);
    candidates.push(join(packageDir, 'client', `${rest}.ts`));
    candidates.push(join(packageDir, 'client', `${rest}.tsx`));
    candidates.push(join(packageDir, 'src', 'client', `${rest}.ts`));
    candidates.push(join(packageDir, 'src', 'client', `${rest}.tsx`));
  }

  if (withoutJs.startsWith('dist/')) {
    const rest = withoutJs.slice('dist/'.length);
    candidates.push(join(packageDir, 'src', `${rest}.ts`));
    candidates.push(join(packageDir, 'src', `${rest}.tsx`));
  }

  return candidates;
}

function exportTargetForSubpath(exportsField: unknown, subpath: string): string | undefined {
  if (typeof exportsField === 'string' && subpath === '.') return exportsField;
  if (typeof exportsField !== 'object' || exportsField === null) return undefined;
  const exportsMap = exportsField as Record<string, unknown>;
  const value = exportsMap[subpath];
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const conditionMap = value as Record<string, unknown>;
    if (typeof conditionMap.import === 'string') return conditionMap.import;
    if (typeof conditionMap.default === 'string') return conditionMap.default;
  }
  return undefined;
}

function findWorkspaceRoot(): string {
  for (const start of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
    let current = start;
    while (true) {
      if (
        (existsSync(join(current, 'packages', 'runtime', 'ui-runtime', 'package.json')) ||
          existsSync(join(current, 'packages', 'ui-runtime', 'package.json'))) &&
        existsSync(join(current, 'modules'))
      ) {
        return current;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return process.cwd();
}

export function readUiRuntimeCss(workspaceRoot: string): string {
  for (const cssPath of [
    join(workspaceRoot, 'packages', 'runtime', 'ui-runtime', 'build', 'main.css'),
    join(workspaceRoot, 'packages', 'ui-runtime', 'build', 'main.css'),
  ]) {
    if (existsSync(cssPath)) return readFileSync(cssPath, 'utf8');
  }
  return '/* rntme ui runtime styles unavailable at deploy bundle time */\n';
}

function runtimeModulesForService(
  project: ComposedBlueprint,
  serviceSlug: string,
): Array<{ name: string; grpc: { address: string }; protoPath: string }> {
  const slugs = new Set<string>();
  for (const [middlewareName, declaration] of Object.entries(project.project.middleware ?? {})) {
    if (declaration.kind !== 'auth' || declaration.moduleSlug === undefined) continue;
    if (!middlewareAppliesToService(project.project, middlewareName, serviceSlug)) continue;
    slugs.add(declaration.moduleSlug);
  }
  return [...slugs].sort().map((slug) => ({
    name: slug,
    grpc: { address: `${slug}:50051` },
    protoPath: `${slug}.proto`,
  }));
}

function middlewareAppliesToService(
  project: ComposedBlueprint['project'],
  middlewareName: string,
  serviceSlug: string,
): boolean {
  for (const mount of project.mounts ?? []) {
    if (!mount.use.includes(middlewareName)) continue;
    if (serviceForMountTarget(project, mount.target) === serviceSlug) return true;
  }
  return false;
}

function serviceForMountTarget(project: ComposedBlueprint['project'], target: string): string | undefined {
  if (target.startsWith('http:')) return project.routes?.http?.[target.slice('http:'.length)];
  if (target.startsWith('ui:')) return project.routes?.ui?.[target.slice('ui:'.length)];
  return undefined;
}

function addDefaultUiFiles(files: Record<string, string>, serviceSlug: string): void {
  const title = serviceSlug
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ') || 'Service';
  addJsonFile(files, 'ui/manifest.json', {
    version: '2.0',
    pdmRef: `${serviceSlug}.domain.v1`,
    qsmRef: `${serviceSlug}.read.v1`,
    graphSpecRef: `${serviceSlug}.graphs.v1`,
    bindingsRef: `${serviceSlug}.bindings.v1`,
    metadata: { title },
    layouts: { main: 'layouts/main' },
    routes: {
      '/': {
        layout: 'main',
        screen: 'screens/home',
      },
    },
  });
  addJsonFile(files, 'ui/layouts/main.screen.json', {});
  addJsonFile(files, 'ui/layouts/main.spec.json', {
    root: 'shell',
    elements: {
      shell: {
        type: 'Stack',
        props: { direction: 'vertical' },
        children: ['header'],
      },
      header: {
        type: 'Heading',
        props: { level: 1, text: title },
      },
    },
  });
  addJsonFile(files, 'ui/screens/home.screen.json', {
    metadata: { title },
  });
  addJsonFile(files, 'ui/screens/home.spec.json', {
    root: 'page',
    elements: {
      page: {
        type: 'Heading',
        props: { level: 1, text: title },
        children: [],
      },
    },
  });
}

async function addOptionalDirectoryFiles(
  files: Record<string, string>,
  rootDir: string,
  sourceRel: string,
  targetRel: string,
): Promise<boolean> {
  const sourceRoot = join(rootDir, sourceRel);
  try {
    await addDirectoryFilesFrom(files, sourceRoot, sourceRoot, targetRel);
    return true;
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return false;
    throw cause;
  }
}

async function addDirectoryFilesFrom(
  files: Record<string, string>,
  sourceRoot: string,
  currentDir: string,
  targetRel: string,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await addDirectoryFilesFrom(files, sourceRoot, sourcePath, targetRel);
      continue;
    }
    if (entry.isFile()) {
      files[join(targetRel, relative(sourceRoot, sourcePath))] = await readFile(sourcePath, 'utf8');
    }
  }
}

async function addOptionalTextFile(
  files: Record<string, string>,
  rootDir: string,
  sourceRel: string,
  targetRel: string,
): Promise<void> {
  try {
    files[targetRel] = await readFile(join(rootDir, sourceRel), 'utf8');
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return;
    throw cause;
  }
}

function addJsonFile(files: Record<string, string>, targetRel: string, value: unknown): void {
  files[targetRel] = `${JSON.stringify(value, null, 2)}\n`;
}

function errorCode(cause: unknown): string | undefined {
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) return undefined;
  const code = (cause as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function isComposedBlueprint(value: LoadedDeployProject): value is ComposedBlueprint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'project' in value &&
    'pdm' in value &&
    'routing' in value &&
    'bindingRegistry' in value
  );
}

function errorSummary(errors: readonly { readonly code?: string; readonly message?: string }[]): string {
  return errors.map((error) => `${error.code ?? 'UNKNOWN'}: ${error.message ?? ''}`).join('; ');
}
