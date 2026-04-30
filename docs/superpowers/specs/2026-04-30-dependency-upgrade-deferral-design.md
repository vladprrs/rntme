# Dependency Upgrade Deferral — Design

**Status:** standing decision document (re-evaluated on event triggers and a 6-month calendar fallback)
**Source data:** `docs/research/INDEX.md` and 28 per-cluster research documents under `docs/research/`, all dated 2026-04-28
**Companion:** `docs/audit/00-waves.md` (Deferred initiatives section references this spec)

## 1. Why this spec exists

Between RNT-298 and RNT-325 we researched 28 dependency areas of rntme — current versions, latest stable, breaking changes, security advisories, and migration cost. The research was explicitly research-only ("runtime dependency changes belong in separate implementation issues"). This spec records the **decision that follows**: at 2026-04-30, all 28 clusters are deferred. The document does three jobs:

1. **Preserves the research investment.** 28 research documents in `docs/research/` remain the canonical baseline we return to when a re-evaluate trigger fires. Without an explicit decision document, those research files would silently age into "outdated, must re-investigate" within 6–9 months.
2. **Defends against audit duplication.** Future passes of `docs/audit/00-waves.md` will surface findings like "grpc-js / protobufjs / typescript / vitest have multiple versions across packages" (the audit already parks U-004 with that exact phrasing). This spec gives those audit units a canonical answer instead of letting them spawn duplicate fix issues.
3. **Makes the deferral conscious, not silent.** Without a record, in 3 months no one will remember *why* hono was not upgraded, and the upgrade will happen unplanned at an inconvenient moment. Each deferral here has a stated reason and a verifiable trigger.

## 2. Goals

- Record per-cluster deferral decisions with explicit re-evaluate triggers (Section 5).
- Define the operational machinery — how triggers are detected, how this spec is updated when a cluster un-defers, and what happens at the 6-month calendar fallback (Section 6).
- Specify documentation touches required by `AGENTS.md §11` for this spec itself (Section 7).

## 3. Non-goals

- This spec does not change code, `package.json` files, lockfiles, Dockerfiles, or CI workflows.
- It does not produce per-cluster implementation plans. Those are written when a trigger fires, via `/superpowers:brainstorming`.
- It does not re-do the research. `docs/research/<pkg>/README.md` remains source of truth on versions, breaking changes, and security advisories.
- It does not block individual emergency CVE-driven bumps. If a critical vulnerability lands on a single dependency, it is fixed in a focused issue and this spec is updated with a re-evaluate entry.

## 4. Premises (for self-check after N months)

These are the conditions under which the deferral logic is sound. If any of them stop being true, the entire spec needs re-evaluation, not just individual rows.

- **rntme is pre-revenue, no users.** No external pressure to apply application-level security patches. The threat surface is internal.
- **Three large migrations are on the horizon and will obsolete significant portions of current dependency choices:**
  - **Bun migration** — replaces `better-sqlite3` (Bun has built-in SQLite) and `@hono/node-server` (Bun has native `serve()`).
  - **Platform-on-rntme dogfooding** — rewrites `rntme-cli/packages/platform-*` on top of rntme primitives, obsoleting the current `pg` / `drizzle-orm` / `drizzle-kit` / `@aws-sdk/*` / `@workos-inc/node` / `@hono/zod-openapi` / `testcontainers` choices in those packages.
  - **Identity module rework** — rescopes `modules/identity/auth0` and `modules/identity/workos`, obsoleting their current SDK versions before any v5/v8 migration cost is paid.
- **TypeScript 6.0 is an explicit bridge to TS 7.0** (Go rewrite). 5 → 6 → 7 is strictly more expensive than 5 → 7 once 7.0 RC is published.
- **Engineering opportunity cost is high.** Audit waves W2–W15 are in flight (`docs/audit/00-waves.md`); MVP work outranks tooling debt at the current stage.

If rntme leaves pre-revenue, or any of the three planned migrations is cancelled, the rows blocked by them must be re-triaged from scratch.

## 5. Decision matrix

Each cluster: current → researched-latest, decision, re-evaluate trigger. All rows are `Defer` unless marked otherwise.

| # | Cluster | Current → researched-latest | Decision | Re-evaluate trigger |
|---|---|---|---|---|
| 1 | `better-sqlite3` (8 packages) | `^11.x` → `^12.9.0` | Defer | Bun migration spec lands or is rejected |
| 2 | `@hono/node-server` (`@rntme/runtime`) | `^1.13.x` → `2.0.0` | Defer | Same — Bun replaces the Node adapter |
| 3 | `pg`, `drizzle-orm`, `drizzle-kit`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (platform-storage) | mixed → latest | Defer | platform-on-rntme migration spec lands or is rejected |
| 4 | `@hono/zod-openapi` (platform-http only) | `^0.16.0` → `1.3.0` | Defer | Same |
| 5 | `testcontainers`, `@testcontainers/postgresql` (platform packages only) | `^10.13` → `11.14.0` | Defer | Same |
| 6 | `@workos-inc/node` (identity module + platform-http) | `^7.82` → `9.1.1` | Defer | Identity module rework scope published AND/OR platform migration spec lands |
| 7 | `auth0` (`modules/identity/auth0`) | `4.28.0` → `5.8.0` | Defer | Identity module rework scope published |
| 8 | `astro`, `@astrojs/react`, `@astrojs/mdx`, `react`/`react-dom`/`@types/react` in landing | mixed → latest | Defer | Landing strategy decision (rewrite / keep / deprecate) published |
| 9 | `hono` (`bindings-http`, `db-studio`, `ui-runtime`, `runtime`) | `^4.6.0` → `4.12.15` | Defer | Any of: (a) first paying user, (b) CVE with exploitable surface on 4.6.x, (c) inclusion in a larger wave |
| 10 | `pino` (`runtime`, `bindings-http`) | `^9.x` → `10.3.1` | Defer | Same |
| 11 | `@grpc/grpc-js`, `@grpc/proto-loader` unification (`runtime`, `bindings-grpc`, demo) | mixed → `1.14.3` / `0.8.0` | Defer | Same OR conformance-suite test failure caused by version drift (relates to audit U-004) |
| 12 | `protobufjs`, `protobufjs-cli` unification (contracts/*, `bindings-grpc`, `runtime`, demo) | mixed → `8.0.3` / `2.0.3` | Defer | Same |
| 13 | `@types/react` in `ui-runtime` (mismatched with React 19 runtime) | `^18.3.x` → `19.2.14` | Defer | TS types break ui-runtime build OR TypeScript 6/7 wave fires |
| 14 | `@json-render/core/react/shadcn` (`ui-runtime`) | `^0.17.0` → `0.18.0` | Defer | Required by a feature OR bundled into another UI wave |
| 15 | `tailwindcss`, `@tailwindcss/cli` (`ui-runtime`) | `^4.2.2` → `4.2.4` | Defer | Same |
| 16 | `msw` (rntme-cli tests) | `^2.4.9` → `2.13.6` | Defer | Test failure from staleness OR bundled into tooling wave |
| 17 | `tsx`, `esbuild` (`ui-runtime`, demo) | mixed → `4.21.0` / `0.28.0` | Defer | Same |
| 18 | `vitest` repo-wide | `^2.1.x` → `4.1.5` | Defer | Bundled into TypeScript 7 wave (see #20) OR vitest 2.x stops working on a future Node version |
| 19 | `eslint`, `@eslint/js`, `@typescript-eslint/*`, `prettier` repo-wide | mixed → `10.2.1` / `10.0.1` / `8.59.1` / `3.8.3` | Defer | Bundled into TypeScript 7 wave (see #20) OR ESLint 9.x dropped from active support, breaks on future Node, or `@typescript-eslint` requires TS 6+ |
| 20 | `typescript`, `@types/node` repo-wide (38+ packages) | `5.5/5.6` → `6.0.3`; `^20.14` → `25.6.0` | Defer | TypeScript 7.0 RC published — migrate `5 → 7` directly, not via 6 |
| 21 | `node:20-alpine`/`slim` Docker base, GitHub Actions stack | `node:20` / mixed → `node:22` / latest | Defer | Any of: (a) Node 20 OS-level CVE — Node 20 LTS reaches EOL in April 2026, monitor NVD, (b) first user-facing deploy of any rntme service, (c) Bun migration |
| 22 | `prom-client` | `15.1.3` → `15.1.3` (already latest) | No-op | OpenTelemetry migration spike (Q3–Q4 2026 per research recommendation) |
| 23 | `zod`, `@clerk/backend`, `@bitrix24/b24jssdk`, `@shevernitskiy/amo` | all on latest | No-op | New major release of any one (caught by 6-month research-refresh, Section 6) |
| 24 | `fast-check` (declared but unused in `packages/platform-core`) | — → remove | Defer (trivial) | Any housekeeping PR may delete in a one-liner; no formal trigger |

### Notes on the matrix

**On rows 9–19 (low-risk upgrades we could do today).** These would have formed a "W0 cleanup" wave under the original 6-wave plan. Deferring them is a conscious choice to spend engineering time on MVP and audit waves W2–W15 instead. Each row carries a "inclusion in a larger wave" fallback trigger — when a future wave (Bun, platform, TS 7) opens any of the relevant package.json files, these patch bumps are swept along. The cost: a slightly larger version delta when the larger wave eventually lands. This is acceptable at the pre-stable stage.

**On row 21 (Node 20 / GitHub Actions).** This is the highest-risk row in the deferral list. Node 20 LTS reaches EOL in April 2026 — i.e., this month. After EOL, the `node:20-alpine` and `node:20-slim` images will not receive OS-level security patches. The deferral works only because rntme has no user-facing deploys; the moment that changes, this row triggers immediately. Until then, the trade-off is explicit: we accept missing OS-level patches on internal CI/test images in exchange for not opening 38+ Dockerfile / workflow changes during MVP work.

**On row 20 (TypeScript major).** The deferral is anchored on TS 7.0 (Go rewrite). If the TS 7 timeline slips materially (e.g., no RC by 2026-12), this row will need re-evaluation against TS 6.x security and `@types/*` compatibility pressure. Track via the 6-month refresh.

## 6. Re-evaluate machinery

### How triggers are detected

Triggers fall into three categories, each with a different detection path. Triggers are useless unless someone sees them — the spec must be linked from the places where the events surface.

1. **Event-driven triggers** (Bun spec lands, platform migration spec lands, identity rework scope published, landing strategy published) — detected via **back-references in the source spec**. When any of those parent specs is written via `/superpowers:brainstorming`, its "Out of scope / dependencies" section MUST link back to this spec and list the rows (#1, #2, #3–5, #6–7, #8) that the parent spec un-blocks. A parent migration spec without that back-reference is incomplete.

2. **CVE-driven triggers** (row 21 unconditionally; rows 9–12 conditionally on critical advisories) — detected via **GitHub Dependabot security advisories** on the repository plus an **NVD search alert** keyed to `node:20-alpine`. Dependabot is configured to security-update-only (no version-bump noise). Any security advisory on a package listed in the matrix triggers a re-evaluate of that row.

3. **Build-failure triggers** (test failure from version drift, breaking change on a future Node version) — detected by CI without additional machinery.

### What happens when a trigger fires

1. A new issue is opened: `RNT-XXX: Re-evaluate dependency cluster #N (<name>)`.
2. The issue links to (a) the matrix row, (b) the original `docs/research/<pkg>/README.md`, (c) the triggering event (advisory ID, parent spec, audit unit, etc.).
3. A per-cluster spec is written via `/superpowers:brainstorming`. **The research document is re-checked first** — between 2026-04-28 and the trigger date, new versions, new advisories, and new alternatives may have materialized.
4. After the per-cluster spec lands, **this matrix is updated**: the row's `Decision` column changes from `Defer` to `RESOLVED YYYY-MM-DD via spec X`. The row is not deleted — its history must remain auditable.

### Calendar fallback (6-month refresh)

If no event-driven trigger has fired, a **research refresh** runs on **2026-10-30**:

- Re-investigate all 28 clusters (versions, breaking changes, advisories, alternatives).
- Update `docs/research/<pkg>/README.md` for each in place.
- Update this matrix where the deferral logic has shifted (a planned migration is cancelled, a security advisory has appeared, a major version has GA'd).
- Append a Changelog entry: `refreshed 2026-10-30, no changes` or describe the changes.

The refresh is non-negotiable even if every parent migration is still in flight — ecosystem drift makes 9-month-old research dangerous as a future decision baseline.

**Operational anchor.** At merge time of this spec, schedule a remote agent for 2026-10-30 to run the refresh (open one master "research refresh: 2026-10-30" issue with a checklist of the 28 clusters, plus 28 sub-issues). Without the scheduled trigger the calendar fallback is forgotten within 2 weeks.

### Update protocol for this spec

| Event | Change to this spec |
|---|---|
| Trigger fires, cluster goes into work | Row's `Decision` column → `IN PROGRESS via spec X` |
| Per-cluster spec lands | Row's `Decision` column → `RESOLVED YYYY-MM-DD via spec X` |
| 6-month refresh, no changes | Append Changelog entry: `refreshed YYYY-MM-DD, no changes` |
| 6-month refresh, decisions shift | Rewrite affected rows; append Changelog entry summarizing changes |
| Audit wave touches a row | Audit wave references the row and closes its unit as `deferred per <this spec>` |

### Ownership

This spec is a shared project artifact, not a personal note. **Any contributor** who opens a per-cluster spec must update the corresponding matrix row in the same PR. **Any security incident** affecting a row updates the trigger immediately. If those updates do not happen, the spec loses value within 2–3 months and must be either revived or deleted — a half-maintained deferral record is worse than none.

## 7. Documentation touches

Per `AGENTS.md §11`, every spec must record its documentation impact. For a deferral decision record most checklist items do not apply, but three touches are required to keep the spec from living in isolation.

### Required at merge time

1. **`docs/research/INDEX.md`** — add a "Decision status" block above the table:

   > Decision status (as of 2026-04-30): all 28 research areas are **deferred**. See [`docs/superpowers/specs/2026-04-30-dependency-upgrade-deferral-design.md`](../superpowers/specs/2026-04-30-dependency-upgrade-deferral-design.md) for per-cluster decisions, re-evaluate triggers, and 6-month refresh cadence.

   Without this link, a reader of `INDEX.md` sees only "research-only evidence for future migration planning" and does not learn that a decision has already been made.

2. **`docs/audit/00-waves.md`** — add a "Deferred initiatives" section between "Last updated" and "Lens A":

   > **Dependency upgrades (RNT-298…325):** all 28 research clusters deferred per [`2026-04-30-dependency-upgrade-deferral-design.md`](../superpowers/specs/2026-04-30-dependency-upgrade-deferral-design.md). Audit volumes that surface outdated-version units (e.g. U-004) MUST cross-reference this spec instead of opening duplicate fix work.

   Without this link, future audit passes will keep parking duplicates of U-004 ("grpc-js, protobufjs, better-sqlite3, typescript, vitest have multiple versions across pkgs") with no canonical resolution.

3. **Scheduled research-refresh agent for 2026-10-30** — not a documentation touch in the conventional sense, but a critical operational artifact. Without it, the calendar fallback in Section 6 does not work. Created either by the spec author at merge time (`/schedule` command) or as a follow-up task in the same PR.

### Not required (decision record)

| Candidate | Applicable? | Reasoning |
|---|---|---|
| Per-package `README.md` | No | Spec changes no API, invariants, or "Where to look first" pointers |
| `AGENTS.md §3` (layering) | No | No package-level dependency graph changes |
| `AGENTS.md §6` (how-tos) | No | No new recipe; per-cluster specs will own their recipes when they land |
| `AGENTS.md §10` (glossary) | No | No new terminology |
| Root `README.md` packages table / dep graph | No | No package added, removed, or renamed; no edges changed |
| `CLAUDE.md` "Architecture in one paragraph" / "Product positioning" | No | No architectural or positioning shifts |
| `docs/architecture.md` | No | No architectural decision recorded; this is a housekeeping decision |
| `vision.md` | No | Not market-facing |

### Self-reference invariant

When a per-cluster spec un-defers a row (Section 6), that spec's own documentation-touch section MUST include "updates the deferral matrix in `2026-04-30-dependency-upgrade-deferral-design.md`". This closes the loop: no cluster can be unfrozen without keeping the source of truth current.

## 8. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Spec rots: nobody updates the matrix when triggers fire | Medium | Section 6 ownership clause + Section 7 self-reference invariant make it a hard PR-checklist item. The 6-month refresh catches the rot if PR discipline slips. |
| Calendar fallback forgotten | High without `/schedule`; low with it | Hard requirement in Section 7 to schedule the refresh agent at merge time. |
| Premise #4 (rntme stays pre-revenue) breaks silently | Low | Row 21 trigger explicitly fires on "first user-facing deploy". Other rows (#9–#19) have the same fallback wording. |
| TS 7.0 timeline slips, TS 6.x compatibility pressure mounts | Medium | 6-month refresh re-evaluates row 20 against current TS 7 RC status. |
| `node:20-alpine` CVE published, no one notices | Low (NVD alert) → medium without the alert | Row 21 mitigation language calls out the NVD alert as an operational requirement, not a hope. |
| Audit wave reads matrix row, opens duplicate work anyway | Low after touch #2 | Touch #2 puts the cross-reference into the audit doc itself, not just here. |

## 9. Changelog

| Date | Event | Notes |
|---|---|---|
| 2026-04-30 | Spec created and merged | Initial deferral of all 28 research clusters; 6-month refresh scheduled for 2026-10-30. |

## 10. Appendix — research document index

Each row in the matrix maps to one of the 28 research documents under `docs/research/`. Listed by cluster ID for ease of cross-reference:

- #1 `better-sqlite3` — [`docs/research/better-sqlite3/README.md`](../../research/better-sqlite3/README.md)
- #2 `@hono/node-server` — part of [`docs/research/hono-plus-hono-node-server-plus-hono-zod-openapi/README.md`](../../research/hono-plus-hono-node-server-plus-hono-zod-openapi/README.md)
- #3 platform DB / S3 — [`docs/research/pg/README.md`](../../research/pg/README.md), [`docs/research/drizzle-orm-plus-drizzle-kit/README.md`](../../research/drizzle-orm-plus-drizzle-kit/README.md), [`docs/research/aws-sdk-client-s3-plus-aws-sdk-s3-request-presigner/README.md`](../../research/aws-sdk-client-s3-plus-aws-sdk-s3-request-presigner/README.md)
- #4 `@hono/zod-openapi` — part of [`docs/research/hono-plus-hono-node-server-plus-hono-zod-openapi/README.md`](../../research/hono-plus-hono-node-server-plus-hono-zod-openapi/README.md)
- #5 `testcontainers` — [`docs/research/testcontainers-plus-testcontainers-postgresql/README.md`](../../research/testcontainers-plus-testcontainers-postgresql/README.md)
- #6 `@workos-inc/node` — [`docs/research/workos-inc-node/README.md`](../../research/workos-inc-node/README.md)
- #7 `auth0` — [`docs/research/auth0/README.md`](../../research/auth0/README.md)
- #8 landing UI stack — [`docs/research/astro-plus-astrojs-react-plus-astrojs-mdx/README.md`](../../research/astro-plus-astrojs-react-plus-astrojs-mdx/README.md), [`docs/research/react-plus-react-dom/README.md`](../../research/react-plus-react-dom/README.md)
- #9 `hono` — [`docs/research/hono-plus-hono-node-server-plus-hono-zod-openapi/README.md`](../../research/hono-plus-hono-node-server-plus-hono-zod-openapi/README.md)
- #10 `pino` — [`docs/research/pino/README.md`](../../research/pino/README.md)
- #11 gRPC — [`docs/research/grpc-grpc-js-plus-grpc-proto-loader/README.md`](../../research/grpc-grpc-js-plus-grpc-proto-loader/README.md)
- #12 protobufjs — [`docs/research/protobufjs-plus-protobufjs-cli/README.md`](../../research/protobufjs-plus-protobufjs-cli/README.md)
- #13 `@types/react` in ui-runtime — part of [`docs/research/react-plus-react-dom/README.md`](../../research/react-plus-react-dom/README.md)
- #14 `@json-render/*` — [`docs/research/json-render-core-plus-json-render-react-plus-json-render-shadcn/README.md`](../../research/json-render-core-plus-json-render-react-plus-json-render-shadcn/README.md)
- #15 `tailwindcss` — [`docs/research/tailwindcss-plus-tailwindcss-cli/README.md`](../../research/tailwindcss-plus-tailwindcss-cli/README.md)
- #16 `msw` — [`docs/research/msw/README.md`](../../research/msw/README.md)
- #17 `tsx` / `esbuild` — [`docs/research/tsx-plus-esbuild/README.md`](../../research/tsx-plus-esbuild/README.md)
- #18 `vitest` — [`docs/research/vitest-plus-vitest-ui/README.md`](../../research/vitest-plus-vitest-ui/README.md)
- #19 ESLint / prettier — [`docs/research/eslint-plus-eslint-js-plus-typescript-eslint-plus-prettier/README.md`](../../research/eslint-plus-eslint-js-plus-typescript-eslint-plus-prettier/README.md)
- #20 TypeScript / `@types/node` — [`docs/research/typescript/README.md`](../../research/typescript/README.md)
- #21 Docker / GH Actions — [`docs/research/docker-node-20-alpine-slim-runtime-images/README.md`](../../research/docker-node-20-alpine-slim-runtime-images/README.md), [`docs/research/github-actions-workflow-stack/README.md`](../../research/github-actions-workflow-stack/README.md)
- #22 `prom-client` — [`docs/research/prom-client/README.md`](../../research/prom-client/README.md)
- #23 already-latest cluster — [`docs/research/zod/README.md`](../../research/zod/README.md), [`docs/research/clerk-backend/README.md`](../../research/clerk-backend/README.md), [`docs/research/bitrix24-b24jssdk/README.md`](../../research/bitrix24-b24jssdk/README.md), [`docs/research/shevernitskiy-amo/README.md`](../../research/shevernitskiy-amo/README.md)
- #24 `fast-check` — [`docs/research/fast-check/README.md`](../../research/fast-check/README.md)
