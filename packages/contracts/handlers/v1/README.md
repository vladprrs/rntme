# @rntme/contracts-handlers-v1

Code-command-handler runtime contract for rntme. Defines the type a service or module's command handler must implement to be wired into the runtime executor — types only, no runtime dependencies.

## File map

- `src/handlers.ts` — `CodeCommandHandler`, `CodeCommandHandlerMap`, `CommandExecutionContext`, `CommandExecutionResult`, `CommandExecutorError`, `CommandExecutorErrorCode`, `CommandExecutorOutput`, `CorrelationCtx`.
- `src/index.ts` — public re-exports.
- `test/unit/runtime-compat.test.ts` — `expectTypeOf` drift gate that pins the runtime executor types (`@rntme/bindings-http/executor-contract`) to remain assignable to this contract.

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
- The contract `CommandExecutionContext` is **structurally minimal** (`now`, `nextId`, `correlation`). The runtime in `@rntme/bindings-http/executor-contract` declares a richer ctx (with `eventStore`, `qsmDb`, `actor`); a runtime-rich ctx is assignable to the contract via subtyping, so a handler typed against the contract slots into the runtime executor unchanged.
- Service-local runtime artifacts that intentionally use `eventStore`, `qsmDb`, or `actor` should use `ServiceLocalCodeCommandHandlerMap` / `ServiceLocalCommandExecutionContext` from `@rntme/runtime` instead of widening this module-facing contract.
- Drift between the contract and the runtime is pinned by `test/unit/runtime-compat.test.ts`. If the runtime types diverge from the contract intent, that test fails — investigate before silencing.
- Handlers MUST return a `CommandExecutorOutput` (`{ ok: true, value }` or `{ ok: false, error }`) rather than throwing. The `CodeCommandExecutor` in `@rntme/runtime` catches throws and converts them into `COMMAND_HANDLER_THREW`, but contract-side handlers should fail explicitly.

## Out of scope

- Concrete `CodeCommandExecutor` implementation (lives in `@rntme/runtime`).
- The richer runtime context shape (`eventStore`, `qsmDb`, `actor`) — that lives in `@rntme/bindings-http/executor-contract` and is intentionally hidden from module authors.
- Query executor types (`QueryExecutor`, `QueryExecutionContext`) — still in `@rntme/bindings-http/executor-contract`; extract here if a future module needs them.

## Where to look first

`handlers.ts` → `CodeCommandHandler`. `runtime-compat.test.ts` → drift gate.

## Specs

- `docs/superpowers/specs/2026-05-04-platform-contracts-extraction-design.md` — extraction rationale.
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — executor seam, `CodeCommandExecutor` origin.
