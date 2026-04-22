# @rntme/module-skeleton

Minimal scaffold package for the module-integration workstream.

It intentionally depends on `@rntme/runtime` so follow-on tasks can wire runtime-facing code without changing the package shape. The current public contract is just:

- `VERSION`
- `exampleHandlers`

## What lives here

- `src/index.ts` exports the public entrypoint.
- `src/handlers.ts` provides the minimal example handler shape used by the smoke test.
- `test/unit/_smoke.test.ts` checks the source-level contract for day-to-day development.
- `test/public-contract/_smoke.test.ts` checks the built package contract through the package export surface.

## Notes

- `package.json#files` includes this README so the package metadata stays truthful.
- `pnpm test` builds first, then runs the built-contract check, then runs the unit suite; `pnpm test:watch` and plain `vitest` stay source-only.
- This package is intentionally small; later tasks will extend it rather than reshaping the scaffold.
