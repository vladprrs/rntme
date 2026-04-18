import type { EventEnvelope } from '@rntme/event-store';

export type ReplayResult = {
  state: Record<string, unknown> | null;
  version: number;
};

export function replayAggregateState(events: readonly EventEnvelope[]): ReplayResult {
  let state: Record<string, unknown> | null = null;
  let version = 0;
  for (const ev of events) {
    const p = ev.data as { before: Record<string, unknown> | null; after: Record<string, unknown> };
    const after = p.after as Record<string, unknown>;
    version = ev.rntVersion;
    if (p.before === null) {
      state = { ...after };
    } else {
      const prev: Record<string, unknown> = state ?? {};
      state = { ...prev, ...after };
    }
  }
  return { state, version };
}
