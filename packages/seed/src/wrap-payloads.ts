import type { EventEnvelope } from '@rntme/event-store';
import type { ValidateCtx } from './validate.js';

/**
 * Transforms flat seed-event payloads into the `{ before, after }` envelope
 * format that `replayAggregateState()` expects. Creation events get
 * `before: null`; non-creation events get `before` populated from
 * accumulated per-stream state. Already-wrapped payloads are passed through.
 */
export function wrapPayloads(
  envelopes: readonly EventEnvelope[],
  ctx: ValidateCtx,
): EventEnvelope[] {
  const eventByType = new Map(ctx.events.map((e) => [e.eventType, e]));
  const streamState = new Map<string, Record<string, unknown>>();

  return envelopes.map((ev) => {
    if (isAlreadyWrapped(ev.payload)) return ev;

    const spec = eventByType.get(ev.eventType);
    if (!spec) return ev; // unknown event type — pass through (validate already caught it)

    const sm = ctx.pdm.resolveStateMachine(spec.aggregateType);
    const stateField = sm?.stateField ?? 'status';
    const flat = ev.payload as Record<string, unknown>;

    if (spec.isCreation) {
      const after: Record<string, unknown> = { ...flat, [stateField]: spec.to };
      streamState.set(ev.stream, { ...after });
      return { ...ev, payload: { before: null, after } };
    }

    const currentState = streamState.get(ev.stream) ?? {};
    const before: Record<string, unknown> = {};
    for (const field of spec.affects) {
      before[field] = currentState[field] ?? null;
    }
    const after: Record<string, unknown> = { ...flat };
    const merged = { ...currentState, ...after };
    streamState.set(ev.stream, merged);
    return { ...ev, payload: { before, after } };
  });
}

function isAlreadyWrapped(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return 'after' in p && 'before' in p && Object.keys(p).length === 2;
}
