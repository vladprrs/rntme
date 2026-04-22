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
    const out = await exampleHandlers.echo(mkCtx(), { message: 'hello' });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.aggregateId).toBe('echo');
      expect(out.value.eventIds).toEqual([]);
    }
  });
});
