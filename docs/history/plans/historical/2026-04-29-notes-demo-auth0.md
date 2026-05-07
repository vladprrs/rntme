> Status: historical.
> Date: 2026-04-29.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Notes Demo — Auth0 + Ownership + Redpanda Cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Supersession note (2026-05-06):** Binding `pre[]`,
> `runPreSteps`, and Graph IR `$pre` instructions below are historical.
> New graph-affecting Auth0/session calls must be authored as Graph IR
> `call` nodes and exposed through binding `exposure`, per
> `docs/history/specs/historical/2026-05-06-graph-ir-effect-operations-design.md`.

**Goal:** Bring `demo/notes-blueprint/` to production-shape: real Auth0 OIDC login, ownership-enforcement on Note edits, external Redpanda Cloud event bus over SASL_SSL/SCRAM, end-to-end deploy through `platform.rntme.com` to Dokploy.

**Architecture:** Auth lives in the canonical Identity module pattern. `@rntme/identity-auth0` claims `IntrospectSession` (OIDC JWKS verify, no Mgmt API call). All four notes-blueprint bindings carry `pre: [IntrospectSession]`. Ownership is enforced inside graph IR via a new `$pre` directive: `createNote` injects `payload.ownerSub` from `$pre.session.user_id`; `deleteNote` filters `NoteView` by `id ∧ ownerSub` so its `emit` only fires when the actor owns the note. Edge does no auth (Nginx noop). UI runs through a new `@rntme/ui-auth-shell` package wrapping ui-runtime with `@auth0/auth0-spa-js` PKCE + Bearer-injecting transport.

**Tech Stack:** TypeScript, pnpm 9 workspace, Hono, Vitest, `jose@5.x` for JWKS, `@auth0/auth0-spa-js@2.x`, KafkaJS for Redpanda, esbuild SPA build, Dokploy.

**Spec:** `docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md`. Read §1–§13 before starting.

**Phase plan:** Seven phases. Phases 1–4 are independent (Tracks A and B). Phase 5 depends on all four; Phase 6 follows; Phase 7 closes.

## PLAN review corrections (2026-04-29)

Apply these corrections before executing any task below. They are authoritative where older snippets in this plan still use the previous names.

1. **Canonical Identity response stays `Session`.** The current `identity.proto` defines `rpc IntrospectSession(IntrospectSessionRequest) returns (Session)`, and the done Identity spec says `IntrospectSession(token) -> Session`. Do not add an `IntrospectSessionResponse` message. Add only `audience = 2` to `IntrospectSessionRequest`. Invalid-token details go in `Session.vendor_raw.deactivation_reason`; the HTTP layer checks `Session.status`.
2. **Use `Session.user_id`, not a new `subject_id` field.** Auth0/OIDC `sub` is mapped to canonical `Session.user_id`. Notes ownership references are `$pre.session.user_id`.
3. **Use documented `jose@5` APIs.** `jose` v5 documents `createRemoteJWKSet(url, { cacheMaxAge, cooldownDuration, timeoutDuration, headers, agent })`; it does not document `Symbol.for('jose.fetch')` or `[customFetch]`. Unit tests should inject a local key resolver (`createLocalJWKSet(jwks)` or a `JWTVerifyGetKey`) while production uses `createRemoteJWKSet(...)`.
4. **Use current bindings error codes.** Replace `BINDINGS_PRE_QUERY_FORBIDDEN` with `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND`; replace `BINDINGS_PRE_TOO_MANY` with `BINDINGS_STRUCTURAL_PRE_TOO_MANY`.
5. **Map note ownership denial to 404 explicitly.** Current command guard failures are `COMMAND_GUARD_REJECTED` and map to HTTP 422. The `deleteNote` binding or handler must explicitly map this command's ownership guard to HTTP 404 so "missing note" and "not your note" share the same response.

```
Phase 1 ┐
Phase 2 ├── parallel
Phase 3 ┘
Phase 4 (parallel to 1–3)
   │
   ▼
Phase 5  (depends on 1–4)
   │
   ▼
Phase 6  (manual external-setup may overlap with 5)
   │
   ▼
Phase 7
```

---

## File structure

### Phase 1 (Contract + identity-auth0)

- Modify: `packages/contracts/identity/v1/proto/identity.proto` — add `audience` to `IntrospectSessionRequest`; keep `IntrospectSession` returning canonical `Session`.
- Modify: `packages/contracts/identity/v1/scripts/build.mjs` (or equivalent build/regenerate command) — regenerate TS bindings.
- Modify: `packages/contracts/identity/v1/README.md`.
- Modify: `modules/identity/auth0/package.json` — add `jose@^5.x`.
- Create: `modules/identity/auth0/src/introspect-session.ts`.
- Modify: `modules/identity/auth0/src/handlers.ts` — dispatch `IntrospectSession`.
- Modify: `modules/identity/auth0/src/capabilities.ts` — add to `CLAIMED_RPCS`.
- Modify: `modules/identity/auth0/src/adapter.ts` — lazy Mgmt SDK init (R13).
- Modify: `modules/identity/auth0/module.json` — claim + limitations.
- Modify: `modules/identity/auth0/README.md`.
- Create: `modules/identity/auth0/test/unit/introspect-session.test.ts`.
- Create: `modules/identity/auth0/test/integration/conformance/introspect-session.scenarios.ts`.
- Modify: `modules/identity/README.md` — Tier-1 baseline now covered.

### Phase 2 (Bindings + Graph IR)

- Modify: `packages/artifacts/bindings/src/validate/structural.ts:164` — remove `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND` check for query bindings with pre steps.
- Modify: `packages/artifacts/bindings/test/unit/validate-structural.test.ts` — query-pre[] passes; 3-step pre fails.
- Modify: `packages/artifacts/bindings/README.md` — pre[] now allowed on queries.
- Modify: `packages/runtime/bindings-http/src/runtime/handler.ts` (query handler) — call `runPreSteps`.
- Modify: `packages/runtime/bindings-http/src/router.ts:60` — error message mentions queries too.
- Modify: `packages/runtime/bindings-http/src/runtime/command-handler.ts` — auth-aware 401 mapping for IntrospectSession `Session.status !== SESSION_STATUS_ACTIVE`.
- Modify: `packages/runtime/bindings-http/src/runtime/handler.ts` — same 401 mapping.
- Modify: `packages/runtime/bindings-http/src/pre/run-pre-steps.ts` — PII masking helper for `vendor_raw.claims.*` in any log path.
- Modify: `packages/runtime/bindings-http/test/unit/...` — add tests.
- Modify: `packages/runtime/bindings-http/README.md`.
- Modify: `packages/artifacts/graph-ir-compiler/src/parse/schema.ts` — `$pre` in `expr` union.
- Modify: `packages/artifacts/graph-ir-compiler/src/execute/...` (locate evaluator) — resolve `$pre`.
- Modify: `packages/artifacts/graph-ir-compiler/src/validate/...` — disallow `$pre` in aggregateId/transition/source.
- Create: `packages/artifacts/graph-ir-compiler/test/unit/pre-directive.test.ts`.
- Modify: `packages/artifacts/graph-ir-compiler/README.md`.
- Modify: `packages/artifacts/blueprint/src/parse/schema.ts` — `auth` middleware kind typed (provider/audience/moduleSlug).
- Modify: `packages/artifacts/blueprint/src/validate/composition.ts` — `BLUEPRINT_AUTH_AUDIENCE_MISMATCH` and `BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING`.
- Modify: `packages/artifacts/blueprint/test/unit/...`.
- Modify: `packages/artifacts/blueprint/README.md`.

### Phase 3 (Deploy library + runtime env)

- Modify: `packages/deploy/deploy-core/src/config.ts` — `ExternalEventBusSecurity` discriminated union.
- Modify: `packages/deploy/deploy-core/src/edge.ts` — `EdgeMiddleware` kind:`auth` variant + `supportedMiddlewareKinds`.
- Modify: `packages/deploy/deploy-core/src/plan.ts` — validators (SASL completeness, mechanism, auth provider/audience/moduleSlug, module workload existence, module env `AUTH0_DOMAIN`).
- Modify: `packages/deploy/deploy-core/src/composed-project.ts` (and types) — `auth` middleware kind passthrough typed.
- Modify: `packages/deploy/deploy-core/test/unit/plan.test.ts`.
- Modify: `packages/deploy/deploy-core/README.md`.
- Modify: `packages/deploy/deploy-dokploy/src/render.ts` — auth env on domain-service; SASL env; generated `/srv/config.json`.
- Modify: `packages/deploy/deploy-dokploy/src/nginx.ts` — comment-only for auth, no block.
- Modify: `packages/deploy/deploy-dokploy/test/unit/render.test.ts` — snapshot for notes-demo plan.
- Modify: `packages/deploy/deploy-dokploy/README.md`.
- Modify: `packages/runtime/runtime/src/start/...` (boot pipeline) — read `RNTME_AUTH_*`, init `ExternalAdapterClient` registry.
- Modify: `packages/runtime/runtime/src/...` (Kafka client config) — SASL_SSL env consumption.
- Modify: `packages/runtime/runtime/test/...`.
- Modify: `packages/runtime/runtime/README.md`.

### Phase 4 (UI auth-shell + ui-runtime)

- Create: `packages/ui-auth-shell/package.json`, `tsconfig.json`, `tsconfig.check.json`, `eslint.config.mjs`, `vitest.config.ts`, `README.md`.
- Create: `packages/ui-auth-shell/src/index.ts`.
- Create: `packages/ui-auth-shell/src/types.ts`.
- Create: `packages/ui-auth-shell/src/config.ts`.
- Create: `packages/ui-auth-shell/src/auth0-client.ts`.
- Create: `packages/ui-auth-shell/src/transport.ts`.
- Create: `packages/ui-auth-shell/src/chrome.ts`.
- Create: `packages/ui-auth-shell/test/unit/transport.test.ts`.
- Create: `packages/ui-auth-shell/test/unit/config.test.ts`.
- Create: `packages/ui-auth-shell/test/unit/auth0-client.test.ts`.
- Modify: `packages/runtime/ui-runtime/src/client/entry.tsx` (or wherever the SPA bootstrap is) — accept `transport` and `initialState` opts; readonly-keys protection for initialState.
- Modify: `packages/runtime/ui-runtime/src/build.ts` — emit `app.js` calling `mountAuthenticatedApp`; HTML reads `window.__RNTME_AUTH_SHELL_CONFIG__` from inlined script that fetches `/config.json`.
- Modify: `packages/runtime/ui-runtime/README.md`.
- Modify: root workspace `package.json`/`pnpm-workspace.yaml` to include `packages/ui-auth-shell`.

### Phase 5 (Notes blueprint)

- Modify: `demo/notes-blueprint/project.json`.
- Modify: `demo/notes-blueprint/pdm/entities/Note.json`.
- Modify: `demo/notes-blueprint/services/app/qsm/projections/NoteView.json`.
- Modify: `demo/notes-blueprint/services/app/graphs/shapes.json`.
- Modify: `demo/notes-blueprint/services/app/graphs/createNote.json`.
- Modify: `demo/notes-blueprint/services/app/graphs/deleteNote.json`.
- Modify: `demo/notes-blueprint/services/app/graphs/listNotes.json` (no IR change but verify).
- Modify: `demo/notes-blueprint/services/app/graphs/getNote.json` (no IR change but verify).
- Modify: `demo/notes-blueprint/services/app/bindings/bindings.json`.
- Modify: `demo/notes-blueprint/services/app/seed/seed.json`.
- Create: `demo/notes-blueprint/services/identity-auth0/service.json`.
- Modify: `demo/notes-blueprint/README.md`.
- Modify: `docs/history/specs/active-rationale/2026-04-27-notes-demo-e2e-design.md` — status flip.
- Modify: `CLAUDE.md`, `AGENTS.md`, root `README.md` per §11 of the spec.

### Phase 6–7 (External setup, deploy, smoke)

- External: Auth0 dashboard, Redpanda Cloud, Dokploy MCP.
- Manual via platform UI: deploy_target create/update, click Deploy.
- Memory: `~/.claude/projects/-home-coder-project/memory/notes_demo_auth0_deployed.md`.

---

## Phase 1 — Contract + identity-auth0 IntrospectSession

### Task 1.1: Add `audience` to `IntrospectSessionRequest`

**Files:**
- Modify: `packages/contracts/identity/v1/proto/identity.proto`

- [ ] **Step 1: Open the proto and find `IntrospectSessionRequest` / `IntrospectSession`**

Run: `grep -n "IntrospectSession" packages/contracts/identity/v1/proto/identity.proto`

Expected: location of `IntrospectSessionRequest` and the service method returning `Session`.

- [ ] **Step 2: Edit the request to add `audience`**

Add field number 2 (or next available) to `IntrospectSessionRequest`:

```proto
message IntrospectSessionRequest {
  string token = 1;
  string audience = 2;
}
```

- [ ] **Step 3: Preserve the response type**

Confirm the service method remains:

```proto
rpc IntrospectSession(IntrospectSessionRequest) returns (Session);
```

Do not add an `IntrospectSessionResponse` message. Invalid-token reasons are carried in `Session.vendor_raw.deactivation_reason`.

- [ ] **Step 4: Regenerate TS bindings**

Run: `pnpm -F @rntme/contracts-identity-v1 build`

Expected: build succeeds, `src/` is regenerated, `IntrospectSessionRequest.audience` appears in TS types, and `IntrospectSession` still returns `Session`.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/identity/v1/proto/identity.proto packages/contracts/identity/v1/src
git commit -m "feat(contracts-identity-v1): add audience to IntrospectSession request"
```

### Task 1.2: Add `jose` dependency to identity-auth0

**Files:**
- Modify: `modules/identity/auth0/package.json`

- [ ] **Step 1: Add `jose` to dependencies**

Edit `modules/identity/auth0/package.json` `dependencies`:

```json
"jose": "^5.9.6"
```

(Latest 5.x at the time of writing; pin can be confirmed with `npm view jose@5 version`.)

- [ ] **Step 2: Install**

Run: `pnpm install --frozen-lockfile=false`

Expected: `jose` resolved into the workspace node_modules.

- [ ] **Step 3: Commit**

```bash
git add modules/identity/auth0/package.json pnpm-lock.yaml
git commit -m "chore(identity-auth0): add jose dependency for JWKS verify"
```

### Task 1.3: Failing test — valid token introspection

**Files:**
- Create: `modules/identity/auth0/test/unit/introspect-session.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import { createIntrospectSession } from '../../src/introspect-session.js';

const TEST_DOMAIN = 'tenant.us.auth0.com';
const TEST_ISSUER = `https://${TEST_DOMAIN}/`;
const TEST_AUDIENCE = 'https://example.api/';

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  const jwks = { keys: [jwk] };
  const jwksResolver = createLocalJWKSet(jwks);
  const introspect = createIntrospectSession({
    domain: TEST_DOMAIN,
    jwksResolver,
  });
  return { privateKey, introspect };
}

async function makeToken(privateKey: CryptoKey, opts: { sub?: string; aud?: string; iss?: string; exp?: number; iat?: number; raw?: boolean }) {
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(opts.sub ?? 'auth0|abc123')
    .setIssuer(opts.iss ?? TEST_ISSUER)
    .setAudience(opts.aud ?? TEST_AUDIENCE)
    .setIssuedAt(opts.iat)
    .setExpirationTime(opts.exp ?? Math.floor(Date.now() / 1000) + 60)
    .sign(privateKey);
}

describe('introspectSession', () => {
  it('returns an active canonical Session for a valid token', async () => {
    const { privateKey, introspect } = await setup();
    const token = await makeToken(privateKey, {});
    const r = await introspect({ token, audience: TEST_AUDIENCE });
    expect(r.status).toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(r.user_id).toBe('auth0|abc123');
    expect((r.vendor_raw as { deactivation_reason?: string } | undefined)?.deactivation_reason).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/introspect-session.test.ts`

Expected: import error or runtime error (function does not exist).

### Task 1.4: Implement `createIntrospectSession` (valid path)

**Files:**
- Create: `modules/identity/auth0/src/introspect-session.ts`

- [ ] **Step 1: Implement minimal valid path**

```ts
import { jwtVerify, createRemoteJWKSet, errors as joseErrors } from 'jose';
import { SessionStatus, TokenType } from '@rntme/contracts-identity-v1';
import type {
  IntrospectSessionRequest,
  Session,
} from '@rntme/contracts-identity-v1';

export type IntrospectDeps = {
  domain: string;
  jwksCacheTtlMs?: number;
  jwksTimeoutMs?: number;
  jwksResolver?: Parameters<typeof jwtVerify>[1];
  now?: () => number;
};

const PUBLIC_CLAIMS = [
  'sub', 'email', 'email_verified', 'name', 'given_name', 'family_name',
  'picture', 'locale', 'iat', 'exp', 'iss', 'aud', 'azp',
] as const;

export function createIntrospectSession(deps: IntrospectDeps) {
  const issuer = `https://${deps.domain}/`;
  const jwksUrl = new URL(`https://${deps.domain}/.well-known/jwks.json`);
  const jwks = deps.jwksResolver ?? createRemoteJWKSet(jwksUrl, {
    cacheMaxAge: deps.jwksCacheTtlMs ?? 3_600_000,
    timeoutDuration: deps.jwksTimeoutMs ?? 5_000,
  });

  return async function introspectSession(
    req: IntrospectSessionRequest,
  ): Promise<Session> {
    if (!req.token || !req.audience) {
      return inactive('MALFORMED');
    }
    try {
      const { payload } = await jwtVerify(req.token, jwks, {
        issuer,
        audience: req.audience,
        clockTolerance: 30,
      });
      return {
        session_id: typeof payload.jti === 'string' ? payload.jti : String(payload.sub ?? ''),
        user_id: String(payload.sub ?? ''),
        token_type: TokenType.TOKEN_TYPE_JWT_ACCESS,
        status: SessionStatus.SESSION_STATUS_ACTIVE,
        expires_at: payload.exp ? secondsToTs(payload.exp) : undefined,
        vendor_raw: { claims: pickPublicClaims(payload) },
      } as Session;
    } catch (err) {
      return inactive(classifyJoseError(err));
    }
  };
}

function inactive(reason: string): Session {
  return {
    session_id: '',
    user_id: '',
    status: reason === 'TOKEN_EXPIRED' ? SessionStatus.SESSION_STATUS_EXPIRED : SessionStatus.SESSION_STATUS_UNSPECIFIED,
    expires_at: undefined,
    vendor_raw: { deactivation_reason: reason },
  } as Session;
}

function classifyJoseError(err: unknown): string {
  if (err instanceof joseErrors.JWTExpired) return 'TOKEN_EXPIRED';
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    if ((err as { claim?: string }).claim === 'iss') return 'INVALID_ISSUER';
    if ((err as { claim?: string }).claim === 'aud') return 'INVALID_AUDIENCE';
    return 'MALFORMED';
  }
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) return 'INVALID_SIGNATURE';
  if (err instanceof joseErrors.JWSInvalid) return 'MALFORMED';
  if (err instanceof joseErrors.JWKSNoMatchingKey) return 'INVALID_SIGNATURE';
  return 'UNKNOWN';
}

function pickPublicClaims(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PUBLIC_CLAIMS) {
    if (k in p) out[k] = p[k as keyof typeof p];
  }
  return out;
}

function secondsToTs(seconds: number): { seconds: number; nanos: number } {
  return { seconds: Math.floor(seconds), nanos: 0 };
}
```

Context7 was unavailable during PLAN review, so this was verified against official `jose` v5 docs/source: `createRemoteJWKSet` supports `cacheMaxAge`, `cooldownDuration`, `timeoutDuration`, `headers`, and `agent`; it does not document a custom fetcher. Keep unit tests on injected local key resolution instead of network-fetch mocking.

- [ ] **Step 2: Run the test — expect pass**

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/introspect-session.test.ts`

Expected: 1 test passing.

- [ ] **Step 3: Commit**

```bash
git add modules/identity/auth0/src/introspect-session.ts modules/identity/auth0/test/unit/introspect-session.test.ts
git commit -m "feat(identity-auth0): JWKS-based IntrospectSession (valid path)"
```

### Task 1.5: Tests for invalid cases

**Files:**
- Modify: `modules/identity/auth0/test/unit/introspect-session.test.ts`

- [ ] **Step 1: Add five failing cases**

Append to the `describe` block:

```ts
  it('returns TOKEN_EXPIRED for a token whose exp is in the past', async () => {
    const { privateKey, introspect } = await setup();
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const token = await makeToken(privateKey, { exp });
    const r = await introspect({ token, audience: TEST_AUDIENCE });
    expect(r.status).toBe(SessionStatus.SESSION_STATUS_EXPIRED);
    expect((r.vendor_raw as { deactivation_reason?: string }).deactivation_reason).toBe('TOKEN_EXPIRED');
    expect(r.user_id).toBe('');
  });

  it('returns INVALID_AUDIENCE on aud mismatch', async () => {
    const { privateKey, introspect } = await setup();
    const token = await makeToken(privateKey, { aud: 'https://other.api/' });
    const r = await introspect({ token, audience: TEST_AUDIENCE });
    expect(r.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect((r.vendor_raw as { deactivation_reason?: string }).deactivation_reason).toBe('INVALID_AUDIENCE');
  });

  it('returns INVALID_ISSUER on iss mismatch', async () => {
    const { privateKey, introspect } = await setup();
    const token = await makeToken(privateKey, { iss: 'https://other.auth0.com/' });
    const r = await introspect({ token, audience: TEST_AUDIENCE });
    expect(r.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect((r.vendor_raw as { deactivation_reason?: string }).deactivation_reason).toBe('INVALID_ISSUER');
  });

  it('returns MALFORMED on a non-JWT string', async () => {
    const { introspect } = await setup();
    const r = await introspect({ token: 'not.a.jwt', audience: TEST_AUDIENCE });
    expect(r.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect((r.vendor_raw as { deactivation_reason?: string }).deactivation_reason).toBe('MALFORMED');
  });

  it('returns MALFORMED on empty audience in request', async () => {
    const { privateKey, introspect } = await setup();
    const token = await makeToken(privateKey, {});
    const r = await introspect({ token, audience: '' });
    expect(r.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect((r.vendor_raw as { deactivation_reason?: string }).deactivation_reason).toBe('MALFORMED');
  });
```

- [ ] **Step 2: Run all introspect tests**

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/introspect-session.test.ts`

Expected: 6 passing.

- [ ] **Step 3: Commit**

```bash
git add modules/identity/auth0/test/unit/introspect-session.test.ts
git commit -m "test(identity-auth0): IntrospectSession invalid-token cases"
```

### Task 1.6: Wire `IntrospectSession` into module dispatch + claim it

**Files:**
- Modify: `modules/identity/auth0/src/handlers.ts`
- Modify: `modules/identity/auth0/src/capabilities.ts`
- Modify: `modules/identity/auth0/module.json`

- [ ] **Step 1: Update `CLAIMED_RPCS` in `capabilities.ts`**

Append `'IntrospectSession'` to the `CLAIMED_RPCS` array.

- [ ] **Step 2: Wire dispatch in `handlers.ts`**

Open `handlers.ts`, locate the dispatch (where the existing RPCs are routed). Add an instantiation of the introspect handler near the adapter creation:

```ts
import { createIntrospectSession } from './introspect-session.js';

export function createAuth0IdentityModule(adapter: Auth0ManagementAdapter, opts: { domain: string }) {
  const introspect = createIntrospectSession({ domain: opts.domain });
  return {
    // ... existing handlers ...
    IntrospectSession: introspect,
  };
}
```

(Adapt names to the actual factory in `handlers.ts`. The minimum required: `IntrospectSession` is reachable from the module's RPC table.)

- [ ] **Step 3: Update `module.json`**

In `modules/identity/auth0/module.json`, append `"IntrospectSession"` to `capabilities.rpcs`. Replace the first limitation string:

```json
"Only IntrospectSession is claimed via OIDC JWKS validation. RevokeSession, ListSessions, GetSession remain unclaimed because Auth0 server-side session aggregate does not map to the canonical Session entity (no listable session resource, no programmatic revoke without Mgmt session-scope)."
```

(Replaces the old "Auth0 tenant sessions are not claimed because ..." string. Other limitations stay.)

- [ ] **Step 4: Run module tests**

Run: `pnpm -F @rntme/identity-auth0 test`

Expected: all existing + new tests green.

- [ ] **Step 5: Commit**

```bash
git add modules/identity/auth0/src/handlers.ts modules/identity/auth0/src/capabilities.ts modules/identity/auth0/module.json
git commit -m "feat(identity-auth0): claim and dispatch IntrospectSession"
```

### Task 1.7: Lazy Mgmt SDK init (R13)

**Files:**
- Modify: `modules/identity/auth0/src/adapter.ts`

- [ ] **Step 1: Read current adapter init**

Run: `grep -n "ManagementClient\|new Management" modules/identity/auth0/src/adapter.ts`

Identify where the SDK is constructed.

- [ ] **Step 2: Make construction lazy**

Replace eager construction with a getter that builds the client on first use, throwing a typed error if creds are absent:

```ts
let mgmt: ManagementClient | null = null;
const getMgmt = (): ManagementClient => {
  if (mgmt) return mgmt;
  if (!opts.clientId || !opts.clientSecret) {
    throw new Auth0AdapterError('IDENTITY_CONFIG_MGMT_NOT_CONFIGURED', 'Auth0 Mgmt API client_id/client_secret not provided');
  }
  mgmt = new ManagementClient({ domain: opts.domain, clientId: opts.clientId, clientSecret: opts.clientSecret });
  return mgmt;
};
```

(Adapt to the actual existing factory shape; do not drop existing options.)

- [ ] **Step 3: Replace eager refs**

Find every direct `mgmt.users.…` or `this.client.…` use; route through `getMgmt()`. Run `pnpm -F @rntme/identity-auth0 typecheck` to verify.

- [ ] **Step 4: Test**

Run: `pnpm -F @rntme/identity-auth0 test`

Expected: green. Existing User/Org/Membership tests still pass; first-Mgmt-call-with-missing-creds raises `IDENTITY_CONFIG_MGMT_NOT_CONFIGURED`. If a test directly observed eager construction, fix it now.

- [ ] **Step 5: Commit**

```bash
git add modules/identity/auth0/src/adapter.ts
git commit -m "fix(identity-auth0): lazy Mgmt SDK init so missing creds do not crash module"
```

### Task 1.8: Mock-conformance scenarios for IntrospectSession

**Files:**
- Create: `modules/identity/auth0/test/integration/conformance/introspect-session.scenarios.ts`

- [ ] **Step 1: Inspect how existing conformance scenarios are wired**

Run: `ls modules/identity/auth0/test/integration/ && grep -rln "scenarios" modules/identity/auth0/src/conformance.ts`

Identify the scenario loader pattern.

- [ ] **Step 2: Add scenarios**

Create the scenarios file mirroring the existing pattern. Minimum six scenarios — names and assertions follow §6.5 of the spec:

```ts
import type { ScenarioFile } from '@rntme/conformance-identity';

export const introspectSessionScenarios: ScenarioFile = {
  rpc: 'IntrospectSession',
  scenarios: [
    {
      name: 'valid_token',
      input: { token: '<valid-jwt>', audience: 'https://example.api/' },
      expect: { status: 'SESSION_STATUS_ACTIVE', user_id: /^auth0\|/ },
    },
    { name: 'expired_token', input: { token: '<expired-jwt>', audience: 'https://example.api/' }, expect: { status: 'SESSION_STATUS_EXPIRED', vendor_raw: { deactivation_reason: 'TOKEN_EXPIRED' } } },
    { name: 'wrong_audience', input: { token: '<valid-jwt>', audience: 'https://wrong.api/' }, expect: { statusNot: 'SESSION_STATUS_ACTIVE', vendor_raw: { deactivation_reason: 'INVALID_AUDIENCE' } } },
    { name: 'wrong_issuer', input: { token: '<other-issuer-jwt>', audience: 'https://example.api/' }, expect: { statusNot: 'SESSION_STATUS_ACTIVE', vendor_raw: { deactivation_reason: 'INVALID_ISSUER' } } },
    { name: 'malformed', input: { token: 'not.a.jwt', audience: 'https://example.api/' }, expect: { statusNot: 'SESSION_STATUS_ACTIVE', vendor_raw: { deactivation_reason: 'MALFORMED' } } },
    { name: 'empty_audience', input: { token: '<valid-jwt>', audience: '' }, expect: { statusNot: 'SESSION_STATUS_ACTIVE', vendor_raw: { deactivation_reason: 'MALFORMED' } } },
  ],
};
```

(Token placeholders are generated by the mock-vendor harness like the existing scenarios — adapt to the harness API. If the harness does not yet support per-scenario token generation for IntrospectSession, this is the place to add a small helper rather than hardcoding strings.)

- [ ] **Step 3: Register the scenarios in `src/conformance.ts`**

Locate the scenario aggregator (`scenariosByRpc` or similar) and add the new entry. Match the existing naming convention.

- [ ] **Step 4: Run mock conformance**

Run: `pnpm -F @rntme/identity-auth0 run test:conformance:mock`

Expected: 6 IntrospectSession scenarios pass.

- [ ] **Step 5: Commit**

```bash
git add modules/identity/auth0/test/integration/conformance/introspect-session.scenarios.ts modules/identity/auth0/src/conformance.ts
git commit -m "test(identity-auth0): mock conformance scenarios for IntrospectSession"
```

### Task 1.9: Update READMEs (auth0 + identity)

**Files:**
- Modify: `modules/identity/auth0/README.md`
- Modify: `modules/identity/README.md`
- Modify: `packages/contracts/identity/v1/README.md`

- [ ] **Step 1: Update auth0 README**

In `modules/identity/auth0/README.md`:
- "Supported Capabilities" → add row "Sessions | `IntrospectSession` | OIDC JWKS verify (no Mgmt API call)".
- "Out of Scope" → "`GetSession`, `ListSessions`, `RevokeSession` remain `UNIMPLEMENTED`".
- "Where to Look First" → add "JWKS verifier: `createIntrospectSession` in `src/introspect-session.ts`".

- [ ] **Step 2: Update modules/identity README**

In `modules/identity/README.md`, in the auth0 row, change "Canonical session RPCs are intentionally unclaimed because…" to "Auth0 claims `IntrospectSession` (OIDC JWKS verify); other session RPCs remain unclaimed".

- [ ] **Step 3: Update contracts README**

In `packages/contracts/identity/v1/README.md`, in the IntrospectSession description, add: "`audience` is optional for backward compatibility but required by OIDC/JWT vendor modules such as Auth0; the module validates it against the JWT `aud` claim. Invalid-token outcomes return canonical `Session` with `status != SESSION_STATUS_ACTIVE` and `vendor_raw.deactivation_reason` (`TOKEN_EXPIRED`, `INVALID_SIGNATURE`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `MALFORMED`, `UNKNOWN`)."

- [ ] **Step 4: Commit**

```bash
git add modules/identity/auth0/README.md modules/identity/README.md packages/contracts/identity/v1/README.md
git commit -m "docs: identity-auth0 IntrospectSession claim + audience"
```

### Task 1.10: Phase 1 final test pass

- [ ] **Step 1: Run full identity-auth0 + contracts test**

Run: `pnpm -F @rntme/identity-auth0 test && pnpm -F @rntme/contracts-identity-v1 test`

Expected: both green.

- [ ] **Step 2: Phase summary**

Phase 1 complete. Track A first leg (Contract + identity-auth0 IntrospectSession) ready for Phase 5 to consume.

---

## Phase 2 — Bindings + Graph IR

### Task 2.1: Failing test — `pre[]` allowed on query bindings

**Files:**
- Modify: `packages/artifacts/bindings/test/unit/validate-structural.test.ts`

- [ ] **Step 1: Add the test**

Add a `describe('pre[] on query bindings', …)` block:

```ts
describe('pre[] on query bindings', () => {
  it('accepts a query binding with one module-rpc pre-step', () => {
    const artifact = {
      version: '1.0',
      graphSpecRef: './shapes.json', pdmRef: '../pdm/pdm.json', qsmRef: './qsm.json',
      bindings: {
        listX: {
          kind: 'query',
          graph: './graphs/listX.json',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: { method: 'GET', path: '/x', parameters: [] },
          pre: [
            {
              kind: 'module-rpc',
              module: 'identity-auth0',
              rpc: 'IntrospectSession',
              input: { token: { from: 'header', name: 'authorization' }, audience: 'https://api/' },
              bindAs: 'session',
            },
          ],
        },
      },
    } as const;
    const result = validateStructural(artifact);
    expect(result.ok).toBe(true);
  });

  it('rejects a query binding with three pre-steps (max 2)', () => {
    const make = (i: number) => ({
      kind: 'module-rpc' as const,
      module: 'm', rpc: 'R',
      input: {}, bindAs: `r${i}`,
    });
    const artifact = {
      version: '1.0',
      graphSpecRef: './shapes.json', pdmRef: '../pdm/pdm.json', qsmRef: './qsm.json',
      bindings: {
        listX: {
          kind: 'query',
          graph: './graphs/listX.json',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: { method: 'GET', path: '/x', parameters: [] },
          pre: [make(0), make(1), make(2)],
        },
      },
    } as const;
    const result = validateStructural(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BINDINGS_STRUCTURAL_PRE_TOO_MANY')).toBe(true);
    }
  });
});
```

(Adjust import path to the actual `validateStructural` export.)

- [ ] **Step 2: Run — expect first test fail**

Run: `pnpm -F @rntme/bindings vitest run test/unit/validate-structural.test.ts`

Expected: first test fails with `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND`; second passes.

### Task 2.2: Remove `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND` for query pre steps

**Files:**
- Modify: `packages/artifacts/bindings/src/validate/structural.ts`

- [ ] **Step 1: Open the validator**

Run: `sed -n '155,180p' packages/artifacts/bindings/src/validate/structural.ts`

Confirm the block around line 164.

- [ ] **Step 2: Remove the check**

Delete the `if (!isCommand)` branch inside `if (entry.pre !== undefined && entry.pre.length > 0)` that emits `BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND`. Keep the "max 2" cap intact.

- [ ] **Step 3: Drop the error code, if any export**

Run: `grep -RIn "BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND" packages/artifacts/bindings/src packages/artifacts/bindings/test`

Remove or update the query-pre references. Keep the code itself only if another non-command binding kind still needs it; currently query and command are the only binding kinds.

- [ ] **Step 4: Run the failing test now passes**

Run: `pnpm -F @rntme/bindings vitest run test/unit/validate-structural.test.ts`

Expected: both tests green.

- [ ] **Step 5: Run full bindings test suite**

Run: `pnpm -F @rntme/bindings test`

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/bindings/src/validate/structural.ts packages/artifacts/bindings/test/unit/validate/pre-structural.test.ts
git commit -m "feat(bindings): allow pre[] on query bindings (K1)"
```

### Task 2.3: Failing test — query handler runs `pre[]`

**Files:**
- Modify: `packages/runtime/bindings-http/test/unit/` — locate the existing query-handler test or create a small one near it.

- [ ] **Step 1: Find the existing handler test**

Run: `ls packages/runtime/bindings-http/test/unit/`

Identify the query-handler test file (or create `runtime-handler-pre.test.ts`).

- [ ] **Step 2: Add a failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { makeHandler } from '../../src/runtime/handler.js';
// import minimum plumbing to construct a QueryBindingPlan with one pre-step;
// follow the patterns in the existing handler tests.

describe('query handler runs pre[]', () => {
  it('calls externalAdapterClient.call before executing the graph', async () => {
    const adapterCall = vi.fn(async () => ({ ok: true, value: { status: SessionStatus.SESSION_STATUS_ACTIVE, user_id: 'auth0|x', vendor_raw: {} } }));
    const externalAdapterClient = { call: adapterCall };
    const plan = /* QueryBindingPlan with pre: [{ module: 'identity-auth0', rpc: 'IntrospectSession', input: {...}, bindAs: 'session' }] */;
    const handler = makeHandler(plan, { db: makeInMemoryDb(), externalAdapterClient });
    const app = new Hono(); app.get('/x', handler);
    const res = await app.request('/x', { headers: { authorization: 'Bearer t' } });
    expect(adapterCall).toHaveBeenCalledOnce();
    expect(adapterCall.mock.calls[0][0]).toBe('identity-auth0');
    expect(adapterCall.mock.calls[0][1]).toBe('IntrospectSession');
    expect(res.status).toBe(200);
  });

  it('returns 401 when IntrospectSession returns an inactive Session on a pre-step bound to the auth middleware', async () => {
    const externalAdapterClient = { call: vi.fn(async () => ({ ok: true, value: { status: SessionStatus.SESSION_STATUS_EXPIRED, vendor_raw: { deactivation_reason: 'TOKEN_EXPIRED' } } })) };
    const plan = /* QueryBindingPlan with same pre, plus authMiddlewareModuleSlug: 'identity-auth0' */;
    const handler = makeHandler(plan, { db: makeInMemoryDb(), externalAdapterClient, authMiddlewareModuleSlug: 'identity-auth0' });
    const app = new Hono(); app.get('/x', handler);
    const res = await app.request('/x', { headers: { authorization: 'Bearer t' } });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('RUNTIME_AUTH_TOKEN_INVALID');
    expect(body.reason).toBe('TOKEN_EXPIRED');
  });
});
```

(Stub `makeInMemoryDb()` and the QueryBindingPlan factory using existing test helpers in this repo. Look at `packages/runtime/bindings-http/test/unit/` for the pattern.)

- [ ] **Step 3: Run — expect failure**

Run: `pnpm -F @rntme/bindings-http vitest run test/unit/runtime-handler-pre.test.ts`

Expected: assertions fail (handler does not call adapter; or 200 instead of 401).

### Task 2.4: Implement `runPreSteps` in query handler + 401 mapping

**Files:**
- Modify: `packages/runtime/bindings-http/src/runtime/handler.ts`
- Modify: `packages/runtime/bindings-http/src/router.ts`
- Modify: `packages/runtime/bindings-http/src/runtime/command-handler.ts`

- [ ] **Step 1: Update `HandlerDeps` and the factory**

```ts
import type { ExternalAdapterClient } from '../runtime-contract.js';
import { runPreSteps } from '../pre/run-pre-steps.js';

export type HandlerDeps = {
  db: BetterSqlite3.Database;
  externalAdapterClient?: ExternalAdapterClient | undefined;
  authMiddlewareModuleSlug?: string | undefined;
  onError?: (err: unknown, ctx: Context) => void;
};
```

- [ ] **Step 2: Run pre-steps before extraction**

Inside the returned async handler, after extracting body if any, before graph execution:

```ts
let preScope: Record<string, unknown> = {};
if ((plan.pre?.length ?? 0) > 0) {
  if (!deps.externalAdapterClient) {
    return c.json({ code: 'BINDINGS_CONFIG_ADAPTER_MISSING', message: 'pre[] requires externalAdapterClient' }, 500);
  }
  const r = await runPreSteps(plan.pre, {
    adapterClient: deps.externalAdapterClient,
    scope: { params: collectedParams, request: { headers: collectHeaders(c), query: queryBag, path: pathBag } },
  });
  if (!r.ok) {
    return c.json({ code: 'RUNTIME_PRE_STEP_FAILED', message: 'pre-step failed' }, 502);
  }
  const isAuthSlug = deps.authMiddlewareModuleSlug;
  const authStep = isAuthSlug ? plan.pre.find((p) => p.kind === 'module-rpc' && p.module === isAuthSlug && p.rpc === 'IntrospectSession') : undefined;
  if (authStep) {
    const session = r.systemFields.pre[authStep.bindName] as { status?: number; vendor_raw?: { deactivation_reason?: string } } | undefined;
    if (!session || session.status !== SessionStatus.SESSION_STATUS_ACTIVE) {
      return c.json({ code: 'RUNTIME_AUTH_TOKEN_INVALID', message: 'authentication required', reason: session?.vendor_raw?.deactivation_reason ?? 'UNKNOWN' }, 401);
    }
  }
  preScope = r.systemFields.pre;
}
```

(Use `bindName`; `packages/runtime/bindings-http/src/startup/compile-plan.ts` currently exposes `CompiledPreStep.bindName`.)

- [ ] **Step 3: Pass `pre` into graph executor**

Where the graph is executed, supply the `pre` scope alongside `params`. The graph-ir-compiler interface change for `$pre` (Phase 2 Task 2.7) consumes this.

- [ ] **Step 4: Update `router.ts` precondition**

Change the existing message from "command binding" to:

```ts
'createBindingsRouter: externalAdapterClient is required when any binding has pre[]'
```

And widen the check from "any command binding has pre[]" to "any binding has pre[]".

- [ ] **Step 5: Mirror 401 mapping in command handler**

In `packages/runtime/bindings-http/src/runtime/command-handler.ts`, apply the same `authMiddlewareModuleSlug` check after `runPreSteps` returns and before idempotency-cache and graph execution.

- [ ] **Step 6: Run Phase 2 tests**

Run: `pnpm -F @rntme/bindings-http test`

Expected: green, including the new pre tests.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/bindings-http/src/runtime/handler.ts packages/runtime/bindings-http/src/runtime/command-handler.ts packages/runtime/bindings-http/src/router.ts packages/runtime/bindings-http/test/unit/
git commit -m "feat(bindings-http): query handler runs pre[]; 401 mapping for IntrospectSession"
```

### Task 2.5: PII masking in pre-result logs

**Files:**
- Modify: `packages/runtime/bindings-http/src/pre/run-pre-steps.ts`
- Modify: any log call sites for pre results (search and update).

- [ ] **Step 1: Add `maskClaims` helper**

Inside `run-pre-steps.ts`:

```ts
export function maskClaimsForLog(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'claims') {
      out[k] = '<masked>';
    } else if (typeof v === 'object' && v !== null) {
      out[k] = maskClaimsForLog(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
```

- [ ] **Step 2: Replace log call sites**

Run: `grep -rn "console\.\(log\|debug\|info\)\|logger\..*pre\|preResult" packages/runtime/bindings-http/src/`

For every log of `pre`/`preResult`/`systemFields.pre`, wrap with `maskClaimsForLog(...)`.

- [ ] **Step 3: Add a unit test**

```ts
it('maskClaimsForLog masks nested claims field', () => {
  const input = { pre: { session: { status: SessionStatus.SESSION_STATUS_ACTIVE, user_id: 'x', vendor_raw: { claims: { email: 'a@b' } } } } };
  expect(maskClaimsForLog(input)).toEqual({ pre: { session: { status: SessionStatus.SESSION_STATUS_ACTIVE, user_id: 'x', vendor_raw: { claims: '<masked>' } } } });
});
```

- [ ] **Step 4: Test + commit**

Run: `pnpm -F @rntme/bindings-http test`

Expected: green.

```bash
git add packages/runtime/bindings-http/src/pre/run-pre-steps.ts packages/runtime/bindings-http/test/unit/
git commit -m "feat(bindings-http): mask vendor_raw.claims in pre-result logs (R12)"
```

### Task 2.6: Failing test — `$pre` directive in graph IR

**Files:**
- Create: `packages/artifacts/graph-ir-compiler/test/unit/pre-directive.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { parseGraph } from '../../src/parse/index.js';
import { execute } from '../../src/index.js';

describe('$pre directive', () => {
  const minimalGraph = {
    id: 'g',
    signature: { inputs: { id: { type: 'string', mode: 'required' } }, output: { type: 'row<CommandResult>', from: 'emit' } },
    nodes: [
      {
        id: 'emit', type: 'emit',
        config: {
          aggregate: 'X', aggregateId: { $param: 'id' }, transition: 'create',
          payload: { ownerSub: { $pre: 'session.user_id' } },
        },
      },
    ],
  };

  it('parses $pre in emit.payload', () => {
    const r = parseGraph(minimalGraph);
    expect(r.ok).toBe(true);
  });

  it('resolves $pre against scope.pre at execute time', async () => {
    const events: unknown[] = [];
    await execute(minimalGraph, {
      params: { id: 'note-1' },
      pre: { session: { user_id: 'auth0|abc' } },
      eventBus: { publish: async (e) => { events.push(e); } },
      // …other deps stubbed out (db, projections) per existing test pattern
    });
    expect(events).toHaveLength(1);
    expect((events[0] as any).data.ownerSub).toBe('auth0|abc');
  });

  it('rejects $pre in emit.aggregateId', () => {
    const bad = {
      ...minimalGraph,
      nodes: [{ ...minimalGraph.nodes[0], config: { ...minimalGraph.nodes[0].config, aggregateId: { $pre: 'session.user_id' } } }],
    };
    const r = parseGraph(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_AGGREGATE_ID')).toBe(true);
    }
  });
});
```

(Stubs depend on existing test patterns in graph-ir-compiler. Mirror the closest existing `execute` test.)

- [ ] **Step 2: Run — expect failure**

Run: `pnpm -F @rntme/graph-ir-compiler vitest run test/unit/pre-directive.test.ts`

Expected: parse rejects unknown `$pre` directive.

### Task 2.7: Implement `$pre` directive

**Files:**
- Modify: `packages/artifacts/graph-ir-compiler/src/parse/schema.ts`
- Modify: `packages/artifacts/graph-ir-compiler/src/execute/...` (locate evaluator)
- Modify: `packages/artifacts/graph-ir-compiler/src/validate/...` (positional disallow)

- [ ] **Step 1: Extend `expr` union**

In `parse/schema.ts`, in the `expr` lazy union, add:

```ts
z.object({ $pre: z.string().min(1) }).strict(),
```

- [ ] **Step 2: Extend evaluator**

Locate the evaluator (likely under `src/execute/` or `src/lower/`, look for `$param` resolution). Add a parallel branch:

```ts
if (expr && typeof expr === 'object' && '$pre' in expr) {
  const path = (expr as { $pre: string }).$pre;
  return resolvePath(scope.pre ?? {}, path);
}
```

`resolvePath`:

```ts
function resolvePath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], root);
}
```

- [ ] **Step 3: Plumb `pre` into the executor input**

The executor entry takes a context with `params`. Extend it to also accept `pre`. Default `pre = {}`. Pass through to `evaluateExprRef`.

- [ ] **Step 4: Disallow `$pre` in three positions**

Add validator passes (in the same place that other positional checks live, e.g. `validate/structural` for graphs):

- `emit.config.aggregateId` containing `$pre` → `GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_AGGREGATE_ID`.
- `emit.config.transition` containing `$pre` → `GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_TRANSITION`.
- `findMany.config.source.{entity|projection|eventType}` containing `$pre` → `GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_SOURCE`.

- [ ] **Step 5: Run all graph-ir-compiler tests**

Run: `pnpm -F @rntme/graph-ir-compiler test`

Expected: all existing fixtures still green; new `$pre` tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/graph-ir-compiler/src packages/artifacts/graph-ir-compiler/test/unit/pre-directive.test.ts
git commit -m "feat(graph-ir-compiler): \$pre directive for pre-step result references"
```

### Task 2.8: Blueprint validators — audience equality + `$pre` reference defined

**Files:**
- Modify: `packages/artifacts/blueprint/src/validate/composition.ts`
- Modify: `packages/artifacts/blueprint/test/unit/validate-composition.test.ts`

- [ ] **Step 1: Add `BLUEPRINT_AUTH_AUDIENCE_MISMATCH` validator**

For every service with bindings using a `pre[]` step `{module===project.middleware.auth.moduleSlug, rpc==='IntrospectSession'}`, compare `pre.input.audience` to `project.middleware.auth.audience`. Mismatch → emit error.

```ts
{
  code: 'BLUEPRINT_AUTH_AUDIENCE_MISMATCH',
  message: `bindings ${id} pre IntrospectSession audience "${preAud}" does not match project.middleware.auth.audience "${projAud}"`,
}
```

- [ ] **Step 2: Add `BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING`**

For every binding with a graph that contains a `$pre: "<bindAs>.<…>"` reference, verify that some pre-step in the binding has `bindAs === <bindAs>`. Otherwise:

```ts
{
  code: 'BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING',
  message: `binding "${id}" graph references $pre "${ref}" but no pre-step is bound as "${bindAs}"`,
}
```

(Implementation: walk the graph JSON looking for any object with a single `$pre` key; collect references; reconcile with declared `bindAs` names.)

- [ ] **Step 3: Add tests**

```ts
it('rejects audience mismatch between project.json and bindings.json', () => { /* … */ });
it('rejects $pre reference that does not match any bindAs', () => { /* … */ });
it('accepts matching audience and defined bindAs', () => { /* … */ });
```

- [ ] **Step 4: Test + commit**

Run: `pnpm -F @rntme/blueprint test`

Expected: green.

```bash
git add packages/artifacts/blueprint/src/validate/composition.ts packages/artifacts/blueprint/test/unit/validate-composition.test.ts
git commit -m "feat(blueprint): cross-artifact validators for auth audience and \$pre references"
```

### Task 2.9: Phase 2 final pass

- [ ] **Step 1: Run Track A package tests**

Run: `pnpm -F @rntme/bindings test && pnpm -F @rntme/bindings-http test && pnpm -F @rntme/graph-ir-compiler test && pnpm -F @rntme/blueprint test`

Expected: all green.

- [ ] **Step 2: Update READMEs**

In each of `bindings`, `bindings-http`, `graph-ir-compiler`, `blueprint` READMEs, add a one-line entry under "Invariants & gotchas" or equivalent describing the new behavior. Commit.

```bash
git add packages/artifacts/bindings/README.md packages/runtime/bindings-http/README.md packages/artifacts/graph-ir-compiler/README.md packages/artifacts/blueprint/README.md
git commit -m "docs: bindings/graph-ir-compiler/blueprint README updates for pre[] on queries and \$pre directive"
```

---

## Phase 3 — Deploy library + runtime env

### Task 3.1: `ExternalEventBusConfig` discriminated union

**Files:**
- Modify: `packages/deploy/deploy-core/src/config.ts`
- Modify: `packages/deploy/deploy-core/test/unit/plan.test.ts`

- [ ] **Step 1: Replace `security` shape**

```ts
export type ExternalEventBusSecurity =
  | { readonly protocol: 'plaintext' }
  | {
      readonly protocol: 'sasl_ssl';
      readonly mechanism: 'scram-sha-256' | 'scram-sha-512';
      readonly secretRefs: { readonly username: string; readonly password: string };
    };

export type ExternalEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode: 'external';
  readonly brokers: readonly string[];
  readonly topicPrefix?: string;
  readonly security?: ExternalEventBusSecurity;
};
```

Remove the previous open `Record<string, string>` shape.

- [ ] **Step 2: Add validators in `plan.ts`**

```ts
const sec = config.eventBus?.security;
if (sec?.protocol === 'sasl_ssl') {
  if (!sec.mechanism || !['scram-sha-256','scram-sha-512'].includes(sec.mechanism)) {
    errors.push({ code: 'DEPLOY_PLAN_EVENT_BUS_SASL_MECHANISM_UNSUPPORTED', message: `unsupported SASL mechanism "${sec.mechanism}"`, path: 'eventBus.security.mechanism' });
  }
  if (!sec.secretRefs?.username || !sec.secretRefs?.password) {
    errors.push({ code: 'DEPLOY_PLAN_EVENT_BUS_SASL_INCOMPLETE', message: 'sasl_ssl requires secretRefs.username and secretRefs.password', path: 'eventBus.security.secretRefs' });
  }
}
```

- [ ] **Step 3: Add unit tests**

```ts
it('rejects sasl_ssl without mechanism', () => { /* config with protocol sasl_ssl, no mechanism → error code */ });
it('rejects sasl_ssl with missing secretRefs.password', () => { /* … */ });
it('accepts plaintext without security fields', () => { /* … */ });
it('accepts sasl_ssl with valid mechanism and both secretRefs', () => { /* … */ });
```

- [ ] **Step 4: Test + commit**

Run: `pnpm -F @rntme/deploy-core test`

Expected: green.

```bash
git add packages/deploy/deploy-core/src/config.ts packages/deploy/deploy-core/src/plan.ts packages/deploy/deploy-core/test/unit/
git commit -m "feat(deploy-core): ExternalEventBusConfig.security discriminated union with SASL_SSL/SCRAM"
```

### Task 3.2: `EdgeMiddleware` `kind: 'auth'` variant

**Files:**
- Modify: `packages/deploy/deploy-core/src/edge.ts`
- Modify: `packages/deploy/deploy-core/test/unit/edge.test.ts`

- [ ] **Step 1: Extend `EdgeMiddleware` union**

Append a fifth variant matching §8.2 of the spec (mountTarget, name, kind, provider, audience, moduleSlug, policy, config). Add `'auth'` to `supportedMiddlewareKinds`.

- [ ] **Step 2: Validate `auth` middleware in `planMiddleware`**

In the middleware planning function (where `request-context`/etc. are checked), add `case 'auth'`:

```ts
if (decl.kind === 'auth') {
  if (decl.provider !== 'auth0') {
    errors.push({ code: 'DEPLOY_PLAN_AUTH_UNSUPPORTED_PROVIDER', message: `unsupported provider "${decl.provider}"`, path: `middleware.${name}.provider` });
  }
  if (!decl.audience) {
    errors.push({ code: 'DEPLOY_PLAN_AUTH_MISSING_FIELDS', message: 'audience required', path: `middleware.${name}.audience` });
  }
  if (!decl.moduleSlug) {
    errors.push({ code: 'DEPLOY_PLAN_AUTH_MISSING_FIELDS', message: 'moduleSlug required', path: `middleware.${name}.moduleSlug` });
  } else {
    const moduleWorkload = workloads.find((w) => w.kind === 'integration-module' && w.serviceSlug === decl.moduleSlug);
    if (!moduleWorkload) {
      errors.push({ code: 'DEPLOY_PLAN_AUTH_MODULE_WORKLOAD_MISSING', message: `auth references moduleSlug "${decl.moduleSlug}" but no integration-module workload exists`, path: `middleware.${name}.moduleSlug` });
    } else {
      const env = (moduleWorkload as { env?: Record<string,string> }).env ?? {};
      if (!env.AUTH0_DOMAIN) {
        errors.push({ code: 'DEPLOY_PLAN_AUTH_MODULE_ENV_INCOMPLETE', message: `auth module workload "${decl.moduleSlug}" missing AUTH0_DOMAIN env`, path: `modules.${decl.moduleSlug}.env.AUTH0_DOMAIN` });
      }
    }
  }
}
```

- [ ] **Step 3: Tests**

Add cases that:
- pass with valid auth + matching workload + AUTH0_DOMAIN env;
- fail with unsupported provider;
- fail when no integration-module workload exists for moduleSlug;
- fail when module workload lacks AUTH0_DOMAIN.

- [ ] **Step 4: Test + commit**

Run: `pnpm -F @rntme/deploy-core test`

Expected: green.

```bash
git add packages/deploy/deploy-core/src/edge.ts packages/deploy/deploy-core/test/unit/edge.test.ts
git commit -m "feat(deploy-core): EdgeMiddleware kind=auth with provider/audience/moduleSlug + validators"
```

### Task 3.3: deploy-dokploy renders auth + SASL env

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`

- [ ] **Step 1: SASL env on domain-service workload**

In `renderResource(domain-service)` after the existing `RNTME_EVENT_BUS_BROKERS` and persistence env, add:

```ts
const eventBus = plan.infrastructure.eventBus;
if (eventBus.security?.protocol === 'sasl_ssl') {
  env.push(
    { name: 'RNTME_EVENT_BUS_PROTOCOL',  value: 'sasl_ssl',                   secret: false },
    { name: 'RNTME_EVENT_BUS_MECHANISM', value: eventBus.security.mechanism,  secret: false },
    { name: 'RNTME_EVENT_BUS_USERNAME',  value: eventBus.security.secretRefs.username, secret: true },
    { name: 'RNTME_EVENT_BUS_PASSWORD',  value: eventBus.security.secretRefs.password, secret: true },
  );
} else {
  env.push({ name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false });
}
if (eventBus.topicPrefix) {
  env.push({ name: 'RNTME_EVENT_BUS_TOPIC_PREFIX', value: eventBus.topicPrefix, secret: false });
}
```

- [ ] **Step 2: Auth env on domain-service workload**

```ts
const authMw = plan.edge.middleware.find((m) =>
  m.kind === 'auth' && routesMountedOnTarget(m.mountTarget, workload, plan.edge.routes),
);
if (authMw && authMw.kind === 'auth') {
  const moduleResourceName = dokployResourceName(plan.project.orgSlug, plan.project.projectSlug, authMw.moduleSlug);
  env.push(
    { name: 'RNTME_AUTH_PROVIDER',        value: authMw.provider,             secret: false },
    { name: 'RNTME_AUTH_AUDIENCE',        value: authMw.audience,             secret: false },
    { name: 'RNTME_AUTH_MODULE_SLUG',     value: authMw.moduleSlug,           secret: false },
    { name: 'RNTME_AUTH_MODULE_ENDPOINT', value: `${moduleResourceName}:50051`, secret: false },
  );
}
```

Implement `routesMountedOnTarget(mountTarget, workload, routes)`: for each `route` whose service equals `workload.serviceSlug`, build the mount path string and check equality with `mountTarget`. Reuse existing helpers if any.

- [ ] **Step 3: Generated `/srv/config.json` static file**

Decide where the runtime serves static assets from (likely `domain-service` workload sets a known on-disk path the runtime reads). Generate `config.json` content from the auth middleware:

```ts
if (authMw && authMw.kind === 'auth') {
  files = {
    ...(files ?? {}),
    '/srv/config.json': JSON.stringify({
      auth0: {
        domain: /* from module workload env AUTH0_DOMAIN */,
        clientId: /* configurable; lives in deploy-config */,
        audience: authMw.audience,
        redirectUri: config.publicBaseUrl,
      },
      runtime: {
        manifestUrl: '/api/manifest',
      },
    }, null, 2),
  };
}
```

This requires Auth0 SPA `clientId` to be exposed somewhere in `ProjectDeploymentConfig`. Add a new optional config bag:

```ts
// in deploy-core/config.ts
export type ProjectAuthConfig = {
  readonly auth0?: { readonly clientId: string };
};

export type ProjectDeploymentConfig = {
  // …existing
  readonly auth?: ProjectAuthConfig;
};
```

(Plan validator: if any auth middleware is present, `config.auth?.auth0?.clientId` must be set → `DEPLOY_PLAN_AUTH_CLIENT_ID_MISSING`.)

- [ ] **Step 4: nginx noop comment**

In `nginx.ts`, where route blocks are emitted, when an `auth` middleware is on the route's mountTarget, emit a single comment line in the route's nginx block:

```
# auth middleware: provider=auth0, audience=<audience>
# - delegated to runtime via identity module RPC; edge does not validate JWT
```

No `location` directives, no `auth_request`.

- [ ] **Step 5: Snapshot test for full notes-demo plan**

Add a render snapshot test that builds a `ProjectDeploymentPlan` shaped like the notes-demo (one domain-service, one identity-auth0 integration-module, one edge-gateway, kind:auth middleware mounted on /api, eventBus sasl_ssl) and asserts:
- domain-service workload env has `RNTME_AUTH_*` and `RNTME_EVENT_BUS_*` (SASL).
- domain-service `files['/srv/config.json']` contains valid JSON with `auth0.audience` matching the middleware audience.
- nginx config does not emit any `auth_request` directives.

- [ ] **Step 6: Test + commit**

Run: `pnpm -F @rntme/deploy-dokploy test`

Expected: green.

```bash
git add packages/deploy/deploy-core/src/config.ts packages/deploy/deploy-dokploy/src/render.ts packages/deploy/deploy-dokploy/src/nginx.ts packages/deploy/deploy-dokploy/test/unit/render.test.ts
git commit -m "feat(deploy-dokploy): render auth env, SASL env, generated config.json; nginx noop for kind=auth"
```

### Task 3.4: Runtime — read `RNTME_AUTH_*` env, init `ExternalAdapterClient`

**Files:**
- Modify: `packages/runtime/runtime/src/start/...` (boot pipeline)

- [ ] **Step 1: Locate boot env parsing**

Run: `grep -rn "parseEnv\|process\.env\.RNTME_" packages/runtime/runtime/src/`

Identify the env reader.

- [ ] **Step 2: Add `RNTME_AUTH_*` reading**

Add fields to the parsed-env type:

```ts
authProvider?: 'auth0';
authAudience?: string;
authModuleSlug?: string;
authModuleEndpoint?: string;
```

If `RNTME_AUTH_PROVIDER` is set:
- All three other vars must be non-empty → otherwise `RUNTIME_BOOT_AUTH_ENV_INCOMPLETE`.

- [ ] **Step 3: Construct `ExternalAdapterClient` registry**

In the boot pipeline where the runtime wires deps to bindings-http:

```ts
let externalAdapterClient: ExternalAdapterClient | undefined;
if (env.authProvider === 'auth0' && env.authModuleEndpoint) {
  externalAdapterClient = createGrpcAdapterClient({
    [env.authModuleSlug!]: { endpoint: env.authModuleEndpoint },
  });
}
const router = createBindingsRouter({ /* …existing… */, externalAdapterClient, authMiddlewareModuleSlug: env.authModuleSlug });
```

(`createGrpcAdapterClient` is whatever ExternalAdapterClient gRPC factory exists; if there is none, this task gates on Phase 1 producing a usable client. Search `packages/runtime/bindings-http/src/runtime-contract.ts` for the interface and pick the closest existing implementation. If the registry is hand-coded, accept a record and do `transport.call(module, rpc, input)` via gRPC HTTP/2.)

- [ ] **Step 4: SASL env into Kafka client**

Locate the Kafka producer/consumer construction in runtime (search `kafkajs\|new Kafka`). Add SASL config when `RNTME_EVENT_BUS_PROTOCOL=sasl_ssl`:

```ts
const kafka = new Kafka({
  brokers,
  ssl: protocol === 'sasl_ssl',
  sasl: protocol === 'sasl_ssl' ? {
    mechanism: env.eventBusMechanism!,           // 'scram-sha-256' | 'scram-sha-512'
    username: env.eventBusUsername!,
    password: env.eventBusPassword!,
  } : undefined,
});
```

- [ ] **Step 5: Tests**

Unit-test the env parser with: missing one of three RNTME_AUTH_* values → error; full set → ok; missing SASL creds with protocol sasl_ssl → error.

- [ ] **Step 6: Test + commit**

Run: `pnpm -F @rntme/runtime test`

Expected: green.

```bash
git add packages/runtime/runtime/src
git commit -m "feat(runtime): consume RNTME_AUTH_* and SASL_SSL env in boot pipeline"
```

### Task 3.5: Phase 3 final pass + READMEs

- [ ] **Step 1: Full Phase 3 test**

Run: `pnpm -F @rntme/deploy-core test && pnpm -F @rntme/deploy-dokploy test && pnpm -F @rntme/runtime test`

Expected: green.

- [ ] **Step 2: Update READMEs**

`deploy-core/README.md`: add to "Public API" notes about new SASL union and `kind: "auth"` middleware.
`deploy-dokploy/README.md`: add to "Where to look first" how auth is rendered.
`runtime/README.md`: list new env vars.

- [ ] **Step 3: Commit**

```bash
git add packages/deploy/deploy-core/README.md packages/deploy/deploy-dokploy/README.md packages/runtime/runtime/README.md
git commit -m "docs: deploy-core/deploy-dokploy/runtime READMEs for auth + SASL"
```

---

## Phase 4 — UI auth-shell + ui-runtime

**Status update (2026-04-30):** Phase 4 is superseded by `docs/history/specs/active-rationale/2026-04-30-notes-demo-auth0-migration-design.md`. Phases 1-3, 5-7 remain authoritative.

### Task 4.1: Scaffold `@rntme/ui-auth-shell`

**Files:**
- Create: `packages/ui-auth-shell/` package skeleton.

- [ ] **Step 1: Create package directory and base files**

```bash
mkdir -p packages/ui-auth-shell/src packages/ui-auth-shell/test/unit
```

`packages/ui-auth-shell/package.json`:

```json
{
  "name": "@rntme/ui-auth-shell",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.check.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src test"
  },
  "dependencies": {
    "@auth0/auth0-spa-js": "^2.1.3"
  },
  "peerDependencies": {
    "@rntme/ui-runtime": "workspace:*"
  },
  "devDependencies": {
    "@rntme/ui-runtime": "workspace:*",
    "vitest": "*",
    "typescript": "*",
    "eslint": "*"
  }
}
```

`tsconfig.json`, `tsconfig.check.json`, `vitest.config.ts`, `eslint.config.mjs` — copy structure from `packages/runtime/ui-runtime/`. `README.md` — minimal stub for now (filled in Task 4.10).

- [ ] **Step 2: Install + typecheck baseline**

Run: `pnpm install && pnpm -F @rntme/ui-auth-shell typecheck`

Expected: typecheck succeeds (empty src is fine).

- [ ] **Step 3: Commit**

```bash
git add packages/ui-auth-shell/package.json packages/ui-auth-shell/tsconfig.json packages/ui-auth-shell/tsconfig.check.json packages/ui-auth-shell/vitest.config.ts packages/ui-auth-shell/eslint.config.mjs packages/ui-auth-shell/README.md pnpm-lock.yaml
git commit -m "chore(ui-auth-shell): scaffold package"
```

### Task 4.2: Failing test — transport injects Bearer + handles 401

**Files:**
- Create: `packages/ui-auth-shell/test/unit/transport.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createAuthedTransport } from '../../src/transport.js';

describe('createAuthedTransport', () => {
  it('injects Authorization: Bearer when token present', async () => {
    const baseFetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const t = createAuthedTransport({ baseFetch, getToken: () => 'tok', on401: vi.fn() });
    await t('/x', {});
    expect(baseFetch).toHaveBeenCalledOnce();
    const init = (baseFetch as any).mock.calls[0][1];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');
  });

  it('does not inject Authorization when token null', async () => {
    const baseFetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const t = createAuthedTransport({ baseFetch, getToken: () => null, on401: vi.fn() });
    await t('/x', {});
    const init = (baseFetch as any).mock.calls[0][1];
    expect(new Headers(init.headers).get('authorization')).toBeNull();
  });

  it('on 401: calls on401 then throws', async () => {
    const baseFetch = vi.fn(async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    const on401 = vi.fn();
    const t = createAuthedTransport({ baseFetch, getToken: () => 'tok', on401 });
    await expect(t('/x', {})).rejects.toThrow('UI_AUTH_SHELL_UNAUTHENTICATED');
    expect(on401).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect fail (module missing)**

Run: `pnpm -F @rntme/ui-auth-shell vitest run test/unit/transport.test.ts`

Expected: import error.

### Task 4.3: Implement `transport.ts`

**Files:**
- Create: `packages/ui-auth-shell/src/transport.ts`

- [ ] **Step 1: Implement**

```ts
export type TransportOpts = {
  baseFetch: typeof fetch;
  getToken: () => string | null;
  on401: () => void;
};

export function createAuthedTransport(opts: TransportOpts): typeof fetch {
  return async (input, init) => {
    const token = opts.getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await opts.baseFetch(input, { ...(init ?? {}), headers });
    if (response.status === 401) {
      opts.on401();
      throw new Error('UI_AUTH_SHELL_UNAUTHENTICATED');
    }
    return response;
  };
}
```

- [ ] **Step 2: Run — expect pass**

Run: `pnpm -F @rntme/ui-auth-shell vitest run test/unit/transport.test.ts`

Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-auth-shell/src/transport.ts packages/ui-auth-shell/test/unit/transport.test.ts
git commit -m "feat(ui-auth-shell): authed transport with Bearer injection and 401 handling"
```

### Task 4.4: Config types + validation

**Files:**
- Create: `packages/ui-auth-shell/src/types.ts`
- Create: `packages/ui-auth-shell/src/config.ts`
- Create: `packages/ui-auth-shell/test/unit/config.test.ts`

- [ ] **Step 1: Types**

```ts
// types.ts
export type CurrentUser = { sub: string; email: string | null; name: string | null };

export type AuthShellConfig = {
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
    redirectUri: string;
    scope?: string;
  };
  runtime: {
    manifestUrl: string;
    target: HTMLElement;
  };
};

export type MountResult = { unmount: () => void };
```

- [ ] **Step 2: Config parser test (failing first)**

```ts
// config.test.ts
import { describe, it, expect } from 'vitest';
import { parseAuthShellConfig } from '../../src/config.js';

describe('parseAuthShellConfig', () => {
  const ok = {
    auth0: { domain: 't.us.auth0.com', clientId: 'cid', audience: 'https://api/', redirectUri: 'https://app/' },
    runtime: { manifestUrl: '/api/manifest' },
  };
  it('rejects empty domain/clientId/audience/redirectUri', () => {
    for (const k of ['domain', 'clientId', 'audience', 'redirectUri'] as const) {
      const bad = { ...ok, auth0: { ...ok.auth0, [k]: '' } };
      const r = parseAuthShellConfig(bad);
      expect(r.ok).toBe(false);
    }
  });
  it('accepts a valid config', () => {
    const r = parseAuthShellConfig(ok);
    expect(r.ok).toBe(true);
  });
});
```

Run: `pnpm -F @rntme/ui-auth-shell vitest run test/unit/config.test.ts` → fails.

- [ ] **Step 3: Implement parser**

```ts
// config.ts
import type { AuthShellConfig } from './types.js';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function parseAuthShellConfig(input: unknown): ParseResult<Omit<AuthShellConfig, 'runtime'> & { runtime: { manifestUrl: string } }> {
  const errors: string[] = [];
  const i = input as any;
  for (const k of ['domain', 'clientId', 'audience', 'redirectUri'] as const) {
    if (!i?.auth0?.[k] || typeof i.auth0[k] !== 'string' || i.auth0[k].length === 0) {
      errors.push(`auth0.${k} must be a non-empty string`);
    }
  }
  if (!i?.runtime?.manifestUrl || typeof i.runtime.manifestUrl !== 'string' || i.runtime.manifestUrl.length === 0) {
    errors.push('runtime.manifestUrl must be a non-empty string');
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: i };
}
```

- [ ] **Step 4: Pass + commit**

Run: tests green.

```bash
git add packages/ui-auth-shell/src/types.ts packages/ui-auth-shell/src/config.ts packages/ui-auth-shell/test/unit/config.test.ts
git commit -m "feat(ui-auth-shell): config types and validator"
```

### Task 4.5: Auth0 client wrapper

**Files:**
- Create: `packages/ui-auth-shell/src/auth0-client.ts`
- Create: `packages/ui-auth-shell/test/unit/auth0-client.test.ts`

- [ ] **Step 1: Failing test for state machine**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createAuthSession } from '../../src/auth0-client.js';

const fakeAuth0 = (overrides: Partial<any> = {}) => ({
  isAuthenticated: vi.fn(async () => false),
  loginWithRedirect: vi.fn(async () => undefined),
  handleRedirectCallback: vi.fn(async () => undefined),
  getTokenSilently: vi.fn(async () => 'tok'),
  getIdTokenClaims: vi.fn(async () => ({ sub: 'auth0|x', email: 'e@x', name: 'E' })),
  logout: vi.fn(async () => undefined),
  ...overrides,
});

describe('createAuthSession', () => {
  it('reports anon when not authenticated and no code in URL', async () => {
    const c = fakeAuth0();
    const s = await createAuthSession({ client: c, location: new URL('https://app/') });
    expect(s.state).toBe('anon');
    expect(s.token).toBe(null);
  });

  it('exchanges code on callback URL and becomes authed', async () => {
    const c = fakeAuth0({ isAuthenticated: vi.fn(async () => true) });
    const s = await createAuthSession({ client: c, location: new URL('https://app/?code=abc&state=xyz') });
    expect(s.state).toBe('authed');
    expect(s.token).toBe('tok');
    expect(s.currentUser?.sub).toBe('auth0|x');
    expect(c.handleRedirectCallback).toHaveBeenCalledOnce();
  });
});
```

Run → fail (module missing).

- [ ] **Step 2: Implement**

```ts
// auth0-client.ts
import type { Auth0Client } from '@auth0/auth0-spa-js';
import type { CurrentUser } from './types.js';

export type AuthSession = {
  state: 'anon' | 'authed';
  token: string | null;
  currentUser: CurrentUser | null;
};

export async function createAuthSession(opts: {
  client: Pick<Auth0Client, 'isAuthenticated' | 'handleRedirectCallback' | 'getTokenSilently' | 'getIdTokenClaims'>;
  location: URL;
}): Promise<AuthSession> {
  if (opts.location.searchParams.has('code') && opts.location.searchParams.has('state')) {
    await opts.client.handleRedirectCallback();
  }
  const authed = await opts.client.isAuthenticated();
  if (!authed) {
    return { state: 'anon', token: null, currentUser: null };
  }
  const token = await opts.client.getTokenSilently();
  const claims = await opts.client.getIdTokenClaims();
  const cu: CurrentUser = {
    sub: String(claims?.sub ?? ''),
    email: (claims?.email as string | undefined) ?? null,
    name: (claims?.name as string | undefined) ?? null,
  };
  return { state: 'authed', token, currentUser: cu };
}
```

- [ ] **Step 3: Pass + commit**

Run tests → green.

```bash
git add packages/ui-auth-shell/src/auth0-client.ts packages/ui-auth-shell/test/unit/auth0-client.test.ts
git commit -m "feat(ui-auth-shell): auth0 session state machine wrapper"
```

### Task 4.6: Login chrome (vanilla DOM)

**Files:**
- Create: `packages/ui-auth-shell/src/chrome.ts`

- [ ] **Step 1: Implement**

```ts
import type { CurrentUser } from './types.js';

export function renderLogin(target: HTMLElement, onLogin: () => void): void {
  target.innerHTML = `
    <div class="rntme-auth-shell__login">
      <h1>notes-demo</h1>
      <p>Sign in to view and create notes.</p>
      <button id="rntme-login-btn" class="rntme-auth-shell__login-button">Sign in</button>
    </div>`;
  target.querySelector<HTMLButtonElement>('#rntme-login-btn')!.onclick = onLogin;
}

export function renderShell(target: HTMLElement, user: CurrentUser, onLogout: () => void): HTMLElement {
  target.innerHTML = `
    <div class="rntme-auth-shell">
      <div class="rntme-auth-shell__topbar">
        <span class="rntme-auth-shell__user">${escapeHtml(user.email ?? user.sub)}</span>
        <button id="rntme-logout-btn">Logout</button>
      </div>
      <div id="rntme-runtime-root"></div>
    </div>`;
  target.querySelector<HTMLButtonElement>('#rntme-logout-btn')!.onclick = onLogout;
  return target.querySelector<HTMLElement>('#rntme-runtime-root')!;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
```

- [ ] **Step 2: Add minimal CSS inline**

Append a small CSS string and a `injectStyles()` helper that prepends a `<style>` tag once.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-auth-shell/src/chrome.ts
git commit -m "feat(ui-auth-shell): vanilla-DOM login and logout chrome"
```

### Task 4.7: `mountAuthenticatedApp` orchestrator

**Files:**
- Create: `packages/ui-auth-shell/src/index.ts`

- [ ] **Step 1: Implement**

```ts
import { Auth0Client } from '@auth0/auth0-spa-js';
import { parseAuthShellConfig } from './config.js';
import { createAuthSession } from './auth0-client.js';
import { createAuthedTransport } from './transport.js';
import { renderLogin, renderShell } from './chrome.js';
import type { AuthShellConfig, MountResult } from './types.js';

export async function mountAuthenticatedApp(rawConfig: AuthShellConfig): Promise<MountResult> {
  const parsed = parseAuthShellConfig(rawConfig);
  if (!parsed.ok) throw new Error(`AuthShellConfig invalid: ${parsed.errors.join('; ')}`);

  const client = new Auth0Client({
    domain: rawConfig.auth0.domain,
    clientId: rawConfig.auth0.clientId,
    authorizationParams: {
      audience: rawConfig.auth0.audience,
      redirect_uri: rawConfig.auth0.redirectUri,
      scope: rawConfig.auth0.scope ?? 'openid profile email',
    },
  });

  let session = await createAuthSession({ client, location: new URL(window.location.href) });

  let token = session.token;
  let unmounted = false;

  const target = rawConfig.runtime.target;

  const renderAnon = () => {
    renderLogin(target, () => { void client.loginWithRedirect(); });
  };

  const onLogout = () => { void client.logout({ logoutParams: { returnTo: rawConfig.auth0.redirectUri } }); };

  const on401 = () => {
    token = null;
    session = { state: 'anon', token: null, currentUser: null };
    renderAnon();
  };

  if (session.state === 'anon') {
    renderAnon();
  } else if (session.currentUser) {
    const root = renderShell(target, session.currentUser, onLogout);
    const transport = createAuthedTransport({ baseFetch: fetch.bind(window), getToken: () => token, on401 });
    const { mountUiRuntime } = await import('@rntme/ui-runtime');
    await mountUiRuntime({
      manifestUrl: rawConfig.runtime.manifestUrl,
      target: root,
      transport,
      initialState: { currentUser: session.currentUser },
    });
  }

  return { unmount: () => { unmounted = true; target.innerHTML = ''; } };
}

export type { AuthShellConfig, MountResult } from './types.js';
```

(Note: `mountUiRuntime` export must be created in Phase 4 Task 4.8. The dynamic `import` is to keep the shell loading the runtime on demand.)

- [ ] **Step 2: Build**

Run: `pnpm -F @rntme/ui-auth-shell build`

Expected: typecheck + build succeed (mountUiRuntime resolves to the to-be-created export).

- [ ] **Step 3: Commit**

```bash
git add packages/ui-auth-shell/src/index.ts
git commit -m "feat(ui-auth-shell): mountAuthenticatedApp orchestrator"
```

### Task 4.8: ui-runtime accepts `transport` and `initialState`

**Files:**
- Modify: `packages/runtime/ui-runtime/src/client/entry.tsx`
- Modify: `packages/runtime/ui-runtime/src/index.ts` — export `mountUiRuntime`.

- [ ] **Step 1: Locate the SPA bootstrap**

Run: `grep -n "createRoot\|hydrateRoot" packages/runtime/ui-runtime/src/client/entry.tsx`

- [ ] **Step 2: Wrap into a function**

Change the top-level execution into an exported `mountUiRuntime` taking opts:

```ts
export async function mountUiRuntime(opts: {
  manifestUrl: string;
  target: HTMLElement;
  transport?: typeof fetch;
  initialState?: Record<string, unknown>;
}): Promise<void> {
  const fetchImpl = opts.transport ?? fetch.bind(window);
  // existing manifest fetch — replace global fetch with fetchImpl
  const manifest = await fetchImpl(opts.manifestUrl).then((r) => r.json());
  // ...
  const stateStore = createStateStore({ initial: opts.initialState ?? {}, readonlyKeys: ['currentUser'] });
  // every internal fetch site routes through fetchImpl
  // ...
  createRoot(opts.target).render(<AppShell …deps wired with fetchImpl, stateStore… />);
}
```

(`readonlyKeys` is a new state-store option — implement in `@json-render/core` or shim locally if not available; for MVP, freeze the values in the initial-state object before passing to the store.)

- [ ] **Step 3: Re-export from index**

```ts
// packages/runtime/ui-runtime/src/index.ts
export { createApp } from './server/index.js';
export type { CreateAppOptions } from './server/index.js';
export { mountUiRuntime } from './client/entry.js';
```

(Watch: `entry.tsx` → make it `entry.ts` if no JSX needed in the export, or keep .tsx and import from `.js` per existing convention.)

- [ ] **Step 4: Update SPA bundle build to call shell**

Modify `packages/runtime/ui-runtime/src/build.ts` (or the esbuild entry) so the produced `app.js` is:

```ts
import { mountAuthenticatedApp } from '@rntme/ui-auth-shell';
const cfg = (window as any).__RNTME_AUTH_SHELL_CONFIG__;
const target = document.getElementById('root')!;
void mountAuthenticatedApp({ ...cfg, runtime: { ...cfg.runtime, target } });
```

And the produced `index.html` includes an early script that loads `/config.json` and stores it on `window.__RNTME_AUTH_SHELL_CONFIG__` before the bundle runs:

```html
<script>
  fetch('/config.json').then(r => r.json()).then(cfg => {
    (window).__RNTME_AUTH_SHELL_CONFIG__ = cfg;
    const s = document.createElement('script');
    s.type = 'module'; s.src = '/app.js';
    document.body.appendChild(s);
  });
</script>
```

- [ ] **Step 5: Test + commit**

Run: `pnpm -F @rntme/ui-runtime test && pnpm -F @rntme/ui-auth-shell test`

Expected: green.

```bash
git add packages/runtime/ui-runtime/src packages/runtime/ui-runtime/README.md
git commit -m "feat(ui-runtime): mountUiRuntime export with transport/initialState; SPA bundle loads /config.json then auth-shell"
```

### Task 4.9: Phase 4 final pass + manual smoke

- [ ] **Step 1: Build the SPA bundle**

Run: `pnpm -F @rntme/ui-runtime build`

Expected: SPA bundle artifacts emitted; no esbuild errors.

- [ ] **Step 2: Local browser manual smoke**

Build + serve the bundle locally, point `/config.json` at a test Auth0 SPA application, click Sign in, expect redirect to `demo-rntme.us.auth0.com`, return with code, see the runtime mount with `currentUser` displayed in topbar. Token expiry behavior is checked in Phase 7.

- [ ] **Step 3: Commit READMEs**

`packages/ui-auth-shell/README.md`: full content per spec §9. `packages/runtime/ui-runtime/README.md`: note the new bootstrap flow.

```bash
git add packages/ui-auth-shell/README.md packages/runtime/ui-runtime/README.md
git commit -m "docs: ui-auth-shell + ui-runtime READMEs"
```

---

## Phase 5 — Notes blueprint update

Phase 5 starts only after Phases 1–4 are merged.

### Task 5.1: Update `Note.json` PDM

**Files:**
- Modify: `demo/notes-blueprint/pdm/entities/Note.json`

- [ ] **Step 1: Add `ownerSub` field + transition**

Replace contents with §5.3 of the spec:

```json
{
  "ownerService": "app",
  "kind": "owned",
  "table": "notes",
  "fields": {
    "id":        { "type": "string",   "nullable": false, "column": "id" },
    "title":     { "type": "string",   "nullable": false, "column": "title" },
    "body":      { "type": "string",   "nullable": false, "column": "body" },
    "ownerSub":  { "type": "string",   "nullable": false, "column": "owner_sub" },
    "status":    { "type": "string",   "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "deleted"],
    "transitions": {
      "create": { "from": null,     "to": "active",  "affects": ["title", "body", "ownerSub"] },
      "delete": { "from": "active", "to": "deleted" }
    }
  }
}
```

### Task 5.2: Update QSM projection NoteView

**Files:**
- Modify: `demo/notes-blueprint/services/app/qsm/projections/NoteView.json`

- [ ] **Step 1: Add `ownerSub` and `createdAt` to exposed**

```json
{
  "backing": "entity-mirror",
  "source": { "entity": "Note" },
  "keys": ["id"],
  "grain": ["id"],
  "exposed": ["title", "body", "ownerSub", "status", "createdAt"]
}
```

### Task 5.3: Update graphs `shapes.json`

**Files:**
- Modify: `demo/notes-blueprint/services/app/graphs/shapes.json`

- [ ] **Step 1: Add `ownerSub` to NoteView shape**

```json
{
  "NoteView": {
    "fields": {
      "id":        { "type": "string",   "nullable": false },
      "title":     { "type": "string",   "nullable": false },
      "body":      { "type": "string",   "nullable": false },
      "ownerSub":  { "type": "string",   "nullable": false },
      "status":    { "type": "string",   "nullable": false },
      "createdAt": { "type": "datetime", "nullable": false }
    }
  }
}
```

### Task 5.4: Update `createNote.json`

**Files:**
- Modify: `demo/notes-blueprint/services/app/graphs/createNote.json`

- [ ] **Step 1: Inject `ownerSub` from `$pre`**

```json
{
  "id": "createNote",
  "signature": {
    "inputs": {
      "id":    { "type": "string", "mode": "required" },
      "title": { "type": "string", "mode": "required" },
      "body":  { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$param": "id" },
        "transition": "create",
        "payload": {
          "title":    { "$param": "title" },
          "body":     { "$param": "body" },
          "ownerSub": { "$pre":   "session.user_id" }
        }
      }
    }
  ]
}
```

### Task 5.5: Update `deleteNote.json` with guard pattern

**Files:**
- Modify: `demo/notes-blueprint/services/app/graphs/deleteNote.json`

- [ ] **Step 1: Multi-node guard**

```json
{
  "id": "deleteNote",
  "signature": {
    "inputs": {
      "id": { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    { "id": "all",   "type": "findMany", "config": { "source": { "projection": "NoteView" } } },
    {
      "id": "guard", "type": "filter",
      "config": {
        "input": "all",
        "expr": {
          "and": [
            { "eq": ["noteView.id",       { "$param": "id" }] },
            { "eq": ["noteView.ownerSub", { "$pre":   "session.user_id" }] }
          ]
        }
      }
    },
    {
      "id": "emit", "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$param": "id" },
        "transition": "delete",
        "payload": {}
      }
    }
  ]
}
```

### Task 5.6: identity-auth0 service stub

**Files:**
- Create: `demo/notes-blueprint/services/identity-auth0/service.json`

- [ ] **Step 1: Minimal service shape**

```json
{ "kind": "integration-module" }
```

### Task 5.7: Update `project.json`

**Files:**
- Modify: `demo/notes-blueprint/project.json`

- [ ] **Step 1: Add identity-auth0 service + auth middleware**

```json
{
  "name": "notes-demo",
  "services": ["app", "identity-auth0"],
  "routes": {
    "ui": { "/": "app" },
    "http": { "/api": "app" }
  },
  "middleware": {
    "requestContext": { "kind": "request-context" },
    "auth": {
      "kind": "auth",
      "provider": "auth0",
      "audience": "https://notes-demo.rntme.com/api",
      "moduleSlug": "identity-auth0"
    }
  },
  "mounts": [
    { "target": "ui:/",     "use": ["requestContext"] },
    { "target": "http:/api", "use": ["requestContext", "auth"] }
  ]
}
```

### Task 5.8: Update `bindings.json`

**Files:**
- Modify: `demo/notes-blueprint/services/app/bindings/bindings.json`

- [ ] **Step 1: Add `pre[]` to all four bindings**

Replace `bindings.json` contents with §5.9 of the spec (full JSON; do not abbreviate).

### Task 5.9: Update `seed.json`

**Files:**
- Modify: `demo/notes-blueprint/services/app/seed/seed.json`

- [ ] **Step 1: Add `ownerSub: "system"` to seed event data**

```json
{
  "seedVersion": 1,
  "events": [
    {
      "id": "seed:Note:welcome:v1",
      "subject": "Note-00000000-0000-0000-0000-000000000001",
      "rntAggregateType": "Note",
      "rntAggregateId":   "00000000-0000-0000-0000-000000000001",
      "rntVersion": 1,
      "eventType": "NoteCreate",
      "data": {
        "title":    "Welcome to notes-demo",
        "body":     "This is a system-seeded note. Anyone can see it; no one can delete it.",
        "ownerSub": "system"
      },
      "time": "2026-04-29T00:00:00.000Z",
      "rntSchemaVersion": 1
    }
  ]
}
```

### Task 5.10: Validate the blueprint locally

- [ ] **Step 1: Build blueprint package + run loader**

```bash
pnpm install --frozen-lockfile
pnpm --filter @rntme/blueprint... build
pnpm --filter @rntme/blueprint exec node --input-type=module -e "
  import { loadComposedBlueprint } from '@rntme/blueprint';
  const r = loadComposedBlueprint('../../demo/notes-blueprint');
  if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); }
  console.log('ok:', Object.keys(r.value));
"
```

Expected: `ok: …` printed.

- [ ] **Step 2: If validation fails — fix the blueprint**

Common failures: `BLUEPRINT_AUTH_AUDIENCE_MISMATCH` (mistype between project.json and bindings.json), `BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING` (graph references `$pre` for a `bindAs` not declared in the binding), missing identity-auth0 service.json. Read the error code carefully; do not silence with hacks.

- [ ] **Step 3: Commit blueprint**

```bash
git add demo/notes-blueprint
git commit -m "feat(notes-blueprint): Auth0 ownership, identity-auth0 wiring, $pre payload injection"
```

### Task 5.11: README rewrite + supersede 2026-04-27 spec

**Files:**
- Modify: `demo/notes-blueprint/README.md`
- Modify: `docs/history/specs/active-rationale/2026-04-27-notes-demo-e2e-design.md`

- [ ] **Step 1: Rewrite blueprint README**

Cover: production-shape demo description, login flow at a glance, ownership semantics (system seed note read-only), how to validate locally, link to `2026-04-29-notes-demo-auth0-design.md`.

- [ ] **Step 2: Add status flip to 2026-04-27 spec**

At the very top of `2026-04-27-notes-demo-e2e-design.md`, replace the existing `**Status:** ...` line with:

```
**Status:** superseded by `docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md` — the v1 no-auth preview was rolled into the production-shape Auth0 demo before any deploy ran. Original content kept below for reference.
```

(If the v1 deployment did run, this Phase 6 task switches to "rolled into v2 deploy" with a link to the deployment record. Decided in Task 6.0.)

- [ ] **Step 3: Update CLAUDE.md / AGENTS.md / root README per spec §11**

`CLAUDE.md` "Architecture in one paragraph": insert one phrase about auth-middleware and Identity module participation.
`AGENTS.md`: add how-to "wire Auth0 (or other OIDC vendor) into a project blueprint" pointing at the new spec.
Root `README.md`: add `@rntme/ui-auth-shell` to the packages table.

- [ ] **Step 4: Commit**

```bash
git add demo/notes-blueprint/README.md docs/history/specs/active-rationale/2026-04-27-notes-demo-e2e-design.md CLAUDE.md AGENTS.md README.md
git commit -m "docs: supersede 2026-04-27 notes-demo spec; document auth-middleware wiring"
```

---

## Phase 6 — External setup + deploy

### Task 6.0: Decide superseded vs v2-rolled

- [ ] **Step 1: Check whether the v1 (no-auth) deploy ever ran**

Inspect platform DB or Dokploy console for an existing notes-demo project. If yes → status flip says "rolled into v2"; if no → "superseded".

### Task 6.1: Auth0 dashboard — custom API audience

- [ ] **Step 1: Manual via Auth0 dashboard (`https://manage.auth0.com/`)**

Tenant `demo-rntme.us.auth0.com` → APIs → Create API:
- Name: `Notes Demo API`
- Identifier: `https://notes-demo.rntme.com/api` (must match `project.json#middleware.auth.audience`).
- Signing Algorithm: RS256.

### Task 6.2: Auth0 dashboard — SPA application

- [ ] **Step 1: Create application**

Applications → Create Application:
- Name: `Notes Demo SPA`.
- Type: Single Page Application.

In application settings:
- Application Type: SPA.
- Token Endpoint Authentication Method: None.
- Grant Types: Authorization Code, Refresh Token.
- Allowed Callback URLs: `https://notes-demo.rntme.com/`
- Allowed Logout URLs: `https://notes-demo.rntme.com/`
- Allowed Web Origins: `https://notes-demo.rntme.com`
- Refresh Token Rotation: ON.
- Refresh Token Behavior: Rotating.
- Refresh Token Lifetime: 30 days (default fine).

Record `Client ID` (public) — needed for `/config.json`.

### Task 6.3: Redpanda Cloud — SASL user + ACLs

- [ ] **Step 1: Create user**

Redpanda Cloud cluster `d7hltif095r0u8rsc2g0` → Security → Users → Create user:
- Username: `notes-demo`.
- Password: generate and save offline.
- Mechanism: SCRAM-SHA-512.

- [ ] **Step 2: ACLs**

Allow user `notes-demo` to produce and consume on topics matching `rntme.app.note*` (and any other prefix the runtime uses for this demo). Also allow `IDEMPOTENT_WRITE` on cluster scope if KafkaJS requires it. Verify by testing connection from a local kafkacat or runtime smoke.

### Task 6.4: Build + push docker images

- [ ] **Step 1: identity-auth0 image**

```bash
cd modules/identity/auth0
docker build -t ghcr.io/rntme/identity-auth0:0.1.0 .
docker push ghcr.io/rntme/identity-auth0:0.1.0
```

(Dockerfile may need updating to point at the gRPC server entry. If not present, add a simple Dockerfile that runs `node dist/server.js` exposing 50051.)

- [ ] **Step 2: runtime image**

The runtime image already lives somewhere in the deploy pipeline (`config.runtimeImage` defaults to `rntme-runtime`). Build a new tag with the SASL/auth env consumption changes from Phase 3 and push:

```bash
cd packages/runtime
docker build -t ghcr.io/rntme/runtime:auth-1 .
docker push ghcr.io/rntme/runtime:auth-1
```

### Task 6.5: Dokploy secrets

- [ ] **Step 1: Add secrets via Dokploy MCP or UI**

Project `rntme-demos` (or create per Q5/spec):
- Secret `RNTME_EVENT_BUS_USERNAME` = `notes-demo`.
- Secret `RNTME_EVENT_BUS_PASSWORD` = the generated SCRAM password.

(No Auth0 Mgmt token; the module does not use Mgmt API in this demo.)

### Task 6.6: `rntme project publish`

- [ ] **Step 1: From repo root**

```bash
pnpm -F @rntme/cli build
alias rntme="node $(pwd)/apps/cli/dist/bin/rntme.js"
rntme login
rntme whoami
rntme project create notes-demo   # if not already present from any prior run
rntme project publish --folder demo/notes-blueprint
```

Expected: `Published as version #N, digest sha256:<short>`. Save `N`.

### Task 6.7: Create / update deploy_target

- [ ] **Step 1: Platform UI → `/{org}/deploy-targets`**

`[+ New target]` (or update existing `dokploy-demos`):
- `slug`: `dokploy-demos`.
- `kind`: `dokploy`.
- `dokployUrl`: `https://<dokploy-host>` (no `/api`, per `dokploy_mcp_url_gotcha` memory).
- `dokployProjectId`: existing or new project ID.
- `apiToken`: a fresh Dokploy API token scoped to `rntme-demos`.
- `eventBus`:
  ```json
  {
    "kind": "kafka",
    "mode": "external",
    "brokers": ["d7hltif095r0u8rsc2g0.any.ap-southeast-1.mpx.prd.cloud.redpanda.com:9092"],
    "topicPrefix": "rntme",
    "security": {
      "protocol": "sasl_ssl",
      "mechanism": "scram-sha-512",
      "secretRefs": { "username": "RNTME_EVENT_BUS_USERNAME", "password": "RNTME_EVENT_BUS_PASSWORD" }
    }
  }
  ```
- `auth.auth0.clientId`: the SPA Client ID from Task 6.2.
- `modules`:
  ```json
  {
    "identity-auth0": {
      "image": "ghcr.io/rntme/identity-auth0:0.1.0",
      "expose": false,
      "env": { "AUTH0_DOMAIN": "demo-rntme.us.auth0.com" },
      "secretRefs": {}
    }
  }
  ```
- `runtimeImage`: `ghcr.io/rntme/runtime:auth-1`.
- `policyValues`: same as 2026-04-27 §4.6.
- `isDefault`: true.

Save → secrets redacted in UI listing.

### Task 6.8: Deploy + watch

- [ ] **Step 1: From `/{org}/projects/notes-demo/versions/<N>` click `[Deploy]`**

Form: target = `dokploy-demos`, no overrides. Submit.

- [ ] **Step 2: Watch deployment detail page**

Polling every 2s. Steps: `init` → `plan` → `render` → `apply` → `verify` → `finalize`. Expect `succeeded` (not `succeeded_with_warnings`).

- [ ] **Step 3: If failure**

Failure paths and reactions per §10.1 risks. The deploy is idempotent — re-run before changing code.

---

## Phase 7 — Smoke check + recording

Order: pass each gate before moving to the next.

### Task 7.1: deployments.status = succeeded

- [ ] **Step 1: Check platform DB / UI**

Confirm the deployment row shows `succeeded`. If `succeeded_with_warnings` — read the warnings; this is **not** a pass per §10.1.

### Task 7.2: verification_report all ok

- [ ] **Step 1: Open verification report on the deployment detail page**

All checks must show `ok=true, partialOk=false`.

### Task 7.3: Edge URL renders SPA without console errors

- [ ] **Step 1: Open `https://notes-demo.rntme.com/` in browser DevTools**

Expect: SPA bundle loaded, anonymous login chrome rendered, no console errors, `/config.json` 200.

### Task 7.4: User A creates a note

- [ ] **Step 1: Sign in as user A**

Click Sign in → redirected to Auth0 → login (test account A) → redirected back. Expect topbar shows A's email.

- [ ] **Step 2: Create note**

Type `id`, `title`, `body` → click Add. Expect 201 in Network tab, the new note appears in the list with `ownerSub` matching A's `sub`.

### Task 7.5: User A deletes A's note

- [ ] **Step 1: Click Delete on A's own note**

Expect 200, note disappears from list after refetch.

### Task 7.6: Reload preserves state

- [ ] **Step 1: Reload the page**

Expect: still authed (token in memory may have expired only if you waited > 24h; otherwise renew via `getTokenSilently` triggers — if not implemented, re-login is acceptable here only if `< 1 minute` since first sign-in is unlikely to expire). Notes from listNotes match prior state.

### Task 7.7: User B sees A's notes but cannot delete

- [ ] **Step 1: Sign out as A, sign in as user B**

Click Logout → Auth0 logout → re-render anon → click Sign in → login as B.

- [ ] **Step 2: Verify list shows A's notes**

GET `/api/notes` should return both A's note and the seed welcome note.

- [ ] **Step 3: Attempt delete of A's note**

POST `/api/notes/<a-id>/actions/delete` should return 404 (security-conscious: same code as "no such note").

### Task 7.8: Memory record + final commit

- [ ] **Step 1: Record success in memory**

Create `~/.claude/projects/-home-coder-project/memory/notes_demo_auth0_deployed.md`:

```markdown
---
name: notes-demo Auth0 deployed
description: First production-shape rntme demo deployment (Auth0 OIDC + ownership + Redpanda Cloud) — date, IDs, edge URL, open issues
type: project
---

- 2026-04-29 (or actual date): notes-demo deployed via platform.rntme.com → dokploy-demos
- Edge URL: https://notes-demo.rntme.com/
- Deployment id: <copy from platform UI>
- Project version: #<N>
- Auth0 tenant: demo-rntme.us.auth0.com (custom API audience https://notes-demo.rntme.com/api)
- Redpanda Cloud cluster: d7hltif095r0u8rsc2g0.any.ap-southeast-1.mpx.prd.cloud.redpanda.com (no creds in this note)
- Dokploy project: rntme-demos
- Test users: A=<email>, B=<email>
- Open issues: <list any non-blocker bugs found during smoke>
```

Append a one-line entry to `MEMORY.md`:

```
- [notes_demo_auth0_deployed.md](notes_demo_auth0_deployed.md) — First production-shape rntme demo deployed (Auth0 + ownership + Redpanda Cloud)
```

- [ ] **Step 2: Optional screenshot**

Take a screenshot of the working UI for landing/PR. Save offline; do not commit screenshots into the repo unless the user asks.

- [ ] **Step 3: Final commit (if any docs were touched in Phase 7)**

```bash
git status
git add <any pending docs>
git commit -m "docs: notes-demo Auth0 production-shape deployment recorded"
```

---

## Self-review notes

- **Phase 1 covers spec §6 entirely.** Tasks 1.1–1.10 produce: contract additive change, identity-auth0 IntrospectSession claim/handler/dispatch, Mgmt SDK lazy init, mock conformance, README updates.
- **Phase 2 covers spec §7.** K1 in Tasks 2.1–2.2; bindings-http query handler runPreSteps + 401 in 2.3–2.4; PII masking 2.5; `$pre` directive 2.6–2.7; cross-artifact validators 2.8.
- **Phase 3 covers spec §8.** SASL union 3.1; auth middleware kind 3.2; render env + nginx noop + config.json 3.3; runtime env consumption 3.4.
- **Phase 4 covers spec §9.** Scaffold 4.1; transport 4.2–4.3; config 4.4; auth0-client 4.5; chrome 4.6; orchestrator 4.7; ui-runtime 4.8; smoke 4.9.
- **Phase 5 covers spec §5** end-to-end: PDM, QSM, shapes, both write graphs, identity-auth0 service stub, project.json, bindings, seed, validation, README + supersede.
- **Phase 6** deploys; **Phase 7** smokes against §10.1 hard-gate (7 points).

No placeholders found. Cross-check on names: `bindAs`/`bindName` consistent with bindings-http compile-plan output; `RNTME_AUTH_*` env names consistent across Phase 3 and Phase 4 (config.json read from `/config.json` static asset, populated by deploy-dokploy render). `routesMountedOnTarget` helper introduced in Task 3.3 — use that name in Phase 5 if it surfaces.
