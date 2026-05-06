import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CompiledOperation,
  OperationExecutionContext,
  OperationResult,
} from '@rntme/graph-ir-compiler';
import { GraphOperationExecutor } from '../../src/plugins/executors/graph-operation-executor.js';

describe('GraphOperationExecutor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes a registered operation and returns its operation result', async () => {
    const compiler = await import('@rntme/graph-ir-compiler');
    const result: OperationResult = {
      value: { reserved: true },
      metadata: {
        eventIds: ['event-1'],
        commandId: 'cmd-1',
        correlationId: 'corr-1',
      },
    };
    const spy = vi.spyOn(compiler, 'executeOperation').mockResolvedValue(result);
    const compiled = { graphId: 'reserveStock' } as unknown as CompiledOperation;
    const ctx = {} as OperationExecutionContext;
    const executor = new GraphOperationExecutor({ reserveStock: compiled });

    const out = await executor.execute({
      operationName: 'reserveStock',
      inputs: { sku: 'SKU-1' },
      ctx,
    });

    expect(spy).toHaveBeenCalledWith(compiled, { sku: 'SKU-1' }, ctx);
    expect(out).toEqual({ ok: true, value: result });
  });

  it('returns OPERATION_NOT_FOUND for an unknown operation name', async () => {
    const executor = new GraphOperationExecutor({});

    const out = await executor.execute({
      operationName: 'missing',
      inputs: {},
      ctx: {} as OperationExecutionContext,
    });

    expect(out).toEqual({
      ok: false,
      error: {
        code: 'OPERATION_NOT_FOUND',
        message: 'operation "missing" not found',
      },
    });
  });

  it('maps thrown execution failures to OPERATION_EXECUTION_FAILED', async () => {
    const compiler = await import('@rntme/graph-ir-compiler');
    vi.spyOn(compiler, 'executeOperation').mockRejectedValue(new Error('boom'));
    const executor = new GraphOperationExecutor({
      broken: { graphId: 'broken' } as unknown as CompiledOperation,
    });

    const out = await executor.execute({
      operationName: 'broken',
      inputs: {},
      ctx: {} as OperationExecutionContext,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toEqual({
        code: 'OPERATION_EXECUTION_FAILED',
        message: 'boom',
        detail: { name: 'Error' },
      });
    }
  });
});
