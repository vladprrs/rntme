# Docs centralization and lifecycle - design

> Status: design approved.
> Scope: repository documentation structure, local README roles, current package
> documentation ownership, and historical spec/plan lifecycle.
> Non-goals: changing runtime/package code; adding CI documentation guards;
> rewriting the bodies of historical specs/plans; deleting retired documents in
> the first migration.

## 1. Problem

The repository documentation currently mixes several different document classes
without a lifecycle that makes their authority clear:

- Detailed current package documentation lives beside packages, apps, modules,
  and demos. Those README files are useful locally, but they are also large
  enough to drift from the code they describe.
- Some current authoring references live under `packages/**/docs`, even though
  agents use them as cross-cutting guides rather than private package notes.
- `docs/superpowers/specs` and `docs/superpowers/plans` contain a large amount
  of historical design and execution material. Much of it is valuable as
  rationale, but many documents no longer reflect current behavior.
- Current docs still contain wording that treats older specs as current truth,
  such as "authoritative design" or "active umbrella spec". That conflicts with
  the newer docs reset rule: current behavior comes from code/tests plus current
  owner docs, while specs/plans explain why a decision was made at the time.

The practical failure mode is agent confusion: an old plan or spec can look more
specific than the current code and cause the wrong implementation decision.

## 2. Goals

After the migration:

1. Detailed current documentation is centralized under `docs/current`.
2. Local package/app/module/demo README files become short entry stubs that are
   hard to stale.
3. Cross-cutting authoring guides and examples live under `docs/current/guides`.
4. Historical design and execution documents live under `docs/history` with an
   explicit lifecycle.
5. Specs/plans are retained for rationale, but cannot present themselves as
   current source of truth.
6. A two-step retirement process exists for stale or harmful historical docs:
   first move to `retired/` with reason and replacement, then delete only in a
   separate follow-up after link review.
7. Documentation upkeep is review-policy only for now. No CI/API-surface guard is
   added in this stage.

## 3. Decisions

| Question | Decision |
| --- | --- |
| Centralization level | Move detailed package/app/module/demo docs into `docs/current`; keep local README stubs. |
| Local README shape | Short 10-20 line stubs: purpose, current doc link, local commands, upkeep note. |
| Current docs grouping | Mixed layout: owner docs by workspace path plus separate cross-cutting guides. |
| Historical docs policy | Introduce `docs/history` with status banners and lifecycle directories. |
| Stale specs/plans deletion | Two-step retirement: move to `retired/` first; physical deletion only later. |
| Automation level | Review policy only; no CI guard in this migration. |

## 4. Target Documentation Structure

```text
docs/
  README.md
  decision-system.md

  current/
    owners/
      packages/artifacts/pdm.md
      packages/runtime/runtime.md
      apps/cli.md
      modules/identity/auth0.md
      demo/notes-blueprint.md
    guides/
      graph-ir-authoring.md
      bindings-authoring.md
      graph-ir-examples.md
      bindings-examples.md

  history/
    specs/
      active-rationale/
      historical/
      retired/
    plans/
      historical/
      retired/
    adr/
    reports/
    audits/
    research/
    gaps/
```

`docs/README.md` is the documentation entry point. It explains the role of
`docs/current`, `docs/history`, `docs/decision-system.md`, and local README
stubs.

`docs/current/owners` maps to workspace paths so a reader can find the current
document for a package, app, module, or demo without learning a new taxonomy.

`docs/current/guides` holds current cross-cutting references such as LLM
authoring guides and examples. The initial candidates are the package-local
Graph IR and bindings authoring/example documents.

`docs/history` holds rationale and execution history. Its documents are not
current-state truth unless the same decision is also present in
`docs/decision-system.md` or `docs/current/**`.

## 5. Local README Stubs

Every package/app/module/demo keeps a local `README.md`, but the local file is
intentionally small.

Template:

```md
# @rntme/<name>

Short purpose: one sentence.

Current documentation: [docs/current/owners/<workspace-path>.md](...)

Local commands:
- `pnpm -F @rntme/<pkg> test`

Notes:
- Keep this file short. Update the current doc when public API, invariants,
  gotchas, or package navigation changes.
```

The local stub should not carry detailed public API, invariants, gotchas, error
catalogs, package internals, or long rationale links. Those belong in the
matching `docs/current/owners/...` file.

## 6. Current Owner Docs

Owner docs are the current package/app/module/demo documentation.

Template:

```md
# <workspace path>

Owner: <package/app/module/demo>
Current status: current
Last reviewed: YYYY-MM-DD

## Purpose
## Public API / Surface
## Invariants
## Where To Look First
## Common Gotchas
## Local Commands
## Related History
```

`Last reviewed` is review discipline, not an automated guarantee. It is still
useful because it makes freshness visible during review.

Implementation plans must evaluate owner-doc impact. If a change touches public
API, error codes, invariants, package boundaries, gotchas, local commands, or
navigation pointers, the plan includes an update to the relevant
`docs/current/owners/...` document. If a change is internal-only, the plan may
record: "No docs update: internal-only change, current doc remains accurate."

## 7. Historical Lifecycle

Specs and plans use explicit lifecycle states:

```text
active-rationale  # recent rationale that still explains a current decision
historical        # completed or stale history retained only as context
retired           # harmful or superseded enough to be a deletion candidate
```

Rules:

- Every document under `docs/history/**` has a short banner with `Status`,
  `Date`, `Current source`, and `Why retained` or `Why retired`.
- `active-rationale` does not mean current source of truth. Current truth comes
  from code/tests, `docs/current/**`, `docs/decision-system.md`, and
  `.dependency-cruiser.cjs`.
- A document enters `retired/` only with a reason and replacement, for example:
  `Current source: docs/current/owners/packages/runtime/event-store.md +
  docs/decision-system.md`.
- Physical deletion of retired documents is allowed only in a separate follow-up
  after link review with `rg` and after the replacement context exists in
  `docs/current/**` or `docs/decision-system.md`.
- Old plans are normally `historical` or `retired`. An old unfinished plan should
  not stay active indefinitely.

This preserves the "why" while reducing the chance that obsolete documents steer
current implementation.

## 8. Migration Policy

The migration should happen in waves rather than as one large undifferentiated
move.

### Wave 1 - Current Docs

1. Create `docs/README.md`.
2. Create `docs/current/owners` and `docs/current/guides`.
3. Move detailed package/app/module/demo README content into owner docs.
4. Replace local README files with short stubs.
5. Move package-local authoring guides/examples into `docs/current/guides`.
6. Update `AGENTS.md` so the read order points to the new structure.
7. Replace dangerous wording in current docs, especially claims that old specs
   are current truth.

### Wave 2 - History

1. Move `docs/superpowers/specs` and `docs/superpowers/plans` into
   `docs/history/specs` and `docs/history/plans`.
2. Classify documents minimally:
   - recent or still useful rationale -> `active-rationale`;
   - completed/stale context -> `historical`;
   - misleading or superseded documents -> `retired`.
3. Add lifecycle banners.
4. Do not rewrite historical document bodies in bulk.

### Wave 3 - Link Review And Retirement Review

1. Review links from current docs and local stubs.
2. Replace references that point to stale specs as if they were current truth.
3. Run a separate deletion review for `retired/`.
4. Consider light CI guards later, after the structure proves useful in review.

## 9. Verification

Initial implementation verification is documentation-only:

- Use `rg` to find old paths and broken references.
- Use `rg` to find dangerous wording in current docs, including
  `authoritative spec`, `source of truth`, and `active umbrella spec`.
- Use `find` and `wc` to check that local package/app/module/demo README files
  are short stubs.
- Use `git diff --stat` to confirm a docs-only migration.

No package build/test/lint is required for the design document itself. For the
later migration, CI can run if touched markdown links or generated artifacts
make it useful, but no code change is expected.

## 10. Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Large diff obscures mistakes. | Migrate in waves and avoid body rewrites for historical docs. |
| Local navigation gets worse. | Keep local README stubs and add `docs/README.md`. |
| History loses useful rationale. | Retire before deleting; require current replacement context. |
| Current docs can still stale. | Require docs-touch evaluation in every implementation plan. |
| Links churn across many files. | Use workspace-path mapping for owner docs and verify with `rg`. |

## 11. Documentation Touch Evaluation

This design changes documentation policy and navigation, so the eventual
implementation must update:

- `AGENTS.md` for read order, package lookup behavior, docs-touch policy, and
  historical lookup recipes.
- `docs/README.md` as the new docs entry point.
- Local README files for packages/apps/modules/demos that become stubs.
- New `docs/current/**` owner and guide files.
- Historical docs under `docs/history/**`.

`docs/decision-system.md` does not need a goals/filters/bets change for this
design. It may need path updates later if ADR/spec references move.

## 12. Acceptance Criteria

1. `docs/README.md` exists and explains current vs history vs decision-system.
2. Detailed current package/app/module/demo docs live under
   `docs/current/owners`.
3. Local README files are short stubs that point to the matching owner docs.
4. Cross-cutting authoring guides/examples live under `docs/current/guides`.
5. Historical specs/plans live under `docs/history` with lifecycle directories
   and banners.
6. Current docs no longer describe old specs/plans as current truth.
7. No retired document is physically deleted in the first migration.
8. The implementation plan includes a docs-touch evaluation for every migrated
   surface.
