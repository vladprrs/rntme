import { expectTypeOf, test } from 'vitest';
import type {
  CodeCommandHandler,
  CommandExecutionContext,
  CommandExecutorOutput,
} from '../../src/index.js';

test('CodeCommandHandler keeps the legacy handler function shape', () => {
  type Expected = (
    ctx: CommandExecutionContext,
    input: Record<string, unknown>,
  ) => Promise<CommandExecutorOutput>;

  expectTypeOf<CodeCommandHandler>().toEqualTypeOf<Expected>();
});

test('CommandExecutionContext stays structurally minimal', () => {
  expectTypeOf<keyof CommandExecutionContext>().toEqualTypeOf<
    'now' | 'nextId' | 'correlation'
  >();
});

test('CommandExecutorOutput remains a Result-like union', () => {
  expectTypeOf<CommandExecutorOutput>().toMatchTypeOf<
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string; detail?: unknown } }
  >();
});
