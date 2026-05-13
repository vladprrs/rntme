# @rntme/deploy-bundle-input

Lifts a composed blueprint into the `@rntme/deploy-core` `ComposedProjectInput` shape.

## Role

Used by CLI direct deploy and the platform BPMN compose handler. It reads runtime files from the materialized bundle directory, bundles the virtual UI entry, copies composed module static UI assets into `ui-build/`, emits `ui-assets.json` when `@rntme/blueprint` produced a UI asset manifest, and synthesizes runtime module wiring (manifest entries + canonical contract proto sources) for every module a service's graphs call.

## Module wiring

- `src/runtime-module-wiring.ts` — `collectGraphModuleTargets` walks every graph's `call` nodes and collects the set of `target.module` names. For each referenced module it emits one `manifest.modules[]` entry whose gRPC address follows the convention `mod-<serviceSlug>:50051` and whose `protoPath` points at the bundled canonical contract proto. The bundle's `moduleKey` (alias from `project.json#modules`) is propagated to the runtime so graph IR `call` nodes resolve to the same key the deploy planner uses for `target.modules.<moduleKey>` lookups.
- `src/contract-protos.ts` — loads canonical proto sources from `packages/contracts/<category>/v1/proto/*.proto` (identity, ai-llm, storage, plus shared `_common`). Each returned `ContractProtoSource` carries the runtime-relative path the runtime should read at boot and the proto bytes that get written into the bundle.

`moduleKey` propagation is the single rule that keeps blueprint module aliases, manifest module names, planner `target.modules.<key>` lookups, and graph IR `call` targets all aligned. The compose handler does not invent new keys.

## Where to look first

- `src/to-deploy-core-input.ts` - conversion, UI bundling, workflow file reads, module static asset copying.
- `src/runtime-module-wiring.ts` - graph `call` scan + manifest module emission.
- `src/contract-protos.ts` - canonical contract proto source loader.

## Local commands

- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run lint`
