import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import { dokployLabels } from './names.js';
import type {
  RenderedDokployApplicationResource,
  RenderedDokployComposeResource,
  RenderedEnvVar,
} from './render.js';

type BpmnWorkerWorkload = Extract<ProjectDeploymentPlan['workloads'][number], { kind: 'bpmn-worker' }>;

export function renderOperatonCompose(plan: ProjectDeploymentPlan): RenderedDokployComposeResource | null {
  const engine = plan.infrastructure.workflowEngine;
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
): RenderedDokployApplicationResource {
  const engine = plan.infrastructure.workflowEngine;

  return {
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
        value: engine.kind === 'operaton' ? engine.internalBaseUrl : '',
        secret: false,
      },
      {
        name: 'RNTME_WORKFLOWS_MANIFEST_PATH',
        value: workload.workflowManifestPath,
        secret: false,
      },
    ],
    labels: dokployLabels(
      plan.project.orgSlug,
      plan.project.projectSlug,
      plan.project.environment,
      workload.slug,
    ),
    files: workflowFileMounts(workload.workflowFiles),
  };
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

function workflowFileMounts(files: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(files).map(([path, content]) => [`/srv/workflows/${path.replace(/^\/+/, '')}`, content]),
  );
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
