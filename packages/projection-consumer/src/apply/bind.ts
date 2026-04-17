import type { EventEnvelope } from '@rntme/event-store';
import type { CompiledHandler, ColumnBinding } from '../types/apply.js';

/** Resolve each binding to a concrete SQL param value, in order. */
export function bindValues(handler: CompiledHandler, envelope: EventEnvelope): unknown[] {
  const appliedAt = new Date().toISOString();
  const values: unknown[] = [];
  const after = getAfter(envelope);
  for (const b of handler.bindings) {
    values.push(resolveBinding(b, envelope, after, appliedAt));
  }
  return values;
}

function resolveBinding(
  b: ColumnBinding,
  envelope: EventEnvelope,
  after: Record<string, unknown>,
  appliedAt: string,
): unknown {
  switch (b.kind) {
    case 'aggregateId':
      return b.sqlType === 'INTEGER' ? Number(envelope.rntAggregateId) : envelope.rntAggregateId;
    case 'payloadField':
      return after[b.fieldName] ?? null;
    case 'generatedOccurred':
      return envelope.time;
    case 'generatedActor':
      return envelope.rntActorId;
    case 'nullable':
      return null;
    case 'literalString':
      return b.value;
    case 'eventId':
      return envelope.id;
    case 'eventVersion':
      return envelope.rntVersion;
    case 'appliedAt':
      return appliedAt;
  }
}

function getAfter(envelope: EventEnvelope): Record<string, unknown> {
  const p = envelope.data;
  if (p === null || typeof p !== 'object' || Array.isArray(p)) return {};
  const rec = p as Record<string, unknown>;
  const inner = rec.after;
  if (inner !== undefined && inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  const { before: _before, ...rest } = rec;
  return rest;
}
