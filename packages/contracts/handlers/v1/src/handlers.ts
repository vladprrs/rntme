// Module-facing minimal shape of a command-handler invocation.
// Runtime may pass a richer ctx; modules see only the fields below.
// Drift is pinned by the type-test in test/unit/runtime-compat.test.ts.

export type CorrelationCtx = Readonly<{
  commandId: string;
  correlationId: string;
  traceparent: string | null;
}>;

export type CommandExecutionContext = Readonly<{
  now: () => string;
  nextId: () => string;
  correlation: CorrelationCtx;
}>;

export type CommandExecutionResult = Readonly<{
  aggregateId: string;
  version: number;
  eventIds: readonly string[];
  commandId: string;
  correlationId: string;
  result?: unknown;
}>;

export type CommandExecutorErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_GUARD_REJECTED'
  | 'COMMAND_CONCURRENCY_CONFLICT'
  | 'COMMAND_HANDLER_THREW'
  | 'COMMAND_HANDLER_ERROR';

export type CommandExecutorError = Readonly<{
  code: CommandExecutorErrorCode;
  message: string;
  detail?: unknown;
}>;

export type CommandExecutorOk = Readonly<{
  ok: true;
  value: CommandExecutionResult;
}>;

export type CommandExecutorErr = Readonly<{
  ok: false;
  error: CommandExecutorError;
}>;

export type CommandExecutorOutput = CommandExecutorOk | CommandExecutorErr;

export type CodeCommandHandler = (
  ctx: CommandExecutionContext,
  input: Record<string, unknown>,
) => Promise<CommandExecutorOutput>;

export type CodeCommandHandlerMap = Record<string, CodeCommandHandler>;
