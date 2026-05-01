> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# Platform API — Errata 01

**Date:** 2026-04-19 (same day; fix batch after post-landing code review)
**Supersedes portions of:** `2026-04-19-platform-api-design.md`, `docs/superpowers/plans/done/2026-04-19-platform-api.md`
**Scope:** corrections landed in submodule `rntme-cli/` under packages `platform-core`, `platform-storage`, `platform-http`.

## 1. Why this errata exists

Post-landing code review of the Platform API (M1) found that parts of the implementation silently diverged from design-spec invariants. The most consequential drift: the per-request RLS scoping required by spec §5.5 was not wired up — row-level security was present in DDL but never activated by the runtime. A handful of smaller drifts (schema, error registry, rate-limit docs) rode along.

This document lists every correction landed in fix batch 01. It is the authoritative statement of the truth as of end-of-day 2026-04-19. The original spec and original plan are left intact as historical artifacts.

## 2. What drifted

### 2.1 Plan J3 dropped the spec §5.5 RLS middleware invariant

Spec §5.5 requires: *"Middleware sets `SET LOCAL app.org_id = '<caller-org-id>'` after authentication. Fail-closed by construction."*

Plan task J3 (`auth middleware that orchestrates providers + sets RLS`) mentioned the task title but its reference implementation ran on the raw pool without ever opening a transaction or issuing `SET LOCAL`. The implementation followed the plan literally. Result: RLS policies exist in the database but are never activated — isolation is carried entirely by app-layer `WHERE org_id = ?` clauses.

### 2.2 Migration never forced RLS on the table owner

`policies.sql` used `ENABLE ROW LEVEL SECURITY` but not `FORCE ROW LEVEL SECURITY`. Migrations are executed by the same role that later serves traffic, so even if §5.5 were implemented, the role would bypass RLS as the table owner. The e2e `tenant-isolation` test therefore passed for the wrong reason (app-layer filters, not RLS).

### 2.3 Error-code registry gap

Two codes were introduced by the implementation but not listed in spec §9.2:
- `PLATFORM_CONFLICT_SLUG_TAKEN` — emitted on slug-uniqueness violations.
- `PLATFORM_TENANCY_VERSION_NOT_FOUND` — needs to exist but isn't used; `tags.moveTag` currently returns `PLATFORM_TENANCY_SERVICE_NOT_FOUND` when the *version* is missing. Wrong code.

### 2.4 Schema gap: no `organization.archived_at`

Spec §8.5 mandates a cascade on `organization.deleted` (archive projects, revoke tokens). Implementation tried to `DELETE FROM organization WHERE id = $1`, which cannot succeed because every tenant-scoped table has a `NOT NULL FK` on `organization.id` without `ON DELETE CASCADE`. The spec §5.2 schema section did not mention a soft-archive column; it should have.

### 2.5 Body-size caps absent from spec §14

Spec §14 mentions a 10 MiB publish body cap informally. The hard values (10 MiB for publish, 1 MiB for other POSTs) are not documented in machine-checkable form, and no body-limit middleware exists.

### 2.6 Miscellany surfaced in review

- `publish-version.ts` computed blob digests over canonical-json but uploaded `JSON.stringify(body)` — stored bytes don't re-hash to the stored digest (spec §6 violation).
- `PgOrganizationRepo.upsertFromWorkos` let WorkOS dashboard renames mutate `slug` in place, violating the spec §7 "slug immutable" invariant.
- `routes/auth.ts` callback path fabricated an org slug from the raw WorkOS id (e.g. `org-01jb…`) and used the id as `displayName`. Combined with the slug-immutable rule, those ugly values would be locked in forever.
- `PLATFORM_COOKIE_PASSWORD` was optional in env config with an insecure `padEnd(32, 'x')` fallback in `bin/server.ts`.

## 3. Corrections

### 3.1 RLS pattern (replaces plan J3 guidance)

Every authenticated request runs inside one transaction. After authentication resolves the caller's `org_id`, middleware:

1. `pool.connect()` → PoolClient.
2. `BEGIN`.
3. `SET LOCAL app.org_id = '<org-id>'`.
4. Stash the client in Hono context under `c.set('tx', client)`.
5. Run the handler. On success: `COMMIT`. On thrown error: `ROLLBACK`. Always `client.release()` in `finally`.

Repositories are constructed *per request* from the tx-scoped client:
```ts
const tx = c.get('tx');
const deps = resolveDeps(tx);   // returns { projects, services, versions, tags, tokens, audit, outbox }
```
Every `Pg*Repo` constructor takes a `PoolClient`. Repos never hold a `Pool`. `runMigrations` runs raw DDL directly against a one-off `pool.query` call; it does not instantiate repos.

The existing `publish` path keeps its advisory-lock behaviour but runs it on the already-opened request client; it no longer opens a second TX. `withTransaction`'s role shrinks to "open request-level TX" inside the middleware.

Default isolation is `READ COMMITTED`. RLS enforcement does not require snapshot isolation.

### 3.2 Postgres role model

Migration creates two roles:

| Role | Purpose | RLS |
| --- | --- | --- |
| `platform_owner` | DDL; `runMigrations` connects as this role | `FORCE RLS` means queries are subject to policies even for the owner |
| `platform_app` | Runtime pool connects as this role | Normal `ENABLE RLS` applies |

Every tenant-scoped policy is written with both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Role creation in the migration is idempotent (`DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`). The `platform_app` role receives `SELECT, INSERT, UPDATE, DELETE` on every tenant-scoped table.

### 3.3 Schema addition — `organization.archived_at`

```sql
ALTER TABLE organization ADD COLUMN archived_at timestamptz;
```

`PgOrganizationRepo.archive` changes from `DELETE` to `UPDATE organization SET archived_at = now() WHERE id = $1`. Archived orgs are excluded from `findById` / `findBySlug` unless a new `includeArchived: true` option is passed (used only by the cascade path itself). All authenticated requests for an archived org return `PLATFORM_TENANCY_ORG_NOT_FOUND`.

### 3.4 `workos-sync.organization.deleted` cascade

Runs in a single transaction with the following order (last step depends on the first two being durable):

1. `UPDATE organization SET archived_at = now()`.
2. `UPDATE project SET archived_at = now() WHERE org_id = $1 AND archived_at IS NULL`.
3. `UPDATE api_token SET revoked_at = now() WHERE org_id = $1 AND revoked_at IS NULL`.

The whole block is wrapped so that concurrent `organization.deleted` deliveries cannot double-revoke (the `INSERT … ON CONFLICT DO NOTHING RETURNING` idempotency check runs first; the cascade only runs if the insert actually took the row).

### 3.5 Slug immutability restored

`PgOrganizationRepo.upsertFromWorkos` drops `slug` from its `onConflictDoUpdate` set. The conflict branch updates only `displayName` and `updatedAt`.

### 3.6 Canonical upload on publish

`use-cases/publish-version.ts` uploads `Buffer.from(canonicalize(body), 'utf8')`, not `JSON.stringify(body)`. A unit test asserts `sha256Hex(uploadedBytes) === blobKey.digest` so the stored bytes always re-hash to the stored digest.

### 3.7 Auth callback uses real WorkOS org data

If a login arrives for an org that hasn't been mirrored yet, the callback fetches the authoritative record via `workos.organizations.getOrganization(orgId)` and seeds the mirror with the real `name`. A sanitized slug is derived from the name (lowercase, `[^a-z0-9-]` → `-`, trimmed to 40 chars). On slug collision, a short numeric suffix is appended. Only after the mirror row exists does the callback finish.

### 3.8 Body-size limits

Hono `bodyLimit` middleware enforces:
- `POST /v1/orgs/:slug/projects/:projectSlug/services/:serviceSlug/versions` → 10 MiB.
- All other POSTs → 1 MiB.

The limiter is mounted before Zod parse and before auth (DoS protection should not depend on auth).

### 3.9 Env hardening

`PLATFORM_COOKIE_PASSWORD` becomes required (Zod `.min(32)`) and the `padEnd(32, 'x')` fallback in `bin/server.ts` is deleted. Missing or short values cause `parseEnv` to fail at boot.

### 3.10 Cheap Important items bundled in this fix

- **I9** `/v1/auth/me` moves into the `authed` sub-app (currently mounted at `/v1/auth` before `requireAuth`, so it always returns 401).
- **I16** `WorkOSAuthKitProvider` propagates membership-lookup errors instead of silently defaulting to role `'member'` on DB failure.
- **I17** `/ready` sets `workos: false` in its error branch (currently `true` on catch).
- **I19** `use-cases/tags.moveTag` returns `PLATFORM_TENANCY_VERSION_NOT_FOUND` when the target version is missing.
- **I21** `FakeStore` removed from the `platform-core` public barrel; tests import from `../testing/fakes.js` directly.

## 4. Error-code registry amendment to §9.2

Appended (order preserves append-only contract):

| Code | Emitted when |
| --- | --- |
| `PLATFORM_CONFLICT_SLUG_TAKEN` | A `create*` use-case hits the slug-uniqueness constraint |
| `PLATFORM_TENANCY_VERSION_NOT_FOUND` | A tag-move or version-read references a `versionId` absent from the service |

## 5. Canonical test invariants

A new file `rntme-cli/packages/platform-storage/test/integration/rls-enforcement.test.ts` must assert three invariants. These tests are the contractual definition of "RLS is active":

1. **Cross-org isolation is RLS-driven.** Connect as `platform_app`, seed two orgs A and B, `SET LOCAL app.org_id = '<A-id>'`, run `SELECT * FROM project` with no `WHERE` clause → only org-A rows returned.
2. **Missing scope is fail-closed.** Connect as `platform_app`, open TX, skip `SET LOCAL`, run the same `SELECT` → zero rows.
3. **Owner is also forced.** Connect as `platform_owner`, skip `SET LOCAL`, run the same `SELECT` → zero rows (proves `FORCE RLS` is in effect).

The existing `test/e2e/tenant-isolation.test.ts` is rewired to open its pool as `platform_app` instead of `platform_owner`, so it actually exercises RLS going forward.

## 6. Deferred to fix-02

The following review findings are acknowledged but intentionally not in this batch:

- **I10** OpenAPI emission from Zod schemas (currently a 30-line hand-stub).
- **I11** Per-endpoint publish rate limit (spec §8.3 / §14, 100/hr/token).
- **I12** Blob-upload retry with exponential backoff.
- **I13** `syncWorkosEvent` idempotency via `INSERT … ON CONFLICT DO NOTHING RETURNING` is applied *only* to `organization.deleted` in fix-01 (as part of the cascade). The other WorkOS event handlers (`organization.created`, membership events) still use the pre-check shape and remain vulnerable to concurrent double-apply until fix-02.
- **I14** Audit-log wiring across every use-case (project/service create+archive, token create+revoke, tag delete, member sync).
- **I18** `validationSnapshot` threaded from real `@rntme/*` package versions instead of hardcoded `0.0.0`.
- **I20** Per-field body caps inside `bundle.*` after the outer `bodyLimit` lets the payload through.
- **I22** Property-based tests (fast-check is declared but unused).
- **I23** Unit tests for routes: tokens, audit, orgs, ops; middleware: requestId, logger, cors.
- **I24** Multi-org switch flow in `/v1/auth/me` and `/v1/orgs` paths.
- All **Minor** findings.

These are tracked for a later plan; they do not block fix-01 from landing.

## 7. How this errata is applied

- One follow-up implementation plan (`docs/superpowers/plans/done/2026-04-19-platform-api-fix-01.md`) enumerates the 10 submodule commits plus the main-repo submodule bump.
- The plan references section numbers from this errata, not from the original design doc, wherever they differ.
- After fix-01 lands, a brief paragraph is added to the original design doc's preface pointing at this errata. The original design doc is otherwise not edited.
