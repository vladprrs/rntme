import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import type { DokployDeploymentError } from './errors.js';
import { dokployLabels } from './names.js';
import { err, ok, type Result } from './result.js';
import type {
  RenderedDokployApplicationResource,
  RenderedDokployComposeResource,
  RenderedEnvVar,
} from './render.js';

type BpmnWorkerWorkload = Extract<ProjectDeploymentPlan['workloads'][number], { kind: 'bpmn-worker' }>;
type WorkflowEngine = NonNullable<ProjectDeploymentPlan['infrastructure']['workflowEngine']>;

export function renderOperatonCompose(plan: ProjectDeploymentPlan): RenderedDokployComposeResource | null {
  const engine = workflowEngine(plan);
  if (engine.kind === 'none') return null;

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
        value: workflowServiceEndpointsJson(workload),
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

function workflowServiceEndpointsJson(workload: BpmnWorkerWorkload): string {
  const endpoints = Object.fromEntries(
    [...workload.serviceTasks]
      .sort((a, b) => a.bindingRef.localeCompare(b.bindingRef))
      .map((task) => [task.bindingRef, grpcEndpoint(task)]),
  );
  return JSON.stringify(endpoints);
}

function grpcEndpoint(task: BpmnWorkerWorkload['serviceTasks'][number]): string {
  return 'grpcEndpoint' in task && typeof task.grpcEndpoint === 'string' ? task.grpcEndpoint : '';
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
    '      - default',
    '      - dokploy-network',
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
