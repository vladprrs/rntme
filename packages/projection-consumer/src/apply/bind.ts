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
      return b.sqlType === 'INTEGER' ? Number(envelope.aggregateId) : envelope.aggregateId;
    case 'payloadField':
      return after[b.fieldName] ?? null;
    case 'generatedOccurred':
      return envelope.occurredAt;
    case 'generatedActor':
      return envelope.actor?.id ?? null;
    case 'nullable':
      return null;
    case 'eventId':
      return envelope.eventId;
    case 'eventVersion':
      return envelope.version;
    case 'appliedAt':
      return appliedAt;
  }
}

function getAfter(envelope: EventEnvelope): Record<string, unknown> {
  const p = envelope.payload as { after?: Record<string, unknown> } | null;
  return (p && typeof p === 'object' && p.after) ? p.after : {};
}
