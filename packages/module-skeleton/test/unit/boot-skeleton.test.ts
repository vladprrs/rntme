import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { CodeCommandExecutor } from '@rntme/runtime';
import { exampleHandlers } from '../../src/handlers.js';
import type { CommandExecutionContext } from '@rntme/runtime';

function mkCtx(): CommandExecutionContext {
  return {
    eventStore: new SqliteEventStore({ filename: ':memory:', serviceName: 'boot-test' }),
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

describe('module-skeleton boot wiring', () => {
  it('CodeCommandExecutor successfully runs exampleHandlers.echo', async () => {
    const exec = new CodeCommandExecutor(exampleHandlers);
    const out = await exec.execute({ commandName: 'echo', inputs: { m: 1 }, ctx: mkCtx() });
    expect(out.ok).toBe(true);
  });

  it('CodeCommandExecutor returns COMMAND_NOT_FOUND for a command missing from exampleHandlers', async () => {
    const exec = new CodeCommandExecutor(exampleHandlers);
    const out = await exec.execute({ commandName: 'missing', inputs: {}, ctx: mkCtx() });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('COMMAND_NOT_FOUND');
  });
});
