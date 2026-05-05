import type { WorkflowArtifact } from '@rntme/workflows';

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
};

export type LoadedWorkerManifest = WorkflowArtifact;

export type CommandMetadata = {
  readonly commandId: string;
  readonly correlationId: string;
  readonly causationId: string;
};
