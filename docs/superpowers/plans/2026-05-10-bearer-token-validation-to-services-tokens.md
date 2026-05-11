# Move Bearer-Token Validation into services/tokens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `apps/platform-http/src/auth/api-token-provider.ts` into a token-introspection use case that lives in `@rntme/platform-core` and a thin native handler in the `services/tokens` blueprint folder, then rewire platform-http's auth chain to consume it. After this plan lands, the bearer-token validation algorithm has exactly one home and `services/tokens` declares an `IntrospectToken` operation that future cross-service-call wiring (plan 6) can dispatch to.

**Architecture:** Two homes for the logic, one home for the algorithm. `@rntme/platform-core/src/use-cases/tokens.ts` gains a pure `introspectToken({ deps, input })` function — the canonical algorithm (prefix lookup, constant-time hash compare, expiry/revoke check, membership lookup, `lastUsedAt` touch, `AuthSubject` assembly). `@rntme/platform-core/src/auth/api-token-provider.ts` (newly relocated) is an `IdentityProvider` shim that adapts the use case to the `AuthContext`-based provider chain. `apps/platform/blueprint/services/tokens/handlers/introspect-token.ts` is a native-handler stub that wraps the same use case for the future `services/tokens.IntrospectToken` operation. `apps/platform/blueprint/services/tokens/operations.json` declares the operation contract (input/output/handler entry). `apps/platform-http` imports `ApiTokenProvider` from `@rntme/platform-core`; the local `apps/platform-http/src/auth/api-token-provider.ts` (and its test) are deleted.

**Out of scope for this plan:** Wiring the runtime `OperationCallClient` to dispatch `target: { service: 'tokens', operation: 'IntrospectToken' }` to the native handler. That is plan 6 territory because the runtime auth chain only matters once `apps/platform-http` is deleted; until then platform-http calls the use case directly.

**Tech Stack:** Bun 1.1, TypeScript, Hono, Node `crypto`, Vitest/Bun test runners, `@rntme/platform-core` Result types.

---

## Scope and Dependencies

This plan is plan 5 of 6 in `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`.

**Requires:** none of plans 1–4 strictly. Plan 1 (`@rntme/deploy-runner`) and plan 4 (`@rntme/bindings-http` middleware lift) have already landed in `main`; plan 2 (CLI direct-mode) and plan 3 (BPMN-orchestrated deploy) are independent.

**Does not block:** plan 6 (`apps/platform-http` deletion). Plan 6 will wire the runtime's `OperationCallClient` to dispatch `services/tokens.IntrospectToken` calls to the native handler this plan introduces, then mount the auth chain in the runtime so the platform blueprint can validate bearers without platform-http present.

## File Structure

```
packages/platform/platform-core/src/
  use-cases/tokens.ts            MODIFY — add introspectToken({deps,input}) function
  auth/api-token-provider.ts     NEW — moved from apps/platform-http; thin shim around introspectToken
  auth/index.ts                  MODIFY — export ApiTokenProvider from new path (or extend index.ts)
  index.ts                       MODIFY — re-export ApiTokenProvider + introspectToken types

packages/platform/platform-core/test/unit/
  use-cases/tokens-introspect.test.ts   NEW — TDD tests for introspectToken
  auth/api-token-provider.test.ts       NEW — moved from apps/platform-http; thin re-test of provider shim

apps/platform-http/src/
  app.ts                         MODIFY — import ApiTokenProvider from @rntme/platform-core
  ui/app.tsx                     MODIFY — import ApiTokenProvider from @rntme/platform-core
  auth/api-token-provider.ts     DELETE — moved

apps/platform-http/test/unit/auth/
  api-token-provider.test.ts     DELETE — moved to platform-core

apps/platform/blueprint/services/tokens/
  handlers/introspect-token.ts   NEW — native handler stub wrapping platform-core use case
  operations.json                NEW — declares IntrospectToken operation contract

apps/platform/blueprint/test/
  platform-tokens.test.ts        NEW — asserts handler+operations.json load and validate

docs/current/owners/apps/
  platform-http.md               MODIFY — note the auth provider now lives in @rntme/platform-core
docs/current/owners/packages/platform/
  platform-core.md               MODIFY — document introspectToken use case + ApiTokenProvider relocation
```

Each task makes self-contained changes. Follow them in order.

---

## Task 1: Add `introspectToken` use case to `@rntme/platform-core`

**Files:**
- Modify: `packages/platform/platform-core/src/use-cases/tokens.ts`
- Create: `packages/platform/platform-core/test/unit/use-cases/tokens-introspect.test.ts`

The use case is a pure function: `introspectToken({ deps, input }) → Result<AuthSubject, PlatformError>`. It encapsulates the algorithm currently inlined in `apps/platform-http/src/auth/api-token-provider.ts:28-94`: parse Bearer prefix, lookup by prefix, compare hash with `timingSafeEqual`, check `revokedAt`/`expiresAt`, fetch org, fetch account (with `deletedAt` guard), fetch membership, build `AuthSubject`, fire-and-forget `touchLastUsed`.

- [ ] **Step 1: Write the failing test for the happy path**

Create `packages/platform/platform-core/test/unit/use-cases/tokens-introspect.test.ts`:

```ts
import { describe, it, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { isOk } from '../../../src/types/result.js';
import { introspectToken } from '../../../src/use-cases/tokens.js';
import { FakeStore } from '../../../src/testing/fakes.js';

async function setup() {
  const store = new FakeStore();
  const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u', email: null, displayName: 'U' });
  await store.membershipMirror.upsert({ orgId: org.id, accountId: acct.id, role: 'member' });
  const plain = 'rntme_pat_' + 'a'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await store.tokensRepo.create({
    id: 'tid-1',
    orgId: org.id,
    accountId: acct.id,
    name: 'cli',
    tokenHash: hash,
    prefix: plain.slice(0, 12),
    scopes: ['project:read', 'project:write', 'version:publish'],
    expiresAt: null,
  });
  return { store, plain, org, acct };
}

describe('introspectToken', () => {
  it('returns AuthSubject for a valid bearer token', async () => {
    const { store, plain, org, acct } = await setup();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: store.tokensRepo,
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: store.membershipMirror,
        },
      },
      input: { bearerToken: plain },
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.role).toBe('member');
      expect(r.value.account.id).toBe(acct.id);
      expect(r.value.org.id).toBe(org.id);
      expect(r.value.tokenId).toBe('tid-1');
      expect(r.value.scopes).toEqual(['project:read', 'project:write', 'version:publish']);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --filter @rntme/platform-core test test/unit/use-cases/tokens-introspect.test.ts`

Expected: FAIL with `introspectToken is not exported`.

- [ ] **Step 3: Implement `introspectToken` in `use-cases/tokens.ts`**

The current top of `packages/platform/platform-core/src/use-cases/tokens.ts` is:

```ts
import { createHash } from 'node:crypto';
import { ok, isOk, type Result, type PlatformError } from '../types/result.js';
import type { ApiToken } from '../schemas/entities.js';
import type { Scope } from '../auth/scopes.js';
import type { TokenRepo } from '../repos/token-repo.js';
import type { Ids } from '../ids.js';
import { tokenScopesSubsetOf } from '../auth/scopes.js';
```

Replace it with (adds `Buffer`, `timingSafeEqual`, the three additional repos, `AuthSubject`, `Role`, and `err`):

```ts
import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { ApiToken } from '../schemas/entities.js';
import type { Scope, Role } from '../auth/scopes.js';
import type { AuthSubject } from '../auth/provider.js';
import type { TokenRepo } from '../repos/token-repo.js';
import type { OrganizationRepo } from '../repos/org-repo.js';
import type { AccountRepo } from '../repos/account-repo.js';
import type { MembershipMirrorRepo } from '../repos/membership-mirror-repo.js';
import type { Ids } from '../ids.js';
import { tokenScopesSubsetOf } from '../auth/scopes.js';
```

Then append the new use case at the bottom of the file:

```ts
export type IntrospectTokenDeps = {
  repos: {
    tokens: TokenRepo;
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
  };
};

export type IntrospectTokenInput = {
  /** Bearer header value WITH or WITHOUT the leading "Bearer " prefix; both forms accepted. */
  bearerToken: string;
};

const BEARER_PREFIX = 'Bearer ';
const PAT_PREFIX = 'rntme_pat_';

export async function introspectToken(
  args: { deps: IntrospectTokenDeps; input: IntrospectTokenInput },
): Promise<Result<AuthSubject, PlatformError>> {
  const raw = args.input.bearerToken;
  const plain = raw.startsWith(BEARER_PREFIX) ? raw.slice(BEARER_PREFIX.length) : raw;
  if (!plain.startsWith(PAT_PREFIX)) {
    return err([{ code: 'PLATFORM_AUTH_MISSING', message: 'no bearer token' }]);
  }
  const prefix = plain.slice(0, 12);
  const found = await args.deps.repos.tokens.findByPrefix(prefix);
  if (!isOk(found)) return found;
  if (!found.value) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'token not found' }]);
  }
  const row = found.value;
  if (row.revokedAt) {
    return err([{ code: 'PLATFORM_AUTH_TOKEN_REVOKED', message: 'token revoked' }]);
  }
  if (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now()) {
    return err([{ code: 'PLATFORM_AUTH_TOKEN_EXPIRED', message: 'token expired' }]);
  }
  const expected = Buffer.from(row.tokenHash);
  const actual = createHash('sha256').update(plain, 'utf8').digest();
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'token mismatch' }]);
  }

  const orgR = await args.deps.repos.organizations.findById(row.orgId);
  if (!isOk(orgR)) return orgR;
  if (!orgR.value) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'token org missing' }]);
  }

  const acctR = await args.deps.repos.accounts.findById(row.accountId);
  if (!isOk(acctR)) return acctR;
  if (!acctR.value || acctR.value.deletedAt) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'token account missing' }]);
  }
  const account = acctR.value;

  const mem = await args.deps.repos.memberships.find(row.orgId, row.accountId);
  if (!isOk(mem)) return mem;
  if (!mem.value) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'account not a member of organization' }]);
  }
  const role: Role = mem.value.role === 'admin' ? 'admin' : 'member';

  void args.deps.repos.tokens.touchLastUsed(row.id);

  return ok({
    account: {
      id: account.id,
      workosUserId: account.workosUserId,
      displayName: account.displayName,
      email: account.email,
    },
    org: {
      id: orgR.value.id,
      workosOrgId: orgR.value.workosOrganizationId,
      slug: orgR.value.slug,
    },
    role,
    scopes: row.scopes,
    tokenId: row.id,
  });
}
```

If a repo import name (e.g., `OrganizationRepo`, `AccountRepo`, `MembershipMirrorRepo`) does not match the exact symbol name in `packages/platform/platform-core/src/repos/*.ts`, adjust the import to the actual exported name found in those files.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --filter @rntme/platform-core test test/unit/use-cases/tokens-introspect.test.ts`

Expected: PASS.

- [ ] **Step 5: Add tests for the four error branches**

Append to the same test file:

```ts
describe('introspectToken — error branches', () => {
  it('returns PLATFORM_AUTH_MISSING when bearer is absent', async () => {
    const store = new FakeStore();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: store.tokensRepo,
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: store.membershipMirror,
        },
      },
      input: { bearerToken: '' },
    });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_MISSING');
  });

  it('returns PLATFORM_AUTH_INVALID when prefix is unknown', async () => {
    const store = new FakeStore();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: store.tokensRepo,
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: store.membershipMirror,
        },
      },
      input: { bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` },
    });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_INVALID');
  });

  it('returns PLATFORM_AUTH_INVALID on mismatched hash', async () => {
    const { store, plain } = await setup();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: {
            ...store.tokensRepo,
            findByPrefix: async () =>
              ({
                ok: true,
                value: {
                  id: 'tid-1',
                  orgId: 'org-1',
                  accountId: 'acc-1',
                  name: 'x',
                  tokenHash: new Uint8Array(32),
                  prefix: plain.slice(0, 12),
                  scopes: [],
                  lastUsedAt: null,
                  expiresAt: null,
                  revokedAt: null,
                  createdAt: new Date(),
                },
              }) as never,
          },
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: store.membershipMirror,
        },
      },
      input: { bearerToken: `Bearer ${plain}` },
    });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_INVALID');
  });

  it('returns PLATFORM_AUTH_INVALID when account is not a member of the org', async () => {
    const { store, plain } = await setup();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: store.tokensRepo,
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: { find: async () => ({ ok: true, value: null }) } as never,
        },
      },
      input: { bearerToken: `Bearer ${plain}` },
    });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_INVALID');
  });
});
```

- [ ] **Step 6: Run all token tests**

Run: `bun --filter @rntme/platform-core test`

Expected: PASS — both happy path and four error branches.

- [ ] **Step 7: Export `introspectToken` from package root**

Open `packages/platform/platform-core/src/index.ts` and confirm the line `export * from './use-cases/tokens.js';` is present (it already is). The new function is exported automatically.

- [ ] **Step 8: Build platform-core and verify type surface**

Run: `bun --filter @rntme/platform-core build && bun --filter @rntme/platform-core typecheck`

Expected: green build, no type errors.

- [ ] **Step 9: Commit**

```bash
git add packages/platform/platform-core/src/use-cases/tokens.ts \
        packages/platform/platform-core/test/unit/use-cases/tokens-introspect.test.ts
git commit -m "feat(platform-core): introspectToken use case for bearer-token validation"
```

---

## Task 2: Move `ApiTokenProvider` into `@rntme/platform-core`

**Files:**
- Create: `packages/platform/platform-core/src/auth/api-token-provider.ts`
- Modify: `packages/platform/platform-core/src/index.ts`
- Create: `packages/platform/platform-core/test/unit/auth/api-token-provider.test.ts`
- Delete (Task 3): `apps/platform-http/src/auth/api-token-provider.ts`

After this task: the `IdentityProvider` shim lives in platform-core and delegates to `introspectToken`. The platform-http file is still present (deleted in Task 3) so app/ui imports keep working until the rewire.

- [ ] **Step 1: Create the relocated provider as a thin shim**

Write `packages/platform/platform-core/src/auth/api-token-provider.ts`:

```ts
import type { IdentityProvider, AuthContext } from './provider.js';
import { introspectToken, type IntrospectTokenDeps } from '../use-cases/tokens.js';
import { err } from '../types/result.js';

export class ApiTokenProvider implements IdentityProvider {
  readonly name = 'api-token' as const;
  constructor(private readonly deps: IntrospectTokenDeps['repos']) {}

  async authenticate(ctx: AuthContext) {
    const header = ctx.authorizationHeader;
    if (!header) {
      return err([{ code: 'PLATFORM_AUTH_MISSING' as const, message: 'no bearer token' }]);
    }
    return introspectToken({ deps: { repos: this.deps }, input: { bearerToken: header } });
  }
}
```

The constructor signature stays compatible with the current platform-http callsite shape: `new ApiTokenProvider({ tokens, organizations, accounts, memberships })`.

- [ ] **Step 2: Re-export the class from platform-core's barrel**

Open `packages/platform/platform-core/src/index.ts`. Add at the end of the file (after existing exports):

```ts
export { ApiTokenProvider } from './auth/api-token-provider.js';
```

- [ ] **Step 3: Move the existing provider unit tests**

Copy the contents of `apps/platform-http/test/unit/auth/api-token-provider.test.ts` (do NOT delete the source file yet; Task 3 deletes it) into a new file `packages/platform/platform-core/test/unit/auth/api-token-provider.test.ts`. The relative path `../../../src/auth/api-token-provider.js` happens to be correct in both the old and new location, so the existing `import { ApiTokenProvider }` line works as-is.

Change the platform-core-package imports from package-name form to relative form (so the test does not depend on the package being built before tests run):

Replace:

```ts
import { isOk } from '@rntme/platform-core';
import { FakeStore } from '@rntme/platform-core/testing';
```

with:

```ts
import { isOk } from '../../../src/types/result.js';
import { FakeStore } from '../../../src/testing/fakes.js';
```

- [ ] **Step 4: Run the moved tests**

Run: `bun --filter @rntme/platform-core test test/unit/auth/api-token-provider.test.ts`

Expected: PASS — the four scenarios (valid bearer, bad hash, missing header, non-member) work against the relocated provider.

- [ ] **Step 5: Build platform-core and confirm `ApiTokenProvider` is in the public surface**

Run: `bun --filter @rntme/platform-core build`

Verify by inspection: open `packages/platform/platform-core/dist/index.d.ts` and confirm it re-exports `ApiTokenProvider`.

- [ ] **Step 6: Commit**

```bash
git add packages/platform/platform-core/src/auth/api-token-provider.ts \
        packages/platform/platform-core/src/index.ts \
        packages/platform/platform-core/test/unit/auth/api-token-provider.test.ts
git commit -m "feat(platform-core): relocate ApiTokenProvider as introspectToken shim"
```

---

## Task 3: Rewire `apps/platform-http` to consume the relocated provider, then delete the local file

**Files:**
- Modify: `apps/platform-http/src/app.ts`
- Modify: `apps/platform-http/src/ui/app.tsx`
- Delete: `apps/platform-http/src/auth/api-token-provider.ts`
- Delete: `apps/platform-http/test/unit/auth/api-token-provider.test.ts`

- [ ] **Step 1: Update `app.ts` import**

Open `apps/platform-http/src/app.ts`. Find the line:

```ts
import { ApiTokenProvider } from './auth/api-token-provider.js';
```

(currently at line 39). Replace with:

```ts
import { ApiTokenProvider } from '@rntme/platform-core';
```

If `@rntme/platform-core` is already imported elsewhere in the file, merge the imports.

- [ ] **Step 2: Update `ui/app.tsx` import**

Open `apps/platform-http/src/ui/app.tsx`. Find the line:

```ts
import { ApiTokenProvider } from '../auth/api-token-provider.js';
```

(currently at line 10). Replace with:

```ts
import { ApiTokenProvider } from '@rntme/platform-core';
```

If `@rntme/platform-core` is already imported elsewhere, merge.

- [ ] **Step 3: Delete the old provider file and its test**

```bash
rm apps/platform-http/src/auth/api-token-provider.ts
rm apps/platform-http/test/unit/auth/api-token-provider.test.ts
```

- [ ] **Step 4: Confirm the auth/ folder still has the WorkOS files**

Run: `ls apps/platform-http/src/auth/`

Expected output: `workos-client.ts  workos-provider.ts` (no `api-token-provider.ts`).

- [ ] **Step 5: Run platform-http typecheck and tests**

Run: `bun --filter @rntme/platform-http typecheck && bun --filter @rntme/platform-http test`

Expected: PASS. The `app.ts` and `ui/app.tsx` instantiate `ApiTokenProvider` from `@rntme/platform-core`; the constructor signature is unchanged so callsites compile and behave identically.

- [ ] **Step 6: Commit**

```bash
git add apps/platform-http/src/app.ts \
        apps/platform-http/src/ui/app.tsx \
        apps/platform-http/src/auth/ \
        apps/platform-http/test/unit/auth/
git commit -m "refactor(platform-http): import ApiTokenProvider from @rntme/platform-core"
```

---

## Task 4: Add the blueprint-side native handler stub

**Files:**
- Create: `apps/platform/blueprint/services/tokens/handlers/introspect-token.ts`
- Create: `apps/platform/blueprint/services/tokens/handlers/types.ts`
- Modify: `apps/platform/blueprint/test/platform-blueprint.test.ts` (or add a new suite)

The handler is the future entry point for runtime cross-service-call dispatch. For this plan, it is unit-tested in isolation; runtime wiring is plan 6.

- [ ] **Step 1: Define the handler envelope types**

Write `apps/platform/blueprint/services/tokens/handlers/types.ts`:

```ts
import type { ApiTokenProvider, AuthSubject } from '@rntme/platform-core';

export type IntrospectTokenHandlerInput = {
  readonly bearerToken: string;
};

export type IntrospectTokenHandlerOutput =
  | { readonly status: 'active'; readonly subject: AuthSubject }
  | { readonly status: 'inactive'; readonly reason: string; readonly code: string };

export type IntrospectTokenHandlerDeps = {
  readonly provider: ApiTokenProvider;
};
```

The output mirrors the `Session`-style shape used by the auth0 module (`status` + payload), so the future runtime call dispatcher can produce a uniform return for both `IntrospectSession` and `IntrospectToken`.

- [ ] **Step 2: Write the failing handler test**

Append a new file `apps/platform/blueprint/test/platform-tokens-handler.test.ts`:

```ts
import { describe, it, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { ApiTokenProvider, isOk } from '@rntme/platform-core';
import { FakeStore } from '@rntme/platform-core/testing';
import { introspectTokenHandler } from '../services/tokens/handlers/introspect-token.js';

async function setup() {
  const store = new FakeStore();
  const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u', email: null, displayName: 'U' });
  await store.membershipMirror.upsert({ orgId: org.id, accountId: acct.id, role: 'member' });
  const plain = 'rntme_pat_' + 'a'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await store.tokensRepo.create({
    id: 'tid-1',
    orgId: org.id,
    accountId: acct.id,
    name: 'cli',
    tokenHash: hash,
    prefix: plain.slice(0, 12),
    scopes: ['project:read'],
    expiresAt: null,
  });
  const provider = new ApiTokenProvider({
    tokens: store.tokensRepo,
    organizations: store.organizations,
    accounts: store.accountsRepo,
    memberships: store.membershipMirror,
  });
  return { provider, plain };
}

describe('introspectTokenHandler', () => {
  it('returns active status for a valid PAT', async () => {
    const { provider, plain } = await setup();
    const out = await introspectTokenHandler(
      { provider },
      { bearerToken: `Bearer ${plain}` },
    );
    expect(out.status).toBe('active');
    if (out.status === 'active') {
      expect(out.subject.tokenId).toBe('tid-1');
    }
  });

  it('returns inactive status for an unknown PAT', async () => {
    const { provider } = await setup();
    const out = await introspectTokenHandler(
      { provider },
      { bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` },
    );
    expect(out.status).toBe('inactive');
    if (out.status === 'inactive') {
      expect(out.code).toBe('PLATFORM_AUTH_INVALID');
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun --filter @rntme/platform-blueprint test test/platform-tokens-handler.test.ts`

Expected: FAIL with `Cannot find module .../handlers/introspect-token.js`.

- [ ] **Step 4: Implement the handler**

Write `apps/platform/blueprint/services/tokens/handlers/introspect-token.ts`:

```ts
import { isOk } from '@rntme/platform-core';
import type {
  IntrospectTokenHandlerDeps,
  IntrospectTokenHandlerInput,
  IntrospectTokenHandlerOutput,
} from './types.js';

export async function introspectTokenHandler(
  deps: IntrospectTokenHandlerDeps,
  input: IntrospectTokenHandlerInput,
): Promise<IntrospectTokenHandlerOutput> {
  const r = await deps.provider.authenticate({
    authorizationHeader: input.bearerToken,
    cookieHeader: undefined,
  });
  if (isOk(r)) {
    return { status: 'active', subject: r.value };
  }
  const first = r.errors[0] ?? { code: 'PLATFORM_AUTH_INVALID', message: 'unknown' };
  return { status: 'inactive', code: first.code, reason: first.message };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun --filter @rntme/platform-blueprint test test/platform-tokens-handler.test.ts`

Expected: PASS — both active and inactive cases.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/blueprint/services/tokens/handlers/ \
        apps/platform/blueprint/test/platform-tokens-handler.test.ts
git commit -m "feat(platform-blueprint): IntrospectToken native handler in services/tokens"
```

---

## Task 5: Declare the `IntrospectToken` operation contract in the blueprint

**Files:**
- Create: `apps/platform/blueprint/services/tokens/operations.json`
- Modify: `apps/platform/blueprint/test/platform-blueprint.test.ts`

This task adds a static, declarative manifest naming `IntrospectToken` as a service-level operation with a handler entry. The blueprint composer does not yet route calls through it — that is plan 6. The manifest is a contract declaration only, asserted by a unit test that loads and shape-checks the JSON.

- [ ] **Step 1: Write the failing assertion in the blueprint test**

Open `apps/platform/blueprint/test/platform-blueprint.test.ts`. The existing test file already imports `dirname`, `join`, and `fileURLToPath`, and computes `const here = dirname(fileURLToPath(import.meta.url));` at the top. Add `readFile` and `existsSync` imports next to them, then add a new `it(...)` block inside the existing top-level `describe`:

```ts
// add near the existing imports at the top of the file
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// inside the existing describe block
it('declares IntrospectToken as a service operation in services/tokens/operations.json', async () => {
  const manifestPath = join(here, '../services/tokens/operations.json');
  expect(existsSync(manifestPath)).toBe(true);
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  expect(parsed.version).toBe('1');
  expect(parsed.operations).toBeDefined();
  expect(parsed.operations.IntrospectToken).toEqual({
    handler: { kind: 'native', entry: './handlers/introspect-token.ts', export: 'introspectTokenHandler' },
    input: { bearerToken: { type: 'string', mode: 'required' } },
    output: { type: 'IntrospectTokenResult' },
    effect: 'read',
    idempotency: 'none',
  });
  const handlerPath = join(here, '../services/tokens/handlers/introspect-token.ts');
  expect(existsSync(handlerPath)).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --filter @rntme/platform-blueprint test test/platform-blueprint.test.ts -t "declares IntrospectToken"`

Expected: FAIL with `existsSync(manifestPath)` returning `false`.

- [ ] **Step 3: Create the operations manifest**

Write `apps/platform/blueprint/services/tokens/operations.json`:

```json
{
  "version": "1",
  "operations": {
    "IntrospectToken": {
      "handler": {
        "kind": "native",
        "entry": "./handlers/introspect-token.ts",
        "export": "introspectTokenHandler"
      },
      "input": {
        "bearerToken": { "type": "string", "mode": "required" }
      },
      "output": { "type": "IntrospectTokenResult" },
      "effect": "read",
      "idempotency": "none"
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --filter @rntme/platform-blueprint test test/platform-blueprint.test.ts -t "declares IntrospectToken"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/blueprint/services/tokens/operations.json \
        apps/platform/blueprint/test/platform-blueprint.test.ts
git commit -m "feat(platform-blueprint): declare IntrospectToken operation in services/tokens"
```

---

## Task 6: Update owner docs

**Files:**
- Modify: `docs/current/owners/apps/platform-http.md`
- Modify: `docs/current/owners/packages/platform/platform-core.md`

The repo convention (per `AGENTS.md`) is to update the relevant `docs/current/owners/**` doc when a package's surface or layering changes. Edit only the sections that need to be updated.

- [ ] **Step 1: Read the current platform-http owner doc**

Run: `cat docs/current/owners/apps/platform-http.md`

Locate any reference to `auth/api-token-provider.ts` or to bearer-token validation living inside platform-http.

- [ ] **Step 2: Update platform-http doc**

In `docs/current/owners/apps/platform-http.md`, replace any sentence that says bearer-token validation lives in `apps/platform-http/src/auth/api-token-provider.ts` with one that says it lives in `@rntme/platform-core` (`src/use-cases/tokens.ts#introspectToken` + `src/auth/api-token-provider.ts`). If the doc mentions the local `auth/` directory, narrow the description to "WorkOS provider only — `workos-client.ts`, `workos-provider.ts`."

- [ ] **Step 3: Read the current platform-core owner doc**

Run: `cat docs/current/owners/packages/platform/platform-core.md`

If the doc lists exported symbols, locate the section that enumerates the use-cases or auth types.

- [ ] **Step 4: Update platform-core doc**

In `docs/current/owners/packages/platform/platform-core.md`, document the new public surface:

- `introspectToken({ deps, input })` — bearer-token introspection algorithm; returns `Result<AuthSubject, PlatformError>`.
- `ApiTokenProvider` — `IdentityProvider` shim around `introspectToken`, intended for HTTP middleware integration. Used by `apps/platform-http` and (per plan 6) by the runtime auth chain when the platform blueprint is served by `@rntme/runtime`.

Keep the wording brief; the goal is to surface the locations, not duplicate the API.

- [ ] **Step 5: Commit**

```bash
git add docs/current/owners/apps/platform-http.md \
        docs/current/owners/packages/platform/platform-core.md
git commit -m "docs(owners): document ApiTokenProvider relocation to @rntme/platform-core"
```

---

## Task 7: Repo-wide verification

**Files:** none modified — this task only runs verifiers.

- [ ] **Step 1: Build everything**

Run: `bun run build`

Expected: green build across all packages.

- [ ] **Step 2: Typecheck everything**

Run: `bun run typecheck`

Expected: 0 errors.

- [ ] **Step 3: Test everything**

Run: `bun run test`

Expected: PASS — including the new platform-core tests, the moved provider tests, the new handler test, the new blueprint manifest assertion, and unchanged platform-http tests.

- [ ] **Step 4: Lint**

Run: `bun run lint`

Expected: 0 errors.

- [ ] **Step 5: Layering check**

Run: `bun run depcruise`

Expected: 0 violations. The new `apps/platform/blueprint/services/tokens/handlers/introspect-token.ts` imports `@rntme/platform-core`, which is permitted (handlers are platform glue, not vendor modules).

- [ ] **Step 6: Vendor check**

Run: `bun run vendor:check`

Expected: PASS.

- [ ] **Step 7: Final commit**

If any of the above produced incidental fixes (e.g., lint autoformat), commit them:

```bash
git status
# review changes
git add -p
git commit -m "chore: lint/format pass after bearer-token relocation"
```

If no changes were produced, skip.

---

## Migration follow-up note for plan 6

Plan 6 (`apps/platform-http` deletion) inherits these open items from this plan:

1. Wire the runtime's `OperationCallClient` to dispatch `target: { service: 'tokens', operation: 'IntrospectToken' }` to the native handler declared in `services/tokens/operations.json`. Reuse the loader pattern established by plan 3's `nativeTasks` mechanism in `@rntme/bpmn-worker` (`packages/runtime/bpmn-worker/src/native-handlers.ts`) — it already loads handler modules from declarative manifests.
2. Mount an auth middleware in the runtime's `HttpSurface` that, when the request bears `Authorization: Bearer rntme_pat_*`, invokes `services/tokens.IntrospectToken` and writes the resulting subject onto the Hono context (the runtime's existing `actorFromRequest` shim is too thin for a full auth subject). The `ApiTokenProvider` class can either be imported directly into the runtime (simplest) or invoked through the cross-service-call dispatcher.
3. Once the runtime auth path is live, remove `ApiTokenProvider` from `@rntme/platform-core/src/index.ts`'s exports if no callers remain outside the runtime — but only if `apps/platform-http` is also fully deleted in the same plan; before that, the export is load-bearing.

These three items belong to plan 6 because they require the platform-http→runtime cutover; doing them here would create a dual-stack live system with no functional benefit until plan 6 lands.

---

## Self-Review

- **Spec coverage:** Spec plan 5 says "Extract `apps/platform-http/src/auth/api-token-provider.ts` into a token introspection handler reachable from API binding auth middleware in the blueprint. Update API mounts accordingly." Tasks 1–3 do the extraction and rewire; Tasks 4–5 add the blueprint-side handler + operation declaration ("reachable from API binding auth middleware in the blueprint" — the contract exists; full runtime routing is plan 6 territory, called out explicitly in the migration follow-up note).
- **Type consistency:** `IntrospectTokenDeps`, `IntrospectTokenInput`, `ApiTokenProvider`'s constructor argument shape, and the handler's `IntrospectTokenHandlerOutput` discriminated union are consistent across tasks.
- **No placeholders:** Each step contains the actual code or command to run.
- **Pre-stable stage:** No backwards-compat shims, no re-exports of the deleted file's path, no transitional `@deprecated` marks. The plan deletes outright and updates callers in the same task.
