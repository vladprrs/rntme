import { createHash } from 'node:crypto';
import type { DeploymentWorkload, ProjectDeploymentPlan } from '@rntme/deploy-core';
import { resolveEnvMappings, type ProvisionerEnvMapping, type ProvisionedModule } from '@rntme/deploy-core';
import { validateDokployTargetConfig, type DokployTargetConfig } from './config.js';
import type { DokployDeploymentError } from './errors.js';
import { dokployLabels, dokployResourceName } from './names.js';
import { renderNginxConfig } from './nginx.js';
import { err, ok, type Result } from './result.js';
import { renderRedpandaConsoleApplications } from './redpanda-console.js';
import {
  renderBpmnWorker,
  renderOperatonCompose,
  renderOperatonUiGateway,
} from './workflow-render.js';

export type RenderedSecretFileRef = {
  readonly schema: string;
  readonly secretRef: string;
  readonly field: string;
};

export type RenderedDokployProject =
  | { readonly mode: 'existing'; readonly projectId: string }
  | { readonly mode: 'create'; readonly projectName: string };

export type RenderedDokployDeployment = {
  readonly orgSlug: string;
  readonly projectSlug: string;
  readonly environment: ProjectDeploymentPlan['project']['environment'];
  readonly mode: ProjectDeploymentPlan['project']['mode'];
};

export type RenderedEnvVar = {
  readonly name: string;
  readonly value: string;
  readonly secret: boolean;
};

export type RenderedDomainArtifactBuild = {
  readonly kind: 'domain-service-artifact';
  readonly baseImage: string;
  readonly image: string;
  readonly artifact: {
    readonly source: 'composed-project';
    readonly serviceSlug: string;
  };
  readonly context: {
    readonly kind: 'generated';
    readonly serviceSlug: string;
    readonly files: readonly string[];
  };
};

export type RenderedDokployPort = {
  readonly containerPort: number;
  readonly protocol: 'http';
};

export type RenderedDokployIngress = {
  readonly publicBaseUrl: string;
  readonly containerPort: number;
  readonly healthPath: '/health';
  readonly routes: readonly {
    readonly routeId: string;
    readonly path: string;
    readonly url: string;
  }[];
};

export type RenderedDokployApplicationResource = {
  readonly logicalId: string;
  readonly kind: 'application';
  readonly workloadKind?: DeploymentWorkload['kind'] | 'infrastructure-proxy';
  readonly workloadSlug?: string;
  readonly infrastructureKind?: 'operaton-ui-gateway' | 'redpanda-console' | 'redpanda-console-proxy';
  readonly name: string;
  readonly image: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly build?: RenderedDomainArtifactBuild;
  readonly ports?: readonly RenderedDokployPort[];
  readonly ingress?: RenderedDokployIngress;
  readonly env: readonly RenderedEnvVar[];
  readonly labels: Readonly<Record<string, string>>;
  readonly files?: Readonly<Record<string, string>>;
  readonly secretFiles?: Readonly<Record<string, RenderedSecretFileRef>>;
  readonly secretResolutionHints?: {
    readonly redpandaConsoleHtpasswd?: { readonly secretRef: string; readonly expectedUsername: string };
  };
};

export type RenderedDokployComposeResource = {
  readonly logicalId: string;
  readonly kind: 'compose';
  readonly infrastructureKind: 'event-bus' | 'workflow-engine' | 'object-storage';
  readonly name: string;
  readonly image: string;
  readonly composeFile: string;
  readonly env: readonly RenderedEnvVar[];
  readonly labels: Readonly<Record<string, string>>;
  readonly secretFiles?: Readonly<Record<string, RenderedSecretFileRef>>;
};

export type RenderedDokployResource =
  | RenderedDokployApplicationResource
  | RenderedDokployComposeResource;

export type RenderedDokployPlan = {
  readonly target: { readonly kind: 'dokploy'; readonly endpoint: string };
  readonly targetProject: RenderedDokployProject;
  readonly deployment: RenderedDokployDeployment;
  readonly resources: readonly RenderedDokployResource[];
  readonly urls: {
    readonly projectUrl: string;
    readonly uiUrl?: string;
    readonly operatonUiUrl?: string;
    readonly operatonUiAuthChecks?: readonly { readonly name: string; readonly url: string }[];
    readonly redpandaConsoleUrl?: string;
    readonly publicRoutes: readonly { readonly routeId: string; readonly url: string }[];
    readonly protectedRouteChecks: readonly { readonly name: string; readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; readonly url: string }[];
  };
  readonly digest: string;
  readonly warnings: readonly string[];
};

export function renderDokployPlan(
  plan: ProjectDeploymentPlan,
  config: DokployTargetConfig,
  provisionedModules: ReadonlyMap<string, ProvisionedModule> = new Map(),
  envMappings: ProvisionerEnvMapping = {},
): Result<RenderedDokployPlan, DokployDeploymentError> {
  const configResult = validateDokployTargetConfig(config);
  if (!configResult.ok) return err(configResult.errors);

  const resolvedConfig = configResult.value;
  const targetProject = resolveProject(resolvedConfig);
  if (targetProject === null) {
    return err([
      {
        code: 'DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT',
        message: 'set projectId or projectName with allowCreateProject: true',
      },
    ]);
  }

  const upstreams = Object.fromEntries(
    plan.workloads
      .filter((w) => w.kind !== 'edge-gateway' && w.kind !== 'bpmn-worker')
      .map((w) => [
        w.slug,
        `http://${dokployResourceName(plan.project.orgSlug, plan.project.projectSlug, w.slug)}:${workloadHttpPort(w)}`,
      ]),
  );
  const nginxConfig = renderEdgeGatewayConfig(plan, upstreams);
  if (!nginxConfig.ok) return nginxConfig;

  const missingRuntimeFiles = plan.workloads.find(
    (workload) => workload.kind === 'domain-service' && Object.keys(workload.runtimeFiles).length === 0,
  );
  if (missingRuntimeFiles !== undefined) {
    return err([
      {
        code: 'DEPLOY_RENDER_DOKPLOY_MISSING_RUNTIME_FILES',
        message: `domain service "${missingRuntimeFiles.slug}" has no runtime artifact files`,
        resource: missingRuntimeFiles.resourceName,
      },
    ]);
  }

  const infrastructureResources = renderInfrastructureResources(plan);
  const workloadResources = renderWorkloadResources(plan, nginxConfig.value, resolvedConfig.publicBaseUrl);
  if (!workloadResources.ok) return workloadResources;
  const resources = [...infrastructureResources, ...workloadResources.value];

  const envEntries = resolveEnvMappings(provisionedModules, envMappings);
  const resourcesWithProvisionedEnv = resources.map((resource) => {
    const slug =
      resource.kind === 'application'
        ? (resource.workloadSlug ?? resource.logicalId)
        : resource.logicalId;
    const additions = envEntries
      .filter((e) => e.target === slug)
      .map((e) => ({ name: e.envName, value: e.value, secret: e.secret }));
    if (additions.length === 0) return resource;
    return { ...resource, env: [...resource.env, ...additions] };
  });

  const uiRoute = plan.edge.routes.find((route) => route.kind === 'ui');
  const ingressRoutes = plan.edge.routes.map((route) => ({
    routeId: route.id,
    path: route.path,
    url: joinPublicUrl(resolvedConfig.publicBaseUrl, route.path),
  }));
  const publicSmokeRoutes = ingressRoutes.filter((_, idx) => {
    const route = plan.edge.routes[idx];
    return route !== undefined && route.kind !== 'ui' && !isAuthProtectedRoute(plan, route.id);
  });
  const protectedRouteChecks = protectedSmokeChecks(plan, resolvedConfig.publicBaseUrl);
  const operatonUiAccess = plan.infrastructure.workflowEngine?.kind === 'operaton'
    ? plan.infrastructure.workflowEngine.uiAccess
    : undefined;
  const operatonUiUrl = operatonUiAccess?.publicBaseUrl;
  const redpandaConsoleUrl = plan.infrastructure.manualAccess?.redpandaConsole?.publicBaseUrl;
  const urls: RenderedDokployPlan['urls'] = {
    projectUrl: resolvedConfig.publicBaseUrl,
    ...(uiRoute === undefined
      ? {}
      : { uiUrl: joinPublicUrl(resolvedConfig.publicBaseUrl, uiRoute.path) }),
    ...(operatonUiUrl === undefined
      ? {}
      : {
          operatonUiUrl,
          operatonUiAuthChecks: [{ name: 'operaton-ui', url: operatonUiUrl }],
        }),
    ...(redpandaConsoleUrl === undefined ? {} : { redpandaConsoleUrl }),
    publicRoutes: publicSmokeRoutes.map(stripRoutePath),
    protectedRouteChecks,
  };
  const renderedWithoutDigest = {
    target: { kind: 'dokploy' as const, endpoint: resolvedConfig.endpoint },
    targetProject,
    deployment: {
      orgSlug: plan.project.orgSlug,
      projectSlug: plan.project.projectSlug,
      environment: plan.project.environment,
      mode: plan.project.mode,
    },
    resources: resourcesWithProvisionedEnv.map((resource) =>
      resource.kind === 'application' &&
      resource.workloadKind === 'edge-gateway'
        ? {
            ...resource,
            ports: [{ containerPort: 8080, protocol: 'http' as const }],
            ingress: {
              publicBaseUrl: resolvedConfig.publicBaseUrl,
              containerPort: 8080,
              healthPath: '/health' as const,
              routes: ingressRoutes,
            },
          }
        : resource,
    ),
    urls,
    warnings: plan.diagnostics.warnings.map((warning) => warning.message),
  };
  const collision = findNameCollision(renderedWithoutDigest.resources);
  if (collision !== null) {
    return err([
      {
        code: 'DEPLOY_RENDER_DOKPLOY_NAME_COLLISION',
        message: `rendered Dokploy resource name "${collision}" is not unique`,
        resource: collision,
      },
    ]);
  }

  return ok({
    ...renderedWithoutDigest,
    digest: digest(renderedWithoutDigest),
  });
}

function workloadHttpPort(workload: Exclude<DeploymentWorkload, { kind: 'edge-gateway' | 'bpmn-worker' }>): number {
  return workload.kind === 'integration-module' ? 50052 : 3000;
}

function renderEdgeGatewayConfig(
  plan: ProjectDeploymentPlan,
  upstreams: Readonly<Record<string, string>>,
): Result<string, DokployDeploymentError> {
  try {
    return ok(renderNginxConfig(plan.edge, upstreams));
  } catch (cause) {
    return err([
      {
        code: 'DEPLOY_RENDER_DOKPLOY_INVALID_NGINX_CONFIG',
        message: 'failed to render Nginx edge gateway config',
        cause,
      },
    ]);
  }
}

function resolveProject(config: DokployTargetConfig): RenderedDokployProject | null {
  if (config.projectId !== undefined && config.projectId !== '') {
    return { mode: 'existing', projectId: config.projectId };
  }
  if (
    config.projectName !== undefined &&
    config.projectName !== '' &&
    config.allowCreateProject === true
  ) {
    return { mode: 'create', projectName: config.projectName };
  }
  return null;
}

function renderInfrastructureResources(plan: ProjectDeploymentPlan): RenderedDokployResource[] {
  const resources: RenderedDokployResource[] = [];
  const eventBus = plan.infrastructure.eventBus;
  if (eventBus.mode === 'provisioned') resources.push(renderRedpandaCompose(plan));
  const objectStorage = plan.infrastructure.objectStorage ?? { kind: 'none' };
  if (objectStorage.kind === 's3-compatible') {
    resources.push(renderRustfsCompose(plan));
    resources.push(renderRustfsPublicProxy(plan));
  }
  const workflowEngine = renderOperatonCompose(plan);
  if (workflowEngine !== null) resources.push(workflowEngine);
  const uiGateway = renderOperatonUiGateway(plan);
  if (uiGateway !== null) resources.push(uiGateway);
  const consoleAccess = plan.infrastructure.manualAccess?.redpandaConsole;
  if (consoleAccess !== undefined && eventBus.mode === 'provisioned') {
    resources.push(...renderRedpandaConsoleApplications(plan, consoleAccess, eventBus.resourceName));
  }
  return resources;
}

function renderWorkloadResources(
  plan: ProjectDeploymentPlan,
  nginxConfig: string,
  publicAppBaseUrl: string,
): Result<RenderedDokployApplicationResource[], DokployDeploymentError> {
  const resources: RenderedDokployApplicationResource[] = [];
  for (const workload of plan.workloads) {
    const resource = renderResource(plan, workload, nginxConfig, publicAppBaseUrl);
    if (!resource.ok) return resource;
    resources.push(resource.value);
  }
  return ok(resources);
}

function renderRedpandaCompose(plan: ProjectDeploymentPlan): RenderedDokployComposeResource {
  const eventBus = plan.infrastructure.eventBus;
  if (eventBus.mode !== 'provisioned') {
    throw new Error('renderRedpandaCompose called for external event bus');
  }

  const labels = {
    ...dokployLabels(
      plan.project.orgSlug,
      plan.project.projectSlug,
      plan.project.environment,
      'event-bus',
    ),
    'rntme.infrastructure': 'event-bus',
    'rntme.provider': eventBus.provider,
  };

  return {
    logicalId: 'event-bus',
    kind: 'compose',
    infrastructureKind: 'event-bus',
    name: eventBus.resourceName,
    image: eventBus.image,
    composeFile: redpandaComposeFile(eventBus, workflowMessageStartTopics(plan)),
    env: [],
    labels,
  };
}

function redpandaComposeFile(
  eventBus: Extract<ProjectDeploymentPlan['infrastructure']['eventBus'], { mode: 'provisioned' }>,
  seedTopics: readonly string[] = [],
): string {
  // The runtime/edge/module containers run as Docker Swarm services attached
  // to the shared `dokploy-network` overlay. Without explicitly attaching the
  // compose stack to that network, Redpanda lives only on its private
  // `<stack>_default` bridge and the broker hostname does not resolve from
  // sibling apps (`getaddrinfo ENOTFOUND`). Attaching here gives the broker
  // a stable resource-name alias inside dokploy-network. Redpanda must
  // advertise the same alias because Kafka clients follow broker metadata
  // after the initial bootstrap connection.
  const startArgs = [
    'redpanda start --mode=dev-container --smp=1 --memory=512M --reserve-memory=0M --overprovisioned --kafka-addr=internal://0.0.0.0:9092',
    `--advertise-kafka-addr=internal://${eventBus.resourceName}:9092`,
  ].join(' ');
  const startCommand = seedTopics.length === 0 ? startArgs : `rpk ${startArgs}`;
  const command =
    seedTopics.length === 0
      ? startArgs
      : shellSingleQuote(
          [
            `${startCommand} & pid=$$!`,
            `until rpk cluster info --brokers ${eventBus.resourceName}:9092 >/dev/null 2>&1; do sleep 1; done`,
            `rpk topic create --brokers ${eventBus.resourceName}:9092 ${seedTopics.map(shellWord).join(' ')} || true`,
            'wait "$$pid"',
          ].join('; '),
        );

  return [
    'services:',
    '  redpanda:',
    `    image: ${eventBus.image}`,
    ...(seedTopics.length === 0 ? [] : ['    entrypoint: ["/bin/sh", "-ec"]']),
    ...(seedTopics.length === 0 ? [`    command: ${command}`] : ['    command:', `      - ${command}`]),
    '    volumes:',
    `      - ${eventBus.persistence.volumeName}:/var/lib/redpanda/data`,
    '    networks:',
    '      default:',
    '      dokploy-network:',
    '        aliases:',
    `          - ${eventBus.resourceName}`,
    'volumes:',
    `  ${eventBus.persistence.volumeName}:`,
    '    name: ' + eventBus.persistence.volumeName,
    'networks:',
    '  dokploy-network:',
    '    external: true',
    '',
  ].join('\n');
}

function renderRustfsCompose(plan: ProjectDeploymentPlan): RenderedDokployComposeResource {
  const storage = plan.infrastructure.objectStorage;
  if (storage.kind !== 's3-compatible') throw new Error('renderRustfsCompose called without object storage');
  return {
    logicalId: 'object-storage',
    kind: 'compose',
    infrastructureKind: 'object-storage',
    name: storage.resourceName,
    image: storage.image,
    composeFile: rustfsComposeFile(storage),
    env: [
      { name: 'RUSTFS_ACCESS_KEY', value: storage.credentials.accessKeyRef, secret: true },
      { name: 'RUSTFS_SECRET_KEY', value: storage.credentials.secretKeyRef, secret: true },
    ],
    labels: {
      ...dokployLabels(plan.project.orgSlug, plan.project.projectSlug, plan.project.environment, 'object-storage'),
      'rntme.infrastructure': 'object-storage',
      'rntme.provider': storage.provider,
    },
  };
}

function rustfsComposeFile(storage: Extract<ProjectDeploymentPlan['infrastructure']['objectStorage'], { kind: 's3-compatible' }>): string {
  return [
    'services:',
    '  rustfs:',
    `    image: ${storage.image}`,
    '    command: server /data',
    '    environment:',
    '      RUSTFS_ACCESS_KEY: ${RUSTFS_ACCESS_KEY}',
    '      RUSTFS_SECRET_KEY: ${RUSTFS_SECRET_KEY}',
    '    volumes:',
    `      - ${storage.persistence.volumeName}:/data`,
    '    networks:',
    '      default:',
    '      dokploy-network:',
    '        aliases:',
    `          - ${storage.resourceName}`,
    'volumes:',
    `  ${storage.persistence.volumeName}:`,
    `    name: ${storage.persistence.volumeName}`,
    'networks:',
    '  dokploy-network:',
    '    external: true',
    '',
  ].join('\n');
}

function renderRustfsPublicProxy(plan: ProjectDeploymentPlan): RenderedDokployApplicationResource {
  const storage = plan.infrastructure.objectStorage;
  if (storage.kind !== 's3-compatible') throw new Error('renderRustfsPublicProxy called without object storage');
  return {
    logicalId: 'object-storage-public',
    kind: 'application',
    workloadKind: 'infrastructure-proxy',
    workloadSlug: 'object-storage-public',
    name: `${storage.resourceName}-public`,
    image: 'nginx:1.27-alpine',
    env: [],
    labels: {
      ...dokployLabels(plan.project.orgSlug, plan.project.projectSlug, plan.project.environment, 'object-storage-public'),
      'rntme.infrastructure': 'object-storage-public',
      'rntme.provider': storage.provider,
    },
    ports: [{ containerPort: 8080, protocol: 'http' }],
    ingress: {
      publicBaseUrl: storage.publicBaseUrl,
      containerPort: 8080,
      healthPath: '/health',
      routes: [],
    },
    files: {
      '/etc/nginx/nginx.conf': rustfsProxyNginxConfig(storage.resourceName),
    },
  };
}

function rustfsProxyNginxConfig(resourceName: string): string {
  return [
    'events {}',
    'http {',
    '  server {',
    '    listen 8080;',
    '    client_max_body_size 0;',
    '    location = /health { return 200 "ok"; }',
    '    location / {',
    `      proxy_pass http://${resourceName}:9000;`,
    '      proxy_set_header Host $host;',
    '      proxy_set_header X-Forwarded-Proto $scheme;',
    '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '      proxy_request_buffering off;',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}

function workflowMessageStartTopics(plan: ProjectDeploymentPlan): readonly string[] {
  const topics = new Set<string>();
  for (const workload of plan.workloads) {
    if (workload.kind !== 'bpmn-worker') continue;
    for (const subscription of workload.subscriptions) topics.add(subscription.topic);
  }
  return [...topics].sort();
}

function shellWord(value: string): string {
  return /^[A-Za-z0-9._:-]+$/.test(value) ? value : shellSingleQuote(value);
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function renderResource(
  plan: ProjectDeploymentPlan,
  workload: DeploymentWorkload,
  nginxConfig: string,
  publicAppBaseUrl: string,
): Result<RenderedDokployApplicationResource, DokployDeploymentError> {
  if (workload.kind === 'bpmn-worker') {
    return renderBpmnWorker(plan, workload);
  }

  const name = dokployResourceName(plan.project.orgSlug, plan.project.projectSlug, workload.slug);
  const labels = dokployLabels(
    plan.project.orgSlug,
    plan.project.projectSlug,
    plan.project.environment,
    workload.slug,
  );

  if (workload.kind === 'edge-gateway') {
    const publicConfigJson = firstDomainPublicConfig(plan.workloads);
    return ok({
      logicalId: workload.slug,
      kind: 'application',
      workloadKind: workload.kind,
      workloadSlug: workload.slug,
      name,
      image: workload.image,
      env: [],
      labels,
      files: { '/etc/nginx/nginx.conf': nginxConfig, '/srv/config.json': publicConfigJson },
    });
  }

  if (workload.kind === 'integration-module') {
    return ok({
      logicalId: workload.slug,
      kind: 'application',
      workloadKind: workload.kind,
      workloadSlug: workload.slug,
      name,
      image: workload.image,
      env: [
        ...sortedEntries(workload.env).map(([envName, value]) => ({
          name: envName,
          value,
          secret: false,
        })),
        ...sortedEntries(workload.secretRefs).map(([envName, ref]) => ({
          name: envName,
          value: ref,
          secret: true,
        })),
        ...storageS3Env(plan, workload, publicAppBaseUrl),
      ],
      labels,
      ports: [
        { containerPort: 50051, protocol: 'http' as const },
        { containerPort: 50052, protocol: 'http' as const },
      ],
    });
  }

  if (workload.kind === 'domain-service') {
    const authMiddleware = authMiddlewareForWorkload(plan, workload);
    const files = {
      ...runtimeFileMounts(workload.runtimeFiles),
      '/srv/config.json': workload.publicConfigJson,
    };

    return ok({
      logicalId: workload.slug,
      kind: 'application',
      workloadKind: workload.kind,
      workloadSlug: workload.slug,
      name,
      image: workload.runtime.image,
      env: [
        ...eventBusEnv(plan.infrastructure.eventBus),
        {
          name: 'RNTME_PERSISTENCE_MODE',
          value: workload.persistence.mode,
          secret: false,
        },
        {
          name: 'RNTME_ARTIFACTS_DIR',
          value: '/srv/artifacts',
          secret: false,
        },
        ...(authMiddleware === undefined
          ? []
          : [
              { name: 'RNTME_AUTH_PROVIDER', value: authMiddleware.provider, secret: false },
              { name: 'RNTME_AUTH_AUDIENCE', value: authMiddleware.audience, secret: false },
              { name: 'RNTME_AUTH_MODULE_SLUG', value: authMiddleware.moduleSlug, secret: false },
              {
                name: 'RNTME_AUTH_MODULE_ENDPOINT',
                value: `${dokployResourceName(
                  plan.project.orgSlug,
                  plan.project.projectSlug,
                  authMiddleware.moduleSlug,
                )}:50051`,
                secret: false,
              },
            ]),
      ],
      labels,
      files,
    });
  }

  return assertNever(workload);
}

function storageS3Env(
  plan: ProjectDeploymentPlan,
  workload: Extract<DeploymentWorkload, { kind: 'integration-module' }>,
  publicAppBaseUrl: string,
): RenderedEnvVar[] {
  const storage = plan.infrastructure.objectStorage;
  if (storage.kind !== 's3-compatible') return [];
  if (workload.modulePackageName !== '@rntme/storage-s3') return [];
  return [
    { name: 'STORAGE_S3_ENDPOINT', value: storage.internalEndpoint, secret: false },
    { name: 'STORAGE_S3_PUBLIC_ENDPOINT', value: storage.publicBaseUrl, secret: false },
    { name: 'STORAGE_S3_BUCKET', value: storage.bucketName, secret: false },
    { name: 'STORAGE_S3_REGION', value: storage.region, secret: false },
    { name: 'STORAGE_S3_FORCE_PATH_STYLE', value: String(storage.forcePathStyle), secret: false },
    { name: 'STORAGE_S3_ACCESS_KEY_ID', value: storage.credentials.accessKeyRef, secret: true },
    { name: 'STORAGE_S3_SECRET_ACCESS_KEY', value: storage.credentials.secretKeyRef, secret: true },
    { name: 'STORAGE_S3_BACKEND', value: storage.provider, secret: false },
    { name: 'STORAGE_S3_APP_ORIGINS', value: publicAppBaseUrl, secret: false },
  ];
}

function runtimeFileMounts(files: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.fromEntries(
    sortedEntries(files).map(([path, content]) => [`/srv/artifacts/${path.replace(/^\/+/, '')}`, content]),
  );
}

function firstDomainPublicConfig(workloads: readonly DeploymentWorkload[]): string {
  return workloads.find((workload) => workload.kind === 'domain-service')?.publicConfigJson ?? '{}';
}

function eventBusEnv(
  eventBus: ProjectDeploymentPlan['infrastructure']['eventBus'],
): RenderedEnvVar[] {
  if (eventBus.mode === 'in-memory') return [];

  if (eventBus.mode === 'provisioned') {
    return [
      {
        name: 'RNTME_EVENT_BUS_BROKERS',
        value: eventBus.internalBrokers.join(','),
        secret: false,
      },
      { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false },
      ...(eventBus.topicPrefix === undefined || eventBus.topicPrefix === ''
        ? []
        : [{ name: 'RNTME_EVENT_BUS_TOPIC_PREFIX', value: eventBus.topicPrefix, secret: false }]),
    ];
  }

  const env: RenderedEnvVar[] = [
    {
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: eventBus.brokers.join(','),
      secret: false,
    },
  ];
  if (eventBus.security?.protocol === 'sasl_ssl') {
    env.push(
      { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'sasl_ssl', secret: false },
      { name: 'RNTME_EVENT_BUS_MECHANISM', value: eventBus.security.mechanism, secret: false },
      { name: 'RNTME_EVENT_BUS_USERNAME', value: eventBus.security.secretRefs.username, secret: true },
      { name: 'RNTME_EVENT_BUS_PASSWORD', value: eventBus.security.secretRefs.password, secret: true },
    );
  } else {
    env.push({ name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false });
  }
  if (eventBus.topicPrefix !== undefined && eventBus.topicPrefix !== '') {
    env.push({ name: 'RNTME_EVENT_BUS_TOPIC_PREFIX', value: eventBus.topicPrefix, secret: false });
  }
  return env;
}

function authMiddlewareForWorkload(
  plan: ProjectDeploymentPlan,
  workload: Extract<DeploymentWorkload, { kind: 'domain-service' }>,
): Extract<ProjectDeploymentPlan['edge']['middleware'][number], { kind: 'auth' }> | undefined {
  return plan.edge.middleware.find((middleware) => {
    if (middleware.kind !== 'auth') return false;
    return routesMountedOnTarget(middleware.mountTarget, workload, plan.edge.routes);
  }) as Extract<ProjectDeploymentPlan['edge']['middleware'][number], { kind: 'auth' }> | undefined;
}

function routesMountedOnTarget(
  mountTarget: string,
  workload: Extract<DeploymentWorkload, { kind: 'domain-service' }>,
  routes: ProjectDeploymentPlan['edge']['routes'],
): boolean {
  return routes.some(
    (route) =>
      route.targetService === workload.serviceSlug &&
      route.targetWorkload === workload.slug &&
      route.id === mountTarget,
  );
}

function findNameCollision(resources: readonly RenderedDokployResource[]): string | null {
  const seen = new Set<string>();
  for (const resource of resources) {
    if (seen.has(resource.name)) return resource.name;
    seen.add(resource.name);
  }
  return null;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function joinPublicUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\/+/, ''), normalizedBase).toString();
}

function sortedEntries(value: Readonly<Record<string, string>>): [string, string][] {
  return Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
}

function stripRoutePath(route: {
  readonly routeId: string;
  readonly path: string;
  readonly url: string;
}): { readonly routeId: string; readonly url: string } {
  return { routeId: route.routeId, url: route.url };
}

function protectedSmokeChecks(
  plan: ProjectDeploymentPlan,
  publicBaseUrl: string,
): readonly { readonly name: string; readonly method: 'GET' | 'POST'; readonly url: string }[] {
  const protectedApiRoute = plan.edge.routes.find((route) => {
    if (route.kind !== 'http') return false;
    if (route.path !== '/api') return false;
    return plan.edge.middleware.some((middleware) => middleware.kind === 'auth' && middleware.mountTarget === route.id);
  });
  if (protectedApiRoute === undefined) return [];
  const notesUrl = joinPublicUrl(publicBaseUrl, '/api/notes');
  return [
    { name: 'protected-api-get-notes', method: 'GET', url: notesUrl },
    { name: 'protected-api-post-notes', method: 'POST', url: notesUrl },
  ];
}

function isAuthProtectedRoute(plan: ProjectDeploymentPlan, routeId: string): boolean {
  return plan.edge.middleware.some((middleware) => middleware.kind === 'auth' && middleware.mountTarget === routeId);
}

function assertNever(value: never): never {
  throw new Error(`unhandled workload kind: ${JSON.stringify(value)}`);
}
