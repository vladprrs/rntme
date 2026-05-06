# @rntme/contracts-handlers-v1

Legacy code-command-handler contract for rntme. Defines the handler-shaped types used by older module examples — types only, no runtime dependencies. New domain-service behavior should be authored as Graph IR operations.

## File map

- `src/handlers.ts` — `CodeCommandHandler`, `CodeCommandHandlerMap`, `CommandExecutionContext`, `CommandExecutionResult`, `CommandExecutorError`, `CommandExecutorErrorCode`, `CommandExecutorOutput`, `CorrelationCtx`.
- `src/index.ts` — public re-exports.
- `test/unit/runtime-compat.test.ts` — `expectTypeOf` drift gate for the operation/runtime output shapes that still need to remain assignable to this contract.

## Quick start

```ts
import type {
  CodeCommandHandler,
  CodeCommandHandlerMap,
} from '@rntme/contracts-handlers-v1';

const echo: CodeCommandHandler = async (ctx, _input) => ({
  ok: true,
  value: {
    aggregateId: 'echo',
    version: 0,
    eventIds: [],
    commandId: ctx.correlation.commandId,
    correlationId: ctx.correlation.correlationId,
    result: { echoed: true },
  },
});

export const handlers: CodeCommandHandlerMap = { echo };
```

## API

Types: `CodeCommandHandler`, `CodeCommandHandlerMap`, `CommandExecutionContext`, `CommandExecutionResult`, `CommandExecutorError`, `CommandExecutorErrorCode`, `CommandExecutorOutput`, `CorrelationCtx`.

`CommandExecutionResult.result` is optional arbitrary JSON for successful
business payloads. Leave it absent for commands whose only response is the
canonical aggregate/version/event metadata.

## Invariants & gotchas

- This package is **types only** — no zod, no runtime dependencies. Modules that import it pick up zero workspace transitive deps.
- The contract `CommandExecutionContext` is **structurally minimal** (`now`, `nextId`, `correlation`).
- Service-local executable handler files are not part of the current runtime path; use Graph IR operation graphs with `emit`/`call`/`result` nodes instead.
- Drift between the contract and the runtime is pinned by `test/unit/runtime-compat.test.ts`. If the runtime types diverge from the contract intent, that test fails — investigate before silencing.
- Handlers MUST return a `CommandExecutorOutput` (`{ ok: true, value }` or `{ ok: false, error }`) rather than throwing. Contract-side examples should fail explicitly.

## Out of scope

- Concrete operation execution (lives in `@rntme/runtime` and `@rntme/bindings-http`).
- The richer runtime context shape (`eventStore`, `qsmDb`, `actor`) — domain graphs access those through the operation executor, not this module-facing handler contract.
- Query/command executor types — current surfaces use an operation executor instead.

## Where to look first

`handlers.ts` → `CodeCommandHandler`. `runtime-compat.test.ts` → drift gate.

## Specs

- `docs/superpowers/specs/done/2026-05-04-platform-contracts-extraction-design.md` — extraction rationale.
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — historical executor-seam origin.
