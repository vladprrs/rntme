# platform-http UI — Plan 04: Token Mutations (htmx)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `/:orgSlug/tokens` page with list + create form + revoke, using htmx fragments. Honour `token:manage` scope (form & revoke hidden without it). Enforce same-origin CSRF on mutations.

**Architecture:** GET renders the full page. POST & DELETE return HTML fragments (one `<tr>` + optional plaintext banner for POST). htmx swaps target the tokens tbody (create) or the row itself (revoke).

**Tech Stack:** Hono JSX, htmx 2.x (already loaded by Layout), `@rntme-cli/platform-core` (`listTokens`, `createToken`, `revokeToken`, `CreateTokenInputSchema`).

**Spec:** `docs/superpowers/specs/done/2026-04-21-platform-http-ui-design.md` §5, §7.4, §8.2, §8.3.

---

### Task 4.1: `hasScope` helper

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/scopes.ts`
- Test: `rntme-cli/packages/platform-http/test/unit/ui/scopes.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/ui/scopes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hasScope } from '../../../src/ui/scopes.js';

describe('hasScope', () => {
  it('returns true when subject has the scope', () => {
    expect(hasScope({ scopes: ['token:manage', 'project:read'] } as never, 'token:manage')).toBe(true);
  });

  it('returns false when subject lacks the scope', () => {
    expect(hasScope({ scopes: ['project:read'] } as never, 'token:manage')).toBe(false);
  });

  it('returns false for null/undefined subject', () => {
    expect(hasScope(null as never, 'token:manage')).toBe(false);
    expect(hasScope(undefined as never, 'token:manage')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/scopes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/ui/scopes.ts`:

```ts
import type { AuthSubject, Scope } from '@rntme-cli/platform-core';

export function hasScope(subject: AuthSubject | null | undefined, scope: Scope): boolean {
  if (!subject || !Array.isArray(subject.scopes)) return false;
  return subject.scopes.includes(scope);
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/scopes.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/scopes.ts packages/platform-http/test/unit/ui/scopes.test.ts
git commit -m "feat(platform-http): add hasScope helper"
```

---

### Task 4.2: `TokenRow` and `TokensPage`

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/fragments/token-row.tsx`
- Create: `rntme-cli/packages/platform-http/src/ui/pages/tokens.tsx`
- Test: `rntme-cli/packages/platform-http/test/unit/ui/tokens.test.tsx`

- [ ] **Step 1: Write failing test**

Create `test/unit/ui/tokens.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { TokenRow } from '../../../src/ui/fragments/token-row.js';
import { TokensPage } from '../../../src/ui/pages/tokens.js';

const subject = {
  account: { id: 'a1', displayName: 'Ada' },
  org: { id: 'o1', slug: 'acme', displayName: 'Acme' },
  role: 'admin',
  scopes: ['token:manage', 'project:read'],
  tokenId: null,
} as never;

const subjectNoManage = { ...subject, scopes: ['project:read'] } as never;

const tokens = [
  {
    id: 't1',
    name: 'ci',
    prefix: 'rntme_pat_1',
    scopes: ['project:read'],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date('2026-04-20T00:00:00Z'),
  },
] as never;

describe('TokenRow', () => {
  it('renders name, prefix, revoke button when can manage', () => {
    const html = String(<TokenRow orgSlug="acme" token={tokens[0]} canManage={true} />);
    expect(html).toContain('ci');
    expect(html).toContain('rntme_pat_1');
    expect(html).toContain('hx-delete="/acme/tokens/t1"');
  });

  it('hides revoke button when cannot manage', () => {
    const html = String(<TokenRow orgSlug="acme" token={tokens[0]} canManage={false} />);
    expect(html).not.toContain('hx-delete');
  });

  it('renders revoked badge when token is revoked', () => {
    const revoked = { ...tokens[0], revokedAt: new Date() } as never;
    const html = String(<TokenRow orgSlug="acme" token={revoked} canManage={true} />);
    expect(html).toContain('revoked');
    expect(html).not.toContain('hx-delete');
  });
});

describe('TokensPage', () => {
  it('renders create form when subject has token:manage', () => {
    const html = String(<TokensPage subject={subject} otherOrgs={[]} tokens={tokens} />);
    expect(html).toContain('hx-post="/acme/tokens"');
    expect(html).toContain('name="name"');
  });

  it('hides create form when subject lacks token:manage', () => {
    const html = String(<TokensPage subject={subjectNoManage} otherOrgs={[]} tokens={tokens} />);
    expect(html).not.toContain('hx-post="/acme/tokens"');
  });

  it('renders empty state when no tokens', () => {
    const html = String(<TokensPage subject={subject} otherOrgs={[]} tokens={[]} />);
    expect(html).toMatch(/no tokens/i);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/tokens.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `TokenRow`**

Create `src/ui/fragments/token-row.tsx`:

```tsx
import { RelativeTime } from '../components/relative-time.js';

export type TokenSummary = {
  id: string;
  name: string;
  prefix: string;
  scopes: readonly string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export function TokenRow(props: { orgSlug: string; token: TokenSummary; canManage: boolean }) {
  const { orgSlug, token, canManage } = props;
  const revoked = token.revokedAt !== null;
  return (
    <tr id={`token-${token.id}`} class={revoked ? 'opacity-60' : ''}>
      <td class="px-3 py-2 align-top">
        <div class="font-medium text-gray-900">{token.name}</div>
        <div class="text-xs text-gray-500">
          <code>{token.prefix}…</code>
        </div>
      </td>
      <td class="px-3 py-2 align-top text-xs text-gray-600">
        {token.scopes.join(', ')}
      </td>
      <td class="px-3 py-2 align-top text-sm">
        <RelativeTime value={token.lastUsedAt} />
      </td>
      <td class="px-3 py-2 align-top text-sm">
        <RelativeTime value={token.createdAt} />
      </td>
      <td class="px-3 py-2 align-top text-right">
        {revoked ? (
          <span class="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
            revoked
          </span>
        ) : canManage ? (
          <button
            type="button"
            class="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            hx-delete={`/${orgSlug}/tokens/${token.id}`}
            hx-target={`#token-${token.id}`}
            hx-swap="outerHTML"
            hx-confirm="Revoke this token? This cannot be undone."
          >
            Revoke
          </button>
        ) : null}
      </td>
    </tr>
  );
}
```

- [ ] **Step 4: Implement `TokensPage`**

Create `src/ui/pages/tokens.tsx`:

```tsx
import { Layout } from '../layout.js';
import { EmptyState } from '../components/empty-state.js';
import type { AuthSubject, Organization } from '@rntme-cli/platform-core';
import { TokenRow, type TokenSummary } from '../fragments/token-row.js';
import { hasScope } from '../scopes.js';

export function TokensPage(props: {
  subject: AuthSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  tokens: readonly TokenSummary[];
  flash?: string | undefined;
}) {
  const { subject, tokens } = props;
  const canManage = hasScope(subject, 'token:manage');
  const orgSlug = subject.org.slug;

  return (
    <Layout title="Tokens" variant="authed" subject={subject} otherOrgs={props.otherOrgs} flash={props.flash}>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">API tokens</h1>
        <p class="text-sm text-gray-600">
          Personal access tokens for CLI and CI. The plaintext is shown once at creation.
        </p>
      </header>

      {canManage && (
        <form
          class="mb-6 rounded-md border border-gray-200 bg-white p-4"
          hx-post={`/${orgSlug}/tokens`}
          hx-target="#tokens-tbody"
          hx-swap="afterbegin"
          hx-on--after-request="this.reset()"
        >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="flex flex-col text-sm">
              <span class="text-gray-700">Name</span>
              <input
                type="text"
                name="name"
                required
                placeholder="ci, laptop, …"
                class="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label class="flex flex-col text-sm sm:col-span-2">
              <span class="text-gray-700">Scopes (comma-separated)</span>
              <input
                type="text"
                name="scopes"
                required
                placeholder="project:read,project:write,version:publish"
                class="mt-1 rounded border border-gray-300 px-2 py-1 font-mono text-xs"
              />
            </label>
          </div>
          <div class="mt-3 flex justify-end">
            <button
              type="submit"
              class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 [.htmx-request]:opacity-60"
            >
              Create token
            </button>
          </div>
        </form>
      )}

      <div id="token-created" aria-live="polite"></div>

      {tokens.length === 0 ? (
        <EmptyState title="No tokens yet." />
      ) : (
        <div class="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" class="px-3 py-2 font-medium">Name</th>
                <th scope="col" class="px-3 py-2 font-medium">Scopes</th>
                <th scope="col" class="px-3 py-2 font-medium">Last used</th>
                <th scope="col" class="px-3 py-2 font-medium">Created</th>
                <th scope="col" class="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody id="tokens-tbody" class="divide-y divide-gray-100">
              {tokens.map((t) => (
                <TokenRow orgSlug={orgSlug} token={t} canManage={canManage} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/tokens.test.tsx`
Expected: 6 passing.

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/fragments packages/platform-http/src/ui/pages/tokens.tsx packages/platform-http/test/unit/ui/tokens.test.tsx
git commit -m "feat(platform-http): add TokensPage and TokenRow components"
```

---

### Task 4.3: `TokenCreated` fragment (new row + plaintext banner)

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/fragments/token-created.tsx`
- Test: add to `test/unit/ui/tokens.test.tsx`

- [ ] **Step 1: Extend test**

Append to `test/unit/ui/tokens.test.tsx`:

```tsx
import { TokenCreated } from '../../../src/ui/fragments/token-created.js';

describe('TokenCreated', () => {
  it('renders <tr> and out-of-band plaintext banner', () => {
    const html = String(
      <TokenCreated
        orgSlug="acme"
        token={{ ...tokens[0], id: 't2', name: 'new' } as never}
        plaintext="rntme_pat_abc123"
      />,
    );
    expect(html).toContain('hx-swap-oob="innerHTML:#token-created"');
    expect(html).toContain('rntme_pat_abc123');
    expect(html).toContain('<tr id="token-t2"');
    expect(html).toMatch(/won't be shown again/i);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/tokens.test.tsx`
Expected: new case fails.

- [ ] **Step 3: Implement `TokenCreated`**

Create `src/ui/fragments/token-created.tsx`:

```tsx
import { TokenRow, type TokenSummary } from './token-row.js';

/**
 * Response fragment for POST /:orgSlug/tokens.
 *
 * Returns two pieces in one response:
 *   1. A new <tr> appended by htmx to the tokens tbody (primary swap).
 *   2. An out-of-band banner containing the plaintext, inserted into the
 *      #token-created sibling container. Plaintext is shown ONCE here and
 *      never stored anywhere else.
 */
export function TokenCreated(props: {
  orgSlug: string;
  token: TokenSummary;
  plaintext: string;
}) {
  return (
    <>
      <TokenRow orgSlug={props.orgSlug} token={props.token} canManage={true} />
      <div hx-swap-oob="innerHTML:#token-created">
        <div
          role="alert"
          class="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p class="font-medium">Save this token now — it won't be shown again.</p>
          <div class="mt-2 flex items-center gap-2">
            <code class="flex-1 overflow-x-auto rounded bg-white px-2 py-1 font-mono text-xs">
              {props.plaintext}
            </code>
            <button
              type="button"
              class="rounded border border-amber-300 bg-white px-2 py-1 text-xs hover:bg-amber-100"
              onclick={`navigator.clipboard?.writeText(this.previousElementSibling.textContent)`}
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/tokens.test.tsx`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/fragments/token-created.tsx packages/platform-http/test/unit/ui/tokens.test.tsx
git commit -m "feat(platform-http): add TokenCreated fragment with one-time plaintext"
```

---

### Task 4.4: GET `/:orgSlug/tokens`

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx`
- Test: `rntme-cli/packages/platform-http/test/e2e/ui-tokens.test.ts`

- [ ] **Step 1: Write failing e2e test**

Create `test/e2e/ui-tokens.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { bootE2e, type E2eEnv } from './harness.js';
import { e2eContainersAvailable } from './docker-available.js';

describe.skipIf(!e2eContainersAvailable())('UI tokens page', () => {
  let env: E2eEnv;
  let bearer: string;
  let readOnlyBearer: string;
  let orgSlug: string;

  beforeAll(async () => {
    env = await bootE2e();
    const o = await env.deps.poolRepos.organizations.upsertFromWorkos({
      workosOrganizationId: 'org_tok',
      slug: 'tok-org',
      displayName: 'Tok Org',
    });
    const a = await env.deps.poolRepos.accounts.upsertFromWorkos({
      workosUserId: 'user_tok',
      email: 'tok@example.com',
      displayName: 'Tok User',
    });
    if (!o.ok || !a.ok) throw new Error('seed failed');
    await env.deps.poolRepos.memberships.upsert({ orgId: o.value.id, accountId: a.value.id, role: 'admin' });

    const admin = 'rntme_pat_' + 'c'.repeat(22);
    await env.deps.poolRepos.tokens.create({
      id: randomUUID(),
      orgId: o.value.id,
      accountId: a.value.id,
      name: 'admin',
      tokenHash: new Uint8Array(createHash('sha256').update(admin).digest()),
      prefix: admin.slice(0, 12),
      scopes: ['project:read', 'project:write', 'version:publish', 'member:read', 'token:manage'],
      expiresAt: null,
    });
    bearer = admin;

    const ro = 'rntme_pat_' + 'd'.repeat(22);
    await env.deps.poolRepos.tokens.create({
      id: randomUUID(),
      orgId: o.value.id,
      accountId: a.value.id,
      name: 'readonly',
      tokenHash: new Uint8Array(createHash('sha256').update(ro).digest()),
      prefix: ro.slice(0, 12),
      scopes: ['project:read'],
      expiresAt: null,
    });
    readOnlyBearer = ro;
    orgSlug = o.value.slug;
  }, 300_000);

  afterAll(async () => env.teardown());

  it('GET /{orgSlug}/tokens with token:manage → 200, shows form', async () => {
    const r = await env.app.request(`/${orgSlug}/tokens`, {
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain(`hx-post="/${orgSlug}/tokens"`);
    expect(body).toContain('admin');
  });

  it('GET /{orgSlug}/tokens without token:manage → 200, no form', async () => {
    const r = await env.app.request(`/${orgSlug}/tokens`, {
      headers: { authorization: `Bearer ${readOnlyBearer}` },
    });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).not.toContain(`hx-post="/${orgSlug}/tokens"`);
    // list still visible
    expect(body).toContain('admin');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-tokens.test.ts`
Expected: FAIL — route not defined.

- [ ] **Step 3: Add route**

In `src/ui/app.tsx`, add imports:

```tsx
import { listTokens } from '@rntme-cli/platform-core';
import { TokensPage } from './pages/tokens.js';
```

Add route inside `authed`:

```tsx
  authed.get('/:orgSlug/tokens', async (c) => {
    const repos = resolveDeps(c.get('tx'));
    const s = c.get('subject');
    if (s.org.slug !== c.req.param('orgSlug')) {
      return renderHtml(
        c,
        <ErrorPage status={403} title="Not authorized" backHref={`/${s.org.slug}`} />,
        403,
      );
    }
    const [tokRes, otherRes] = await Promise.all([
      listTokens({ repos: { tokens: repos.tokens } }, { orgId: s.org.id }),
      repos.organizations.listForAccount(s.account.id),
    ]);
    if (!tokRes.ok) {
      return renderHtml(c, <ErrorPage status={500} title="Error" detail={tokRes.error.message} />, 500);
    }
    const otherOrgs = isOk(otherRes) ? otherRes.value.filter((o) => o.slug !== s.org.slug) : [];
    const flash = c.req.query('flash') ?? undefined;
    return renderHtml(
      c,
      <TokensPage subject={s} otherOrgs={otherOrgs} tokens={tokRes.value} flash={flash} />,
    );
  });
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-tokens.test.ts`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/app.tsx packages/platform-http/test/e2e/ui-tokens.test.ts
git commit -m "feat(platform-http): GET /:orgSlug/tokens page"
```

---

### Task 4.5: POST `/:orgSlug/tokens` (htmx)

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx`
- Test: extend `test/e2e/ui-tokens.test.ts`

- [ ] **Step 1: Extend test**

Append:

```ts
  it('POST /{orgSlug}/tokens with same-origin + token:manage → 200 fragment', async () => {
    const body = new URLSearchParams({
      name: 'ci-test',
      scopes: 'project:read,project:write',
    });
    const r = await env.app.request(`/${orgSlug}/tokens`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/x-www-form-urlencoded',
        Origin: 'http://localhost',
      },
      body: body.toString(),
    });
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('ci-test');
    expect(html).toContain('rntme_pat_');
    expect(html).toContain('hx-swap-oob');
  });

  it('POST /{orgSlug}/tokens from foreign Origin → 403', async () => {
    const body = new URLSearchParams({ name: 'evil', scopes: 'project:read' });
    const r = await env.app.request(`/${orgSlug}/tokens`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/x-www-form-urlencoded',
        Origin: 'https://evil.example',
      },
      body: body.toString(),
    });
    expect(r.status).toBe(403);
  });

  it('POST /{orgSlug}/tokens without token:manage → 403', async () => {
    const body = new URLSearchParams({ name: 'ro-attempt', scopes: 'project:read' });
    const r = await env.app.request(`/${orgSlug}/tokens`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${readOnlyBearer}`,
        'content-type': 'application/x-www-form-urlencoded',
        Origin: 'http://localhost',
      },
      body: body.toString(),
    });
    expect(r.status).toBe(403);
  });
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-tokens.test.ts`
Expected: new cases fail.

- [ ] **Step 3: Extend `UiDeps` with `ids`**

The POST handler needs `Ids` to create tokens. Extend `UiDeps`.

In `src/ui/app.tsx`, add to the imports block:

```tsx
import type { Ids } from '@rntme-cli/platform-core';
```

Change the `UiDeps` type:

```tsx
export type UiDeps = {
  env: Env;
  logger: pino.Logger;
  workos: WorkOSClient;
  cookiePassword: string;
  pool: Pool;
  ids: Ids;
  poolRepos: {
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
    tokens: TokenRepo;
  };
};
```

In `src/app.ts`, add `ids: deps.ids` to the `createUiApp(...)` call (the existing `ids` already lives on `AppDeps`).

- [ ] **Step 4: Add route**

In `src/ui/app.tsx`, add imports:

```tsx
import { createToken } from '@rntme-cli/platform-core';
import { TokenCreated } from './fragments/token-created.js';
import { hasScope } from './scopes.js';
```

Add the POST route inside `authed` (uses `sameOriginOnly` on this route only):

```tsx
  authed.post(
    '/:orgSlug/tokens',
    sameOriginOnly(deps.env.PLATFORM_BASE_URL),
    async (c) => {
      const s = c.get('subject');
      if (s.org.slug !== c.req.param('orgSlug')) {
        return renderHtml(
          c,
          <ErrorPage status={403} title="Not authorized" backHref={`/${s.org.slug}`} />,
          403,
        );
      }
      if (!hasScope(s, 'token:manage')) {
        return renderHtml(
          c,
          <ErrorPage status={403} title="Missing scope token:manage" backHref={`/${s.org.slug}/tokens`} />,
          403,
        );
      }
      const form = await c.req.parseBody();
      const name = typeof form.name === 'string' ? form.name.trim() : '';
      const scopesStr = typeof form.scopes === 'string' ? form.scopes : '';
      const scopes = scopesStr
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      if (!name || scopes.length === 0) {
        return renderHtml(
          c,
          <ErrorPage status={400} title="Invalid token form" detail="name and scopes are required." backHref={`/${s.org.slug}/tokens`} />,
          400,
        );
      }
      const repos = resolveDeps(c.get('tx'));
      const r = await createToken(
        { repos: { tokens: repos.tokens }, ids: deps.ids },
        {
          orgId: s.org.id,
          accountId: s.account.id,
          name,
          scopes: scopes as never,
          expiresAt: null,
          creatorScopes: s.scopes as never,
        },
      );
      if (!r.ok) {
        return renderHtml(
          c,
          <ErrorPage status={400} title="Cannot create token" detail={r.error.message} backHref={`/${s.org.slug}/tokens`} />,
          400,
        );
      }
      return renderHtml(
        c,
        <TokenCreated
          orgSlug={s.org.slug}
          token={{
            id: r.value.token.id,
            name: r.value.token.name,
            prefix: r.value.token.prefix,
            scopes: r.value.token.scopes,
            lastUsedAt: null,
            expiresAt: r.value.token.expiresAt,
            revokedAt: null,
            createdAt: r.value.token.createdAt,
          }}
          plaintext={r.value.plaintext}
        />,
      );
    },
  );
```

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-tokens.test.ts`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/app.tsx packages/platform-http/src/app.ts packages/platform-http/test/e2e/ui-tokens.test.ts
git commit -m "feat(platform-http): POST /:orgSlug/tokens with htmx fragment"
```

---

### Task 4.6: DELETE `/:orgSlug/tokens/:id` (htmx)

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx`
- Test: extend `test/e2e/ui-tokens.test.ts`

- [ ] **Step 1: Extend test**

Append:

```ts
  it('DELETE /{orgSlug}/tokens/{id} with same-origin + token:manage → 200 fragment with revoked badge', async () => {
    // Create a token to revoke.
    const created = await env.app.request(`/${orgSlug}/tokens`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/x-www-form-urlencoded',
        Origin: 'http://localhost',
      },
      body: new URLSearchParams({ name: 'to-revoke', scopes: 'project:read' }).toString(),
    });
    expect(created.status).toBe(200);
    const html = await created.text();
    const idMatch = html.match(/id="token-([^"]+)"/);
    expect(idMatch).toBeTruthy();
    const id = idMatch![1];

    const r = await env.app.request(`/${orgSlug}/tokens/${id}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${bearer}`,
        Origin: 'http://localhost',
      },
    });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('revoked');
    expect(body).toContain(`id="token-${id}"`);
  });

  it('DELETE /{orgSlug}/tokens/{id} from foreign Origin → 403', async () => {
    const r = await env.app.request(`/${orgSlug}/tokens/does-not-matter`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${bearer}`,
        Origin: 'https://evil.example',
      },
    });
    expect(r.status).toBe(403);
  });
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-tokens.test.ts`
Expected: new cases fail.

- [ ] **Step 3: Add route**

In `src/ui/app.tsx`, add import:

```tsx
import { revokeToken } from '@rntme-cli/platform-core';
import { TokenRow } from './fragments/token-row.js';
```

Add the DELETE route inside `authed`:

```tsx
  authed.delete(
    '/:orgSlug/tokens/:id',
    sameOriginOnly(deps.env.PLATFORM_BASE_URL),
    async (c) => {
      const s = c.get('subject');
      if (s.org.slug !== c.req.param('orgSlug')) {
        return renderHtml(
          c,
          <ErrorPage status={403} title="Not authorized" backHref={`/${s.org.slug}`} />,
          403,
        );
      }
      if (!hasScope(s, 'token:manage')) {
        return renderHtml(
          c,
          <ErrorPage status={403} title="Missing scope token:manage" backHref={`/${s.org.slug}/tokens`} />,
          403,
        );
      }
      const id = c.req.param('id')!;
      const repos = resolveDeps(c.get('tx'));
      const r = await revokeToken({ repos: { tokens: repos.tokens } }, { orgId: s.org.id, id });
      if (!r.ok) {
        return renderHtml(
          c,
          <ErrorPage status={400} title="Cannot revoke token" detail={r.error.message} backHref={`/${s.org.slug}/tokens`} />,
          400,
        );
      }
      const t = r.value;
      return renderHtml(
        c,
        <TokenRow
          orgSlug={s.org.slug}
          token={{
            id: t.id,
            name: t.name,
            prefix: t.prefix,
            scopes: t.scopes,
            lastUsedAt: t.lastUsedAt,
            expiresAt: t.expiresAt,
            revokedAt: t.revokedAt,
            createdAt: t.createdAt,
          }}
          canManage={true}
        />,
      );
    },
  );
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-tokens.test.ts`
Expected: all passing.

- [ ] **Step 5: Run full suite**

Run: `pnpm -F @rntme-cli/platform-http test && pnpm -F @rntme-cli/platform-http typecheck && pnpm -F @rntme-cli/platform-http lint`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/app.tsx packages/platform-http/test/e2e/ui-tokens.test.ts
git commit -m "feat(platform-http): DELETE /:orgSlug/tokens/:id with htmx swap"
```

---

## End of Plan 04

**What was built:**
- `hasScope` helper.
- `TokenRow`, `TokenCreated` fragments.
- `TokensPage` with role-gated create form.
- `GET /:orgSlug/tokens`, `POST /:orgSlug/tokens`, `DELETE /:orgSlug/tokens/:id`.
- Same-origin CSRF guard enforced on token mutations.
- Full htmx cycle works end-to-end with testcontainers fixture.

**Verification before moving to Plan 05:**

```bash
cd rntme-cli && pnpm -F @rntme-cli/platform-http test && pnpm -F @rntme-cli/platform-http typecheck && pnpm -F @rntme-cli/platform-http lint
```

Expected: all green.
