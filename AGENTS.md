# AGENTS.md — coding-agent navigation

Read this file first. It is written for agents, not humans.

## Read Order

1. For strategic, architectural, or convention decisions, read
   [`docs/decision-system.md`](docs/decision-system.md). It owns goals,
   decision filters, locked-in bets, and the update protocol.
2. Before opening source in a package, read the local `README.md` stub, then
   follow its linked `docs/current/owners/**` owner doc. Owner docs own current
   internals, APIs, invariants, gotchas, and "where to look first" pointers.
3. Verify current behavior in code and tests. Specs/plans/ADRs explain why
   something was designed or implemented at the time; they are rationale, not
   automatic current-state truth.
4. Dependency/layering truth lives in `.dependency-cruiser.cjs` and
   `package.json` dependencies.

## Repo Map

- `apps/` — runnable workspaces: CLI, platform HTTP app, landing site.
- `packages/` — core workspace packages grouped by role: artifacts, runtime,
  contracts, deploy, platform, tooling.
- `modules/` — vendor/category modules and conformance suites.
- `demo/` — example project blueprints.
- `docs/current/` — current owner docs and authoring guides.
- `docs/history/` — archived specs, plans, reports, runbooks, and future home
  for ADRs/audits/research/gaps.
- `docs/decision-system.md` — decision canon.
- `docs/history/specs/autonomous/`, `docs/history/plans/autonomous/` —
  agent-authored specs/plans for autonomous backlog work; use as rationale and
  execution context, then verify against current docs/code/tests.
- `docs/history/specs/active-rationale/` — recent rationale that may still
  explain current decisions, but is not current-state truth.
- `docs/history/specs/historical/`, `docs/history/plans/historical/` —
  completed or stale design/execution history retained as context.

## Package Lookup

Open the local README stub first, then follow its `Current documentation` link.
The owner doc under `docs/current/owners/**` owns APIs, invariants, gotchas, and
where-to-look-first pointers.

| Area | READMEs |
| --- | --- |
| Apps | `apps/cli/README.md`, `apps/platform-http/README.md`, `apps/landing/README.md` |
| Artifacts | `packages/artifacts/blueprint/README.md`, `packages/artifacts/pdm/README.md`, `packages/artifacts/qsm/README.md`, `packages/artifacts/workflows/README.md`, `packages/artifacts/graph-ir-compiler/README.md`, `packages/artifacts/bindings/README.md`, `packages/artifacts/ui/README.md`, `packages/artifacts/seed/README.md` |
| Runtime | `packages/runtime/runtime/README.md`, `packages/runtime/event-store/README.md`, `packages/runtime/bindings-http/README.md`, `packages/runtime/bindings-grpc/README.md`, `packages/runtime/projection-consumer/README.md`, `packages/runtime/ui-runtime/README.md`, `packages/runtime/bpmn-worker/README.md` |
| Contracts | `packages/contracts/module/v1/README.md`, `packages/contracts/provisioner/v1/README.md`, `packages/contracts/client-runtime/v1/README.md`, `packages/contracts/handlers/v1/README.md`, `packages/contracts/_common/v1/README.md`, `packages/contracts/identity/v1/README.md`, `packages/contracts/ai-llm/v1/README.md`, `packages/contracts/crm/v1/README.md`, `packages/contracts/analytics/v1/README.md`, `packages/contracts/storage/v1/README.md` |
| Deploy/platform/tooling | `packages/deploy/deploy-core/README.md`, `packages/deploy/deploy-dokploy/README.md`, `packages/platform/platform-core/README.md`, `packages/platform/platform-storage/README.md`, `packages/tooling/module-scaffold/README.md` |
| Modules | `modules/identity/README.md`, `modules/ai-llm/README.md`, `modules/crm/README.md`, `modules/marketing-site/README.md`, `modules/storage/README.md`, plus each vendor module README under `modules/<category>/<vendor>/` |
| Demos | `demo/notes-blueprint/README.md`, `demo/order-fulfillment-blueprint/README.md`, `demo/cv-extract-blueprint/README.md` |

## Commands

From the workspace root:

| Command | Effect |
| --- | --- |
| `pnpm install --frozen-lockfile` | install deps |
| `pnpm -r run build` | build every package |
| `pnpm -r run typecheck` | typecheck every package |
| `pnpm -r run test` | run package tests |
| `pnpm -r run lint` | lint source and tests |
| `pnpm depcruise` | enforce package layering |
| `pnpm vendor:check` | verify vendored module metadata in demos |
| `pnpm -F @rntme/<pkg> test` | run one package's tests |
| `pnpm -F @rntme/<pkg> test:watch` | watch one package |

CI runs build, typecheck, test, lint, depcruise, and vendor check.

## Workflow

- Research -> plan -> implement for non-trivial work.
- Use brainstorming/writing-plans skills for new behavior, architecture,
  feature, or docs-system changes.
- Use trunk-based development (TBD) for git work.
- Keep edits scoped to the package or doc surface implied by the task.
- Do not revert unrelated user changes in a dirty worktree.
- Every implementation plan includes a documentation-touch evaluation. "No
  docs need updating" is valid only when recorded with the reason.

## Layering

Layering is enforced by `dependency-cruiser`; `.dependency-cruiser.cjs` is the
authority. Current rules block:

- `modules/**` importing implementation packages under `packages/**` except
  `packages/contracts/**`.
- contracts importing implementation packages or modules.
- tooling importing runtime/artifacts/deploy/platform implementations.
- artifacts or deploy packages importing runtime packages.
- circular dependencies.

Storage vendor modules follow the same vendor layering as identity and AI/LLM:
server code imports canonical contracts, provisioner code may import the
provisioner contract, and browser code may import the client-runtime contract.
Do not import implementation packages from `modules/storage/**`.

Do not add warning-only architecture rules. If an exception is justified, make
it a named `pathNot` carve-out with a comment linking to the spec/PR.

## Navigation Recipes

Recipe paths point to local README stubs; follow each stub's current-doc link
for detailed package documentation.

- New or changed project-blueprint composition: start at
  `packages/artifacts/blueprint/README.md`.
- PDM fields/entities/state: `packages/artifacts/pdm/README.md`.
- QSM projections/relations/DDL: `packages/artifacts/qsm/README.md`.
- Graph IR parsing, validation, lowering, execution: `packages/artifacts/graph-ir-compiler/README.md`.
- HTTP binding artifact or OpenAPI emission: `packages/artifacts/bindings/README.md`.
- Hono HTTP runtime: `packages/runtime/bindings-http/README.md`.
- gRPC surface: `packages/runtime/bindings-grpc/README.md`.
- UI artifact compiler: `packages/artifacts/ui/README.md`; UI host/runtime:
  `packages/runtime/ui-runtime/README.md`.
- Runtime boot, plugin seams, module calls: `packages/runtime/runtime/README.md`.
- BPMN workflows: `packages/artifacts/workflows/README.md` and
  `packages/runtime/bpmn-worker/README.md`.
- Deploy planning/apply: `packages/deploy/deploy-core/README.md` and
  `packages/deploy/deploy-dokploy/README.md`.
- CLI behavior: `apps/cli/README.md`.
- Vendor module work: category README, vendor README, canonical contract
  README, conformance README.
- Storage vendor work: `modules/storage/README.md`,
  `modules/storage/s3/README.md`, `packages/contracts/storage/v1/README.md`,
  and `modules/storage/conformance/README.md`.

Use `rg` by topic when historical rationale is needed:

```bash
rg -n "topic words" docs/current docs/history docs/adr docs/audit docs/gaps docs/research
```

## Do Not Do

- Do not bypass `Validated*` brands with casts. Run the validator.
- Do not skip validation layers because input is "trusted".
- Do not throw across validation/compile package boundaries; return
  `Result<T>`.
- Do not delete, reorder, or silently repurpose error codes. Append new codes.
- Do not introduce unsupported authoring formats; artifacts are JSON.
- Do not introduce a database dialect path without decision-system review.
  SQLite is the default service store and Turso is the scale-out target.
- Do not let vendor SDK types leak across canonical contract boundaries.
- Do not treat an old spec as current truth before checking current
  code/tests, `docs/current/**`, and `docs/decision-system.md`.
- Do not add long package inventories, dependency diagrams, or spec indexes to
  root docs. Prefer pointers to current owners.

## Docs Touch

For each implementation plan, evaluate these surfaces:

- `docs/decision-system.md` when a strategic/architectural/convention decision
  changes;
- local README stub when the current-doc link or local command hint changes;
- `docs/current/owners/**` when public API, errors, invariants, gotchas, or
  local navigation changes;
- `docs/current/guides/**` when authoring rules or examples change;
- `docs/README.md` when documentation navigation changes;
- `AGENTS.md` when repo navigation, workflow, layering, or common lookup paths
  change;
- `README.md` when user-facing positioning, quick start, license, or public
  project surface changes;
- `CLAUDE.md` only when the bootstrap instructions or command list change.

Specs and plans may record rationale, but current-state docs should stay short
and point to the owner surface instead of duplicating it.
