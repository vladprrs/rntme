import type {
  DokployApplication,
  DokployClient,
  DokployCompose,
  DokployComposeServiceSummary,
  DokployComposeTaskInspection,
} from './client.js';
import { isComposeTaskHealthy } from './client.js';
import type {
  DokployDeploymentError,
  DokployPartialFailureCleanup,
  DokployPartialFailure,
  DokployPartialFailureStep,
  DokployPartialFailureResource,
} from './errors.js';
import type { RenderedDokployPlan, RenderedDokployResource } from './render.js';
import { err, ok, type Result } from './result.js';
import { deleteDokployResources } from './delete.js';
import { normalizePart } from './names.js';

type RenderedApplicationResource = Extract<RenderedDokployResource, { kind: 'application' }>;
type RenderedComposeResource = Extract<RenderedDokployResource, { kind: 'compose' }>;

export type DeploymentApplyResource = {
  readonly logicalId: string;
  readonly resourceKind: 'application' | 'compose';
  readonly workloadSlug?: string;
  readonly kind?: RenderedApplicationResource['workloadKind'];
  readonly infrastructureKind?:
    | RenderedComposeResource['infrastructureKind']
    | RenderedApplicationResource['infrastructureKind'];
  readonly targetResourceId: string;
  readonly targetResourceName: string;
  readonly action: 'created' | 'updated' | 'unchanged';
  readonly services?: readonly DokployComposeServiceSummary[];
};

export type DeploymentApplyResult = {
  readonly target: {
    readonly kind: 'dokploy';
    readonly environmentId: string;
  };
  readonly deployment: RenderedDokployPlan['deployment'];
  readonly resources: readonly DeploymentApplyResource[];
  readonly urls: RenderedDokployPlan['urls'];
  readonly renderedPlanDigest: string;
  readonly warnings: readonly string[];
  readonly verificationHints: {
    readonly healthUrl: string;
    readonly uiUrl?: string;
    readonly configUrl?: string;
    readonly publicRouteUrls: readonly string[];
    readonly protectedRouteChecks: readonly { readonly name: string; readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; readonly url: string }[];
    readonly operatonUiAuthChecks?: readonly { readonly name: string; readonly url: string }[];
    readonly redpandaConsoleUrl?: string;
    readonly stack?: {
      readonly composeId: string;
      readonly services: readonly DokployComposeServiceSummary[];
      readonly inspections?: readonly DokployComposeTaskInspection[];
    };
  };
};

export async function applyDokployPlan(
  rendered: RenderedDokployPlan,
  client: DokployClient,
): Promise<Result<DeploymentApplyResult, DokployDeploymentError>> {
  const applied: DeploymentApplyResource[] = [];
  const createdForCleanup: DeploymentApplyResource[] = [];
  const orderedResources = [...rendered.resources].sort(resourceOrder);
  const prepared: Array<{
    readonly resource: Extract<RenderedDokployResource, { kind: 'application' }>;
    readonly target: DokployApplication;
    readonly created: boolean;
  }> = [];
  const networkTargets: Array<{
    readonly resource: RenderedDokployResource;
    readonly target: DokployApplication | DokployCompose;
  }> = [];
  let stackVerification:
    | {
        readonly composeId: string;
        readonly services: readonly DokployComposeServiceSummary[];
        readonly inspections?: readonly DokployComposeTaskInspection[];
      }
    | undefined;

  try {
    const { environmentId } = await client.ensureEnvironment(rendered.targetProject, rendered.deployment.environment);

    for (const resource of orderedResources) {
      if (resource.kind === 'compose') {
        const existingResult = await findExistingCompose(client, environmentId, resource, applied, createdForCleanup);
        if (!existingResult.ok) return existingResult;

        const existing = existingResult.value;
        if (existing === null) {
          const createResult = await createComposeTarget(client, environmentId, resource, applied, createdForCleanup);
          if (!createResult.ok) return createResult;
          networkTargets.push({ resource, target: createResult.value });
          const created = appliedResource(resource, createResult.value, 'created');
          createdForCleanup.push(created);
          const lifecycleResult = await runComposeLifecycle(client, created, resource, [
            ...applied,
            created,
          ], createdForCleanup);
          if (!lifecycleResult.ok) return lifecycleResult;
          if (resource.infrastructureKind === 'project-stack') {
            stackVerification = stackVerificationFor(
              created.targetResourceId,
              lifecycleResult.value.services,
              lifecycleResult.value.inspections,
            );
          }
          applied.push(created);
          continue;
        }

        networkTargets.push({ resource, target: existing });
        if (resourceMatches(existing, resource)) {
          const unchanged = appliedResource(resource, existing, 'unchanged');
          if (resource.infrastructureKind === 'project-stack') {
            stackVerification = stackVerificationFor(
              unchanged.targetResourceId,
              serviceSummaries(resource),
            );
          }
          applied.push(unchanged);
          continue;
        }

        const updateResult = await updateComposeTarget(client, existing.id, resource, applied, createdForCleanup);
        if (!updateResult.ok) return updateResult;
        const updated = appliedResource(resource, updateResult.value, 'updated');
        const lifecycleResult = await runComposeLifecycle(client, updated, resource, [
          ...applied,
          updated,
        ], createdForCleanup);
        if (!lifecycleResult.ok) return lifecycleResult;
        if (resource.infrastructureKind === 'project-stack') {
          stackVerification = stackVerificationFor(
            updated.targetResourceId,
            lifecycleResult.value.services,
            lifecycleResult.value.inspections,
          );
        }
        applied.push(updated);
        continue;
      }

      const existingResult = await findExistingApplication(client, environmentId, resource, applied, createdForCleanup);
      if (!existingResult.ok) return existingResult;

      const existing = existingResult.value;
      if (existing === null) {
        const createResult = await createApplicationTarget(client, environmentId, resource, applied, createdForCleanup);
        if (!createResult.ok) return createResult;
        createdForCleanup.push(appliedResource(resource, createResult.value, 'created'));
        prepared.push({ resource, target: createResult.value, created: true });
        networkTargets.push({ resource, target: createResult.value });
      } else {
        prepared.push({ resource, target: existing, created: false });
        networkTargets.push({ resource, target: existing });
      }
    }

    const networkNames = networkNameMap(networkTargets);

    for (const item of prepared) {
      const resource = resolveNetworkReferences(item.resource, networkNames);
      if (item.created) {
        const created = appliedResource(resource, item.target, 'created');
        const lifecycleResult = await runApplicationLifecycle(client, created, resource, [
          ...applied,
          created,
        ], createdForCleanup);
        if (!lifecycleResult.ok) return lifecycleResult;
        applied.push(created);
      } else if (resourceMatches(item.target, resource)) {
        applied.push(appliedResource(resource, item.target, 'unchanged'));
      } else {
        const updateResult = await updateApplicationTarget(client, item.target.id, resource, applied, createdForCleanup);
        if (!updateResult.ok) return updateResult;
        const updated = appliedResource(resource, updateResult.value, 'updated');
        const lifecycleResult = await runApplicationLifecycle(client, updated, resource, [
          ...applied,
          updated,
        ], createdForCleanup);
        if (!lifecycleResult.ok) return lifecycleResult;
        applied.push(updated);
      }
    }

    const cleanupWarnings = await cleanupOldTopology(client, environmentId, rendered, applied);

    return ok({
      target: { kind: 'dokploy', environmentId },
      deployment: rendered.deployment,
      resources: applied,
      urls: rendered.urls,
      renderedPlanDigest: rendered.digest,
      warnings:
        cleanupWarnings.length === 0
          ? rendered.warnings
          : [...rendered.warnings, ...cleanupWarnings],
      verificationHints: verificationHints(rendered, stackVerification),
    });
  } catch (cause) {
    return err([
      {
        code: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
        message: 'failed to initialize Dokploy project',
        cause: sanitizeCause(cause),
      },
    ]);
  }
}

async function findExistingApplication(
  client: DokployClient,
  environmentId: string,
  resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): Promise<Result<DokployApplication | null, DokployDeploymentError>> {
  try {
    return ok(await client.findApplicationByName(environmentId, resource.name));
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'find');
  }
}

async function createApplicationTarget(
  client: DokployClient,
  environmentId: string,
  resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): Promise<Result<DokployApplication, DokployDeploymentError>> {
  try {
    return ok(await client.createApplication(environmentId, resource));
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'create');
  }
}

async function updateApplicationTarget(
  client: DokployClient,
  applicationId: string,
  resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): Promise<Result<DokployApplication, DokployDeploymentError>> {
  try {
    return ok(await client.updateApplication(applicationId, resource));
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'update');
  }
}

async function runApplicationLifecycle(
  client: DokployClient,
  target: DeploymentApplyResource,
  resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): Promise<Result<void, DokployDeploymentError>> {
  try {
    await client.configureApplication(target.targetResourceId, resource);
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'configure');
  }

  try {
    await client.deployApplication(target.targetResourceId);
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'deploy');
  }

  if (client.inspectApplication !== undefined) {
    try {
      const inspected = await client.inspectApplication(target.targetResourceId);
      if (inspected.status === 'failed' || inspected.status === 'rejected') {
        return partialFailure(
          client,
          new Error(inspected.message ?? `Dokploy application status ${inspected.status}`),
          resource,
          applied,
          createdForCleanup,
          'inspect',
        );
      }
    } catch (cause) {
      return partialFailure(client, cause, resource, applied, createdForCleanup, 'inspect');
    }
  }

  return ok(undefined);
}

async function findExistingCompose(
  client: DokployClient,
  environmentId: string,
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): Promise<Result<DokployCompose | null, DokployDeploymentError>> {
  try {
    return ok(await client.findComposeByName(environmentId, resource.name));
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'find');
  }
}

async function createComposeTarget(
  client: DokployClient,
  environmentId: string,
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): Promise<Result<DokployCompose, DokployDeploymentError>> {
  try {
    return ok(await client.createCompose(environmentId, resource));
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'create');
  }
}

async function updateComposeTarget(
  client: DokployClient,
  composeId: string,
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): Promise<Result<DokployCompose, DokployDeploymentError>> {
  try {
    return ok(await client.updateCompose(composeId, resource));
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'update');
  }
}

type ComposeLifecycleOutcome = {
  readonly services: readonly DokployComposeServiceSummary[];
  readonly inspections?: readonly DokployComposeTaskInspection[];
};

async function runComposeLifecycle(
  client: DokployClient,
  target: DeploymentApplyResource,
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): Promise<Result<ComposeLifecycleOutcome, DokployDeploymentError>> {
  try {
    await client.configureCompose(target.targetResourceId, resource);
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'configure');
  }

  if (
    resource.infrastructureKind === 'project-stack' &&
    resource.domains !== undefined &&
    client.configureComposeDomains !== undefined
  ) {
    try {
      await client.configureComposeDomains(target.targetResourceId, resource.domains);
    } catch (cause) {
      return partialFailure(client, cause, resource, applied, createdForCleanup, 'configure');
    }
  }

  try {
    await client.deployCompose(target.targetResourceId);
  } catch (cause) {
    return partialFailure(client, cause, resource, applied, createdForCleanup, 'deploy');
  }

  const renderedSummaries = serviceSummaries(resource);

  let loadedSummaries: readonly DokployComposeServiceSummary[] | undefined;
  if (resource.infrastructureKind === 'project-stack' && client.loadComposeServices !== undefined) {
    try {
      const loaded = await client.loadComposeServices(target.targetResourceId);
      loadedSummaries = loaded.length > 0 ? loaded : undefined;
    } catch (cause) {
      void cause;
    }
  }

  let inspections: readonly DokployComposeTaskInspection[] | undefined;
  if (resource.infrastructureKind === 'project-stack' && client.inspectComposeTasks !== undefined) {
    const summariesForInspect = loadedSummaries ?? renderedSummaries;
    try {
      const inspected = await client.inspectComposeTasks(
        target.targetResourceId,
        summariesForInspect,
      );
      // Only surface inspections when at least one task is not in a healthy
      // running state; Task 6 uses this signal to flag crash loops.
      const interesting = inspected.filter((task) => !isComposeTaskHealthy(task));
      inspections = interesting.length > 0 ? inspected : undefined;
    } catch (cause) {
      void cause;
    }
  }

  // Prefer rendered list as canonical source so verificationHints stays
  // deterministic from the plan; loaded list is only used as input to
  // inspectComposeTasks so the platform can match by live service name.
  return ok({
    services: renderedSummaries,
    ...(inspections === undefined ? {} : { inspections }),
  });
}

function stackVerificationFor(
  composeId: string,
  services: readonly DokployComposeServiceSummary[],
  inspections?: readonly DokployComposeTaskInspection[],
): NonNullable<DeploymentApplyResult['verificationHints']['stack']> {
  return {
    composeId,
    services,
    ...(inspections !== undefined ? { inspections } : {}),
  };
}

function serviceSummaries(
  resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
): readonly DokployComposeServiceSummary[] {
  return (resource.services ?? []).map((service) => ({
    name: service.name,
    serviceClass: service.serviceClass,
  }));
}

function appliedResource(
  resource: RenderedDokployResource,
  target: { readonly id: string; readonly name: string },
  action: DeploymentApplyResource['action'],
): DeploymentApplyResource {
  if (resource.kind === 'compose') {
    const services = serviceSummaries(resource);
    return {
      logicalId: resource.logicalId,
      resourceKind: 'compose',
      infrastructureKind: resource.infrastructureKind,
      targetResourceId: target.id,
      targetResourceName: target.name,
      action,
      ...(services.length > 0 ? { services } : {}),
    };
  }

  return {
    logicalId: resource.logicalId,
    resourceKind: 'application',
    ...(resource.workloadSlug !== undefined ? { workloadSlug: resource.workloadSlug } : {}),
    ...(resource.workloadKind !== undefined ? { kind: resource.workloadKind } : {}),
    ...(resource.infrastructureKind !== undefined ? { infrastructureKind: resource.infrastructureKind } : {}),
    targetResourceId: target.id,
    targetResourceName: target.name,
    action,
  };
}

/**
 * Best-effort cleanup of legacy rntme-managed Dokploy resources. After a
 * successful project-stack apply this removes pre-existing applications and
 * composes in the same environment whose names begin with the normalized
 * rntme `<org>-<project>-` prefix and which are not the current project-stack
 * compose.
 *
 * The Dokploy list APIs do not expose Docker labels, so the cleanup filter
 * relies on the rntme name prefix as the ownership marker. When labels do
 * happen to be present, a non-matching `rntme.managed-by` value vetoes the
 * candidate so foreign systems can opt out by setting that label themselves.
 *
 * Per-resource failures are isolated so a single bad delete cannot strand
 * the rest of the cleanup pass; failures are surfaced via the returned
 * warnings list (and on through the apply result). The apply itself has
 * already succeeded by the time this runs, so cleanup never throws.
 */
async function cleanupOldTopology(
  client: DokployClient,
  environmentId: string,
  rendered: RenderedDokployPlan,
  applied: readonly DeploymentApplyResource[],
): Promise<readonly string[]> {
  const stackName = applied.find(
    (resource) => resource.infrastructureKind === 'project-stack',
  )?.targetResourceName;
  if (stackName === undefined) return [];

  // Resource names were created via `dokployResourceName`, which runs each
  // slug through `normalizePart`. Cleanup must mirror that normalization or
  // a slug like `Acme_Corp` would silently miss every legacy resource.
  const expectedPrefix = `rntme-${normalizePart(rendered.deployment.orgSlug)}-${normalizePart(rendered.deployment.projectSlug)}-`;
  const currentResourceIds = new Set(applied.map((resource) => resource.targetResourceId));
  const currentResourceNames = new Set(applied.map((resource) => resource.targetResourceName));

  const warnings: string[] = [];

  // Sequential delete: Dokploy resources can hold inter-resource references
  // (shared compose networks, shared secrets, follow-up cleanup hooks), and
  // its API has historically been sensitive to concurrent destructive ops on
  // the same project. Sequential delete trades throughput for safety, which
  // is the right call for a best-effort cleanup pass.

  if (client.listApplications !== undefined) {
    let applications: readonly { readonly id: string; readonly name: string; readonly labels?: Record<string, string> }[] = [];
    try {
      applications = await client.listApplications(environmentId);
    } catch (cause) {
      warnings.push(`failed to list legacy applications: ${describeCleanupError(cause)}`);
    }
    for (const app of applications) {
      if (currentResourceIds.has(app.id) || currentResourceNames.has(app.name)) continue;
      if (!isCleanupCandidate(app.name, app.labels, stackName, expectedPrefix)) continue;
      try {
        await client.deleteApplication(app.id);
      } catch (cause) {
        warnings.push(
          `failed to delete legacy application ${app.name} (${app.id}): ${describeCleanupError(cause)}`,
        );
      }
    }
  }

  if (client.listComposes !== undefined) {
    let composes: readonly { readonly id: string; readonly name: string; readonly labels?: Record<string, string> }[] = [];
    try {
      composes = await client.listComposes(environmentId);
    } catch (cause) {
      warnings.push(`failed to list legacy composes: ${describeCleanupError(cause)}`);
    }
    for (const compose of composes) {
      if (currentResourceIds.has(compose.id) || currentResourceNames.has(compose.name)) continue;
      if (!isCleanupCandidate(compose.name, compose.labels, stackName, expectedPrefix)) continue;
      try {
        await client.deleteCompose(compose.id);
      } catch (cause) {
        warnings.push(
          `failed to delete legacy compose ${compose.name} (${compose.id}): ${describeCleanupError(cause)}`,
        );
      }
    }
  }

  return warnings;
}

function isCleanupCandidate(
  name: string,
  labels: Readonly<Record<string, string>> | undefined,
  stackName: string,
  expectedPrefix: string,
): boolean {
  if (name === stackName) return false;
  if (!name.startsWith(expectedPrefix)) return false;
  // Labels are advisory because Dokploy's list APIs do not return them.
  // Reject only when a foreign `rntme.managed-by` value is explicitly set;
  // an absent label is treated as ours-by-name.
  const managedBy = labels?.['rntme.managed-by'];
  if (managedBy !== undefined && managedBy !== 'rntme-deploy-dokploy') return false;
  return true;
}

function describeCleanupError(cause: unknown): string {
  const sanitized = sanitizeCause(cause);
  if (typeof sanitized === 'string') return sanitized;
  return sanitized.message;
}

function resourceOrder(a: RenderedDokployResource, b: RenderedDokployResource): number {
  return resourceRank(a) - resourceRank(b);
}

function resourceRank(resource: RenderedDokployResource): number {
  if (resource.kind === 'compose' && resource.infrastructureKind === 'event-bus') return 0;
  if (resource.kind === 'compose' && resource.infrastructureKind === 'object-storage') return 1;
  if (resource.kind === 'compose' && resource.infrastructureKind === 'workflow-engine') return 2;
  if (resource.kind === 'application' && resource.infrastructureKind === 'redpanda-console') return 3;
  if (resource.kind === 'application' && resource.infrastructureKind === 'redpanda-console-proxy') return 4;
  if (resource.kind === 'application' && resource.workloadKind === 'domain-service') return 5;
  if (resource.kind === 'application' && resource.workloadKind === 'integration-module') return 5;
  if (resource.kind === 'application' && resource.workloadKind === 'infrastructure-proxy') return 6;
  if (resource.kind === 'application' && resource.workloadKind === 'bpmn-worker') return 7;
  if (resource.kind === 'application' && resource.workloadKind === 'edge-gateway') return 8;
  if (resource.kind === 'application' && resource.workloadKind === 'static-site') return 9;
  return 10;
}

function networkNameMap(
  prepared: readonly {
    readonly resource: RenderedDokployResource;
    readonly target: DokployApplication | DokployCompose;
  }[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    prepared.map(({ resource, target }) => [resource.name, networkNameFor(resource, target)]),
  );
}

function networkNameFor(resource: RenderedDokployResource, target: DokployApplication | DokployCompose): string {
  if (resource.kind === 'compose') return resource.name;
  return target.appName ?? target.name;
}

function resolveNetworkReferences<T extends RenderedDokployResource>(
  resource: T,
  networkNames: Readonly<Record<string, string>>,
): T {
  if (resource.kind === 'compose') {
    return {
      ...resource,
      env: resource.env.map((item) => ({
        ...item,
        value: replaceNetworkNames(item.value, networkNames),
      })),
    } as T;
  }

  return {
    ...resource,
    env: resource.env.map((item) => ({
      ...item,
      value: replaceNetworkNames(item.value, networkNames),
    })),
    ...(resource.files === undefined
      ? {}
      : {
          files: Object.fromEntries(
            Object.entries(resource.files).map(([path, content]) => [
              path,
              replaceNetworkNames(content, networkNames),
            ]),
          ),
        }),
  } as T;
}

function replaceNetworkNames(
  input: string,
  networkNames: Readonly<Record<string, string>>,
): string {
  let output = input;
  for (const [resourceName, networkName] of Object.entries(networkNames).sort(
    ([a], [b]) => b.length - a.length,
  )) {
    output = output.split(resourceName).join(networkName);
  }
  return output;
}

async function partialFailure(
  client: DokployClient,
  cause: unknown,
  resource: RenderedDokployResource,
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
  action: DokployPartialFailureStep['action'],
): Promise<Result<never, DokployDeploymentError>> {
  const cleanup = await cleanupCreatedResources(client, createdForCleanup);
  return err([
    {
      code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
      message: `failed while applying resource "${resource.name}"`,
      resource: resource.name,
      cause: sanitizeCause(cause),
      partialFailure: buildPartialFailure(
        mergeCreatedResources(applied, createdForCleanup),
        {
          action,
          resourceName: resource.name,
          ...resourceIdentifier(resource),
        },
        cleanup,
      ),
    },
  ]);
}

function resourceIdentifier(resource: RenderedDokployResource): Pick<
  DokployPartialFailureStep,
  'resourceKind' | 'workloadSlug' | 'infrastructureKind'
> {
  if (resource.kind === 'compose') {
    return { resourceKind: 'compose', infrastructureKind: resource.infrastructureKind };
  }
  return {
    resourceKind: 'application',
    ...(resource.workloadSlug !== undefined ? { workloadSlug: resource.workloadSlug } : {}),
    ...(resource.infrastructureKind !== undefined ? { infrastructureKind: resource.infrastructureKind } : {}),
  };
}

function applyResourceAsPartialFailure(
  resource: DeploymentApplyResource,
): DokployPartialFailureResource {
  // `kind` widened to include `'static-site'`, but the partial-failure
  // payload schema doesn't carry that variant — drop the kind tag for
  // static-site resources rather than coupling errors.ts to the new union.
  const kind =
    resource.kind === undefined || resource.kind === 'static-site' ? undefined : resource.kind;
  return {
    logicalId: resource.logicalId,
    resourceKind: resource.resourceKind,
    targetResourceId: resource.targetResourceId,
    targetResourceName: resource.targetResourceName,
    action: resource.action,
    ...(resource.workloadSlug !== undefined ? { workloadSlug: resource.workloadSlug } : {}),
    ...(kind !== undefined ? { kind } : {}),
    ...(resource.infrastructureKind !== undefined ? { infrastructureKind: resource.infrastructureKind } : {}),
  };
}

function buildPartialFailure(
  applied: readonly DeploymentApplyResource[],
  failedStep: DokployPartialFailureStep,
  cleanup: DokployPartialFailureCleanup,
): DokployPartialFailure {
  return {
    createdResources: applied
      .filter((resource) => resource.action === 'created')
      .map(applyResourceAsPartialFailure),
    updatedResources: applied
      .filter((resource) => resource.action === 'updated')
      .map(applyResourceAsPartialFailure),
    failedStep,
    cleanup,
    retrySafe: cleanup.errors.length === 0,
  };
}

function mergeCreatedResources(
  applied: readonly DeploymentApplyResource[],
  createdForCleanup: readonly DeploymentApplyResource[],
): readonly DeploymentApplyResource[] {
  const byKey = new Map<string, DeploymentApplyResource>();
  for (const resource of applied) byKey.set(`${resource.resourceKind}:${resource.targetResourceId}`, resource);
  for (const resource of createdForCleanup) byKey.set(`${resource.resourceKind}:${resource.targetResourceId}`, resource);
  return [...byKey.values()];
}

async function cleanupCreatedResources(
  client: DokployClient,
  createdResources: readonly DeploymentApplyResource[],
): Promise<DokployPartialFailureCleanup> {
  const cleanupTargets = createdResources.map((resource) => ({
    resourceKind: resource.resourceKind,
    targetResourceId: resource.targetResourceId,
    targetResourceName: resource.targetResourceName,
  }));
  if (cleanupTargets.length === 0) {
    return { attempted: true, deletedResources: [], warnings: [], errors: [] };
  }

  const cleanup = await deleteDokployResources(cleanupTargets, client);
  if (cleanup.ok) {
    return {
      attempted: true,
      deletedResources: cleanup.value.deletedResources.map((resource) => {
        const appliedFound = createdResources.find(
          (created) => created.targetResourceId === resource.targetResourceId,
        );
        return appliedFound !== undefined
          ? applyResourceAsPartialFailure(appliedFound)
          : {
              logicalId: resource.targetResourceName,
              resourceKind: resource.resourceKind,
              targetResourceId: resource.targetResourceId,
              targetResourceName: resource.targetResourceName,
              action: 'created',
            };
      }),
      warnings: cleanup.value.warnings,
      errors: [],
    };
  }

  return {
    attempted: true,
    deletedResources: [],
    warnings: [],
    errors: cleanup.errors.map(({ code, message, resource, cause }) => ({
      code,
      message,
      ...(resource === undefined ? {} : { resource }),
      ...(cause === undefined ? {} : { cause: sanitizeNestedCause(cause) }),
    })),
  };
}

function sanitizeNestedCause(cause: unknown): unknown {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof cause.message === 'string'
  ) {
    return { ...cause, message: redactSensitiveCauseMessage(cause.message) };
  }
  if (typeof cause === 'string') return redactSensitiveCauseMessage(cause);
  return cause;
}

function resourceMatches(
  existing: {
    readonly image?: string;
    readonly command?: string | null;
    readonly args?: readonly string[] | null;
    readonly composeFile?: string;
    readonly build?: RenderedApplicationResource['build'];
    readonly ports?: RenderedApplicationResource['ports'];
    readonly ingress?: RenderedApplicationResource['ingress'];
    readonly env?: RenderedDokployResource['env'];
    readonly labels?: RenderedDokployResource['labels'];
    readonly files?: RenderedApplicationResource['files'];
    readonly secretFiles?: RenderedApplicationResource['secretFiles'];
  },
  resource: RenderedDokployResource,
): boolean {
  if (existing.image === undefined || existing.image !== resource.image) return false;
  if (existing.env === undefined || !envVarsMatch(existing.env, resource.env)) return false;
  if (existing.labels === undefined || !stringRecordMatches(existing.labels, resource.labels)) {
    return false;
  }

  // Secret files always contain refs (not values) in the rendered plan digest,
  // so they must be treated as changed on every apply so the client boundary
  // can resolve the current secret values and mount them.
  if (resource.secretFiles !== undefined && Object.keys(resource.secretFiles).length > 0) {
    return false;
  }
  if (resource.kind === 'compose' && resource.fileMounts !== undefined && resource.fileMounts.length > 0) {
    return false;
  }

  if (resource.kind === 'compose') {
    return composeResourceMatches(existing, resource);
  }

  return applicationResourceMatches(existing, resource);
}

function composeResourceMatches(
  existing: { readonly composeFile?: string },
  resource: RenderedComposeResource,
): boolean {
  return existing.composeFile === resource.composeFile;
}

function applicationResourceMatches(
  existing: {
    readonly command?: string | null;
    readonly args?: readonly string[] | null;
    readonly build?: RenderedApplicationResource['build'];
    readonly ports?: RenderedApplicationResource['ports'];
    readonly ingress?: RenderedApplicationResource['ingress'];
    readonly files?: RenderedApplicationResource['files'];
  },
  resource: RenderedApplicationResource,
): boolean {
  if (
    normalizedApplicationCommand(existing.command) !== normalizedApplicationCommand(resource.command)
  ) {
    return false;
  }
  if (
    normalizedApplicationArgs(existing.args) !== normalizedApplicationArgs(resource.args ?? undefined)
  ) {
    return false;
  }
  if (!optionalBuildMatches(existing.build, resource.build)) return false;
  if (!optionalPortsMatch(existing.ports, resource.ports)) return false;
  if (!optionalIngressMatches(existing.ingress, resource.ingress)) return false;
  return optionalStringRecordMatches(existing.files, resource.files);
}

function normalizedApplicationCommand(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}

function normalizedApplicationArgs(value: readonly string[] | null | undefined): string {
  return JSON.stringify([...(value ?? [])]);
}

function optionalBuildMatches(
  existing: RenderedApplicationResource['build'] | undefined,
  rendered: RenderedApplicationResource['build'] | undefined,
): boolean {
  if (rendered === undefined) return existing === undefined;
  if (existing === undefined) return false;
  return (
    existing.kind === rendered.kind &&
    existing.baseImage === rendered.baseImage &&
    existing.image === rendered.image &&
    existing.artifact.source === rendered.artifact.source &&
    existing.artifact.serviceSlug === rendered.artifact.serviceSlug &&
    existing.context.kind === rendered.context.kind &&
    existing.context.serviceSlug === rendered.context.serviceSlug &&
    stringSetMatches(existing.context.files, rendered.context.files)
  );
}

function optionalPortsMatch(
  existing: RenderedApplicationResource['ports'] | undefined,
  rendered: RenderedApplicationResource['ports'] | undefined,
): boolean {
  if (rendered === undefined) return existing === undefined || existing.length === 0;
  if (existing === undefined) return false;
  return portListsMatch(existing, rendered);
}

function optionalIngressMatches(
  existing: RenderedApplicationResource['ingress'] | undefined,
  rendered: RenderedApplicationResource['ingress'] | undefined,
): boolean {
  if (rendered === undefined) return existing === undefined;
  if (existing === undefined) return false;
  return ingressMatches(existing, rendered);
}

function optionalStringRecordMatches(
  existing: Readonly<Record<string, string>> | undefined,
  rendered: Readonly<Record<string, string>> | undefined,
): boolean {
  if (rendered === undefined) {
    return existing === undefined || Object.keys(existing).length === 0;
  }
  if (existing === undefined) return false;
  return stringRecordMatches(existing, rendered);
}

function envVarsMatch(existing: RenderedDokployResource['env'], rendered: RenderedDokployResource['env']): boolean {
  if (existing.length !== rendered.length) return false;
  const sortEnv = (items: RenderedDokployResource['env']): RenderedDokployResource['env'] =>
    [...items].sort((a, b) =>
      a.name.localeCompare(b.name) ||
      a.value.localeCompare(b.value) ||
      Number(a.secret) - Number(b.secret),
    );
  const sortedExisting = sortEnv(existing);
  const sortedRendered = sortEnv(rendered);
  return sortedRendered.every((item, index) => {
    const current = sortedExisting[index];
    return (
      current !== undefined &&
      current.name === item.name &&
      current.value === item.value &&
      current.secret === item.secret
    );
  });
}

function stringRecordMatches(
  existing: Readonly<Record<string, string>>,
  rendered: Readonly<Record<string, string>>,
): boolean {
  const existingKeys = Object.keys(existing).sort((a, b) => a.localeCompare(b));
  const renderedKeys = Object.keys(rendered).sort((a, b) => a.localeCompare(b));
  if (!stringSetMatches(existingKeys, renderedKeys)) return false;
  return renderedKeys.every((key) => existing[key] === rendered[key]);
}

function portListsMatch(
  existing: readonly NonNullable<RenderedApplicationResource['ports']>[number][],
  rendered: readonly NonNullable<RenderedApplicationResource['ports']>[number][],
): boolean {
  if (existing.length !== rendered.length) return false;
  const sortPorts = (
    ports: readonly NonNullable<RenderedApplicationResource['ports']>[number][],
  ): readonly NonNullable<RenderedApplicationResource['ports']>[number][] =>
    [...ports].sort(
      (a, b) => a.containerPort - b.containerPort || a.protocol.localeCompare(b.protocol),
    );
  const sortedExisting = sortPorts(existing);
  const sortedRendered = sortPorts(rendered);
  return sortedRendered.every((port, index) => {
    const current = sortedExisting[index];
    return (
      current !== undefined &&
      current.containerPort === port.containerPort &&
      current.protocol === port.protocol
    );
  });
}

function ingressMatches(
  existing: NonNullable<RenderedApplicationResource['ingress']>,
  rendered: NonNullable<RenderedApplicationResource['ingress']>,
): boolean {
  return (
    existing.publicBaseUrl === rendered.publicBaseUrl &&
    existing.containerPort === rendered.containerPort &&
    existing.healthPath === rendered.healthPath &&
    ingressRoutesMatch(existing.routes, rendered.routes)
  );
}

function ingressRoutesMatch(
  existing: NonNullable<RenderedApplicationResource['ingress']>['routes'],
  rendered: NonNullable<RenderedApplicationResource['ingress']>['routes'],
): boolean {
  if (existing.length !== rendered.length) return false;
  const sortRoutes = (
    routes: NonNullable<RenderedApplicationResource['ingress']>['routes'],
  ): NonNullable<RenderedApplicationResource['ingress']>['routes'] =>
    [...routes].sort((a, b) =>
      a.routeId.localeCompare(b.routeId) ||
      a.path.localeCompare(b.path) ||
      a.url.localeCompare(b.url),
    );
  const sortedExisting = sortRoutes(existing);
  const sortedRendered = sortRoutes(rendered);
  return sortedRendered.every((route, index) => {
    const current = sortedExisting[index];
    return (
      current !== undefined &&
      current.routeId === route.routeId &&
      current.path === route.path &&
      current.url === route.url
    );
  });
}

function stringSetMatches(existing: readonly string[], rendered: readonly string[]): boolean {
  if (existing.length !== rendered.length) return false;
  const sortedExisting = [...existing].sort((a, b) => a.localeCompare(b));
  const sortedRendered = [...rendered].sort((a, b) => a.localeCompare(b));
  return sortedRendered.every((value, index) => sortedExisting[index] === value);
}

function verificationHints(
  rendered: RenderedDokployPlan,
  stack:
    | {
        readonly composeId: string;
        readonly services: readonly DokployComposeServiceSummary[];
        readonly inspections?: readonly DokployComposeTaskInspection[];
      }
    | undefined,
): DeploymentApplyResult['verificationHints'] {
  const base = {
    healthUrl: joinUrl(rendered.urls.projectUrl, '/health'),
    configUrl: joinUrl(rendered.urls.projectUrl, '/config.json'),
    publicRouteUrls: rendered.urls.publicRoutes.map((route) => route.url),
    protectedRouteChecks: rendered.urls.protectedRouteChecks,
    ...(rendered.urls.redpandaConsoleUrl === undefined ? {} : { redpandaConsoleUrl: rendered.urls.redpandaConsoleUrl }),
    ...(stack === undefined ? {} : { stack }),
  };

  if (rendered.urls.uiUrl === undefined && rendered.urls.operatonUiAuthChecks === undefined) {
    return base;
  }

  return {
    ...base,
    ...(rendered.urls.uiUrl === undefined ? {} : { uiUrl: rendered.urls.uiUrl }),
    ...(rendered.urls.operatonUiAuthChecks === undefined
      ? {}
      : { operatonUiAuthChecks: rendered.urls.operatonUiAuthChecks }),
  };
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(path, normalizedBase).toString();
}

const REDACTED_CAUSE_VALUE = '[redacted]';
const CREDENTIAL_KEY_PATTERN =
  'api[-_]?token|apiToken|[a-z0-9_]*token|access_token|refresh_token|client_secret|password|secret';
const SECRET_VALUE_PATTERN = /dokploy-token-secret/g;
const BEARER_TOKEN_PATTERN = /\b(Bearer\s+)[^\s,;'"`]+/gi;
const QUERY_CREDENTIAL_PATTERN = new RegExp(
  `([?&](?:${CREDENTIAL_KEY_PATTERN})=)[^&\\s,;'"'"\`]+`,
  'gi',
);
const JSON_CREDENTIAL_PATTERN = new RegExp(
  `((["'])(?:${CREDENTIAL_KEY_PATTERN})\\2\\s*:\\s*)(?:"[^"]*"|'[^']*'|[^\\s,}\\]]+)`,
  'gi',
);
const ASSIGNED_CREDENTIAL_PATTERN = new RegExp(
  `\\b((?:${CREDENTIAL_KEY_PATTERN})\\s*[:=]\\s*)(?:"[^"]*"|'[^']*'|[^\\s&?,;'"'\`}]+)`,
  'gi',
);

function sanitizeCause(cause: unknown): { readonly name?: string; readonly message: string } | string {
  if (cause instanceof Error) {
    const message = redactSensitiveCauseMessage(cause.message);
    if (cause.name === '' || cause.name === 'Error') return { message };
    return { name: cause.name, message };
  }

  return 'non-error thrown';
}

function redactSensitiveCauseMessage(message: string): string {
  return message
    .replace(SECRET_VALUE_PATTERN, REDACTED_CAUSE_VALUE)
    .replace(BEARER_TOKEN_PATTERN, `$1${REDACTED_CAUSE_VALUE}`)
    .replace(QUERY_CREDENTIAL_PATTERN, `$1${REDACTED_CAUSE_VALUE}`)
    .replace(JSON_CREDENTIAL_PATTERN, `$1"${REDACTED_CAUSE_VALUE}"`)
    .replace(ASSIGNED_CREDENTIAL_PATTERN, `$1${REDACTED_CAUSE_VALUE}`);
}
