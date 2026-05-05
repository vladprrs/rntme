# Audit waves — consolidated planning

> **Status:** reconciled through merged waves W2, W3, W4, W7, W8, W10, W13, W14, and W15. See [spec](../superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md) for the canonical process.
>
> **2026-05-01 note.** Three packages were removed wholesale: `@rntme/db-studio` (superseded by Drizzle Studio per the drizzle-adoption spec), `@rntme/issue-tracker-api-demo` (replaced by `demo/notes-blueprint` as the project-shape canonical example), and `@rntme/pre-step-demo`. All `📦 park` findings against those packages are obsolete; their per-package audit folders under `docs/audit/@rntme/` were deleted alongside the packages. Skip those rows when triaging.

| Field | Value |
|---|---|
| Build date | 2026-04-28T13:04:52Z |
| Build commit | `b6047e5ac4986ac2e9dfc26075a309fd18c3a227` |
| Audit corpus dir | `docs/audit/` (RNT-199..230, snapshot date 2026-04-28) |
| Spec | `docs/superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md` |
| Initial active units | 355 |
| Rejected (false positives + duplicates + outdated) | 13 |
| Obsolete after follow-up reconciliation | 38 |

## Triage formula (one paragraph)

Each verified finding runs the decision tree: **Q1 already shoots? → fire**; else **Q2 loaded gun? (security/silent-corruption/error-contract/freshness-or-idempotency-break) → gun**; else **Q3 blueprint blocker? (identity / kafka-bus / module-skeleton / http-as-auth-entry) → blueprint**; else **Q4 needs product/architectural decision → decide**; else **park** with mandatory `re-evaluate when:` trigger.

## Categories

- 🔥 **fire** — already shooting; in execution waves
- 🔫 **gun** — loaded but not shot; in execution waves
- 🚧 **blueprint** — blocks first real blueprint (identity + Redpanda + Operaton); in execution waves
- 🤔 **decide** — needs product/architectural input; tracked, not actioned
- 📦 **park** — real per audit but no shoot, no foreseeable shoot; tracked with re-evaluate trigger
- ✅ **closed** — fixed by a landed change; retained for audit traceability
- 🧹 **obsolete** — original package/scope was removed or superseded; no longer actionable
- ❌ **rejected** — false positive, outdated, or duplicate

## Last updated

- 2026-04-28T13:04:52Z — initial build at `b6047e5ac4986ac2e9dfc26075a309fd18c3a227`
- 2026-04-29 — reconciled completed waves W4/W7/W8/W10/W15 after merged PR evidence.
- 2026-04-30 — added Deferred initiatives section (dependency upgrades).
- 2026-05-04 — reconciled completed waves W2/W3 and marked removed demo/db-studio findings obsolete.


---

## Deferred initiatives

- **Dependency upgrades (RNT-298…325):** all 28 research clusters deferred per [`2026-04-30-dependency-upgrade-deferral-design.md`](../superpowers/specs/2026-04-30-dependency-upgrade-deferral-design.md). Audit volumes that surface outdated-version units (e.g. U-004 — multiple versions of grpc-js / protobufjs / better-sqlite3 / typescript / vitest across packages) MUST cross-reference that spec instead of opening duplicate fix work. Re-evaluate triggers and 6-month refresh cadence (next: 2026-10-30) are tracked there.

---

## Lens A — Wave timeline (operational view)

### Wave W2 — Identity surface readiness — auth0/clerk + HTTP entry hardening

**Units (15):**

- [x] U-157 — Conformance suite type contract diverges across identity/ai-llm vs CRM — `@rntme/conformance-identity` — closed in RNT-274 / merge `7414b05`
- [x] U-158 — Missing fixtures-sanity.test.ts to catch protobuf validation drift — `@rntme/conformance-identity` — closed in RNT-274 / merge `7414b05`
- [x] U-159 — Missing canonical Session fixtures despite Session RPCs in contract — `@rntme/conformance-identity` — closed in RNT-274 / merge `7414b05`
- [x] U-160 — Inconsistent suite export naming across conformance packages — `@rntme/conformance-identity` — closed in RNT-274 / merge `7414b05`
- [x] U-161 — Identity README missing Out of scope section — `@rntme/conformance-identity` — closed in RNT-274 / merge `7414b05`
- [x] U-162 — Missing capabilities.ts registry of canonical RPCs and events — `@rntme/conformance-identity` — closed in RNT-274 / merge `7414b05`
- [x] U-163 — No automated guard for error codes and events coverage in scenarios — `@rntme/conformance-identity` — closed in RNT-274 / merge `7414b05`
- [x] U-164 — package.json version 0.0.0 desynced from contractVersion in fixtures — `@rntme/conformance-identity` — closed in RNT-274 / merge `7414b05`
- [x] U-188 — scripts/check-imports.mjs is dead code — `@rntme/contracts-identity-v1` — closed in RNT-274 / merge `7414b05`
- [x] U-189 — Generated proto.gen requires 'long' but package does not declare it — `@rntme/contracts-identity-v1` — closed in RNT-274 / merge `7414b05`
- [x] U-190 — No CI check that .proto and proto.gen.* stay in sync — `@rntme/contracts-identity-v1` — closed in RNT-274 / merge `7414b05`
- [x] U-191 — index.ts re-exports common-v1 primitives, blurring package boundary — `@rntme/contracts-identity-v1` — closed in RNT-274 / merge `7414b05`
- [x] U-192 — Tests do not cover direct exports from src/index.ts — `@rntme/contracts-identity-v1` — closed in RNT-274 / merge `7414b05`
- [x] U-193 — package.json version 0.0.0 does not reflect contract v1 — `@rntme/contracts-identity-v1` — closed in RNT-274 / merge `7414b05`
- [x] U-194 — package.json lacks repository/bugs/homepage metadata — `@rntme/contracts-identity-v1` — closed in RNT-274 / merge `7414b05`

**Co-edits (merge-serialise):**

- `package.js` — U-164, U-188, U-193, U-194

**Exit criteria:**
- Identity contracts pass conformance suite green against auth0 and clerk modules.
- HTTP transport rejects oversized bodies + supports TLS config when relevant.
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W3 — Event bus / projection live readiness — Redpanda transition prerequisites

**Units (8):**

- [x] U-032 — IdempotencyCache — нет автоматической очистки — `@rntme/bindings-http` — closed in RNT-275 / PR #55 / merge `f3f45c4`
- [x] U-206 — ActorRef duplicated locally without sync guarantee with @rntme/pdm — `@rntme/event-store` — closed in RNT-275 / PR #55 / merge `f3f45c4`
- [x] U-207 — serviceName changes semantics of existing events on rename — `@rntme/event-store` — closed in RNT-275 / PR #55 / merge `f3f45c4`
- [x] U-209 — SQLite single-writer has no runtime enforcement — `@rntme/event-store` — closed in RNT-275 / PR #55 / merge `f3f45c4`
- [x] U-263 — README/code mismatch on ApplyResult skipped discriminator — `@rntme/projection-consumer` — closed in RNT-275 / PR #55 / merge `f3f45c4`
- [x] U-264 — ROLLBACK path may overwrite original error cause — `@rntme/projection-consumer` — closed in RNT-275 / PR #55 / merge `f3f45c4`
- [x] U-265 — getDbHandle leaky abstraction bypasses ordering/idempotency — `@rntme/projection-consumer` — closed in RNT-275 / PR #55 / merge `f3f45c4`
- [x] U-287 — seen-events-retention env variable lacks validation — `@rntme/runtime` — closed in RNT-275 / PR #55 / merge `f3f45c4`

**Exit criteria:**
- Event-store passes idempotency / single-writer / monotonic-cursor invariants under integration tests.
- Projection-consumer green with retention env validation.
- InMemoryBus topic isolation verified or replaced with Redpanda-backed bus in test bootstrap.
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W4 — Module-skeleton / manifest / runtime CQR — Operaton-ready boot pipeline

**Units (6):**

- [x] U-235 — ModuleManifest type is a stub that does not reflect the module contract (spec §12) — `@rntme/module-skeleton` — closed in RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612`
- [x] U-283 — zod dependency targets non-existent stable v4 — `@rntme/runtime` — closed in RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612`
- [x] U-284 — GrpcAdapterClient hardcodes insecure gRPC credentials — `@rntme/runtime` — closed in RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612`
- [x] U-285 — loadService catch-all error handling loses error specificity — `@rntme/runtime` — closed in RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612`
- [x] U-290 — collectShapesFromService is explicitly incomplete — `@rntme/runtime` — closed in RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612`
- [x] U-302 — No HTTP request size limits or rate limiting — `@rntme/runtime` — closed in RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612`

**Exit criteria:**
- Manifest validation gates Operaton-style runtime config.
- Runtime boot-pipeline error codes preserved end-to-end.
- Module-skeleton can mount auth0/clerk modules without manual wiring.

### Wave W7 — Per-package cleanup — compilation (graph-ir-compiler)

**Units (1):**

- [x] U-215 — 66 throw new Error in src/ violate package-boundary convention — `@rntme/graph-ir-compiler` — closed in RNT-277 / PR #68 / merge `b634c2606a24fe887a273c151ccbeb329828b0dc`

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W8 — Per-package cleanup — transport (bindings/http/grpc)

**Units (1):**

- [x] U-023 — Только insecure credentials — `@rntme/bindings-grpc` — closed in RNT-278 / PR #78 / merge `c5ecc7d8d8fa97cd085d67f9b58ac9a66fda4796`

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W10 — Per-package cleanup — tooling (blueprint/seed/db-studio)

**Units (1):**

- [x] U-308 — CLI buildCtx swallows PDM errors with generic message — `@rntme/seed` — closed in RNT-279 / PR #80 / merge `dc86168f0017f6f7430d1bc12e156c5c319d7bcd`

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W13 — Per-package cleanup — unified CLI/platform packages

**Units (1):**

- [x] U-087 — sanitizeCause aggressively redacts all error messages — `@rntme/deploy-dokploy` — closed in RNT-280

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W14 — Per-package cleanup — UI

**Units (1):**

- [x] U-346 — Missing CSP and security headers in HTML shell — `@rntme/ui-runtime` — closed in RNT-281

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W15 — Per-package cleanup — platform

**Units (6):**

- [x] U-113 — In-memory rate limiter breaks under multi-process — `@rntme/platform-http` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-122 — CORS regex potentially vulnerable to ReDoS — `@rntme/platform-http` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-123 — log-redactor patterns miss many secret formats — `@rntme/platform-http` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-137 — getWithSecretById callable with RLS-enabled client (no guard) — `@rntme/platform-storage` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-138 — AesGcmSecretCipher rejects cross-version decrypt (rotation undocumented) — `@rntme/platform-storage` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-358 — No unit test for cors middleware — `@rntme/platform-http` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W16 — Platform contracts extraction (layering refactor)

**Status:** Closed. PRs 1–6 merged; layering pinned by `dependency-cruiser` in CI.

Spec: [`docs/superpowers/specs/2026-05-04-platform-contracts-extraction-design.md`](../superpowers/specs/2026-05-04-platform-contracts-extraction-design.md). Plan: [`docs/superpowers/plans/2026-05-04-platform-contracts-extraction.md`](../superpowers/plans/2026-05-04-platform-contracts-extraction.md).

Platform contracts extraction wave — extracts `@rntme/contracts-{module,provisioner,client-runtime,handlers}-v1` as leaf packages, removes cross-package layering violations, and renames `@rntme/module-skeleton` → `@rntme/module-scaffold` (the package no longer hosts contracts; it is examples-and-scaffolding).

**Audit findings touched (parked, not closed by this wave):**
- U-002 — `@rntme/runtime` god package (12 workspace deps) — `monorepo` — remains parked; wave reduces structural pressure but does not close.
- U-003 — `bindings-grpc` cross-depends on `bindings-http` for executor contract — `monorepo` — remains parked; wave creates the seam (`@rntme/contracts-handlers-v1`) that a follow-up shoot can use.

**Exit criteria:**
- [x] Module manifest contract extracted to `@rntme/contracts-module-v1` (PR 1, merged).
- [x] Provisioner runtime contract + env-mapping types extracted to `@rntme/contracts-provisioner-v1` (PR 2, merge `43fb582`).
- [x] Browser module contract extracted to `@rntme/contracts-client-runtime-v1` (PR 3, merge `ba881b3`).
- [x] Code-command-handler contract extracted to `@rntme/contracts-handlers-v1` (PR 4, merge `8e746ec`).
- [x] `@rntme/module-skeleton` renamed to `@rntme/module-scaffold` with zero `@rntme/event-store` / `@rntme/runtime` deps (PR 5, merge `e96f161`).
- [x] Dependency-cruiser CI guard pins the layering (PR 6, merge `425a6db`).

Wave closed by PR 6.

---

## Lens B — Findings ledger (data view)

| id | pkg | audit-ref | severity | category | wave | verified | evidence | triage rationale |
|----|-----|-----------|----------|----------|------|----------|----------|------------------|
| U-002 | `monorepo` | RNT-230#B2 | Blocker | 📦 park | — | ✓ | @rntme/runtime depends on 12 workspace packages (god package) | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot [active-list] removed 2026-05-04; revisit after project-level runtime intake and plugin seams stabilize |
| U-003 | `monorepo` | RNT-230#B3 | Blocker | 📦 park | — | ✓ | bindings-grpc has dependencies['@rntme/bindings-http']: 'workspace:*' | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot [active-list] removed 2026-05-04; extract shared executor contracts when touching gRPC/bindings runtime boundaries |
| U-004 | `monorepo` | RNT-230#H1 | High | ✅ closed | A15 | ✓ | dependency-version drift is covered by the standing dependency-upgrade deferral spec | [fix] closed as deferred per `docs/superpowers/specs/2026-04-30-dependency-upgrade-deferral-design.md`; future trigger or 2026-10-30 refresh reopens the relevant dependency cluster. |
| U-005 | `monorepo` | RNT-230#H2 | High | 📦 park | — | ✓ | 8 module packages have build:deps scripts that pnpm --dir or -F other packages | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-006 | `monorepo` | RNT-230#H3 | High | 📦 park | — | ✓ | conformance pkgs split between deps/devDeps in crm-bitrix24/amocrm and identity-auth0/clerk | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-007 | `monorepo` | RNT-230#H4 | High | 📦 park | — | ✓ | runtime has dependencies['@rntme/seed']: 'workspace:^' (CLI tool in prod deps) | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-008 | `monorepo` | RNT-230#M1 | Medium | 📦 park | — | ✓ | runtime/src/index.ts comments instruct importing from @rntme/runtime/src/plugins/... | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-009 | `monorepo` | RNT-230#M2 | Medium | 📦 park | — | ✓ | blueprint depends on seed and ui packages | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-010 | `monorepo` | RNT-230#M3 | Medium | 📦 park | — | ✓ | bindings-http depends on graph-ir-compiler (transport→compiler) | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-011 | `monorepo` | RNT-230#M4 | Medium | 📦 park | — | ✓ | Only bindings-http, contracts-*, demo/* have .gitignore; 22 packages don't | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-012 | `monorepo` | RNT-230#M5 | Medium | 📦 park | — | ✓ | ui and ui-runtime still have no description in package.json; db-studio portion became obsolete when `@rntme/db-studio` was removed in `f595006` | [verify-systemic] refreshed 2026-05-04 [triage] park remaining ui/ui-runtime finding; db-studio subfinding obsolete |
| U-013 | `monorepo` | RNT-230#L1 | Low | 🧹 obsolete | — | ✓ | issue-tracker-api-demo and pre-step-demo were removed from the tracked workspace in `f595006`; only ignored dist/node_modules leftovers remain on disk | [verify-systemic] refreshed 2026-05-04 [obsolete] removed demo packages superseded by `demo/notes-blueprint` |
| U-014 | `@rntme/bindings-grpc` | RNT-200#1 | Blocker | 📦 park | — | ✓ | packages/runtime/bindings-grpc/src/server/handler.ts | [verify] src/server/handler.ts line 60 sets actor: null in CommandExecutionContext for every gRPC command [triage] park: real but no foreseeable shoot |
| U-015 | `@rntme/bindings-grpc` | RNT-200#2 | High | 📦 park | — | ✓ | src/server/handler.ts, src/server/errors.ts, src/types.ts | [verify] src/server/handler.ts line 8, src/server/errors.ts lines 2-5, src/types.ts lines 2-5 all import from @rntme/bindings-http/executor-contract [triage] park: real but no foreseeable shoot |
| U-016 | `@rntme/bindings-grpc` | RNT-200#3 | High | 📦 park | — | ✓ | src/emit/scalars.ts and src/emit/shapes.ts | [verify] src/emit/scalars.ts switch has no default branch nor fallback return; shapes.ts default throws (partial confirmation: scalars.ts truly lacks fallback) [triage] park: real but no foreseeable shoot |
| U-017 | `@rntme/bindings-grpc` | RNT-200#4 | High | 🧹 obsolete | — | ✓ | demo/issue-tracker-api/test/e2e/grpc.test.ts was deleted with the deprecated demo in `f595006` | [verify] refreshed 2026-05-04 [obsolete] old demo e2e assertion no longer exists in the tracked workspace |
| U-018 | `@rntme/bindings-grpc` | RNT-200#5 | Medium | 📦 park | — | ✓ | README.md — 'Not yet supported: pre[] middleware (plan 3)' | [verify] README.md line 58 still lists pre[] middleware under 'Not yet supported'; no pre[] code path in handler.ts [triage] park: real but no foreseeable shoot |
| U-019 | `@rntme/bindings-grpc` | RNT-200#6 | Medium | 📦 park | — | ✓ | src/emit/emit-proto.ts filters by name === 'CommandResult' | [verify] src/emit/emit-proto.ts line 28 filters by raw 'CommandResult' string; @rntme/bindings exports COMMAND_RESULT_SHAPE_NAME constant but bindings-grpc does not import it [triage] park: real but no foreseeable shoot |
| U-020 | `@rntme/bindings-grpc` | RNT-200#7 | Medium | 📦 park | — | ✓ | src/server/create-server.ts manually builds requestSerialize/Deserialize | [verify] src/server/create-server.ts lines 18-23 manually build requestSerialize/Deserialize/responseSerialize/Deserialize via protobufjs [triage] park: real but no foreseeable shoot |
| U-021 | `@rntme/bindings-grpc` | RNT-200#8 | Medium | 📦 park | — | skip | src/server/handler.ts — { [toSnakeCase(fromField)]: qout.value } | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-022 | `@rntme/bindings-grpc` | RNT-200#9 | Low | 📦 park | — | skip | README.md — orchestrators expect health endpoint | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-023 | `@rntme/bindings-grpc` | RNT-200#10 | Low | ✅ closed | W8 | skip | src/server/create-server.ts — grpc.ServerCredentials.createInsecure() | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-278 / PR #78 / merge `c5ecc7d8d8fa97cd085d67f9b58ac9a66fda4796` |
| U-024 | `@rntme/bindings-grpc` | RNT-200#11 | Low | 📦 park | — | skip | packages/runtime/runtime/src/start/build-grpc-surface.ts and inline TODO | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-025 | `@rntme/bindings-grpc` | RNT-200#12 | Low | 📦 park | — | skip | no src/types/result.ts with ERROR_CODES in package | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-026 | `@rntme/bindings-grpc` | RNT-200#13 | Low | 📦 park | — | skip | test/ analysis: only QUERY_NOT_FOUND stub in create-server.test.ts | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-027 | `@rntme/bindings-http` | RNT-201#1 | Blocker | 📦 park | — | ✓ | src/index.ts exports buildDefaultGraphIrCommandMap, correlationMiddleware, VERSION | [verify] src/index.ts lines 1-19 export VERSION='0.0.0', buildDefaultGraphIrCommandMap, correlationMiddleware as described. [triage] park: real but no foreseeable shoot |
| U-028 | `@rntme/bindings-http` | RNT-201#2 | High | 📦 park | — | ✓ | src/executor-contract.ts redefines CommandExecutor/QueryExecutor/CorrelationCtx | [verify] executor-contract.ts defines CorrelationCtx (line 4) which is also exported from graph-ir-compiler/src/index.ts:18; CommandExecutor/QueryExecutor interfaces are local to bindings-http but CorrelationCtx duplication remains. [triage] park: real but no foreseeable shoot |
| U-029 | `@rntme/bindings-http` | RNT-201#3 | High | 📦 park | — | ✓ | src/runtime/command-handler.ts (290 lines, multiple responsibilities) | [verify] src/runtime/command-handler.ts is 290 lines exactly, multi-responsibility (validation, idempotency, executor, response, errors). [triage] park: real but no foreseeable shoot [active-list] removed 2026-05-04; split only when a concrete command behavior change touches this file |
| U-030 | `@rntme/bindings-http` | RNT-201#4 | High | 📦 park | — | ✓ | src/router.ts: const stripped = p.replace(/^\/api/, '') \\|\\| '/' | [verify] src/router.ts:80 contains literal `const stripped = p.replace(/^\/api/, '') \\|\\| '/'` inside idempotencyMiddleware setup. [triage] park: real but no foreseeable shoot |
| U-031 | `@rntme/bindings-http` | RNT-201#5 | High | ✅ closed | A3 | ✓ | `BindingsRouterOptions`, `buildPlan`, and per-graph compile helpers now consume `RuntimeGraphSpec`, `ValidatedPdm`, and `ValidatedQsm` instead of `unknown`; `test/unit/public-api.test.ts` asserts the public type boundary. | [triage] park: real but no foreseeable shoot [fix] closed by runtime boundary hygiene pass 2026-05-04 |
| U-032 | `@rntme/bindings-http` | RNT-201#6 | Medium | ✅ closed | W3 | ✓ | IdempotencyCache now calls `pruneExpired(now)` from both `set()` and `get()`, covered by `test/unit/idempotency-cache.test.ts` | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-033 | `@rntme/bindings-http` | RNT-201#7 | Medium | 📦 park | — | ✓ | src/runtime/error-to-http.ts: hardcoded table of 5 codes | [verify] src/runtime/error-to-http.ts:6-12 hardcodes 5-entry TABLE record with no extension API. [triage] park: real but no foreseeable shoot |
| U-034 | `@rntme/bindings-http` | RNT-201#8 | Medium | 📦 park | — | ✓ | package.json: zod ^4.0.0; spec: zod ^3.23.0 | [verify] package.json:34 declares `zod: ^4.0.0`, spec 2026-04-14-bindings-http-design.md:310 mandates `zod: ^3.23.0`. [triage] park: real but no foreseeable shoot |
| U-035 | `@rntme/bindings-http` | RNT-201#9 | Medium | 📦 park | — | skip | test/ has unit + integration but no test/e2e/ | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-036 | `@rntme/bindings-http` | RNT-201#10 | Medium | 📦 park | — | skip | src/runtime-contract.ts: ExternalAdapterClient, AdapterResult, RetryPolicy | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-037 | `@rntme/bindings-http` | RNT-201#11 | Low | 📦 park | — | skip | src/index.ts: VERSION = '0.0.0' | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-038 | `@rntme/bindings-http` | RNT-201#12 | Low | 📦 park | — | skip | 12 suites fail with 'Failed to resolve entry for package' without prior build | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-039 | `@rntme/bindings` | RNT-199#1 | Medium | 📦 park | — | ✓ | src/openapi/emit.ts — generateOpenApi(validated, _resolvers, ...) | [verify] src/openapi/emit.ts line 137-141: generateOpenApi(validated, _resolvers: BindingResolvers, options) — _resolvers parameter present and unused [triage] park: real but no foreseeable shoot |
| U-040 | `@rntme/bindings` | RNT-199#2 | Medium | 📦 park | — | ✓ | src/types/artifact.ts kind?: BindingKind; src/parse/schema.ts default('query') | [verify] src/types/artifact.ts line 64 'kind?: BindingKind' optional; src/parse/schema.ts line 97 z.enum(['query','command']).default('query') — Zod default but TS optional [triage] park: real but no foreseeable shoot |
| U-041 | `@rntme/bindings` | RNT-199#3 | Medium | 📦 park | — | ✓ | src/validate/structural.ts casts to BindingArtifact & { shapes?: Record<string, unknown> } | [verify] src/validate/structural.ts line 267 casts to 'BindingArtifact & { shapes?: Record<string, unknown> }'; shapes not in BindingArtifact type (artifact.ts lines 79-86) [triage] park: real but no foreseeable shoot |
| U-042 | `@rntme/bindings` | RNT-199#4 | Medium | 📦 park | — | skip | No test for empty bindings:{}, inputFrom form/header, redirect host, pre[] system | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-043 | `@rntme/bindings` | RNT-199#5 | Low | 📦 park | — | skip | demo-openapi.mjs — import { ... } from './dist/index.js' | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-044 | `@rntme/bindings` | RNT-199#6 | Low | 📦 park | — | skip | All 151 tests are unit/golden within the package; no cross-package test | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-045 | `@rntme/bindings` | RNT-199#7 | Low | 📦 park | — | skip | src/types/openapi.ts — [key: string]: OperationObject \\| undefined \\| string; | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-046 | `@rntme/bindings` | RNT-199#8 | Low | 📦 park | — | skip | src/openapi/emit.ts handles query and header but no branch for form | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-047 | `@rntme/bindings` | RNT-199#9 | Low | 🤔 decide | — | skip | src/types/result.ts — ERROR_CODES is a flat const object | [verify] not in sample [triage] decide: needs product/architectural input |
| U-048 | `@rntme/blueprint` | RNT-202#H1 | High | ✅ closed | A1 | ✓ | malformed service.json now returns `BLUEPRINT_SERVICE_JSON_MALFORMED` at load layer | [fix] `loadBlueprint` returns a structured descriptor parse error with Zod issues; covered by `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`. |
| U-049 | `@rntme/blueprint` | RNT-202#H2 | High | 📦 park | — | ✓ | src/compose/binding-resolvers.ts: SCALARS hardcoded | [verify] src/compose/binding-resolvers.ts lines 20-27: SCALARS hardcoded as ReadonlySet of literals ('integer','decimal','string','boolean','date','datetime'); not derived from @rntme/bindings ScalarPrimitive. parseScalar (line 83) gates on this set. [triage] park: real but no foreseeable shoot |
| U-050 | `@rntme/blueprint` | RNT-202#H3 | High | ✅ closed | A1 | ✓ | compileServiceUi now uses project route matching plus explicit core/module component catalogs | [fix] permissive `resolveRoute: () => true` and generic component fallback removed; covered by `packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts`. |
| U-051 | `@rntme/blueprint` | RNT-202#M1 | Medium | 📦 park | — | ✓ | src/types/artifact.ts: ValidatedBlueprint brand; src/index.ts export | [verify] src/types/artifact.ts lines 44-48 declare branded ValidatedBlueprint type; src/index.ts line 35 re-exports it. grep across packages/ shows no constructor / validator returning ValidatedBlueprint and no consumer importing it — pure dead code. [triage] park: real but no foreseeable shoot |
| U-052 | `@rntme/blueprint` | RNT-202#M2 | Medium | 📦 park | — | ✓ | src/parse/parse.ts: 'as ProjectBlueprint' after Zod parse | [verify] src/parse/parse.ts line 26: `return ok(parsed.data as ProjectBlueprint);` — Zod's safeParse output is cast with `as` rather than relying on inferred schema type. ProjectBlueprintSchema and ProjectBlueprint type can drift without TypeScript catching it. [triage] park: real but no foreseeable shoot |
| U-053 | `@rntme/blueprint` | RNT-202#M3 | Medium | 📦 park | — | ✓ | src/compose/load-service-member.ts: hasSeed \\|\\| existsSync | [verify] src/compose/load-service-member.ts line 117: `if (input.service.artifacts.hasSeed \\|\\| existsSync(join(input.rootDir, seedPath)))` — the existsSync fallback violates the discover-then-load contract; an undeclared seed.json on disk is loaded opportunistically, contradicting the declarative artifact-discovery model. [triage] park: real but no foreseeable shoot |
| U-054 | `@rntme/blueprint` | RNT-202#M4 | Medium | 📦 park | — | skip | src/types/artifact.ts: GraphJson.nodes typed as unknown[] | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-055 | `@rntme/blueprint` | RNT-202#M5 | Medium | 📦 park | — | skip | src/validate/index.ts: only structural exported | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-056 | `@rntme/blueprint` | RNT-202#M6 | Medium | 📦 park | — | skip | load-blueprint.ts/load-service-member.ts: missing failure-path tests | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-057 | `@rntme/blueprint` | RNT-202#L1 | Low | 📦 park | — | skip | src/types/result.ts: Layer type vs ERROR_CODES mismatch | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-058 | `@rntme/blueprint` | RNT-202#L2 | Low | 📦 park | — | skip | src/parse/schema.ts: ServiceDescriptorSchema missing slug | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-059 | `@rntme/blueprint` | RNT-202#L3 | Low | 📦 park | — | skip | src/compose/service-graphs.ts: hardcoded version '1.0-rc7' | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-063 | `@rntme/cli` | RNT-224#4 | Medium | 📦 park | — | ✓ | src/commands/skills/install.ts has its own writeOk/writeErr instead of runCommand |  [triage] park: real but no foreseeable shoot |
| U-064 | `@rntme/cli` | RNT-224#5 | Medium | 📦 park | — | ✓ | package.json and src/api/client.ts hardcode "0.0.0"; readVersion reads it |  [triage] park: real but no foreseeable shoot |
| U-065 | `@rntme/cli` | RNT-224#6 | Medium | 📦 park | — | ✓ | no tests for logout, project list/show, project version, token cmds, skills install |  [triage] park: real but no foreseeable shoot |
| U-066 | `@rntme/cli` | RNT-224#7 | Medium | 📦 park | — | partial | postbuild script seeks package.json via ../../package.json relative to dist/bin/cli.js |  [triage] park: real but no foreseeable shoot |
| U-068 | `@rntme/cli` | RNT-224#9 | Low | 📦 park | — | skip | test passes --org/--project to init; runInit ignores them; parseArgs strict:false | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-069 | `@rntme/cli` | RNT-224#10 | Low | 📦 park | — | skip | src/skills/adapters/cursor.ts throws Error when frontmatter missing | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-070 | `@rntme/cli` | RNT-224#11 | Low | 📦 park | — | skip | README mentions project publish --dry-run as validation; no validate command exists | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-071 | `@rntme/deploy-core` | RNT-225#1 | Medium | 📦 park | — | ✓ | src/edge.ts — four near-identical middleware dispatch blocks |  [triage] park: real but no foreseeable shoot |
| U-072 | `@rntme/deploy-core` | RNT-225#2 | Medium | 📦 park | — | ✓ | package.json declares zod dep; grep finds zero usages in src/test |  [triage] park: real but no foreseeable shoot |
| U-073 | `@rntme/deploy-core` | RNT-225#3 | Medium | 📦 park | — | ✓ | 12 unit tests; body-limit, timeout, empty project, edge cases uncovered |  [triage] park: real but no foreseeable shoot |
| U-074 | `@rntme/deploy-core` | RNT-225#4 | Low | 📦 park | — | skip | src/plan.ts — redundant config.eventBus===undefined OR clause | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-075 | `@rntme/deploy-core` | RNT-225#5 | Low | 📦 park | — | skip | src/errors.ts — single struct with optional fields; not code-discriminated | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-076 | `@rntme/deploy-core` | RNT-225#6 | Low | 📦 park | — | skip | vitest.config.ts sets passWithNoTests: true | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-077 | `@rntme/deploy-core` | RNT-225#7 | Low | 📦 park | — | skip | buildProjectDeploymentPlan accepts plain structural inputs without checks | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-078 | `@rntme/deploy-dokploy` | RNT-226#1 | High | ✅ closed | A14 | ✓ | `resourceMatches` now uses typed application/compose comparators instead of `JSON.stringify` | [fix] env, labels, files, ports, and ingress routes compare by semantic fields with order-insensitive helpers; apply tests cover unordered matches and real env drift. |
| U-079 | `@rntme/deploy-dokploy` | RNT-226#2 | High | ✅ closed | A5 | ✓ | Partial apply failures now delete resources created earlier in the same attempt via `deleteDokployResources`, record cleanup metadata, retain updated-resource failed-state metadata, and set `retrySafe=false` when cleanup fails. | [triage] park: real but no foreseeable shoot [fix] closed by partial apply cleanup pass 2026-05-04 |
| U-080 | `@rntme/deploy-dokploy` | RNT-226#3 | High | 📦 park | — | ✓ | src/client.ts methods take full RenderedDokployResource |  [triage] park: real but no foreseeable shoot |
| U-081 | `@rntme/deploy-dokploy` | RNT-226#4 | High | 📦 park | — | ✓ | src/apply.ts sequential for...of with await per iteration |  [triage] park: real but no foreseeable shoot |
| U-083 | `@rntme/deploy-dokploy` | RNT-226#6 | Medium | 📦 park | — | ✓ | src/config.ts; render.ts uses publicBaseUrl/endpoint unchecked |  [triage] park: real but no foreseeable shoot |
| U-084 | `@rntme/deploy-dokploy` | RNT-226#7 | Medium | 📦 park | — | ✓ | src/result.ts duplicates ok/err/isOk/isErr from deploy-core |  [triage] park: real but no foreseeable shoot |
| U-086 | `@rntme/deploy-dokploy` | RNT-226#9 | Medium | 📦 park | — | ✓ | src/render.ts assertNever throws plain Error |  [triage] park: real but no foreseeable shoot |
| U-087 | `@rntme/deploy-dokploy` | RNT-226#10 | Medium | ✅ closed | W13 | ✓ | src/apply.ts sanitizeCause now preserves benign Error messages and redacts credential-like values at the cause serialization boundary | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-280 |
| U-088 | `@rntme/deploy-dokploy` | RNT-226#11 | Low | 📦 park | — | ✓ | README.md links missing project-deployment-pipeline-design spec |  [triage] park: real but no foreseeable shoot |
| U-089 | `@rntme/deploy-dokploy` | RNT-226#12 | Low | 📦 park | — | ✓ | package.json version 0.0.0 |  [triage] park: real but no foreseeable shoot |
| U-090 | `@rntme/deploy-dokploy` | RNT-226#13 | Low | 📦 park | — | ✓ | All tests use FakeDokployClient; no platform-http contract tests |  [triage] park: real but no foreseeable shoot |
| U-091 | `@rntme/landing` | RNT-223#1 | High | 📦 park | — | ✓ | Problem.astro & MicroJobs.astro both use data-section-num=02; AhaSection/LiveDemoCard 04; HowItWorks/SnowflakeToRuntime 05 |  [triage] park: real but no foreseeable shoot |
| U-092 | `@rntme/landing` | RNT-223#2 | High | 📦 park | — | ✓ | data-section-num + id=sNN hardcoded in each .astro; SideRail.tsx, index.astro, CONTENT.md duplicate ordering |  [triage] park: real but no foreseeable shoot |
| U-093 | `@rntme/landing` | RNT-223#3 | High | 📦 park | — | ✓ | 3 test files (~100 lines); no Astro component tests, no integration build tests, no a11y automation |  [triage] park: real but no foreseeable shoot |
| U-094 | `@rntme/landing` | RNT-223#4 | Medium | 📦 park | — | ✓ | loadEnv() called at module level in BaseLayout, StatusBar, Hero, Footer, LiveDemoCard, PilotForm |  [triage] park: real but no foreseeable shoot |
| U-095 | `@rntme/landing` | RNT-223#5 | Medium | 📦 park | — | ✓ | MicroJobs.astro, SnowflakeToRuntime.astro, LiveDemoCard.astro not imported into any page |  [triage] park: real but no foreseeable shoot |
| U-096 | `@rntme/landing` | RNT-223#6 | Medium | 📦 park | — | ✓ | CONTENT.md duplicates copy, section structure, env deps but is not generated from code |  [triage] park: real but no foreseeable shoot |
| U-097 | `@rntme/landing` | RNT-223#7 | Low | 📦 park | — | skip | .impeccable.md declares Lighthouse 95+ but no pa11y/axe-core/lighthouse-ci in CI | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-098 | `@rntme/landing` | RNT-223#8 | Low | 📦 park | — | skip | No sitemap-index.xml, no JSON-LD for Organization/Product/FAQ | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-099 | `@rntme/landing` | RNT-223#9 | Low | 📦 park | — | skip | .impeccable.md references SHAPE-BRIEF.md §4 but file does not exist in repo | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-100 | `@rntme/landing` | RNT-223#10 | Low | 📦 park | — | skip | package.json#version is 0.0.0; does not reflect real deploys | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-102 | `@rntme/platform-core` | RNT-227#2 | High | 📦 park | — | ✓ | test/unit/use-cases/ lacks archive-org-cascade.test.ts |  [triage] park: real but no foreseeable shoot |
| U-103 | `@rntme/platform-core` | RNT-227#3 | High | 📦 park | — | ✓ | fast-check declared in devDependencies, zero usage in tests |  [triage] park: real but no foreseeable shoot |
| U-104 | `@rntme/platform-core` | RNT-227#4 | Medium | 📦 park | — | ✓ | MembershipMirrorSchema uses z.string().min(1) for role, not RoleSchema |  [triage] park: real but no foreseeable shoot |
| U-106 | `@rntme/platform-core` | RNT-227#6 | Medium | 📦 park | — | ✓ | package.json version 0.0.0; consumed by platform-http, platform-storage, cli |  [triage] park: real but no foreseeable shoot |
| U-107 | `@rntme/platform-core` | RNT-227#7 | Medium | 📦 park | — | ✓ | vitest.config.ts has no coverage block |  [triage] park: real but no foreseeable shoot |
| U-108 | `@rntme/platform-core` | RNT-227#8 | Low | 📦 park | — | skip | README references docs/superpowers/specs/done/... not in repo | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-109 | `@rntme/platform-core` | RNT-227#9 | Low | 📦 park | — | skip | src/blob/store.ts BlobStore interface exposes presignedGet | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-110 | `@rntme/platform-core` | RNT-227#10 | Low | 📦 park | — | skip | package.json ./testing subpath exports only fakes.ts | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-111 | `@rntme/platform-http` | RNT-228#1 | High | 📦 park | — | ✓ | src/app.ts createApp ~180 LOC mixes middleware/auth/routes/jobs/tx |  [triage] park: real but no foreseeable shoot [active-list] removed 2026-05-04; extract only when another platform HTTP change needs this area |
| U-112 | `@rntme/platform-http` | RNT-228#2 | High | 📦 park | — | ✓ | src/app.ts setImmediate runDeployment; src/deploy/executor.ts in HTTP proc |  [triage] park: real but no foreseeable shoot [active-list] removed 2026-05-04; move to a worker after deploy semantics/logging are stable and a queue/worker design exists |
| U-113 | `@rntme/platform-http` | RNT-228#3 | High | ✅ closed | W15 | ✓ | src/middleware/rate-limit.ts InMemoryRateLimiter uses Map | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-114 | `@rntme/platform-http` | RNT-228#4 | High | ✅ closed | A4 | ✓ | `src/middleware/error-handler.ts` is now installed with `app.onError(errorHandler(deps.logger))`, logs `err`, request id, method, path, route, and status, and returns a sanitized 500 envelope. | [triage] park: real but no foreseeable shoot [fix] closed by platform error logging pass 2026-05-04 |
| U-115 | `@rntme/platform-http` | RNT-228#5 | High | 📦 park | — | ✓ | package.json @hono/zod-openapi listed; no imports in src/ |  [triage] park: real but no foreseeable shoot |
| U-116 | `@rntme/platform-http` | RNT-228#6 | High | 📦 park | — | ✓ | src/deploy/dokploy-client-factory.ts (278 LOC) lives in platform-http |  [triage] park: real but no foreseeable shoot |
| U-117 | `@rntme/platform-http` | RNT-228#7 | High | 📦 park | — | ✓ | src/middleware/body-limit.ts builds new Blob from chunks, replaces req |  [triage] park: real but no foreseeable shoot |
| U-118 | `@rntme/platform-http` | RNT-228#8 | Medium | 📦 park | — | ✓ | src/app.ts and src/ui/app.tsx each instantiate auth providers |  [triage] park: real but no foreseeable shoot |
| U-119 | `@rntme/platform-http` | RNT-228#9 | Medium | 📦 park | — | ✓ | src/app.ts withOrgTx duplicated in test/e2e/deploy-flow.test.ts |  [triage] park: real but no foreseeable shoot |
| U-120 | `@rntme/platform-http` | RNT-228#10 | Medium | 📦 park | — | ✓ | AppDeps poolRepos vs UiDeps poolRepos diverge on workosEventLog |  [triage] park: real but no foreseeable shoot |
| U-121 | `@rntme/platform-http` | RNT-228#11 | Medium | 📦 park | — | skip | src/routes/ops.ts ready-check calls workos.listApiKeys | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-122 | `@rntme/platform-http` | RNT-228#12 | Medium | ✅ closed | W15 | skip | src/middleware/cors.ts builds RegExp from PLATFORM_CORS_ORIGINS | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-123 | `@rntme/platform-http` | RNT-228#13 | Medium | ✅ closed | W15 | skip | src/deploy/log-redactor.ts uses simplistic regex patterns | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-124 | `@rntme/platform-http` | RNT-228#14 | Medium | 📦 park | — | skip | src/ui/app.tsx uses orgSlug/projSlug params without validation | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-125 | `@rntme/platform-http` | RNT-228#15 | Medium | 📦 park | — | skip | tsconfig.json excludes test/; tsconfig.check.json includes test/ | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-126 | `@rntme/platform-http` | RNT-228#16 | Low | 📦 park | — | skip | src/index.ts exports only VERSION | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-127 | `@rntme/platform-http` | RNT-228#17 | Low | 📦 park | — | skip | test/e2e uses describe.skipIf(!e2eContainersAvailable()) | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-128 | `@rntme/platform-http` | RNT-228#18 | Low | 📦 park | — | skip | test/unit/middleware only covers rate-limit; auth/cors/tx untested | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap |
| U-129 | `@rntme/platform-http` | RNT-228#19 | Low | 📦 park | — | skip | src/index.ts VERSION='0.0.0'; build-deploy-config mode='preview' hardcoded | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-130 | `@rntme/platform-http` | RNT-228#20 | Low | 📦 park | — | skip | src/auth/workos-client.ts casts as WorkOSClient bypassing SDK types | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-131 | `@rntme/platform-storage` | RNT-229#1 | High | 📦 park | — | ✓ | pg-deploy-target-repo.ts, pg-deployment-repo.ts, pg-project-version-repo.ts |  [triage] park: real but no foreseeable shoot |
| U-132 | `@rntme/platform-storage` | RNT-229#2 | High | ✅ closed | A6 | ✓ | `withTransaction` now rolls back when a callback returns the platform `Result.err` shape, preserving the error result without committing repo side effects; covered by `test/unit/pg/tx.test.ts` and an integration regression in `pg-deploy-target-repo.test.ts`. | [triage] park: real but no foreseeable shoot [fix] closed by platform storage Result rollback pass 2026-05-04 |
| U-133 | `@rntme/platform-storage` | RNT-229#3 | Medium | 📦 park | — | ✓ | pg-org-repo.ts (Drizzle) vs pg-deploy-target-repo.ts (raw SQL) |  [triage] park: real but no foreseeable shoot |
| U-134 | `@rntme/platform-storage` | RNT-229#4 | Medium | 📦 park | — | ✓ | test/integration/identity-repos.test.ts uses env.pool bypassing RLS |  [triage] park: real but no foreseeable shoot |
| U-135 | `@rntme/platform-storage` | RNT-229#5 | Medium | 📦 park | — | ✓ | drizzle/0003_deploy.sql uses no NULLIF; src/sql/policies.sql uses NULLIF |  [triage] park: real but no foreseeable shoot |
| U-136 | `@rntme/platform-storage` | RNT-229#6 | Medium | 📦 park | — | skip | s3-blob-store.ts all ops return PLATFORM_STORAGE_BLOB_UPLOAD_FAILED | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-137 | `@rntme/platform-storage` | RNT-229#7 | Low | ✅ closed | W15 | skip | pg-deploy-target-repo.ts getWithSecretById has no runtime guard | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-138 | `@rntme/platform-storage` | RNT-229#8 | Low | ✅ closed | W15 | skip | aes-gcm-cipher.ts decrypt throws on keyVersion mismatch | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-139 | `@rntme/platform-storage` | RNT-229#9 | Low | 📦 park | — | skip | PgProjectVersionRepo and PgAuditRepo lack dedicated test files | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-140 | `@rntme/platform-storage` | RNT-229#10 | Low | 📦 park | — | skip | test/integration/harness.ts hardcodes TRUNCATE list of 11 tables | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-141 | `@rntme/platform-storage` | RNT-229#11 | Low | 📦 park | — | skip | src/index.ts re-exports * from './schema/index.js' | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-142 | `@rntme/conformance-ai-llm` | RNT-218#1 | High | 📦 park | — | ✓ | Cross-category interface divergence between AI-LLM, Identity, and CRM |  [triage] park: real but no foreseeable shoot |
| U-143 | `@rntme/conformance-ai-llm` | RNT-218#2 | Medium | 📦 park | — | ✓ | Conformance framework stub duplicated verbatim across AI-LLM and Identity |  [triage] park: real but no foreseeable shoot |
| U-144 | `@rntme/conformance-ai-llm` | RNT-218#3 | Medium | 📦 park | — | ✓ | build:deps script inconsistent across AI-LLM, Identity, and CRM |  [triage] park: real but no foreseeable shoot |
| U-145 | `@rntme/conformance-ai-llm` | RNT-218#4 | Medium | 📦 park | — | ✓ | AI-LLM lacks per-RPC assertion registry that CRM has |  [triage] park: real but no foreseeable shoot |
| U-146 | `@rntme/conformance-ai-llm` | RNT-218#5 | Low | 📦 park | — | skip | test:watch runs build:deps causing slow rebuilds on every change | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-147 | `@rntme/conformance-ai-llm` | RNT-218#6 | Low | ❌ rejected | — | ✓ | src/fixtures/media/index.ts fallback resolves from dist back to `<pkg>/src/fixtures/media/<filename>`, which exists and is used when binary fixtures are not copied to dist | [verify] refreshed 2026-05-04 via U-359 evidence [reject] original dead-path finding is a false positive |
| U-148 | `@rntme/conformance-ai-llm` | RNT-218#7 | Low | 📦 park | — | skip | Fixtures runtime-import proto enum, deviating from plan's raw literals | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-149 | `@rntme/conformance-crm` | RNT-219#H1 | High | 📦 park | — | ✓ | modules/crm/conformance/src/types.ts vs identity/ai-llm types.ts |  [triage] park: real but no foreseeable shoot |
| U-150 | `@rntme/conformance-crm` | RNT-219#H2 | High | 📦 park | — | ✓ | modules/crm/conformance/package.json missing build:deps |  [triage] park: real but no foreseeable shoot |
| U-151 | `@rntme/conformance-crm` | RNT-219#M1 | Medium | 📦 park | — | ✓ | package.json lists only @rntme/contracts-crm-v1 |  [triage] park: real but no foreseeable shoot |
| U-152 | `@rntme/conformance-crm` | RNT-219#M2 | Medium | 📦 park | — | ✓ | no src/capabilities.ts; ai-llm has AI_LLM_CANONICAL_RPCS etc. |  [triage] park: real but no foreseeable shoot |
| U-153 | `@rntme/conformance-crm` | RNT-219#M3 | Medium | 📦 park | — | ✓ | all 34 *.scenarios.ts export pendingScenario with empty action/steps |  [triage] park: real but no foreseeable shoot |
| U-154 | `@rntme/conformance-crm` | RNT-219#L1 | Low | 📦 park | — | skip | package.json files array includes src/fixtures/webhooks | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-155 | `@rntme/conformance-crm` | RNT-219#L2 | Low | 📦 park | — | skip | test/suite-shape.test.ts enforces assertionsDescription.length > 120 | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-156 | `@rntme/conformance-crm` | RNT-219#L3 | Low | 📦 park | — | skip | package.json test:watch script lacks build:deps prefix | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-157 | `@rntme/conformance-identity` | RNT-220#1 | Blocker | ✅ closed | W2 | ✓ | modules-monorepo spec now declares camelCase `CategoryConformanceSuite`; identity keeps `contractVersion`/`scenariosByRpc` and exports a `suite` alias | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-158 | `@rntme/conformance-identity` | RNT-220#2 | High | ✅ closed | W2 | ✓ | `test/fixtures-sanity.test.ts` validates users, organizations, invitations, sessions, and fixture metadata with protobuf `.verify()` | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-159 | `@rntme/conformance-identity` | RNT-220#3 | High | ✅ closed | W2 | ✓ | `src/fixtures/sessions.ts` and `src/fixtures/index.ts` now provide canonical Session fixtures | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-160 | `@rntme/conformance-identity` | RNT-220#4 | Medium | ✅ closed | W2 | ✓ | `src/index.ts` exports both `identityConformanceSuite` and template-friendly `suite` alias | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-161 | `@rntme/conformance-identity` | RNT-220#5 | Medium | ✅ closed | W2 | ✓ | README now includes an explicit `Out of scope` section for scenario implementations, live-vendor mode, framework runner, and sibling reshapes | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-162 | `@rntme/conformance-identity` | RNT-220#6 | Low | ✅ closed | W2 | ✓ | `src/capabilities.ts` exports canonical RPC, event, capability, and coverage registries | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-163 | `@rntme/conformance-identity` | RNT-220#7 | Low | ✅ closed | W2 | ✓ | `test/capabilities.test.ts` guards RPC/event/error-code structural coverage against the conformance suite | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-164 | `@rntme/conformance-identity` | RNT-220#8 | Low | ✅ closed | W2 | ✓ | package version is `1.0.0`; `CONFORMANCE_IDENTITY_MODULE_VERSION` is `1.0.0` and fixtures-sanity asserts it equals package.json version | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-165 | `@rntme/contracts-ai-llm-v1` | RNT-215#1 | High | 📦 park | — | ✓ | proto/ai_llm.proto tool_choice/Message.role/ThreadItem.role/response_format are string |  [triage] park: real but no foreseeable shoot |
| U-166 | `@rntme/contracts-ai-llm-v1` | RNT-215#2 | High | 📦 park | — | ✓ | modules/ai-llm/conformance/src/scenarios/*.scenarios.ts all 14 export [] |  [triage] park: real but no foreseeable shoot |
| U-167 | `@rntme/contracts-ai-llm-v1` | RNT-215#3 | Medium | 📦 park | — | ✓ | src/error-codes.ts layerOf fallthrough returns vendor for unknown codes |  [triage] park: real but no foreseeable shoot |
| U-168 | `@rntme/contracts-ai-llm-v1` | RNT-215#4 | Medium | 📦 park | — | ✓ | proto/ai_llm.proto Duration time_to_first_token on Completion despite v1 no streaming |  [triage] park: real but no foreseeable shoot |
| U-169 | `@rntme/contracts-ai-llm-v1` | RNT-215#5 | Medium | 📦 park | — | ✓ | AI-LLM/Identity use inline shell; CRM uses scripts/build.mjs |  [triage] park: real but no foreseeable shoot |
| U-170 | `@rntme/contracts-ai-llm-v1` | RNT-215#6 | Medium | 📦 park | — | skip | No boundary tests for progress_percentage, TokenUsage.total_tokens, temperature | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-171 | `@rntme/contracts-ai-llm-v1` | RNT-215#7 | Low | 📦 park | — | skip | package.json version 0.0.0 across all contract packages | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-172 | `@rntme/contracts-ai-llm-v1` | RNT-215#8 | Low | 📦 park | — | skip | src/error-codes.ts uses import with type json assertion | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-173 | `@rntme/contracts-common-v1` | RNT-214#2 | Low | 📦 park | — | skip | common package does not re-export own primitives; consumers rely on category re-exports | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-174 | `@rntme/contracts-common-v1` | RNT-214#5 | Low | 📦 park | — | skip | no error-codes.ts; inconsistent with category packages exporting errorCodes/isErrorCode/layerOf | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-175 | `@rntme/contracts-common-v1` | RNT-214#6.1 | Medium | 📦 park | — | ✓ | package.json build uses `tsc && cp ...` — not cross-platform, no exit-code check | [verify] package.json scripts.build = 'tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/' — uses POSIX `cp`, n [triage] park: real but no foreseeable shoot |
| U-176 | `@rntme/contracts-common-v1` | RNT-214#6.2 | Medium | 📦 park | — | ✓ | no .gitignore in _common/v1/; dist/ and proto-deps/ may leak into git | [verify] No .gitignore at packages/contracts/_common/v1/, packages/contracts/_common/, or packages/contracts/. Root .gitignore co [triage] park: real but no foreseeable shoot |
| U-177 | `@rntme/contracts-common-v1` | RNT-214#6.3 | Medium | 📦 park | — | ✓ | `pnpm test --coverage` fails with MISSING DEPENDENCY @vitest/coverage-v8 | [verify] package.json devDependencies: only vitest^2.1.1 — no @vitest/coverage-v8. Root package.json also does not provide it. vi [triage] park: real but no foreseeable shoot |
| U-178 | `@rntme/contracts-common-v1` | RNT-214#6.4 | Medium | 📦 park | — | ✓ | only 6 round-trip tests; no negative cases, edge cases, or boundary values | [verify] Only 6 `it(...)` cases, all happy-path round-trips: CanonicalRef (5 fields), CommandContext (idempotency_key+actor), Nam [triage] park: real but no foreseeable shoot |
| U-179 | `@rntme/contracts-common-v1` | RNT-214#7 | Low | 📦 park | — | skip | README missing Where to look first / Invariants & gotchas / Out of scope; no ListRequest example | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-180 | `@rntme/contracts-crm-v1` | RNT-216#1 | High | 📦 park | — | ✓ | conformance assertions reference CRM_REFERENCES_JOB_NOT_FOUND and AsyncJobCancelled; neither exists |  [triage] park: real but no foreseeable shoot |
| U-181 | `@rntme/contracts-crm-v1` | RNT-216#2 | High | 📦 park | — | ✓ | layerOf uses code.split('_')[1] cast to CrmErrorLayer; brittle to naming changes |  [triage] park: real but no foreseeable shoot |
| U-182 | `@rntme/contracts-crm-v1` | RNT-216#3 | Medium | 📦 park | — | ✓ | error-codes.test.ts covers list only; no tests for isErrorCode or layerOf runtime helpers |  [triage] park: real but no foreseeable shoot |
| U-183 | `@rntme/contracts-crm-v1` | RNT-216#4 | Medium | 📦 park | — | ✓ | index.ts exports Rntme as type only; runtime import yields undefined |  [triage] park: real but no foreseeable shoot |
| U-184 | `@rntme/contracts-crm-v1` | RNT-216#5 | Medium | 📦 park | — | ✓ | package.json has version 0.0.0 and private: true; no semver policy |  [triage] decide: needs product/architectural input |
| U-185 | `@rntme/contracts-crm-v1` | RNT-216#6 | Medium | 📦 park | — | skip | generated proto.gen.js (~1.8MB) and proto.gen.d.ts (~614KB) committed despite generated marker | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-186 | `@rntme/contracts-crm-v1` | RNT-216#7 | Low | 📦 park | — | skip | README is template boilerplate with no CRM RPC, event, or aggregate specifics | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-187 | `@rntme/contracts-crm-v1` | RNT-216#8 | Low | 📦 park | — | skip | crm.proto defines 34 RPC methods but README documents none of them | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-188 | `@rntme/contracts-identity-v1` | RNT-217#1 | High | ✅ closed | W2 | ✓ | `check:imports` is now a package script and `test` runs it after build/proto checks | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-189 | `@rntme/contracts-identity-v1` | RNT-217#2 | High | ✅ closed | W2 | ✓ | `package.json#dependencies.long` explicitly declares `^5.3.2` | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-190 | `@rntme/contracts-identity-v1` | RNT-217#3 | Medium | ✅ closed | W2 | ✓ | `scripts/check-proto-gen.mjs`, `proto:check`, and package `test` now fail on proto/generated drift | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-191 | `@rntme/contracts-identity-v1` | RNT-217#4 | Medium | ✅ closed | W2 | ✓ | `src/index.ts` no longer direct-exports common-v1 primitives; README documents common primitives under the proto namespace | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-192 | `@rntme/contracts-identity-v1` | RNT-217#5 | Medium | ✅ closed | W2 | ✓ | `test/index-exports.test.ts` covers direct identity exports and asserts common-v1 primitives remain behind `proto` namespace | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-193 | `@rntme/contracts-identity-v1` | RNT-217#6 | Low | ✅ closed | W2 | ✓ | `package.json#version` is `1.0.0` for the v1 contract package | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-194 | `@rntme/contracts-identity-v1` | RNT-217#7 | Low | ✅ closed | W2 | ✓ | `package.json` includes repository, bugs, and homepage metadata | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-274 / merge `7414b05` |
| U-195 | `@rntme/db-studio` | RNT-203#1 | High | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-196 | `@rntme/db-studio` | RNT-203#2 | High | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-197 | `@rntme/db-studio` | RNT-203#3 | Medium | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-198 | `@rntme/db-studio` | RNT-203#4 | Medium | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-199 | `@rntme/db-studio` | RNT-203#5 | Medium | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-200 | `@rntme/db-studio` | RNT-203#6 | Medium | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-201 | `@rntme/db-studio` | RNT-203#7 | Low | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-202 | `@rntme/db-studio` | RNT-203#8 | Low | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-203 | `@rntme/db-studio` | RNT-203#9 | Low | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-204 | `@rntme/db-studio` | RNT-203#10 | Low | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-205 | `@rntme/db-studio` | RNT-203#11 | Low | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-206 | `@rntme/event-store` | RNT-204#1 | High | ✅ closed | W3 | ✓ | `test/unit/actor-contract.test.ts` compares EventStore ActorRef variants and runtime kinds against `@rntme/pdm` | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-207 | `@rntme/event-store` | RNT-204#2 | High | ✅ closed | W3 | ✓ | `SqliteEventStore` persists serviceName metadata and rejects mismatched or pre-metadata event logs before remapping old events | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-208 | `@rntme/event-store` | RNT-204#3 | Medium | 📦 park | — | ✓ | src/types/envelope.ts — data: TPayload, but append accepts unknown |  [triage] park: real but no foreseeable shoot |
| U-209 | `@rntme/event-store` | RNT-204#4 | Medium | ✅ closed | W3 | ✓ | `SqliteEventStore` rejects a second live writer for the same DB file in-process with `EVENT_STORE_SQLITE_SINGLE_WRITER` | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-210 | `@rntme/event-store` | RNT-204#5 | Medium | 📦 park | — | ✓ | test/append-raw.test.ts — versions 5, 7 accepted |  [triage] park: real but no foreseeable shoot |
| U-211 | `@rntme/event-store` | RNT-204#6 | Low | 📦 park | — | skip | vitest.config.ts — no @vitest/coverage-v8 | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-212 | `@rntme/event-store` | RNT-204#7 | Low | 🧹 obsolete | — | ✓ | `getDbHandle()` was tied to the removed db-studio integration; current tracked event-store surface no longer exposes it | [verify] refreshed 2026-05-04 [obsolete] db-studio removed in `f595006` |
| U-213 | `@rntme/event-store` | RNT-204#8 | Low | 📦 park | — | skip | package.json + src/index.ts | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-214 | `@rntme/event-store` | RNT-204#9 | Low | 📦 park | — | skip | README §Out of scope | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-215 | `@rntme/graph-ir-compiler` | RNT-205#1 | High | ✅ closed | W7 | ✓ | packages/artifacts/graph-ir-compiler/src no longer has direct `throw new Error` / `Object.assign(new Error...)` hits per FINISH evidence | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-277 / PR #68 / merge `b634c2606a24fe887a273c151ccbeb329828b0dc` |
| U-216 | `@rntme/graph-ir-compiler` | RNT-205#2 | High | 📦 park | — | ✓ | Four top-level functions repeat parse→validate→normalize pipeline |  [triage] park: real but no foreseeable shoot |
| U-218 | `@rntme/graph-ir-compiler` | RNT-205#4 | Medium | 📦 park | — | ✓ | command-runtime/compile.ts manually calls parsePdm/validatePdm/parseQsm/validateQsm |  [triage] park: real but no foreseeable shoot |
| U-219 | `@rntme/graph-ir-compiler` | RNT-205#5 | Medium | 📦 park | — | ✓ | projection-compile.ts catch returns PROJ_ROLE_UNINFERRABLE for any lowering error |  [triage] park: real but no foreseeable shoot |
| U-220 | `@rntme/graph-ir-compiler` | RNT-205#6 | Medium | 📦 park | — | ✓ | lower.ts default context casts empty object as ValidatedQsm via unknown |  [triage] park: real but no foreseeable shoot |
| U-221 | `@rntme/graph-ir-compiler` | RNT-205#7 | Medium | 📦 park | — | skip | STRUCT_DUPLICATE_GRAPH_ID returned for 0/>1 graphs and missing graphId across 3 files | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-222 | `@rntme/graph-ir-compiler` | RNT-205#8 | Medium | 📦 park | — | skip | index.ts exports parseAuthoringSpec, validateStructural, validateSemantic, normalize as public | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-223 | `@rntme/graph-ir-compiler` | RNT-205#9 | Low | 📦 park | — | skip | explain in index.ts mirrors compile almost line-for-line, only collecting intermediates | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-224 | `@rntme/graph-ir-compiler` | RNT-205#10 | Low | 📦 park | — | skip | vitest run --coverage fails: missing @vitest/coverage-v8 in devDependencies | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-225 | `@rntme/issue-tracker-api-demo` | RNT-221#1 | High | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-226 | `@rntme/issue-tracker-api-demo` | RNT-221#2 | High | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-227 | `@rntme/issue-tracker-api-demo` | RNT-221#3 | High | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-228 | `@rntme/issue-tracker-api-demo` | RNT-221#4 | Medium | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-229 | `@rntme/issue-tracker-api-demo` | RNT-221#5 | Medium | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-230 | `@rntme/issue-tracker-api-demo` | RNT-221#6 | Medium | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-231 | `@rntme/issue-tracker-api-demo` | RNT-221#7 | Medium | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-232 | `@rntme/issue-tracker-api-demo` | RNT-221#8 | Medium | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-233 | `@rntme/issue-tracker-api-demo` | RNT-221#9 | Low | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-234 | `@rntme/issue-tracker-api-demo` | RNT-221#10 | Low | 🧹 obsolete | — | ✓ | `demo/issue-tracker-api` was removed from the tracked workspace in `f595006`; canonical project-shape example is now `demo/notes-blueprint` | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-235 | `@rntme/module-skeleton` | RNT-206#1 | High | ✅ closed | W4 | ✓ | src/manifest-shape.ts — only name, version, description? | [verify] src/manifest-shape.ts (lines 7-11) declares `ModuleManifest` with only { name: string; version: string; description?: st [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612` |
| U-236 | `@rntme/module-skeleton` | RNT-206#2 | Medium | 📦 park | — | ✓ | src/index.ts hard-codes '0.0.0'; package.json also says 0.0.0 | [verify] src/index.ts line 1 hard-codes `export const VERSION = '0.0.0';` as a string literal. package.json line 3 also says `"ve [triage] park: real but no foreseeable shoot |
| U-237 | `@rntme/module-skeleton` | RNT-206#3 | Medium | 📦 park | — | ✓ | src/handlers.ts — _input is unused; handler always returns same aggregateId | [verify] src/handlers.ts (lines 4-13): `echo: async (ctx, _input) => ({ ok: true, value: { aggregateId: 'echo', version: 0, event [triage] park: real but no foreseeable shoot |
| U-238 | `@rntme/module-skeleton` | RNT-206#4 | Medium | 📦 park | — | ✓ | tsconfig.check.json include omits test/public-contract | [verify] tsconfig.check.json line 10: `"include": ["src/**/*.ts", "test/unit/**/*.test.ts"]`. The `test/public-contract/` directo [triage] park: real but no foreseeable shoot |
| U-239 | `@rntme/module-skeleton` | RNT-206#5 | Low | 📦 park | — | skip | mkCtx duplicated in handlers.test.ts, boot-skeleton.test.ts, _smoke.test.ts | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-240 | `@rntme/module-skeleton` | RNT-206#6 | Low | 📦 park | — | skip | package.json — test script chains pnpm build && two vitest runs | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-241 | `@rntme/module-skeleton` | RNT-206#7 | Low | 📦 park | — | skip | Only test/unit/ and test/public-contract/ directories exist | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-242 | `@rntme/module-skeleton` | RNT-206#8 | Low | 📦 park | — | skip | No .gitignore file in the package | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-243 | `@rntme/pdm` | RNT-207#1 | Medium | 📦 park | — | ✓ | src/load/load-dir.ts calls parsePdm but not validatePdm |  [triage] park: real but no foreseeable shoot |
| U-244 | `@rntme/pdm` | RNT-207#2 | Medium | 📦 park | — | ✓ | normalizeFrom duplicated in state-machine.ts, pdm-resolver.ts, event-types.ts |  [triage] park: real but no foreseeable shoot |
| U-245 | `@rntme/pdm` | RNT-207#3 | Low | 📦 park | — | skip | load-dir.ts uses string literal 'PDM_PARSE_DIR_INVALID' not ERROR_CODES | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-246 | `@rntme/pdm` | RNT-207#4 | Low | 📦 park | — | skip | Missing tests: composite key, self-relation, multi-entity SM, empty affects, malformed JSON | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-247 | `@rntme/pdm` | RNT-207#5 | Low | 📦 park | — | skip | src/types/artifact.ts declares ActorRef — runtime event-envelope concept | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-248 | `@rntme/pdm` | RNT-207#6 | Low | 📦 park | — | skip | PdmDirectoryIndexSchema only requires { version?: string }, not semver | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-249 | `@rntme/pdm` | RNT-207#7 | Low | 📦 park | — | skip | No unit test in validate-state-machine.test.ts for kind: 'root' + stateMachine | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-250 | `@rntme/pre-step-demo` | RNT-222#B1 | Blocker | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-251 | `@rntme/pre-step-demo` | RNT-222#H1 | High | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-252 | `@rntme/pre-step-demo` | RNT-222#H2 | High | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-253 | `@rntme/pre-step-demo` | RNT-222#H3 | High | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-254 | `@rntme/pre-step-demo` | RNT-222#M1 | Medium | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-255 | `@rntme/pre-step-demo` | RNT-222#M2 | Medium | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-256 | `@rntme/pre-step-demo` | RNT-222#M3 | Medium | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-257 | `@rntme/pre-step-demo` | RNT-222#M4 | Medium | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-258 | `@rntme/pre-step-demo` | RNT-222#M5 | Medium | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-259 | `@rntme/pre-step-demo` | RNT-222#L1 | Low | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-260 | `@rntme/pre-step-demo` | RNT-222#L2 | Low | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-261 | `@rntme/pre-step-demo` | RNT-222#L3 | Low | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-262 | `@rntme/pre-step-demo` | RNT-222#L4 | Low | 🧹 obsolete | — | ✓ | `demo/pre-step-demo` was removed from the tracked workspace in `f595006`; pre-step behavior now lives in runtime/module integration specs and tests | [verify] refreshed 2026-05-04 [obsolete] removed demo |
| U-263 | `@rntme/projection-consumer` | RNT-208#1 | Blocker | ✅ closed | W3 | ✓ | README and code agree on `skipped-no-handler`, including the aggregateType mismatch discriminator | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-264 | `@rntme/projection-consumer` | RNT-208#2 | High | ✅ closed | W3 | ✓ | `rollbackAndPreserveOriginal` keeps the original batch error primary and attaches rollback failure separately; covered by `consumer-rollback.test.ts` | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-265 | `@rntme/projection-consumer` | RNT-208#3 | High | ✅ closed | W3 | ✓ | `ProjectionConsumer` public shape is only `start()`/`stop()`; unit test asserts `getDbHandle` is not exposed | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-266 | `@rntme/projection-consumer` | RNT-208#4 | Medium | 📦 park | — | ✓ | VERSION hardcoded as '0.0.0' in src/index.ts |  [triage] park: real but no foreseeable shoot |
| U-267 | `@rntme/projection-consumer` | RNT-208#5 | Medium | 📦 park | — | ✓ | Heavy compile dep on graph-ir-compiler for one type DerivedColumnBinding |  [triage] park: real but no foreseeable shoot |
| U-268 | `@rntme/projection-consumer` | RNT-208#6 | Medium | 📦 park | — | ✓ | stop() may produce unhandled rejection when onError absent |  [triage] park: real but no foreseeable shoot |
| U-269 | `@rntme/projection-consumer` | RNT-208#7 | Medium | 📦 park | — | skip | consumer-rollback test only covers apply errors, not COMMIT failure | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-270 | `@rntme/projection-consumer` | RNT-208#8 | Low | 📦 park | — | skip | bootstrapProjections regex DDL rewrite fragile to whitespace/comments | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-271 | `@rntme/projection-consumer` | RNT-208#9 | Low | 📦 park | — | skip | InMemoryKafkaConsumer exported from main index despite test-only role | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-272 | `@rntme/projection-consumer` | RNT-208#10 | Low | 📦 park | — | skip | getAfter silently drops 'before' key by heuristic, risking data loss | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-273 | `@rntme/projection-consumer` | RNT-208#11 | Low | 📦 park | — | skip | selectCurrentVersion uses non-null assertion on find() | [verify] not in sample [triage] fire: condition currently shooting |
| U-274 | `@rntme/qsm` | RNT-209#1 | High | 📦 park | — | ✓ | src/derive/handler.ts — continue on backing !== 'entity-mirror' |  [triage] park: real but no foreseeable shoot |
| U-275 | `@rntme/qsm` | RNT-209#2 | High | ✅ closed | A11 | ✓ | `test/integration/ddl-bootstrap.test.ts` now validates realistic QSM fixtures, generates projection DDL, applies it to real in-memory SQLite, and verifies explicit table, omitted-table fallback, indexes, idempotency columns, resolver alignment, and composite keys. | [triage] park: real but no foreseeable shoot [fix] closed by QSM DDL bootstrap integration coverage pass 2026-05-04 |
| U-276 | `@rntme/qsm` | RNT-209#3 | Medium | 📦 park | — | ✓ | src/load/load-dir.ts — catches all errors as QSM_PARSE_DIR_INVALID |  [triage] park: real but no foreseeable shoot |
| U-277 | `@rntme/qsm` | RNT-209#4 | Medium | 📦 park | — | ✓ | src/parse/schema.ts — pathPrefix optional but never validated/used |  [triage] park: real but no foreseeable shoot |
| U-278 | `@rntme/qsm` | RNT-209#5 | Medium | 📦 park | — | ✓ | src/validate/structural.ts — code used when derived lacks explicit table |  [triage] park: real but no foreseeable shoot |
| U-279 | `@rntme/qsm` | RNT-209#6 | Medium | 📦 park | — | skip | src/validate/cross-ref.ts — skips relations with non-entity-mirror sides | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-280 | `@rntme/qsm` | RNT-209#7 | Medium | 📦 park | — | skip | 9 of 14 test files fail before pnpm -r run build resolves @rntme/pdm | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-281 | `@rntme/qsm` | RNT-209#8 | Low | 📦 park | — | skip | src/parse/parse.ts — JSON syntax errors share schema-violation code | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-282 | `@rntme/qsm` | RNT-209#9 | Low | 📦 park | — | skip | src/validate/structural.ts — projection_${name.toLowerCase()} default | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-283 | `@rntme/runtime` | RNT-210#1 | Blocker | ✅ closed | W4 | ✓ | package.json — zod ^4.0.0 resolves to canary; manifest parser uses v3 internals | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612` |
| U-284 | `@rntme/runtime` | RNT-210#2 | Blocker | ✅ closed | W4 | ✓ | grpc-adapter-client.ts uses grpc.credentials.createInsecure() with no TLS option | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612` |
| U-285 | `@rntme/runtime` | RNT-210#3 | Blocker | ✅ closed | W4 | ✓ | load-service.ts catch blocks always return IO_ERROR, losing PDM/QSM error codes | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612` |
| U-286 | `@rntme/runtime` | RNT-210#4 | High | 📦 park | — | ✓ | src/index.ts — VERSION = '0.0.0' permanent; package.json mirrors it |  [triage] park: real but no foreseeable shoot |
| U-287 | `@rntme/runtime` | RNT-210#5 | High | ✅ closed | W3 | ✓ | `startSeenEventsRetention` validates env/option retention days as a positive integer and fails startup for unsafe values | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-288 | `@rntme/runtime` | RNT-210#6 | High | ✅ closed | A8 | ✓ | `validateManifest` now constrains `auth.actorKind` to `user | system | service`; `buildActorFromRequest` trims actor IDs and returns `null` for missing, blank, overlong, or unsafe header values. | [triage] park: real but no foreseeable shoot [fix] closed by runtime actor validation pass 2026-05-04 |
| U-289 | `@rntme/runtime` | RNT-210#7 | High | ✅ closed | A7 | ✓ | `startService` now validates `RuntimeConfig` before boot via `validateRuntimeConfig`/`RuntimeConfigError`, rejecting invalid plugin shapes and contradictory seed options with structured `RUNTIME_CONFIG_INVALID` errors. | [triage] park: real but no foreseeable shoot [fix] closed by runtime config validation pass 2026-05-04 |
| U-290 | `@rntme/runtime` | RNT-210#8 | High | ✅ closed | W4 | ✓ | build-grpc-surface.ts collectShapesFromService — MVP comment, row inputs unresolved | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612` |
| U-291 | `@rntme/runtime` | RNT-210#9 | High | 📦 park | — | ✓ | load-service.ts uses readTextFile/readJsonFile/readGraphsDir directly; no abstraction |  [triage] park: real but no foreseeable shoot |
| U-292 | `@rntme/runtime` | RNT-210#10 | High | ✅ closed | A13 | ✓ | `RunningService.stop()` now has a bounded HTTP shutdown timeout and force-closes active HTTP connections after the budget | [fix] added `RuntimeConfig.shutdownTimeoutMs`, positive-integer validation, and a hanging request regression in `test/integration/shutdown.test.ts`. |
| U-293 | `@rntme/runtime` | RNT-210#11 | Medium | ✅ closed | A10 | ✓ | `crossValidateDerivedProjections` now accepts parsed Graph IR plus `ValidatedPdm` / `ValidatedQsm` only and calls `compileProjectionGraphFromValidated`; raw `rawPdm` / `rawQsm` inputs are rejected by a type fixture. | [triage] park: real but no foreseeable shoot [fix] closed by runtime derived-projection validation boundary pass 2026-05-04 |
| U-294 | `@rntme/runtime` | RNT-210#12 | Medium | 📦 park | — | ✓ | Dockerfile COPY demo ./demo inflates build context for runtime image |  [triage] park: real but no foreseeable shoot |
| U-295 | `@rntme/runtime` | RNT-210#13 | Medium | 📦 park | — | ✓ | proto-registry.ts stops at first protobuf.Service per file; extras dropped silently |  [triage] park: real but no foreseeable shoot |
| U-296 | `@rntme/runtime` | RNT-210#14 | Medium | 📦 park | — | skip | interfaces.ts Surface — listen optional; Http mounts, Grpc listens; mount no-op | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-297 | `@rntme/runtime` | RNT-210#15 | Medium | 📦 park | — | skip | graph-ir-command-executor.ts mapError detail omits stack for unexpected errors | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-298 | `@rntme/runtime` | RNT-210#16 | Medium | 📦 park | — | skip | manifest/validate.ts — applyEnvOverrides and validateManifest use differing accumulation | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-299 | `@rntme/runtime` | RNT-210#17 | Medium | ✅ closed | — | ✓ | `InMemoryBus.consumer({ topic })` now honors exact topic and wildcard subscriptions; covered by `test/unit/in-memory-bus.test.ts` | [verify] refreshed 2026-05-04 [fix] RNT-275 / PR #55 / merge `f3f45c4` |
| U-300 | `@rntme/runtime` | RNT-210#18 | Low | 📦 park | — | skip | package.json files includes Dockerfile.template referencing stale image tag 1.0 | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-301 | `@rntme/runtime` | RNT-210#19 | Low | 📦 park | — | skip | manifest/validate.ts hand-rolled regex rejects pre-release/build metadata | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-302 | `@rntme/runtime` | RNT-210#20 | Low | ✅ closed | W4 | skip | http-surface.ts — no bodyLimit or rate limit middleware | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612` |
| U-303 | `@rntme/runtime` | RNT-210#21 | Low | 📦 park | — | skip | vitest.config.ts testTimeout 15_000 may be tight for CI runners | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-304 | `@rntme/runtime` | RNT-210#22 | Low | 📦 park | — | skip | contract-tests.ts not re-exported and README lacks usage section | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-305 | `@rntme/seed` | RNT-211#1 | High | 📦 park | — | ✓ | src/apply.ts opts: ApplySeedOptions required, spec §5.1 says opts? |  [triage] park: real but no foreseeable shoot |
| U-306 | `@rntme/seed` | RNT-211#2 | High | 📦 park | — | ✓ | src/validate.ts ValidateCtx has serviceName, spec §5 omits it |  [triage] park: real but no foreseeable shoot |
| U-307 | `@rntme/seed` | RNT-211#3 | High | 📦 park | — | ✓ | src/apply.ts uses readRecordsFrom limit 1_000_000 instead of COUNT |  [triage] park: real but no foreseeable shoot |
| U-308 | `@rntme/seed` | RNT-211#4 | High | ✅ closed | W10 | ✓ | src/bin/cli.ts buildCtx returns null on PDM parse/validate errors | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-279 / PR #80 / merge `dc86168f0017f6f7430d1bc12e156c5c319d7bcd` |
| U-309 | `@rntme/seed` | RNT-211#5 | Medium | 📦 park | — | ✓ | src/wrap-payloads.ts isAlreadyWrapped uses strict length === 2 |  [triage] park: real but no foreseeable shoot |
| U-311 | `@rntme/seed` | RNT-211#7 | Medium | 📦 park | — | ✓ | src/validate.ts uses randomUUID() for seedCorrelationId |  [triage] park: real but no foreseeable shoot |
| U-312 | `@rntme/seed` | RNT-211#8 | Medium | 📦 park | — | ✓ | src/validate.ts returns SEED_SYNTAX_INVALID when ctx.serviceName missing |  [triage] park: real but no foreseeable shoot |
| U-313 | `@rntme/seed` | RNT-211#9 | Medium | 📦 park | — | ✓ | apply-strict/upsert tests do not mock SQLite failure for SEED_APPLY_IO |  [triage] park: real but no foreseeable shoot |
| U-314 | `@rntme/seed` | RNT-211#10 | Medium | 📦 park | — | ✓ | Spec §4.1 uses legacy field names; impl uses CloudEvents-aligned keys |  [triage] park: real but no foreseeable shoot |
| U-315 | `@rntme/seed` | RNT-211#11 | Low | 📦 park | — | skip | scaffold.test.ts is an empty placeholder | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-316 | `@rntme/seed` | RNT-211#12 | Low | 📦 park | — | skip | builder.ts stamps correlationId on event(); validate.ts stamps again | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-317 | `@rntme/seed` | RNT-211#13 | Low | 📦 park | — | skip | package.json postbuild is an inline `node -e ...` one-liner | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-318 | `@rntme/seed` | RNT-211#14 | Low | 📦 park | — | skip | src/bin/cli.ts DEFAULT_SERVICE_NAME = 'rntme-seed' silent fallback | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-319 | `@rntme/ui` | RNT-212#B1 | Blocker | ✅ closed | A1 | ✓ | zod is used for internal manifest/spec/screen parse schemas | [fix] `src/parse/schema.ts` added and wired through `resolve`; covered by `packages/artifacts/ui/test/unit/resolve.test.ts`. |
| U-320 | `@rntme/ui` | RNT-212#H1 | High | ✅ closed | A1 | ✓ | resolve emits `MANIFEST_INVALID`, `SPEC_INVALID`, and `SCREEN_SCHEMA_INVALID` for malformed authoring files | [fix] parse schemas validate every loaded JSON source file before expand/validate; covered by `packages/artifacts/ui/test/unit/resolve.test.ts`. |
| U-321 | `@rntme/ui` | RNT-212#H2 | High | ✅ closed | A1 | ✓ | duplicate derived screen keys fail with `DUPLICATE_SCREEN_KEY` | [fix] `resolve` tracks screen base paths by derived key before assignment; covered by `packages/artifacts/ui/test/unit/resolve.test.ts`. |
| U-322 | `@rntme/ui` | RNT-212#H3 | High | ✅ closed | A1 | ✓ | emit returns `EMIT_FAILED` for missing `httpMap` data/command bindings | [fix] `resolveScreenHttp` accumulates missing mapping errors and `emit` returns `Result.err`; covered by `packages/artifacts/ui/test/unit/emit.test.ts`. |
| U-323 | `@rntme/ui` | RNT-212#H4 | High | ✅ closed | A12 | ✓ | Reserved UiErrorCode values now have coverage for binding kind, prop type, and uncovered input checks | [fix] `packages/artifacts/ui/test/unit/validate.test.ts` covers `BINDING_KIND_MISMATCH`, `TYPE_MISMATCH`, and `UNCOVERED_INPUT`; verified by `pnpm -F @rntme/ui test -- test/unit/validate.test.ts`. |
| U-324 | `@rntme/ui` | RNT-212#H5 | High | ✅ closed | A12 | ✓ | TYPE_MISMATCH and UNCOVERED_INPUT are emitted by real consistency checks | [fix] literal component prop mismatches emit `TYPE_MISMATCH`; uncovered data/command/navigation input state paths emit `UNCOVERED_INPUT`. |
| U-325 | `@rntme/ui` | RNT-212#M1 | Medium | 📦 park | — | ✓ | validate/index.ts declares resolveComponent; no validator calls it |  [triage] park: real but no foreseeable shoot |
| U-326 | `@rntme/ui` | RNT-212#M2 | Medium | ✅ closed | A12 | ✓ | BINDING_KIND_MISMATCH emits when resolver metadata disagrees with data/query or command/action usage | [fix] `validateReferences` inspects optional `{ kind }` or `{ entry: { kind } }` metadata while keeping opaque resolvers compatible. |
| U-327 | `@rntme/ui` | RNT-212#M3 | Medium | 📦 park | — | ✓ | types/source.ts and emit.ts hardcode '2.0'; resolve never checks manifest.version |  [triage] park: real but no foreseeable shoot |
| U-328 | `@rntme/ui` | RNT-212#M4 | Medium | 📦 park | — | skip | emit returns single in-memory CompiledArtifact; no pre-split output | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-329 | `@rntme/ui` | RNT-212#M5 | Medium | 📦 park | — | skip | Layout with zero Slot elements passes validateStructural | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-330 | `@rntme/ui` | RNT-212#M6 | Medium | 📦 park | — | skip | collectStatePaths walks props/visible/on/watch but not repeat.statePath | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-331 | `@rntme/ui` | RNT-212#M7 | Medium | 📦 park | — | skip | isRefElement uses `'$ref' in el`; passes objects with both shapes | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-332 | `@rntme/ui` | RNT-212#M8 | Medium | 📦 park | — | skip | collectFragments uses `return` after CIRCULAR_REF, aborting collection | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-333 | `@rntme/ui` | RNT-212#M9 | Medium | 📦 park | — | skip | validate/index.ts implements :param matching but no test exercises it | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-334 | `@rntme/ui` | RNT-212#M10 | Medium | 📦 park | — | skip | packages/artifacts/ui/tsconfig.json has composite: false | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-335 | `@rntme/ui` | RNT-212#M11 | Medium | 📦 park | — | skip | No eslint.config.mjs or .eslintrc in packages/artifacts/ui/ | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-336 | `@rntme/ui` | RNT-212#L1 | Low | 📦 park | — | skip | UiError.path is logical (e.g. screen:home/actions/submit), not file/offset | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-337 | `@rntme/ui` | RNT-212#L2 | Low | 📦 park | — | skip | CommandAction.onSuccess fields not validated against routes/bindings | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-338 | `@rntme/ui` | RNT-212#L3 | Low | 📦 park | — | skip | ResolvedSource.baseDir and ExpandedSource.baseDir carry FS path through | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-339 | `@rntme/ui` | RNT-212#L4 | Low | 📦 park | — | skip | emit.ts casts spread object to CompiledScreen | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-340 | `@rntme/ui` | RNT-212#L5 | Low | 📦 park | — | skip | README links to ../../docs/superpowers/specs/done/... via relative paths | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-341 | `@rntme/ui-runtime` | RNT-213#B1 | Blocker | ✅ closed | A2 | ✓ | React 19 runtime packages now have React 19 type packages | [fix] `@rntme/ui-runtime` uses `@types/react` 19.2.14 and `@types/react-dom` 19.2.3; adjacent React 19 modules were aligned to avoid peer drift; verified by `pnpm -F @rntme/ui-runtime build`. |
| U-342 | `@rntme/ui-runtime` | RNT-213#H1 | High | 📦 park | — | ✓ | no eslint.config.mjs, no lint script (only pkg without lint) |  [triage] park: real but no foreseeable shoot |
| U-343 | `@rntme/ui-runtime` | RNT-213#H2 | High | 📦 park | — | ✓ | buildUrl/resolveParamValue/dispatch duplicated across driver/entry/registry |  [triage] park: real but no foreseeable shoot |
| U-344 | `@rntme/ui-runtime` | RNT-213#H3 | High | ✅ closed | A2 | ✓ | entry/boot/registry critical paths now have focused unit coverage | [fix] added registry dispatch tests plus boot fallback assertions for `/auth/user` and `/runtime/bootErrors`; verified by `pnpm -F @rntme/ui-runtime test` and build. |
| U-345 | `@rntme/ui-runtime` | RNT-213#M1 | Medium | 📦 park | — | ✓ | server/index.ts uses !fp.startsWith(resolvedAssetsDir + sep) |  [triage] park: real but no foreseeable shoot |
| U-346 | `@rntme/ui-runtime` | RNT-213#M2 | Medium | ✅ closed | W14 | ✓ | createApp shell responses now send CSP, X-Frame-Options, Referrer-Policy, X-Content-Type-Options, and Permissions-Policy | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-281 |
| U-347 | `@rntme/ui-runtime` | RNT-213#M3 | Medium | 📦 park | — | ✓ | layout-manager.tsx renders Renderer without ErrorBoundary |  [triage] park: real but no foreseeable shoot |
| U-348 | `@rntme/ui-runtime` | RNT-213#M4 | Medium | 📦 park | — | ✓ | client/index.ts exports createDriver but entry.tsx reimplements fetchEndpoint/buildUrl |  [triage] park: real but no foreseeable shoot |
| U-349 | `@rntme/ui-runtime` | RNT-213#M5 | Medium | 📦 park | — | ✓ | driver.ts and registry.ts use globalThis.alert?.(text) for errors |  [triage] park: real but no foreseeable shoot |
| U-350 | `@rntme/ui-runtime` | RNT-213#L1 | Low | 📦 park | — | ✓ | package.json version 0.0.0 |  [triage] park: real but no foreseeable shoot |
| U-351 | `@rntme/ui-runtime` | RNT-213#L2 | Low | 📦 park | — | ✓ | build.ts execSync of @tailwindcss/cli without timeout |  [triage] park: real but no foreseeable shoot |
| U-352 | `@rntme/ui-runtime` | RNT-213#L3 | Low | 📦 park | — | ✓ | vitest.config.ts environment: 'node' for browser modules |  [triage] park: real but no foreseeable shoot |
| U-353 | `@rntme/ui-runtime` | RNT-213#L4 | Low | 📦 park | — | ✓ | entry.tsx redirects unmatched paths to patterns[0] |  [triage] park: real but no foreseeable shoot |
| U-354 | `@rntme/ui-runtime` | RNT-213#L5 | Low | 📦 park | — | ✓ | screen-loader.ts Map cache without TTL or version invalidation |  [triage] park: real but no foreseeable shoot |
| U-355 | `@rntme/bindings-http` | discovered-during-U-031 | Medium | ✅ closed | A3 | ✓ | Missing `eventStore`, `commandExecutor`, or `externalAdapterClient` now throws `BindingsRuntimeError` with structured cause code `BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY`. | [verify] discovered during verification of U-031 [triage] park: real but no foreseeable shoot [fix] closed by runtime boundary hygiene pass 2026-05-04 |
| U-356 | `@rntme/cli` | discovered | Medium | 📦 park | — | ✓ | src/commands/init.ts:66-84 implements its own writeOk/writeErr like skills/install.ts. Both init and skills install commands skip runCommand from harness.ts. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-357 | `@rntme/db-studio` | discovered | Medium | 🧹 obsolete | — | ✓ | `@rntme/db-studio` package was removed in `f595006` and superseded by Drizzle Studio | [verify] refreshed 2026-05-04 [obsolete] removed package |
| U-358 | `@rntme/platform-http` | discovered | Medium | ✅ closed | W15 | ✓ | auth.test.ts and tx.test.ts now exist (U-128 partially obsolete) but cors.test.ts is still missing — and the regex-from-glob path in cors.ts (U-122) is the riskiest middleware to leave untested. | [verify] discovered during verification [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-359 | `@rntme/conformance-ai-llm` | discovered | Medium | ❌ rejected | — | ✓ | src/fixtures/media/index.ts fallback resolve(here, '../../../src/fixtures/media', filename) was claimed dead. Verified via node path.resolve: from dist/fixtures/media/ the fallback resolves to `<pkg>/src/fixtures/media/<filename>` which exists. | [verify] discovered during verification [reject] evidence-only duplicate of U-147 false-positive rejection |
| U-360 | `@rntme/conformance-ai-llm` | discovered | Medium | 📦 park | — | ✓ | modules/ai-llm/conformance/package.json test:watch = 'pnpm run build:deps && vitest'. Identity's test:watch = 'vitest' (no build:deps). CRM has no build:deps at all. AI-LLM forces a full contracts rebuild on every watch invocation. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-361 | `@rntme/conformance-ai-llm` | discovered | Medium | 📦 park | — | ✓ | src/fixtures/content-blocks.ts imports { proto } from '@rntme/contracts-ai-llm-v1' and references proto.rntme.contracts.ai_llm.v1.ContentBlockType.CONTENT_BLOCK_TYPE_TEXT etc. This couples fixtures at runtime to the generated proto package; raw literal block-type strings would be plan-aligned and decoupled. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-362 | `@rntme/contracts-common-v1` | discovered | Medium | 📦 park | — | ✓ | src/index.ts (2 lines) only does `export * as proto from './proto.gen.js'` and `export type { rntme as Rntme }`. No named CanonicalRef/CommandContext/Name/ListRequest exports — this is the same shape as U-173 (Low, in skip). Adjacent severe finding: error-codes.json is `{}` (3 bytes) — empty placeholder, no actual codes registered, which combines with U-174 (no error-codes.ts) to mean the package has zero error-code surface despite the contracts pattern. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-363 | `@rntme/event-store` | discovered | Medium | ✅ closed | A9 | ✓ | `event_log.actor_kind` now has a SQLite `CHECK` for `user` / `system` / `service` / `NULL`; `applyEventStoreSchema` rebuilds valid D9 legacy tables that lack the check and rejects corrupted legacy rows with `EVENT_STORE_SCHEMA_INCOMPATIBLE`. | [verify] discovered during verification [triage] park: real but no foreseeable shoot [fix] closed by event-store actor-kind schema pass 2026-05-04 |
| U-364 | `@rntme/graph-ir-compiler` | discovered | Medium | 📦 park | — | ✓ | /home/coder/project/packages/artifacts/graph-ir-compiler/src/projection-compile.ts | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-365 | `@rntme/module-skeleton` | discovered | Medium | 📦 park | — | ✓ |  | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-366 | `@rntme/projection-consumer` | discovered | Medium | 📦 park | — | ✓ |  | [verify] discovered during verification [triage] park: real but no foreseeable shoot |

---

## Lens C — Per-package index (auditor view)

### `@rntme/cli` — total findings: 12

- → DEV:
- → DECIDE:
- → PARK: U-063, U-064, U-065, U-066, U-068, U-069, U-070, U-356
- → REJECTED: U-060, U-061, U-062, U-067

### `@rntme/deploy-core` — total findings: 7

- → DEV:
- → DECIDE:
- → PARK: U-071, U-072, U-073, U-074, U-075, U-076, U-077
- → REJECTED:

### `@rntme/deploy-dokploy` — total findings: 13

- → DEV:
- → DECIDE:
- → PARK: U-080, U-081, U-083, U-084, U-086, U-088, U-089, U-090
- → CLOSED: U-078, U-079
- → REJECTED: U-082, U-085

### `@rntme/landing` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK: U-091, U-092, U-093, U-094, U-095, U-096, U-097, U-098, U-099, U-100
- → REJECTED:

### `@rntme/platform-core` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK: U-102, U-103, U-104, U-106, U-107, U-108, U-109, U-110
- → REJECTED: U-101, U-105

### `@rntme/platform-http` — total findings: 21

- → DEV:
- → DECIDE:
- → PARK: U-111, U-112, U-115, U-116, U-117, U-118, U-119, U-120, U-121, U-124, U-125, U-126, U-127, U-128, U-129, U-130
- → CLOSED: U-113, U-114
- → REJECTED:

### `@rntme/platform-storage` — total findings: 11

- → DEV:
- → DECIDE:
- → PARK: U-131, U-133, U-134, U-135, U-136, U-139, U-140, U-141
- → CLOSED: U-132
- → REJECTED:

### `@rntme/bindings` — total findings: 9

- → DEV:
- → DECIDE: U-047
- → PARK: U-039, U-040, U-041, U-042, U-043, U-044, U-045, U-046
- → REJECTED:

### `@rntme/bindings-grpc` — total findings: 13

- → DEV:
- → DECIDE:
- → PARK: U-014, U-015, U-016, U-018, U-019, U-020, U-021, U-022, U-024, U-025, U-026
- → OBSOLETE: U-017
- → REJECTED:

### `@rntme/bindings-http` — total findings: 13

- → DEV:
- → DECIDE:
- → PARK: U-027, U-028, U-029, U-030, U-033, U-034, U-035, U-036, U-037, U-038
- → CLOSED: U-031, U-032, U-355
- → REJECTED:

### `@rntme/blueprint` — total findings: 12

- → DEV:
- → DECIDE:
- → PARK: U-049, U-051, U-052, U-053, U-054, U-055, U-056, U-057, U-058, U-059
- → REJECTED:

### `@rntme/conformance-ai-llm` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK: U-142, U-143, U-144, U-145, U-146, U-148, U-360, U-361
- → REJECTED: U-147, U-359

### `@rntme/conformance-crm` — total findings: 8

- → DEV:
- → DECIDE:
- → PARK: U-149, U-150, U-151, U-152, U-153, U-154, U-155, U-156
- → REJECTED:

### `@rntme/conformance-identity` — total findings: 8

- → DEV:
- → DECIDE:
- → PARK:
- → CLOSED: U-157, U-158, U-159, U-160, U-161, U-162, U-163, U-164
- → REJECTED:

### `@rntme/contracts-ai-llm-v1` — total findings: 8

- → DEV:
- → DECIDE:
- → PARK: U-165, U-166, U-167, U-168, U-169, U-170, U-171, U-172
- → REJECTED:

### `@rntme/contracts-common-v1` — total findings: 8

- → DEV:
- → DECIDE:
- → PARK: U-173, U-174, U-175, U-176, U-177, U-178, U-179, U-362
- → REJECTED:

### `@rntme/contracts-crm-v1` — total findings: 8

- → DEV:
- → DECIDE:
- → PARK: U-180, U-181, U-182, U-183, U-184, U-185, U-186, U-187
- → REJECTED:

### `@rntme/contracts-identity-v1` — total findings: 7

- → DEV:
- → DECIDE:
- → PARK:
- → CLOSED: U-188, U-189, U-190, U-191, U-192, U-193, U-194
- → REJECTED:

### `@rntme/db-studio` — total findings: 12

- → DEV:
- → DECIDE:
- → PARK:
- → OBSOLETE: U-195, U-196, U-197, U-198, U-199, U-200, U-201, U-202, U-203, U-204, U-205, U-357
- → REJECTED:

### `@rntme/event-store` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK: U-208, U-210, U-211, U-213, U-214
- → CLOSED: U-206, U-207, U-209, U-363
- → OBSOLETE: U-212
- → REJECTED:

### `@rntme/graph-ir-compiler` — total findings: 11

- → DEV:
- → DECIDE:
- → PARK: U-216, U-218, U-219, U-220, U-221, U-222, U-223, U-224, U-364
- → REJECTED: U-217

### `@rntme/issue-tracker-api-demo` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK:
- → OBSOLETE: U-225, U-226, U-227, U-228, U-229, U-230, U-231, U-232, U-233, U-234
- → REJECTED:

### `@rntme/module-skeleton` — total findings: 9

- → DEV:
- → DECIDE:
- → PARK: U-236, U-237, U-238, U-239, U-240, U-241, U-242, U-365
- → REJECTED:

### `@rntme/pdm` — total findings: 7

- → DEV:
- → DECIDE:
- → PARK: U-243, U-244, U-245, U-246, U-247, U-248, U-249
- → REJECTED:

### `@rntme/pre-step-demo` — total findings: 13

- → DEV:
- → DECIDE:
- → PARK:
- → OBSOLETE: U-250, U-251, U-252, U-253, U-254, U-255, U-256, U-257, U-258, U-259, U-260, U-261, U-262
- → REJECTED:

### `@rntme/projection-consumer` — total findings: 12

- → DEV:
- → DECIDE:
- → PARK: U-266, U-267, U-268, U-269, U-270, U-271, U-272, U-273, U-366
- → CLOSED: U-263, U-264, U-265
- → REJECTED:

### `@rntme/qsm` — total findings: 9

- → DEV:
- → DECIDE:
- → PARK: U-274, U-276, U-277, U-278, U-279, U-280, U-281, U-282
- → CLOSED: U-275
- → REJECTED:

### `@rntme/runtime` — total findings: 22

- → DEV:
- → DECIDE:
- → PARK: U-286, U-291, U-294, U-295, U-296, U-297, U-298, U-300, U-301, U-303, U-304
- → CLOSED: U-288, U-289, U-292, U-293
- → CLOSED: U-287, U-299
- → REJECTED:

### `@rntme/seed` — total findings: 14

- → DEV:
- → DECIDE:
- → PARK: U-305, U-306, U-307, U-309, U-311, U-312, U-313, U-314, U-315, U-316, U-317, U-318
- → REJECTED: U-310

### `@rntme/ui` — total findings: 22

- → DEV:
- → DECIDE:
- → PARK: U-325, U-327, U-328, U-329, U-330, U-331, U-332, U-333, U-334, U-335, U-336, U-337, U-338, U-339, U-340
- → CLOSED: U-319, U-320, U-321, U-322, U-323, U-324, U-326
- → REJECTED:

### `@rntme/ui-runtime` — total findings: 14

- → DEV:
- → DECIDE:
- → PARK: U-342, U-343, U-345, U-347, U-348, U-349, U-350, U-351, U-352, U-353, U-354
- → REJECTED:

### `monorepo` — total findings: 13

- → DEV:
- → DECIDE:
- → PARK: U-002, U-003, U-005, U-006, U-007, U-008, U-009, U-010, U-011, U-012
- → CLOSED: U-004
- → OBSOLETE: U-013
- → REJECTED: U-001

---

## Track DECIDE

Open questions blocking units. Each requires product or architectural input.

### U-047 — How to handle: Error code registry has no versioning / deprecation strategy

**Background:** src/types/result.ts — ERROR_CODES is a flat const object (in @rntme/bindings)

**Blocks:** —

**@vlad:** ?


---

## Track PARK

Findings real per audit, but no current shoot and no foreseeable shoot. Each grouped by re-evaluate trigger.

### Trigger: first pre-release version tag

- U-184 — Package version 0.0.0 and private with no versioning policy — `@rntme/contracts-crm-v1`

### Trigger: first prod deploy

- U-002 — @rntme/runtime is a god package with 12 workspace deps — `monorepo`
- U-003 — bindings-grpc cross-depends on bindings-http — `monorepo`
- U-005 — Module packages have build:deps invoking other packages — `monorepo`
- U-006 — Conformance packages inconsistently placed in deps vs devDeps — `monorepo`
- U-007 — runtime depends on seed (a CLI tool) in prod dependencies — `monorepo`
- U-014 — actor: null во всех gRPC-командах — `@rntme/bindings-grpc`
- U-015 — bindings-grpc зависит от bindings-http только для executor-contract — `@rntme/bindings-grpc`
- U-016 — Неисчерпывающие switch без fallback-return — `@rntme/bindings-grpc`
- U-027 — Public API surface дрейф vs spec — `@rntme/bindings-http`
- U-028 — Дублирование/расхождение типов с @rntme/graph-ir-compiler — `@rntme/bindings-http`
- U-029 — command-handler.ts нарушает SRP (290 строк) — `@rntme/bindings-http`
- U-030 — Жестко закодированный /api префикс — `@rntme/bindings-http`
- U-049 — Hardcoded scalar registry in binding-resolvers.ts — `@rntme/blueprint`
- U-080 — DokployClient tightly coupled to RenderedDokployResource — `@rntme/deploy-dokploy`
- U-081 — Sequential resource apply with no concurrency control — `@rntme/deploy-dokploy`
- U-091 — data-section-num / id collisions between live and dead components — `@rntme/landing`
- U-092 — Section metadata scattered across ~15 files — `@rntme/landing`
- U-093 — Test coverage critically thin — `@rntme/landing`
- U-102 — archiveOrgCascade missing unit tests inside package — `@rntme/platform-core`
- U-103 — fast-check declared but unused in devDependencies — `@rntme/platform-core`
- U-111 — God object createApp mixes responsibilities — `@rntme/platform-http`
- U-112 — Deploy executor runs inside HTTP process — `@rntme/platform-http`
- U-115 — Unused dependency @hono/zod-openapi — `@rntme/platform-http`
- U-116 — Dokploy client leaked into platform-http — `@rntme/platform-http`
- U-117 — bodyLimit middleware buffers stream and rebuilds Request — `@rntme/platform-http`
- U-131 — Duplicated transaction/helpers across repo files — `@rntme/platform-storage`
- U-142 — Cross-category conformance interface divergence — `@rntme/conformance-ai-llm`
- U-149 — CategoryConformanceSuite/Scenario type schema diverges from identity and ai-llm conformance — `@rntme/conformance-crm`
- U-150 — Missing build:deps script breaks CI on fresh clones — `@rntme/conformance-crm`
- U-165 — Plain-string fields where enums are needed — `@rntme/contracts-ai-llm-v1`
- U-166 — Empty conformance scenarios — `@rntme/contracts-ai-llm-v1`
- U-180 — Conformance assertions reference nonexistent error codes and events — `@rntme/contracts-crm-v1`
- U-181 — layerOf implemented via fragile string-split with no tests — `@rntme/contracts-crm-v1`
- U-216 — Four top-level compile functions duplicate the parse→validate→normalize pipeline — `@rntme/graph-ir-compiler`
- U-274 — derived backing is a facade with no runtime handler logic — `@rntme/qsm`
- U-286 — VERSION export is permanently 0.0.0 — `@rntme/runtime`
- U-291 — loadService is tightly coupled to the filesystem — `@rntme/runtime`
- U-305 — applySeed signature mismatch with spec (opts required vs optional) — `@rntme/seed`
- U-306 — ValidateCtx requires serviceName not present in spec — `@rntme/seed`
- U-307 — countEvents reads up to 1M records instead of SELECT COUNT(*) — `@rntme/seed`
- U-342 — Missing ESLint — only package without lint config — `@rntme/ui-runtime`
- U-343 — Massive logic duplication between client modules — `@rntme/ui-runtime`

### Trigger: second service appears in workspace

- U-022 — Нет grpc.health.v1.Health surface — `@rntme/bindings-grpc`
- U-024 — collectShapesFromService собирает только output-шейпы — `@rntme/bindings-grpc`
- U-025 — Нет собственного реестра ERROR_CODES — `@rntme/bindings-grpc`
- U-026 — Пробелы в тестовом покрытии — `@rntme/bindings-grpc`
- U-037 — VERSION = '0.0.0' — `@rntme/bindings-http`
- U-038 — Тесты требуют предварительной сборки workspace — `@rntme/bindings-http`
- U-043 — demo-openapi.mjs imports from ./dist/index.js requiring manual build — `@rntme/bindings`
- U-044 — No integration / contract tests against @rntme/bindings-http — `@rntme/bindings`
- U-045 — PathItem type is overly permissive — `@rntme/bindings`
- U-046 — generateOpenApi silently ignores form-sourced inputFrom entries — `@rntme/bindings`
- U-057 — Layer type does not cover all used error codes — `@rntme/blueprint`
- U-058 — ServiceDescriptorSchema does not validate slug — `@rntme/blueprint`
- U-059 — No runtime versioning of ServiceGraphSpec — `@rntme/blueprint`
- U-068 — init silently ignores --org and --project flags — `@rntme/cli`
- U-069 — Cursor adapter throws instead of returning Result — `@rntme/cli`
- U-070 — No validate command in dispatcher despite user expectations — `@rntme/cli`
- U-074 — Redundant guard in plan.ts errors check — `@rntme/deploy-core`
- U-075 — DeploymentPlanError lacks per-code type safety — `@rntme/deploy-core`
- U-076 — passWithNoTests enabled in vitest.config.ts — `@rntme/deploy-core`
- U-077 — No runtime validation of input data to plan builder — `@rntme/deploy-core`
- U-088 — README references nonexistent spec file — `@rntme/deploy-dokploy`
- U-089 — Package version stuck at 0.0.0 prevents semver tracking — `@rntme/deploy-dokploy`
- U-090 — No integration tests against real Dokploy client factory — `@rntme/deploy-dokploy`
- U-097 — Missing automated accessibility check — `@rntme/landing`
- U-098 — Missing sitemap and structured data — `@rntme/landing`
- U-099 — .impeccable.md references missing SHAPE-BRIEF.md — `@rntme/landing`
- U-100 — package.json version 0.0.0 is meaningless — `@rntme/landing`
- U-108 — README links to spec documents not present in repository — `@rntme/platform-core`
- U-109 — BlobStore in domain package contains presignedGet infra detail — `@rntme/platform-core`
- U-110 — ./testing subpath exports only fakes.ts — `@rntme/platform-core`
- U-126 — index.ts exposes effectively empty public API — `@rntme/platform-http`
- U-127 — E2E tests silently skip without Docker — `@rntme/platform-http`
- U-128 — Critical middleware lack unit tests — `@rntme/platform-http`
- U-129 — Hardcoded version and deploy mode — `@rntme/platform-http`
- U-130 — workos-client.ts uses unsafe type cast hack — `@rntme/platform-http`
- U-139 — Missing dedicated tests for PgProjectVersionRepo and PgAuditRepo — `@rntme/platform-storage`
- U-140 — resetSchema in test harness hardcodes table list — `@rntme/platform-storage`
- U-141 — platform-storage publicly exports Drizzle schemas (ORM coupling) — `@rntme/platform-storage`
- U-146 — test:watch runs build:deps unnecessarily — `@rntme/conformance-ai-llm`
- U-148 — Fixture runtime coupling to contract package — `@rntme/conformance-ai-llm`
- U-154 — files array in package.json inconsistently includes src/fixtures/webhooks — `@rntme/conformance-crm`
- U-155 — suite-shape.test.ts enforces arbitrary assertionsDescription.length > 120 — `@rntme/conformance-crm`
- U-156 — test:watch script does not build deps — `@rntme/conformance-crm`
- U-171 — Version 0.0.0 on all contract packages prevents semver tracking — `@rntme/contracts-ai-llm-v1`
- U-172 — JSON import assertion may break some bundler configs — `@rntme/contracts-ai-llm-v1`
- U-173 — Common package does not re-export its own primitives — `@rntme/contracts-common-v1`
- U-174 — Missing error-codes.ts breaks template consistency with category packages — `@rntme/contracts-common-v1`
- U-179 — Incomplete README does not follow rntme package template — `@rntme/contracts-common-v1`
- U-186 — README is boilerplate without CRM-specific content — `@rntme/contracts-crm-v1`
- U-187 — No documentation of the 34 RPC methods — `@rntme/contracts-crm-v1`
- U-211 — No coverage reporting — `@rntme/event-store`
- U-213 — Package version is 0.0.0 — `@rntme/event-store`
- U-214 — No snapshot/replay tooling — `@rntme/event-store`
- U-223 — explain duplicates compile logic — `@rntme/graph-ir-compiler`
- U-224 — No test coverage reporting configured — `@rntme/graph-ir-compiler`
- U-239 — mkCtx() stub duplicated in 3 test files — `@rntme/module-skeleton`
- U-240 — test script always runs pnpm build first — `@rntme/module-skeleton`
- U-241 — No integration/ or e2e/ test directories — `@rntme/module-skeleton`
- U-242 — Missing .gitignore for dist/ in copied modules — `@rntme/module-skeleton`
- U-245 — loadPdmDir uses string literal instead of ERROR_CODES constant — `@rntme/pdm`
- U-246 — Missing unit tests for key edge cases — `@rntme/pdm`
- U-247 — ActorRef in @rntme/pdm violates package boundary (runtime type) — `@rntme/pdm`
- U-248 — PdmDirectoryIndexSchema does not validate pdm.json contents strictly — `@rntme/pdm`
- U-249 — Missing unit test for root entity stateMachine rejection at parse layer — `@rntme/pdm`
- U-270 — Bootstrap DDL rewrite uses brittle regex — `@rntme/projection-consumer`
- U-271 — Test-only InMemoryKafkaConsumer leaks into production surface — `@rntme/projection-consumer`
- U-272 — getAfter heuristic may silently drop colliding payload field — `@rntme/projection-consumer`
- U-281 — parseQsm uses QSM_PARSE_SCHEMA_VIOLATION for JSON syntax errors — `@rntme/qsm`
- U-282 — defaultTableName risks collisions for non-ASCII projection names — `@rntme/qsm`
- U-300 — package.json files array includes unused Dockerfile.template — `@rntme/runtime`
- U-301 — Custom semver parser instead of library — `@rntme/runtime`
- U-303 — Test timeout may be tight for CI under load — `@rntme/runtime`
- U-304 — contract-tests.ts usage pattern is undocumented — `@rntme/runtime`
- U-315 — scaffold.test.ts empty placeholder should be removed or replaced — `@rntme/seed`
- U-316 — Double-stamped correlationId between builder and validate — `@rntme/seed`
- U-317 — postbuild inline Node one-liner should move to scripts file — `@rntme/seed`
- U-318 — DEFAULT_SERVICE_NAME silent fallback in CLI is unexpected — `@rntme/seed`
- U-336 — Error paths lack file/line source locations — `@rntme/ui`
- U-337 — onSuccess.navigateTo and onError.showAlert are underspecified — `@rntme/ui`
- U-338 — baseDir leaks through the pipeline — `@rntme/ui`
- U-339 — emit.ts uses `as CompiledScreen` cast — `@rntme/ui`
- U-340 — README 'Where to look first' references spec paths that may drift — `@rntme/ui`
- U-350 — Package version stuck at 0.0.0 — `@rntme/ui-runtime`
- U-351 — build.ts execSync lacks timeout — `@rntme/ui-runtime`
- U-352 — vitest uses Node environment for browser code — `@rntme/ui-runtime`
- U-353 — SPA fallback redirects to first route on 404 — `@rntme/ui-runtime`
- U-354 — screen-loader cache has no invalidation — `@rntme/ui-runtime`

### Trigger: second service appears in workspace OR maintainer flags via test failure

- U-008 — Internal imports bypass package exports for contract tests — `monorepo`
- U-009 — blueprint pulls in seed CLI and UI components — `monorepo`
- U-010 — bindings-http depends on graph-ir-compiler crossing layer boundary — `monorepo`
- U-011 — 22 packages missing .gitignore files — `monorepo`
- U-012 — ui and ui-runtime still missing description in package.json; db-studio subfinding obsolete — `monorepo`
- U-018 — Нет поддержки pre[] middleware в gRPC surface — `@rntme/bindings-grpc`
- U-019 — Хардкод строки 'CommandResult' вместо константы из @rntme/bindings — `@rntme/bindings-grpc`
- U-020 — Ручная реализация сериализации в buildServiceDefinition — `@rntme/bindings-grpc`
- U-021 — Имя поля в query-ответе не валидируется на существование в shape — `@rntme/bindings-grpc`
- U-033 — Error-to-HTTP mapping нерасширяем — `@rntme/bindings-http`
- U-034 — Zod v4 vs v3 mismatch — `@rntme/bindings-http`
- U-035 — Отсутствие e2e/golden тестов — `@rntme/bindings-http`
- U-036 — Adapter-типы в bindings-http — `@rntme/bindings-http`
- U-039 — generateOpenApi accepts unused _resolvers parameter — misleading public API — `@rntme/bindings`
- U-040 — BindingEntry.kind optional in TS type but has Zod default — type-system drift — `@rntme/bindings`
- U-041 — shapes property validated but not typed in BindingArtifact — `@rntme/bindings`
- U-042 — Missing edge-case test coverage — `@rntme/bindings`
- U-051 — ValidatedBlueprint dead code (branded type without constructor) — `@rntme/blueprint`
- U-052 — parseProjectBlueprint uses unsafe cast after Zod parse — `@rntme/blueprint`
- U-053 — Opportunistic seed loading violates declarative artifact contract — `@rntme/blueprint`
- U-054 — GraphJson.nodes lacks structural typing — `@rntme/blueprint`
- U-055 — validate/index.ts barrel inconsistent with public API — `@rntme/blueprint`
- U-056 — Insufficient test coverage for critical edge cases — `@rntme/blueprint`
- U-063 — skills install bypasses harness pattern — `@rntme/cli`
- U-064 — Version pinned to 0.0.0 in package.json and client — `@rntme/cli`
- U-065 — Insufficient test coverage across commands — `@rntme/cli`
- U-066 — postbuild script uses fragile relative paths — `@rntme/cli`
- U-071 — Code duplication in edge.ts middleware dispatch — `@rntme/deploy-core`
- U-072 — Dead zod dependency in package.json — `@rntme/deploy-core`
- U-073 — Insufficient unit test coverage for middleware kinds and edge cases — `@rntme/deploy-core`
- U-083 — No validation of publicBaseUrl and endpoint in DokployTargetConfig — `@rntme/deploy-dokploy`
- U-084 — Result helpers re-exported from local copy duplicates deploy-core — `@rntme/deploy-dokploy`
- U-086 — assertNever in render.ts throws plain Error breaking Result contract — `@rntme/deploy-dokploy`
- U-094 — loadEnv() called at module level in 6+ components — `@rntme/landing`
- U-095 — Dead code in src/components/ — `@rntme/landing`
- U-096 — CONTENT.md is a manual copy of components — `@rntme/landing`
- U-104 — MembershipMirrorSchema role uses raw string instead of RoleSchema — `@rntme/platform-core`
- U-106 — Version 0.0.0 with no change-management mechanism — `@rntme/platform-core`
- U-107 — No coverage configuration in vitest — `@rntme/platform-core`
- U-118 — Auth providers created twice for API and UI — `@rntme/platform-http`
- U-119 — withOrgTx duplicated between prod and tests — `@rntme/platform-http`
- U-120 — Inconsistent poolRepos types in AppDeps vs UiDeps — `@rntme/platform-http`
- U-121 — ops ready-check breaks on some WorkOS plans — `@rntme/platform-http`
- U-124 — UI routes lack query/path param validation — `@rntme/platform-http`
- U-125 — tsconfig vs tsconfig.check inconsistent on tests — `@rntme/platform-http`
- U-133 — Inconsistent choice of Drizzle vs raw SQL across repos — `@rntme/platform-storage`
- U-134 — RLS test coverage gap for identity repositories — `@rntme/platform-storage`
- U-135 — Schema drift between drizzle migration and runtime policies.sql — `@rntme/platform-storage`
- U-136 — S3BlobStore uses single error code for all operations — `@rntme/platform-storage`
- U-143 — Type duplication across conformance categories — `@rntme/conformance-ai-llm`
- U-144 — build:deps script inconsistency across conformance packages — `@rntme/conformance-ai-llm`
- U-145 — Missing per-RPC assertion registry — `@rntme/conformance-ai-llm`
- U-151 — Missing direct dependency on @rntme/contracts-common-v1 — `@rntme/conformance-crm`
- U-152 — No capabilities.ts canonical registry — `@rntme/conformance-crm`
- U-153 — Scenario stubs are non-executable text descriptions only — `@rntme/conformance-crm`
- U-167 — layerOf silently returns vendor for unknown codes — `@rntme/contracts-ai-llm-v1`
- U-168 — time_to_first_token field in v1 proto contradicts no-streaming spec — `@rntme/contracts-ai-llm-v1`
- U-169 — Build-script inconsistency between contract packages — `@rntme/contracts-ai-llm-v1`
- U-170 — Missing range validation tests for numeric fields — `@rntme/contracts-ai-llm-v1`
- U-175 — Fragile build script using `cp` is not cross-platform — `@rntme/contracts-common-v1`
- U-176 — Missing .gitignore allows generated dirs to leak into git — `@rntme/contracts-common-v1`
- U-177 — Missing @vitest/coverage-v8 prevents local coverage measurement — `@rntme/contracts-common-v1`
- U-178 — Minimal test coverage misses edge cases and boundary values — `@rntme/contracts-common-v1`
- U-182 — Missing tests for isErrorCode and layerOf runtime helpers — `@rntme/contracts-crm-v1`
- U-183 — Rntme exported as type but undefined at runtime — `@rntme/contracts-crm-v1`
- U-185 — Generated proto files (~2.4MB) committed to repository — `@rntme/contracts-crm-v1`
- U-208 — No runtime validation of data payload (unknown type) — `@rntme/event-store`
- U-210 — appendRaw allows non-contiguous versions without warning — `@rntme/event-store`
- U-218 — compileCommand re-parses PDM/QSM manually — `@rntme/graph-ir-compiler`
- U-219 — Projection-compile catch block misuses PROJ_ROLE_UNINFERRABLE — `@rntme/graph-ir-compiler`
- U-220 — lowerToSqlite has unsafe default parameter — `@rntme/graph-ir-compiler`
- U-221 — STRUCT_DUPLICATE_GRAPH_ID overloaded with wrong semantics — `@rntme/graph-ir-compiler`
- U-222 — Package exports internal functions as public API — `@rntme/graph-ir-compiler`
- U-236 — VERSION constant is not wired to package.json#version — `@rntme/module-skeleton`
- U-237 — exampleHandlers.echo ignores input — poor teaching signal — `@rntme/module-skeleton`
- U-238 — tsconfig.check.json does not include test/public-contract — `@rntme/module-skeleton`
- U-243 — loadPdmDir parses but does not validate (returns raw PdmArtifact) — `@rntme/pdm`
- U-244 — normalizeFrom duplicated three times across modules — `@rntme/pdm`
- U-266 — VERSION constant hardcoded, not derived from package.json — `@rntme/projection-consumer`
- U-267 — Compiler dep pulled into read-side runtime for a single type — `@rntme/projection-consumer`
- U-268 — stop() can reject with unhandled rejection without onError — `@rntme/projection-consumer`
- U-269 — Missing rollback test for COMMIT-stage failure — `@rntme/projection-consumer`
- U-273 — Non-null assertion in selectCurrentVersion can crash opaquely — `@rntme/projection-consumer`
- U-276 — loadQsmDir not robust enough for project-first authoring — `@rntme/qsm`
- U-277 — pathPrefix field is dead weight in the schema — `@rntme/qsm`
- U-278 — Misleading error code QSM_DERIVED_EXPOSED_OUT_OF_RANGE name — `@rntme/qsm`
- U-279 — Cross-ref silently skips relations with derived participants — `@rntme/qsm`
- U-280 — Hard dependency on built @rntme/pdm — no mock resolver for tests — `@rntme/qsm`
- U-294 — Dockerfile inflates build context with demo/ — `@rntme/runtime`
- U-295 — ProtoRegistry silently ignores multiple services per proto file — `@rntme/runtime`
- U-296 — Surface interface inconsistency between mount and listen — `@rntme/runtime`
- U-297 — GraphIrCommandExecutor.mapError loses stack traces — `@rntme/runtime`
- U-298 — applyEnvOverrides uses different error accumulation pattern than validateManifest — `@rntme/runtime`
- U-309 — isAlreadyWrapped fragile check (rigid 2-key length) — `@rntme/seed`
- U-311 — validateSeed uses randomUUID() — non-deterministic for tests — `@rntme/seed`
- U-312 — SEED_SYNTAX_INVALID misused for missing serviceName (wrong layer) — `@rntme/seed`
- U-313 — Missing negative test for SEED_APPLY_IO error path — `@rntme/seed`
- U-314 — Spec §4.1 field names drift from CloudEvents-aligned implementation — `@rntme/seed`
- U-325 — resolveComponent is dead surface area — `@rntme/ui`
- U-327 — Manifest version '2.0' is hardcoded but never validated — `@rntme/ui`
- U-328 — No artifact serialization (pre-split output) — `@rntme/ui`
- U-329 — No validation that layouts contain at least one Slot — `@rntme/ui`
- U-330 — repeat.statePath is not validated for coverage — `@rntme/ui`
- U-331 — isRefElement guard is overly permissive — `@rntme/ui`
- U-332 — collectFragments exits early on first cycle — `@rntme/ui`
- U-333 — No tests for route parameter matching in validation — `@rntme/ui`
- U-334 — Missing composite: true in tsconfig — `@rntme/ui`
- U-335 — No per-package lint config — `@rntme/ui`
- U-345 — Path traversal check in /assets/:file potentially weak — `@rntme/ui-runtime`
- U-347 — No React Error Boundaries around Renderer — `@rntme/ui-runtime`
- U-348 — driver.ts exported but entry.tsx does not use it — `@rntme/ui-runtime`
- U-349 — globalThis.alert used for error reporting in production — `@rntme/ui-runtime`
- U-356 — runInit also bypasses harness pattern (sibling of U-063) — `@rntme/cli`
- U-360 — U-146 confirmed: test:watch chains build:deps in ai-llm only — `@rntme/conformance-ai-llm`
- U-361 — U-148 confirmed: fixtures runtime-import proto enum — `@rntme/conformance-ai-llm`
- U-362 — common v1 src/index.ts re-exports proto namespace only — no named primitive re-exports — `@rntme/contracts-common-v1`
- U-364 — STRUCT_DUPLICATE_GRAPH_ID overloaded for graphId-not-found case in compileProjectionGraph — `@rntme/graph-ir-compiler`
- U-365 — U-239 evidence inaccuracy: mkCtx() is duplicated in 2 test files, not 3 — `@rntme/module-skeleton`
- U-366 — applyEvent return type is readonly ApplyResult[] but consumer ignores results — `@rntme/projection-consumer`


---

## Track OBSOLETE

Findings whose original package or evidence path was removed or superseded after the audit snapshot. They are retained only so old unit IDs do not get reopened.

### Removed packages / superseded demos (`f595006`)

- U-013 — `monorepo` — demo packages no longer exist as tracked packages.
- U-017 — `@rntme/bindings-grpc` — evidence was the deleted `demo/issue-tracker-api/test/e2e/grpc.test.ts`.
- U-195…U-205 — `@rntme/db-studio` — package removed, superseded by Drizzle Studio.
- U-212 — `@rntme/event-store` — `getDbHandle()` footgun was tied to removed db-studio integration and is no longer exported.
- U-225…U-234 — `@rntme/issue-tracker-api-demo` — demo removed, replaced by `demo/notes-blueprint` as canonical project-shape example.
- U-250…U-262 — `@rntme/pre-step-demo` — demo removed; pre-step behavior lives in runtime/module integration specs and tests.
- U-357 — `@rntme/db-studio` — discovered db-studio tsconfig finding obsolete with package removal.

---

## Track REJECTED

False positives, outdated findings, and merged duplicates.

- U-001 — `monorepo` — RNT-230#B1 — [verify-systemic] submodule populated at 01c7c1a as of 2026-04-28
- U-060 — `@rntme/cli` — RNT-224#1 —
- U-061 — `@rntme/cli` — RNT-224#2 —
- U-062 — `@rntme/cli` — RNT-224#3 —
- U-067 — `@rntme/cli` — RNT-224#8 —
- U-082 — `@rntme/deploy-dokploy` — RNT-226#5 —
- U-085 — `@rntme/deploy-dokploy` — RNT-226#8 —
- U-101 — `@rntme/platform-core` — RNT-227#1 —
- U-105 — `@rntme/platform-core` — RNT-227#5 —
- U-147 — `@rntme/conformance-ai-llm` — RNT-218#6 — fallback path is functional; see U-359 verification.
- U-217 — `@rntme/graph-ir-compiler` — RNT-205#3 —
- U-310 — `@rntme/seed` — RNT-211#6 —
- U-359 — `@rntme/conformance-ai-llm` — discovered — evidence-only duplicate of U-147 rejection.


---

## Appendix — meta observations

### Auditor disagreements

(Empty at initial build — no units' triage rationales contained explicit `disagreement:` markers between systemic and per-package views. Will be populated as future audits surface tensions.)

### Cross-cutting consistency themes — parked by default

- **`throw new Error` vs `Result<T>` migration** — concentrated in `@rntme/graph-ir-compiler` (RNT-205 #1, U-215 — kept as gun, the lone in-wave representative). Other packages with similar throws are parked pending systemic decision on whether the convention applies to internal invariants.
- **Custom semver / shared utilities** — multiple packages roll their own. Parked pending need for pre-release tags.
- **Internal-modules export discipline** — covered by future eslint guardrail in Wp.
- **Package version `0.0.0`** — 16 packages have version `0.0.0`. All parked. No semver until first pre-release tag.

### CI guardrails (deferred to Wp)

From RNT-230 §3:
- `dependency-cruiser` or `skott` — layer violations check in CI.
- `pnpm.catalogs` — single-version contract for shared external deps.
- `eslint-plugin-import` with `no-internal-modules` — block imports past `exports`.
- Custom eslint rule — ban `workspace:^` (only `workspace:*`).
- CI check — `pnpm -r run build` must pass without per-package `build:deps`.
- Dependency graph diff in PR comments — show changes in topology when `package.json` changes.
- Coverage gate — `@vitest/coverage-v8`, ≥80% for `src/`.

These are the *self-preserving* mechanisms. They land in Wp because activating them earlier would fail every PR until preceding waves are clean.
