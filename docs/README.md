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

Archived specs, plans, reports, and runbooks live under `docs/history/**`.
ADRs, audits, research notes, and gaps still live in their existing directories
until a later archival pass moves them. Treat all of those historical surfaces
as rationale, not current-state truth.

Specs and plans use lifecycle directories:

- `docs/history/specs/autonomous/` and `docs/history/plans/autonomous/` for
  agent-authored specs/plans produced from autonomous backlog items;
- `docs/history/specs/active-rationale/` for recent rationale that still helps
  explain current decisions;
- `docs/history/specs/historical/` and `docs/history/plans/historical/` for
  completed or stale context;
- retired material is kept out of navigation and should not be linked from
  current docs.

Every document under `docs/history/**` starts with a banner naming its status,
date, current source, and retention reason.

## Docs Touch

Every implementation plan must evaluate whether it changes:

- `docs/current/owners/**` for public APIs, errors, invariants, gotchas, local
  commands, package boundaries, or navigation pointers;
- local README stubs when the current-doc target or local command hint changes;
- `docs/current/guides/**` when authoring rules or examples change;
- `docs/decision-system.md` when strategic, architectural, or convention
  decisions change;
- `AGENTS.md` or `CLAUDE.md` when bootstrap navigation changes.
