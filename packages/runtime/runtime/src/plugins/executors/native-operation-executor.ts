import type { OperationExecutionContext } from '@rntme/graph-ir-compiler';
import type {
  OperationExecutor,
  OperationExecutorInput,
  OperationExecutorOutput,
} from '@rntme/bindings-http/operation-contract';

export type NativeOperationHandler = (
  inputs: Record<string, unknown>,
  ctx: OperationExecutionContext,
) => Promise<unknown> | unknown;

export type NativeOperationHandlerMap = Record<string, NativeOperationHandler>;

export class NativeOperationExecutor implements OperationExecutor {
  constructor(
    private readonly handlers: NativeOperationHandlerMap,
    private readonly fallback: OperationExecutor,
  ) {}

  async execute(input: OperationExecutorInput): Promise<OperationExecutorOutput> {
    const handler = this.handlers[input.operationName];
    if (handler === undefined) {
      return this.fallback.execute(input);
    }

    try {
      const value = await handler(input.inputs, input.ctx);
      return {
        ok: true,
        value: {
          value,
          metadata: {
            eventIds: [],
            commandId: input.ctx.correlation.commandId,
            correlationId: input.ctx.correlation.correlationId,
          },
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'OPERATION_EXECUTION_FAILED',
          message: err instanceof Error ? err.message : String(err),
          detail: err instanceof Error ? { name: err.name } : undefined,
        },
      };
    }
  }
}
