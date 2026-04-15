import type { EventEnvelope } from '@rntme/event-store';

export type SeedArtifact = Readonly<{
  seedVersion: 1;
  events: readonly SeedEventInput[];
}>;

export type SeedEventInput = Readonly<{
  stream: string;
  aggregateType: string;
  aggregateId: string;
  version: number;
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: string;
  eventId?: string;
  actor?: { kind: string; id: string };
  schemaVersion?: number;
}>;

export type ValidatedSeed = Readonly<{
  events: readonly EventEnvelope[];
}>;

export type SeedErrorCode =
  | 'SEED_SYNTAX_INVALID'
  | 'SEED_SYNTAX_UNKNOWN_FIELD'
  | 'SEED_UNKNOWN_AGGREGATE_TYPE'
  | 'SEED_UNKNOWN_EVENT_TYPE'
  | 'SEED_EVENT_PAYLOAD_MISMATCH'
  | 'SEED_STATE_MACHINE_VIOLATION'
  | 'SEED_ACTOR_REQUIRED'
  | 'SEED_STREAM_VERSION_GAP'
  | 'SEED_STREAM_VERSION_DUPLICATE'
  | 'SEED_FIRST_EVENT_NOT_CREATION'
  | 'SEED_EVENT_ID_DUPLICATE'
  | 'SEED_STORE_NOT_EMPTY'
  | 'SEED_STREAM_VERSION_CONFLICT'
  | 'SEED_APPLY_IO';

export type SeedError = Readonly<{
  code: SeedErrorCode;
  message: string;
  path?: string;
  details?: Readonly<Record<string, string>>;
}>;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: readonly SeedError[] };

export type ApplyMode = 'strict' | 'upsertByEventId';

export type ApplyResult = Readonly<{
  appliedCount: number;
  skippedCount: number;
}>;
