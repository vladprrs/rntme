import type Database from 'better-sqlite3';
import type { ActorRef, EventStore } from '@rntme/event-store';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import type { CanonicalGraph } from './canonical.js';
import type { EffectSummary } from './effects.js';

export type OperationTarget =
  | Readonly<{ module: string; operation: string }>
  | Readonly<{ service: string; operation: string }>;

export type OperationEffect = 'read' | 'action';
export type OperationIdempotency = 'none' | 'optional' | 'required';

export type CorrelationCtx = Readonly<{
  commandId: string;
  correlationId: string;
  traceparent: string | null;
}>;

export type OperationRegistryEntry = Readonly<{
  id: string;
  target: OperationTarget;
  effect: OperationEffect;
  idempotency: OperationIdempotency;
  inputShape: string;
  outputShape: string;
}>;

export interface OperationRegistry {
  resolve(target: OperationTarget): OperationRegistryEntry | null;
}

export interface OperationCallClient {
  call(input: {
    target: OperationRegistryEntry;
    payload: Record<string, unknown>;
    idempotencyKey: string | null;
    correlationId: string;
  }): Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string; detail?: unknown } }
  >;
}

export type CompiledOperation = Readonly<{
  graphId: string;
  graph: CanonicalGraph;
  effects: EffectSummary;
  registryEntriesByNodeId: Readonly<Record<string, OperationRegistryEntry>>;
  resultNodeId: string;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
}>;

export type OperationExecutionContext = Readonly<{
  qsmDb: Database.Database;
  eventStore: EventStore | null;
  callClient: OperationCallClient | null;
  now: () => string;
  nextId: () => string;
  actor: ActorRef | null;
  correlation: CorrelationCtx;
  idempotencyKey: string | null;
}>;

export type OperationResult = Readonly<{
  value: unknown;
  metadata: {
    eventIds: readonly string[];
    commandId: string;
    correlationId: string;
  };
}>;
