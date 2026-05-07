# rntme docs

This directory is split by authority and lifecycle.

## Current Docs

Use `docs/current/**` for current package, app, module, demo, and authoring
documentation.

- `docs/current/owners/**` mirrors workspace ownership paths. These files own
  current public surfaces, invariants, gotchas, local commands, and "where to
  look first" pointers.
- `docs/current/guides/**` contains cross-cutting current guides such as
  artifact authoring guides and examples.

Local README files beside packages/apps/modules/demos are intentionally short
stubs. They point here instead of duplicating detailed current documentation.

## Decisions

Use `docs/decision-system.md` for strategic, architectural, and convention
decisions. It owns goals, decision filters, locked-in bets, and the update
protocol.

## History

Specs, plans, ADRs, audits, research notes, reports, and gap analyses are
history/rationale unless a current owner doc or `docs/decision-system.md`
promotes the decision.

Historical documents answer "why did we decide this at the time?" They are not
current-state truth by themselves. Verify current behavior against code/tests,
`docs/current/**`, `docs/decision-system.md`, and `.dependency-cruiser.cjs`.

Wave 2 will move archived specs, plans, ADRs, audits, research notes, and gaps
into `docs/history/**`. Until then, historical material remains in its current
directories and should be treated as rationale, not current-state truth.

## Docs Touch

Every implementation plan must evaluate whether it changes:

- `docs/current/owners/**` for public APIs, errors, invariants, gotchas, local
  commands, package boundaries, or navigation pointers;
- local README stubs when the current-doc target or local command hint changes;
- `docs/current/guides/**` when authoring rules or examples change;
- `docs/decision-system.md` when strategic, architectural, or convention
  decisions change;
- `AGENTS.md` or `CLAUDE.md` when bootstrap navigation changes.
