# @rntme/blueprint

Project-first blueprint loader for rntme. This package owns the blueprint folder shape, checks for the project-level `project.json`, and returns the minimal loaded blueprint handle used by higher-level validation and composition code.

## Role in the system

- Owns the project-first blueprint entrypoint for Track A.
- Loads the top-level project artifact before downstream packages inspect project `PDM` or service `QSM` content.
- Provides shared `Result` helpers and error codes for blueprint loading failures.

## Public API

- `loadBlueprint(dir)` — public loader exposed from `src/index.ts`.
- `ok`, `err`, `isOk`, `isErr` — shared `Result` helpers.
- `ERROR_CODES` — stable blueprint error registry.
- `BlueprintError`, `BlueprintErrorCode`, `Result` — public types re-exported from the package barrel.

## Where to look first

- `src/index.ts` for the supported package entrypoint.
- `src/load/load-blueprint.ts` for the current folder-loading behavior.
- `test/smoke.test.ts` for the minimal end-to-end package contract.

## Specs

- [`../../docs/superpowers/specs/2026-04-23-project-first-blueprint-design.md`](../../docs/superpowers/specs/2026-04-23-project-first-blueprint-design.md) — Track A blueprint model, `project.json`, and project-level `PDM` / service-level `QSM` layout.
