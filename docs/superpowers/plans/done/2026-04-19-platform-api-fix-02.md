> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# Platform API Fix-02 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or equivalent to implement this plan. Steps use `- [ ]` checkbox syntax.

**Goal:** Apply the three corrections in `docs/superpowers/specs/done/2026-04-19-platform-api-errata-02.md` as a single submodule commit (the patch is tight) plus one main-repo commit (submodule pointer bump).

**Spec:** `docs/superpowers/specs/done/2026-04-19-platform-api-errata-02.md` §1–§3.

**Architecture:** One submodule commit combining (a) `policies.sql` edit dropping FORCE from `api_token` and `membership_mirror`, (b) `migrate.ts` gating `roles.sql` behind `PLATFORM_CREATE_ROLES=1`, (c) both auth providers returning `PLATFORM_AUTH_INVALID` when membership is null. Plus one main-repo commit bumping the submodule pointer.

**Tech stack:** unchanged from fix-01.

**Order:** strict: tests → code → commit. Within the commit, the three items are independent but land together — reviewer asked for one focused hotfix.

---

## Commit 1 — fix-02 hotfix (all three errata-02 items)

### Task 1.1 — Drop FORCE from `api_token` and `membership_mirror`

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/sql/policies.sql`

- [ ] **Step 1:** Remove the two `ALTER TABLE … FORCE ROW LEVEL SECURITY` lines for `api_token` and `membership_mirror`. Keep the paired `ENABLE ROW LEVEL SECURITY` lines and the policy block intact.

### Task 1.2 — Gate `roles.sql` behind env flag

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/migrate.ts`
- Modify: `rntme-cli/packages/platform-storage/test/integration/harness.ts` (set flag before `runMigrations`)

- [ ] **Step 1:** In `migrate.ts`, wrap the `roles.sql` read + execute in `if (process.env.PLATFORM_CREATE_ROLES === '1') { … }`. Leave the Drizzle migrator + `policies.sql` path unchanged.

- [ ] **Step 2:** In `harness.ts`, set `process.env.PLATFORM_CREATE_ROLES = '1'` at the top of `startPostgres()` (before `runMigrations`). This keeps the integration tests' `platform_app` path working.

### Task 1.3 — Auth providers return PLATFORM_AUTH_INVALID on null membership

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/auth/workos-provider.ts`
- Modify: `rntme-cli/packages/platform-http/src/auth/api-token-provider.ts`
- Modify: `rntme-cli/packages/platform-http/test/unit/auth/workos-provider.test.ts` (add failing test)
- Modify or create: `rntme-cli/packages/platform-http/test/unit/auth/api-token-provider.test.ts` (add failing test)

- [ ] **Step 1:** Failing test for `WorkOSAuthKitProvider` — stub memberships.find to return `{ ok: true, value: null }`, expect `provider.authenticate(...)` to return `{ ok: false }` with code `PLATFORM_AUTH_INVALID`. Confirm red.

- [ ] **Step 2:** Same failing test for `ApiTokenProvider`.

- [ ] **Step 3:** In each provider, where the role resolution currently does:

```ts
const mem = await this.deps.memberships.find(org.value.id, acct.value.id);
if (!isOk(mem)) return mem;
const role: Role = mem.value?.role === 'admin' ? 'admin' : 'member';
```

Change to:

```ts
const mem = await this.deps.memberships.find(org.value.id, acct.value.id);
if (!isOk(mem)) return mem;
if (!mem.value) return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'account not a member of organization' }]);
const role: Role = mem.value.role === 'admin' ? 'admin' : 'member';
```

- [ ] **Step 4:** Re-run both tests — green.

### Task 1.4 — Full-submodule verification

Run:
- `pnpm -C rntme-cli -r typecheck`
- `pnpm -C rntme-cli -r lint`
- `pnpm -C rntme-cli -r test`

All green (integration/e2e skip on no-Docker).

### Task 1.5 — Commit

```bash
git -C rntme-cli add packages/platform-storage/src/sql/policies.sql \
  packages/platform-storage/src/migrate.ts \
  packages/platform-storage/test/integration/harness.ts \
  packages/platform-http/src/auth/workos-provider.ts \
  packages/platform-http/src/auth/api-token-provider.ts \
  packages/platform-http/test/unit/auth/workos-provider.test.ts \
  packages/platform-http/test/unit/auth/api-token-provider.test.ts

git -C rntme-cli commit -m "fix: errata-02 hotfix (policies/roles/auth providers)

Drops FORCE RLS from api_token + membership_mirror (pre-auth callers
can't SET LOCAL app.org_id and would 401 every API-token request +
silently drop every membership webhook). Gates roles.sql behind
PLATFORM_CREATE_ROLES=1 so prod doesn't ship a login role with a
known password. Both auth providers now return PLATFORM_AUTH_INVALID
when the account is not a member of the resolved org (closes the last
silent-downgrade path).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Main-repo commit — submodule pointer bump

### Task M.1 — Bump pointer

- [ ] **Step 1:** From main repo root: `git add rntme-cli && git commit` with message:

```
chore: bump rntme-cli submodule (platform-api fix-02 hotfix)

Lands errata-02 in the submodule: drops FORCE RLS from api_token and
membership_mirror, gates roles.sql behind PLATFORM_CREATE_ROLES=1,
and fixes the last silent-downgrade path in both auth providers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Verification gate

```bash
# In submodule
pnpm -C rntme-cli -r typecheck
pnpm -C rntme-cli -r lint
pnpm -C rntme-cli -r test

# In main repo
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```
