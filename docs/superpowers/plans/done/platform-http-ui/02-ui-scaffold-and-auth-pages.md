# platform-http UI — Plan 02: UI Scaffold & Auth Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the UI sub-router at `/` with `Layout`, `Header`, and the three pre-dashboard pages (`/login`, `/no-org`, error page) plus the entry redirects at `/` and `POST /logout`. After this plan, a user can sign in through WorkOS and land on a placeholder "Welcome, {{org}}" page — a later plan fleshes out the real dashboard.

**Architecture:** New `src/ui/` subtree with `hono/jsx` TSX components. `createUiApp(deps)` is a separate Hono instance mounted into `app.ts` after `authed`. UI uses `requireAuth({ onUnauth: 'redirect' })` + `securityHeaders()`. Tailwind + htmx loaded via CDN `<script>` tags in `Layout`.

**Tech Stack:** Hono 4.x JSX, TypeScript (with `jsx: react-jsx`, `jsxImportSource: hono/jsx`), Tailwind via CDN, htmx 2.x via CDN.

**Spec:** `docs/superpowers/specs/done/2026-04-21-platform-http-ui-design.md` §4, §5 (entry rows only), §6, §8.8.

---

### Task 2.1: Enable JSX in tsconfig

**Files:**
- Modify: `rntme-cli/packages/platform-http/tsconfig.json`
- Modify: `rntme-cli/packages/platform-http/tsconfig.check.json`

- [ ] **Step 1: Update `tsconfig.json`**

Replace the file with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 2: Update `tsconfig.check.json`**

Replace with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
}
```

- [ ] **Step 3: Run typecheck to confirm nothing breaks**

Run: `pnpm -F @rntme-cli/platform-http typecheck`
Expected: success (no TSX files yet, but JSX flags are valid).

- [ ] **Step 4: Commit**

```bash
cd rntme-cli
git add packages/platform-http/tsconfig.json packages/platform-http/tsconfig.check.json
git commit -m "chore(platform-http): enable hono/jsx in tsconfig"
```

---

### Task 2.2: `render.tsx` helper

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/render.tsx`
- Test: `rntme-cli/packages/platform-http/test/unit/ui/render.test.tsx`

- [ ] **Step 1: Write failing test**

Create `test/unit/ui/render.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { renderHtml } from '../../../src/ui/render.js';

describe('renderHtml', () => {
  it('serves JSX with doctype and text/html content-type', async () => {
    const app = new Hono();
    app.get('/x', (c) => renderHtml(c, <div id="root">hi</div>));
    const r = await app.request('/x');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/text\/html; charset=utf-8/);
    const text = await r.text();
    expect(text.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(text).toContain('<div id="root">hi</div>');
  });

  it('escapes user content', async () => {
    const app = new Hono();
    const dangerous = '<script>alert(1)</script>';
    app.get('/x', (c) => renderHtml(c, <div>{dangerous}</div>));
    const r = await app.request('/x');
    const text = await r.text();
    expect(text).not.toContain('<script>alert(1)</script>');
    expect(text).toContain('&lt;script&gt;');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/render.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `render.tsx`**

Create `src/ui/render.tsx`:

```tsx
import type { Context } from 'hono';

/**
 * Render a JSX tree as a full HTML response with doctype and text/html charset.
 * All string interpolation in JSX is HTML-escaped by `hono/jsx` — do not bypass
 * by returning strings through `raw()` unless the source is trusted HTML.
 */
export function renderHtml(c: Context, node: JSX.Element, status: 200 | 400 | 403 | 404 | 500 = 200) {
  const body = '<!DOCTYPE html>\n' + String(node);
  c.status(status);
  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(body);
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/render.test.tsx`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/render.tsx packages/platform-http/test/unit/ui/render.test.tsx
git commit -m "feat(platform-http): add ui/renderHtml helper"
```

---

### Task 2.3: `Layout` + `Header` components

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/layout.tsx`
- Create: `rntme-cli/packages/platform-http/src/ui/components/header.tsx`
- Test: `rntme-cli/packages/platform-http/test/unit/ui/layout.test.tsx`

- [ ] **Step 1: Write failing test**

Create `test/unit/ui/layout.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { Layout } from '../../../src/ui/layout.js';

describe('Layout', () => {
  it('renders <html>, CDN tags, and children', () => {
    const html = String(
      <Layout title="My page">
        <p>hello</p>
      </Layout>,
    );
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>My page · rntme</title>');
    expect(html).toContain('src="https://cdn.tailwindcss.com"');
    expect(html).toContain('src="https://unpkg.com/htmx.org@2');
    expect(html).toContain('<p>hello</p>');
  });

  it('omits <Header> on public pages', () => {
    const html = String(
      <Layout title="Login" variant="public">
        <p>log in</p>
      </Layout>,
    );
    expect(html).not.toContain('<nav');
  });

  it('renders <Header> with org name on authed pages', () => {
    const html = String(
      <Layout
        title="Dash"
        variant="authed"
        subject={{
          account: { id: 'a1', displayName: 'Ada' } as never,
          org: { id: 'o1', slug: 'acme', displayName: 'Acme' } as never,
          role: 'member' as never,
          scopes: ['project:read'] as never,
          tokenId: null,
        } as never}
        otherOrgs={[]}
      >
        <main>body</main>
      </Layout>,
    );
    expect(html).toContain('<nav');
    expect(html).toContain('Acme');
    expect(html).toContain('Ada');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/layout.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `Header`**

Create `src/ui/components/header.tsx`:

```tsx
import type { AuthSubject } from '@rntme-cli/platform-core';
import type { Organization } from '@rntme-cli/platform-core';

export function Header(props: {
  subject: AuthSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
}) {
  const { subject, otherOrgs } = props;
  return (
    <nav class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-6">
          <a href="/" class="text-lg font-semibold tracking-tight text-gray-900">
            rntme
          </a>
          <div class="text-sm text-gray-600">
            <a href={`/${subject.org.slug}`} class="font-medium text-gray-900 hover:underline">
              {subject.org.displayName}
            </a>
            {otherOrgs.length > 0 && (
              <details class="relative ml-2 inline-block">
                <summary class="cursor-pointer text-xs text-gray-500 hover:text-gray-700">switch</summary>
                <ul class="absolute left-0 mt-1 min-w-[200px] rounded-md border border-gray-200 bg-white p-1 shadow-md">
                  {otherOrgs.map((o) => (
                    <li>
                      <a
                        href="/v1/auth/login"
                        class="block rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {o.displayName}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <div class="flex items-center gap-4 text-sm text-gray-600">
            <a href={`/${subject.org.slug}`} class="hover:text-gray-900">Projects</a>
            <a href={`/${subject.org.slug}/tokens`} class="hover:text-gray-900">Tokens</a>
            <a href={`/${subject.org.slug}/audit`} class="hover:text-gray-900">Audit</a>
          </div>
        </div>
        <div class="flex items-center gap-3 text-sm text-gray-600">
          <span>{subject.account.displayName}</span>
          <form method="post" action="/logout">
            <button type="submit" class="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Implement `Layout`**

Create `src/ui/layout.tsx`:

```tsx
import type { AuthSubject, Organization } from '@rntme-cli/platform-core';
import { Header } from './components/header.js';

type LayoutBase = {
  title: string;
  children: unknown;
  flash?: string | undefined;
};

type LayoutAuthed = LayoutBase & {
  variant: 'authed';
  subject: AuthSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
};

type LayoutPublic = LayoutBase & {
  variant: 'public';
};

type LayoutProps = LayoutAuthed | LayoutPublic;

export function Layout(props: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title} · rntme</title>
        <script src="https://cdn.tailwindcss.com" />
        <script
          src="https://unpkg.com/htmx.org@2.0.3"
          integrity="sha384-0895/pl2MU10Hqc6jd4RvrthNlDiE9U1tWmX7WRESftEDRosgxNsQG/Ze9YMRzHq"
          crossorigin="anonymous"
        />
      </head>
      <body class="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {props.variant === 'authed' && <Header subject={props.subject} otherOrgs={props.otherOrgs} />}
        {props.flash && <FlashBanner code={props.flash} />}
        <div class="mx-auto max-w-5xl px-4 py-8">{props.children as JSX.Element}</div>
      </body>
    </html>
  );
}

function FlashBanner(props: { code: string }) {
  const text = flashText(props.code);
  if (!text) return null;
  return (
    <div role="status" class="mx-auto max-w-5xl px-4 pt-4">
      <div class="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">{text}</div>
    </div>
  );
}

function flashText(code: string): string | null {
  switch (code) {
    case 'auth-failed':
      return 'Sign-in failed. Please try again.';
    case 'signed-out':
      return 'You have been signed out.';
    case 'token-revoked':
      return 'Token revoked.';
    default:
      return null;
  }
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/layout.test.tsx`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/layout.tsx packages/platform-http/src/ui/components/header.tsx packages/platform-http/test/unit/ui/layout.test.tsx
git commit -m "feat(platform-http): add UI Layout and Header components"
```

---

### Task 2.4: `LoginPage`, `NoOrgPage`, `ErrorPage`

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/pages/login.tsx`
- Create: `rntme-cli/packages/platform-http/src/ui/pages/no-org.tsx`
- Create: `rntme-cli/packages/platform-http/src/ui/pages/error.tsx`
- Test: `rntme-cli/packages/platform-http/test/unit/ui/pages.test.tsx`

- [ ] **Step 1: Write failing test**

Create `test/unit/ui/pages.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { LoginPage } from '../../../src/ui/pages/login.js';
import { NoOrgPage } from '../../../src/ui/pages/no-org.js';
import { ErrorPage } from '../../../src/ui/pages/error.js';

describe('LoginPage', () => {
  it('renders a Sign in link to /v1/auth/login', () => {
    const html = String(<LoginPage />);
    expect(html).toContain('href="/v1/auth/login"');
    expect(html).toMatch(/Sign in/i);
  });
});

describe('NoOrgPage', () => {
  it('renders empty state when no orgs', () => {
    const html = String(<NoOrgPage orgs={[]} />);
    expect(html).toMatch(/not a member of any organization/i);
    expect(html).toContain('/logout');
  });

  it('lists alternate orgs when present', () => {
    const html = String(
      <NoOrgPage orgs={[{ id: 'o1', slug: 'acme', displayName: 'Acme' } as never]} />,
    );
    expect(html).toContain('Acme');
  });
});

describe('ErrorPage', () => {
  it('renders status code and message', () => {
    const html = String(<ErrorPage status={404} title="Not found" detail="No such project" />);
    expect(html).toContain('404');
    expect(html).toContain('Not found');
    expect(html).toContain('No such project');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/pages.test.tsx`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement `LoginPage`**

Create `src/ui/pages/login.tsx`:

```tsx
import { Layout } from '../layout.js';

export function LoginPage(props: { flash?: string | undefined } = {}) {
  return (
    <Layout title="Sign in" variant="public" flash={props.flash}>
      <main class="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 class="text-2xl font-semibold tracking-tight">Sign in to rntme</h1>
        <p class="mt-2 max-w-md text-sm text-gray-600">
          Manage your projects, services, and API tokens on the rntme control-plane.
        </p>
        <a
          href="/v1/auth/login"
          class="mt-6 inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Sign in
        </a>
      </main>
    </Layout>
  );
}
```

- [ ] **Step 4: Implement `NoOrgPage`**

Create `src/ui/pages/no-org.tsx`:

```tsx
import { Layout } from '../layout.js';
import type { Organization } from '@rntme-cli/platform-core';

export function NoOrgPage(props: {
  orgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
}) {
  return (
    <Layout title="No organization" variant="public">
      <main class="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-700">
        <h1 class="text-xl font-semibold text-gray-900">You're not a member of any organization yet.</h1>
        <p class="mt-2">Ask an admin to invite you, or contact sales to create one.</p>

        {props.orgs.length > 0 && (
          <div class="mt-6">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Other orgs on this account</p>
            <ul class="mt-2 space-y-1">
              {props.orgs.map((o) => (
                <li>
                  <a class="text-sm text-blue-700 hover:underline" href="/v1/auth/login">
                    {o.displayName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form method="post" action="/logout" class="mt-6">
          <button type="submit" class="text-xs text-gray-500 hover:text-gray-700 hover:underline">
            Sign out
          </button>
        </form>
      </main>
    </Layout>
  );
}
```

- [ ] **Step 5: Implement `ErrorPage`**

Create `src/ui/pages/error.tsx`:

```tsx
import { Layout } from '../layout.js';

export function ErrorPage(props: {
  status: 400 | 403 | 404 | 500;
  title: string;
  detail?: string;
  backHref?: string;
}) {
  return (
    <Layout title={`${props.status} ${props.title}`} variant="public">
      <main class="mx-auto max-w-md rounded-md border border-gray-200 bg-white p-6 text-center">
        <p class="text-xs font-semibold uppercase tracking-widest text-gray-500">{props.status}</p>
        <h1 class="mt-2 text-xl font-semibold text-gray-900">{props.title}</h1>
        {props.detail && <p class="mt-2 text-sm text-gray-600">{props.detail}</p>}
        <a href={props.backHref ?? '/'} class="mt-6 inline-block text-sm text-blue-700 hover:underline">
          Back
        </a>
      </main>
    </Layout>
  );
}
```

- [ ] **Step 6: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/pages.test.tsx`
Expected: 4 passing.

- [ ] **Step 7: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/pages packages/platform-http/test/unit/ui/pages.test.tsx
git commit -m "feat(platform-http): add LoginPage, NoOrgPage, ErrorPage"
```

---

### Task 2.5: `createUiApp` with entry routes

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/app.tsx`
- Test: `rntme-cli/packages/platform-http/test/e2e/ui-auth.test.ts`

- [ ] **Step 1: Write failing e2e test**

Create `test/e2e/ui-auth.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootE2e, type E2eEnv } from './harness.js';
import { e2eContainersAvailable } from './docker-available.js';

describe.skipIf(!e2eContainersAvailable())('UI auth entry', () => {
  let env: E2eEnv;

  beforeAll(async () => {
    env = await bootE2e();
  }, 300_000);

  afterAll(async () => {
    await env.teardown();
  });

  it('GET / unauth → 302 to /login', async () => {
    const r = await env.app.request('/');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/login');
  });

  it('GET /login → 200 with Sign in link', async () => {
    const r = await env.app.request('/login');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/text\/html/);
    const body = await r.text();
    expect(body).toContain('href="/v1/auth/login"');
  });

  it('GET /login → has security headers', async () => {
    const r = await env.app.request('/login');
    expect(r.headers.get('content-security-policy')).toBeTruthy();
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('POST /logout without session → redirects to PLATFORM_BASE_URL', async () => {
    const r = await env.app.request('/logout', {
      method: 'POST',
      headers: { Origin: 'http://localhost', Accept: 'text/html' },
      redirect: 'manual',
    });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('http://localhost');
  });

  it('POST /logout with foreign Origin → 403', async () => {
    const r = await env.app.request('/logout', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', Accept: 'text/html' },
    });
    expect(r.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-auth.test.ts`
Expected: FAIL — `createUiApp` not mounted; `/` not handled; `/logout` not handled.

- [ ] **Step 3: Implement `createUiApp` (entry routes only)**

Create `src/ui/app.tsx`:

```tsx
import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import type { Pool } from 'pg';
import type pino from 'pino';
import type { Env } from '../config/env.js';
import type { WorkOSClient } from '../auth/workos-client.js';
import { requireAuth } from '../middleware/auth.js';
import { openOrgScopedTx } from '../middleware/tx.js';
import { sameOriginOnly } from '../middleware/same-origin.js';
import { securityHeaders } from '../middleware/security-headers.js';
import { ApiTokenProvider } from '../auth/api-token-provider.js';
import { WorkOSAuthKitProvider } from '../auth/workos-provider.js';
import type {
  OrganizationRepo,
  AccountRepo,
  MembershipMirrorRepo,
  TokenRepo,
} from '@rntme-cli/platform-core';
import { isOk } from '@rntme-cli/platform-core';
import { resolveDeps } from '../resolve-deps.js';
import { renderHtml } from './render.js';
import { LoginPage } from './pages/login.js';
import { NoOrgPage } from './pages/no-org.js';
import { ErrorPage } from './pages/error.js';

export type UiDeps = {
  env: Env;
  logger: pino.Logger;
  workos: WorkOSClient;
  cookiePassword: string;
  pool: Pool;
  poolRepos: {
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
    tokens: TokenRepo;
  };
};

export function createUiApp(deps: UiDeps): Hono {
  const app = new Hono();

  app.use('*', securityHeaders());

  // Public routes (no auth required).
  app.get('/login', (c) => {
    const flash = c.req.query('flash') ?? undefined;
    return renderHtml(c, <LoginPage flash={flash} />);
  });

  // Logout: clear cookie + redirect to WorkOS logout. Same-origin CSRF guard.
  app.post('/logout', sameOriginOnly(deps.env.PLATFORM_BASE_URL), async (c) => {
    const sealed = getCookie(c, 'rntme_session');
    let url = deps.env.PLATFORM_BASE_URL;
    if (sealed) {
      try {
        const session = deps.workos.userManagement.loadSealedSession({
          sessionData: sealed,
          cookiePassword: deps.cookiePassword,
        });
        url = await session.getLogoutUrl();
      } catch {
        /* stale session, just clear cookie */
      }
    }
    deleteCookie(c, 'rntme_session', { domain: deps.env.PLATFORM_SESSION_COOKIE_DOMAIN, path: '/' });
    return c.redirect(url, 302);
  });

  // Authed section.
  const apiTokenProvider = new ApiTokenProvider({
    tokens: deps.poolRepos.tokens,
    organizations: deps.poolRepos.organizations,
    accounts: deps.poolRepos.accounts,
    memberships: deps.poolRepos.memberships,
  });
  const workosProvider = new WorkOSAuthKitProvider({
    workos: deps.workos,
    cookiePassword: deps.cookiePassword,
    organizations: deps.poolRepos.organizations,
    accounts: deps.poolRepos.accounts,
    memberships: deps.poolRepos.memberships,
  });

  const authed = new Hono()
    .use('*', requireAuth([apiTokenProvider, workosProvider], { onUnauth: 'redirect', redirectTo: '/login' }))
    .use('*', openOrgScopedTx(deps.pool));

  authed.get('/', async (c) => {
    const s = c.get('subject');
    if (s.org && s.org.slug) return c.redirect(`/${s.org.slug}`, 302);
    return c.redirect('/no-org', 302);
  });

  authed.get('/no-org', async (c) => {
    const repos = resolveDeps(c.get('tx'));
    const s = c.get('subject');
    const r = await repos.organizations.listForAccount(s.account.id);
    const orgs = isOk(r) ? r.value : [];
    return renderHtml(c, <NoOrgPage orgs={orgs} />);
  });

  app.route('/', authed);

  app.notFound((c) =>
    renderHtml(c, <ErrorPage status={404} title="Not found" detail="No such page." />, 404),
  );

  return app;
}
```

- [ ] **Step 4: Mount in `app.ts`**

Modify `src/app.ts`. At the bottom of `createApp`, after `app.route('/', authed)`, add:

```ts
  app.route(
    '/',
    createUiApp({
      env: deps.env,
      logger: deps.logger,
      workos: deps.workos,
      cookiePassword: deps.cookiePassword,
      pool: deps.pool,
      poolRepos: {
        organizations: deps.poolRepos.organizations,
        accounts: deps.poolRepos.accounts,
        memberships: deps.poolRepos.memberships,
        tokens: deps.poolRepos.tokens,
      },
    }),
  );
```

Add the import near the other route imports:

```ts
import { createUiApp } from './ui/app.js';
```

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-auth.test.ts`
Expected: 5 passing.

- [ ] **Step 6: Run full suite**

Run: `pnpm -F @rntme-cli/platform-http test && pnpm -F @rntme-cli/platform-http typecheck && pnpm -F @rntme-cli/platform-http lint`
Expected: all green. Existing tests still pass because `/v1/*` routes were registered before the UI router.

- [ ] **Step 7: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/app.tsx packages/platform-http/src/app.ts packages/platform-http/test/e2e/ui-auth.test.ts
git commit -m "feat(platform-http): mount UI sub-router with auth entry pages"
```

---

## End of Plan 02

**What was built:**
- JSX enabled in both tsconfigs.
- `renderHtml(c, <Page/>)` helper with proper doctype and Content-Type.
- `Layout` + `Header` + `FlashBanner` components with Tailwind + htmx CDN.
- `LoginPage`, `NoOrgPage`, `ErrorPage`.
- `createUiApp(deps)` Hono sub-app with `GET /`, `GET /login`, `GET /no-org`, `POST /logout`, and a default 404.
- UI mounted into `app.ts` after `/v1/*` routes.
- Same-origin guard on `/logout`; security headers on all UI responses.

**What is still missing:** the dashboard itself. A user who signs in will be redirected to `/:orgSlug` which currently 404s. Plan 03 builds the read-only browse pages.

**Verification before moving to Plan 03:**

```bash
cd rntme-cli && pnpm -F @rntme-cli/platform-http test && pnpm -F @rntme-cli/platform-http typecheck && pnpm -F @rntme-cli/platform-http lint
```

Expected: all green.
