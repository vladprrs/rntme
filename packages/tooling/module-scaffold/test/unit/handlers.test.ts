import { describe, it, expect } from 'bun:test';
import type { CommandExecutionContext } from '@rntme/contracts-handlers-v1';
import { exampleHandlers } from '../../src/handlers.js';

function mkCtx(): CommandExecutionContext {
  return {
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

describe('exampleHandlers.echo', () => {
  it('propagates correlation ids into the CommandExecutorOutput envelope', async () => {
    const handler = exampleHandlers.echo;
    if (!handler) throw new Error('echo handler missing');
    const out = await handler(mkCtx(), { message: 'hello' });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.aggregateId).toBe('echo');
      expect(out.value.eventIds).toEqual([]);
      expect(out.value.commandId).toBe('cmd-1');
      expect(out.value.correlationId).toBe('corr-1');
    }
  });
});
