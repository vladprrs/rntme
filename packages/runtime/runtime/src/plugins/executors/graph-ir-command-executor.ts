import {
  executeCommand,
  CommandExecutionError,
  type CompiledCommand,
} from '@rntme/graph-ir-compiler';
import type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
  CommandExecutorError,
} from './types.js';

export type GraphIrCommandMap = Record<string, CompiledCommand>;

export class GraphIrCommandExecutor implements CommandExecutor {
  private readonly commands: GraphIrCommandMap;

  constructor(commands: GraphIrCommandMap) {
    this.commands = commands;
  }

  async execute(input: CommandExecutorInput): Promise<CommandExecutorOutput> {
    const compiled = this.commands[input.commandName];
    if (compiled === undefined) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_NOT_FOUND',
          message: `no compiled command registered for name "${input.commandName}"`,
        },
      };
    }

    try {
      const result = executeCommand(compiled, input.inputs, input.ctx);
      return { ok: true, value: result };
    } catch (e) {
      return { ok: false, error: mapError(e) };
    }
  }
}

function mapError(e: unknown): CommandExecutorError {
  if (e instanceof CommandExecutionError) {
    const code = e.code === 'COMMAND_CONCURRENCY_CONFLICT'
      ? 'COMMAND_CONCURRENCY_CONFLICT'
      : 'COMMAND_GUARD_REJECTED';
    return { code, message: e.message, detail: e.detail };
  }
  return {
    code: 'COMMAND_HANDLER_THREW',
    message: e instanceof Error ? e.message : String(e),
    detail: e instanceof Error ? { name: e.name } : undefined,
  };
}
