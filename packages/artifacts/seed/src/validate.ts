import { randomUUID } from 'node:crypto';
import type { EventTypeSpec, PdmResolver } from '@rntme/pdm';
import type { EventEnvelope } from '@rntme/event-store';
import type {
  Result,
  SeedArtifact,
  SeedError,
  SeedEventInput,
  ValidatedSeed,
} from './types.js';
import { wrapPayloads } from './wrap-payloads.js';

export type ValidateCtx = Readonly<{
  pdm: PdmResolver;
  events: readonly EventTypeSpec[];
  serviceName: string;
}>;

export function validateSeed(
  artifact: SeedArtifact,
  ctx: ValidateCtx,
): Result<ValidatedSeed> {
  if (!ctx.serviceName || ctx.serviceName.length === 0) {
    return {
      ok: false,
      errors: [
        {
          code: 'SEED_SYNTAX_INVALID',
          message: 'validateSeed: ctx.serviceName is required',
        },
      ],
    };
  }

  const errors: SeedError[] = [];
  const eventByType = new Map(ctx.events.map((e) => [e.eventType, e]));
  const normalized: EventEnvelope[] = [];
  // Stable per-artifact correlation id: every event missing `correlationId`
  // shares this value.
  const seedCorrelationId = `seed:${randomUUID()}`;

  for (let i = 0; i < artifact.events.length; i++) {
    const ev = artifact.events[i]!;
    const path = `events[${i}]`;

    const entity = ctx.pdm.resolveEntity(ev.rntAggregateType);
    if (!entity) {
      errors.push({
        code: 'SEED_UNKNOWN_AGGREGATE_TYPE',
        message: `rntAggregateType "${ev.rntAggregateType}" is not defined in PDM.`,
        path,
        details: { rntAggregateType: ev.rntAggregateType },
      });
      continue;
    }

    const eventSpec = eventByType.get(ev.eventType);
    if (!eventSpec) {
      errors.push({
        code: 'SEED_UNKNOWN_EVENT_TYPE',
        message: `eventType "${ev.eventType}" is not derived from PDM state machines.`,
        path,
        details: { eventType: ev.eventType, rntAggregateType: ev.rntAggregateType },
      });
      continue;
    }
    if (eventSpec.aggregateType !== ev.rntAggregateType) {
      errors.push({
        code: 'SEED_UNKNOWN_EVENT_TYPE',
        message: `eventType "${ev.eventType}" belongs to aggregateType "${eventSpec.aggregateType}", not "${ev.rntAggregateType}".`,
        path,
      });
      continue;
    }

    const payloadErrors = checkPayloadShape(ev, eventSpec, path);
    errors.push(...payloadErrors);

    const actorErrors = checkActor(ev, path);
    errors.push(...actorErrors);

    if (payloadErrors.length === 0 && actorErrors.length === 0) {
      normalized.push(normalize(ev, ctx.serviceName, seedCorrelationId));
    }
  }

  const invariantErrors = checkIntraFileInvariants(artifact.events);
  errors.push(...invariantErrors);

  const smErrors = simulateStateMachines(artifact.events, ctx);
  errors.push(...smErrors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { events: wrapPayloads(normalized, ctx) } };
}

function checkPayloadShape(
  ev: SeedEventInput,
  spec: EventTypeSpec,
  path: string,
): SeedError[] {
  const errors: SeedError[] = [];
  const allowed = new Set(Object.keys(spec.payloadFields));
  const actual = new Set(Object.keys(ev.data));

  for (const field of allowed) {
    if (!actual.has(field)) {
      const ps = spec.payloadFields[field]!;
      if (!ps.nullable) {
        errors.push({
          code: 'SEED_EVENT_PAYLOAD_MISMATCH',
          message: `data missing required field "${field}" for eventType "${ev.eventType}".`,
          path: `${path}.data.${field}`,
          details: { field, eventType: ev.eventType },
        });
      }
    }
  }
  for (const field of actual) {
    if (!allowed.has(field)) {
      errors.push({
        code: 'SEED_EVENT_PAYLOAD_MISMATCH',
        message: `data has unexpected field "${field}" for eventType "${ev.eventType}".`,
        path: `${path}.data.${field}`,
        details: { field, eventType: ev.eventType },
      });
    }
  }
  for (const field of actual) {
    if (!allowed.has(field)) continue;
    const fs = spec.payloadFields[field]!;
    const v = ev.data[field];
    if (v === null && !fs.nullable) {
      errors.push({
        code: 'SEED_EVENT_PAYLOAD_MISMATCH',
        message: `data field "${field}" is null but PDM declares it non-nullable.`,
        path: `${path}.data.${field}`,
        details: { field, eventType: ev.eventType },
      });
      continue;
    }
    if (v === null) continue;
    if (!matchesType(v, fs.type)) {
      errors.push({
        code: 'SEED_EVENT_PAYLOAD_MISMATCH',
        message: `data field "${field}" has wrong JSON type for PDM type "${fs.type}".`,
        path: `${path}.data.${field}`,
        details: {
          field,
          eventType: ev.eventType,
          expected: fs.type,
          actual: typeof v,
        },
      });
    }
  }
  return errors;
}

function matchesType(
  v: unknown,
  t: 'integer' | 'boolean' | 'decimal' | 'string' | 'date' | 'datetime',
): boolean {
  switch (t) {
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v);
    case 'boolean':
      return typeof v === 'boolean';
    case 'decimal':
      return typeof v === 'number';
    case 'string':
    case 'date':
    case 'datetime':
      return typeof v === 'string';
  }
}

function checkActor(ev: SeedEventInput, path: string): SeedError[] {
  const kind = ev.rntActorKind ?? null;
  const id = ev.rntActorId ?? null;
  if (kind === null && id === null) return [];
  if (kind === 'user' && (id === null || id.length === 0)) {
    return [
      {
        code: 'SEED_ACTOR_REQUIRED',
        message: `rntActorKind "user" requires non-empty rntActorId.`,
        path: `${path}.rntActorId`,
      },
    ];
  }
  return [];
}

function simulateStateMachines(
  events: readonly SeedEventInput[],
  ctx: ValidateCtx,
): SeedError[] {
  const errors: SeedError[] = [];
  const bySubject = new Map<string, { input: SeedEventInput; index: number }[]>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const arr = bySubject.get(e.subject) ?? [];
    arr.push({ input: e, index: i });
    bySubject.set(e.subject, arr);
  }

  for (const [subject, list] of bySubject) {
    list.sort((a, b) => a.input.rntVersion - b.input.rntVersion);
    let current: string | null = null;
    for (let k = 0; k < list.length; k++) {
      const { input, index } = list[k]!;
      const path = `events[${index}]`;
      const sm = ctx.pdm.resolveStateMachine(input.rntAggregateType);
      if (!sm) continue;
      const spec = ctx.events.find(
        (e) => e.eventType === input.eventType && e.aggregateType === input.rntAggregateType,
      );
      if (!spec) continue;
      if (k === 0 && !spec.isCreation) {
        errors.push({
          code: 'SEED_FIRST_EVENT_NOT_CREATION',
          message: `First event of subject "${subject}" must be a creation transition (from: null); got "${input.eventType}".`,
          path,
          details: { subject, eventType: input.eventType },
        });
        break;
      }
      const from = spec.from;
      if (!from.includes(current)) {
        errors.push({
          code: 'SEED_STATE_MACHINE_VIOLATION',
          message: `Event "${input.eventType}" on subject "${subject}" at v${input.rntVersion} requires from-state ${JSON.stringify(from)}; current state is ${current === null ? 'null' : `"${current}"`}.`,
          path,
          details: {
            subject,
            eventType: input.eventType,
            requiredFrom: JSON.stringify([...from]),
            actualFrom: current ?? 'null',
            version: String(input.rntVersion),
          },
        });
        break;
      }
      current = spec.to;
    }
  }
  return errors;
}

function checkIntraFileInvariants(events: readonly SeedEventInput[]): SeedError[] {
  const errors: SeedError[] = [];

  // Duplicate (subject, rntVersion)
  const seen = new Map<string, number>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const key = `${e.subject}@v${e.rntVersion}`;
    const prior = seen.get(key);
    if (prior !== undefined) {
      errors.push({
        code: 'SEED_STREAM_VERSION_DUPLICATE',
        message: `Duplicate (subject="${e.subject}", rntVersion=${e.rntVersion}) at events[${i}] — first seen at events[${prior}].`,
        path: `events[${i}]`,
        details: { subject: e.subject, version: String(e.rntVersion), firstIndex: String(prior) },
      });
    } else {
      seen.set(key, i);
    }
  }

  // Per-subject contiguous versions starting at 1
  const bySubject = new Map<string, number[]>();
  for (const e of events) {
    const arr = bySubject.get(e.subject) ?? [];
    arr.push(e.rntVersion);
    bySubject.set(e.subject, arr);
  }
  for (const [subject, versions] of bySubject) {
    const sortedUnique = [...new Set(versions)].sort((a, b) => a - b);
    let expected = 1;
    for (const v of sortedUnique) {
      if (v !== expected) {
        errors.push({
          code: 'SEED_STREAM_VERSION_GAP',
          message: `Subject "${subject}" must have contiguous versions starting at 1; got gap at v${v} (expected v${expected}).`,
          details: { subject, expected: String(expected), got: String(v) },
        });
        break;
      }
      expected++;
    }
  }

  // Duplicate id
  const idSeen = new Map<string, number>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const prior = idSeen.get(e.id);
    if (prior !== undefined) {
      errors.push({
        code: 'SEED_EVENT_ID_DUPLICATE',
        message: `Duplicate id "${e.id}" at events[${i}] (first seen at events[${prior}]).`,
        path: `events[${i}]`,
        details: { id: e.id, firstIndex: String(prior) },
      });
    } else {
      idSeen.set(e.id, i);
    }
  }

  return errors;
}

function normalize(
  ev: SeedEventInput,
  serviceName: string,
  seedCorrelationId: string,
): EventEnvelope {
  const rntSchemaVersion = ev.rntSchemaVersion ?? 1;
  // Actor defaults: when neither kind nor id is provided, treat as seed system actor.
  let rntActorKind: 'user' | 'system' | 'service' | null;
  let rntActorId: string | null;
  if (ev.rntActorKind == null && ev.rntActorId == null) {
    rntActorKind = 'system';
    rntActorId = 'seed';
  } else {
    rntActorKind = ev.rntActorKind ?? null;
    rntActorId = ev.rntActorId ?? null;
  }

  return {
    id: ev.id,
    source: `rntme://${serviceName}/${ev.rntAggregateType}`,
    eventType: ev.eventType,
    type: `${serviceName}.${ev.rntAggregateType}.${ev.eventType}`,
    time: ev.time,
    subject: ev.subject,
    dataContentType: 'application/json',
    dataSchema: `rntme://schemas/${serviceName}/${ev.eventType}.v${rntSchemaVersion}.json`,
    data: ev.data,
    correlationId: ev.correlationId ?? seedCorrelationId,
    causationId: ev.causationId ?? null,
    commandId: ev.commandId ?? null,
    rntAggregateType: ev.rntAggregateType,
    rntAggregateId: ev.rntAggregateId,
    rntVersion: ev.rntVersion,
    rntSchemaVersion,
    rntActorKind,
    rntActorId,
    traceparent: ev.traceparent ?? null,
  };
}
