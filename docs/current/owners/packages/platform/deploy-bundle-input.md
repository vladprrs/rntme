# @rntme/deploy-bundle-input

Lifts a composed blueprint into the `@rntme/deploy-core` `ComposedProjectInput` shape.

## Role

Used by CLI direct deploy and the platform BPMN compose handler. It reads runtime files from the materialized bundle directory, bundles the virtual UI entry, copies composed module static UI assets into `ui-build/`, emits `ui-assets.json` when `@rntme/blueprint` produced a UI asset manifest, and synthesizes runtime module wiring (manifest entries + canonical contract proto sources) for every module a service's graphs call.

## Module wiring

- `src/runtime-module-wiring.ts` — `collectGraphModuleTargets` walks every graph's `call` nodes and collects the set of `target.module` names. For each referenced module it emits one `manifest.modules[]` entry whose gRPC address follows the convention `mod-<serviceSlug>:50051` and whose `protoPath` points at the bundled canonical contract proto. The bundle's `moduleKey` (alias from `project.json#modules`) is propagated to the runtime so graph IR `call` nodes resolve to the same key the deploy planner uses for `target.modules.<moduleKey>` lookups.
- `src/contract-protos.ts` — loads canonical proto sources from `packages/contracts/<category>/v1/proto/*.proto` (identity, ai-llm, storage, plus shared `_common`). Each returned `ContractProtoSource` carries the runtime-relative path the runtime should read at boot and the proto bytes that get written into the bundle.

`moduleKey` propagation is the single rule that keeps blueprint module aliases, manifest module names, planner `target.modules.<key>` lookups, and graph IR `call` targets all aligned. The compose handler does not invent new keys.

## Auth provider wiring exclusions

Auth middleware `providers[]` entries are scanned for module references during
runtime module wiring, but **non-module providers are skipped** from the manifest
proto wiring. In particular, the `platform-tokens` provider targets a domain
service (the platform `tokens` service) over HTTP introspection — it does not
have a module image, a `module.json`, or a gRPC contract proto, so
`runtime-module-wiring` excludes it from `manifest.modules[]` synthesis. Auth0
and other module-backed providers are still wired normally.

## Project route prefixes

`buildDomainServiceBindingArtifacts` materializes project-route prefixes onto
each domain service's `bindings.json` so the runtime container can serve
bindings at the root path while the edge prefixes the project's route. The
runtime artifact ships `surface.http.bindingBasePath: "/"`, and the rendered
edge nginx is the single layer that translates the public project route into
the in-container path.

## Runtime body limits

Domain services whose resolved bindings use `inputFrom.*.from: "bodyBytes"` get
`surface.http.bodyLimit.maxBytes: 10485760` in their synthesized runtime
manifest. This keeps raw artifact upload endpoints such as platform project
bundle publish above the runtime default 1 MiB API body limit without changing
ordinary JSON endpoints.

## Platform control-plane persistence

When converting the platform blueprint, `tokens` keeps its own persistent
runtime SQLite volume. `projects` and `deployments` intentionally share the
`rntme-platform-control-data` volume so deployment handlers can read project,
version, target, operation, and deployment projections from one QSM database.
They do **not** share an event-store file: `projects` uses
`/srv/data/projects-events.sqlite`, `deployments` uses
`/srv/data/deployments-events.sqlite`, and both use `/srv/data/qsm.sqlite`.
Sharing event stores across services is invalid because event-store databases
are initialized for a single service name.

## Where to look first

- `src/to-deploy-core-input.ts` - conversion, UI bundling, workflow file reads, module static asset copying.
- `src/runtime-module-wiring.ts` - graph `call` scan + manifest module emission.
- `src/contract-protos.ts` - canonical contract proto source loader.

## Local commands

- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run lint`
