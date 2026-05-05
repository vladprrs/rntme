import type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
  ServiceLocalCodeCommandHandlerMap,
} from './types.js';

export class CodeCommandExecutor implements CommandExecutor {
  private readonly handlers: ServiceLocalCodeCommandHandlerMap;

  constructor(handlers: ServiceLocalCodeCommandHandlerMap) {
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
