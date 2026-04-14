# @rntme/qsm

QSM (Query-Side Materialized projections) parser, validator, and resolver for the event-sourced read-side.

Provides:
- Typed `QsmArtifact` with `backing: "entity-mirror"` projections (MVP) and scaffolding for `"derived"` (tier 2).
- Layered validation: structural + cross-ref against `@rntme/pdm`.
- DDL generation for entity-mirror projections (includes idempotency columns).
- Apply-handler derivation from PDM stateMachine transitions.
- Pure-lookup `QsmResolver` for downstream packages.

See `docs/superpowers/specs/2026-04-14-mutations-design.md` §6 for spec.
