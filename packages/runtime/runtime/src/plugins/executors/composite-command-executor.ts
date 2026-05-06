import type {
  CommandExecutor,
  CommandExecutorInput,
  CommandExecutorOutput,
} from './types.js';

export class CompositeCommandExecutor implements CommandExecutor {
  constructor(
    private readonly primary: CommandExecutor,
    private readonly fallback: CommandExecutor,
  ) {}

  async execute(input: CommandExecutorInput): Promise<CommandExecutorOutput> {
    const out = await this.primary.execute(input);
    if (out.ok || out.error.code !== 'COMMAND_NOT_FOUND') return out;
    return this.fallback.execute(input);
  }
}
