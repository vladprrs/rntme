import type { EventEnvelope } from '@rntme/event-store';
import type { ValidateCtx } from './validate.js';

/**
 * Transforms flat seed-event `data` payloads into the `{ before, after }`
 * envelope format that `replayAggregateState()` expects. Creation events get
 * `before: null`; non-creation events get `before` populated from
 * accumulated per-subject state. Already-wrapped payloads are passed through.
 */
export function wrapPayloads(
  envelopes: readonly EventEnvelope[],
  ctx: ValidateCtx,
): EventEnvelope[] {
  const eventByType = new Map(ctx.events.map((e) => [e.eventType, e]));
  const subjectState = new Map<string, Record<string, unknown>>();

  return envelopes.map((ev) => {
    if (isAlreadyWrapped(ev.data)) return ev;

    const spec = eventByType.get(ev.eventType);
    if (!spec) return ev; // unknown event type — pass through (validate already caught it)

    const sm = ctx.pdm.resolveStateMachine(spec.aggregateType);
    const stateField = sm?.stateField ?? 'status';
    const flat = ev.data as Record<string, unknown>;

    if (spec.isCreation) {
      const after: Record<string, unknown> = { ...flat, [stateField]: spec.to };
      subjectState.set(ev.subject, { ...after });
      return { ...ev, data: { before: null, after } };
    }

    const currentState = subjectState.get(ev.subject) ?? {};
    const before: Record<string, unknown> = {};
    for (const field of spec.affects) {
      before[field] = currentState[field] ?? null;
    }
    const after: Record<string, unknown> = { ...flat };
    const merged = { ...currentState, ...after };
    subjectState.set(ev.subject, merged);
    return { ...ev, data: { before, after } };
  });
}

function isAlreadyWrapped(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const p = data as Record<string, unknown>;
  return 'after' in p && 'before' in p && Object.keys(p).length === 2;
}
