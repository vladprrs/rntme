> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# platform-http UI — design

**Status:** design
**Author:** brainstorm 2026-04-21
**Related:**
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` (control-plane REST surface)
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` (context for platform-http's role)
- `docs/superpowers/specs/done/2026-04-20-landing-design.md` (visual restraint baseline)

**Implementation locations:**
- `rntme-cli/packages/platform-http/src/ui/` — new UI sub-router, pages, fragments
- `rntme-cli/packages/platform-http/src/app.ts` — mount UI router, tsconfig JSX flags
- `rntme-cli/packages/platform-http/src/routes/auth.ts` — content-negotiation on callback/logout
- `rntme-cli/packages/platform-http/src/middleware/auth.ts` — `onUnauth` option on `requireAuth`
- `rntme-cli/packages/platform-http/src/middleware/same-origin.ts` — new
- `rntme-cli/packages/platform-http/src/middleware/security-headers.ts` — new

## 1. Problem

`platform-http` exposes a REST control-plane (`/v1/*`) at `platform.rntme.com`, authenticated by WorkOS AuthKit (humans) and bearer tokens (machines). Today the only way a human can inspect their orgs, projects, services, versions, tokens, or audit log is via `curl` or the CLI. There is no browser-facing surface — not even a sign-in page.

For a user who just finished signing up through WorkOS, the control-plane is effectively invisible. The landing at `rntme.com` markets the product; the platform host has no entry point.

## 2. Goal

Ship a minimal server-rendered UI at `https://platform.rntme.com/` that lets a human:

1. Sign in / sign out via WorkOS AuthKit.
2. Browse their orgs, projects, services, and versions read-only.
3. Browse the audit log.
4. Create and revoke API tokens (the one mutation that is genuinely awkward to perform from CLI, because the plaintext is shown once).

**In scope:**
- New UI sub-router in `platform-http`, mounted at `/`, using `hono/jsx` for server-rendered TSX components and htmx for token mutations.
- Tailwind CSS via CDN, no bundler.
- Content-negotiation on `/v1/auth/callback` and `/v1/auth/logout` so browsers get 302s and existing JSON clients keep working.
- `onUnauth: 'redirect' | 'json'` option on the existing `requireAuth` middleware.
- Same-origin CSRF guard and CSP for UI routes.
- Unit + integration tests in the existing test harness.

**Explicitly out of scope (MVP):**
- Any mutations beyond token create/revoke (no create project/service, no publish version, no archive, no rename).
- Org creation — WorkOS Admin Portal already covers that.
- Toggle for `includeArchived`.
- Infinite scroll / rich pagination (audit uses cursor-based "Load more").
- Client-side SPA state. Every page is a fresh server render; htmx only swaps token fragments.
- Visual regression tests; real WorkOS end-to-end flow.
- OpenAPI entries for UI routes — they are implementation detail, not public API.

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| Q1 | Where does the UI live? | Same origin as `/v1/*`, mounted at `/` inside `platform-http` |
| Q2 | SSR or SPA? | SSR with htmx for interactivity |
| Q3 | Template approach? | `hono/jsx` TSX components |
| Q4 | Styling? | Tailwind CDN (`cdn.tailwindcss.com`) |
| Q5 | Scope? | Read-only browse + token create/revoke + login/logout |
| Q6 | UI routes in OpenAPI? | No |
| Q7 | `includeArchived` toggle? | No (MVP shows only active) |
| Q8 | Org switching | In MVP, re-login via WorkOS; header lists other orgs as links to `/v1/auth/login` |
| Q9 | CSRF? | Same-origin `Origin`/`Referer` check on UI mutations; SameSite=Lax cookie already set |
| Q10 | `/v1/auth/callback` response | Content-negotiation: `Accept: application/json` → JSON (as today); else 302 to `/` |
| Q11 | Fresh page data | Full page reload on every nav; htmx only swaps token list fragments |
| Q12 | New npm deps? | None. `hono` already ships `hono/jsx`; Tailwind + htmx are `<script>` tags |
| Q13 | Build tooling? | `tsc` handles TSX with two tsconfig flags. No esbuild/Vite. |

## 4. Architecture

### 4.1 File layout

```
rntme-cli/packages/platform-http/src/
  ui/                          (NEW)
    app.tsx                    createUiApp(deps): Hono — UI router
    layout.tsx                 <Layout>: <html>, Tailwind CDN, htmx CDN, header, flash
    render.tsx                 renderHtml(c, <Page/>): Response with doctype + correct Content-Type
    components/
      header.tsx               logo, current org, org switcher, logout button
      table.tsx                <DataTable>, <EmptyState>
      relative-time.tsx        <time datetime=…>…ago</time>, server-rendered via Intl.RelativeTimeFormat
    pages/
      login.tsx                public "Sign in with rntme"
      no-org.tsx               authed but no org
      org.tsx                  /:orgSlug — projects list
      project.tsx              /:orgSlug/projects/:projSlug — services list
      service.tsx              /:orgSlug/projects/:projSlug/services/:svcSlug — versions list
      tokens.tsx               /:orgSlug/tokens — list + create form
      audit.tsx                /:orgSlug/audit — audit log
      error.tsx                generic 4xx/5xx pages
    fragments/
      token-row.tsx            htmx target: one <tr>
      token-created.tsx        htmx swap: new <tr> + one-time plaintext banner
  middleware/
    same-origin.ts             (NEW) sameOriginOnly(): Origin/Referer check
    security-headers.ts        (NEW) CSP, X-Content-Type-Options, Referrer-Policy
```

### 4.2 Integration with existing stack

`ui/app.tsx` reuses the existing middleware chain: `requireAuth([apiTokenProvider, workosProvider], { onUnauth: 'redirect', redirectTo: '/login' })` → `rateLimit` → `openOrgScopedTx(pool)` → `requireOrgMatch('orgSlug')` for org-scoped routes. It calls use-case functions from `@rntme-cli/platform-core` directly (`listProjects`, `listServices`, versions, `listTokens`, `createToken`, `revokeToken`, `organizations.listForAccount`). No self-HTTP loops.

Mounting order in `app.ts` (matching existing `const authed = new Hono()...app.route('/', authed)` idiom):

```
app.route('/', opsRoutes(...))               // /healthz, /openapi.json (existing)
app.route('/v1/webhooks', webhookWorkosRoute(...))
app.route('/v1/auth', authRoutes(...))       // login/callback/logout (modified)
app.route('/', authed)                       // existing /v1/auth/me + /v1/orgs/*
app.route('/', createUiApp(deps))            // NEW — UI at /, /login, /:orgSlug, etc.
```

`createUiApp` is a separate Hono instance with its own middleware chain; it mounts last so explicit `/v1/*` and `/healthz` paths always win routing at the outer `app`. UI routes: `/`, `/login`, `/logout`, `/no-org`, `/:orgSlug`, `/:orgSlug/projects/:projSlug`, `/:orgSlug/projects/:projSlug/services/:svcSlug`, `/:orgSlug/tokens`, `/:orgSlug/tokens/:id` (DELETE), `/:orgSlug/audit`.

### 4.3 Build

Two fields added to both `tsconfig.json` and `tsconfig.check.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  }
}
```

No new dependencies in `package.json`. `hono` already exports `hono/jsx`. Tailwind + htmx load via `<script>` in `Layout`.

## 5. Page inventory

All routes below (except `/login`) pass `requireAuth` + `openOrgScopedTx`; routes with `:orgSlug` also pass `requireOrgMatch('orgSlug')` (returns 403 if the URL's org differs from the subject's org).

| Method + path | Handler behaviour | Core calls |
|---|---|---|
| `GET /` | authed: 302 to `/:currentOrgSlug`; unauth: 302 to `/login`; authed-but-no-org: 302 to `/no-org` | — |
| `GET /login` | Public. Renders `<LoginPage>` with `<a href="/v1/auth/login">Sign in</a>` | — |
| `GET /no-org` | Authed, no org. "Ask an admin to invite you." Lists any other orgs the account is a member of via `listForAccount` | `organizations.listForAccount` |
| `GET /:orgSlug` | Projects list + empty state | `listProjects(orgId, { includeArchived: false })` |
| `GET /:orgSlug/projects/:projSlug` | Project header + services list | `projects.findBySlug` + `listServices` |
| `GET /:orgSlug/projects/:projSlug/services/:svcSlug` | Service header + versions list (concurrent fetch of detail + versions) | `services.findBySlug` + `getServiceDetail` + versions list |
| `GET /:orgSlug/tokens` | Tokens table + create form (form hidden if no `token:manage` scope) | `listTokens(orgId)` |
| `POST /:orgSlug/tokens` | htmx: validates body, calls `createToken`, returns `<TokenCreated>` fragment (new `<tr>` + one-time plaintext banner) | `createToken` |
| `DELETE /:orgSlug/tokens/:id` | htmx: calls `revokeToken`, returns updated `<TokenRow>` with `status="revoked"` | `revokeToken` |
| `GET /:orgSlug/audit` | Paginated audit list (`?cursor=…` → "Load more" htmx fragment) | `listAudit` (existing) |
| `POST /logout` | Calls WorkOS `getLogoutUrl`, clears cookie, 302 to WorkOS logout URL | reuses `/v1/auth/logout` logic |

**Row status convention.** Archived / revoked rows render with muted styling but are not hidden in MVP (except `includeArchived=false` on projects, which hides them at the query level).

## 6. Auth flow

### 6.1 Login

1. Unauth user hits `/`. `requireAuth` with `onUnauth: 'redirect'` → 302 to `/login`.
2. `/login` renders a public page with one CTA linking to `/v1/auth/login`.
3. `/v1/auth/login` (existing) redirects to WorkOS AuthKit. WorkOS handles register/sign-in/SSO/org-pick.
4. WorkOS returns to `/v1/auth/callback?code=…`. Callback (existing) calls `authenticateWithCode`, upserts account + org, sets sealed session cookie.
5. **Modified response**: the callback inspects `Accept`. If it contains `application/json`, it returns the current JSON response (for tests / any JSON caller). Otherwise it returns `c.redirect('/')`.
6. Browser lands on `/`; now authed; handler reads `subject.org.slug` and 302s to `/:orgSlug`.

### 6.2 No-org state

If `subject.org` is absent (session was created without `organizationId`) or the account is not a member of any org per the mirror, handler 302s to `/no-org`. The page shows `listForAccount` results (may be empty) and tells the user to ask an admin for an invite. This path is only reachable if WorkOS returns a session without an org — rare but possible immediately after sign-up.

### 6.3 Logout

Header logout button = htmx `POST /logout`. The UI handler shares logic with the existing `/v1/auth/logout`: loads sealed session, calls `getLogoutUrl()`, clears the `rntme_session` cookie on `.rntme.com`, then returns either a 302 to the WorkOS logout URL (browser) or the JSON body (existing behaviour) based on `Accept`.

### 6.4 Org switching

MVP: header renders current org plus a list of other orgs from `listForAccount(subject.account.id)`. Each other org is a plain link to `/v1/auth/login`. Clicking it re-enters the WorkOS AuthKit flow, where WorkOS's own org picker handles selection. No `organizationId` hint passed in state for MVP — keeps the code paths identical to first-time login.

### 6.5 CSRF

All UI mutations (`POST /:orgSlug/tokens`, `DELETE /:orgSlug/tokens/:id`, `POST /logout`) require `sameOriginOnly()` middleware on the route: verifies `Origin` OR `Referer` starts with `PLATFORM_BASE_URL`. Combined with `SameSite=Lax` on the session cookie and the existing CORS middleware, cross-site POSTs are blocked. The `/v1/*` API does not use this middleware — bearer tokens are the CSRF defence there.

### 6.6 requireAuth changes

Current `requireAuth(providers)` returns JSON 401 on unauth. New signature:

```
requireAuth(providers, options?: {
  onUnauth?: 'json' | 'redirect';  // default 'json' (back-compat)
  redirectTo?: string;             // default '/login'
})
```

UI router instantiates with `'redirect'`. `/v1/*` keeps `'json'` (default, no change).

## 7. Data flow

### 7.1 Request lifecycle (example: `GET /:orgSlug`)

1. Middleware chain runs: `requireAuth` → `rateLimit` → `openOrgScopedTx` → `requireOrgMatch('orgSlug')`.
2. Handler: `const repos = resolveDeps(c.get('tx'))`.
3. `const r = await listProjects({ repos: { projects: repos.projects } }, { orgId: subject.org.id, includeArchived: false })`.
4. If `!r.ok` → `return renderError(c, r.error)`.
5. Else → `return renderHtml(c, <OrgPage subject={subject} projects={r.value} />)`.

`renderHtml` returns `c.html('<!DOCTYPE html>\n' + jsx, 200, { 'Content-Type': 'text/html; charset=utf-8' })`.

### 7.2 Parallel fetches

Service page needs `findBySlug` then `Promise.all([getServiceDetail, versionsList])`. No new aggregation use-cases in core — UI handler orchestrates 1-2 existing calls.

### 7.3 Error mapping

Generic `renderError(c, code, detail?)` maps:

| Code / status | UI response |
|---|---|
| 401 (unauth) | 302 to `/login` (handled by `requireAuth({ onUnauth: 'redirect' })`) |
| 403 `PLATFORM_AUTH_FORBIDDEN` | 403 HTML page, "Not authorized", link to `/` |
| 404 `PLATFORM_TENANCY_*_NOT_FOUND` | 404 HTML, link to parent level |
| 5xx | Generic 500 page; pino logs details |

### 7.4 htmx contract for tokens

- **Create:** `<form hx-post="/:orgSlug/tokens" hx-target="#tokens-tbody" hx-swap="afterbegin">`. Response = `<TokenCreated>` fragment: one `<tr>` + one-time `<div role="alert">` with plaintext + a "Copy" button. Plaintext disappears on next nav; never stored.
- **Revoke:** `<button hx-delete="/:orgSlug/tokens/:id" hx-target="closest tr" hx-swap="outerHTML">`. Response = updated `<TokenRow>` with status="revoked" styling.
- Both endpoints enforce `sameOriginOnly()` and `requireScope('token:manage')`.

### 7.5 No client state

Every page renders fully server-side. htmx swaps are localized to the token list. Any other navigation is a full reload, so the UI cannot drift from the backend.

## 8. UX details

### 8.1 Empty states

- `/no-org`: "You're not a member of any organization yet." + CTA: "Contact an admin to invite you" + logout link.
- `/:orgSlug` with no projects: "No projects yet." + CLI hint: `rntme platform project create` (exact CLI syntax verified during implementation).
- `/:orgSlug/projects/:projSlug` with no services: analogous CLI hint.
- `/:orgSlug/projects/:projSlug/services/:svcSlug` with no versions: "No versions published yet." + CLI hint.
- `/:orgSlug/tokens` with no tokens: create form stays at top, "No tokens yet." below.
- `/:orgSlug/audit` empty: "No events yet."

### 8.2 One-time token plaintext

`createToken` returns `{ token, plaintext }`. `<TokenCreated>` fragment shows plaintext **once** in a `role="alert"` banner with a "Copy" button, wrapped in `<code>`, accompanied by "Save this token now — it won't be shown again." No server-side caching; no localStorage.

### 8.3 Role-based UI

Subject has `role` and `scopes`. The `hasScope(subject, 'token:manage')` helper drives visibility of the create form and revoke buttons on the tokens page. Without the scope, the page renders the list read-only.

### 8.4 Dates

`<RelativeTime>` component renders `<time datetime="<ISO>" title="<ISO>"><RELATIVE></time>`. `RELATIVE` is produced server-side via `Intl.RelativeTimeFormat` ("2 hours ago"). No client JS for this.

### 8.5 Loading states

htmx sets class `htmx-request` on active elements. Tailwind: `[.htmx-request]:opacity-60 [.htmx-request]:pointer-events-none`. No separate spinners.

### 8.6 Flash messages

Redirect-then-render uses query-param flashes: `?flash=token-revoked`. Layout reads known flash codes and renders a dismissible banner. No flash cookies.

### 8.7 Accessibility baseline

Semantic HTML: `<main>`, `<nav>`, `<table>` with `<caption>`, `<label>` for all form controls. `aria-live="polite"` on the tokens tbody for htmx swaps. Keyboard-focusable logout / revoke buttons; htmx manages focus by default.

### 8.8 Security headers

New `securityHeaders()` middleware on UI routes (not on `/v1/*`):

- `Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

`'unsafe-inline'` for styles is required by the Tailwind CDN runtime. Scripts use only the two allowlisted CDNs plus `'self'` for htmx event handlers defined via attributes.

## 9. Testing

### 9.1 Unit (`test/unit/ui/`)

- Smoke render for each page with mock data. Assertion: every expected slug / CTA / empty-state string is present in output.
- `hasScope()` truth table.
- Error-page rendering: assert no stack trace leaks through.

### 9.2 Integration (`test/e2e/ui.test.ts`, supertest + existing testcontainers Postgres)

- `GET /` unauth → 302 to `/login`.
- `GET /login` → 200, contains `href="/v1/auth/login"`.
- Authed fixture (existing sealed-cookie helper): `GET /:orgSlug` → 200, body contains created project slug.
- `GET /:wrongOrg` authed → 403 HTML.
- `POST /:orgSlug/tokens` with htmx headers → 200 HTML fragment containing new `<tr>` and plaintext banner.
- `DELETE /:orgSlug/tokens/:id` → 200 HTML fragment with `status="revoked"`.
- `POST /:orgSlug/tokens` without same-origin `Origin`/`Referer` → 403.
- `GET /v1/auth/callback` with `Accept: application/json` → JSON (regression test for preserved behaviour).
- `GET /v1/auth/callback` with `Accept: text/html` → 302 to `/`.

### 9.3 Not covered

- Real WorkOS flow (mocks as today).
- htmx client-side behaviour (attributes-only; trusted).
- Visual regression.

## 10. Deployment

No infrastructure change. Same container, same Dokploy app, same domain, same auto-deploy. The submodule bump in the root repo picks up the new code.

No new env vars. Existing `PLATFORM_BASE_URL`, `PLATFORM_SESSION_COOKIE_DOMAIN`, `WORKOS_*` cover everything. CDN URLs for Tailwind and htmx are code constants.

OpenAPI spec (`buildOpenApi`) remains `/v1/*`-only. UI routes are not documented as public API.

No feature flag. Rollout = merge + auto-deploy. Rollback = `git revert` + redeploy.

## 11. Decomposition

Suggested implementation-plan split (to be refined during `writing-plans`):

1. **Middleware + auth content-negotiation** — `requireAuth({onUnauth})`, `sameOriginOnly`, `securityHeaders`, callback/logout content-negotiation. Tests for regression on `/v1/*`.
2. **UI scaffold** — `ui/app.tsx`, `Layout`, `render`, `renderError`, `/login`, `/`, `/no-org`, `/logout`. Header with org switcher.
3. **Read-only pages** — `/:orgSlug`, project, service, audit. Empty states. `RelativeTime` component.
4. **Token mutations** — `/:orgSlug/tokens` GET + POST + DELETE, htmx fragments, one-time plaintext banner, role-based visibility.
5. **Polish + docs** — flash messages, a11y pass, update `packages/platform-http/README.md` with UI section.

Each step is independently shippable: after step 1 nothing user-visible changes; after step 2 users can log in and see an "empty" dashboard; step 3 makes the dashboard useful; step 4 closes the awkward token flow; step 5 is cleanup.
