import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import {
  infraRestartPolicy,
  operatonLimits,
  proxyLimits,
  runtimeLimits,
  runtimeRestartPolicy,
  type RenderedComposeService,
} from './compose-model.js';
import type { DokployDeploymentError } from './errors.js';
import { dokployLabels } from './names.js';
import { err, ok, type Result } from './result.js';
import type {
  RenderedDokployApplicationResource,
  RenderedDokployComposeResource,
  RenderedEnvVar,
  RenderedSecretFileRef,
} from './render.js';

type BpmnWorkerWorkload = Extract<ProjectDeploymentPlan['workloads'][number], { kind: 'bpmn-worker' }>;
type WorkflowEngine = NonNullable<ProjectDeploymentPlan['infrastructure']['workflowEngine']>;

export function renderOperatonCompose(plan: ProjectDeploymentPlan): RenderedDokployComposeResource | null {
  const engine = workflowEngine(plan);
  if (engine.kind === 'none') return null;

  const secretFiles: Record<string, RenderedSecretFileRef> | undefined =
    engine.adminUserSecretRef !== undefined
      ? {
          '/operaton/configuration/application.yaml': {
            schema: 'operaton-admin-user-v1',
            secretRef: engine.adminUserSecretRef,
            field: 'applicationYaml',
          },
        }
      : undefined;

  return {
    logicalId: 'workflow-engine',
    kind: 'compose',
    infrastructureKind: 'workflow-engine',
    name: engine.resourceName,
    image: engine.image,
    composeFile: operatonComposeFile(engine),
    env: [],
    labels: {
      ...dokployLabels(
        plan.project.orgSlug,
        plan.project.projectSlug,
        plan.project.environment,
        'workflow-engine',
      ),
      'rntme.infrastructure': 'workflow-engine',
      'rntme.provider': 'operaton',
    },
    ...(secretFiles !== undefined ? { secretFiles } : {}),
  };
}

export function renderOperatonService(plan: ProjectDeploymentPlan): RenderedComposeService | null {
  const engine = workflowEngine(plan);
  if (engine.kind === 'none') return null;
  return {
    name: 'operaton',
    logicalId: 'workflow-engine',
    serviceClass: 'workflow-engine',
    image: engine.image,
    env: [],
    ports: [8080],
    restart: infraRestartPolicy(),
    resources: operatonLimits(),
    ...(engine.adminUserSecretRef === undefined
      ? {}
      : {
          secretFiles: {
            '/operaton/configuration/application.yaml': {
              schema: 'operaton-admin-user-v1',
              secretRef: engine.adminUserSecretRef,
              field: 'applicationYaml',
            },
          },
        }),
  };
}

export function renderBpmnWorkerService(
  plan: ProjectDeploymentPlan,
  workload: BpmnWorkerWorkload,
): Result<RenderedComposeService, DokployDeploymentError> {
  const rendered = renderBpmnWorker(plan, workload);
  if (!rendered.ok) return rendered;
  return ok({
    name: 'bpmn-worker',
    logicalId: rendered.value.logicalId,
    serviceClass: 'bpmn-worker',
    workloadKind: 'bpmn-worker',
    workloadSlug: rendered.value.workloadSlug ?? rendered.value.logicalId,
    image: rendered.value.image,
    env: rendered.value.env.map((entry) =>
      entry.name === 'RNTME_OPERATON_BASE_URL'
        ? { ...entry, value: 'http://operaton:8080' }
        : entry,
    ),
    ...(rendered.value.files === undefined ? {} : { files: rendered.value.files }),
    restart: runtimeRestartPolicy(),
    resources: runtimeLimits(),
  });
}

export function renderOperatonUiGatewayService(
  plan: ProjectDeploymentPlan,
): RenderedComposeService | null {
  const engine = workflowEngine(plan);
  if (engine.kind !== 'operaton' || engine.uiAccess === undefined) return null;
  const nginxConfig = renderOperatonUiNginxConfig('operaton');
  return {
    name: 'operaton-ui-gateway',
    logicalId: 'operaton-ui-gateway',
    serviceClass: 'infrastructure-proxy',
    workloadKind: 'infrastructure-proxy',
    workloadSlug: 'operaton-ui-gateway',
    image: 'nginx:1.27-alpine',
    env: [],
    ports: [8080],
    restart: runtimeRestartPolicy(),
    resources: proxyLimits(),
    files: { '/etc/nginx/nginx.conf': nginxConfig },
    secretFiles: {
      '/etc/nginx/.htpasswd': {
        schema: 'operaton-ui-basic-auth-v1',
        secretRef: engine.uiAccess.authSecretRef,
        field: 'htpasswd',
      },
    },
  };
}

export function renderBpmnWorker(
  plan: ProjectDeploymentPlan,
  workload: BpmnWorkerWorkload,
): Result<RenderedDokployApplicationResource, DokployDeploymentError> {
  const engine = workflowEngine(plan);
  if (engine.kind !== 'operaton') {
    return err([
      {
        code: 'DEPLOY_RENDER_DOKPLOY_BPMN_WORKER_REQUIRES_OPERATON',
        message: `BPMN worker "${workload.slug}" requires a provisioned Operaton workflow engine`,
        resource: workload.resourceName,
        path: `workloads.${workload.slug}`,
      },
    ]);
  }

  const files = workflowFileMounts(workload);
  if (!files.ok) return files;
  const serviceEndpoints = workflowServiceEndpointsJson(plan, workload);
  if (!serviceEndpoints.ok) return serviceEndpoints;

  return ok({
    logicalId: workload.slug,
    kind: 'application',
    workloadKind: workload.kind,
    workloadSlug: workload.slug,
    name: workload.resourceName,
    image: workload.image,
    env: [
      ...workerEventBusEnv(plan.infrastructure.eventBus),
      {
        name: 'RNTME_OPERATON_BASE_URL',
        value: engine.internalBaseUrl,
        secret: false,
      },
      {
        name: 'RNTME_WORKFLOWS_MANIFEST_PATH',
        value: workload.workflowManifestPath,
        secret: false,
      },
      {
        name: 'RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON',
        value: serviceEndpoints.value,
        secret: false,
      },
      {
        name: 'RNTME_WORKFLOW_SUBSCRIPTIONS_JSON',
        value: JSON.stringify([...workload.subscriptions].sort((a, b) => a.messageStartId.localeCompare(b.messageStartId))),
        secret: false,
      },
      {
        name: 'RNTME_WORKFLOW_GRPC_SERVICES_JSON',
        value: JSON.stringify(Object.fromEntries(Object.entries(workload.grpcServices).sort(([a], [b]) => a.localeCompare(b)))),
        secret: false,
      },
    ],
    labels: dokployLabels(
      plan.project.orgSlug,
      plan.project.projectSlug,
      plan.project.environment,
      workload.slug,
    ),
    files: files.value,
  });
}

function workflowServiceEndpointsJson(
  plan: ProjectDeploymentPlan,
  workload: BpmnWorkerWorkload,
): Result<string, DokployDeploymentError> {
  const domainServiceEndpoints = new Map(
    plan.workloads
      .filter((candidate) => candidate.kind === 'domain-service')
      .map((candidate) => [
        candidate.slug,
        `svc-${normalizeComposePart(candidate.slug)}:50051`,
      ]),
  );

  const endpoints: Record<string, string> = {};
  for (const [idx, task] of [...workload.serviceTasks].entries()) {
    const targetService = typeof task.targetService === 'string' ? task.targetService.trim() : '';
    const endpoint = targetService === '' ? undefined : domainServiceEndpoints.get(targetService);
    if (endpoint === undefined) {
      return err([
        {
          code: 'DEPLOY_RENDER_DOKPLOY_WORKFLOW_SERVICE_ENDPOINT_UNAVAILABLE',
          message: `BPMN service task "${task.taskId}" targets service "${targetService}" without a rendered domain-service gRPC endpoint`,
          resource: workload.resourceName,
          path: `workloads.${workload.slug}.serviceTasks.${idx}.targetService`,
          service: targetService,
        },
      ]);
    }
    endpoints[task.bindingRef] = endpoint;
  }

  return ok(JSON.stringify(Object.fromEntries(Object.entries(endpoints).sort(([a], [b]) => a.localeCompare(b)))));
}

function normalizeComposePart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length === 0 ? 'unknown' : normalized;
}

function workflowEngine(plan: ProjectDeploymentPlan): WorkflowEngine {
  return plan.infrastructure.workflowEngine ?? { kind: 'none' };
}

function operatonComposeFile(
  engine: Extract<ProjectDeploymentPlan['infrastructure']['workflowEngine'], { kind: 'operaton' }>,
): string {
  return [
    'services:',
    '  operaton:',
    `    image: ${engine.image}`,
    '    networks:',
    '      default:',
    '      dokploy-network:',
    '        aliases:',
    `          - ${engine.resourceName}`,
    'networks:',
    '  dokploy-network:',
    '    external: true',
    '',
  ].join('\n');
}

function workflowFileMounts(
  workload: BpmnWorkerWorkload,
): Result<Readonly<Record<string, string>>, DokployDeploymentError> {
  const mounts: Record<string, string> = {};
  for (const [path, content] of Object.entries(workload.workflowFiles).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isSafeWorkflowFilePath(path)) {
      return err([
        {
          code: 'DEPLOY_RENDER_DOKPLOY_INVALID_WORKFLOW_FILE_PATH',
          message: `workflow file path "${path}" must be a relative path below /srv/workflows without empty, dot, parent, absolute, backslash, or URL-scheme segments`,
          resource: workload.resourceName,
          path: `workloads.${workload.slug}.workflowFiles.${path}`,
        },
      ]);
    }
    mounts[`/srv/workflows/${path}`] = content;
  }
  if (!Object.hasOwn(mounts, workload.workflowManifestPath)) {
    return err([
      {
        code: 'DEPLOY_RENDER_DOKPLOY_WORKFLOW_MANIFEST_FILE_MISSING',
        message: `workflow files must include manifest mount "${workload.workflowManifestPath}"`,
        resource: workload.resourceName,
        path: `workloads.${workload.slug}.workflowFiles`,
      },
    ]);
  }
  return ok(mounts);
}

function isSafeWorkflowFilePath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function workerEventBusEnv(eventBus: ProjectDeploymentPlan['infrastructure']['eventBus']): RenderedEnvVar[] {
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

export function renderOperatonUiGateway(
  plan: ProjectDeploymentPlan,
): RenderedDokployApplicationResource | null {
  const engine = workflowEngine(plan);
  if (engine.kind !== 'operaton' || engine.uiAccess === undefined) return null;

  const name = `${engine.resourceName}-ui-gateway`;
  const nginxConfig = renderOperatonUiNginxConfig(engine.resourceName);

  return {
    logicalId: 'operaton-ui-gateway',
    kind: 'application',
    workloadKind: 'infrastructure-proxy',
    workloadSlug: 'operaton-ui-gateway',
    infrastructureKind: 'operaton-ui-gateway',
    name,
    image: 'nginx:1.27-alpine',
    env: [],
    labels: dokployLabels(
      plan.project.orgSlug,
      plan.project.projectSlug,
      plan.project.environment,
      'operaton-ui-gateway',
    ),
    ports: [{ containerPort: 8080, protocol: 'http' as const }],
    ingress: {
      publicBaseUrl: engine.uiAccess.publicBaseUrl,
      containerPort: 8080,
      healthPath: '/health' as const,
      routes: [],
    },
    files: {
      '/etc/nginx/nginx.conf': nginxConfig,
    },
    secretFiles: {
      '/etc/nginx/.htpasswd': {
        schema: 'operaton-ui-basic-auth-v1',
        secretRef: engine.uiAccess.authSecretRef,
        field: 'htpasswd',
      },
    },
  };
}

function renderOperatonUiNginxConfig(engineResourceName: string): string {
  return [
    'events {}',
    'http {',
    '  server {',
    '    listen 8080;',
    '    location = /health { return 200 "ok\\n"; }',
    '    location / {',
    '      auth_basic "rntme Operaton";',
    '      auth_basic_user_file /etc/nginx/.htpasswd;',
    `      proxy_pass http://${engineResourceName}:8080;`,
    '      proxy_set_header Host $host;',
    '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}
