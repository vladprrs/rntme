import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { materializeBundle } from '@rntme/blueprint';
import {
  isOk,
  parseCanonicalBundle,
  parseTargetSecret,
  startProjectUpdateOperation,
} from '@rntme/platform-core';
import {
  buildResolveProvisioner,
  createDokployClientFactory,
  runDeployment,
  type ResolveProvisioner,
  type RunDeploymentInputs,
  type SanitizedLogLine,
  type TerminalResult,
} from '@rntme/deploy-runner';
import { requireActiveRuntimeSession, resolveAuthorizedOrg } from './shared.js';
import { decryptRuntimeSecret, readRuntimeSecretKey } from './_shared/secret-cipher.js';
import type {
  StartDeploymentHandlerDeps,
  StartDeploymentHandlerInput,
  StartDeploymentHandlerOutput,
} from './types.js';

type RuntimeCtx = {
  readonly qsmDb: {
    readonly prepare: <P = unknown, R = unknown>(sql: string) => {
      readonly get: (...args: unknown[]) => R | undefined;
      readonly run: (...args: unknown[]) => unknown;
    };
  };
  readonly nextId?: () => string;
  readonly now?: () => string;
  readonly awaitRuntimeDeployment?: boolean;
  readonly runtimeDeploymentRunner?: (job: RuntimeDeploymentJob) => void | Promise<void>;
};

type ProjectRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly status: string;
};

type ProjectVersionRow = {
  readonly id: string;
  readonly project_id: string;
  readonly sequence: number;
  readonly bundle_digest: string;
  readonly bundle_object_key: string;
  readonly status: string;
  readonly created_at: string;
};

type DeployTargetRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly provider: string;
  readonly config_json: string;
  readonly status: string;
};

type RuntimeDeploymentJob = {
  readonly ctx: RuntimeCtx;
  readonly orgId: string;
  readonly project: ProjectRow;
  readonly version: ProjectVersionRow;
  readonly target: DeployTargetRow;
  readonly operationId: string;
  readonly deploymentId: string;
  readonly configOverrides: Record<string, unknown>;
};

type BundleRow = {
  readonly bundle_bytes: Uint8Array;
};

type TargetSecretRow = {
  readonly api_token_ciphertext: string;
  readonly api_token_nonce: string;
  readonly target_secrets_ciphertext: string;
  readonly target_secrets_nonce: string;
};

/**
 * Native handler for POST /api/deployments.
 *
 * Authenticates with the platform API-token provider, resolves the
 * organization (id, slug, or WorkOS org id), the project (id or slug under
 * that org), then delegates to `startProjectUpdateOperation` which creates a
 * ProjectOperation + a queued Deployment row. The platform's BPMN/native
 * deploy-runner picks the queued deployment up from there.
 */
export async function startDeploymentHandler(
  depsOrInput: StartDeploymentHandlerDeps | StartDeploymentHandlerInput,
  inputOrCtx: StartDeploymentHandlerInput | RuntimeCtx,
): Promise<StartDeploymentHandlerOutput> {
  if (!isDeps(depsOrInput)) {
    return startDeploymentRuntimeNative(depsOrInput, inputOrCtx as RuntimeCtx);
  }
  const deps = depsOrInput;
  const input = inputOrCtx as StartDeploymentHandlerInput;
  const authz = await resolveAuthorizedOrg({
    provider: deps.provider,
    organizations: deps.repos.organizations,
    authorization: input.authorization,
    organizationId: input.organizationId,
  });
  if (authz.status !== 'ok') return { status: 'error', errors: authz.errors };
  const { subject, orgId } = authz;

  const byId = await deps.repos.projects.findById(orgId, input.projectId);
  if (!isOk(byId)) return { status: 'error', errors: byId.errors };
  let project = byId.value;
  if (!project) {
    const bySlug = await deps.repos.projects.findBySlug(orgId, input.projectId);
    if (!isOk(bySlug)) return { status: 'error', errors: bySlug.errors };
    project = bySlug.value;
  }
  if (!project) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }],
    };
  }

  const result = await startProjectUpdateOperation(
    {
      repos: {
        projects: deps.repos.projects,
        projectVersions: deps.repos.projectVersions,
        deployTargets: deps.repos.deployTargets,
        deployments: deps.repos.deployments,
        projectOperations: deps.repos.projectOperations,
      },
      ids: deps.ids,
    },
    {
      orgId,
      projectId: project.id,
      accountId: subject.account.id,
      tokenId: subject.tokenId ?? null,
      req: {
        targetSlug: input.targetSlug,
        projectVersionSeq: input.projectVersionSeq,
      },
    },
  );
  if (!isOk(result)) return { status: 'error', errors: result.errors };
  return {
    status: 'started',
    operation: result.value.operation,
    deployment: result.value.deployment,
  };
}

async function startDeploymentRuntimeNative(input: StartDeploymentHandlerInput, ctx: RuntimeCtx): Promise<StartDeploymentHandlerOutput> {
  const session = requireActiveRuntimeSession(input);
  if (session.status !== 'ok') return { status: 'error', errors: session.errors };
  if (!isRuntimeCtx(ctx)) {
    return {
      status: 'error',
      errors: [{
        code: 'PLATFORM_STORAGE_DB_UNAVAILABLE',
        message: 'runtime-native deployment start requires runtime deployment storage',
      }],
    };
  }

  const project = resolveRuntimeProject(ctx, input.organizationId, input.projectId);
  if (project === null) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }],
    };
  }
  if (project.status !== 'active') {
    return {
      status: 'error',
      errors: [{ code: 'PROJECT_OPERATION_INVALID_STATE', message: project.status }],
    };
  }

  const version = ctx.qsmDb.prepare<[string, number], ProjectVersionRow>(`
    SELECT
      id,
      project_id,
      sequence,
      bundle_digest,
      bundle_object_key,
      status,
      created_at
    FROM project_versions
    WHERE project_id = ? AND sequence = ?
    LIMIT 1
  `).get(project.id, input.projectVersionSeq);
  if (version === undefined || version.status !== 'published') {
    return {
      status: 'error',
      errors: [{ code: 'DEPLOY_REQUEST_VERSION_NOT_FOUND', message: `project version seq ${input.projectVersionSeq} not found` }],
    };
  }

  const target = ctx.qsmDb.prepare<[string, string], DeployTargetRow>(`
    SELECT
      id,
      organization_id,
      slug,
      provider,
      config_json,
      status
    FROM deploy_targets
    WHERE organization_id = ? AND slug = ? AND status = 'active'
    LIMIT 1
  `).get(input.organizationId, input.targetSlug);
  if (target === undefined) {
    return {
      status: 'error',
      errors: [{ code: 'DEPLOY_REQUEST_TARGET_NOT_FOUND', message: input.targetSlug }],
    };
  }

  const active = ctx.qsmDb.prepare<[string, string], { readonly id: string }>(`
    SELECT id
    FROM deployments
    WHERE project_id = ? AND target_id = ? AND status IN ('queued', 'running')
    LIMIT 1
  `).get(project.id, target.id);
  if (active !== undefined) {
    return {
      status: 'error',
      errors: [{ code: 'PROJECT_OPERATION_ACTIVE_DEPLOYMENT', message: target.slug }],
    };
  }

  const operationId = nextId(ctx);
  const deploymentId = nextId(ctx);
  const now = nowIso(ctx);
  const configOverrides = input.configOverrides ?? {};
  const operationInput = {
    projectVersionSeq: version.sequence,
    targetSlug: target.slug,
    configOverrides,
    targetId: target.id,
    projectVersionId: version.id,
  };
  const operationResult = { deploymentId };
  const deploymentEnvelope = {
    projectVersionSeq: version.sequence,
    targetSlug: target.slug,
    configOverrides,
    renderedPlanDigest: null,
    applyResult: null,
    verificationReport: null,
    warnings: [],
    errorCode: null,
    errorMessage: null,
    errorTree: null,
    startedByAccountId: session.accountId,
    lastHeartbeatAt: null,
  };

  ctx.qsmDb.prepare(`
    INSERT INTO project_operations (
      id,
      organization_id,
      project_id,
      kind,
      status,
      input_json,
      result_json,
      created_at,
      started_at,
      finished_at,
      last_event_id,
      last_event_version,
      applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    operationId,
    input.organizationId,
    project.id,
    'update',
    'queued',
    JSON.stringify(operationInput),
    JSON.stringify(operationResult),
    now,
    null,
    null,
    nextId(ctx),
    1,
    now,
  );

  ctx.qsmDb.prepare(`
    INSERT INTO deployments (
      id,
      organization_id,
      project_id,
      project_version_id,
      target_id,
      status,
      result_json,
      created_at,
      started_at,
      finished_at,
      last_event_id,
      last_event_version,
      applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    deploymentId,
    input.organizationId,
    project.id,
    version.id,
    target.id,
    'queued',
    JSON.stringify(deploymentEnvelope),
    now,
    null,
    null,
    nextId(ctx),
    1,
    now,
  );

  const output: StartDeploymentHandlerOutput = {
    status: 'started',
    operation: {
      id: operationId,
      orgId: input.organizationId,
      projectId: project.id,
      kind: 'update',
      status: 'queued',
      requestedByAccountId: session.accountId,
      requestedByTokenId: null,
      targetId: target.id,
      projectVersionId: version.id,
      deploymentId,
      input: operationInput,
      result: operationResult,
      errorCode: null,
      errorMessage: null,
      queuedAt: new Date(now),
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
    },
    deployment: {
      id: deploymentId,
      projectId: project.id,
      orgId: input.organizationId,
      projectVersionId: version.id,
      projectVersionSeq: version.sequence,
      targetId: target.id,
      targetSlug: target.slug,
      status: 'queued',
      configOverrides,
      renderedPlanDigest: null,
      applyResult: null,
      verificationReport: null,
      warnings: [],
      errorCode: null,
      errorMessage: null,
      errorTree: null,
      startedByAccountId: session.accountId,
      queuedAt: new Date(now),
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
    },
  };

  const job: RuntimeDeploymentJob = {
    ctx,
    orgId: input.organizationId,
    project,
    version,
    target,
    operationId,
    deploymentId,
    configOverrides,
  };
  const runner = ctx.runtimeDeploymentRunner ?? executeRuntimeDeployment;
  const dispatched = dispatchRuntimeDeployment(job, runner);
  if (ctx.awaitRuntimeDeployment === true) await dispatched;

  return output;
}

async function dispatchRuntimeDeployment(
  job: RuntimeDeploymentJob,
  runner: (job: RuntimeDeploymentJob) => void | Promise<void>,
): Promise<void> {
  try {
    await runner(job);
  } catch (cause) {
    await failRuntimeDeployment(job, 'DEPLOY_RUNTIME_RUNNER_FAILED', errorMessage(cause));
  }
}

async function executeRuntimeDeployment(job: RuntimeDeploymentJob): Promise<void> {
  const { ctx, deploymentId, operationId } = job;
  const startedAt = nowIso(ctx);
  markRuntimeDeploymentRunning(ctx, deploymentId, operationId, startedAt);

  let bundleDir: string | null = null;
  const state: {
    applyResult: Record<string, unknown> | null;
    verificationReport: Record<string, unknown> | null;
  } = {
    applyResult: null,
    verificationReport: null,
  };

  try {
    const bundleBytes = readRuntimeBundleBytes(ctx, job.version.id);
    const parsedBundle = parseCanonicalBundle(bundleBytes);
    if (!isOk(parsedBundle)) {
      await failRuntimeDeployment(job, parsedBundle.errors[0]?.code ?? 'DEPLOY_BUNDLE_INVALID', parsedBundle.errors[0]?.message ?? 'invalid bundle');
      return;
    }

    const secrets = readRuntimeTargetSecrets(ctx, job.target.id);
    if (secrets.status === 'error') {
      await failRuntimeDeployment(job, secrets.code, secrets.message);
      return;
    }

    const target = runtimeTargetForRunner(job.target);
    bundleDir = await materializeBundle(parsedBundle.value.bundle);
    const terminal = await runDeployment({
      bundleDir,
      target,
      resolvedTargetSecrets: {
        apiToken: secrets.apiToken,
        extras: secrets.targetSecrets,
      },
      orgSlug: job.orgId,
      configOverrides: job.configOverrides,
      priorProvisionOutputs: {},
      resolveProvisioner: createRuntimeResolveProvisioner(),
      dokployClientFactory: (apiToken, extras) =>
        buildRuntimeDokployClient(apiToken, target.dokployUrl, extras),
      parseTargetSecret: parseTargetSecret as NonNullable<RunDeploymentInputs['parseTargetSecret']>,
      hooks: {
        onLog: (line) => appendRuntimeDeploymentLog(ctx, deploymentId, line),
        onStageBegin: (stage) => appendRuntimeDeploymentLog(ctx, deploymentId, {
          level: 'info',
          step: stage,
          message: `${stage} started`,
        }),
        onApplyResult: (payload) => {
          state.applyResult = payload as unknown as Record<string, unknown>;
        },
        onVerifyResult: (payload) => {
          state.verificationReport = payload.report as Record<string, unknown>;
        },
      },
    });

    markRuntimeDeploymentTerminal(ctx, {
      deploymentId,
      operationId,
      terminal,
      applyResult: state.applyResult,
      verificationReport: state.verificationReport,
    });
  } catch (cause) {
    await failRuntimeDeployment(job, 'DEPLOY_RUNTIME_RUNNER_FAILED', errorMessage(cause));
  } finally {
    if (bundleDir !== null) await rm(bundleDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function readRuntimeBundleBytes(ctx: RuntimeCtx, versionId: string): Buffer {
  const row = ctx.qsmDb.prepare<[string], BundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(versionId);
  if (row === undefined) throw new Error('DEPLOY_BUNDLE_BYTES_NOT_FOUND');
  return Buffer.from(row.bundle_bytes);
}

function readRuntimeTargetSecrets(ctx: RuntimeCtx, targetId: string):
  | { readonly status: 'ok'; readonly apiToken: string; readonly targetSecrets: Record<string, unknown> }
  | { readonly status: 'error'; readonly code: string; readonly message: string } {
  const key = readRuntimeSecretKey();
  if (key.status === 'error') return key;

  const row = ctx.qsmDb.prepare<[string], TargetSecretRow>(`
    SELECT
      api_token_ciphertext,
      api_token_nonce,
      target_secrets_ciphertext,
      target_secrets_nonce
    FROM deploy_target_secrets
    WHERE target_id = ?
    LIMIT 1
  `).get(targetId);
  if (row === undefined) {
    return {
      status: 'error',
      code: 'DEPLOY_TARGET_SECRETS_NOT_FOUND',
      message: 'deploy target secrets were not found',
    };
  }

  try {
    const apiToken = decryptRuntimeSecret(key.cipher, row.api_token_ciphertext, row.api_token_nonce);
    const targetSecretsRaw = decryptRuntimeSecret(key.cipher, row.target_secrets_ciphertext, row.target_secrets_nonce);
    const parsed = JSON.parse(targetSecretsRaw) as unknown;
    return {
      status: 'ok',
      apiToken,
      targetSecrets: parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {},
    };
  } catch {
    return {
      status: 'error',
      code: 'DEPLOY_TARGET_SECRET_DECRYPT_FAILED',
      message: 'deploy target secrets could not be decrypted',
    };
  }
}

function runtimeTargetForRunner(row: DeployTargetRow): RunDeploymentInputs['target'] {
  const config = parseConfigJson(row.config_json);
  return {
    id: row.id,
    slug: row.slug,
    displayName: readString(config.displayName) ?? row.slug,
    kind: 'dokploy',
    dokployUrl: readString(config.dokployUrl) ?? '',
    publicBaseUrl: readNullableString(config.publicBaseUrl),
    dokployProjectId: readNullableString(config.dokployProjectId),
    dokployProjectName: readNullableString(config.dokployProjectName),
    allowCreateProject: readBoolean(config.allowCreateProject) ?? false,
    eventBus: (readRecord(config.eventBus) as RunDeploymentInputs['target']['eventBus'] | null) ?? { kind: 'kafka', mode: 'external', brokers: [] },
    ...(readRecord(config.services) === null ? {} : { services: readRecord(config.services) as RunDeploymentInputs['target']['services'] }),
    modules: (readRecord(config.modules) as RunDeploymentInputs['target']['modules'] | null) ?? {},
    workflows: readNullableRecord(config.workflows) as RunDeploymentInputs['target']['workflows'],
    storage: (readRecord(config.storage) as RunDeploymentInputs['target']['storage'] | null) ?? { mode: 'external' },
    auth: readRecord(config.auth) ?? {},
    policyValues: readRecord(config.policyValues) as RunDeploymentInputs['target']['policyValues'] ?? {},
    manualAccess: readRecord(config.manualAccess) ?? {},
  };
}

function buildRuntimeDokployClient(
  apiToken: string,
  dokployUrl: string,
  resolvedTargetSecrets?: Readonly<Record<string, unknown>>,
): ReturnType<ReturnType<typeof createDokployClientFactory>> {
  const cipher = {
    encrypt: () => ({ ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 0 }),
    decrypt: () => apiToken,
  };
  const factory = createDokployClientFactory(cipher, parseTargetSecret as Parameters<typeof createDokployClientFactory>[1]);
  return factory({
    apiTokenCiphertext: Buffer.alloc(0),
    apiTokenNonce: Buffer.alloc(0),
    apiTokenKeyVersion: 0,
    dokployUrl,
  }, resolvedTargetSecrets);
}

export function createRuntimeResolveProvisioner(): ResolveProvisioner {
  return buildResolveProvisioner({
    bundleAssetDir: 'assets/provisioners',
    manifestPath: '.provisioners/manifest.json',
    errorCodePrefix: 'DEPLOY_PROVISIONER',
  });
}

function markRuntimeDeploymentRunning(ctx: RuntimeCtx, deploymentId: string, operationId: string, startedAt: string): void {
  updateDeploymentEnvelope(ctx, deploymentId, { lastHeartbeatAt: startedAt });
  ctx.qsmDb.prepare(`
    UPDATE deployments
    SET status = 'running',
        started_at = COALESCE(started_at, ?),
        last_event_id = ?,
        last_event_version = last_event_version + 1,
        applied_at = ?
    WHERE id = ?
  `).run(startedAt, nextId(ctx), startedAt, deploymentId);
  ctx.qsmDb.prepare(`
    UPDATE project_operations
    SET status = 'running',
        started_at = COALESCE(started_at, ?),
        last_event_id = ?,
        last_event_version = last_event_version + 1,
        applied_at = ?
    WHERE id = ?
  `).run(startedAt, nextId(ctx), startedAt, operationId);
}

function markRuntimeDeploymentTerminal(
  ctx: RuntimeCtx,
  input: {
    readonly deploymentId: string;
    readonly operationId: string;
    readonly terminal: TerminalResult;
    readonly applyResult: Record<string, unknown> | null;
    readonly verificationReport: Record<string, unknown> | null;
  },
): void {
  const finishedAt = nowIso(ctx);
  const status = input.terminal.ok ? 'succeeded' : 'failed';
  const errorCode = input.terminal.ok ? null : input.terminal.errorCode;
  const errorMessage = input.terminal.ok ? null : input.terminal.errorMessage;
  updateDeploymentEnvelope(ctx, input.deploymentId, {
    applyResult: input.applyResult,
    verificationReport: input.verificationReport,
    errorCode,
    errorMessage,
    errorTree: input.terminal.ok ? null : input.terminal.errorTree ?? null,
    lastHeartbeatAt: finishedAt,
  });
  ctx.qsmDb.prepare(`
    UPDATE deployments
    SET status = ?,
        finished_at = ?,
        last_event_id = ?,
        last_event_version = last_event_version + 1,
        applied_at = ?
    WHERE id = ?
  `).run(status, finishedAt, nextId(ctx), finishedAt, input.deploymentId);
  ctx.qsmDb.prepare(`
    UPDATE project_operations
    SET status = ?,
        result_json = ?,
        finished_at = ?,
        last_event_id = ?,
        last_event_version = last_event_version + 1,
        applied_at = ?
    WHERE id = ?
  `).run(
    status,
    JSON.stringify(input.terminal.ok
      ? { deploymentId: input.deploymentId, status }
      : { deploymentId: input.deploymentId, status, errorCode, errorMessage }),
    finishedAt,
    nextId(ctx),
    finishedAt,
    input.operationId,
  );
}

async function failRuntimeDeployment(job: RuntimeDeploymentJob, code: string, message: string): Promise<void> {
  appendRuntimeDeploymentLog(job.ctx, job.deploymentId, { level: 'error', step: 'deploy', message });
  markRuntimeDeploymentTerminal(job.ctx, {
    deploymentId: job.deploymentId,
    operationId: job.operationId,
    terminal: { ok: false, kind: 'failed', errorCode: code, errorMessage: message },
    applyResult: null,
    verificationReport: null,
  });
}

function appendRuntimeDeploymentLog(ctx: RuntimeCtx, deploymentId: string, line: SanitizedLogLine): void {
  const now = nowIso(ctx);
  ctx.qsmDb.prepare(`
    INSERT INTO deployment_log_lines (
      id,
      deployment_id,
      level,
      stage,
      message,
      created_at,
      status,
      last_event_id,
      last_event_version,
      applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(nextDeploymentLogId(ctx)),
    deploymentId,
    line.level,
    line.step,
    line.message,
    now,
    'recorded',
    nextId(ctx),
    1,
    now,
  );
}

function nextDeploymentLogId(ctx: RuntimeCtx): number {
  const row = ctx.qsmDb.prepare<[], { readonly id: number | null }>(`
    SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS id
    FROM deployment_log_lines
  `).get();
  return row?.id ?? 1;
}

function updateDeploymentEnvelope(ctx: RuntimeCtx, deploymentId: string, patch: Record<string, unknown>): void {
  const current = ctx.qsmDb.prepare<[string], { readonly result_json: string | null }>(`
    SELECT result_json
    FROM deployments
    WHERE id = ?
    LIMIT 1
  `).get(deploymentId);
  const next = { ...parseConfigJson(current?.result_json ?? null), ...patch };
  ctx.qsmDb.prepare(`
    UPDATE deployments
    SET result_json = ?
    WHERE id = ?
  `).run(JSON.stringify(next), deploymentId);
}

function resolveRuntimeProject(ctx: RuntimeCtx, orgId: string, projectIdOrSlug: string): ProjectRow | null {
  const byId = ctx.qsmDb.prepare<[string, string], ProjectRow>(`
    SELECT
      id,
      organization_id,
      slug,
      status
    FROM projects
    WHERE organization_id = ? AND id = ?
    LIMIT 1
  `).get(orgId, projectIdOrSlug);
  if (byId !== undefined) return byId;

  return ctx.qsmDb.prepare<[string, string], ProjectRow>(`
    SELECT
      id,
      organization_id,
      slug,
      status
    FROM projects
    WHERE organization_id = ? AND slug = ?
    LIMIT 1
  `).get(orgId, projectIdOrSlug) ?? null;
}

function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

function nextId(ctx: RuntimeCtx): string {
  return ctx.nextId?.() ?? randomUUID();
}

function nowIso(ctx: RuntimeCtx): string {
  return ctx.now?.() ?? new Date().toISOString();
}

function parseConfigJson(raw: string | null): Record<string, unknown> {
  if (raw === null) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : readString(value);
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readNullableRecord(value: unknown): Record<string, unknown> | null {
  return value === null || value === undefined ? null : readRecord(value);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function isDeps(value: unknown): value is StartDeploymentHandlerDeps {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { provider?: { authenticate?: unknown } }).provider?.authenticate === 'function'
    && typeof (value as { repos?: unknown }).repos === 'object';
}
