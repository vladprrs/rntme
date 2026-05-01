import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { exampleHandlers } from '../../src/handlers.js';
import type { CommandExecutionContext } from '@rntme/runtime';

function mkCtx(): CommandExecutionContext {
  return {
    eventStore: new SqliteEventStore({ filename: ':memory:', serviceName: 'module-skeleton' }),
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

describe('exampleHandlers.echo', () => {
  it('returns the input payload verbatim wrapped in CommandExecutionResult', async () => {
    const handler = (exampleHandlers as unknown as Record<string, (ctx: CommandExecutionContext, input: unknown) => Promise<unknown>>).echo;
    if (!handler) throw new Error('echo handler missing');
    const out = await handler(mkCtx(), { message: 'hello' }) as { ok: true; value: { aggregateId: string; eventIds: string[] } } | { ok: false; error: unknown };
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.aggregateId).toBe('echo');
      expect(out.value.eventIds).toEqual([]);
    }
  });
});
