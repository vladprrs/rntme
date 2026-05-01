import type { EventEnvelope } from '@rntme/event-store';

export type SeedArtifact = Readonly<{
  seedVersion: 1;
  events: readonly SeedEventInput[];
}>;

/**
 * Author-facing seed event shape (CloudEvents partial — derived fields omitted).
 *
 * Derived fields populated during validation from the service name:
 *   source       = `rntme://${serviceName}/${rntAggregateType}`
 *   type         = `${serviceName}.${rntAggregateType}.${eventType}`
 *   dataSchema   = `rntme://schemas/${serviceName}/${eventType}.v${rntSchemaVersion}.json`
 *   dataContentType = 'application/json'
 *
 * `correlationId` is optional; when absent, `validateSeed` stamps a stable
 * `seed:<uuid>` value for the whole artifact (shared across all events).
 */
export type SeedEventInput = Readonly<{
  id: string;
  eventType: string;
  rntAggregateType: string;
  rntAggregateId: string;
  subject: string;
  rntVersion: number;
  time: string;
  data: Readonly<Record<string, unknown>>;
  rntSchemaVersion?: number;
  rntActorKind?: 'user' | 'system' | 'service' | null;
  rntActorId?: string | null;
  correlationId?: string;
  causationId?: string | null;
  commandId?: string | null;
  traceparent?: string | null;
}>;

export type ValidatedSeed = Readonly<{
  events: readonly EventEnvelope[];
}>;

/**
 * Error codes are stable API (see CLAUDE.md). Codes carrying the legacy word
 * "STREAM" are kept intact; their messages now refer to "subject" internally.
 */
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
