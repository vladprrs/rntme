# @rntme/pdm

PDM (Platform Domain Model) parser, validator, and resolver.

Provides:
- Typed `PdmArtifact` with optional stateMachine extension per entity.
- Layered validation: structural + stateMachine rules.
- Event-type derivation from stateMachine transitions.
- Pure-lookup `PdmResolver` interface for downstream packages.

See `docs/superpowers/specs/2026-04-14-mutations-design.md` §2-§3 for spec.
