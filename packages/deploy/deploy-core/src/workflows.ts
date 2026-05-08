import type { ValidatedWorkflows } from '@rntme/workflows';
import type { ComposedProjectInput } from './composed-project.js';
import type { ProjectDeploymentConfig } from './config.js';
import type { DeploymentPlanError } from './errors.js';
import type {
  BpmnWorkerWorkload,
  PlannedEventBus,
  PlannedWorkflowGrpcService,
  PlannedWorkflowEngine,
  PlannedWorkflowServiceTask,
  PlannedWorkflowSubscription,
  PlannedWorkflowUiAccess,
  RequiredTargetSecretRef,
} from './plan.js';

export function planWorkflowEngine(input: {
  readonly project: ComposedProjectInput;
  readonly config: ProjectDeploymentConfig;
  readonly eventBus: PlannedEventBus | undefined;
  readonly errors: DeploymentPlanError[];
  readonly requiredTargetSecrets: RequiredTargetSecretRef[];
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

  const workflowConfig = asRecord(input.config.workflows);
  const engineConfig = asRecord(workflowConfig?.engine);
  const operatonUiConfig = asRecord(workflowConfig?.operatonUi);
  const operatonUiEnabled = operatonUiConfig !== null && operatonUiConfig.enabled === true;

  if (operatonUiEnabled && (workflowConfig === null || engineConfig === null || engineConfig.kind !== 'operaton' || engineConfig.mode !== 'provisioned')) {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_UI_REQUIRES_OPERATON',
      message: 'Operaton UI access requires a workflow project with provisioned Operaton engine',
      path: 'workflows.operatonUi',
    });
  }

  if (workflowConfig === null || engineConfig === null) {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
      message: 'workflow projects require provisioned Operaton config',
      path: 'workflows.engine',
      cause: [
        {
          code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT',
          message:
            'create a workflow-ready target with `rntme target create <slug> --workflow-engine-image <operaton-image> --workflow-worker-image <worker-image> ...`, or patch the existing target with `rntme target set-config <slug> --from <patch.json>`.',
        },
      ],
    });
    return { engine: { kind: 'none' }, worker: null };
  }

  if (engineConfig.kind !== 'operaton' || engineConfig.mode !== 'provisioned') {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_UNSUPPORTED_ENGINE',
      message: 'workflow projects support only provisioned Operaton engine config',
      path: 'workflows.engine',
    });
    return { engine: { kind: 'none' }, worker: null };
  }

  const engineImage = nonEmptyString(engineConfig.image);
  if (engineImage === null) {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
      message: 'workflow projects require a non-empty Operaton image',
      path: 'workflows.engine.image',
      cause: [
        {
          code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT',
          message:
            'fix with `rntme target set-config <slug> --from <patch.json>` containing {"workflows":{"engine":{"kind":"operaton","mode":"provisioned","image":"operaton/operaton:..."}}}.',
          path: 'workflows.engine.image',
        },
      ],
    });
    return { engine: { kind: 'none' }, worker: null };
  }

  const engineResource = resourceName(input.config.orgSlug, input.project.name, 'operaton');

  const adminUserSecretRef = nonEmptyString(engineConfig.adminUserSecretRef);
  if (engineConfig.adminUserSecretRef !== undefined && adminUserSecretRef === null) {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_OPERATON_ADMIN_SECRET_MISSING',
      message: 'Operaton admin user secret ref must be a non-empty string',
      path: 'workflows.engine.adminUserSecretRef',
    });
  }

  let uiAccess: PlannedWorkflowUiAccess | undefined = undefined;
  if (operatonUiEnabled) {
    const publicBaseUrl = nonEmptyString(operatonUiConfig.publicBaseUrl);
    if (publicBaseUrl === null) {
      input.errors.push({
        code: 'DEPLOY_PLAN_WORKFLOWS_UI_PUBLIC_URL_MISSING',
        message: 'Operaton UI access requires a non-empty publicBaseUrl',
        path: 'workflows.operatonUi.publicBaseUrl',
      });
    }

    const auth = asRecord(operatonUiConfig.auth);
    const authSecretRef = nonEmptyString(auth?.secretRef);
    if (authSecretRef === null) {
      input.errors.push({
        code: 'DEPLOY_PLAN_WORKFLOWS_UI_AUTH_SECRET_MISSING',
        message: 'Operaton UI access requires a non-empty auth.secretRef',
        path: 'workflows.operatonUi.auth.secretRef',
      });
    }

    if (publicBaseUrl !== null && authSecretRef !== null) {
      uiAccess = {
        enabled: true,
        publicBaseUrl,
        authKind: 'basic',
        authSecretRef,
      };
      input.requiredTargetSecrets.push({
        kind: 'target-secret',
        secretRef: authSecretRef,
        schema: 'operaton-ui-basic-auth-v1',
        purpose: 'Operaton UI Basic Auth htpasswd',
      });
    }
  }

  const workerConfig = asRecord(workflowConfig.worker);
  const workerImage = nonEmptyString(workerConfig?.image);
  if (workerImage === null) {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING',
      message: 'workflow worker image must be a non-empty string',
      path: 'workflows.worker.image',
    });
    return {
      engine: {
        kind: 'operaton',
        mode: 'provisioned',
        resourceName: engineResource,
        internalBaseUrl: `http://${engineResource}:8080`,
        image: engineImage,
        ...(adminUserSecretRef !== null ? { adminUserSecretRef } : {}),
        ...(uiAccess !== undefined ? { uiAccess } : {}),
      },
      worker: null,
    };
  }

  const workerResource = resourceName(input.config.orgSlug, input.project.name, 'bpmn-worker');
  const workflowFiles = buildWorkflowFiles(workflows, input.project.workflowFiles, input.errors);
  return {
    engine: {
      kind: 'operaton',
      mode: 'provisioned',
      resourceName: engineResource,
      internalBaseUrl: `http://${engineResource}:8080`,
      image: engineImage,
      ...(adminUserSecretRef !== null ? { adminUserSecretRef } : {}),
      ...(uiAccess !== undefined ? { uiAccess } : {}),
    },
    worker: {
      kind: 'bpmn-worker',
      slug: 'bpmn-worker',
      resourceName: workerResource,
      image: workerImage,
      workflowManifestPath: '/srv/workflows/workflows.json',
      workflowFiles,
      subscriptions: buildSubscriptions(workflows, input.eventBus),
      serviceTasks: buildServiceTasks(workflows, input.project, input.config, input.errors),
      grpcServices: buildGrpcServices(workflows, input.project, input.errors),
    },
  };
}

function buildGrpcServices(
  workflows: ValidatedWorkflows,
  project: ComposedProjectInput,
  errors: DeploymentPlanError[],
): Readonly<Record<string, PlannedWorkflowGrpcService>> {
  const serviceSlugs = new Set(
    workflows.serviceTasks
      .map((task) => task.bindingRef.split('.')[0] ?? '')
      .filter((service) => service.length > 0),
  );
  const out: Record<string, PlannedWorkflowGrpcService> = {};
  for (const service of [...serviceSlugs].sort()) {
    const config = project.workflowGrpcServices?.[service];
    if (config === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_PROTO_UNAVAILABLE',
        message: `workflow service tasks target service "${service}" without generated gRPC proto config`,
        path: `workflows.serviceTasks.${workflows.serviceTasks.findIndex((task) => task.bindingRef.startsWith(`${service}.`))}.bindingRef`,
        service,
      });
      continue;
    }
    out[service] = {
      packageName: config.packageName,
      serviceName: config.serviceName,
      protoSource: config.protoSource,
    };
  }
  return out;
}

function buildWorkflowFiles(
  workflows: ValidatedWorkflows,
  providedFiles: Readonly<Record<string, string>> | undefined,
  errors: DeploymentPlanError[],
): Readonly<Record<string, string>> {
  const files: Record<string, string> = {
    'workflows.json': `${JSON.stringify(workflows, null, 2)}\n`,
  };

  for (const [idx, definition] of workflows.definitions.entries()) {
    const content = providedFiles?.[definition.bpmnFile];
    if (content === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_WORKFLOW_FILE_MISSING',
        message: `workflow definition "${definition.id}" references missing BPMN file "${definition.bpmnFile}"`,
        path: `workflows.definitions.${idx}.bpmnFile`,
      });
      continue;
    }
    files[definition.bpmnFile] = content;
  }

  return files;
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

function buildServiceTasks(
  workflows: ValidatedWorkflows,
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  errors: DeploymentPlanError[],
): PlannedWorkflowServiceTask[] {
  return workflows.serviceTasks.map((task, idx) => {
    const targetService = task.bindingRef.split('.')[0] ?? '';
    const service = project.services[targetService];
    const grpcEndpoint = `${resourceName(config.orgSlug, project.name, targetService)}:50051`;
    if (service === undefined || service.kind !== 'domain') {
      errors.push({
        code: 'DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_UNAVAILABLE',
        message: `workflow service task "${task.taskId}" targets service "${targetService}" without a domain gRPC endpoint`,
        path: `workflows.serviceTasks.${idx}.bindingRef`,
        service: targetService,
      });
    }
    return {
      definition: task.definition,
      taskId: task.taskId,
      bindingRef: task.bindingRef,
      targetService,
      grpcEndpoint,
    };
  });
}

function workflowTopic(
  service: string,
  aggregateType: string,
  eventBus: PlannedEventBus | undefined,
): string {
  const suffix = `${service.toLowerCase()}.${aggregateType.toLowerCase()}`;
  const prefix =
    eventBus?.kind === 'kafka' ? normalizeTopicPrefix(eventBus.topicPrefix) : null;
  return prefix === null ? `rntme.${suffix}` : `${prefix}.${suffix}`;
}

function normalizeTopicPrefix(topicPrefix: string | null | undefined): string | null {
  if (topicPrefix === null || topicPrefix === undefined) return null;
  const trimmed = topicPrefix.trim().replace(/^\.+|\.+$/g, '');
  return trimmed === '' ? null : trimmed;
}

function resourceName(orgSlug: string, projectSlug: string, workloadSlug: string): string {
  return `rntme-${orgSlug}-${projectSlug}-${workloadSlug}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
