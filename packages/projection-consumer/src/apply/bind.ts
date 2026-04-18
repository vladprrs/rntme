import type { EventEnvelope } from '@rntme/event-store';
import type { MirrorHandler, ColumnBinding } from '../types/apply.js';

/** Resolve each binding to a concrete SQL param value, in order. */
export function bindValues(handler: MirrorHandler, envelope: EventEnvelope): unknown[] {
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
      return b.sqlType === 'INTEGER' ? Number(envelope.aggregateId) : envelope.aggregateId;
    case 'payloadField':
      return after[b.fieldName] ?? null;
    case 'generatedOccurred':
      return envelope.occurredAt;
    case 'generatedActor':
      return envelope.actor?.id ?? null;
    case 'nullable':
      return null;
    case 'literalString':
      return b.value;
    case 'eventId':
      return envelope.eventId;
    case 'eventVersion':
      return envelope.version;
    case 'appliedAt':
      return appliedAt;
  }
}

function getAfter(envelope: EventEnvelope): Record<string, unknown> {
  const p = envelope.payload;
  if (p === null || typeof p !== 'object' || Array.isArray(p)) return {};
  const rec = p as Record<string, unknown>;
  const inner = rec.after;
  if (inner !== undefined && inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  const { before: _before, ...rest } = rec;
  return rest;
}
