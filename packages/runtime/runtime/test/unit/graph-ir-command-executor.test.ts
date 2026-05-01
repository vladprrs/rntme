import { describe, it, expect, vi } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { CommandExecutionError } from '@rntme/graph-ir-compiler';
import type { CompiledCommand } from '@rntme/graph-ir-compiler';
import { GraphIrCommandExecutor } from '../../src/plugins/executors/graph-ir-command-executor.js';
import type { CommandExecutionContext } from '../../src/plugins/executors/types.js';

function mkCtx(): CommandExecutionContext {
  const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test' });
  let idc = 0;
  return {
    eventStore: store,
    qsmDb: null,
    now: () => '2026-04-19T00:00:00.000Z',
    nextId: () => `id-${++idc}`,
    actor: null,
    correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
  };
}

function mkCompiled(): CompiledCommand {
  return {
    graphId: 'noop-graph',
    aggregate: 'A',
    paramOrder: ['id'],
    optionalParams: [],
    paramDefaults: {},
    readPrelude: null,
    readPreludeGuardNodeId: null,
    emits: [
      {
        nodeId: 'emit-1',
        eventType: 'NoopHappened',
        aggregate: 'A',
        aggregateIdExpr: { $param: 'id' },
        transition: 'create',
        affects: ['status'],
        payloadExprs: { status: { $literal: 'done' } },
        isCreation: true,
        isSelfLoop: false,
        fromStates: [null],
        toState: 'done',
      },
    ],
  };
}

describe('GraphIrCommandExecutor', () => {
  it('executes a known command and returns success', async () => {
    const executor = new GraphIrCommandExecutor({ noopCmd: mkCompiled() });
    const out = await executor.execute({
      commandName: 'noopCmd',
      inputs: { id: 'A-1' },
      ctx: mkCtx(),
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.aggregateId).toBe('A-1');
      expect(out.value.version).toBe(1);
      expect(out.value.eventIds).toHaveLength(1);
    }
  });

  it('returns COMMAND_NOT_FOUND for an unknown command name', async () => {
    const executor = new GraphIrCommandExecutor({});
    const out = await executor.execute({
      commandName: 'missing',
      inputs: {},
      ctx: mkCtx(),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_NOT_FOUND');
      expect(out.error.message).toContain('missing');
    }
  });

  it('returns COMMAND_HANDLER_THREW when underlying executeCommand throws a non-CommandExecutionError', async () => {
    const brokenCompiled = { readPrelude: null, readPreludeGuardNodeId: null, emits: [] } as unknown as CompiledCommand;
    const executor = new GraphIrCommandExecutor({ broken: brokenCompiled });
    const out = await executor.execute({
      commandName: 'broken',
      inputs: { id: 'A-1' },
      ctx: mkCtx(),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_HANDLER_THREW');
      expect(out.error.message).toContain('no emits');
    }
  });

  it('returns COMMAND_CONCURRENCY_CONFLICT when executeCommand throws with that code', async () => {
    const compiled = mkCompiled();
    const executor = new GraphIrCommandExecutor({ cmd: compiled });
    const ctx = mkCtx();

    // Seed the aggregate so version is 1
    await executor.execute({ commandName: 'cmd', inputs: { id: 'agg-1' }, ctx });

    // Force a concurrency conflict by mocking executeCommand directly.
    const spy = vi.spyOn(await import('@rntme/graph-ir-compiler'), 'executeCommand').mockImplementation(() => {
      throw new CommandExecutionError('COMMAND_CONCURRENCY_CONFLICT', 'version mismatch', { expected: 0, actual: 1 });
    });

    const out = await executor.execute({ commandName: 'cmd', inputs: { id: 'agg-1' }, ctx });
    spy.mockRestore();

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_CONCURRENCY_CONFLICT');
      expect(out.error.message).toContain('version mismatch');
      expect(out.error.detail).toEqual({ expected: 0, actual: 1 });
    }
  });

  it('returns COMMAND_GUARD_REJECTED when executeCommand throws with that code', async () => {
    const compiled = mkCompiled();
    const executor = new GraphIrCommandExecutor({ cmd: compiled });
    const ctx = mkCtx();

    const spy = vi.spyOn(await import('@rntme/graph-ir-compiler'), 'executeCommand').mockImplementation(() => {
      throw new CommandExecutionError('COMMAND_GUARD_REJECTED', 'guard failed', { nodeId: 'n1' });
    });

    const out = await executor.execute({ commandName: 'cmd', inputs: { id: 'agg-1' }, ctx });
    spy.mockRestore();

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_GUARD_REJECTED');
      expect(out.error.message).toContain('guard failed');
      expect(out.error.detail).toEqual({ nodeId: 'n1' });
    }
  });

  it('propagates detail for COMMAND_CONCURRENCY_CONFLICT and COMMAND_GUARD_REJECTED', async () => {
    const compiled = mkCompiled();
    const executor = new GraphIrCommandExecutor({ cmd: compiled });
    const ctx = mkCtx();

    const spy = vi.spyOn(await import('@rntme/graph-ir-compiler'), 'executeCommand').mockImplementation(() => {
      throw new CommandExecutionError('COMMAND_CONCURRENCY_CONFLICT', 'conflict', { subject: 'A-1', expected: 2, actual: 3 });
    });

    const out = await executor.execute({ commandName: 'cmd', inputs: { id: 'A-1' }, ctx });
    spy.mockRestore();

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('COMMAND_CONCURRENCY_CONFLICT');
      expect(out.error.detail).toEqual({ subject: 'A-1', expected: 2, actual: 3 });
    }
  });
});
