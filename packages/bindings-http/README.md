# @rntme/bindings-http

Hono-based HTTP runtime for `@rntme/bindings`. Consumes `ValidatedBindings` and a compiled graph spec, returns a Hono sub-router.

See `docs/superpowers/specs/2026-04-14-bindings-http-design.md` in the monorepo for the design document.

## Status

Draft MVP. Provides:

- `createBindingsRouter(opts)` — factory returning `Hono` sub-router.
- Zod-based coercion of query/path/body parameters.
- Error responses `{ code, message, details? }` matching the generated OpenAPI.

Out of scope: auth, pagination envelope, streaming, multi-tenant routing, non-SQLite executors.
