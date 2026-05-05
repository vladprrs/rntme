import type { ValidatedWorkflows } from '@rntme/workflows';
import type { ComposedProjectInput } from './composed-project.js';
import type { ProjectDeploymentConfig } from './config.js';
import type { DeploymentPlanError } from './errors.js';
import type {
  BpmnWorkerWorkload,
  PlannedEventBus,
  PlannedWorkflowEngine,
  PlannedWorkflowServiceTask,
  PlannedWorkflowSubscription,
} from './plan.js';

export function planWorkflowEngine(input: {
  readonly project: ComposedProjectInput;
  readonly config: ProjectDeploymentConfig;
  readonly eventBus: PlannedEventBus | undefined;
  readonly errors: DeploymentPlanError[];
}): { readonly engine: PlannedWorkflowEngine; readonly worker: BpmnWorkerWorkload | null } {
  const workflows = input.project.workflows;
  if (workflows === undefined || workflows === null) {
    return { engine: { kind: 'none' }, worker: null };
  }

  if (input.eventBus?.kind !== 'kafka' || input.eventBus.mode !== 'provisioned') {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_EVENT_BUS',
      message: 'workflow projects require a provisioned Kafka event bus in the MVP',
      path: 'eventBus',
    });
  }

  const workflowConfig = input.config.workflows;
  if (workflowConfig === undefined || workflowConfig.engine.kind !== 'operaton') {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
      message: 'workflow projects require provisioned Operaton config',
      path: 'workflows.engine',
    });
    return { engine: { kind: 'none' }, worker: null };
  }

  if (workflowConfig.worker.image.trim() === '') {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING',
      message: 'workflow worker image must be a non-empty string',
      path: 'workflows.worker.image',
    });
  }

  const engineResource = resourceName(input.config.orgSlug, input.project.name, 'operaton');
  const workerResource = resourceName(input.config.orgSlug, input.project.name, 'bpmn-worker');
  return {
    engine: {
      kind: 'operaton',
      mode: 'provisioned',
      resourceName: engineResource,
      internalBaseUrl: `http://${engineResource}:8080`,
      image: workflowConfig.engine.image,
    },
    worker: {
      kind: 'bpmn-worker',
      slug: 'bpmn-worker',
      resourceName: workerResource,
      image: workflowConfig.worker.image,
      workflowManifestPath: '/srv/workflows/workflows.json',
      workflowFiles: {},
      subscriptions: buildSubscriptions(workflows, input.eventBus),
      serviceTasks: buildServiceTasks(workflows),
    },
  };
}

function buildSubscriptions(
  workflows: ValidatedWorkflows,
  eventBus: PlannedEventBus | undefined,
): PlannedWorkflowSubscription[] {
  return workflows.messageStarts.map((start) => ({
    messageStartId: start.id,
    topic: workflowTopic(start.event.service, start.event.aggregateType, eventBus),
    service: start.event.service,
    aggregateType: start.event.aggregateType,
    eventType: start.event.eventType,
    processId:
      workflows.definitions.find((definition) => definition.id === start.definition)?.processId ??
      start.definition,
    messageName: start.messageName,
    businessKey: start.businessKey,
  }));
}

function buildServiceTasks(workflows: ValidatedWorkflows): PlannedWorkflowServiceTask[] {
  return workflows.serviceTasks.map((task) => ({
    definition: task.definition,
    taskId: task.taskId,
    bindingRef: task.bindingRef,
    targetService: task.bindingRef.split('.')[0] ?? '',
  }));
}

function workflowTopic(
  service: string,
  aggregateType: string,
  eventBus: PlannedEventBus | undefined,
): string {
  const suffix = `${service}.${aggregateType.toLowerCase()}`;
  if (eventBus?.kind === 'kafka' && eventBus.topicPrefix !== undefined) {
    return `${eventBus.topicPrefix}.${suffix}`;
  }
  return `rntme.${suffix}`;
}

function resourceName(orgSlug: string, projectSlug: string, workloadSlug: string): string {
  return `rntme-${orgSlug}-${projectSlug}-${workloadSlug}`;
}
