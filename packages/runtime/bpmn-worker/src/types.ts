import type { WorkflowArtifact } from '@rntme/workflows';

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
};

export type LoadedWorkerManifest = WorkflowArtifact;

export type CommandMetadata = {
  readonly commandId: string;
  readonly correlationId: string;
  readonly causationId: string;
};
