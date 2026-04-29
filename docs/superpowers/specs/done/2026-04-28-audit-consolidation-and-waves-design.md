# Audit consolidation and waves — design

> **Status:** spec / ready for plan
> **Date:** 2026-04-28
> **Scope:** turn the published architecture audit corpus (`docs/audit/`, RNT-199..RNT-230) into a single living planning document (`docs/audit/00-waves.md`) that organises verified findings into parallelisable waves of work.
> **Out of scope:** writing fixes; estimating effort; re-running the audit; mirroring state back to Multica.

---

## 1 / Problem

An external architecture audit was performed across the workspace and published verbatim to `docs/audit/<pkg>/README.md` (32 packages + monorepo dependency graph). Each package report contains 5–22 findings classified by severity (Blocker / High / Medium / Low). In aggregate this is roughly 300–500 atomic findings across ~4500 lines of audit text.

Two problems with the corpus as-is:

1. **No verification.** Audits are point-in-time snapshots from `2026-04-28`. Some findings reference code that has since been changed, renamed, or removed. Acting on unverified findings risks chasing ghosts.
2. **No prioritisation.** Findings are flat lists per package. There is no view of dependencies between findings, no view of which findings actually shoot vs theoretical risks, and no view of which can be done in parallel.

Layered on top: the user has explicitly directed that **this is not a refactor-for-refactor exercise**. The goal is to find problems that have already shot or are about to shoot, plus architectural blockers for the first real blueprint, and fix only those. Cleanup-for-consistency findings are deliberately deferred.

This spec defines the process to produce `docs/audit/00-waves.md` — the operational document that turns the audit corpus into a wave-ordered, triage-classified, dependency-aware plan.

---

## 2 / Inclusion model

Each finding from the audit corpus is classified into exactly one **category** during triage. Only `🔥 fire`, `🔫 gun`, and `🚧 blueprint` enter execution waves. The other categories are tracked but not actioned in this cycle.

| Category | Definition | Wave-eligible |
|---|---|---|
| `🔥 fire` | Already shooting: a test/build is broken, an observed bug is in code, an incompatibility is producing duplicate bundles or silent breakage. | Yes |
| `🔫 gun` | Loaded but not shot yet: security gap that becomes an incident at first prod deploy; silent data corruption mechanism; error-contract violation; freshness/idempotency invariant break. | Yes |
| `🚧 blueprint` | Architectural item that blocks the first real blueprint (identity module via auth0/clerk + live Redpanda Kafka + Operaton BPMN orchestration). | Yes |
| `🤔 decide` | Real per audit, but resolution requires a product or architectural decision (e.g. TLS strategy, surface API redesign, shape registry priority, actor ID format rules). | No — parked on decision input |
| `📦 park` | Real per audit, but no shoot observed and no foreseeable shoot. Cleanup-for-consistency, refactor-for-elegance, premature abstraction. Each park unit MUST have a `re-evaluate when:` trigger; no trigger ⇒ falls back to `🤔 decide`. | No — re-evaluated on trigger |
| `❌ rejected` | False positive after verification: code referenced no longer exists, condition is already fixed, audit reasoning contradicted by current state, or duplicate of another unit. | No — recorded with reason |

**Triage decision tree.** Each verified finding runs top-to-bottom; first match wins:

```
Q1: Уже шумит? (test failing | build failing | observed bug | live error in logs)
    ├ Yes → 🔥 fire
    └ No → Q2

Q2: Заряженный пистолет? (security gap | silent data corruption | error-contract violation
                          | freshness/idempotency invariant break)
    ├ Yes → 🔫 gun
    └ No → Q3

Q3: Блокирует первый blueprint?
    Decoders (any "yes" → blueprint blocker):
      (a) identity contracts/modules/conformance
      (b) event-store/projection-consumer/bus (live Kafka readiness)
      (c) module-skeleton/manifest/runtime command-query routing (Operaton entry)
      (d) HTTP transport as auth entry point
    ├ Yes → 🚧 blueprint
    └ No → Q4

Q4: Требует продуктового/архитектурного решения?
    ├ Yes → 🤔 decide
    └ No → 📦 park (with mandatory re-evaluate when:)
```

The decision selected at each Q is recorded in the unit's `triage rationale` field as a short phrase.

**Severity vs category.** They are recorded separately. `severity` is what the auditor saw; `category` is what we decided to do. They can diverge (an auditor's `Blocker` may end up `📦 park` if there is no shoot path; an auditor's `Low` may end up `🚧 blueprint` if it touches identity contracts). Divergence is documented in `triage rationale` with the phrase `severity-vs-category-mismatch: <reason>`.

---

## 3 / Verification policy

Verification is the most expensive step. Policy is **smart sampling** (option B from brainstorming):

| Severity (auditor) | Verification |
|---|---|
| Blocker | 100% — open files, confirm condition exists at current `HEAD`. |
| High | 100% — same as Blocker. |
| Medium | ~30% spot-check per package. If any sampled item turns out to be a false positive, **expand to 100% for that package** (signal that the auditor was systematically wrong on this scope). |
| Low | Not verified by default. Verified opportunistically if it falls into the same file as a verified High/Medium. |
| Systemic (RNT-230) | Verified by tooling, not file reads: `git status`, `git submodule status`, `pnpm ls`, `pnpm why`, grep across `package.json`. |

The audit comment date for every report is `2026-04-28`. For findings flagged `verified: ✗`, run `git log -- <file> --since=2026-04-28` to find the commit that snapped the condition; record it in `triage rationale` (`fixed by <hash>`).

**Delegation.** Verification of 32 packages is parallelisable. Use Explore agents with narrow per-package prompts: "open file X, find function Y, confirm condition Z, return ✓/✗ + one-line reason". One agent per package; dispatched in parallel batches.

Verification status is recorded per unit:
- `✓` — read code, confirms the audit finding.
- `✗` — read code, does not confirm; auto-routes to `❌ rejected` with reason in `triage rationale`.
- `skipped` — not verified per policy (allowed only for Low with concrete file:line evidence).
- `n/a` — systemic finding verified by tooling rather than file reads.

---

## 4 / Output document layout

Final artifact: `docs/audit/00-waves.md`. The `00-` prefix sorts it first in `docs/audit/` next to `README.md`. It is a **living document**: updated as units close, get re-categorised, or as DECIDE answers arrive.

Sections, top to bottom:

1. **Header.** Build date; commit hash at verification time; link to this spec; one-paragraph triage formula; one-line definition of each category. Plus a `last-updated:` log.
2. **Lens A — Wave timeline (operational view).** Waves in execution order. Per wave: title, one-sentence focus, bullet list of units (`<unit-id>` — `<short title>` — `<package>` — `<category emoji>`), explicit `co-edits: <file>` subgroups, exit criteria.
3. **Lens B — Findings ledger (data view).** One large table with all units. Columns:
   - `id` — `U-001..U-NNN` global, immutable, never reused.
   - `pkg` — canonical package name or `monorepo` for systemic; comma-list if cross-package.
   - `audit-ref` — `RNT-XXX#N` or list when one symptom appears in multiple audits.
   - `severity` — auditor's classification.
   - `category` — triage outcome.
   - `wave` — `W1 | W2..Wm | Wp | blocked-on-decide | —` (where `Wm` is the last per-package cleanup wave; `Wp` is the polish wave; `—` means not in DEV track).
   - `verified` — `✓ | ✗ | skipped | n/a`.
   - `evidence` — `file:function` or short quote, ≤ 80 chars; no line numbers.
   - `triage rationale` — short phrase explaining category choice.
   - `depends-on` — list of unit ids that must close first.
   - `co-edits` — list of files this unit shares with another unit in the same wave.
   - `owner-hint` — optional, copied from audit `Owner:` field.
   - `linked-spec` — optional, path to a related spec.
4. **Lens C — Per-package index (auditor view).** One subsection per package. Content per package: `total findings: N`, `→ DEV: ids…`, `→ DECIDE: ids…`, `→ PARK: ids…`, `→ REJECTED: ids…`. No content duplication — links to ledger only.
5. **Track DECIDE.** One subsection per open question: background, options, units blocked on this decision (`blocks: U-XXX`), explicit owner question (`@vlad: …`).
6. **Track PARK.** Grouped by `re-evaluate when:` trigger. Inside each group: bullet list of unit ids with one-line audit summary.
7. **Track REJECTED.** List of unit ids with one-line reason (outdated / no longer applies / contradicted by code / duplicate of …).
8. **Footer / appendix.** Audit meta-observations: contradictions between auditors; cross-cutting consistency themes (with park/decide rationale); proposed CI guardrails (deferred to polish wave by default).

**Unit schema rules:**
- ID is `U-NNN` only — does not encode category or severity, because category can shift on re-triage and IDs must not migrate.
- Units do **not** duplicate full audit text. Source text stays in `docs/audit/<pkg>/README.md`, accessed via `audit-ref`.
- Units do **not** include time estimates.
- Co-edits are computed automatically at wave-assembly time (§5), after every unit has a `wave` value: any file appearing in `evidence` of ≥2 units within the same wave is added to `co-edits` for each of those units.

---

## 5 / Wave assembly

Hybrid ordering (option C from brainstorming): **systemic foundation → blueprint readiness → per-package cleanup → polish**.

### Wave W1 — Foundation

Purpose: stabilise the workspace so subsequent waves can be verified by `pnpm -r run build` / `pnpm -r run test` and so topology changes don't invalidate later fixes.

Includes:
- All `🔥 fire` units that break workspace-wide build or test.
- Systemic topology-changing units from RNT-230 that triage to fire/gun/blueprint:
  - H1 — pnpm catalogs / version unification (after which many per-package version-bump findings auto-reject as covered).
  - H4 — seed split (runtime/seed dependency type), if it triages as blueprint blocker.
  - B3 — bindings-grpc → bindings-http extraction, if it triages as blueprint blocker.
  - B2 — runtime god-package split: included in W1 **only** if it triages as 🚧 blueprint via Q3(c). Otherwise → `🤔 decide`.

Exit criteria:
- `pnpm -r run build` is green without per-package `build:deps` scripts.
- `pnpm -r run test` is green.
- Single version per shared external dep (typescript, vitest, protobufjs, grpc-js, better-sqlite3).
- No `runtime → seed` in production deps; no `bindings-grpc → bindings-http` in production deps.

### Waves W2..Wk — Blueprint readiness

Purpose: unblock the first real blueprint (identity module + Redpanda + Operaton). Three parallel sub-waves, axis-aligned to the blueprint's components:

- **W2 — Identity surface readiness.** Units in `contracts-identity-v1`, `conformance-identity`, `identity-auth0`, `identity-clerk`, plus `H3` (conformance dev/prod normalization) if not absorbed by W1, plus HTTP-transport hardening (body limits, TLS) if blueprint-blocker.
- **W3 — Event bus / projection live readiness.** Units in `event-store`, `projection-consumer`, `runtime/projections/*`, the InMemoryBus → Redpanda transition area. Critical: idempotency UPSERT, single-writer event log invariants, monotonic publish cursor, retention env validation.
- **W4 — Module-skeleton / manifest / runtime CQR.** Units in `module-skeleton`, `runtime/manifest/*`, `runtime/start/*`, `runtime/load/*`, plus boot-pipeline error handling and config validation findings.

W2/W3/W4 are independent by default. If the ledger reveals dependencies between them (e.g. a W2 unit changes a surface contract that W3 depends on), the dependency is recorded as `depends-on` and the affected unit is moved to a later wave or split into W2a/W2b.

### Waves Wk+1..Wm — Per-package cleanup

Purpose: clear remaining `🔥 fire` and `🔫 gun` units that don't block the blueprint.

Order by layer: contracts → core (pdm/qsm/event-store) → compilation (graph-ir-compiler) → transport (bindings/http/grpc) → runtime → tooling (blueprint/seed/db-studio) → modules → demos. Within a layer, units are parallel by package.

A package may produce multiple sequential blocks if its units share files. Co-edits are recorded explicitly.

### Wave Wp — Polish (last)

Includes:
- Remaining `Low` units with concrete evidence (descriptions, .gitignore, testTimeout, package.json files entries).
- CI guardrails from RNT-230 §3: `dependency-cruiser`, `pnpm.catalogs` enforcement, `eslint no-internal-modules`, `workspace:^` ban, dependency graph diff in PR.
- Coverage gates (`@vitest/coverage-v8`).

Wp is strictly last. Adding CI guardrails before foundation/blueprint work is finished would fail every PR on intermediate state.

### Wave assembly invariants

After ledger is filled, validate:

1. **No backward dependency.** ∀ unit `u` in `W_i`: ∀ `d ∈ u.depends-on`: `d.wave ∈ {W_1..W_{i-1}}`. Violation ⇒ move `u` one wave later, recompute.
2. **Co-edits annotated.** ∀ file `f`: if `|{u : f ∈ u.evidence ∧ u.wave = W_i}| ≥ 2`, annotate every such unit with `co-edits: f`.
3. **Park has trigger.** Every `📦 park` unit has non-empty `re-evaluate when:`. Empty trigger ⇒ promote to `🤔 decide` (with question "what makes this urgent?").

Validation runs at spec-self-review time of the produced `00-waves.md`, not at runtime.

---

## 6 / Edge cases

| ID | Situation | Rule |
|---|---|---|
| E1 | Audit references obsolete code | Check `git log -- <file> --since=2026-04-28`. If a fixing commit exists, set `verified: ✗`, route to `❌ rejected`, record commit hash in `triage rationale`. |
| E2 | Two auditors contradict | One unit, both `audit-ref`s, `triage rationale: disagreement: <view-1> vs <view-2>; resolved by: <our reading>`. If unresolvable in code, `🤔 decide` with `decide-type: auditor-disagreement`. |
| E3 | Adjacent bug discovered during verification | Record as new unit with `audit-ref: discovered-during-U-MMM`. Do not expand verification scope. Stop after the one adjacent finding. |
| E4 | Finding in deprecated code (e.g. `issue-tracker-api-demo`) | Default `📦 park` with `re-evaluate when: replaced by canonical example`. Exception: if it breaks CI **right now**, treat as `🔥 fire` even in deprecated code. |
| E5 | Recommendation without concrete evidence ("add Y for consistency") | Default `📦 park` with `re-evaluate when: someone reports the actual confusion`. |
| E6 | Blueprint blocker but resolution needs product input | Unit lives in both DEV (`category: 🚧 blueprint`, `wave: blocked-on-decide`) and DECIDE (with `blocks: U-XXX`). |
| E7 | Cross-cutting consistency theme at varied maturity across packages | Single systemic unit `📦 park` (or `🤔 decide`) by default. Local per-package units of the same theme are also `park` with `re-evaluate when: systemic decision made`. Do **not** fan out into per-package waves. |
| E8 | Auditor's Blocker triages to park | Keep `severity: Blocker`, set `category: 📦 park`, write `triage rationale: severity-vs-category-mismatch — <reason>`. |
| E9 | Finding fits two categories | One category only. Hierarchy: `🔥 fire > 🔫 gun > 🚧 blueprint > 🤔 decide > 📦 park`. Note the secondary category in `triage rationale`. |
| E10 | False positive due to root-level config | Verify both per-package and root. If root covers, `verified: ✗` → `❌ rejected` with reason `covered by root <config>`. |

---

## 7 / Lifecycle

`00-waves.md` is a living document; this spec is canonical process.

- **Closing a unit.** When the PR fixing a unit is merged, set `status: done`, `closed-by: <PR#>`. Unit stays in the ledger for traceability; not deleted.
- **Re-categorising.** If a `📦 park` unit shoots, change `category`, move to an active wave, append `recategorized YYYY-MM-DD: <event>` to `triage rationale`.
- **New findings (not from audit).** Add as new unit, `audit-ref: discovered-YYYY-MM-DD`, run through triage.
- **DECIDE answer arrives.** Move the unit to DEV or PARK as appropriate; record `decided YYYY-MM-DD: <decision>` in `triage rationale`.
- **Header.** Snapshot fields (initial build date, initial commit hash) never edited. `last-updated:` log appended on each significant edit.

**Process changes** (e.g. updating the decision tree) are made by editing this spec, with rationale recorded; the previous version moves to `docs/superpowers/specs/done/`.

**Implementation plans.** After `00-waves.md` is approved, the writing-plans skill produces:
- One plan for W1 (foundation).
- One plan per W2/W3/W4 (blueprint readiness).
- One plan for Wp (polish).
- Per-package cleanup waves (W5..Wm) — one plan per wave or one combined plan, decided at writing-plans time based on volume.

Each plan MUST include a documentation-touch task for any package whose README, AGENTS.md (§3 / §6 / §10), root README, CLAUDE.md "Architecture in one paragraph", `docs/architecture.md`, or `vision.md` is affected by the wave's code changes (per CLAUDE.md and AGENTS.md §11).

**Multica sync.** Original audit findings live in Multica issues `RNT-199..230`. The audit corpus in `docs/audit/` is read-only mirror; we do not edit it. State changes in `00-waves.md` are not auto-replicated to Multica. Reverse linkage via `closed-by: <PR#>` (GitHub may surface this in Multica if integration is configured). If integration is missing, that is a separate DECIDE item — not a blocker for assembling `00-waves.md`.

---

## 8 / Out of scope (explicit)

- Writing fixes for any audit finding.
- Effort estimation in time units.
- Discovering new findings beyond what was caught while verifying an audit-listed finding (per E3).
- Rewriting or editing the per-package audit snapshots in `docs/audit/<pkg>/README.md`.
- Auto-replicating state to Multica.
- Closing DECIDE questions on the user's behalf.

---

## 9 / Deliverable

A single file: `docs/audit/00-waves.md`.

The file is produced by following this spec in three sequential phases, each parallelisable internally:

1. **Extract** all atomic findings from `docs/audit/**/README.md` into a raw ledger.
2. **Verify + triage** each finding per §3 and §2 (delegated to per-package Explore agents).
3. **Assemble** the document per §4–§5, validate invariants per §5, write to `docs/audit/00-waves.md`, commit.

The next step after this spec is approved: invoke the `superpowers:writing-plans` skill to produce the implementation plan that executes phases 1–3.
