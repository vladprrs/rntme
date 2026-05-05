import { expectTypeOf, test } from 'vitest';
import type {
  CodeCommandHandler as ContractHandler,
  CommandExecutionContext as ContractCtx,
  CommandExecutorOutput as ContractOut,
} from '../../src/index.js';
import type {
  CommandExecutionContext as RuntimeCtx,
  CommandExecutorOutput as RuntimeOut,
} from '@rntme/bindings-http/executor-contract';

test('runtime context is assignable to contract context (subtype)', () => {
  // A richer runtime ctx flowing into a function typed for the narrower
  // contract ctx is fine via subtyping.
  expectTypeOf<RuntimeCtx>().toMatchTypeOf<ContractCtx>();
});

test('runtime output matches contract output exactly', () => {
  // Output uses toEqualTypeOf (not toMatchTypeOf) because the contract is the
  // bus value: handlers construct it and runtime consumes it round-trip, so
  // any runtime widening here would let modules emit shapes the contract
  // can't represent. Exact equality keeps the wire pinned in both directions.
  expectTypeOf<RuntimeOut>().toEqualTypeOf<ContractOut>();
});

test('a module handler typed against the contract is callable from runtime', () => {
  type _Wire = ContractHandler extends (ctx: RuntimeCtx, input: Record<string, unknown>) => Promise<RuntimeOut>
    ? true
    : false;
  expectTypeOf<_Wire>().toEqualTypeOf<true>();
});
