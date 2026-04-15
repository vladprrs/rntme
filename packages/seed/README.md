# @rntme/seed

Load and apply a declarative `seed.json` of event envelopes to an rntme event-store. Designed to run before `relay.start()` so seeded events flow through the normal pipeline (`event-store → relay → bus → projection-consumer → QSM`).

See design: `docs/superpowers/specs/2026-04-15-runtime-seed-design.md`.
