import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { CodeCommandExecutor } from '../../src/plugins/executors/code-command-executor.js';
import type { CommandExecutionContext } from '../../src/plugins/executors/types.js';
import type { ServiceLocalCodeCommandHandler } from '../../src/plugins/executors/index.js';

function mkCtx(): CommandExecutionContext {
  return {
    eventStore: new SqliteEventStore({ filename: ':memory:', serviceName: 'test' }),
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => 'id-1',
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

describe('CodeCommandExecutor', () => {
  it('calls the registered handler and returns success', async () => {
    const executor = new CodeCommandExecutor({
      echo: async (_ctx, input) => ({
        ok: true,
        value: {
          aggregateId: String(input.id),
          version: 1,
          eventIds: ['id-1'],
          commandId: 'cmd-1',
          correlationId: 'corr-1',
        },
      }),
    });
    const out = await executor.execute({ commandName: 'echo', inputs: { id: 'X-1' }, ctx: mkCtx() });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.aggregateId).toBe('X-1');
  });

  it('returns COMMAND_NOT_FOUND for unknown handler', async () => {
    const executor = new CodeCommandExecutor({});
    const out = await executor.execute({ commandName: 'nope', inputs: {}, ctx: mkCtx() });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('COMMAND_NOT_FOUND');
  });

  it('converts handler throws into COMMAND_HANDLER_THREW', async () => {
    const executor = new CodeCommandExecutor({
      boom: async () => {
        throw new Error('kaboom');
      },
    });
    const out = await executor.execute({ commandName: 'boom', inputs: {}, ctx: mkCtx() });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_HANDLER_THREW');
      expect(out.error.message).toContain('kaboom');
    }
  });

  it('passes through handler-returned errors', async () => {
    const executor = new CodeCommandExecutor({
      reject: async () => ({ ok: false, error: { code: 'COMMAND_HANDLER_ERROR', message: 'invalid price' } }),
    });
    const out = await executor.execute({ commandName: 'reject', inputs: {}, ctx: mkCtx() });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_HANDLER_ERROR');
      expect(out.error.message).toBe('invalid price');
    }
  });

  it('types service-local handlers against the runtime-rich context', async () => {
    const handler: ServiceLocalCodeCommandHandler = async (ctx, input) => {
      expect(ctx.eventStore).toBeDefined();
      expect(ctx.actor).toBeNull();
      return {
        ok: true,
        value: {
          aggregateId: String(input.id),
          version: 0,
          eventIds: [],
          commandId: ctx.correlation.commandId,
          correlationId: ctx.correlation.correlationId,
          result: { hasEventStore: ctx.eventStore !== undefined },
        },
      };
    };
    const executor = new CodeCommandExecutor({ rich: handler });

    const out = await executor.execute({ commandName: 'rich', inputs: { id: 'X-1' }, ctx: mkCtx() });

    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.result).toEqual({ hasEventStore: true });
  });
});
