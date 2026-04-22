import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, ActorRef } from '@rntme/event-store';

export type CorrelationCtx = Readonly<{
  commandId: string;
  correlationId: string;
  traceparent: string | null;
}>;

export type CommandExecutionContext = {
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actor: ActorRef | null;
  correlation: CorrelationCtx;
};

export type CommandExecutionResult = Readonly<{
  aggregateId: string;
  version: number;
  eventIds: readonly string[];
  commandId: string;
  correlationId: string;
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

export type CommandExecutorOk = { ok: true; value: CommandExecutionResult };
export type CommandExecutorErr = { ok: false; error: CommandExecutorError };
export type CommandExecutorOutput = CommandExecutorOk | CommandExecutorErr;

export type CommandExecutorInput = {
  commandName: string;
  inputs: Record<string, unknown>;
  ctx: CommandExecutionContext;
};

export interface CommandExecutor {
  execute(input: CommandExecutorInput): Promise<CommandExecutorOutput>;
}

export type QueryExecutionContext = {
  qsmDb: BetterSqlite3.Database;
};

export type QueryExecutorErrorCode = 'QUERY_NOT_FOUND' | 'QUERY_HANDLER_THREW';

export type QueryExecutorError = Readonly<{
  code: QueryExecutorErrorCode;
  message: string;
  detail?: unknown;
}>;

export type QueryExecutorOk = { ok: true; value: unknown };
export type QueryExecutorErr = { ok: false; error: QueryExecutorError };
export type QueryExecutorOutput = QueryExecutorOk | QueryExecutorErr;

export type QueryExecutorInput = {
  queryName: string;
  inputs: Record<string, unknown>;
  ctx: QueryExecutionContext;
};

export interface QueryExecutor {
  execute(input: QueryExecutorInput): Promise<QueryExecutorOutput>;
}
