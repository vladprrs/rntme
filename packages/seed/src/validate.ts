import type { EventTypeSpec, PdmResolver } from '@rntme/pdm';
import type { ActorRef, EventEnvelope } from '@rntme/event-store';
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
}>;

export function validateSeed(
  artifact: SeedArtifact,
  ctx: ValidateCtx,
): Result<ValidatedSeed> {
  const errors: SeedError[] = [];
  const eventByType = new Map(ctx.events.map((e) => [e.eventType, e]));
  const normalized: EventEnvelope[] = [];

  for (let i = 0; i < artifact.events.length; i++) {
    const ev = artifact.events[i]!;
    const path = `events[${i}]`;

    const entity = ctx.pdm.resolveEntity(ev.aggregateType);
    if (!entity) {
      errors.push({
        code: 'SEED_UNKNOWN_AGGREGATE_TYPE',
        message: `aggregateType "${ev.aggregateType}" is not defined in PDM.`,
        path,
        details: { aggregateType: ev.aggregateType },
      });
      continue;
    }

    const eventSpec = eventByType.get(ev.eventType);
    if (!eventSpec) {
      errors.push({
        code: 'SEED_UNKNOWN_EVENT_TYPE',
        message: `eventType "${ev.eventType}" is not derived from PDM state machines.`,
        path,
        details: { eventType: ev.eventType, aggregateType: ev.aggregateType },
      });
      continue;
    }
    if (eventSpec.aggregateType !== ev.aggregateType) {
      errors.push({
        code: 'SEED_UNKNOWN_EVENT_TYPE',
        message: `eventType "${ev.eventType}" belongs to aggregateType "${eventSpec.aggregateType}", not "${ev.aggregateType}".`,
        path,
      });
      continue;
    }

    const payloadErrors = checkPayloadShape(ev, eventSpec, path);
    errors.push(...payloadErrors);

    const actorErrors = checkActor(ev, path);
    errors.push(...actorErrors);

    if (payloadErrors.length === 0 && actorErrors.length === 0) {
      normalized.push(normalize(ev));
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
  const actual = new Set(Object.keys(ev.payload));

  for (const field of allowed) {
    if (!actual.has(field)) {
      const ps = spec.payloadFields[field]!;
      if (!ps.nullable) {
        errors.push({
          code: 'SEED_EVENT_PAYLOAD_MISMATCH',
          message: `payload missing required field "${field}" for eventType "${ev.eventType}".`,
          path: `${path}.payload.${field}`,
          details: { field, eventType: ev.eventType },
        });
      }
    }
  }
  for (const field of actual) {
    if (!allowed.has(field)) {
      errors.push({
        code: 'SEED_EVENT_PAYLOAD_MISMATCH',
        message: `payload has unexpected field "${field}" for eventType "${ev.eventType}".`,
        path: `${path}.payload.${field}`,
        details: { field, eventType: ev.eventType },
      });
    }
  }
  for (const field of actual) {
    if (!allowed.has(field)) continue;
    const fs = spec.payloadFields[field]!;
    const v = ev.payload[field];
    if (v === null && !fs.nullable) {
      errors.push({
        code: 'SEED_EVENT_PAYLOAD_MISMATCH',
        message: `payload field "${field}" is null but PDM declares it non-nullable.`,
        path: `${path}.payload.${field}`,
        details: { field, eventType: ev.eventType },
      });
      continue;
    }
    if (v === null) continue;
    if (!matchesType(v, fs.type)) {
      errors.push({
        code: 'SEED_EVENT_PAYLOAD_MISMATCH',
        message: `payload field "${field}" has wrong JSON type for PDM type "${fs.type}".`,
        path: `${path}.payload.${field}`,
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
  if (!ev.actor) return [];
  if (ev.actor.kind === 'user' && (ev.actor.id === undefined || ev.actor.id.length === 0)) {
    return [
      {
        code: 'SEED_ACTOR_REQUIRED',
        message: `actor.kind "user" requires non-empty id.`,
        path: `${path}.actor.id`,
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
  const byStream = new Map<string, { input: SeedEventInput; index: number }[]>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const arr = byStream.get(e.stream) ?? [];
    arr.push({ input: e, index: i });
    byStream.set(e.stream, arr);
  }

  for (const [stream, list] of byStream) {
    list.sort((a, b) => a.input.version - b.input.version);
    let current: string | null = null;
    for (let k = 0; k < list.length; k++) {
      const { input, index } = list[k]!;
      const path = `events[${index}]`;
      const sm = ctx.pdm.resolveStateMachine(input.aggregateType);
      if (!sm) continue;
      const spec = ctx.events.find(
        (e) => e.eventType === input.eventType && e.aggregateType === input.aggregateType,
      );
      if (!spec) continue;
      if (k === 0 && !spec.isCreation) {
        errors.push({
          code: 'SEED_FIRST_EVENT_NOT_CREATION',
          message: `First event of stream "${stream}" must be a creation transition (from: null); got "${input.eventType}".`,
          path,
          details: { stream, eventType: input.eventType },
        });
        break;
      }
      const from = spec.from;
      if (!from.includes(current)) {
        errors.push({
          code: 'SEED_STATE_MACHINE_VIOLATION',
          message: `Event "${input.eventType}" on stream "${stream}" at v${input.version} requires from-state ${JSON.stringify(from)}; current state is ${current === null ? 'null' : `"${current}"`}.`,
          path,
          details: {
            stream,
            eventType: input.eventType,
            requiredFrom: JSON.stringify([...from]),
            actualFrom: current ?? 'null',
            version: String(input.version),
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

  // Duplicate (stream, version)
  const seen = new Map<string, number>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const key = `${e.stream}@v${e.version}`;
    const prior = seen.get(key);
    if (prior !== undefined) {
      errors.push({
        code: 'SEED_STREAM_VERSION_DUPLICATE',
        message: `Duplicate (stream="${e.stream}", version=${e.version}) at events[${i}] — first seen at events[${prior}].`,
        path: `events[${i}]`,
        details: { stream: e.stream, version: String(e.version), firstIndex: String(prior) },
      });
    } else {
      seen.set(key, i);
    }
  }

  // Per-stream contiguous versions starting at 1
  const byStream = new Map<string, number[]>();
  for (const e of events) {
    const arr = byStream.get(e.stream) ?? [];
    arr.push(e.version);
    byStream.set(e.stream, arr);
  }
  for (const [stream, versions] of byStream) {
    const sortedUnique = [...new Set(versions)].sort((a, b) => a - b);
    let expected = 1;
    for (const v of sortedUnique) {
      if (v !== expected) {
        errors.push({
          code: 'SEED_STREAM_VERSION_GAP',
          message: `Stream "${stream}" must have contiguous versions starting at 1; got gap at v${v} (expected v${expected}).`,
          details: { stream, expected: String(expected), got: String(v) },
        });
        break;
      }
      expected++;
    }
  }

  // Duplicate eventId (including defaulted)
  const eventIdSeen = new Map<string, number>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const id = e.eventId ?? `seed:${e.aggregateType}:${e.aggregateId}:v${e.version}`;
    const prior = eventIdSeen.get(id);
    if (prior !== undefined) {
      errors.push({
        code: 'SEED_EVENT_ID_DUPLICATE',
        message: `Duplicate eventId "${id}" at events[${i}] (first seen at events[${prior}]).`,
        path: `events[${i}]`,
        details: { eventId: id, firstIndex: String(prior) },
      });
    } else {
      eventIdSeen.set(id, i);
    }
  }

  return errors;
}

function normalize(ev: SeedEventInput): EventEnvelope {
  const actor: ActorRef | null =
    ev.actor != null ? (ev.actor as ActorRef) : { kind: 'system', id: 'seed' };
  return {
    eventId: ev.eventId ?? `seed:${ev.aggregateType}:${ev.aggregateId}:v${ev.version}`,
    eventType: ev.eventType,
    aggregateType: ev.aggregateType,
    aggregateId: ev.aggregateId,
    stream: ev.stream,
    version: ev.version,
    occurredAt: ev.occurredAt,
    actor,
    payload: ev.payload,
    schemaVersion: ev.schemaVersion ?? 1,
  };
}
