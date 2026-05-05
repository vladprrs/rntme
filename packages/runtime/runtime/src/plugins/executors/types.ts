export type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
  CommandExecutorOk,
  CommandExecutorErr,
  CommandExecutorError,
  CommandExecutorErrorCode,
  CommandExecutionContext,
  CommandExecutionResult,
  CorrelationCtx,
  QueryExecutor,
  QueryExecutorInput,
  QueryExecutorOutput,
  QueryExecutorError,
  QueryExecutorErrorCode,
  QueryExecutionContext,
} from '@rntme/bindings-http/executor-contract';

import type {
  CommandExecutionContext,
  CommandExecutorOutput,
} from '@rntme/bindings-http/executor-contract';

export type ServiceLocalCommandExecutionContext = CommandExecutionContext;

export type ServiceLocalCodeCommandHandler = (
  ctx: ServiceLocalCommandExecutionContext,
  input: Record<string, unknown>,
) => Promise<CommandExecutorOutput>;

export type ServiceLocalCodeCommandHandlerMap = Record<string, ServiceLocalCodeCommandHandler>;
