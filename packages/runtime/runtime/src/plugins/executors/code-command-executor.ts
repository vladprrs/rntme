import type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
} from './types.js';
import type {
  CodeCommandHandler,
  CodeCommandHandlerMap,
} from '@rntme/contracts-handlers-v1';

export type { CodeCommandHandler, CodeCommandHandlerMap };

export class CodeCommandExecutor implements CommandExecutor {
  private readonly handlers: CodeCommandHandlerMap;

  constructor(handlers: CodeCommandHandlerMap) {
    this.handlers = handlers;
  }

  async execute(input: CommandExecutorInput): Promise<CommandExecutorOutput> {
    const handler = this.handlers[input.commandName];
    if (handler === undefined) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_NOT_FOUND',
          message: `no code handler registered for command "${input.commandName}"`,
        },
      };
    }

    try {
      return await handler(input.ctx, input.inputs);
    } catch (e) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_HANDLER_THREW',
          message: e instanceof Error ? e.message : String(e),
          detail: e instanceof Error ? { name: e.name, stack: e.stack } : e,
        },
      };
    }
  }
}
