import {
  executeOperation,
  type CompiledOperation,
  type OperationExecutionContext,
  type OperationResult,
} from '@rntme/graph-ir-compiler';
import type {
  OperationExecutor,
  OperationExecutorInput,
  OperationExecutorOutput,
} from '@rntme/bindings-http/operation-contract';

export type GraphOperationMap = Record<string, CompiledOperation>;

export class GraphOperationExecutor implements OperationExecutor {
  constructor(private readonly operations: GraphOperationMap) {}

  async execute(input: OperationExecutorInput): Promise<OperationExecutorOutput> {
    const compiled = this.operations[input.operationName];
    if (compiled === undefined) {
      return {
        ok: false,
        error: { code: 'OPERATION_NOT_FOUND', message: `operation "${input.operationName}" not found` },
      };
    }

    try {
      const value: OperationResult = await executeOperation(
        compiled,
        input.inputs,
        input.ctx as OperationExecutionContext,
      );
      return { ok: true, value };
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
