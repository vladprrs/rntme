import type { ComposedProjectInput } from './composed-project.js';
import {
  DEFAULT_RUSTFS_IMAGE,
  DEFAULT_REDPANDA_IMAGE,
  DEFAULT_REDPANDA_CONSOLE_IMAGE,
  type DeploymentMode,
  type EventBusConfig,
  type ExternalEventBusConfig,
  type ExternalEventBusSecurity,
  type ProjectAuthConfig,
  type ProjectDeploymentConfig,
  type StorageConfig,
} from './config.js';
import { planEdge, type EdgeMiddleware, type EdgeRoute } from './edge.js';
import type { DeploymentPlanError } from './errors.js';
import { err, ok, type Result } from './result.js';
import {
  resolveVars,
  applyVars,
  targetForVars,
  type DiscoveredModulesForVars,
  type ProvisionResultForVars,
  type ResolvedVars,
} from './vars.js';
import { planWorkflowEngine } from './workflows.js';

export type PlannedProject = {
  readonly orgSlug: string;
  readonly projectSlug: string;
  readonly environment: 'default';
  readonly mode: DeploymentMode;
};

export type DomainServiceWorkload = {
  readonly kind: 'domain-service';
  readonly slug: string;
  readonly serviceSlug: string;
  readonly resourceName: string;
  readonly runtime: { readonly image: string };
  readonly artifact: { readonly source: 'composed-project'; readonly serviceSlug: string };
  readonly runtimeFiles: Readonly<Record<string, string>>;
  readonly publicConfigJson: string;
  readonly persistence: { readonly mode: 'ephemeral' };
};

export type IntegrationModuleWorkload = {
  readonly kind: 'integration-module';
  readonly slug: string;
  readonly serviceSlug: string;
  readonly resourceName: string;
  readonly image: string;
  readonly expose: boolean;
  readonly env: Readonly<Record<string, string>>;
  readonly secretRefs: Readonly<Record<string, string>>;
  readonly modulePackageName?: string;
};

export type EdgeGatewayWorkload = {
  readonly kind: 'edge-gateway';
  readonly slug: 'edge';
  readonly resourceName: string;
  readonly image: 'nginx:1.27-alpine';
};

export type RequiredTargetSecretRef = {
  readonly kind: 'target-secret';
  readonly secretRef: string;
  readonly schema: string;
  readonly purpose: string;
};

export type PlannedWorkflowUiAccess = {
  readonly enabled: true;
  readonly publicBaseUrl: string;
  readonly authKind: 'basic';
  readonly authSecretRef: string;
};

export type PlannedWorkflowEngine =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'operaton';
      readonly mode: 'provisioned';
      readonly resourceName: string;
      readonly internalBaseUrl: string;
      readonly image: string;
      readonly adminUserSecretRef?: string;
      readonly uiAccess?: PlannedWorkflowUiAccess;
    };

export type PlannedWorkflowSubscription = {
  readonly messageStartId: string;
  readonly topic: string;
  readonly service: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly processId: string;
  readonly messageName: string;
  readonly businessKey: string;
};

export type PlannedWorkflowServiceTask = {
  readonly definition: string;
  readonly taskId: string;
  readonly bindingRef: string;
  readonly targetService: string;
  readonly grpcEndpoint: string;
};

export type PlannedWorkflowGrpcService = {
  readonly packageName: string;
  readonly serviceName: string;
  readonly protoSource: string;
};

export type BpmnWorkerWorkload = {
  readonly kind: 'bpmn-worker';
  readonly slug: 'bpmn-worker';
  readonly resourceName: string;
  readonly image: string;
  readonly workflowManifestPath: '/srv/workflows/workflows.json';
  readonly workflowFiles: Readonly<Record<string, string>>;
  readonly subscriptions: readonly PlannedWorkflowSubscription[];
  readonly serviceTasks: readonly PlannedWorkflowServiceTask[];
  readonly grpcServices: Readonly<Record<string, PlannedWorkflowGrpcService>>;
};

export type DeploymentWorkload =
  | DomainServiceWorkload
  | IntegrationModuleWorkload
  | EdgeGatewayWorkload
  | BpmnWorkerWorkload;

export type EdgePlan = {
  readonly routes: readonly EdgeRoute[];
  readonly middleware: readonly EdgeMiddleware[];
};

export type DeploymentWarning = {
  readonly code: string;
  readonly message: string;
};

export type PlannedExternalEventBus = {
  readonly kind: 'kafka';
  readonly mode: 'external';
  readonly brokers: readonly string[];
  readonly topicPrefix?: string;
  readonly security?: ExternalEventBusSecurity;
};

export type PlannedProvisionedEventBus = {
  readonly kind: 'kafka';
  readonly mode: 'provisioned';
  readonly provider: 'redpanda';
  readonly resourceName: string;
  readonly internalBrokers: readonly string[];
  readonly topicPrefix?: string;
  readonly image: string;
  readonly persistence: {
    readonly mode: 'persistent';
    readonly volumeName: string;
  };
};

export type PlannedInMemoryEventBus = {
  readonly kind: 'memory';
  readonly mode: 'in-memory';
};

export type PlannedEventBus = PlannedExternalEventBus | PlannedProvisionedEventBus | PlannedInMemoryEventBus;

export type PlannedRedpandaConsoleAccess = {
  readonly kind: 'redpanda-console';
  readonly resourceName: string;
  readonly proxyResourceName: string;
  readonly internalUrl: string;
  readonly image: string;
  readonly publicBaseUrl: string;
  readonly basicAuthUsername: string;
  readonly htpasswdSecretRef: string;
};

export type PlannedObjectStorage =
  | { readonly kind: 'none' }
  | {
      readonly kind: 's3-compatible';
      readonly mode: 'provisioned';
      readonly provider: 'rustfs';
      readonly resourceName: string;
      readonly internalEndpoint: string;
      readonly publicBaseUrl: string;
      readonly bucketName: string;
      readonly region: 'us-east-1';
      readonly forcePathStyle: true;
      readonly image: string;
      readonly credentials: {
        readonly accessKeyRef: string;
        readonly secretKeyRef: string;
      };
      readonly persistence: {
        readonly mode: 'persistent';
        readonly volumeName: string;
      };
    };

export type ProjectDeploymentPlan = {
  readonly project: PlannedProject;
  readonly infrastructure: {
    readonly eventBus: PlannedEventBus;
    readonly objectStorage: PlannedObjectStorage;
    readonly workflowEngine: PlannedWorkflowEngine;
    readonly auth?: ProjectAuthConfig;
    readonly manualAccess?: {
      readonly redpandaConsole?: PlannedRedpandaConsoleAccess;
    };
  };
  readonly workloads: readonly DeploymentWorkload[];
  readonly edge: EdgePlan;
  readonly requiredTargetSecrets: readonly RequiredTargetSecretRef[];
  readonly diagnostics: {
    readonly warnings: readonly DeploymentWarning[];
  };
};

export type BuildPlanOptions = {
  readonly provisionResult?: ProvisionResultForVars;
  readonly discoveredModules?: DiscoveredModulesForVars;
};

export function buildProjectDeploymentPlan(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  options: BuildPlanOptions = {},
): Result<ProjectDeploymentPlan, DeploymentPlanError> {
  const resolved = resolveVars(
    project.varsManifest ?? {},
    targetForVars(config, project.name),
    {
      ...(options.provisionResult ? { provisionResult: options.provisionResult } : {}),
      ...(options.discoveredModules ? { discoveredModules: options.discoveredModules } : {}),
    },
  );
  if (!resolved.ok) return resolved;
  const vars = resolved.value;

  const errors: DeploymentPlanError[] = [];

  if (config.mode === 'production') {
    errors.push({
      code: 'DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE',
      message: 'production mode is modeled but rejected until runtime production prerequisites land',
      path: 'mode',
    });
  }

  if (config.environment !== 'default') {
    errors.push({
      code: 'DEPLOY_PLAN_INVALID_ENVIRONMENT',
      message: 'the MVP accepts only environment "default"',
      path: 'environment',
    });
  }

  if (config.orgSlug.trim() === '') {
    errors.push({
      code: 'DEPLOY_PLAN_MISSING_ORG_SLUG',
      message: 'orgSlug is required for deterministic target resource names',
      path: 'orgSlug',
    });
  }

  const plannedEventBus =
    config.eventBus === undefined
      ? undefined
      : planEventBus(config.eventBus, config.orgSlug, project.name, errors);
  const requiredTargetSecrets: RequiredTargetSecretRef[] = [];
  const workflowPlan = planWorkflowEngine({
    project,
    config,
    eventBus: plannedEventBus,
    errors,
    requiredTargetSecrets,
  });
  const plannedObjectStorage = planObjectStorage(config.storage, config.orgSlug, project.name, errors);

  if (config.eventBus === undefined) {
    errors.push({
      code: 'DEPLOY_PLAN_MISSING_EVENT_BUS',
      message: 'preview deployments require one project-level Kafka/Redpanda event bus',
      path: 'eventBus',
    });
  }

  const workloads = buildWorkloads(project, config, errors, vars);
  const allWorkloads =
    workflowPlan.worker === null ? workloads : [...workloads, workflowPlan.worker];
  const { edge, errors: edgeErrors } = planEdge(project, config, allWorkloads, vars);
  errors.push(...edgeErrors);

  if (errors.length > 0 || plannedEventBus === undefined) return err(errors);

  const warnings: DeploymentWarning[] =
    plannedEventBus.mode === 'in-memory'
      ? [
          {
            code: 'DEPLOY_PLAN_IN_MEMORY_EVENT_BUS',
            message: 'in-memory event bus is non-durable and intended only for preview/e2e deployments',
          },
        ]
      : [];

  const manualAccess = planRedpandaConsoleAccess(config, plannedEventBus, project, errors);
  if (errors.length > 0) return err(errors);

  return ok({
    project: {
      orgSlug: config.orgSlug,
      projectSlug: project.name,
      environment: config.environment,
      mode: config.mode,
    },
    infrastructure: {
      eventBus: plannedEventBus,
      objectStorage: plannedObjectStorage,
      workflowEngine: workflowPlan.engine,
      ...(config.auth !== undefined ? { auth: config.auth } : {}),
      ...(manualAccess === undefined ? {} : { manualAccess: { redpandaConsole: manualAccess } }),
    },
    workloads: allWorkloads,
    edge,
    requiredTargetSecrets,
    diagnostics: { warnings },
  });
}

function buildWorkloads(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  errors: DeploymentPlanError[],
  vars: ResolvedVars,
): DeploymentWorkload[] {
  const workloads: DeploymentWorkload[] = [];
  const runtimeImage = config.runtimeImage ?? 'ghcr.io/vladprrs/rntme-runtime:latest';
  const publicConfigJson = applyVars(project.publicConfigJson ?? '{}', vars);

  for (const service of Object.values(project.services)) {
    if (service.kind === 'domain') {
      workloads.push({
        kind: 'domain-service',
        slug: service.slug,
        serviceSlug: service.slug,
        resourceName: resourceName(config.orgSlug, project.name, service.slug),
        runtime: { image: runtimeImage },
        artifact: { source: 'composed-project', serviceSlug: service.slug },
        runtimeFiles: service.runtimeFiles ?? {},
        publicConfigJson,
        persistence: { mode: 'ephemeral' },
      });
      continue;
    }

    const moduleConfig = config.modules?.[service.slug];
    if (moduleConfig === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_MISSING_MODULE_IMAGE',
        message: `integration module "${service.slug}" requires explicit image config`,
        service: service.slug,
        path: `modules.${service.slug}`,
      });
      continue;
    }

    workloads.push({
      kind: 'integration-module',
      slug: service.slug,
      serviceSlug: service.slug,
      resourceName: resourceName(config.orgSlug, project.name, service.slug),
      image: moduleConfig.image,
      expose: moduleConfig.expose === true,
      env: moduleConfig.env ?? {},
      secretRefs: moduleConfig.secretRefs ?? {},
      ...(project.modules?.[service.slug]?.packageName === undefined
        ? {}
        : { modulePackageName: project.modules[service.slug]!.packageName }),
    });
  }

  workloads.push({
    kind: 'edge-gateway',
    slug: 'edge',
    resourceName: resourceName(config.orgSlug, project.name, 'edge'),
    image: 'nginx:1.27-alpine',
  });

  return workloads;
}

function planRedpandaConsoleAccess(
  config: ProjectDeploymentConfig,
  plannedEventBus: PlannedEventBus,
  project: ComposedProjectInput,
  errors: DeploymentPlanError[],
): PlannedRedpandaConsoleAccess | undefined {
  const cfg = config.manualAccess?.redpandaConsole;
  if (cfg === undefined || cfg.enabled !== true) return undefined;

  if (plannedEventBus.mode !== 'provisioned' || plannedEventBus.provider !== 'redpanda') {
    errors.push({
      code: 'DEPLOY_PLAN_REDPANDA_CONSOLE_EVENT_BUS_INVALID',
      message: 'Redpanda Console manual access requires provisioned Redpanda',
      path: 'manualAccess.redpandaConsole',
    });
    return undefined;
  }

  const username = cfg.basicAuth.username.trim();
  const htpasswdRef = cfg.basicAuth.htpasswdSecretRef.trim();
  if (username === '') {
    errors.push({
      code: 'DEPLOY_PLAN_REDPANDA_CONSOLE_USERNAME_REQUIRED',
      message: 'Redpanda Console basic auth username is required',
      path: 'manualAccess.redpandaConsole.basicAuth.username',
    });
  }
  if (htpasswdRef === '') {
    errors.push({
      code: 'DEPLOY_PLAN_REDPANDA_CONSOLE_HTPASSWD_REF_REQUIRED',
      message: 'Redpanda Console htpasswdSecretRef is required',
      path: 'manualAccess.redpandaConsole.basicAuth.htpasswdSecretRef',
    });
  }

  const image = cfg.image ?? DEFAULT_REDPANDA_CONSOLE_IMAGE;
  if (!isPinnedContainerImage(image)) {
    errors.push({
      code: 'DEPLOY_PLAN_REDPANDA_CONSOLE_IMAGE_INVALID',
      message: 'Redpanda Console image must use a non-latest tag',
      path: 'manualAccess.redpandaConsole.image',
    });
  }

  const publicBaseUrl = cfg.publicBaseUrl?.trim() ?? '';
  if (publicBaseUrl === '') {
    errors.push({
      code: 'DEPLOY_PLAN_REDPANDA_CONSOLE_PUBLIC_URL_REQUIRED',
      message: 'Redpanda Console publicBaseUrl must be resolved before planning',
      path: 'manualAccess.redpandaConsole.publicBaseUrl',
    });
  } else if (!isValidHttpUrl(publicBaseUrl)) {
    errors.push({
      code: 'DEPLOY_PLAN_REDPANDA_CONSOLE_PUBLIC_URL_INVALID',
      message: 'Redpanda Console publicBaseUrl must be an http(s) URL',
      path: 'manualAccess.redpandaConsole.publicBaseUrl',
    });
  }

  if (errors.length > 0) return undefined;

  const consoleResourceName = resourceName(config.orgSlug, project.name, 'redpanda-console');
  const proxyResourceName = resourceName(config.orgSlug, project.name, 'redpanda-console-proxy');

  return {
    kind: 'redpanda-console',
    resourceName: consoleResourceName,
    proxyResourceName,
    internalUrl: `http://${consoleResourceName}:8080`,
    image,
    publicBaseUrl,
    basicAuthUsername: username,
    htpasswdSecretRef: htpasswdRef,
  };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function resourceName(orgSlug: string, projectSlug: string, workloadSlug: string): string {
  return `rntme-${orgSlug}-${projectSlug}-${workloadSlug}`;
}

function planObjectStorage(
  storage: StorageConfig | undefined,
  orgSlug: string,
  projectSlug: string,
  errors: DeploymentPlanError[],
): PlannedObjectStorage {
  if (storage === undefined || storage.mode === 'external') return { kind: 'none' };
  if (storage.provider !== 'rustfs') {
    errors.push({
      code: 'DEPLOY_PLAN_STORAGE_PROVIDER_UNSUPPORTED',
      message: `unsupported provisioned storage provider "${String(storage.provider)}"`,
      path: 'storage.provider',
    });
    return { kind: 'none' };
  }
  if (!isPinnedContainerImage(storage.image ?? DEFAULT_RUSTFS_IMAGE)) {
    errors.push({
      code: 'DEPLOY_PLAN_STORAGE_IMAGE_INVALID',
      message: 'provisioned RustFS image must use a non-latest tag',
      path: 'storage.image',
    });
    return { kind: 'none' };
  }
  if (storage.publicBaseUrl.trim() === '') {
    errors.push({
      code: 'DEPLOY_PLAN_STORAGE_PUBLIC_BASE_URL_MISSING',
      message: 'provisioned RustFS storage requires a publicBaseUrl',
      path: 'storage.publicBaseUrl',
    });
    return { kind: 'none' };
  }
  if (storage.accessKeyRef.trim() === '' || storage.secretKeyRef.trim() === '') {
    errors.push({
      code: 'DEPLOY_PLAN_STORAGE_CREDENTIAL_REF_MISSING',
      message: 'provisioned RustFS storage requires accessKeyRef and secretKeyRef',
      path: 'storage',
    });
    return { kind: 'none' };
  }
  const resource = resourceName(orgSlug, projectSlug, 'storage');
  return {
    kind: 's3-compatible',
    mode: 'provisioned',
    provider: 'rustfs',
    resourceName: resource,
    internalEndpoint: `http://${resource}:9000`,
    publicBaseUrl: storage.publicBaseUrl,
    bucketName: resourceName(orgSlug, projectSlug, 'default-storage'),
    region: 'us-east-1',
    forcePathStyle: true,
    image: storage.image ?? DEFAULT_RUSTFS_IMAGE,
    credentials: {
      accessKeyRef: storage.accessKeyRef,
      secretKeyRef: storage.secretKeyRef,
    },
    persistence: {
      mode: 'persistent',
      volumeName: `${resource}-data`,
    },
  };
}

function planEventBus(
  eventBus: EventBusConfig,
  orgSlug: string,
  projectSlug: string,
  errors: DeploymentPlanError[],
): PlannedEventBus | undefined {
  const mode = (eventBus as { readonly mode?: unknown }).mode ?? 'external';
  if (mode === 'external') {
    const external = eventBus as ExternalEventBusConfig;
    if (external.brokers.length === 0) {
      errors.push({
        code: 'DEPLOY_PLAN_MISSING_EVENT_BUS',
        message: 'preview deployments require one project-level external Kafka/Redpanda endpoint',
        path: 'eventBus',
      });
      return undefined;
    }
    validateEventBusSecurity(external, errors);
    return {
      kind: 'kafka',
      mode: 'external',
      brokers: external.brokers,
      ...(external.topicPrefix === undefined ? {} : { topicPrefix: external.topicPrefix }),
      ...(external.security === undefined ? {} : { security: external.security }),
    };
  }

  if (mode === 'in-memory') {
    return {
      kind: 'memory',
      mode: 'in-memory',
    };
  }

  if (mode !== 'provisioned') {
    errors.push({
      code: 'DEPLOY_PLAN_EVENT_BUS_MODE_UNSUPPORTED',
      message: `unsupported event bus mode "${String(mode)}"`,
      path: 'eventBus.mode',
    });
    return undefined;
  }

  const provisioned = eventBus as Extract<EventBusConfig, { mode: 'provisioned' }>;
  if (provisioned.provider !== 'redpanda') {
    errors.push({
      code: 'DEPLOY_PLAN_EVENT_BUS_PROVIDER_UNSUPPORTED',
      message: `unsupported provisioned event bus provider "${String(provisioned.provider)}"`,
      path: 'eventBus.provider',
    });
    return undefined;
  }

  const image = provisioned.image ?? DEFAULT_REDPANDA_IMAGE;
  if (!isPinnedContainerImage(image)) {
    errors.push({
      code: 'DEPLOY_PLAN_EVENT_BUS_IMAGE_INVALID',
      message: 'provisioned Redpanda image must use a non-latest tag',
      path: 'eventBus.image',
    });
    return undefined;
  }

  const resource = resourceName(orgSlug, projectSlug, 'event-bus');
  return {
    kind: 'kafka',
    mode: 'provisioned',
    provider: 'redpanda',
    resourceName: resource,
    internalBrokers: [`${resource}:9092`],
    ...(provisioned.topicPrefix === undefined ? {} : { topicPrefix: provisioned.topicPrefix }),
    image,
    persistence: {
      mode: 'persistent',
      volumeName: `${resource}-data`,
    },
  };
}

function validateEventBusSecurity(
  eventBus: ExternalEventBusConfig,
  errors: DeploymentPlanError[],
): void {
  const security = eventBus.security;
  if (security?.protocol !== 'sasl_ssl') return;

  if (security.mechanism !== 'scram-sha-256' && security.mechanism !== 'scram-sha-512') {
    errors.push({
      code: 'DEPLOY_PLAN_EVENT_BUS_SASL_MECHANISM_UNSUPPORTED',
      message: `unsupported SASL mechanism "${security.mechanism}"`,
      path: 'eventBus.security.mechanism',
    });
  }

  const secretRefs = security.secretRefs;
  if (!isNonEmptyString(secretRefs?.username) || !isNonEmptyString(secretRefs?.password)) {
    errors.push({
      code: 'DEPLOY_PLAN_EVENT_BUS_SASL_INCOMPLETE',
      message: 'sasl_ssl requires secretRefs.username and secretRefs.password',
      path: 'eventBus.security.secretRefs',
    });
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPinnedContainerImage(image: string): boolean {
  const trimmed = image.trim();
  if (trimmed === '') return false;
  const lastSlash = trimmed.lastIndexOf('/');
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon <= lastSlash) return false;
  return trimmed.slice(lastColon + 1) !== 'latest';
}
