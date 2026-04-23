# @rntme/blueprint

Project-first blueprint parser/validator for rntme.

## Role in the system

- Depends on: `@rntme/pdm`, `@rntme/qsm`, `zod`
- Consumed by: future runtime/tooling tracks
- Position in pipeline: project directory → `loadBlueprint` → validated project metadata + validated project `PDM` + parsed per-service `QSM`

## Public API

- `loadBlueprint(dir)` — load `project.json`, the project `PDM`, and service registry metadata.
- `parseProjectBlueprint(raw)` — parse the `project.json` document shape.
- `validateBlueprintStructural(...)` — enforce service directory / service kind invariants.
- `ok`, `err`, `isOk`, `isErr`, `ERROR_CODES` — shared `Result` helpers and error registry.

## Where to look first

- `src/load/load-blueprint.ts`
- `src/parse/schema.ts`
- `src/validate/structural.ts`
- `test/fixtures/product-catalog-project/`

## Specs

- [`../../docs/superpowers/specs/2026-04-23-project-first-blueprint-design.md`](../../docs/superpowers/specs/2026-04-23-project-first-blueprint-design.md) — Track A blueprint model, `project.json`, and project-level `PDM` / service-level `QSM` layout.
