import type { OperationExecutionContext, OperationResult } from '@rntme/graph-ir-compiler';

export type OperationExecutorError = Readonly<{
  code: string;
  message: string;
  detail?: unknown;
}>;

export type OperationExecutorOutput =
  | Readonly<{ ok: true; value: OperationResult }>
  | Readonly<{ ok: false; error: OperationExecutorError }>;

export type OperationExecutorInput = Readonly<{
  operationName: string;
  inputs: Record<string, unknown>;
  ctx: OperationExecutionContext;
}>;

export interface OperationExecutor {
  execute(input: OperationExecutorInput): Promise<OperationExecutorOutput>;
}
