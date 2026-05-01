export type CommandErrorCode =
  | 'COMMAND_ILLEGAL_TRANSITION'
  | 'COMMAND_GUARD_REJECTED'
  | 'COMMAND_CONCURRENCY_CONFLICT';

export class CommandExecutionError extends Error {
  readonly code: CommandErrorCode;
  readonly detail?: Record<string, unknown>;
  constructor(code: CommandErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = 'CommandExecutionError';
    this.code = code;
    if (detail) this.detail = detail;
  }
}
