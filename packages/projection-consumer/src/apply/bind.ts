import type { EventEnvelope } from '@rntme/event-store';
import type { DerivedColumnBinding } from '@rntme/graph-ir-compiler';
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

/**
 * Resolve one `DerivedColumnBinding` (from graph-ir-compiler's event-delta
 * lowering) against a concrete envelope at delta-apply time.
 *
 * `literal` and `exprScalar` bindings are never bound here: literals are
 * inlined into the emitted SQL by the lowering, and `exprScalar` is
 * decomposed at compile time into its nested bindings before reaching this
 * function. Both kinds throw if they slip through, so a hole in the lowering
 * shows up as a clear runtime error rather than a silent `undefined` param.
 */
export function bindDerivedValue(
  binding: DerivedColumnBinding,
  envelope: EventEnvelope,
): unknown {
  switch (binding.kind) {
    case 'aggregateId':
      return binding.sqlType === 'INTEGER'
        ? Number(envelope.aggregateId)
        : String(envelope.aggregateId);
    case 'payloadField': {
      const after = getAfter(envelope);
      const v = after[binding.fieldName];
      return v === undefined ? null : v;
    }
    case 'eventOccurredAt':
      return envelope.occurredAt ?? null;
    case 'eventActorId':
      return envelope.actor?.id ?? null;
    case 'eventId':
      return envelope.eventId;
    case 'appliedAt':
      return new Date().toISOString();
    case 'literal':
      throw new Error('literal DerivedColumnBinding is embedded in SQL, not bound at runtime');
    case 'exprScalar':
      throw new Error('exprScalar DerivedColumnBinding is decomposed at compile time');
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
