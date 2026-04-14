# @rntme/bindings

HTTP bindings artifact and OpenAPI 3.1 generator for Graph IR.

See `docs/superpowers/specs/2026-04-14-bindings-design.md` in the monorepo for the design document.

## Status

Draft MVP. Provides:

- `parseBindingArtifact` — Zod-based structural parsing.
- `validateBindings` — four-layer validator (structural / references / consistency).
- `generateOpenApi` — emits an OpenAPI 3.1 document from a validated artifact.

Out of scope: runtime HTTP adapter (future epic).
