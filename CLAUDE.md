# CLAUDE.md

Claude Code compatibility bootstrap for this repository.

## Start Here

Read [`AGENTS.md`](AGENTS.md) before touching code. It defines read order,
repo navigation, package lookup, commands, layering, workflow, and docs-touch
rules.

For strategic, architectural, or convention-level decisions, read
[`docs/decision-system.md`](docs/decision-system.md) before asking the user.
It owns goals, filters, locked-in bets, and the update protocol.

Local package README files are stubs; current internals live in linked
`docs/current/owners/**` docs. Read the local README first, then follow its
current-doc link before opening source files.

## Commands

Node 20+, pnpm 9.12+. From the workspace root:

| Command | Effect |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install dependencies |
| `pnpm -r run build` | Build every package |
| `pnpm -r run typecheck` | Typecheck every package |
| `pnpm -r run test` | Run package tests |
| `pnpm -r run lint` | Lint source and tests |
| `pnpm depcruise` | Run dependency-cruiser layering check |
| `pnpm vendor:check` | Verify vendored module metadata in demos |
| `pnpm -F @rntme/<pkg> test` | Run one package's tests |
| `pnpm -F @rntme/<pkg> test:watch` | Watch one package |

Specs, plans, reports, and ADRs are design/history artifacts. Use them for
rationale, then verify current behavior against code/tests, `docs/current/**`,
and `docs/decision-system.md`.
