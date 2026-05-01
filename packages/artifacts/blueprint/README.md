# @rntme/blueprint

Project-first blueprint parser/validator for rntme.

## Role in the system

- Depends on: `@rntme/pdm`, `@rntme/qsm`, `@rntme/bindings`, `@rntme/ui`, `@rntme/seed`, `zod`
- Consumed by: future runtime/tooling tracks
- Position in pipeline:
  `project directory`
  -> `loadBlueprint` (Track A: structure + project `PDM` + raw service descriptors)
  -> `loadComposedBlueprint` (Track B: project routing/middleware semantics + validated service members + project-routed UI compilation)

## Directory conventions

- `pdm/pdm.json` + `pdm/entities/*.json`
- `services/<svc>/qsm/qsm.json` + `projections/*.json`
- `services/<svc>/graphs/shapes.json` + `graphs/*.json`
- `services/<svc>/bindings/bindings.json`
- `services/<svc>/seed/seed.json`
- `services/<svc>/ui/...`

## Public API

- `loadBlueprint(dir)` — load `project.json`, the project `PDM`, and service registry metadata.
- `loadComposedBlueprint(dir)` — load the Track A blueprint, validate project composition rules, load validated service members, build the project binding registry, and compile project-routed service UI.
  When `project.json` declares `modules`, compose also resolves each UI module (`module.json`), builds `catalogManifest`, validates `publicConfig`, checks `./client` exports, and fills `virtualEntrySource` + `publicConfigJson` on the composed result.
  When  declares , compose also resolves each UI module (), builds , validates , checks  exports, and fills  +  on the composed result.
- `loadServiceMember(...)` — load one service's QSM, graph specs, bindings, seed, and UI source against the shared project `PDM`.
- `discoverServiceArtifacts(...)` — inspect a service directory for optional QSM, graph, bindings, seed, and UI artifacts.
- `validateBlueprintComposition(...)` — enforce project routing, middleware, entry UI, and service artifact invariants.
- `buildBindingRegistry(...)`, `resolveProjectBindingRef(...)`, `buildUiHttpMap(...)` — derive qualified binding IDs and routed HTTP entries for project-aware callers.
- `createServiceBindingResolvers(...)` — build bindings validators that resolve service-local graphs against project service context.
- `compileServiceUi(...)` — compile a service UI artifact with routed binding resolution from the project binding registry.
- `readServiceGraphSpec(...)` — load service graph shapes and graph JSON files.
- `eventTypesForService(...)` — scope project `PDM` event types for service seed validation.
- `parseProjectBlueprint(raw)` — parse the `project.json` document shape.
- `validateBlueprintStructural(...)` — enforce service directory / service kind invariants.
- `ok`, `err`, `isOk`, `isErr`, `ERROR_CODES` — shared `Result` helpers and error registry.

## Where to look first

- `src/load/load-blueprint.ts`
- `src/validate/composition.ts`
- `src/compose/load-service-member.ts`
- `src/compose/load-composed-blueprint.ts`
- `test/fixtures/product-catalog-project/`

## Auth and graph pre-step validation

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

When auth middleware is mounted on a service route, every `IntrospectSession` binding pre-step for that service must use the same `input.audience`; mismatches return `BLUEPRINT_AUTH_AUDIENCE_MISMATCH`. Blueprint composition also checks graph `$pre` references against each binding's `pre[].bindAs` names and returns `BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING` for undefined refs.

## Specs

- [`../../docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`](../../docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md) — project-first blueprint model: Track A structure, project-level `PDM`, service-level artifacts, and Track B project composition rules for routing, middleware, service validation, and UI binding resolution.
