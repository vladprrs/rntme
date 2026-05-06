import type {
  PlannedWorkflowSubscriptionInput,
  WorkerConfig,
  WorkflowGrpcServiceRegistry,
  WorkflowServiceEndpointMap,
} from './types.js';

export function loadWorkerConfigFromEnv(env: Record<string, string | undefined> = process.env): WorkerConfig {
  const brokers = required(env, 'RNTME_EVENT_BUS_BROKERS')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (brokers.length === 0) throw new Error('BPMN_WORKER_ENV_INVALID: RNTME_EVENT_BUS_BROKERS');
  return {
    eventBusBrokers: brokers,
    eventBusProtocol: protocol(env['RNTME_EVENT_BUS_PROTOCOL'] ?? 'plaintext'),
    ...(env['RNTME_EVENT_BUS_TOPIC_PREFIX'] ? { topicPrefix: env['RNTME_EVENT_BUS_TOPIC_PREFIX'] } : {}),
    operatonBaseUrl: normalizeOperatonBaseUrl(required(env, 'RNTME_OPERATON_BASE_URL')),
    workflowsManifestPath: required(env, 'RNTME_WORKFLOWS_MANIFEST_PATH'),
    workflowServiceEndpoints: jsonRecord<WorkflowServiceEndpointMap>(
      env['RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON'] ?? '{}',
      'RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON',
    ),
    workflowGrpcServices: jsonRecord<WorkflowGrpcServiceRegistry>(
      env['RNTME_WORKFLOW_GRPC_SERVICES_JSON'] ?? '{}',
      'RNTME_WORKFLOW_GRPC_SERVICES_JSON',
    ),
    workflowSubscriptions: jsonArray(
      env['RNTME_WORKFLOW_SUBSCRIPTIONS_JSON'] ?? '[]',
      'RNTME_WORKFLOW_SUBSCRIPTIONS_JSON',
    ),
  };
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`BPMN_WORKER_ENV_MISSING: ${name}`);
  return value;
}

function protocol(value: string): 'plaintext' | 'sasl_ssl' {
  if (value === 'plaintext' || value === 'sasl_ssl') return value;
  throw new Error(`BPMN_WORKER_ENV_INVALID: RNTME_EVENT_BUS_PROTOCOL=${value}`);
}

function jsonRecord<T extends Record<string, unknown>>(value: string, name: string): T {
  const parsed = JSON.parse(value) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`BPMN_WORKER_ENV_INVALID: ${name}`);
  }
  return parsed as T;
}

function jsonArray(value: string, name: string): PlannedWorkflowSubscriptionInput[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`BPMN_WORKER_ENV_INVALID: ${name}`);
  return parsed as PlannedWorkflowSubscriptionInput[];
}

function normalizeOperatonBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.endsWith('/engine-rest') ? trimmed : `${trimmed}/engine-rest`;
}
