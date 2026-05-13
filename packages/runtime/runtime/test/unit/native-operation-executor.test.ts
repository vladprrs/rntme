import { describe, expect, it } from 'bun:test';
import type { OperationExecutionContext } from '@rntme/graph-ir-compiler';
import type {
  OperationExecutor,
  OperationExecutorInput,
  OperationExecutorOutput,
} from '@rntme/bindings-http/operation-contract';
import { NativeOperationExecutor } from '../../src/plugins/executors/native-operation-executor.js';

function makeCtx(overrides: Partial<{ commandId: string; correlationId: string }> = {}): OperationExecutionContext {
  return {
    correlation: {
      commandId: overrides.commandId ?? 'cmd-1',
      correlationId: overrides.correlationId ?? 'corr-1',
      traceparent: null,
    },
  } as unknown as OperationExecutionContext;
}

class RecordingFallback implements OperationExecutor {
  public calls: OperationExecutorInput[] = [];
  constructor(private readonly out: OperationExecutorOutput) {}
  async execute(input: OperationExecutorInput): Promise<OperationExecutorOutput> {
    this.calls.push(input);
    return this.out;
  }
}

describe('NativeOperationExecutor', () => {
  it('invokes the matching native handler and wraps the value', async () => {
    const fallback = new RecordingFallback({
      ok: false,
      error: { code: 'OPERATION_NOT_FOUND', message: 'should not be called' },
    });
    const executor = new NativeOperationExecutor(
      {
        publishProjectBundle: async (inputs, ctx) => {
          expect(inputs).toEqual({ projectId: 'p-1' });
          expect(ctx.correlation.commandId).toBe('cmd-2');
          return { seq: 7 };
        },
      },
      fallback,
    );

    const out = await executor.execute({
      operationName: 'publishProjectBundle',
      inputs: { projectId: 'p-1' },
      ctx: makeCtx({ commandId: 'cmd-2', correlationId: 'corr-2' }),
    });

    expect(out).toEqual({
      ok: true,
      value: {
        value: { seq: 7 },
        metadata: {
          eventIds: [],
          commandId: 'cmd-2',
          correlationId: 'corr-2',
        },
      },
    });
    expect(fallback.calls).toEqual([]);
  });

  it('delegates to fallback executor when operation name is unknown', async () => {
    const fallbackOut: OperationExecutorOutput = {
      ok: true,
      value: {
        value: { ok: 'fallback' },
        metadata: { eventIds: [], commandId: 'cmd-1', correlationId: 'corr-1' },
      },
    };
    const fallback = new RecordingFallback(fallbackOut);
    const executor = new NativeOperationExecutor({}, fallback);

    const input: OperationExecutorInput = {
      operationName: 'graphOnlyOp',
      inputs: { x: 1 },
      ctx: makeCtx(),
    };
    const out = await executor.execute(input);

    expect(out).toEqual(fallbackOut);
    expect(fallback.calls.length).toBe(1);
    expect(fallback.calls[0]).toEqual(input);
  });

  it('returns NATIVE_OPERATION_HANDLER_MISSING for declared native ops without a handler', async () => {
    const fallback = new RecordingFallback({
      ok: false,
      error: { code: 'OPERATION_NOT_FOUND', message: 'should not be called' },
    });
    const executor = new NativeOperationExecutor(
      {},
      fallback,
      new Set(['publishProjectBundle']),
    );

    const out = await executor.execute({
      operationName: 'publishProjectBundle',
      inputs: {},
      ctx: makeCtx(),
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('NATIVE_OPERATION_HANDLER_MISSING');
      expect(out.error.message).toContain('publishProjectBundle');
    }
    expect(fallback.calls).toEqual([]);
  });

  it('maps untyped thrown handler errors to OPERATION_EXECUTION_FAILED', async () => {
    const fallback = new RecordingFallback({
      ok: false,
      error: { code: 'OPERATION_NOT_FOUND', message: 'unused' },
    });
    const executor = new NativeOperationExecutor(
      {
        boom: () => {
          throw new Error('handler exploded');
        },
      },
      fallback,
    );

    const out = await executor.execute({
      operationName: 'boom',
      inputs: {},
      ctx: makeCtx(),
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('OPERATION_EXECUTION_FAILED');
      expect(out.error.message).toBe('handler exploded');
      expect(out.error.detail).toEqual({ name: 'Error' });
    }
    expect(fallback.calls).toEqual([]);
  });

  it('preserves a typed string `.code` on thrown Error and surfaces it as error.code', async () => {
    const fallback = new RecordingFallback({
      ok: false,
      error: { code: 'OPERATION_NOT_FOUND', message: 'unused' },
    });
    const executor = new NativeOperationExecutor(
      {
        boom: () => {
          throw Object.assign(new Error('invalid token'), { code: 'PLATFORM_AUTH_INVALID' });
        },
      },
      fallback,
    );

    const out = await executor.execute({
      operationName: 'boom',
      inputs: {},
      ctx: makeCtx(),
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe('PLATFORM_AUTH_INVALID');
      expect(out.error.message).toBe('invalid token');
      expect(out.error.detail).toEqual({ name: 'Error' });
    }
    expect(fallback.calls).toEqual([]);
  });
});
