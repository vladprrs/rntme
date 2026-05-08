# @rntme/blueprint

Project-first blueprint parser/validator for rntme.

## Role in the system

- Depends on: `@rntme/pdm`, `@rntme/qsm`, `@rntme/bindings`, `@rntme/ui`, `@rntme/seed`, `@rntme/workflows`, `@rntme/platform-core`, `zod`
- Consumed by: future runtime/tooling tracks
- Position in pipeline:
  `project directory`
  -> `loadBlueprint` (Track A: structure + project `PDM` + raw service descriptors)
  -> `loadComposedBlueprint` (Track B: project routing/middleware semantics + validated service members + project-routed UI compilation + project workflow validation)

## Directory conventions

- `pdm/pdm.json` + `pdm/entities/*.json`
- `services/<svc>/qsm/qsm.json` + `projections/*.json`
- `services/<svc>/graphs/shapes.json` + `graphs/*.json`
- `services/<svc>/bindings/bindings.json`
- `services/<svc>/seed/seed.json`
- `services/<svc>/storage.json`
- `services/<svc>/ui/...`
- `workflows/workflows.json` + `workflows/**/*.bpmn`

## Public API

- `loadBlueprint(dir)` — load `project.json`, the project `PDM`, and service registry metadata.
- `loadComposedBlueprint(dir)` — load the Track A blueprint, validate project composition rules, load validated service members, build the project binding registry, and compile project-routed service UI.
  When `project.json` declares `modules`, compose also resolves each UI module (`module.json`), builds `catalogManifest`, validates `publicConfig`, checks `./client` exports, and fills `virtualEntrySource` + `publicConfigJson` on the composed result.
  When `workflows/workflows.json` exists, compose parses and validates it with `@rntme/workflows` after the project binding registry is available, then attaches `workflows` to the composed result.
- `loadServiceMember(...)` — load one service's QSM, graph specs, bindings, seed, and UI source against the shared project `PDM`.
- `validateStorageJson(text, pdm)` — validate optional per-service `storage.json` through parse, structural, references, and consistency layers. References treat `route.owner.aggregate` as a PDM entity key; successful output is branded `ValidatedStorageJson`.
- `emitStorageRouteIdTypes(servicesStorage)` — emit a route id union string plus `routeAggregateMap` for UI compile-time storage route reference checks.
- `discoverServiceArtifacts(...)` — inspect a service directory for optional QSM, graph, bindings, seed, and UI artifacts.
- `validateBlueprintComposition(...)` — enforce project routing, middleware, entry UI, and service artifact invariants.
- `buildBindingRegistry(...)`, `resolveProjectBindingRef(...)`, `buildUiHttpMap(...)` — derive qualified binding IDs and routed HTTP entries for project-aware callers.
- `createServiceBindingResolvers(...)` — build bindings validators that resolve service-local graphs against project service context.
- `compileServiceUi(...)` — compile a service UI artifact with routed binding resolution from the project binding registry. UI validation uses project UI route patterns plus an explicit core-component catalog and module `catalogManifest`; unknown routes/components fail during compose.
- `loadProjectWorkflows(...)` — discover `workflows/workflows.json`, validate BPMN file paths, resolve project PDM event refs, and resolve service-task action binding refs through the project binding registry.
- `materializeBundle(bundle)` — write a canonical project-version bundle
  (`files` plus base64 `assets`) to a temporary project directory with path
  traversal and collision checks.
- `materializeAndCompose(bundle)` — materialize a canonical bundle, run
  `loadComposedBlueprint`, return `{ composed, summary }`, and clean up the
  temporary directory.
- `readServiceGraphSpec(...)` — load service graph shapes and graph JSON files.
- `eventTypesForService(...)` — scope project `PDM` event types for service seed validation.
- `parseProjectBlueprint(raw)` — parse the `project.json` document shape.
- `validateBlueprintStructural(...)` — enforce service directory / service kind invariants.
- `ok`, `err`, `isOk`, `isErr`, `ERROR_CODES` — shared `Result` helpers and error registry.

## Modules

Blueprint imports the manifest schema from `@rntme/contracts-module-v1` (`ModuleManifestSchema`, `parseModuleManifest`, all manifest types). A `provisioner` block on the manifest is surfaced through `DiscoveredModule.manifest.provisioner`. Discovery validates that `entry` is a relative path inside the module package; absolute or parent-traversal entries fail with `BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY`.

## Var sources

Blueprint `project.json#vars[].from` accepts two source roots, validated structurally here and resolved by `@rntme/deploy-core`:

- `target.<root>.<...>` — typed config shape on the deployment target (e.g., `target.auth.auth0.domain`).
- `provision.<moduleKey>.<output>[.<jsonPointer>...]` — output from a module's provisioner. Requires the executor to run provision before plan; see the deploy-core README for resolution semantics and the five error codes.

The structural validator only enforces syntax. Module-existence and output-declaration checks happen in the deploy-core resolver against the project's discovered module catalog.

## Where to look first

- `src/load/load-blueprint.ts`
- `src/validate/composition.ts`
- `src/compose/load-service-member.ts`
- `src/compose/load-composed-blueprint.ts`
- `src/compose/project-workflows.ts`
- `test/fixtures/product-catalog-project/`

## Auth and Operation Validation

`project.json` supports typed auth middleware:

```json
{
  "middleware": {
    "auth": {
      "kind": "auth",
      "provider": "auth0",
      "audience": "https://notes-demo.rntme.com/api",
      "moduleSlug": "identity-auth0"
    }
  }
}
```

When auth middleware is mounted on a service route, protected graphs are expected to call the configured Identity module from Graph IR and bind request credentials through `inputFrom`. Blueprint composition rejects executable domain-service handler files (`services/<slug>/commands/handlers.mjs`) so service behavior stays in Graph IR operation artifacts instead of service-local code.

## Specs

- [`../../../docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md`](/docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md) — project-first blueprint model: Track A structure, project-level `PDM`, service-level artifacts, and Track B project composition rules for routing, middleware, service validation, and UI binding resolution.
- [`../../../docs/history/specs/historical/2026-05-05-provisioned-bpmn-operaton-design.md`](/docs/history/specs/historical/2026-05-05-provisioned-bpmn-operaton-design.md) — project-level BPMN workflow artifact, Operaton provisioning, and BPMN worker deployment.
