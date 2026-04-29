# Audit waves — consolidated planning

> **Status:** reconciled through merged waves W4, W7, W8, W10, W13, W14, and W15. See [spec](../superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md) for the canonical process.

| Field | Value |
|---|---|
| Build date | 2026-04-28T13:04:52Z |
| Build commit | `b6047e5ac4986ac2e9dfc26075a309fd18c3a227` |
| Audit corpus dir | `docs/audit/` (RNT-199..230, snapshot date 2026-04-28) |
| Spec | `docs/superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md` |
| Total active units | 355 |
| Rejected (false positives + duplicates + outdated) | 11 |

## Triage formula (one paragraph)

Each verified finding runs the decision tree: **Q1 already shoots? → fire**; else **Q2 loaded gun? (security/silent-corruption/error-contract/freshness-or-idempotency-break) → gun**; else **Q3 blueprint blocker? (identity / kafka-bus / module-skeleton / http-as-auth-entry) → blueprint**; else **Q4 needs product/architectural decision → decide**; else **park** with mandatory `re-evaluate when:` trigger.

## Categories

- 🔥 **fire** — already shooting; in execution waves
- 🔫 **gun** — loaded but not shot; in execution waves
- 🚧 **blueprint** — blocks first real blueprint (identity + Redpanda + Operaton); in execution waves
- 🤔 **decide** — needs product/architectural input; tracked, not actioned
- 📦 **park** — real per audit but no shoot, no foreseeable shoot; tracked with re-evaluate trigger
- ❌ **rejected** — false positive, outdated, or duplicate

## Last updated

- 2026-04-28T13:04:52Z — initial build at `b6047e5ac4986ac2e9dfc26075a309fd18c3a227`
- 2026-04-29 — reconciled completed waves W4/W7/W8/W10/W15 after merged PR evidence.


---

## Lens A — Wave timeline (operational view)

### Wave W2 — Identity surface readiness — auth0/clerk + HTTP entry hardening

**Units (15):**

- [ ] U-157 — Conformance suite type contract diverges across identity/ai-llm vs CRM — `@rntme/conformance-identity` — 🚧
- [ ] U-158 — Missing fixtures-sanity.test.ts to catch protobuf validation drift — `@rntme/conformance-identity` — 🚧
- [ ] U-159 — Missing canonical Session fixtures despite Session RPCs in contract — `@rntme/conformance-identity` — 🚧
- [ ] U-160 — Inconsistent suite export naming across conformance packages — `@rntme/conformance-identity` — 🚧
- [ ] U-161 — Identity README missing Out of scope section — `@rntme/conformance-identity` — 🚧
- [ ] U-162 — Missing capabilities.ts registry of canonical RPCs and events — `@rntme/conformance-identity` — 🚧
- [ ] U-163 — No automated guard for error codes and events coverage in scenarios — `@rntme/conformance-identity` — 🚧
- [ ] U-164 — package.json version 0.0.0 desynced from contractVersion in fixtures — `@rntme/conformance-identity` — 🚧
- [ ] U-188 — scripts/check-imports.mjs is dead code — `@rntme/contracts-identity-v1` — 🚧
- [ ] U-189 — Generated proto.gen requires 'long' but package does not declare it — `@rntme/contracts-identity-v1` — 🚧
- [ ] U-190 — No CI check that .proto and proto.gen.* stay in sync — `@rntme/contracts-identity-v1` — 🚧
- [ ] U-191 — index.ts re-exports common-v1 primitives, blurring package boundary — `@rntme/contracts-identity-v1` — 🚧
- [ ] U-192 — Tests do not cover direct exports from src/index.ts — `@rntme/contracts-identity-v1` — 🚧
- [ ] U-193 — package.json version 0.0.0 does not reflect contract v1 — `@rntme/contracts-identity-v1` — 🚧
- [ ] U-194 — package.json lacks repository/bugs/homepage metadata — `@rntme/contracts-identity-v1` — 🚧

**Co-edits (merge-serialise):**

- `package.js` — U-164, U-188, U-193, U-194

**Exit criteria:**
- Identity contracts pass conformance suite green against auth0 and clerk modules.
- HTTP transport rejects oversized bodies + supports TLS config when relevant.

### Wave W3 — Event bus / projection live readiness — Redpanda transition prerequisites

**Units (8):**

- [ ] U-032 — IdempotencyCache — нет автоматической очистки — `@rntme/bindings-http` — 🔫
- [ ] U-206 — ActorRef duplicated locally without sync guarantee with @rntme/pdm — `@rntme/event-store` — 🚧
- [ ] U-207 — serviceName changes semantics of existing events on rename — `@rntme/event-store` — 🚧
- [ ] U-209 — SQLite single-writer has no runtime enforcement — `@rntme/event-store` — 🔫
- [ ] U-263 — README/code mismatch on ApplyResult skipped discriminator — `@rntme/projection-consumer` — 🚧
- [ ] U-264 — ROLLBACK path may overwrite original error cause — `@rntme/projection-consumer` — 🚧
- [ ] U-265 — getDbHandle leaky abstraction bypasses ordering/idempotency — `@rntme/projection-consumer` — 🔫
- [ ] U-287 — seen-events-retention env variable lacks validation — `@rntme/runtime` — 🔫

**Exit criteria:**
- Event-store passes idempotency / single-writer / monotonic-cursor invariants under integration tests.
- Projection-consumer green with retention env validation.
- InMemoryBus topic isolation verified or replaced with Redpanda-backed bus in test bootstrap.

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

### Wave W13 — Per-package cleanup — rntme-cli

**Units (1):**

- [x] U-087 — sanitizeCause aggressively redacts all error messages — `@rntme-cli/deploy-dokploy` — closed in RNT-280

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W14 — Per-package cleanup — UI

**Units (1):**

- [x] U-346 — Missing CSP and security headers in HTML shell — `@rntme/ui-runtime` — closed in RNT-281

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

### Wave W15 — Per-package cleanup — platform

**Units (6):**

- [x] U-113 — In-memory rate limiter breaks under multi-process — `@rntme-cli/platform-http` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-122 — CORS regex potentially vulnerable to ReDoS — `@rntme-cli/platform-http` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-123 — log-redactor patterns miss many secret formats — `@rntme-cli/platform-http` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-137 — getWithSecretById callable with RLS-enabled client (no guard) — `@rntme-cli/platform-storage` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-138 — AesGcmSecretCipher rejects cross-version decrypt (rotation undocumented) — `@rntme-cli/platform-storage` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`
- [x] U-358 — No unit test for cors middleware — `@rntme-cli/platform-http` — closed in RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6`

**Exit criteria:**
- All units in this wave closed; affected packages green on `pnpm -F <pkg> test`.

---

## Lens B — Findings ledger (data view)

| id | pkg | audit-ref | severity | category | wave | verified | evidence | triage rationale |
|----|-----|-----------|----------|----------|------|----------|----------|------------------|
| U-002 | `monorepo` | RNT-230#B2 | Blocker | 📦 park | — | ✓ | @rntme/runtime depends on 12 workspace packages (god package) | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-003 | `monorepo` | RNT-230#B3 | Blocker | 📦 park | — | ✓ | bindings-grpc has dependencies['@rntme/bindings-http']: 'workspace:*' | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-004 | `monorepo` | RNT-230#H1 | High | 📦 park | — | ✓ | grpc-js, protobufjs, better-sqlite3, typescript, vitest have multiple versions across pkgs | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-005 | `monorepo` | RNT-230#H2 | High | 📦 park | — | ✓ | 8 module packages have build:deps scripts that pnpm --dir or -F other packages | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-006 | `monorepo` | RNT-230#H3 | High | 📦 park | — | ✓ | conformance pkgs split between deps/devDeps in crm-bitrix24/amocrm and identity-auth0/clerk | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-007 | `monorepo` | RNT-230#H4 | High | 📦 park | — | ✓ | runtime has dependencies['@rntme/seed']: 'workspace:^' (CLI tool in prod deps) | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-008 | `monorepo` | RNT-230#M1 | Medium | 📦 park | — | ✓ | runtime/src/index.ts comments instruct importing from @rntme/runtime/src/plugins/... | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-009 | `monorepo` | RNT-230#M2 | Medium | 📦 park | — | ✓ | blueprint depends on seed and ui packages | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-010 | `monorepo` | RNT-230#M3 | Medium | 📦 park | — | ✓ | bindings-http depends on graph-ir-compiler (transport→compiler) | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-011 | `monorepo` | RNT-230#M4 | Medium | 📦 park | — | ✓ | Only bindings-http, contracts-*, demo/* have .gitignore; 22 packages don't | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-012 | `monorepo` | RNT-230#M5 | Medium | 📦 park | — | ✓ | db-studio, ui, ui-runtime have no description in package.json | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-013 | `monorepo` | RNT-230#L1 | Low | 📦 park | — | ✓ | issue-tracker-api-demo, pre-step-demo have no exports/main fields | [verify-systemic] confirmed via tooling check [triage] park: real but no foreseeable shoot |
| U-014 | `@rntme/bindings-grpc` | RNT-200#1 | Blocker | 📦 park | — | ✓ | packages/bindings-grpc/src/server/handler.ts | [verify] src/server/handler.ts line 60 sets actor: null in CommandExecutionContext for every gRPC command [triage] park: real but no foreseeable shoot |
| U-015 | `@rntme/bindings-grpc` | RNT-200#2 | High | 📦 park | — | ✓ | src/server/handler.ts, src/server/errors.ts, src/types.ts | [verify] src/server/handler.ts line 8, src/server/errors.ts lines 2-5, src/types.ts lines 2-5 all import from @rntme/bindings-http/executor-contract [triage] park: real but no foreseeable shoot |
| U-016 | `@rntme/bindings-grpc` | RNT-200#3 | High | 📦 park | — | ✓ | src/emit/scalars.ts and src/emit/shapes.ts | [verify] src/emit/scalars.ts switch has no default branch nor fallback return; shapes.ts default throws (partial confirmation: scalars.ts truly lacks fallback) [triage] park: real but no foreseeable shoot |
| U-017 | `@rntme/bindings-grpc` | RNT-200#4 | High | 📦 park | — | ✓ | demo/issue-tracker-api/test/e2e/grpc.test.ts | [verify] demo/issue-tracker-api/test/e2e/grpc.test.ts line 49 asserts (error !== null \\|\\| typeof response === 'object'), unfalsifiable [triage] park: real but no foreseeable shoot |
| U-018 | `@rntme/bindings-grpc` | RNT-200#5 | Medium | 📦 park | — | ✓ | README.md — 'Not yet supported: pre[] middleware (plan 3)' | [verify] README.md line 58 still lists pre[] middleware under 'Not yet supported'; no pre[] code path in handler.ts [triage] park: real but no foreseeable shoot |
| U-019 | `@rntme/bindings-grpc` | RNT-200#6 | Medium | 📦 park | — | ✓ | src/emit/emit-proto.ts filters by name === 'CommandResult' | [verify] src/emit/emit-proto.ts line 28 filters by raw 'CommandResult' string; @rntme/bindings exports COMMAND_RESULT_SHAPE_NAME constant but bindings-grpc does not import it [triage] park: real but no foreseeable shoot |
| U-020 | `@rntme/bindings-grpc` | RNT-200#7 | Medium | 📦 park | — | ✓ | src/server/create-server.ts manually builds requestSerialize/Deserialize | [verify] src/server/create-server.ts lines 18-23 manually build requestSerialize/Deserialize/responseSerialize/Deserialize via protobufjs [triage] park: real but no foreseeable shoot |
| U-021 | `@rntme/bindings-grpc` | RNT-200#8 | Medium | 📦 park | — | skip | src/server/handler.ts — { [toSnakeCase(fromField)]: qout.value } | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-022 | `@rntme/bindings-grpc` | RNT-200#9 | Low | 📦 park | — | skip | README.md — orchestrators expect health endpoint | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-023 | `@rntme/bindings-grpc` | RNT-200#10 | Low | ✅ closed | W8 | skip | src/server/create-server.ts — grpc.ServerCredentials.createInsecure() | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-278 / PR #78 / merge `c5ecc7d8d8fa97cd085d67f9b58ac9a66fda4796` |
| U-024 | `@rntme/bindings-grpc` | RNT-200#11 | Low | 📦 park | — | skip | packages/runtime/src/start/build-grpc-surface.ts and inline TODO | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-025 | `@rntme/bindings-grpc` | RNT-200#12 | Low | 📦 park | — | skip | no src/types/result.ts with ERROR_CODES in package | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-026 | `@rntme/bindings-grpc` | RNT-200#13 | Low | 📦 park | — | skip | test/ analysis: only QUERY_NOT_FOUND stub in create-server.test.ts | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-027 | `@rntme/bindings-http` | RNT-201#1 | Blocker | 📦 park | — | ✓ | src/index.ts exports buildDefaultGraphIrCommandMap, correlationMiddleware, VERSION | [verify] src/index.ts lines 1-19 export VERSION='0.0.0', buildDefaultGraphIrCommandMap, correlationMiddleware as described. [triage] park: real but no foreseeable shoot |
| U-028 | `@rntme/bindings-http` | RNT-201#2 | High | 📦 park | — | ✓ | src/executor-contract.ts redefines CommandExecutor/QueryExecutor/CorrelationCtx | [verify] executor-contract.ts defines CorrelationCtx (line 4) which is also exported from graph-ir-compiler/src/index.ts:18; CommandExecutor/QueryExecutor interfaces are local to bindings-http but CorrelationCtx duplication remains. [triage] park: real but no foreseeable shoot |
| U-029 | `@rntme/bindings-http` | RNT-201#3 | High | 📦 park | — | ✓ | src/runtime/command-handler.ts (290 lines, multiple responsibilities) | [verify] src/runtime/command-handler.ts is 290 lines exactly, multi-responsibility (validation, idempotency, executor, response, errors). [triage] park: real but no foreseeable shoot |
| U-030 | `@rntme/bindings-http` | RNT-201#4 | High | 📦 park | — | ✓ | src/router.ts: const stripped = p.replace(/^\/api/, '') \\|\\| '/' | [verify] src/router.ts:80 contains literal `const stripped = p.replace(/^\/api/, '') \\|\\| '/'` inside idempotencyMiddleware setup. [triage] park: real but no foreseeable shoot |
| U-031 | `@rntme/bindings-http` | RNT-201#5 | High | 📦 park | — | ✓ | src/router.ts: graphSpec/pdm/qsm typed as unknown | [verify] src/router.ts:20-22 BindingsRouterOptions declares graphSpec/pdm/qsm as `unknown`, no Validated* brands at boundary. [triage] park: real but no foreseeable shoot |
| U-032 | `@rntme/bindings-http` | RNT-201#6 | Medium | 🔫 gun | W3 | ✓ | src/idempotency/cache.ts: pruneExpired exists but never called | [verify] cache.ts:63 defines pruneExpired; grep across packages/bindings-http, runtime, blueprint shows zero call sites. [triage] gun: loaded — security/corruption/error-contract gap |
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
| U-048 | `@rntme/blueprint` | RNT-202#H1 | High | 📦 park | — | ✓ | src/load/load-blueprint.ts: malformed service.json continue | [verify] src/load/load-blueprint.ts lines 89-116: ServiceDescriptorSchema.safeParse result is checked with `if (parsedDescriptor.success)` and on failure the loop body falls through with no error and no entry added — silent ignore. structural validator only sees the missing-from-services-record path, never the malformed-descriptor path. [triage] park: real but no foreseeable shoot |
| U-049 | `@rntme/blueprint` | RNT-202#H2 | High | 📦 park | — | ✓ | src/compose/binding-resolvers.ts: SCALARS hardcoded | [verify] src/compose/binding-resolvers.ts lines 20-27: SCALARS hardcoded as ReadonlySet of literals ('integer','decimal','string','boolean','date','datetime'); not derived from @rntme/bindings ScalarPrimitive. parseScalar (line 83) gates on this set. [triage] park: real but no foreseeable shoot |
| U-050 | `@rntme/blueprint` | RNT-202#H3 | High | 📦 park | — | ✓ | src/compose/compile-service-ui.ts: stub resolveComponent/resolveRoute | [verify] src/compose/compile-service-ui.ts lines 39-40: `resolveComponent: () => ({ childrenModel: 'list' as const })` and `resolveRoute: () => true` are unconditional stubs passed to @rntme/ui compile, bypassing real component/route validation. [triage] park: real but no foreseeable shoot |
| U-051 | `@rntme/blueprint` | RNT-202#M1 | Medium | 📦 park | — | ✓ | src/types/artifact.ts: ValidatedBlueprint brand; src/index.ts export | [verify] src/types/artifact.ts lines 44-48 declare branded ValidatedBlueprint type; src/index.ts line 35 re-exports it. grep across packages/ shows no constructor / validator returning ValidatedBlueprint and no consumer importing it — pure dead code. [triage] park: real but no foreseeable shoot |
| U-052 | `@rntme/blueprint` | RNT-202#M2 | Medium | 📦 park | — | ✓ | src/parse/parse.ts: 'as ProjectBlueprint' after Zod parse | [verify] src/parse/parse.ts line 26: `return ok(parsed.data as ProjectBlueprint);` — Zod's safeParse output is cast with `as` rather than relying on inferred schema type. ProjectBlueprintSchema and ProjectBlueprint type can drift without TypeScript catching it. [triage] park: real but no foreseeable shoot |
| U-053 | `@rntme/blueprint` | RNT-202#M3 | Medium | 📦 park | — | ✓ | src/compose/load-service-member.ts: hasSeed \\|\\| existsSync | [verify] src/compose/load-service-member.ts line 117: `if (input.service.artifacts.hasSeed \\|\\| existsSync(join(input.rootDir, seedPath)))` — the existsSync fallback violates the discover-then-load contract; an undeclared seed.json on disk is loaded opportunistically, contradicting the declarative artifact-discovery model. [triage] park: real but no foreseeable shoot |
| U-054 | `@rntme/blueprint` | RNT-202#M4 | Medium | 📦 park | — | skip | src/types/artifact.ts: GraphJson.nodes typed as unknown[] | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-055 | `@rntme/blueprint` | RNT-202#M5 | Medium | 📦 park | — | skip | src/validate/index.ts: only structural exported | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-056 | `@rntme/blueprint` | RNT-202#M6 | Medium | 📦 park | — | skip | load-blueprint.ts/load-service-member.ts: missing failure-path tests | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-057 | `@rntme/blueprint` | RNT-202#L1 | Low | 📦 park | — | skip | src/types/result.ts: Layer type vs ERROR_CODES mismatch | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-058 | `@rntme/blueprint` | RNT-202#L2 | Low | 📦 park | — | skip | src/parse/schema.ts: ServiceDescriptorSchema missing slug | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-059 | `@rntme/blueprint` | RNT-202#L3 | Low | 📦 park | — | skip | src/compose/service-graphs.ts: hardcoded version '1.0-rc7' | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-063 | `@rntme-cli/cli` | RNT-224#4 | Medium | 📦 park | — | ✓ | src/commands/skills/install.ts has its own writeOk/writeErr instead of runCommand |  [triage] park: real but no foreseeable shoot |
| U-064 | `@rntme-cli/cli` | RNT-224#5 | Medium | 📦 park | — | ✓ | package.json and src/api/client.ts hardcode "0.0.0"; readVersion reads it |  [triage] park: real but no foreseeable shoot |
| U-065 | `@rntme-cli/cli` | RNT-224#6 | Medium | 📦 park | — | ✓ | no tests for logout, project list/show, project version, token cmds, skills install |  [triage] park: real but no foreseeable shoot |
| U-066 | `@rntme-cli/cli` | RNT-224#7 | Medium | 📦 park | — | partial | postbuild script seeks package.json via ../../package.json relative to dist/bin/cli.js |  [triage] park: real but no foreseeable shoot |
| U-068 | `@rntme-cli/cli` | RNT-224#9 | Low | 📦 park | — | skip | test passes --org/--project to init; runInit ignores them; parseArgs strict:false | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-069 | `@rntme-cli/cli` | RNT-224#10 | Low | 📦 park | — | skip | src/skills/adapters/cursor.ts throws Error when frontmatter missing | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-070 | `@rntme-cli/cli` | RNT-224#11 | Low | 📦 park | — | skip | README mentions project publish --dry-run as validation; no validate command exists | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-071 | `@rntme-cli/deploy-core` | RNT-225#1 | Medium | 📦 park | — | ✓ | src/edge.ts — four near-identical middleware dispatch blocks |  [triage] park: real but no foreseeable shoot |
| U-072 | `@rntme-cli/deploy-core` | RNT-225#2 | Medium | 📦 park | — | ✓ | package.json declares zod dep; grep finds zero usages in src/test |  [triage] park: real but no foreseeable shoot |
| U-073 | `@rntme-cli/deploy-core` | RNT-225#3 | Medium | 📦 park | — | ✓ | 12 unit tests; body-limit, timeout, empty project, edge cases uncovered |  [triage] park: real but no foreseeable shoot |
| U-074 | `@rntme-cli/deploy-core` | RNT-225#4 | Low | 📦 park | — | skip | src/plan.ts — redundant config.eventBus===undefined OR clause | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-075 | `@rntme-cli/deploy-core` | RNT-225#5 | Low | 📦 park | — | skip | src/errors.ts — single struct with optional fields; not code-discriminated | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-076 | `@rntme-cli/deploy-core` | RNT-225#6 | Low | 📦 park | — | skip | vitest.config.ts sets passWithNoTests: true | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-077 | `@rntme-cli/deploy-core` | RNT-225#7 | Low | 📦 park | — | skip | buildProjectDeploymentPlan accepts plain structural inputs without checks | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-078 | `@rntme-cli/deploy-dokploy` | RNT-226#1 | High | 📦 park | — | ✓ | src/apply.ts jsonEqual; resourceMatches uses JSON.stringify |  [triage] park: real but no foreseeable shoot |
| U-079 | `@rntme-cli/deploy-dokploy` | RNT-226#2 | High | 📦 park | — | ✓ | src/apply.ts apply loop; no rollback on partial failure |  [triage] park: real but no foreseeable shoot |
| U-080 | `@rntme-cli/deploy-dokploy` | RNT-226#3 | High | 📦 park | — | ✓ | src/client.ts methods take full RenderedDokployResource |  [triage] park: real but no foreseeable shoot |
| U-081 | `@rntme-cli/deploy-dokploy` | RNT-226#4 | High | 📦 park | — | ✓ | src/apply.ts sequential for...of with await per iteration |  [triage] park: real but no foreseeable shoot |
| U-083 | `@rntme-cli/deploy-dokploy` | RNT-226#6 | Medium | 📦 park | — | ✓ | src/config.ts; render.ts uses publicBaseUrl/endpoint unchecked |  [triage] park: real but no foreseeable shoot |
| U-084 | `@rntme-cli/deploy-dokploy` | RNT-226#7 | Medium | 📦 park | — | ✓ | src/result.ts duplicates ok/err/isOk/isErr from deploy-core |  [triage] park: real but no foreseeable shoot |
| U-086 | `@rntme-cli/deploy-dokploy` | RNT-226#9 | Medium | 📦 park | — | ✓ | src/render.ts assertNever throws plain Error |  [triage] park: real but no foreseeable shoot |
| U-087 | `@rntme-cli/deploy-dokploy` | RNT-226#10 | Medium | ✅ closed | W13 | ✓ | src/apply.ts sanitizeCause now preserves benign Error messages and redacts credential-like values at the cause serialization boundary | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-280 |
| U-088 | `@rntme-cli/deploy-dokploy` | RNT-226#11 | Low | 📦 park | — | ✓ | README.md links missing project-deployment-pipeline-design spec |  [triage] park: real but no foreseeable shoot |
| U-089 | `@rntme-cli/deploy-dokploy` | RNT-226#12 | Low | 📦 park | — | ✓ | package.json version 0.0.0 |  [triage] park: real but no foreseeable shoot |
| U-090 | `@rntme-cli/deploy-dokploy` | RNT-226#13 | Low | 📦 park | — | ✓ | All tests use FakeDokployClient; no platform-http contract tests |  [triage] park: real but no foreseeable shoot |
| U-091 | `@rntme-cli/landing` | RNT-223#1 | High | 📦 park | — | ✓ | Problem.astro & MicroJobs.astro both use data-section-num=02; AhaSection/LiveDemoCard 04; HowItWorks/SnowflakeToRuntime 05 |  [triage] park: real but no foreseeable shoot |
| U-092 | `@rntme-cli/landing` | RNT-223#2 | High | 📦 park | — | ✓ | data-section-num + id=sNN hardcoded in each .astro; SideRail.tsx, index.astro, CONTENT.md duplicate ordering |  [triage] park: real but no foreseeable shoot |
| U-093 | `@rntme-cli/landing` | RNT-223#3 | High | 📦 park | — | ✓ | 3 test files (~100 lines); no Astro component tests, no integration build tests, no a11y automation |  [triage] park: real but no foreseeable shoot |
| U-094 | `@rntme-cli/landing` | RNT-223#4 | Medium | 📦 park | — | ✓ | loadEnv() called at module level in BaseLayout, StatusBar, Hero, Footer, LiveDemoCard, PilotForm |  [triage] park: real but no foreseeable shoot |
| U-095 | `@rntme-cli/landing` | RNT-223#5 | Medium | 📦 park | — | ✓ | MicroJobs.astro, SnowflakeToRuntime.astro, LiveDemoCard.astro not imported into any page |  [triage] park: real but no foreseeable shoot |
| U-096 | `@rntme-cli/landing` | RNT-223#6 | Medium | 📦 park | — | ✓ | CONTENT.md duplicates copy, section structure, env deps but is not generated from code |  [triage] park: real but no foreseeable shoot |
| U-097 | `@rntme-cli/landing` | RNT-223#7 | Low | 📦 park | — | skip | .impeccable.md declares Lighthouse 95+ but no pa11y/axe-core/lighthouse-ci in CI | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-098 | `@rntme-cli/landing` | RNT-223#8 | Low | 📦 park | — | skip | No sitemap-index.xml, no JSON-LD for Organization/Product/FAQ | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-099 | `@rntme-cli/landing` | RNT-223#9 | Low | 📦 park | — | skip | .impeccable.md references SHAPE-BRIEF.md §4 but file does not exist in repo | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-100 | `@rntme-cli/landing` | RNT-223#10 | Low | 📦 park | — | skip | package.json#version is 0.0.0; does not reflect real deploys | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-102 | `@rntme-cli/platform-core` | RNT-227#2 | High | 📦 park | — | ✓ | test/unit/use-cases/ lacks archive-org-cascade.test.ts |  [triage] park: real but no foreseeable shoot |
| U-103 | `@rntme-cli/platform-core` | RNT-227#3 | High | 📦 park | — | ✓ | fast-check declared in devDependencies, zero usage in tests |  [triage] park: real but no foreseeable shoot |
| U-104 | `@rntme-cli/platform-core` | RNT-227#4 | Medium | 📦 park | — | ✓ | MembershipMirrorSchema uses z.string().min(1) for role, not RoleSchema |  [triage] park: real but no foreseeable shoot |
| U-106 | `@rntme-cli/platform-core` | RNT-227#6 | Medium | 📦 park | — | ✓ | package.json version 0.0.0; consumed by platform-http, platform-storage, cli |  [triage] park: real but no foreseeable shoot |
| U-107 | `@rntme-cli/platform-core` | RNT-227#7 | Medium | 📦 park | — | ✓ | vitest.config.ts has no coverage block |  [triage] park: real but no foreseeable shoot |
| U-108 | `@rntme-cli/platform-core` | RNT-227#8 | Low | 📦 park | — | skip | README references docs/superpowers/specs/done/... not in repo | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-109 | `@rntme-cli/platform-core` | RNT-227#9 | Low | 📦 park | — | skip | src/blob/store.ts BlobStore interface exposes presignedGet | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-110 | `@rntme-cli/platform-core` | RNT-227#10 | Low | 📦 park | — | skip | package.json ./testing subpath exports only fakes.ts | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-111 | `@rntme-cli/platform-http` | RNT-228#1 | High | 📦 park | — | ✓ | src/app.ts createApp ~180 LOC mixes middleware/auth/routes/jobs/tx |  [triage] park: real but no foreseeable shoot |
| U-112 | `@rntme-cli/platform-http` | RNT-228#2 | High | 📦 park | — | ✓ | src/app.ts setImmediate runDeployment; src/deploy/executor.ts in HTTP proc |  [triage] park: real but no foreseeable shoot |
| U-113 | `@rntme-cli/platform-http` | RNT-228#3 | High | ✅ closed | W15 | ✓ | src/middleware/rate-limit.ts InMemoryRateLimiter uses Map | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-114 | `@rntme-cli/platform-http` | RNT-228#4 | High | 📦 park | — | ✓ | src/middleware/error-handler.ts returns 500 without logging cause |  [triage] park: real but no foreseeable shoot |
| U-115 | `@rntme-cli/platform-http` | RNT-228#5 | High | 📦 park | — | ✓ | package.json @hono/zod-openapi listed; no imports in src/ |  [triage] park: real but no foreseeable shoot |
| U-116 | `@rntme-cli/platform-http` | RNT-228#6 | High | 📦 park | — | ✓ | src/deploy/dokploy-client-factory.ts (278 LOC) lives in platform-http |  [triage] park: real but no foreseeable shoot |
| U-117 | `@rntme-cli/platform-http` | RNT-228#7 | High | 📦 park | — | ✓ | src/middleware/body-limit.ts builds new Blob from chunks, replaces req |  [triage] park: real but no foreseeable shoot |
| U-118 | `@rntme-cli/platform-http` | RNT-228#8 | Medium | 📦 park | — | ✓ | src/app.ts and src/ui/app.tsx each instantiate auth providers |  [triage] park: real but no foreseeable shoot |
| U-119 | `@rntme-cli/platform-http` | RNT-228#9 | Medium | 📦 park | — | ✓ | src/app.ts withOrgTx duplicated in test/e2e/deploy-flow.test.ts |  [triage] park: real but no foreseeable shoot |
| U-120 | `@rntme-cli/platform-http` | RNT-228#10 | Medium | 📦 park | — | ✓ | AppDeps poolRepos vs UiDeps poolRepos diverge on workosEventLog |  [triage] park: real but no foreseeable shoot |
| U-121 | `@rntme-cli/platform-http` | RNT-228#11 | Medium | 📦 park | — | skip | src/routes/ops.ts ready-check calls workos.listApiKeys | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-122 | `@rntme-cli/platform-http` | RNT-228#12 | Medium | ✅ closed | W15 | skip | src/middleware/cors.ts builds RegExp from PLATFORM_CORS_ORIGINS | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-123 | `@rntme-cli/platform-http` | RNT-228#13 | Medium | ✅ closed | W15 | skip | src/deploy/log-redactor.ts uses simplistic regex patterns | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-124 | `@rntme-cli/platform-http` | RNT-228#14 | Medium | 📦 park | — | skip | src/ui/app.tsx uses orgSlug/projSlug params without validation | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-125 | `@rntme-cli/platform-http` | RNT-228#15 | Medium | 📦 park | — | skip | tsconfig.json excludes test/; tsconfig.check.json includes test/ | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-126 | `@rntme-cli/platform-http` | RNT-228#16 | Low | 📦 park | — | skip | src/index.ts exports only VERSION | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-127 | `@rntme-cli/platform-http` | RNT-228#17 | Low | 📦 park | — | skip | test/e2e uses describe.skipIf(!e2eContainersAvailable()) | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-128 | `@rntme-cli/platform-http` | RNT-228#18 | Low | 📦 park | — | skip | test/unit/middleware only covers rate-limit; auth/cors/tx untested | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap |
| U-129 | `@rntme-cli/platform-http` | RNT-228#19 | Low | 📦 park | — | skip | src/index.ts VERSION='0.0.0'; build-deploy-config mode='preview' hardcoded | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-130 | `@rntme-cli/platform-http` | RNT-228#20 | Low | 📦 park | — | skip | src/auth/workos-client.ts casts as WorkOSClient bypassing SDK types | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-131 | `@rntme-cli/platform-storage` | RNT-229#1 | High | 📦 park | — | ✓ | pg-deploy-target-repo.ts, pg-deployment-repo.ts, pg-project-version-repo.ts |  [triage] park: real but no foreseeable shoot |
| U-132 | `@rntme-cli/platform-storage` | RNT-229#2 | High | 📦 park | — | ✓ | pg-deploy-target-repo.ts withOptionalTransaction nested in withTransaction |  [triage] park: real but no foreseeable shoot |
| U-133 | `@rntme-cli/platform-storage` | RNT-229#3 | Medium | 📦 park | — | ✓ | pg-org-repo.ts (Drizzle) vs pg-deploy-target-repo.ts (raw SQL) |  [triage] park: real but no foreseeable shoot |
| U-134 | `@rntme-cli/platform-storage` | RNT-229#4 | Medium | 📦 park | — | ✓ | test/integration/identity-repos.test.ts uses env.pool bypassing RLS |  [triage] park: real but no foreseeable shoot |
| U-135 | `@rntme-cli/platform-storage` | RNT-229#5 | Medium | 📦 park | — | ✓ | drizzle/0003_deploy.sql uses no NULLIF; src/sql/policies.sql uses NULLIF |  [triage] park: real but no foreseeable shoot |
| U-136 | `@rntme-cli/platform-storage` | RNT-229#6 | Medium | 📦 park | — | skip | s3-blob-store.ts all ops return PLATFORM_STORAGE_BLOB_UPLOAD_FAILED | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-137 | `@rntme-cli/platform-storage` | RNT-229#7 | Low | ✅ closed | W15 | skip | pg-deploy-target-repo.ts getWithSecretById has no runtime guard | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-138 | `@rntme-cli/platform-storage` | RNT-229#8 | Low | ✅ closed | W15 | skip | aes-gcm-cipher.ts decrypt throws on keyVersion mismatch | [verify] not in sample [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-139 | `@rntme-cli/platform-storage` | RNT-229#9 | Low | 📦 park | — | skip | PgProjectVersionRepo and PgAuditRepo lack dedicated test files | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-140 | `@rntme-cli/platform-storage` | RNT-229#10 | Low | 📦 park | — | skip | test/integration/harness.ts hardcodes TRUNCATE list of 11 tables | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-141 | `@rntme-cli/platform-storage` | RNT-229#11 | Low | 📦 park | — | skip | src/index.ts re-exports * from './schema/index.js' | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-142 | `@rntme/conformance-ai-llm` | RNT-218#1 | High | 📦 park | — | ✓ | Cross-category interface divergence between AI-LLM, Identity, and CRM |  [triage] park: real but no foreseeable shoot |
| U-143 | `@rntme/conformance-ai-llm` | RNT-218#2 | Medium | 📦 park | — | ✓ | Conformance framework stub duplicated verbatim across AI-LLM and Identity |  [triage] park: real but no foreseeable shoot |
| U-144 | `@rntme/conformance-ai-llm` | RNT-218#3 | Medium | 📦 park | — | ✓ | build:deps script inconsistent across AI-LLM, Identity, and CRM |  [triage] park: real but no foreseeable shoot |
| U-145 | `@rntme/conformance-ai-llm` | RNT-218#4 | Medium | 📦 park | — | ✓ | AI-LLM lacks per-RPC assertion registry that CRM has |  [triage] park: real but no foreseeable shoot |
| U-146 | `@rntme/conformance-ai-llm` | RNT-218#5 | Low | 📦 park | — | skip | test:watch runs build:deps causing slow rebuilds on every change | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-147 | `@rntme/conformance-ai-llm` | RNT-218#6 | Low | 📦 park | — | skip | Dead fallback path resolves to non-existent location, never executes | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-148 | `@rntme/conformance-ai-llm` | RNT-218#7 | Low | 📦 park | — | skip | Fixtures runtime-import proto enum, deviating from plan's raw literals | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-149 | `@rntme/conformance-crm` | RNT-219#H1 | High | 📦 park | — | ✓ | modules/crm/conformance/src/types.ts vs identity/ai-llm types.ts |  [triage] park: real but no foreseeable shoot |
| U-150 | `@rntme/conformance-crm` | RNT-219#H2 | High | 📦 park | — | ✓ | modules/crm/conformance/package.json missing build:deps |  [triage] park: real but no foreseeable shoot |
| U-151 | `@rntme/conformance-crm` | RNT-219#M1 | Medium | 📦 park | — | ✓ | package.json lists only @rntme/contracts-crm-v1 |  [triage] park: real but no foreseeable shoot |
| U-152 | `@rntme/conformance-crm` | RNT-219#M2 | Medium | 📦 park | — | ✓ | no src/capabilities.ts; ai-llm has AI_LLM_CANONICAL_RPCS etc. |  [triage] park: real but no foreseeable shoot |
| U-153 | `@rntme/conformance-crm` | RNT-219#M3 | Medium | 📦 park | — | ✓ | all 34 *.scenarios.ts export pendingScenario with empty action/steps |  [triage] park: real but no foreseeable shoot |
| U-154 | `@rntme/conformance-crm` | RNT-219#L1 | Low | 📦 park | — | skip | package.json files array includes src/fixtures/webhooks | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-155 | `@rntme/conformance-crm` | RNT-219#L2 | Low | 📦 park | — | skip | test/suite-shape.test.ts enforces assertionsDescription.length > 120 | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-156 | `@rntme/conformance-crm` | RNT-219#L3 | Low | 📦 park | — | skip | package.json test:watch script lacks build:deps prefix | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-157 | `@rntme/conformance-identity` | RNT-220#1 | Blocker | 🚧 blueprint | W2 | ✓ | identity/ai-llm use camelCase contractVersion+scenariosByRpc; CRM uses snake_case |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-158 | `@rntme/conformance-identity` | RNT-220#2 | High | 🚧 blueprint | W2 | ✓ | test/ has only drift.test.ts and suite-shape.test.ts; no fixtures-sanity.test.ts |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-159 | `@rntme/conformance-identity` | RNT-220#3 | High | 🚧 blueprint | W2 | ✓ | Session RPCs exist in proto; fixtures/ has users/orgs/invitations only, no sessions.ts |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-160 | `@rntme/conformance-identity` | RNT-220#4 | Medium | 🚧 blueprint | W2 | ✓ | Identity exports identityConformanceSuite; CRM exports generic suite |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-161 | `@rntme/conformance-identity` | RNT-220#5 | Medium | 🚧 blueprint | W2 | ✓ | AI-LLM README declares Out of scope; Identity README has no equivalent section |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-162 | `@rntme/conformance-identity` | RNT-220#6 | Low | 🚧 blueprint | W2 | skip | AI-LLM has src/capabilities.ts; Identity has no analogous registry file | [verify] not in sample [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-163 | `@rntme/conformance-identity` | RNT-220#7 | Low | 🚧 blueprint | W2 | skip | 6 structural tests total; no semantic coverage of error codes or events | [verify] not in sample [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-164 | `@rntme/conformance-identity` | RNT-220#8 | Low | 🚧 blueprint | W2 | skip | package.json version is 0.0.0 but module_version: '0.0.0' leaks into fixtures | [verify] not in sample [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
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
| U-188 | `@rntme/contracts-identity-v1` | RNT-217#1 | High | 🚧 blueprint | W2 | ✓ | scripts/check-imports.mjs not referenced in package.json or CI |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-189 | `@rntme/contracts-identity-v1` | RNT-217#2 | High | 🚧 blueprint | W2 | ✓ | import Long = require("long") in proto.gen.d.ts; long not in deps |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-190 | `@rntme/contracts-identity-v1` | RNT-217#3 | Medium | 🚧 blueprint | W2 | ✓ | scripts/gen.mjs exists but no CI check that gen output matches .proto |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-191 | `@rntme/contracts-identity-v1` | RNT-217#4 | Medium | 🚧 blueprint | W2 | ✓ | src/index.ts re-exports CanonicalRef, CommandContext, Name, ListRequest from common |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-192 | `@rntme/contracts-identity-v1` | RNT-217#5 | Medium | 🚧 blueprint | W2 | ✓ | no test imports User/Organization/CanonicalRef directly from package entry |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-193 | `@rntme/contracts-identity-v1` | RNT-217#6 | Low | 🚧 blueprint | W2 | skip | package.json#version is 0.0.0 while contract is v1 | [verify] not in sample [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-194 | `@rntme/contracts-identity-v1` | RNT-217#7 | Low | 🚧 blueprint | W2 | skip | package.json missing repository, bugs, homepage fields | [verify] not in sample [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-195 | `@rntme/db-studio` | RNT-203#1 | High | 📦 park | — | ✓ | src/whitelist/classify.ts hand-rolled tokenizer+regex, no real SQL parser | [verify] src/whitelist/classify.ts implements stripCommentsAndStrings + classifyLeading via hand-rolled tokenizer + regex (WRITE_ [triage] park: real but no foreseeable shoot |
| U-196 | `@rntme/db-studio` | RNT-203#2 | High | 📦 park | — | ✓ | src/handler/pipeline.ts executeOne ignores s.condition in batch steps | [verify] src/handler/pipeline.ts handleRequest line 37: req.batch.steps.map((s) => executeOne(s.stmt, deps)) passes only s.stmt;  [triage] park: real but no foreseeable shoot |
| U-197 | `@rntme/db-studio` | RNT-203#3 | Medium | 📦 park | — | ✓ | src/handle/cap.ts LIMIT_RE only matches trailing clause, not nested LIMITs | [verify] src/handle/cap.ts LIMIT_RE = /\bLIMIT\s+(\d+)(?:\s*,\s*(\d+))?(?:\s+OFFSET\s+\d+)?\s*$/i is anchored to end-of-string. C [triage] park: real but no foreseeable shoot |
| U-198 | `@rntme/db-studio` | RNT-203#4 | Medium | 📦 park | — | ✓ | runtime http-surface.ts mountStudio() called without logger; logger?.info no-op | [verify] StudioLogger interface defined in src/mount.ts (lines 16-20) and consumed via logger?.info('studio.pipeline', ...). Howe [triage] park: real but no foreseeable shoot |
| U-199 | `@rntme/db-studio` | RNT-203#5 | Medium | 📦 park | — | ✓ | test/unit/classify.test.ts lacks END keyword test; classify.ts handles it untested | [verify] test/unit/classify.test.ts only covers BEGIN/COMMIT/ROLLBACK/SAVEPOINT for DB_STUDIO_READONLY_TXN_DENIED (lines 37-40).  [triage] park: real but no foreseeable shoot |
| U-200 | `@rntme/db-studio` | RNT-203#6 | Medium | 📦 park | — | skip | demo studio-e2e.test.ts uses persistent SQLite; :memory: path not e2e-tested | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-201 | `@rntme/db-studio` | RNT-203#7 | Low | 📦 park | — | skip | manifest/validate.ts uses MANIFEST_INVALID_TYPE for maxRows; inconsistent | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-202 | `@rntme/db-studio` | RNT-203#8 | Low | 📦 park | — | skip | src/hrana/encode.ts returns { type:'text', value:String(v) } for unknown types | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-203 | `@rntme/db-studio` | RNT-203#9 | Low | 📦 park | — | skip | src/index.ts VERSION constant hardcoded to '0.0.0' | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-204 | `@rntme/db-studio` | RNT-203#10 | Low | 📦 park | — | skip | README.md API table and Quick start omit optional StudioLogger | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-205 | `@rntme/db-studio` | RNT-203#11 | Low | 📦 park | — | skip | StudioConfigSchema only checks startsWith('/'); no trailing-slash check | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-206 | `@rntme/event-store` | RNT-204#1 | High | 🚧 blueprint | W3 | ✓ | src/types/actor.ts — local copy of union type |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-207 | `@rntme/event-store` | RNT-204#2 | High | 🚧 blueprint | W3 | ✓ | src/store/row-mapper.ts — source/type/dataSchema derived from serviceName |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-208 | `@rntme/event-store` | RNT-204#3 | Medium | 📦 park | — | ✓ | src/types/envelope.ts — data: TPayload, but append accepts unknown |  [triage] park: real but no foreseeable shoot |
| U-209 | `@rntme/event-store` | RNT-204#4 | Medium | 🔫 gun | W3 | ✓ | src/store/sqlite.ts — journal_mode = WAL, no file-lock check |  [triage] gun: loaded — security/corruption/error-contract gap |
| U-210 | `@rntme/event-store` | RNT-204#5 | Medium | 📦 park | — | ✓ | test/append-raw.test.ts — versions 5, 7 accepted |  [triage] park: real but no foreseeable shoot |
| U-211 | `@rntme/event-store` | RNT-204#6 | Low | 📦 park | — | skip | vitest.config.ts — no @vitest/coverage-v8 | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-212 | `@rntme/event-store` | RNT-204#7 | Low | 📦 park | — | skip | src/store/interface.ts + src/store/sqlite.ts | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-213 | `@rntme/event-store` | RNT-204#8 | Low | 📦 park | — | skip | package.json + src/index.ts | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-214 | `@rntme/event-store` | RNT-204#9 | Low | 📦 park | — | skip | README §Out of scope | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-215 | `@rntme/graph-ir-compiler` | RNT-205#1 | High | ✅ closed | W7 | ✓ | packages/graph-ir-compiler/src no longer has direct `throw new Error` / `Object.assign(new Error...)` hits per FINISH evidence | [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-277 / PR #68 / merge `b634c2606a24fe887a273c151ccbeb329828b0dc` |
| U-216 | `@rntme/graph-ir-compiler` | RNT-205#2 | High | 📦 park | — | ✓ | Four top-level functions repeat parse→validate→normalize pipeline |  [triage] park: real but no foreseeable shoot |
| U-218 | `@rntme/graph-ir-compiler` | RNT-205#4 | Medium | 📦 park | — | ✓ | command-runtime/compile.ts manually calls parsePdm/validatePdm/parseQsm/validateQsm |  [triage] park: real but no foreseeable shoot |
| U-219 | `@rntme/graph-ir-compiler` | RNT-205#5 | Medium | 📦 park | — | ✓ | projection-compile.ts catch returns PROJ_ROLE_UNINFERRABLE for any lowering error |  [triage] park: real but no foreseeable shoot |
| U-220 | `@rntme/graph-ir-compiler` | RNT-205#6 | Medium | 📦 park | — | ✓ | lower.ts default context casts empty object as ValidatedQsm via unknown |  [triage] park: real but no foreseeable shoot |
| U-221 | `@rntme/graph-ir-compiler` | RNT-205#7 | Medium | 📦 park | — | skip | STRUCT_DUPLICATE_GRAPH_ID returned for 0/>1 graphs and missing graphId across 3 files | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-222 | `@rntme/graph-ir-compiler` | RNT-205#8 | Medium | 📦 park | — | skip | index.ts exports parseAuthoringSpec, validateStructural, validateSemantic, normalize as public | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-223 | `@rntme/graph-ir-compiler` | RNT-205#9 | Low | 📦 park | — | skip | explain in index.ts mirrors compile almost line-for-line, only collecting intermediates | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-224 | `@rntme/graph-ir-compiler` | RNT-205#10 | Low | 📦 park | — | skip | vitest run --coverage fails: missing @vitest/coverage-v8 in devDependencies | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-225 | `@rntme/issue-tracker-api-demo` | RNT-221#1 | High | 📦 park | — | ✓ | diff -r demo/issue-tracker-api/artifacts vs runtime fixtures: 30+ divergences |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-226 | `@rntme/issue-tracker-api-demo` | RNT-221#2 | High | 📦 park | — | ✓ | README marks deprecated but pkg is primary e2e target and 15+ refs |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-227 | `@rntme/issue-tracker-api-demo` | RNT-221#3 | High | 📦 park | — | ✓ | artifacts/graph-ir.json (1038 lines) duplicates graphs/*.json + shapes.json |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-228 | `@rntme/issue-tracker-api-demo` | RNT-221#4 | Medium | 📦 park | — | ✓ | vitest.config.ts sets fileParallelism: false; e2e tests already use unique ports |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-229 | `@rntme/issue-tracker-api-demo` | RNT-221#5 | Medium | 📦 park | — | ✓ | grpc.test.ts uses loadService/startService; other e2e tests spawn subprocess |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-230 | `@rntme/issue-tracker-api-demo` | RNT-221#6 | Medium | 📦 park | — | ✓ | derived-projection.test.ts defines local SqlDb and Kafka stubs |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-231 | `@rntme/issue-tracker-api-demo` | RNT-221#7 | Medium | 📦 park | — | skip | KNOWN_ISSUES.md says all resolved/deprecated yet remains 79 lines and linked | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-232 | `@rntme/issue-tracker-api-demo` | RNT-221#8 | Medium | 📦 park | — | skip | package.json scripts has no lint entry | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-233 | `@rntme/issue-tracker-api-demo` | RNT-221#9 | Low | 📦 park | — | skip | artifacts/ui.json (1229 lines) flattens ui/manifest.json + screens/layouts/fragments | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-234 | `@rntme/issue-tracker-api-demo` | RNT-221#10 | Low | 📦 park | — | skip | Dockerfile pins FROM ghcr.io/vladprrs/rntme-runtime:1.0 with no update automation | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
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
| U-250 | `@rntme/pre-step-demo` | RNT-222#B1 | Blocker | 📦 park | — | ✓ | demo/pre-step-demo/README.md missing; no onboarding doc |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-251 | `@rntme/pre-step-demo` | RNT-222#H1 | High | 📦 park | — | ✓ | test/e2e only happy path; no failure scenarios for pre-step |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-252 | `@rntme/pre-step-demo` | RNT-222#H2 | High | 📦 park | — | ✓ | src/fake-payments-module.ts: no Health.Check, no dedup, no graceful shutdown |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-253 | `@rntme/pre-step-demo` | RNT-222#H3 | High | 📦 park | — | ✓ | artifacts/ has no seed.json; demo starts empty |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-254 | `@rntme/pre-step-demo` | RNT-222#M1 | Medium | 📦 park | — | ✓ | pre-step.test.ts and callback.test.ts share identical 18-line setup |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-255 | `@rntme/pre-step-demo` | RNT-222#M2 | Medium | 📦 park | — | ✓ | 127.0.0.1:60051 hardcoded in server.ts, tests, manifest.json |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-256 | `@rntme/pre-step-demo` | RNT-222#M3 | Medium | 📦 park | — | ✓ | fake-payments-module reads idempotency-key into idem but never uses it |  [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-257 | `@rntme/pre-step-demo` | RNT-222#M4 | Medium | 📦 park | — | skip | pre-step.test.ts uses arbitrary 100ms setTimeout for cache write | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-258 | `@rntme/pre-step-demo` | RNT-222#M5 | Medium | 📦 park | — | skip | pnpm -F lint reports no lint script in package.json | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-259 | `@rntme/pre-step-demo` | RNT-222#L1 | Low | 📦 park | — | skip | artifacts/shapes.json contains only {} — dead file | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-260 | `@rntme/pre-step-demo` | RNT-222#L2 | Low | 📦 park | — | skip | artifacts/ui/ index.json pages=[]; manifest layouts/routes empty | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-261 | `@rntme/pre-step-demo` | RNT-222#L3 | Low | 📦 park | — | skip | pdm.json vs createOrder.json customerId nullable drift; bindAs/bindTo collision | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-262 | `@rntme/pre-step-demo` | RNT-222#L4 | Low | 📦 park | — | skip | issue-tracker-api has Dockerfile; pre-step-demo does not | [verify] not in sample [triage] E4 deprecated demo default — non-fire findings parked [triage] park: real but no foreseeable shoot |
| U-263 | `@rntme/projection-consumer` | RNT-208#1 | Blocker | 🚧 blueprint | W3 | ✓ | README says skipped-no-mirror; code returns skipped-no-handler |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-264 | `@rntme/projection-consumer` | RNT-208#2 | High | 🚧 blueprint | W3 | ✓ | ROLLBACK in consumer.ts can clobber original error if COMMIT fails |  [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) |
| U-265 | `@rntme/projection-consumer` | RNT-208#3 | High | 🔫 gun | W3 | ✓ | getDbHandle() exposes write access to projection tables |  [triage] gun: loaded — security/corruption/error-contract gap |
| U-266 | `@rntme/projection-consumer` | RNT-208#4 | Medium | 📦 park | — | ✓ | VERSION hardcoded as '0.0.0' in src/index.ts |  [triage] park: real but no foreseeable shoot |
| U-267 | `@rntme/projection-consumer` | RNT-208#5 | Medium | 📦 park | — | ✓ | Heavy compile dep on graph-ir-compiler for one type DerivedColumnBinding |  [triage] park: real but no foreseeable shoot |
| U-268 | `@rntme/projection-consumer` | RNT-208#6 | Medium | 📦 park | — | ✓ | stop() may produce unhandled rejection when onError absent |  [triage] park: real but no foreseeable shoot |
| U-269 | `@rntme/projection-consumer` | RNT-208#7 | Medium | 📦 park | — | skip | consumer-rollback test only covers apply errors, not COMMIT failure | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-270 | `@rntme/projection-consumer` | RNT-208#8 | Low | 📦 park | — | skip | bootstrapProjections regex DDL rewrite fragile to whitespace/comments | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-271 | `@rntme/projection-consumer` | RNT-208#9 | Low | 📦 park | — | skip | InMemoryKafkaConsumer exported from main index despite test-only role | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-272 | `@rntme/projection-consumer` | RNT-208#10 | Low | 📦 park | — | skip | getAfter silently drops 'before' key by heuristic, risking data loss | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-273 | `@rntme/projection-consumer` | RNT-208#11 | Low | 📦 park | — | skip | selectCurrentVersion uses non-null assertion on find() | [verify] not in sample [triage] fire: condition currently shooting |
| U-274 | `@rntme/qsm` | RNT-209#1 | High | 📦 park | — | ✓ | src/derive/handler.ts — continue on backing !== 'entity-mirror' |  [triage] park: real but no foreseeable shoot |
| U-275 | `@rntme/qsm` | RNT-209#2 | High | 📦 park | — | ✓ | test/ has only unit/ and fixtures/; smoke.test.ts has 2 tests |  [triage] park: real but no foreseeable shoot |
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
| U-287 | `@rntme/runtime` | RNT-210#5 | High | 🔫 gun | W3 | ✓ | seen-events-retention.ts — Number(env) without isNaN/bounds check; NaN deletes all or none |  [triage] gun: loaded — security/corruption/error-contract gap |
| U-288 | `@rntme/runtime` | RNT-210#6 | High | 📦 park | — | ✓ | build-actor-from-request.ts only checks id undefined or empty string |  [triage] park: real but no foreseeable shoot |
| U-289 | `@rntme/runtime` | RNT-210#7 | High | 📦 park | — | ✓ | start-service.ts — Partial<RuntimeConfig> with no runtime validation of field combos |  [triage] park: real but no foreseeable shoot |
| U-290 | `@rntme/runtime` | RNT-210#8 | High | ✅ closed | W4 | ✓ | build-grpc-surface.ts collectShapesFromService — MVP comment, row inputs unresolved | [triage] blueprint: blocks first real blueprint (identity/event-bus/module-skeleton/http-auth-entry) [fix] RNT-276 / PR #56 / merge `26650535d5da1eaa40efe43a0878d010fa763612` |
| U-291 | `@rntme/runtime` | RNT-210#9 | High | 📦 park | — | ✓ | load-service.ts uses readTextFile/readJsonFile/readGraphsDir directly; no abstraction |  [triage] park: real but no foreseeable shoot |
| U-292 | `@rntme/runtime` | RNT-210#10 | High | 📦 park | — | ✓ | start-service.ts server.close() waits indefinitely for keep-alive connections |  [triage] park: real but no foreseeable shoot |
| U-293 | `@rntme/runtime` | RNT-210#11 | Medium | 📦 park | — | ✓ | cross-validate.ts passes rawPdm/rawQsm typed unknown to compileProjectionGraph |  [triage] park: real but no foreseeable shoot |
| U-294 | `@rntme/runtime` | RNT-210#12 | Medium | 📦 park | — | ✓ | Dockerfile COPY demo ./demo inflates build context for runtime image |  [triage] park: real but no foreseeable shoot |
| U-295 | `@rntme/runtime` | RNT-210#13 | Medium | 📦 park | — | ✓ | proto-registry.ts stops at first protobuf.Service per file; extras dropped silently |  [triage] park: real but no foreseeable shoot |
| U-296 | `@rntme/runtime` | RNT-210#14 | Medium | 📦 park | — | skip | interfaces.ts Surface — listen optional; Http mounts, Grpc listens; mount no-op | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-297 | `@rntme/runtime` | RNT-210#15 | Medium | 📦 park | — | skip | graph-ir-command-executor.ts mapError detail omits stack for unexpected errors | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-298 | `@rntme/runtime` | RNT-210#16 | Medium | 📦 park | — | skip | manifest/validate.ts — applyEnvOverrides and validateManifest use differing accumulation | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-299 | `@rntme/runtime` | RNT-210#17 | Medium | 📦 park | — | skip | in-memory-bus.ts consumer() ignores topic param; returns single inner consumer | [verify] not in sample [triage] park: real but no foreseeable shoot |
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
| U-319 | `@rntme/ui` | RNT-212#B1 | Blocker | 📦 park | — | ✓ | package.json lists zod ^4.0.0; zero imports across src/ |  [triage] park: real but no foreseeable shoot |
| U-320 | `@rntme/ui` | RNT-212#H1 | High | 📦 park | — | ✓ | resolve.ts only catches JSON.parse failure; SPEC_INVALID never emitted |  [triage] park: real but no foreseeable shoot |
| U-321 | `@rntme/ui` | RNT-212#H2 | High | 📦 park | — | ✓ | resolve.ts derives key as route.screen.split('/').pop()!; collisions silent |  [triage] park: real but no foreseeable shoot |
| U-322 | `@rntme/ui` | RNT-212#H3 | High | 📦 park | — | ✓ | emit/http-map.ts uses `if (!http) continue;` skipping missing bindings |  [triage] park: real but no foreseeable shoot |
| U-323 | `@rntme/ui` | RNT-212#H4 | High | 📦 park | — | ✓ | Most reserved UiErrorCode values have no test coverage |  [triage] park: real but no foreseeable shoot |
| U-324 | `@rntme/ui` | RNT-212#H5 | High | 📦 park | — | ✓ | TYPE_MISMATCH and UNCOVERED_INPUT reserved but never emitted |  [triage] park: real but no foreseeable shoot |
| U-325 | `@rntme/ui` | RNT-212#M1 | Medium | 📦 park | — | ✓ | validate/index.ts declares resolveComponent; no validator calls it |  [triage] park: real but no foreseeable shoot |
| U-326 | `@rntme/ui` | RNT-212#M2 | Medium | 📦 park | — | ✓ | BINDING_KIND_MISMATCH exists in UiErrorCode but never emitted |  [triage] park: real but no foreseeable shoot |
| U-327 | `@rntme/ui` | RNT-212#M3 | Medium | 📦 park | — | ✓ | types/source.ts and emit.ts hardcode '2.0'; resolve never checks manifest.version |  [triage] park: real but no foreseeable shoot |
| U-328 | `@rntme/ui` | RNT-212#M4 | Medium | 📦 park | — | skip | emit returns single in-memory CompiledArtifact; no pre-split output | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-329 | `@rntme/ui` | RNT-212#M5 | Medium | 📦 park | — | skip | Layout with zero Slot elements passes validateStructural | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-330 | `@rntme/ui` | RNT-212#M6 | Medium | 📦 park | — | skip | collectStatePaths walks props/visible/on/watch but not repeat.statePath | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-331 | `@rntme/ui` | RNT-212#M7 | Medium | 📦 park | — | skip | isRefElement uses `'$ref' in el`; passes objects with both shapes | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-332 | `@rntme/ui` | RNT-212#M8 | Medium | 📦 park | — | skip | collectFragments uses `return` after CIRCULAR_REF, aborting collection | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-333 | `@rntme/ui` | RNT-212#M9 | Medium | 📦 park | — | skip | validate/index.ts implements :param matching but no test exercises it | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-334 | `@rntme/ui` | RNT-212#M10 | Medium | 📦 park | — | skip | packages/ui/tsconfig.json has composite: false | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-335 | `@rntme/ui` | RNT-212#M11 | Medium | 📦 park | — | skip | No eslint.config.mjs or .eslintrc in packages/ui/ | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-336 | `@rntme/ui` | RNT-212#L1 | Low | 📦 park | — | skip | UiError.path is logical (e.g. screen:home/actions/submit), not file/offset | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-337 | `@rntme/ui` | RNT-212#L2 | Low | 📦 park | — | skip | CommandAction.onSuccess fields not validated against routes/bindings | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-338 | `@rntme/ui` | RNT-212#L3 | Low | 📦 park | — | skip | ResolvedSource.baseDir and ExpandedSource.baseDir carry FS path through | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-339 | `@rntme/ui` | RNT-212#L4 | Low | 📦 park | — | skip | emit.ts casts spread object to CompiledScreen | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-340 | `@rntme/ui` | RNT-212#L5 | Low | 📦 park | — | skip | README links to ../../docs/superpowers/specs/done/... via relative paths | [verify] not in sample [triage] park: real but no foreseeable shoot |
| U-341 | `@rntme/ui-runtime` | RNT-213#B1 | Blocker | 📦 park | — | ✓ | package.json: react ^19.2.5 but @types/react ^18.3.3 |  [triage] park: real but no foreseeable shoot |
| U-342 | `@rntme/ui-runtime` | RNT-213#H1 | High | 📦 park | — | ✓ | no eslint.config.mjs, no lint script (only pkg without lint) |  [triage] park: real but no foreseeable shoot |
| U-343 | `@rntme/ui-runtime` | RNT-213#H2 | High | 📦 park | — | ✓ | buildUrl/resolveParamValue/dispatch duplicated across driver/entry/registry |  [triage] park: real but no foreseeable shoot |
| U-344 | `@rntme/ui-runtime` | RNT-213#H3 | High | 📦 park | — | ✓ | 5/9 files lack unit tests; entry.tsx and registry.ts uncovered |  [triage] park: real but no foreseeable shoot |
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
| U-355 | `@rntme/bindings-http` | discovered-during-U-031 | Medium | 📦 park | — | ✓ | lines 48-62 use `throw new Error(...)` for missing eventStore/commandExecutor/externalAdapterClient — violates Result<T> convention | [verify] discovered during verification of U-031 [triage] park: real but no foreseeable shoot |
| U-356 | `@rntme-cli/cli` | discovered | Medium | 📦 park | — | ✓ | src/commands/init.ts:66-84 implements its own writeOk/writeErr like skills/install.ts. Both init and skills install commands skip runCommand from harness.ts. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-357 | `@rntme/db-studio` | discovered | Medium | 📦 park | — | ✓ | build-time tsconfig has "exclude": ["dist", "node_modules", "test"]; tsconfig.check.json includes test/**/*.ts(x). Confirms U-125 (in skip). | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-358 | `@rntme-cli/platform-http` | discovered | Medium | ✅ closed | W15 | ✓ | auth.test.ts and tx.test.ts now exist (U-128 partially obsolete) but cors.test.ts is still missing — and the regex-from-glob path in cors.ts (U-122) is the riskiest middleware to leave untested. | [verify] discovered during verification [triage] gun: loaded — security/corruption/error-contract gap [fix] RNT-282 / PR #84 / merge `65066779c19c69a80cb3c07f97e4a52bee8e68a6` |
| U-359 | `@rntme/conformance-ai-llm` | discovered | Medium | 📦 park | — | ✓ | src/fixtures/media/index.ts fallback resolve(here, '../../../src/fixtures/media', filename) was claimed dead. Verified via node path.resolve: from dist/fixtures/media/ the fallback resolves to <pkg>/src/fixtures/media/<filename> which exists. Audit RNT-218#6 finding is incorrect; the path executes post-build (when tsc has not copied .png/.mp3/.pdf into dist/) and points to the real source fixtures. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-360 | `@rntme/conformance-ai-llm` | discovered | Medium | 📦 park | — | ✓ | modules/ai-llm/conformance/package.json test:watch = 'pnpm run build:deps && vitest'. Identity's test:watch = 'vitest' (no build:deps). CRM has no build:deps at all. AI-LLM forces a full contracts rebuild on every watch invocation. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-361 | `@rntme/conformance-ai-llm` | discovered | Medium | 📦 park | — | ✓ | src/fixtures/content-blocks.ts imports { proto } from '@rntme/contracts-ai-llm-v1' and references proto.rntme.contracts.ai_llm.v1.ContentBlockType.CONTENT_BLOCK_TYPE_TEXT etc. This couples fixtures at runtime to the generated proto package; raw literal block-type strings would be plan-aligned and decoupled. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-362 | `@rntme/contracts-common-v1` | discovered | Medium | 📦 park | — | ✓ | src/index.ts (2 lines) only does `export * as proto from './proto.gen.js'` and `export type { rntme as Rntme }`. No named CanonicalRef/CommandContext/Name/ListRequest exports — this is the same shape as U-173 (Low, in skip). Adjacent severe finding: error-codes.json is `{}` (3 bytes) — empty placeholder, no actual codes registered, which combines with U-174 (no error-codes.ts) to mean the package has zero error-code surface despite the contracts pattern. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-363 | `@rntme/event-store` | discovered | Medium | 📦 park | — | ✓ | packages/event-store/src/store/schema.ts line 12 declares `actor_kind TEXT` with no CHECK constraint. Validation lives at read time in row-mapper.ts:51-58 (toActorKind throws EVENT_STORE_ROW_INVALID_ACTORKIND on bad value). This means a corrupted/manual write (e.g. via getDbHandle, db-studio, or a future schema migration) can persist arbitrary actor_kind strings; corruption surfaces only when that row is read, not at insert. A CHECK(actor_kind IN ('user','system','service') OR actor_kind IS NULL) constraint would mirror the row-mapper invariant and fail-fast at write. | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-364 | `@rntme/graph-ir-compiler` | discovered | Medium | 📦 park | — | ✓ | /home/coder/project/packages/graph-ir-compiler/src/projection-compile.ts | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-365 | `@rntme/module-skeleton` | discovered | Medium | 📦 park | — | ✓ |  | [verify] discovered during verification [triage] park: real but no foreseeable shoot |
| U-366 | `@rntme/projection-consumer` | discovered | Medium | 📦 park | — | ✓ |  | [verify] discovered during verification [triage] park: real but no foreseeable shoot |

---

## Lens C — Per-package index (auditor view)

### `@rntme-cli/cli` — total findings: 12

- → DEV:
- → DECIDE:
- → PARK: U-063, U-064, U-065, U-066, U-068, U-069, U-070, U-356
- → REJECTED: U-060, U-061, U-062, U-067

### `@rntme-cli/deploy-core` — total findings: 7

- → DEV:
- → DECIDE:
- → PARK: U-071, U-072, U-073, U-074, U-075, U-076, U-077
- → REJECTED:

### `@rntme-cli/deploy-dokploy` — total findings: 13

- → DEV:
- → DECIDE:
- → PARK: U-078, U-079, U-080, U-081, U-083, U-084, U-086, U-088, U-089, U-090
- → REJECTED: U-082, U-085

### `@rntme-cli/landing` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK: U-091, U-092, U-093, U-094, U-095, U-096, U-097, U-098, U-099, U-100
- → REJECTED:

### `@rntme-cli/platform-core` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK: U-102, U-103, U-104, U-106, U-107, U-108, U-109, U-110
- → REJECTED: U-101, U-105

### `@rntme-cli/platform-http` — total findings: 21

- → DEV:
- → DECIDE:
- → PARK: U-111, U-112, U-114, U-115, U-116, U-117, U-118, U-119, U-120, U-121, U-124, U-125, U-126, U-127, U-128, U-129, U-130
- → REJECTED:

### `@rntme-cli/platform-storage` — total findings: 11

- → DEV:
- → DECIDE:
- → PARK: U-131, U-132, U-133, U-134, U-135, U-136, U-139, U-140, U-141
- → REJECTED:

### `@rntme/bindings` — total findings: 9

- → DEV:
- → DECIDE: U-047
- → PARK: U-039, U-040, U-041, U-042, U-043, U-044, U-045, U-046
- → REJECTED:

### `@rntme/bindings-grpc` — total findings: 13

- → DEV:
- → DECIDE:
- → PARK: U-014, U-015, U-016, U-017, U-018, U-019, U-020, U-021, U-022, U-024, U-025, U-026
- → REJECTED:

### `@rntme/bindings-http` — total findings: 13

- → DEV: U-032
- → DECIDE:
- → PARK: U-027, U-028, U-029, U-030, U-031, U-033, U-034, U-035, U-036, U-037, U-038, U-355
- → REJECTED:

### `@rntme/blueprint` — total findings: 12

- → DEV:
- → DECIDE:
- → PARK: U-048, U-049, U-050, U-051, U-052, U-053, U-054, U-055, U-056, U-057, U-058, U-059
- → REJECTED:

### `@rntme/conformance-ai-llm` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK: U-142, U-143, U-144, U-145, U-146, U-147, U-148, U-359, U-360, U-361
- → REJECTED:

### `@rntme/conformance-crm` — total findings: 8

- → DEV:
- → DECIDE:
- → PARK: U-149, U-150, U-151, U-152, U-153, U-154, U-155, U-156
- → REJECTED:

### `@rntme/conformance-identity` — total findings: 8

- → DEV: U-157, U-158, U-159, U-160, U-161, U-162, U-163, U-164
- → DECIDE:
- → PARK:
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

- → DEV: U-188, U-189, U-190, U-191, U-192, U-193, U-194
- → DECIDE:
- → PARK:
- → REJECTED:

### `@rntme/db-studio` — total findings: 12

- → DEV:
- → DECIDE:
- → PARK: U-195, U-196, U-197, U-198, U-199, U-200, U-201, U-202, U-203, U-204, U-205, U-357
- → REJECTED:

### `@rntme/event-store` — total findings: 10

- → DEV: U-206, U-207, U-209
- → DECIDE:
- → PARK: U-208, U-210, U-211, U-212, U-213, U-214, U-363
- → REJECTED:

### `@rntme/graph-ir-compiler` — total findings: 11

- → DEV:
- → DECIDE:
- → PARK: U-216, U-218, U-219, U-220, U-221, U-222, U-223, U-224, U-364
- → REJECTED: U-217

### `@rntme/issue-tracker-api-demo` — total findings: 10

- → DEV:
- → DECIDE:
- → PARK: U-225, U-226, U-227, U-228, U-229, U-230, U-231, U-232, U-233, U-234
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
- → PARK: U-250, U-251, U-252, U-253, U-254, U-255, U-256, U-257, U-258, U-259, U-260, U-261, U-262
- → REJECTED:

### `@rntme/projection-consumer` — total findings: 12

- → DEV: U-263, U-264, U-265
- → DECIDE:
- → PARK: U-266, U-267, U-268, U-269, U-270, U-271, U-272, U-273, U-366
- → REJECTED:

### `@rntme/qsm` — total findings: 9

- → DEV:
- → DECIDE:
- → PARK: U-274, U-275, U-276, U-277, U-278, U-279, U-280, U-281, U-282
- → REJECTED:

### `@rntme/runtime` — total findings: 22

- → DEV: U-287
- → DECIDE:
- → PARK: U-286, U-288, U-289, U-291, U-292, U-293, U-294, U-295, U-296, U-297, U-298, U-299, U-300, U-301, U-303, U-304
- → REJECTED:

### `@rntme/seed` — total findings: 14

- → DEV:
- → DECIDE:
- → PARK: U-305, U-306, U-307, U-309, U-311, U-312, U-313, U-314, U-315, U-316, U-317, U-318
- → REJECTED: U-310

### `@rntme/ui` — total findings: 22

- → DEV:
- → DECIDE:
- → PARK: U-319, U-320, U-321, U-322, U-323, U-324, U-325, U-326, U-327, U-328, U-329, U-330, U-331, U-332, U-333, U-334, U-335, U-336, U-337, U-338, U-339, U-340
- → REJECTED:

### `@rntme/ui-runtime` — total findings: 14

- → DEV:
- → DECIDE:
- → PARK: U-341, U-342, U-343, U-344, U-345, U-347, U-348, U-349, U-350, U-351, U-352, U-353, U-354
- → REJECTED:

### `monorepo` — total findings: 13

- → DEV:
- → DECIDE:
- → PARK: U-002, U-003, U-004, U-005, U-006, U-007, U-008, U-009, U-010, U-011, U-012, U-013
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
- U-004 — Inconsistent external dependency versions across packages — `monorepo`
- U-005 — Module packages have build:deps invoking other packages — `monorepo`
- U-006 — Conformance packages inconsistently placed in deps vs devDeps — `monorepo`
- U-007 — runtime depends on seed (a CLI tool) in prod dependencies — `monorepo`
- U-014 — actor: null во всех gRPC-командах — `@rntme/bindings-grpc`
- U-015 — bindings-grpc зависит от bindings-http только для executor-contract — `@rntme/bindings-grpc`
- U-016 — Неисчерпывающие switch без fallback-return — `@rntme/bindings-grpc`
- U-017 — Нефальсифицируемое assertion в demo E2E — `@rntme/bindings-grpc`
- U-027 — Public API surface дрейф vs spec — `@rntme/bindings-http`
- U-028 — Дублирование/расхождение типов с @rntme/graph-ir-compiler — `@rntme/bindings-http`
- U-029 — command-handler.ts нарушает SRP (290 строк) — `@rntme/bindings-http`
- U-030 — Жестко закодированный /api префикс — `@rntme/bindings-http`
- U-031 — graphSpec/pdm/qsm: unknown на границе пакета — `@rntme/bindings-http`
- U-048 — Malformed service.json silently ignored at load — `@rntme/blueprint`
- U-049 — Hardcoded scalar registry in binding-resolvers.ts — `@rntme/blueprint`
- U-050 — Stub resolvers in compileServiceUi bypass UI validation — `@rntme/blueprint`
- U-078 — resourceMatches uses JSON.stringify for complex object comparison — `@rntme-cli/deploy-dokploy`
- U-079 — No rollback/cleanup mechanism on partial apply failure — `@rntme-cli/deploy-dokploy`
- U-080 — DokployClient tightly coupled to RenderedDokployResource — `@rntme-cli/deploy-dokploy`
- U-081 — Sequential resource apply with no concurrency control — `@rntme-cli/deploy-dokploy`
- U-091 — data-section-num / id collisions between live and dead components — `@rntme-cli/landing`
- U-092 — Section metadata scattered across ~15 files — `@rntme-cli/landing`
- U-093 — Test coverage critically thin — `@rntme-cli/landing`
- U-102 — archiveOrgCascade missing unit tests inside package — `@rntme-cli/platform-core`
- U-103 — fast-check declared but unused in devDependencies — `@rntme-cli/platform-core`
- U-111 — God object createApp mixes responsibilities — `@rntme-cli/platform-http`
- U-112 — Deploy executor runs inside HTTP process — `@rntme-cli/platform-http`
- U-114 — errorHandler does not log unhandled errors — `@rntme-cli/platform-http`
- U-115 — Unused dependency @hono/zod-openapi — `@rntme-cli/platform-http`
- U-116 — Dokploy client leaked into platform-http — `@rntme-cli/platform-http`
- U-117 — bodyLimit middleware buffers stream and rebuilds Request — `@rntme-cli/platform-http`
- U-131 — Duplicated transaction/helpers across repo files — `@rntme-cli/platform-storage`
- U-132 — Transaction / Result semantics mismatch (no rollback on Result.error) — `@rntme-cli/platform-storage`
- U-142 — Cross-category conformance interface divergence — `@rntme/conformance-ai-llm`
- U-149 — CategoryConformanceSuite/Scenario type schema diverges from identity and ai-llm conformance — `@rntme/conformance-crm`
- U-150 — Missing build:deps script breaks CI on fresh clones — `@rntme/conformance-crm`
- U-165 — Plain-string fields where enums are needed — `@rntme/contracts-ai-llm-v1`
- U-166 — Empty conformance scenarios — `@rntme/contracts-ai-llm-v1`
- U-180 — Conformance assertions reference nonexistent error codes and events — `@rntme/contracts-crm-v1`
- U-181 — layerOf implemented via fragile string-split with no tests — `@rntme/contracts-crm-v1`
- U-195 — SQL whitelist classifier has bypass vectors (security) — `@rntme/db-studio`
- U-196 — batch request type silently ignores condition field (semantic bug) — `@rntme/db-studio`
- U-216 — Four top-level compile functions duplicate the parse→validate→normalize pipeline — `@rntme/graph-ir-compiler`
- U-274 — derived backing is a facade with no runtime handler logic — `@rntme/qsm`
- U-275 — Missing integration and e2e test coverage — `@rntme/qsm`
- U-286 — VERSION export is permanently 0.0.0 — `@rntme/runtime`
- U-288 — buildActorFromRequest has minimal actor ID validation — `@rntme/runtime`
- U-289 — RuntimeConfig accepts arbitrary partial objects without validation — `@rntme/runtime`
- U-291 — loadService is tightly coupled to the filesystem — `@rntme/runtime`
- U-292 — No graceful shutdown timeout — `@rntme/runtime`
- U-305 — applySeed signature mismatch with spec (opts required vs optional) — `@rntme/seed`
- U-306 — ValidateCtx requires serviceName not present in spec — `@rntme/seed`
- U-307 — countEvents reads up to 1M records instead of SELECT COUNT(*) — `@rntme/seed`
- U-319 — Declared zod dependency is completely unused — `@rntme/ui`
- U-320 — No parse-layer validation at all — `@rntme/ui`
- U-321 — Screen key collision is unvalidated — `@rntme/ui`
- U-322 — emit silently drops missing httpMap bindings — `@rntme/ui`
- U-323 — Test coverage has critical gaps for reserved error codes — `@rntme/ui`
- U-324 — No consistency/cross-check validation layer — `@rntme/ui`
- U-341 — React 19 + @types/react 18 version mismatch — `@rntme/ui-runtime`
- U-342 — Missing ESLint — only package without lint config — `@rntme/ui-runtime`
- U-343 — Massive logic duplication between client modules — `@rntme/ui-runtime`
- U-344 — Incomplete test coverage — critical paths untested — `@rntme/ui-runtime`

### Trigger: replaced by canonical project-shape example

- U-225 — Runtime fixture copy out of sync with demo artifacts — `@rntme/issue-tracker-api-demo`
- U-226 — Deprecated status contradicts actual usage — `@rntme/issue-tracker-api-demo`
- U-227 — graph-ir.json large compiled artifact at drift risk — `@rntme/issue-tracker-api-demo`
- U-228 — vitest.config.ts forces sequential execution unnecessarily — `@rntme/issue-tracker-api-demo`
- U-229 — Inconsistent e2e boot path between gRPC and other tests — `@rntme/issue-tracker-api-demo`
- U-230 — Local type stubs duplicated in derived-projection.test.ts — `@rntme/issue-tracker-api-demo`
- U-231 — KNOWN_ISSUES.md is a zombie file — `@rntme/issue-tracker-api-demo`
- U-232 — Missing lint script in package.json — `@rntme/issue-tracker-api-demo`
- U-233 — ui.json duplicates ui/ directory tree — `@rntme/issue-tracker-api-demo`
- U-234 — Dockerfile hardcodes runtime image version without update automation — `@rntme/issue-tracker-api-demo`
- U-250 — No README or onboarding documentation — `@rntme/pre-step-demo`
- U-251 — Missing failure-scenario tests for pre-step middleware — `@rntme/pre-step-demo`
- U-252 — Fake module does not implement module contract — `@rntme/pre-step-demo`
- U-253 — No seed.json — demo starts with empty state — `@rntme/pre-step-demo`
- U-254 — Duplicated test setup — no shared helper — `@rntme/pre-step-demo`
- U-255 — Hardcoded network configuration without config surface — `@rntme/pre-step-demo`
- U-256 — Fake module ignores idempotency key — `@rntme/pre-step-demo`
- U-257 — Arbitrary sleep in test — flakiness — `@rntme/pre-step-demo`
- U-258 — Missing lint script in package.json — `@rntme/pre-step-demo`
- U-259 — Empty shapes.json — dead artifact — `@rntme/pre-step-demo`
- U-260 — Empty UI artifacts in artifacts/ui/ — `@rntme/pre-step-demo`
- U-261 — Known artifact drifts deferred from ultrareview-fixes — `@rntme/pre-step-demo`
- U-262 — No Dockerfile — `@rntme/pre-step-demo`

### Trigger: second service appears in workspace

- U-013 — Demo packages have no exports or main fields — `monorepo`
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
- U-068 — init silently ignores --org and --project flags — `@rntme-cli/cli`
- U-069 — Cursor adapter throws instead of returning Result — `@rntme-cli/cli`
- U-070 — No validate command in dispatcher despite user expectations — `@rntme-cli/cli`
- U-074 — Redundant guard in plan.ts errors check — `@rntme-cli/deploy-core`
- U-075 — DeploymentPlanError lacks per-code type safety — `@rntme-cli/deploy-core`
- U-076 — passWithNoTests enabled in vitest.config.ts — `@rntme-cli/deploy-core`
- U-077 — No runtime validation of input data to plan builder — `@rntme-cli/deploy-core`
- U-088 — README references nonexistent spec file — `@rntme-cli/deploy-dokploy`
- U-089 — Package version stuck at 0.0.0 prevents semver tracking — `@rntme-cli/deploy-dokploy`
- U-090 — No integration tests against real Dokploy client factory — `@rntme-cli/deploy-dokploy`
- U-097 — Missing automated accessibility check — `@rntme-cli/landing`
- U-098 — Missing sitemap and structured data — `@rntme-cli/landing`
- U-099 — .impeccable.md references missing SHAPE-BRIEF.md — `@rntme-cli/landing`
- U-100 — package.json version 0.0.0 is meaningless — `@rntme-cli/landing`
- U-108 — README links to spec documents not present in repository — `@rntme-cli/platform-core`
- U-109 — BlobStore in domain package contains presignedGet infra detail — `@rntme-cli/platform-core`
- U-110 — ./testing subpath exports only fakes.ts — `@rntme-cli/platform-core`
- U-126 — index.ts exposes effectively empty public API — `@rntme-cli/platform-http`
- U-127 — E2E tests silently skip without Docker — `@rntme-cli/platform-http`
- U-128 — Critical middleware lack unit tests — `@rntme-cli/platform-http`
- U-129 — Hardcoded version and deploy mode — `@rntme-cli/platform-http`
- U-130 — workos-client.ts uses unsafe type cast hack — `@rntme-cli/platform-http`
- U-139 — Missing dedicated tests for PgProjectVersionRepo and PgAuditRepo — `@rntme-cli/platform-storage`
- U-140 — resetSchema in test harness hardcodes table list — `@rntme-cli/platform-storage`
- U-141 — platform-storage publicly exports Drizzle schemas (ORM coupling) — `@rntme-cli/platform-storage`
- U-146 — test:watch runs build:deps unnecessarily — `@rntme/conformance-ai-llm`
- U-147 — Dead fallback path in resolution logic — `@rntme/conformance-ai-llm`
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
- U-201 — Error code inconsistency in manifest validation — `@rntme/db-studio`
- U-202 — encodeValue coerces arbitrary objects to strings — `@rntme/db-studio`
- U-203 — VERSION constant is hardcoded to '0.0.0' — `@rntme/db-studio`
- U-204 — README doesn't document StudioLogger — `@rntme/db-studio`
- U-205 — mountPath trailing slash not validated — `@rntme/db-studio`
- U-211 — No coverage reporting — `@rntme/event-store`
- U-212 — getDbHandle() is a footgun for db-studio — `@rntme/event-store`
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
- U-012 — 3 packages missing description in package.json — `monorepo`
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
- U-063 — skills install bypasses harness pattern — `@rntme-cli/cli`
- U-064 — Version pinned to 0.0.0 in package.json and client — `@rntme-cli/cli`
- U-065 — Insufficient test coverage across commands — `@rntme-cli/cli`
- U-066 — postbuild script uses fragile relative paths — `@rntme-cli/cli`
- U-071 — Code duplication in edge.ts middleware dispatch — `@rntme-cli/deploy-core`
- U-072 — Dead zod dependency in package.json — `@rntme-cli/deploy-core`
- U-073 — Insufficient unit test coverage for middleware kinds and edge cases — `@rntme-cli/deploy-core`
- U-083 — No validation of publicBaseUrl and endpoint in DokployTargetConfig — `@rntme-cli/deploy-dokploy`
- U-084 — Result helpers re-exported from local copy duplicates deploy-core — `@rntme-cli/deploy-dokploy`
- U-086 — assertNever in render.ts throws plain Error breaking Result contract — `@rntme-cli/deploy-dokploy`
- U-094 — loadEnv() called at module level in 6+ components — `@rntme-cli/landing`
- U-095 — Dead code in src/components/ — `@rntme-cli/landing`
- U-096 — CONTENT.md is a manual copy of components — `@rntme-cli/landing`
- U-104 — MembershipMirrorSchema role uses raw string instead of RoleSchema — `@rntme-cli/platform-core`
- U-106 — Version 0.0.0 with no change-management mechanism — `@rntme-cli/platform-core`
- U-107 — No coverage configuration in vitest — `@rntme-cli/platform-core`
- U-118 — Auth providers created twice for API and UI — `@rntme-cli/platform-http`
- U-119 — withOrgTx duplicated between prod and tests — `@rntme-cli/platform-http`
- U-120 — Inconsistent poolRepos types in AppDeps vs UiDeps — `@rntme-cli/platform-http`
- U-121 — ops ready-check breaks on some WorkOS plans — `@rntme-cli/platform-http`
- U-124 — UI routes lack query/path param validation — `@rntme-cli/platform-http`
- U-125 — tsconfig vs tsconfig.check inconsistent on tests — `@rntme-cli/platform-http`
- U-133 — Inconsistent choice of Drizzle vs raw SQL across repos — `@rntme-cli/platform-storage`
- U-134 — RLS test coverage gap for identity repositories — `@rntme-cli/platform-storage`
- U-135 — Schema drift between drizzle migration and runtime policies.sql — `@rntme-cli/platform-storage`
- U-136 — S3BlobStore uses single error code for all operations — `@rntme-cli/platform-storage`
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
- U-197 — applyRowCap regex is brittle for nested LIMITs — `@rntme/db-studio`
- U-198 — StudioLogger interface is defined but never wired from runtime — `@rntme/db-studio`
- U-199 — Missing test coverage for END keyword in transaction rejection — `@rntme/db-studio`
- U-200 — No e2e test for :memory: mode in the demo — `@rntme/db-studio`
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
- U-293 — crossValidateDerivedProjections passes unvalidated raw artifacts to compiler — `@rntme/runtime`
- U-294 — Dockerfile inflates build context with demo/ — `@rntme/runtime`
- U-295 — ProtoRegistry silently ignores multiple services per proto file — `@rntme/runtime`
- U-296 — Surface interface inconsistency between mount and listen — `@rntme/runtime`
- U-297 — GraphIrCommandExecutor.mapError loses stack traces — `@rntme/runtime`
- U-298 — applyEnvOverrides uses different error accumulation pattern than validateManifest — `@rntme/runtime`
- U-299 — InMemoryBus ignores consumer topic parameter — `@rntme/runtime`
- U-309 — isAlreadyWrapped fragile check (rigid 2-key length) — `@rntme/seed`
- U-311 — validateSeed uses randomUUID() — non-deterministic for tests — `@rntme/seed`
- U-312 — SEED_SYNTAX_INVALID misused for missing serviceName (wrong layer) — `@rntme/seed`
- U-313 — Missing negative test for SEED_APPLY_IO error path — `@rntme/seed`
- U-314 — Spec §4.1 field names drift from CloudEvents-aligned implementation — `@rntme/seed`
- U-325 — resolveComponent is dead surface area — `@rntme/ui`
- U-326 — No binding-kind mismatch check — `@rntme/ui`
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
- U-355 — createBindingsRouter throws raw Error instead of Result<T> — `@rntme/bindings-http`
- U-356 — runInit also bypasses harness pattern (sibling of U-063) — `@rntme-cli/cli`
- U-357 — tsconfig.json excludes test/ but tsconfig.check.json includes it — `@rntme/db-studio`
- U-359 — U-147 fallback path is functional, not dead — `@rntme/conformance-ai-llm`
- U-360 — U-146 confirmed: test:watch chains build:deps in ai-llm only — `@rntme/conformance-ai-llm`
- U-361 — U-148 confirmed: fixtures runtime-import proto enum — `@rntme/conformance-ai-llm`
- U-362 — common v1 src/index.ts re-exports proto namespace only — no named primitive re-exports — `@rntme/contracts-common-v1`
- U-363 — actor_kind column has no CHECK constraint; only read-side validation — `@rntme/event-store`
- U-364 — STRUCT_DUPLICATE_GRAPH_ID overloaded for graphId-not-found case in compileProjectionGraph — `@rntme/graph-ir-compiler`
- U-365 — U-239 evidence inaccuracy: mkCtx() is duplicated in 2 test files, not 3 — `@rntme/module-skeleton`
- U-366 — applyEvent return type is readonly ApplyResult[] but consumer ignores results — `@rntme/projection-consumer`


---

## Track REJECTED

False positives, outdated findings, and merged duplicates.

- U-001 — `monorepo` — RNT-230#B1 — [verify-systemic] submodule populated at 01c7c1a as of 2026-04-28
- U-060 — `@rntme-cli/cli` — RNT-224#1 —
- U-061 — `@rntme-cli/cli` — RNT-224#2 —
- U-062 — `@rntme-cli/cli` — RNT-224#3 —
- U-067 — `@rntme-cli/cli` — RNT-224#8 —
- U-082 — `@rntme-cli/deploy-dokploy` — RNT-226#5 —
- U-085 — `@rntme-cli/deploy-dokploy` — RNT-226#8 —
- U-101 — `@rntme-cli/platform-core` — RNT-227#1 —
- U-105 — `@rntme-cli/platform-core` — RNT-227#5 —
- U-217 — `@rntme/graph-ir-compiler` — RNT-205#3 —
- U-310 — `@rntme/seed` — RNT-211#6 —


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
