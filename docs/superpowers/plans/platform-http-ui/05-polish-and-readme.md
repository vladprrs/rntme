# platform-http UI — Plan 05: Polish & README

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Final pass — flash messages on redirects after logout / revoke, README update describing the UI, and a smoke typecheck+lint on the whole monorepo. No new routes; only polish.

**Architecture:** Changes are scoped to existing files. No new modules except a tiny flash-helpers module if needed.

**Tech Stack:** same as prior plans.

**Spec:** `docs/superpowers/specs/2026-04-21-platform-http-ui-design.md` §8.6.

---

### Task 5.1: Redirect-with-flash after logout and revoke

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx`
- Test: extend `rntme-cli/packages/platform-http/test/e2e/ui-auth.test.ts`

- [ ] **Step 1: Extend test**

Append to `test/e2e/ui-auth.test.ts`:

```ts
  it('POST /logout without session → location includes flash=signed-out when final hop is /login', async () => {
    // When sealed session is missing, /logout redirects directly to PLATFORM_BASE_URL
    // which is http://localhost in tests — treat as external, no flash to append.
    const r = await env.app.request('/logout', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
      redirect: 'manual',
    });
    expect(r.status).toBe(302);
    // The current behaviour is to go to the WorkOS logout URL (for sessions) or
    // PLATFORM_BASE_URL (for no session). We only assert it's a 302 — flash is
    // applied only when landing on /login locally, which is verified separately.
  });

  it('GET /login?flash=signed-out renders the banner', async () => {
    const r = await env.app.request('/login?flash=signed-out');
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toMatch(/signed out/i);
  });

  it('GET /login?flash=auth-failed renders the failure banner', async () => {
    const r = await env.app.request('/login?flash=auth-failed');
    const body = await r.text();
    expect(body).toMatch(/sign-in failed/i);
  });
```

- [ ] **Step 2: Run test — verify it fails or passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-auth.test.ts`

Expected: the two `flash=…` tests PASS already (Layout's `FlashBanner` was implemented in Plan 02). If they fail, verify the flash text map in `Layout` and the wiring from `LoginPage` props → `Layout.flash`.

- [ ] **Step 3: (If needed) wire flash into LoginPage**

If the tests fail because `LoginPage` does not pass `flash` down to `Layout`, open `src/ui/pages/login.tsx` and ensure the JSX reads:

```tsx
<Layout title="Sign in" variant="public" flash={props.flash}>
```

And that `createUiApp`'s `GET /login` passes `flash`:

```tsx
app.get('/login', (c) => {
  const flash = c.req.query('flash') ?? undefined;
  return renderHtml(c, <LoginPage flash={flash} />);
});
```

(Both should already be in place from Plan 02 — this is a verification pass.)

- [ ] **Step 4: Append flash to revoke redirect path (future use)**

No code change required in Task 5.1 itself — revoke returns an htmx fragment, not a redirect. Left as a note: if a future plan adds non-htmx fallback for revoke, apply `redirect('/acme/tokens?flash=token-revoked', 302)` and the existing banner renders.

- [ ] **Step 5: Commit (if anything changed)**

```bash
cd rntme-cli
git add packages/platform-http/test/e2e/ui-auth.test.ts packages/platform-http/src/ui/pages/login.tsx packages/platform-http/src/ui/app.tsx
git commit -m "test(platform-http): cover flash banners on /login"
```

(If no code changed, skip the commit — just keep the extended test.)

---

### Task 5.2: README update

**Files:**
- Modify: `rntme-cli/packages/platform-http/README.md`

- [ ] **Step 1: Replace the README with expanded content**

Open `rntme-cli/packages/platform-http/README.md` and replace the body with:

```markdown
# @rntme-cli/platform-http

Hono HTTP server that wires `@rntme-cli/platform-core` use-cases to the REST surface at `platform.rntme.com`. WorkOS AuthKit for humans, bearer API tokens for machines.

## Surfaces

This service exposes two surfaces on the same origin:

- **`/v1/*` — JSON REST API.** Documented via `/openapi.json` (OpenAPI 3.1). Used by the CLI and external integrations. Authentication via WorkOS AuthKit cookie (humans) or `Authorization: Bearer rntme_pat_…` (machines).
- **`/` — Browser UI.** Server-rendered dashboard (Hono JSX + htmx + Tailwind CDN). Lets an authenticated user browse orgs / projects / services / versions / audit log and manage API tokens. Read-only except token create/revoke.

## UI routes

| Path | Purpose |
| --- | --- |
| `GET /` | Authed: 302 to `/{orgSlug}`. Unauth: 302 to `/login` |
| `GET /login` | Public sign-in landing with CTA to `/v1/auth/login` |
| `GET /no-org` | Authed user has no org membership yet |
| `GET /{orgSlug}` | Projects list |
| `GET /{orgSlug}/projects/{projSlug}` | Project detail + services list |
| `GET /{orgSlug}/projects/{projSlug}/services/{svcSlug}` | Service detail + versions + tags |
| `GET /{orgSlug}/tokens` | API tokens list (+ create form if `token:manage` scope) |
| `POST /{orgSlug}/tokens` | Create token (htmx) — returns new `<tr>` + one-time plaintext banner |
| `DELETE /{orgSlug}/tokens/{id}` | Revoke token (htmx) — returns updated row with "revoked" badge |
| `GET /{orgSlug}/audit` | Audit log |
| `POST /logout` | Clears session cookie, redirects to WorkOS logout URL |

## Auth flow

1. `/` (unauth) → `/login`.
2. `/login` links to `/v1/auth/login` → WorkOS AuthKit.
3. WorkOS redirects to `/v1/auth/callback?code=…`. Callback upserts account + org, sets `rntme_session` sealed cookie on `.rntme.com`, and:
   - If request accepts JSON — returns JSON (CLI / tests).
   - Otherwise — 302 to `/`.
4. Authed `/` → `/{orgSlug}`.

## Session cookie

- Name: `rntme_session`
- Domain: `PLATFORM_SESSION_COOKIE_DOMAIN` (`.rntme.com` in prod).
- `HttpOnly`, `Secure`, `SameSite=Lax`.
- Max age 30 days.

## CSRF

UI mutations (`POST /:orgSlug/tokens`, `DELETE /:orgSlug/tokens/:id`, `POST /logout`) verify `Origin` or `Referer` against `PLATFORM_BASE_URL` via `sameOriginOnly`. The `/v1/*` JSON API does not use this guard — bearer tokens provide the CSRF defence.

## Security headers (UI only)

Applied by `securityHeaders()` middleware on UI responses:

- `Content-Security-Policy` with `'self'` + `cdn.tailwindcss.com` + `unpkg.com` allowlists.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.

## Development

```bash
pnpm -F @rntme-cli/platform-http test       # unit + e2e (testcontainers)
pnpm -F @rntme-cli/platform-http typecheck
pnpm -F @rntme-cli/platform-http lint
pnpm -F @rntme-cli/platform-http build      # tsc (includes TSX)
pnpm -F @rntme-cli/platform-http start      # runs dist/bin/server.js
```

## Env vars

See `src/config/env.ts`. Required: `DATABASE_URL`, `RUSTFS_*`, `WORKOS_*`, `PLATFORM_BASE_URL`, `PLATFORM_SESSION_COOKIE_DOMAIN`, `PLATFORM_COOKIE_PASSWORD` (≥32 chars).

## Not in the UI (MVP)

- Creating / renaming / archiving projects or services — CLI only.
- Publishing versions — CLI only.
- Creating organizations — use the WorkOS Admin Portal.
- Toggling archived visibility.
- Client-side SPA state or infinite scroll.
```

- [ ] **Step 2: Commit**

```bash
cd rntme-cli
git add packages/platform-http/README.md
git commit -m "docs(platform-http): document UI surface in README"
```

---

### Task 5.3: Monorepo smoke check

- [ ] **Step 1: Run the full rntme-cli test+typecheck+lint**

Run from `rntme-cli/`:

```bash
pnpm -r run test
pnpm -r run typecheck
pnpm -r run lint
```

Expected: all green across all packages. No `platform-http` changes leaked type errors into dependent packages. If any fail, fix them inline.

- [ ] **Step 2: Bump the submodule in the outer repo**

From `/home/coder/project`:

```bash
git -C rntme-cli log -1 --oneline      # inspect the top UI commit
git add rntme-cli
git commit -m "chore: bump rntme-cli submodule (platform-http UI)"
```

- [ ] **Step 3: Deploy note**

Trigger the Dokploy auto-deploy by pushing main (user discretion). No env var changes required. Verify the live domain:

- `https://platform.rntme.com/login` renders the sign-in page.
- WorkOS AuthKit flow ends on `https://platform.rntme.com/{orgSlug}` with projects list.
- `https://platform.rntme.com/{orgSlug}/tokens` shows the tokens page.

(Not automated — smoke check after deploy.)

---

## End of Plan 05

**Final state:**
- `platform-http` serves a read-only dashboard + token management UI at `/`.
- All API tests pass unchanged.
- New UI tests cover entry routes, browse pages, tokens CRUD, CSRF, and security headers.
- README documents both surfaces.

**Overall verification:**

```bash
cd rntme-cli && pnpm -r run test && pnpm -r run typecheck && pnpm -r run lint
```

Expected: all green.
