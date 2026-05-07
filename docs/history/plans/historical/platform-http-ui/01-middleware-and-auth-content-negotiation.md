> Status: historical.
> Date: unknown.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# platform-http UI — Plan 01: Middleware & Auth Content-Negotiation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare platform-http middleware & auth routes for a browser-facing UI: add an `onUnauth` option to `requireAuth`, a same-origin CSRF guard, a security-headers middleware, and content-negotiation on `/v1/auth/callback` and `/v1/auth/logout`.

**Architecture:** All changes live inside `rntme-cli/packages/platform-http`. No new dependencies. `/v1/*` JSON contract is preserved (tests assert the regression). After this plan, nothing user-visible changes — groundwork only.

**Tech Stack:** Hono 4.x, TypeScript, vitest, supertest, testcontainers (existing harness).

**Spec:** `docs/history/specs/historical/2026-04-21-platform-http-ui-design.md` §6.5, §6.6, §7.3, §8.8.

---

### Task 1.1: `requireAuth` gets an `onUnauth` option

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/middleware/auth.ts`
- Test: `rntme-cli/packages/platform-http/test/unit/middleware/auth.test.ts` (create or extend if already exists)

- [ ] **Step 1: Write failing unit test for redirect branch**

Create (or extend) `test/unit/middleware/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireAuth } from '../../../src/middleware/auth.js';
import type { IdentityProvider } from '@rntme-cli/platform-core';

const denyProvider: IdentityProvider = {
  authenticate: async () => ({ ok: false, error: { code: 'PLATFORM_AUTH_MISSING', message: 'no' } }),
};

describe('requireAuth', () => {
  it('returns JSON 401 by default when all providers deny', async () => {
    const app = new Hono();
    app.use('*', requireAuth([denyProvider]));
    app.get('/x', (c) => c.text('ok'));
    const r = await app.request('/x');
    expect(r.status).toBe(401);
    expect(r.headers.get('content-type')).toMatch(/application\/json/);
    const body = await r.json();
    expect(body.error.code).toBe('PLATFORM_AUTH_MISSING');
  });

  it('redirects to login when onUnauth is "redirect"', async () => {
    const app = new Hono();
    app.use('*', requireAuth([denyProvider], { onUnauth: 'redirect', redirectTo: '/login' }));
    app.get('/x', (c) => c.text('ok'));
    const r = await app.request('/x', { redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/login');
  });

  it('defaults redirectTo to /login', async () => {
    const app = new Hono();
    app.use('*', requireAuth([denyProvider], { onUnauth: 'redirect' }));
    app.get('/x', (c) => c.text('ok'));
    const r = await app.request('/x', { redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/login');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/middleware/auth.test.ts`
Expected: FAIL — `requireAuth` does not accept a second argument.

- [ ] **Step 3: Extend `requireAuth` signature**

Modify `src/middleware/auth.ts`:

```ts
import type { MiddlewareHandler } from 'hono';
import type { IdentityProvider, AuthSubject, Scope } from '@rntme-cli/platform-core';
import { isOk } from '@rntme-cli/platform-core';

declare module 'hono' {
  interface ContextVariableMap {
    subject: AuthSubject;
  }
}

export type RequireAuthOptions = {
  /** How to respond when every provider denies. Defaults to `'json'` for back-compat. */
  onUnauth?: 'json' | 'redirect';
  /** Target when `onUnauth` is `'redirect'`. Defaults to `/login`. */
  redirectTo?: string;
};

export function requireAuth(
  providers: readonly IdentityProvider[],
  options: RequireAuthOptions = {},
): MiddlewareHandler {
  const onUnauth = options.onUnauth ?? 'json';
  const redirectTo = options.redirectTo ?? '/login';
  return async (c, next) => {
    const ctx = {
      authorizationHeader: c.req.header('authorization'),
      cookieHeader: c.req.header('cookie'),
    };
    for (const p of providers) {
      const r = await p.authenticate(ctx);
      if (isOk(r)) {
        c.set('subject', r.value);
        return next();
      }
    }
    if (onUnauth === 'redirect') return c.redirect(redirectTo, 302);
    return c.json({ error: { code: 'PLATFORM_AUTH_MISSING', message: 'authentication required' } }, 401);
  };
}

export function requireScope(scope: Scope): MiddlewareHandler {
  return async (c, next) => {
    const s = c.get('subject');
    if (!s || !s.scopes.includes(scope)) {
      return c.json({ error: { code: 'PLATFORM_AUTH_FORBIDDEN', message: `missing scope ${scope}` } }, 403);
    }
    return next();
  };
}

export function requireOrgMatch(urlOrgSlugParam: string = 'orgSlug'): MiddlewareHandler {
  return async (c, next) => {
    const s = c.get('subject');
    const slug = c.req.param(urlOrgSlugParam);
    if (!s || s.org.slug !== slug) {
      return c.json({ error: { code: 'PLATFORM_AUTH_FORBIDDEN', message: 'org mismatch' } }, 403);
    }
    return next();
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/middleware/auth.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Run the full package test suite**

Run: `pnpm -F @rntme-cli/platform-http test`
Expected: all green (no existing caller passed a second arg, so no regression).

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/middleware/auth.ts packages/platform-http/test/unit/middleware/auth.test.ts
git commit -m "feat(platform-http): add onUnauth option to requireAuth"
```

---

### Task 1.2: Same-origin CSRF guard

**Files:**
- Create: `rntme-cli/packages/platform-http/src/middleware/same-origin.ts`
- Test: `rntme-cli/packages/platform-http/test/unit/middleware/same-origin.test.ts`

- [ ] **Step 1: Write failing unit test**

```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { sameOriginOnly } from '../../../src/middleware/same-origin.js';

describe('sameOriginOnly', () => {
  const make = (base: string) => {
    const app = new Hono();
    app.use('*', sameOriginOnly(base));
    app.post('/x', (c) => c.text('ok'));
    return app;
  };

  it('allows a request whose Origin matches the base URL', async () => {
    const app = make('https://platform.rntme.com');
    const r = await app.request('/x', {
      method: 'POST',
      headers: { Origin: 'https://platform.rntme.com' },
    });
    expect(r.status).toBe(200);
  });

  it('allows a request whose Referer starts with the base URL', async () => {
    const app = make('https://platform.rntme.com');
    const r = await app.request('/x', {
      method: 'POST',
      headers: { Referer: 'https://platform.rntme.com/tokens' },
    });
    expect(r.status).toBe(200);
  });

  it('rejects a request with a foreign Origin', async () => {
    const app = make('https://platform.rntme.com');
    const r = await app.request('/x', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    });
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.error.code).toBe('PLATFORM_AUTH_CSRF');
  });

  it('rejects a request with no Origin or Referer', async () => {
    const app = make('https://platform.rntme.com');
    const r = await app.request('/x', { method: 'POST' });
    expect(r.status).toBe(403);
  });

  it('skips GET requests', async () => {
    const app = new Hono();
    app.use('*', sameOriginOnly('https://platform.rntme.com'));
    app.get('/x', (c) => c.text('ok'));
    const r = await app.request('/x');
    expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/middleware/same-origin.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `sameOriginOnly`**

Create `src/middleware/same-origin.ts`:

```ts
import type { MiddlewareHandler } from 'hono';

/**
 * Blocks non-GET requests whose Origin (preferred) or Referer does not start
 * with the provided base URL. Defence-in-depth alongside SameSite=Lax cookies.
 *
 * Intended for UI mutation routes only. API routes on /v1/* should not use this —
 * bearer tokens are their CSRF defence.
 */
export function sameOriginOnly(baseUrl: string): MiddlewareHandler {
  const base = baseUrl.replace(/\/$/, '');
  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      return next();
    }
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');
    const matches =
      (origin !== undefined && origin === base) ||
      (referer !== undefined && referer.startsWith(base + '/'));
    if (!matches) {
      return c.json({ error: { code: 'PLATFORM_AUTH_CSRF', message: 'cross-origin request blocked' } }, 403);
    }
    return next();
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/middleware/same-origin.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/middleware/same-origin.ts packages/platform-http/test/unit/middleware/same-origin.test.ts
git commit -m "feat(platform-http): add sameOriginOnly CSRF middleware"
```

---

### Task 1.3: Security-headers middleware

**Files:**
- Create: `rntme-cli/packages/platform-http/src/middleware/security-headers.ts`
- Test: `rntme-cli/packages/platform-http/test/unit/middleware/security-headers.test.ts`

- [ ] **Step 1: Write failing unit test**

```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { securityHeaders } from '../../../src/middleware/security-headers.js';

describe('securityHeaders', () => {
  const app = new Hono();
  app.use('*', securityHeaders());
  app.get('/x', (c) => c.text('ok'));

  it('sets Content-Security-Policy', async () => {
    const r = await app.request('/x');
    const csp = r.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://cdn.tailwindcss.com https://unpkg.com");
    expect(csp).toContain("form-action 'self'");
  });

  it('sets X-Content-Type-Options', async () => {
    const r = await app.request('/x');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('sets Referrer-Policy', async () => {
    const r = await app.request('/x');
    expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/middleware/security-headers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `securityHeaders`**

Create `src/middleware/security-headers.ts`:

```ts
import type { MiddlewareHandler } from 'hono';

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.tailwindcss.com https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
  "connect-src 'self'",
  "img-src 'self' data:",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Security headers for UI (HTML) responses. Do not apply to /v1/* JSON API —
 * the CSP would block nothing useful there but adds noise to headers.
 */
export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.res.headers.set('Content-Security-Policy', CSP);
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/middleware/security-headers.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/middleware/security-headers.ts packages/platform-http/test/unit/middleware/security-headers.test.ts
git commit -m "feat(platform-http): add securityHeaders middleware"
```

---

### Task 1.4: Content-negotiation on `/v1/auth/callback`

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/routes/auth.ts`
- Test: extend `rntme-cli/packages/platform-http/test/unit/routes/auth.test.ts` (create if absent)

- [ ] **Step 1: Write failing tests**

Extend (or create) `test/unit/routes/auth.test.ts`. Assumes a helper `buildAuthApp()` — if it doesn't exist, inline construction as below:

```ts
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from '../../../src/routes/auth.js';

function makeApp() {
  const workos = {
    userManagement: {
      getAuthorizationUrl: () => 'https://workos.test/start',
      authenticateWithCode: vi.fn(async () => ({
        user: { id: 'u1', email: 'u@example.com', firstName: 'U', lastName: 'X' },
        organizationId: 'org_x',
        sealedSession: 'sealed',
      })),
      loadSealedSession: () => ({
        authenticate: async () => ({ authenticated: true, user: { id: 'u1' }, organizationId: 'org_x' }),
        getLogoutUrl: async () => 'https://workos.test/logout',
      }),
    },
    organizations: { getOrganization: async () => ({ name: 'Org X', slug: 'org-x' }) },
  } as never;
  const repos = {
    organizations: { upsertFromWorkos: async () => ({ ok: true, value: {} }) },
    accounts: { upsertFromWorkos: async () => ({ ok: true, value: {} }) },
    memberships: {} as never,
  } as never;
  const env = {
    WORKOS_CLIENT_ID: 'cid',
    WORKOS_REDIRECT_URI: 'http://localhost/callback',
    PLATFORM_BASE_URL: 'http://localhost',
    PLATFORM_SESSION_COOKIE_DOMAIN: 'localhost',
  } as never;
  const app = new Hono();
  app.route('/v1/auth', authRoutes({ workos, env, cookiePassword: 'x'.repeat(32), repos }));
  return app;
}

describe('/v1/auth/callback content-negotiation', () => {
  it('returns JSON when Accept: application/json', async () => {
    const app = makeApp();
    const r = await app.request('/v1/auth/callback?code=abc', {
      headers: { Accept: 'application/json' },
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/application\/json/);
    const body = await r.json();
    expect(body.account.workosUserId).toBe('u1');
  });

  it('redirects to / when Accept is text/html', async () => {
    const app = makeApp();
    const r = await app.request('/v1/auth/callback?code=abc', {
      headers: { Accept: 'text/html' },
      redirect: 'manual',
    });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/');
  });

  it('redirects to / when no Accept header (browser default)', async () => {
    const app = makeApp();
    const r = await app.request('/v1/auth/callback?code=abc', { redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/routes/auth.test.ts`
Expected: FAIL — current callback always returns JSON.

- [ ] **Step 3: Modify `/v1/auth/callback`**

In `src/routes/auth.ts`, replace the callback handler's final return with content-negotiation. Find this block:

```ts
      return c.json({ account: { workosUserId: user.id }, org: { workosOrganizationId: organizationId ?? null } });
    } catch (cause) {
      return c.json({ error: { code: 'PLATFORM_AUTH_INVALID', message: String(cause) } }, 401);
    }
```

Replace with:

```ts
      const wantsJson = (c.req.header('accept') ?? '').toLowerCase().includes('application/json');
      if (wantsJson) {
        return c.json({ account: { workosUserId: user.id }, org: { workosOrganizationId: organizationId ?? null } });
      }
      return c.redirect('/', 302);
    } catch (cause) {
      const wantsJson = (c.req.header('accept') ?? '').toLowerCase().includes('application/json');
      if (wantsJson) {
        return c.json({ error: { code: 'PLATFORM_AUTH_INVALID', message: String(cause) } }, 401);
      }
      return c.redirect('/login?flash=auth-failed', 302);
    }
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/routes/auth.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/routes/auth.ts packages/platform-http/test/unit/routes/auth.test.ts
git commit -m "feat(platform-http): content-negotiation on /v1/auth/callback"
```

---

### Task 1.5: Content-negotiation on `/v1/auth/logout`

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/routes/auth.ts`
- Test: extend `rntme-cli/packages/platform-http/test/unit/routes/auth.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `test/unit/routes/auth.test.ts`:

```ts
describe('/v1/auth/logout content-negotiation', () => {
  it('returns JSON with logoutUrl when Accept: application/json', async () => {
    const app = makeApp();
    const r = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Cookie: 'rntme_session=sealed',
      },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.logoutUrl).toBe('https://workos.test/logout');
  });

  it('redirects to WorkOS logout URL when Accept is text/html', async () => {
    const app = makeApp();
    const r = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        Cookie: 'rntme_session=sealed',
      },
      redirect: 'manual',
    });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://workos.test/logout');
  });

  it('redirects to PLATFORM_BASE_URL when no session cookie and Accept is text/html', async () => {
    const app = makeApp();
    const r = await app.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Accept: 'text/html' },
      redirect: 'manual',
    });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('http://localhost');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/routes/auth.test.ts`
Expected: FAIL — logout always returns JSON.

- [ ] **Step 3: Modify `/v1/auth/logout`**

In `src/routes/auth.ts`, find the logout handler:

```ts
  app.post('/logout', async (c) => {
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
    return c.json({ logoutUrl: url });
  });
```

Replace the final `return c.json(...)` with:

```ts
    deleteCookie(c, 'rntme_session', { domain: deps.env.PLATFORM_SESSION_COOKIE_DOMAIN, path: '/' });
    const wantsJson = (c.req.header('accept') ?? '').toLowerCase().includes('application/json');
    if (wantsJson) return c.json({ logoutUrl: url });
    return c.redirect(url, 302);
  });
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/routes/auth.test.ts`
Expected: 6 passing (3 callback + 3 logout).

- [ ] **Step 5: Run the full package test suite**

Run: `pnpm -F @rntme-cli/platform-http test`
Expected: all green. Existing e2e `agent-workflow.test.ts` uses bearer tokens, not the auth cookie — no regression.

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/routes/auth.ts packages/platform-http/test/unit/routes/auth.test.ts
git commit -m "feat(platform-http): content-negotiation on /v1/auth/logout"
```

---

## End of Plan 01

**What was built:**
- `requireAuth(providers, { onUnauth, redirectTo })` — unchanged JSON default, new redirect branch.
- `sameOriginOnly(baseUrl)` — CSRF guard for mutating UI routes.
- `securityHeaders()` — CSP + nosniff + Referrer-Policy for UI responses.
- `/v1/auth/callback` and `/v1/auth/logout` — browser gets 302, JSON callers unchanged.

**What is still missing:** no UI routes yet. Plan 02 builds the UI scaffold on top of these primitives.

**Verification before merging plan 01:**

```bash
cd rntme-cli && pnpm -F @rntme-cli/platform-http test && pnpm -F @rntme-cli/platform-http typecheck && pnpm -F @rntme-cli/platform-http lint
```

Expected: all green.
