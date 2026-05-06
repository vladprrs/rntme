import type { WorkflowArtifact, WorkflowEventRef } from '@rntme/workflows';

export type WorkflowServiceEndpointMap = Readonly<Record<string, string>>;

export type WorkflowGrpcServiceConfig = {
  readonly packageName: string;
  readonly serviceName: string;
  readonly protoSource: string;
};

export type WorkflowGrpcServiceRegistry = Readonly<Record<string, WorkflowGrpcServiceConfig>>;

export type EventEnvelopeLike = {
  readonly id?: string;
  readonly eventId?: string;
  readonly type?: string;
  readonly correlationId?: string;
  readonly correlationid?: string;
  readonly data?: unknown;
};

export type WorkerConfig = {
  readonly eventBusBrokers: readonly string[];
  readonly eventBusProtocol: 'plaintext' | 'sasl_ssl';
  readonly topicPrefix?: string;
  readonly operatonBaseUrl: string;
  readonly workflowsManifestPath: string;
  readonly workflowServiceEndpoints?: WorkflowServiceEndpointMap;
  readonly workflowGrpcServices?: WorkflowGrpcServiceRegistry;
  readonly workflowSubscriptions: readonly PlannedWorkflowSubscriptionInput[];
};

export type LoadedWorkerManifest = WorkflowArtifact;

export type PlannedWorkflowSubscriptionInput = {
  readonly messageStartId: string;
  readonly topic: string;
  readonly service: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly processId: string;
  readonly messageName: string;
  readonly businessKey: string;
};

export type WorkflowEventConsumer = {
  readonly events: () => AsyncIterable<{
    readonly envelope: EventEnvelopeLike;
    readonly eventRef: WorkflowEventRef;
    readonly commit: () => Promise<void>;
  }>;
  readonly stop: () => Promise<void>;
};

export type CommandMetadata = {
  readonly commandId: string;
  readonly correlationId: string;
  readonly causationId: string;
};
