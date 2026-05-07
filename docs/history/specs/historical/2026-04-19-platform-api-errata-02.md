> Status: historical.
> Date: 2026-04-19.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# Platform API — Errata 02 (follow-up to fix-01 code review)

**Status:** errata
**Supersedes nothing.** Patches `2026-04-19-platform-api-errata-01.md` §3.2, §3.7, §5.
**Related:** `docs/history/plans/historical/2026-04-19-platform-api-fix-02.md` (implementation).

A fresh post-landing code review of the 10 fix-01 commits (`rntme-cli` branch `feat/platform-api-fix-01`) surfaced three production regressions that the fix-01 plan itself introduced but did not close. Integration/e2e tests skip locally (Docker unavailable in the authoring environment) and CI would have caught these, but the branch was left in a pre-push state. This errata enumerates the corrections.

---

## 1. `api_token` and `membership_mirror` must not be under FORCE ROW LEVEL SECURITY

### Problem

Commit 1 added `FORCE ROW LEVEL SECURITY` to eight tenant tables, including `api_token` and `membership_mirror`. Commit 3 opened per-request `SET LOCAL app.org_id` transactions only for the *authed* Hono sub-app. That leaves three pre-auth paths broken once migrations land:

1. `ApiTokenProvider.findByPrefix` runs on the bare `Pool` (no SET LOCAL) — every API-token request returns 0 rows and the provider emits 401.
2. `ApiTokenProvider.touchLastUsed` — fire-and-forget UPDATE silently rejected by WITH CHECK; `last_used_at` never advances.
3. `syncWorkosEvent` `organization_membership.created` / `.deleted` branches — INSERT/DELETE on `membership_mirror` rejected by WITH CHECK; webhook deliveries quietly drop membership sync.

The owner role in production is also subject to FORCE RLS (invariant 3 in errata-01 §5), so the prod `DATABASE_URL` role hits the same wall.

### Correction

Drop `FORCE ROW LEVEL SECURITY` from `api_token` and `membership_mirror` in `packages/platform-storage/src/sql/policies.sql`. Leave `ENABLE ROW LEVEL SECURITY` and the existing `tenant_isolation_*` policies in place — non-owner roles (if any) still get the benefit; the owner bypasses per default PostgreSQL semantics.

Justification:
- `api_token` is already unique-scoped by `prefix` + constant-time hash match in the application layer. The pre-auth lookup is by design unauthenticated; FORCE RLS on this table is incompatible with password authentication itself.
- `membership_mirror` is written from pre-auth webhooks before any session exists. Wrapping every webhook branch in `withTransaction(pool, orgId, …)` would be a larger change; dropping FORCE is the minimum viable correction, consistent with the errata-01 principle "FORCE applies to tables the *authed* request path reads."

### Acceptance

- `SELECT * FROM api_token WHERE prefix = ?` on the bare owner pool returns rows (no RLS rejection).
- Commit 1's `rls-enforcement.test.ts` invariants 1 and 2 still pass against the six remaining FORCE tables (`project`, `service`, `artifact_version`, `artifact_tag`, `audit_log`, `event_outbox`).
- E2E suite (agent-workflow, tenant-isolation, validation-gate) passes under Docker.

---

## 2. `roles.sql` must not create a login role with a hard-coded password in production

### Problem

Commit 1 unconditionally runs `packages/platform-storage/src/sql/roles.sql` via `runMigrations` on every boot. The SQL creates `CREATE ROLE platform_app LOGIN PASSWORD 'platform_app'`. If the prod `DATABASE_URL` role has `CREATEROLE`, this provisions a DB login with a publicly-known password in every deploy.

### Correction

In `packages/platform-storage/src/migrate.ts`, guard the `roles.sql` execution behind an env flag `PLATFORM_CREATE_ROLES=1`. Default: **skip**. Integration/e2e test harnesses set the flag; production does not (role is pre-provisioned by the DBA with a real secret).

### Acceptance

- `runMigrations(db, pool)` without `PLATFORM_CREATE_ROLES=1` does not execute `roles.sql`; Drizzle migrations and `policies.sql` still run.
- Integration test harness (`packages/platform-storage/test/integration/harness.ts`) sets `PLATFORM_CREATE_ROLES=1` explicitly before calling `runMigrations`, and the `platform_app` pool continues to work for RLS tests.

---

## 3. Auth providers must not silently downgrade to `member` when membership is absent

### Problem

Commit 9 fixed `if (!isOk(mem)) return mem;` — propagating storage errors. But both `WorkOSAuthKitProvider` and `ApiTokenProvider` still do `mem.value?.role === 'admin' ? 'admin' : 'member'`. When membership is null (the account is not a member of the resolved org), the provider grants `member` scopes silently — exactly the concern Errata-01 Important 16 aimed to close.

### Correction

Both providers: when `mem.value === null`, return `err([{ code: 'PLATFORM_AUTH_INVALID', message: 'account not a member of organization' }])`. The error code already exists in the registry.

### Acceptance

- Unit test: provider stub returns `{ ok: true, value: null }` from `memberships.find` → `provider.authenticate(...)` returns `{ ok: false }` with the `PLATFORM_AUTH_INVALID` code.
- Happy-path tests (admin + member) continue to pass.

---

## Out of scope for errata-02

Tracked for a future errata pass:

- `requireAuth` middleware collapses `PLATFORM_STORAGE_DB_UNAVAILABLE` → 401 `PLATFORM_AUTH_MISSING` (should be 503). Pre-existing bug, not a fix-01 regression.
- `archiveOrgCascade` not truly idempotent (`archive()` overwrites `archived_at` on re-run). Protected by atomic claim in the `org.deleted` path, latent for direct callers.
- `bodyLimit` drain has no per-chunk timeout (slowloris window). Defense-in-depth gap.
- `auth-me.test.ts` is a tautology — does not exercise the real mount.
- `/ready` treats `listApiKeys === undefined` (SDK method missing) as healthy.
