# @rntme/deploy-bundle-input

Lifts a composed blueprint into the `@rntme/deploy-core` `ComposedProjectInput` shape.

## Role

Used by CLI direct deploy and the platform BPMN compose handler. It reads runtime files from the materialized bundle directory, bundles the virtual UI entry, copies composed module static UI assets into `ui-build/`, and emits `ui-assets.json` when `@rntme/blueprint` produced a UI asset manifest.

## Where to look first

- `src/to-deploy-core-input.ts` - conversion, UI bundling, workflow file reads, module static asset copying.

## Local commands

- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run lint`
