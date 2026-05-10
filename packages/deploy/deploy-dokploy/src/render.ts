import { createHash } from 'node:crypto';
import type { DeploymentWorkload, ProjectDeploymentPlan } from '@rntme/deploy-core';
import { resolveEnvMappings, type ProvisionerEnvMapping, type ProvisionedModule } from '@rntme/deploy-core';
import {
  infraRestartPolicy,
  proxyLimits,
  redpandaLimits,
  runtimeLimits,
  runtimeRestartPolicy,
  rustfsLimits,
  type RenderedComposeDomain,
  type RenderedComposeService,
} from './compose-model.js';
import { renderComposeYaml } from './compose-yaml.js';
import { validateDokployTargetConfig, type DokployTargetConfig } from './config.js';
import type { DokployDeploymentError } from './errors.js';
import { dokployLabels, dokployResourceName, normalizePart } from './names.js';
import { renderNginxConfig } from './nginx.js';
import { err, ok, type Result } from './result.js';
import { renderRedpandaConsoleServices } from './redpanda-console.js';
import {
  renderBpmnWorkerService,
  renderOperatonService,
  renderOperatonUiGatewayService,
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
  readonly infrastructureKind?: 'redpanda-console' | 'redpanda-console-proxy';
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
  readonly infrastructureKind: 'event-bus' | 'workflow-engine' | 'object-storage' | 'project-stack';
  readonly name: string;
  readonly image: string;
  readonly composeFile: string;
  readonly services?: readonly RenderedComposeService[];
  readonly domains?: readonly RenderedComposeDomain[];
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
        `http://${composeServiceNameForWorkload(w)}:${workloadHttpPort(w)}`,
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

  const stackResource = renderProjectStackResource(plan, nginxConfig.value, resolvedConfig.publicBaseUrl);
  if (!stackResource.ok) return stackResource;
  const resources: RenderedDokployResource[] = [stackResource.value];

  const envEntries = resolveEnvMappings(provisionedModules, envMappings);
  const resourcesWithProvisionedEnv: RenderedDokployResource[] = [];
  for (const resource of resources) {
    if (resource.kind === 'compose' && resource.services !== undefined) {
      const services = resource.services.map((service) => {
        const slug = service.workloadSlug ?? service.logicalId;
        const additions = envEntries
          .filter((e) => e.target === slug)
          .map((e) => ({ name: e.envName, value: e.value, secret: e.secret }));
        if (additions.length === 0) return service;
        return { ...service, env: [...service.env, ...additions] };
      });
      const stackSlug = resource.logicalId;
      const stackAdditions = envEntries
        .filter((e) => e.target === stackSlug)
        .map((e) => ({ name: e.envName, value: e.value, secret: e.secret }));
      const stackSeed = stackAdditions.length === 0 ? resource.env : [...resource.env, ...stackAdditions];
      // Compose YAML emits `<NAME>: ${<NAME>}` interpolation references for
      // every service env entry. For these to resolve at deploy time, the
      // values themselves must travel on the stack-level env block (sent via
      // `compose.saveEnvironment`). Fold service envs UP into the stack env
      // here so the YAML and the Dokploy env block stay in lockstep.
      const collectedEnv = collectStackEnv(services, stackSeed);
      if (!collectedEnv.ok) return collectedEnv;
      const next: typeof resource = { ...resource, services, env: collectedEnv.value };
      resourcesWithProvisionedEnv.push({ ...next, composeFile: renderComposeYaml(services) });
      continue;
    }
    const slug =
      resource.kind === 'application'
        ? (resource.workloadSlug ?? resource.logicalId)
        : resource.logicalId;
    const additions = envEntries
      .filter((e) => e.target === slug)
      .map((e) => ({ name: e.envName, value: e.value, secret: e.secret }));
    if (additions.length === 0) {
      resourcesWithProvisionedEnv.push(resource);
      continue;
    }
    resourcesWithProvisionedEnv.push({ ...resource, env: [...resource.env, ...additions] });
  }

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

/**
 * Fold every service env entry up into a single stack-level env block so the
 * `${VAR}` references the YAML emits actually resolve at deploy time. Same
 * names with matching value+secret flag dedupe; same name with disagreeing
 * value or secret flag is a render error (the rendered stack would otherwise
 * have to pick a winner silently). Output is alphabetized so digests stay
 * stable.
 */
function collectStackEnv(
  services: readonly RenderedComposeService[],
  existingStackEnv: readonly RenderedEnvVar[],
): Result<readonly RenderedEnvVar[], DokployDeploymentError> {
  const byName = new Map<string, RenderedEnvVar>();
  for (const entry of existingStackEnv) byName.set(entry.name, entry);
  for (const service of services) {
    for (const entry of service.env) {
      const existing = byName.get(entry.name);
      if (existing === undefined) {
        byName.set(entry.name, entry);
        continue;
      }
      if (existing.value !== entry.value || existing.secret !== entry.secret) {
        return err([
          {
            code: 'DEPLOY_RENDER_DOKPLOY_STACK_ENV_COLLISION',
            message: `stack env collision for ${entry.name}: services disagree on value or secret flag`,
            service: service.name,
          },
        ]);
      }
    }
  }
  return ok([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)));
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

function renderProjectStackResource(
  plan: ProjectDeploymentPlan,
  nginxConfig: string,
  publicBaseUrl: string,
): Result<RenderedDokployComposeResource, DokployDeploymentError> {
  const services: RenderedComposeService[] = [];
  const domains: RenderedComposeDomain[] = [composeDomain(publicBaseUrl, 'edge', 8080)];

  const redpanda = renderRedpandaService(plan);
  if (redpanda !== null) services.push(redpanda);
  const rustfs = renderRustfsService(plan);
  if (rustfs !== null) services.push(rustfs);
  const rustfsProxy = renderRustfsPublicProxyService(plan);
  if (rustfsProxy !== null) {
    services.push(rustfsProxy.service);
    domains.push(rustfsProxy.domain);
  }
  const operaton = renderOperatonService(plan);
  if (operaton !== null) services.push(operaton);
  const operatonUiGateway = renderOperatonUiGatewayService(plan);
  if (operatonUiGateway !== null) {
    services.push(operatonUiGateway);
    const uiAccess =
      plan.infrastructure.workflowEngine?.kind === 'operaton'
        ? plan.infrastructure.workflowEngine.uiAccess
        : undefined;
    if (uiAccess !== undefined) {
      domains.push(composeDomain(uiAccess.publicBaseUrl, 'operaton-ui-gateway', 8080));
    }
  }
  const consoleAccess = plan.infrastructure.manualAccess?.redpandaConsole;
  if (consoleAccess !== undefined && plan.infrastructure.eventBus.mode === 'provisioned') {
    const consoleRendered = renderRedpandaConsoleServices(plan, consoleAccess);
    services.push(...consoleRendered.services);
    domains.push(...consoleRendered.domains);
  }

  for (const workload of plan.workloads) {
    if (workload.kind === 'bpmn-worker') {
      const worker = renderBpmnWorkerService(plan, workload);
      if (!worker.ok) return worker;
      services.push(worker.value);
      continue;
    }
    const resource = renderResource(plan, workload, nginxConfig, publicBaseUrl);
    if (!resource.ok) return resource;
    services.push(applicationResourceToComposeService(resource.value));
  }

  return ok({
    logicalId: 'project-stack',
    kind: 'compose',
    infrastructureKind: 'project-stack',
    name: projectStackName(plan.project.orgSlug, plan.project.projectSlug),
    image: 'docker-compose',
    composeFile: renderComposeYaml(services),
    services,
    domains,
    env: [],
    labels: {
      ...dokployLabels(plan.project.orgSlug, plan.project.projectSlug, plan.project.environment, 'project-stack'),
      'rntme.infrastructure': 'project-stack',
    },
  });
}

function applicationResourceToComposeService(resource: RenderedDokployApplicationResource): RenderedComposeService {
  const ports =
    resource.workloadKind === 'edge-gateway'
      ? ([8080] as const)
      : resource.ports?.map((port) => port.containerPort);
  return {
    name: composeServiceName(resource),
    logicalId: resource.logicalId,
    serviceClass:
      resource.workloadKind === 'edge-gateway'
        ? 'edge-gateway'
        : resource.workloadKind === 'integration-module'
          ? 'integration-module'
          : resource.workloadKind === 'infrastructure-proxy'
            ? 'infrastructure-proxy'
            : 'domain-service',
    ...(resource.workloadKind !== undefined ? { workloadKind: resource.workloadKind } : {}),
    ...(resource.workloadSlug !== undefined ? { workloadSlug: resource.workloadSlug } : {}),
    image: resource.image,
    ...(resource.command !== undefined ? { command: resource.command } : {}),
    ...(resource.args !== undefined ? { args: resource.args } : {}),
    env: resource.env,
    ...(resource.files !== undefined ? { files: resource.files } : {}),
    ...(resource.secretFiles !== undefined ? { secretFiles: resource.secretFiles } : {}),
    ...(ports !== undefined ? { ports } : {}),
    restart: runtimeRestartPolicy(),
    resources:
      resource.workloadKind === 'edge-gateway' || resource.workloadKind === 'infrastructure-proxy'
        ? proxyLimits()
        : runtimeLimits(),
  };
}

function composeServiceName(resource: RenderedDokployApplicationResource): string {
  if (resource.workloadKind === 'edge-gateway') return 'edge';
  if (resource.workloadKind === 'integration-module') return `mod-${resource.workloadSlug ?? resource.logicalId}`;
  if (resource.workloadKind === 'bpmn-worker') return resource.workloadSlug ?? 'bpmn-worker';
  if (resource.workloadKind === 'infrastructure-proxy') return resource.workloadSlug ?? resource.logicalId;
  return `svc-${resource.workloadSlug ?? resource.logicalId}`;
}

function composeServiceNameForWorkload(
  workload: Exclude<DeploymentWorkload, { kind: 'edge-gateway' | 'bpmn-worker' }>,
): string {
  if (workload.kind === 'integration-module') return `mod-${workload.slug}`;
  return `svc-${workload.slug}`;
}

function composeDomain(publicBaseUrl: string, serviceName: string, containerPort: number): RenderedComposeDomain {
  const url = new URL(publicBaseUrl);
  return {
    host: url.host,
    path: '/',
    serviceName,
    containerPort,
    https: url.protocol === 'https:',
  };
}

function projectStackName(orgSlug: string, projectSlug: string): string {
  return ['rntme', orgSlug, projectSlug].map(normalizePart).join('-');
}

function renderRedpandaService(plan: ProjectDeploymentPlan): RenderedComposeService | null {
  const eventBus = plan.infrastructure.eventBus;
  if (eventBus.mode !== 'provisioned') return null;
  return {
    name: 'redpanda',
    logicalId: 'event-bus',
    serviceClass: 'event-bus',
    image: eventBus.image,
    command: redpandaCommand(eventBus, workflowMessageStartTopics(plan)),
    env: [],
    ports: [9092],
    restart: infraRestartPolicy(),
    resources: redpandaLimits(),
  };
}

function renderRustfsService(plan: ProjectDeploymentPlan): RenderedComposeService | null {
  const storage = plan.infrastructure.objectStorage ?? { kind: 'none' };
  if (storage.kind !== 's3-compatible') return null;
  return {
    name: 'rustfs',
    logicalId: 'object-storage',
    serviceClass: 'object-storage',
    image: storage.image,
    command: 'server /data',
    env: [
      { name: 'RUSTFS_ACCESS_KEY', value: storage.credentials.accessKeyRef, secret: true },
      { name: 'RUSTFS_SECRET_KEY', value: storage.credentials.secretKeyRef, secret: true },
    ],
    ports: [9000],
    restart: infraRestartPolicy(),
    resources: rustfsLimits(),
  };
}

function renderRustfsPublicProxyService(
  plan: ProjectDeploymentPlan,
): { service: RenderedComposeService; domain: RenderedComposeDomain } | null {
  const storage = plan.infrastructure.objectStorage ?? { kind: 'none' };
  if (storage.kind !== 's3-compatible') return null;
  const service: RenderedComposeService = {
    name: 'object-storage-public',
    logicalId: 'object-storage-public',
    serviceClass: 'infrastructure-proxy',
    workloadKind: 'infrastructure-proxy',
    workloadSlug: 'object-storage-public',
    image: 'nginx:1.27-alpine',
    env: [],
    ports: [8080],
    restart: runtimeRestartPolicy(),
    resources: proxyLimits(),
    files: { '/etc/nginx/nginx.conf': rustfsProxyNginxConfig('rustfs') },
  };
  const domain = composeDomain(storage.publicBaseUrl, 'object-storage-public', 8080);
  return { service, domain };
}

function redpandaCommand(
  eventBus: Extract<ProjectDeploymentPlan['infrastructure']['eventBus'], { mode: 'provisioned' }>,
  seedTopics: readonly string[] = [],
): string {
  // Inside the project compose stack, the broker is reachable as `redpanda`
  // (the compose service name). Advertise that alias so Kafka clients follow
  // broker metadata correctly after bootstrap.
  const startArgs = [
    'redpanda start --mode=dev-container --smp=1 --memory=512M --reserve-memory=0M --overprovisioned --kafka-addr=internal://0.0.0.0:9092',
    '--advertise-kafka-addr=internal://redpanda:9092',
  ].join(' ');
  if (seedTopics.length === 0) return startArgs;
  return shellSingleQuote(
    [
      `rpk ${startArgs} & pid=$$!`,
      'until rpk cluster info --brokers redpanda:9092 >/dev/null 2>&1; do sleep 1; done',
      `rpk topic create --brokers redpanda:9092 ${seedTopics.map(shellWord).join(' ')} || true`,
      'wait "$$pid"',
    ].join('; '),
  );
}

function rustfsProxyNginxConfig(upstream: string): string {
  return [
    'events {}',
    'http {',
    '  server {',
    '    listen 8080;',
    '    client_max_body_size 0;',
    '    location = /health { return 200 "ok"; }',
    '    location / {',
    `      proxy_pass http://${upstream}:9000;`,
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
  workload: Exclude<DeploymentWorkload, { kind: 'bpmn-worker' }>,
  nginxConfig: string,
  publicAppBaseUrl: string,
): Result<RenderedDokployApplicationResource, DokployDeploymentError> {
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
                value: `mod-${authMiddleware.moduleSlug}:50051`,
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
  // Inside the project compose stack the storage container is reachable as
  // `rustfs:9000`; the plan's `internalEndpoint` carries the legacy
  // dokploy-resource hostname which does not resolve on the stack network.
  return [
    { name: 'STORAGE_S3_ENDPOINT', value: 'http://rustfs:9000', secret: false },
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
        value: 'redpanda:9092',
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
