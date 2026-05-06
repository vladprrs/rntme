# Graph IR Effect Operations Completion Audit

Date: 2026-05-06

Objective audited:

Replace the query/command Graph IR split with effect-based operations,
first-class `call` / `branch` / `result` nodes, clean-break binding
`exposure`, and no executable domain-service command handlers, following
`docs/superpowers/plans/2026-05-06-graph-ir-effect-operations.md`.

## Success Criteria

1. Graph IR authoring and runtime no longer expose the query/command target
   model as the primary path.
2. Graph IR supports effect-based operations with `call`, `branch`, `result`,
   local reads, and local emits.
3. Bindings use `exposure: "read" | "action"` and reject legacy `kind` /
   `pre` authoring.
4. Binding-level `pre[]` / Graph IR `$pre` is removed from target authoring
   and runtime execution.
5. HTTP/gRPC/runtime surfaces execute one operation contract rather than split
   query/command executors.
6. Domain-service executable handler files and runtime
   `commands.handlersModule` are forbidden.
7. CLI skill snapshots, package docs, active specs/plans, and demo guidance do
   not present the old model as current target behavior.
8. Required tests and repository gates are freshly verified.

## Prompt-To-Artifact Checklist

| Requirement | Evidence inspected | Status |
| --- | --- | --- |
| Effect operation types and executor exist | `packages/artifacts/graph-ir-compiler/src/types/{effects,operation}.ts`, `src/operation/*`, `packages/runtime/runtime/src/plugins/executors/graph-operation-executor.ts` | Pass |
| `call` / `branch` / `result` nodes parse and execute | Graph IR tests: `test/unit/parse/operation-nodes.test.ts`, `test/integration/operation-call.test.ts`, `test/integration/operation-local.test.ts`; `pnpm -F @rntme/graph-ir-compiler test` passed 91 files / 314 tests after rebuild | Pass |
| Binding clean break from `kind` to `exposure` | `packages/artifacts/bindings/src/types/artifact.ts`, `src/parse/schema.ts`, validation tests; legacy `kind` + `pre` negative fixture in `test/unit/parse/schema.test.ts` | Pass |
| Remove `$pre` from Graph IR schema/runtime | Removed `$pre` schema/type/eval/lower/payload branches; deleted `pre-ref-positions.ts` and `pre-directive.test.ts`; snapshot `apps/cli/src/skills/verify/snapshots/graphIr.AuthoringSpecSchema.txt` no longer includes `$pre` | Pass |
| Remove binding pre-step runtime residue | Removed `bindings-http/src/pre/expression.ts`; expression evaluator moved to `src/runtime/expression.ts`; idempotency naming moved from command to operation | Pass |
| Remove split executor public export | Deleted `packages/runtime/bindings-http/src/executor-contract.ts` and package export; `contracts-handlers-v1` now has a self-contained legacy contract shape test | Pass |
| Forbid executable domain handlers | Runtime manifest test rejects `commands.handlersModule`; blueprint composition rejects `services/<slug>/commands/handlers.mjs`; platform deploy test asserts handler asset is not emitted | Pass |
| No stale generated pre-ref files | `@rntme/graph-ir-compiler` build now runs `rm -rf dist && tsc`; `find packages/artifacts/graph-ir-compiler/dist packages/runtime/bindings-http/dist -path '*pre-ref*' -o -path '*/pre/*'` returned no output after rebuild | Pass |
| Active docs/plans do not silently point agents at old model | Specs/plans with old Auth0/BPMN `pre[]` or handler instructions now have explicit 2026-05-06 supersession notes; Graph IR operation spec supersedes old mechanics | Pass |
| Stale reference scan | Code-scope scan only found the intentional legacy negative fixture `packages/artifacts/bindings/test/unit/parse/schema.test.ts:110` | Pass |
| Package tests | `graph-ir-compiler`, `bindings`, `bindings-http`, `bindings-grpc`, `runtime`, `blueprint`, `cli`, `contracts-handlers-v1` all passed after the cleanup/rebuild | Pass |
| Workspace gates | `pnpm -r run build`, `pnpm -r run typecheck`, `pnpm -r run lint`, `pnpm depcruise`, `pnpm -F @rntme/cli gen:snapshots`, `git diff --check` passed | Pass |
| Exact platform-http package test | `pnpm -F @rntme/platform-http test` now passes: 42 files / 199 tests, with 7 container-backed e2e files / 20 tests skipped by `e2eContainersAvailable()`. The helper now checks `docker run --rm hello-world`, not only `docker info`, so this environment's broken Docker runtime does not false-enable testcontainers suites. | Pass |

## Residual Risk

Container-backed platform e2e tests did not execute locally because Docker can
answer `docker info` but cannot start containers in this environment:
`docker run --rm hello-world` fails with `unshare: operation not permitted`
while registering the pulled image layer. This is not a known code failure. The
exact package test command is now green locally, and those e2e suites remain
enabled automatically in environments where Docker can actually start
containers.
