# Notes-Demo Auth0 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the merged Auth0 UI path from a parallel `packages/ui-auth-shell` package onto the RNT-388 module-contributions contract: a mixed `modules/identity/auth0/` module (`client.boot` + `<LoginScreen />` + `<UserBadge />` + `login`/`logout` operations), with notes-demo wiring through `project.json#modules`. Delete `packages/ui-auth-shell` and the auth-shell branches in `packages/runtime/ui-runtime/src/build.ts` and `packages/runtime/ui-runtime/src/server/static-shell.ts`.

**Architecture:** The auth0 module gains a `client/` subtree alongside the existing backend `src/`. `client/index.ts` exports `boot(ctx)` (which initializes `Auth0Client`, registers a Bearer transport middleware, writes `/auth/status` and `/auth/user` to the state store, and registers `login`/`logout` module-level operations) and named React components `LoginScreen` and `UserBadge`. The notes-demo blueprint declares `modules.identity = { package: "@rntme/identity-auth0", publicConfig: {...} }` and uses `visible: { $state: '/auth/status', eq: 'anon'|'authed' }` in its layout to switch between the module-contributed login screen and the notes app. `useModuleAction(moduleName, name)` is a small new hook added to `@rntme/ui-runtime` so React components can dispatch module-level operations.

**Tech Stack:** TypeScript, pnpm 9 workspace, Vitest (jsdom for component tests), repo-pinned React 19, `@auth0/auth0-spa-js@^2`, RNT-388 runtime APIs (`ModuleBootContext`, `transport-chain`, `operation-registry`, `lifecycle-bus`, `state-store`, `visibility`).

**Spec:** `docs/superpowers/specs/2026-04-30-notes-demo-auth0-migration-design.md`. Read §1–§15 before starting.

**PLAN challenge amendments (2026-04-30):**
- Context7 quota was unavailable during plan review; Auth0 SPA SDK calls were checked against official Auth0 generated docs instead. `Auth0Client`, `handleRedirectCallback`, `isAuthenticated`, `getTokenSilently`, `getIdTokenClaims`, `loginWithRedirect`, and `logout({ logoutParams: { returnTo } })` are valid v2 surfaces.
- Client module code must import runtime hooks/providers from `@rntme/ui-runtime/client`, not `@rntme/ui-runtime`. The package root currently exports server/mount APIs only.
- Do not mutate `req.headers` in the Bearer middleware. Clone headers and return `next(new Request(req, { headers }))`, matching the existing ui-runtime transport-chain tests.
- The current `AppShell` renders layout and routed screen as siblings; there is no `Outlet` component/slot. M4 must gate both the auth layout branches and the routed screen root, then add a runtime data-fetch skip when the current screen root is invisible.
- `BLUEPRINT_AUTH_MODULE_MISMATCH` cannot be implemented inside `validateBlueprintComposition` as originally sketched because that function does not receive discovered module manifests/catalog. Add the module/vendor/package-slug check after module discovery/catalog construction in the compose path.
- The CLI submodule currently still renders the old auth-shell-shaped `/srv/config.json`. M5 is not "verify if applicable": it must replace that shape and propagate `publicConfigJson` through platform-http, deploy-core, and deploy-dokploy.

**Phase plan:** Eight tasks, one commit per task, in order. M1–M3 build the new path. M4 wires the demo. M5–M7 retire the old path. M8 documents and runs the final verification sweep.

```
M1 (manifest + dual-target build)
   │
   ▼
M2 (components + useModuleAction hook)
   │
   ▼
M3 (boot + transport + ops)
   │
   ▼
M4 (notes-demo project.json#modules + layout gating)
   │
   ▼
M5 (replace old auth-shell config with publicConfig sidecar)
   │
   ▼
M6 (remove app.js + authShell branches from ui-runtime)
   │
   ▼
M7 (delete packages/ui-auth-shell + workspace cleanup)
   │
   ▼
M8 (docs + final smoke)
```

---

## Task M1: Extend `modules/identity/auth0` with `client` block + dual-target build

**Files:**
- Modify: `modules/identity/auth0/module.json`
- Modify: `modules/identity/auth0/package.json`
- Modify: `modules/identity/auth0/tsconfig.json`
- Modify: `modules/identity/auth0/tsconfig.check.json`
- Create: `modules/identity/auth0/tsconfig.client.json`
- Modify: `modules/identity/auth0/vitest.config.ts`
- Modify: `pnpm-lock.yaml` (via install)

- [ ] **Step 1: Add the `client` block to `modules/identity/auth0/module.json`**

Append the `client` block alongside the existing top-level fields (`name`, `version`, `category`, `vendor`, `contract`, `capabilities`, `limitations`). Existing fields stay unchanged.

```jsonc
{
  // ...existing fields kept verbatim...
  "client": {
    "entry": "./dist/client/index.js",
    "boot": true,
    "config": {
      "schema": {
        "domain":      { "type": "string", "required": true },
        "clientId":    { "type": "string", "required": true },
        "audience":    { "type": "string", "required": true },
        "redirectUri": { "type": "string", "required": true },
        "scope":       { "type": "string" }
      }
    },
    "components": [
      { "type": "LoginScreen", "props": {} },
      { "type": "UserBadge",   "props": { "display": { "type": "string" } } }
    ],
    "operations": [
      { "name": "login",  "params": {} },
      { "name": "logout", "params": {} }
    ]
  }
}
```

- [ ] **Step 2: Update `modules/identity/auth0/package.json`**

- Add `@auth0/auth0-spa-js` to `dependencies`.
- Add `react` to `peerDependencies` and `react`/`react-dom`/`@types/react` to `devDependencies`.
- Add the `./client` entry to `exports`.
- Update the `build` script to also compile the client tsconfig.

```jsonc
{
  "name": "@rntme/identity-auth0",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Auth0 vendor module for the Identity canonical contract.",
  "exports": {
    ".":             { "types": "./dist/index.d.ts",        "import": "./dist/index.js" },
    "./client":      { "types": "./dist/client/index.d.ts", "import": "./dist/client/index.js" },
    "./module.json": "./module.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin":   { "rntme-identity-auth0": "./dist/bin/server.js" },
  "files": ["dist", "module.json", "README.md"],
  "scripts": {
    "build":       "pnpm run build:deps && tsc -p tsconfig.json && tsc -p tsconfig.client.json",
    "build:deps":  "pnpm -F @rntme/contracts-common-v1 run build && pnpm -F @rntme/contracts-identity-v1 run build && pnpm -F @rntme/conformance-identity run build",
    "start":       "node dist/bin/server.js",
    "typecheck":   "pnpm run build:deps && tsc -p tsconfig.check.json",
    "test":        "pnpm run build:deps && vitest run",
    "test:watch":  "vitest",
    "lint":        "eslint \"src/**/*.ts\" \"client/**/*.{ts,tsx}\" \"test/**/*.{ts,tsx}\"",
    "test:conformance:mock": "vitest run test/integration/conformance-mock.test.ts"
  },
  "dependencies": {
    "@rntme/conformance-identity":    "workspace:*",
    "@rntme/contracts-common-v1":     "workspace:*",
    "@rntme/contracts-identity-v1":   "workspace:*",
    "@grpc/grpc-js":                  "^1.14.3",
    "@auth0/auth0-spa-js":            "^2.1.3",
    "auth0":                          "4.28.0",
    "jose":                           "^5"
  },
  "peerDependencies": {
    "react": "^19.2.5"
  },
  "devDependencies": {
    "@eslint/js":                       "^9.10.0",
    "@types/node":                      "^20.14.0",
    "@types/react":                     "^18.3.3",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser":        "^8.6.0",
    "@rntme/ui-runtime":                "workspace:*",
    "@testing-library/react":           "^16.0.1",
    "@testing-library/jest-dom":        "^6.5.0",
    "eslint":                           "^9.10.0",
    "jsdom":                            "^25.0.1",
    "react":                            "^19.2.5",
    "react-dom":                        "^19.2.5",
    "typescript":                       "^5.5.4",
    "vitest":                           "^2.1.1"
  }
}
```

- [ ] **Step 3: Update `modules/identity/auth0/tsconfig.json` to keep server scope tight**

Server tsconfig stays restricted to `src/` so server code is not polluted by JSX. No edits needed to existing rootDir/include — just confirm:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create `modules/identity/auth0/tsconfig.client.json`**

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist/client",
    "rootDir": "client",
    "skipLibCheck": true
  },
  "include": ["client/**/*.ts", "client/**/*.tsx"]
}
```

- [ ] **Step 5: Update `modules/identity/auth0/tsconfig.check.json` to cover both source roots**

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": ".",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts", "client/**/*.ts", "client/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
}
```

- [ ] **Step 6: Add a jsdom test environment for `client/` tests in `modules/identity/auth0/vitest.config.ts`**

Replace the file with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ['test/unit/client/**/*.test.{ts,tsx}', 'jsdom'],
      ['test/unit/boot.test.ts',              'jsdom'],
    ],
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 7: Install + lockfile**

Run: `pnpm install --frozen-lockfile=false`
Expected: lockfile updates with new deps; install succeeds.

- [ ] **Step 8: Verify manifest still parses and module typechecks the unchanged backend tree**

Run: `pnpm -F @rntme/module-skeleton test`
Expected: PASS — `parseModuleManifest` handles the new mixed manifest.

Run: `pnpm -F @rntme/identity-auth0 typecheck`
Expected: PASS — backend src/ still typechecks (no client/ files yet, so tsconfig.client.json has nothing to compile). If tsc complains about empty input for `tsconfig.client.json`, skip the second `tsc` invocation in `build` for now and re-add in M3 — or use `--allowJs --noEmitOnError false` only if needed. Prefer leaving the script as-is and creating a placeholder `client/.gitkeep` if the tooling rejects an empty include.

- [ ] **Step 9: Commit**

```bash
git add modules/identity/auth0/module.json modules/identity/auth0/package.json modules/identity/auth0/tsconfig.json modules/identity/auth0/tsconfig.check.json modules/identity/auth0/tsconfig.client.json modules/identity/auth0/vitest.config.ts pnpm-lock.yaml
git commit -m "feat(identity-auth0): add client manifest block, dual-target tsconfig, browser deps"
```

---

## Task M2: Add `useModuleAction` hook + `LoginScreen` and `UserBadge` components

**Files:**
- Modify: `packages/runtime/ui-runtime/src/client/hooks.ts`
- Modify: `packages/runtime/ui-runtime/src/client/index.ts`
- Create: `packages/runtime/ui-runtime/test/unit/use-module-action.test.tsx`
- Create: `modules/identity/auth0/client/index.ts` (named exports stub — `boot` follows in M3)
- Create: `modules/identity/auth0/client/components/LoginScreen.tsx`
- Create: `modules/identity/auth0/client/components/UserBadge.tsx`
- Create: `modules/identity/auth0/test/unit/client/LoginScreen.test.tsx`
- Create: `modules/identity/auth0/test/unit/client/UserBadge.test.tsx`

- [ ] **Step 1: Write a failing test for the new `useModuleAction` hook**

Create `packages/runtime/ui-runtime/test/unit/use-module-action.test.tsx`:

```tsx
import * as React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createOperationRegistry } from '../../src/client/operation-registry.js';
import { RegistryProvider, useModuleAction } from '../../src/client/index.js';

describe('useModuleAction', () => {
  it('returns a callable that invokes the registered module operation', async () => {
    const registry = createOperationRegistry();
    const handler = vi.fn();
    registry.registerModule('@rntme/identity-auth0', 'login', handler);

    function Probe(): React.ReactElement {
      const dispatch = useModuleAction('@rntme/identity-auth0', 'login');
      return <button onClick={() => void dispatch({})}>go</button>;
    }

    const { getByText } = render(
      <RegistryProvider value={registry}>
        <Probe />
      </RegistryProvider>,
    );
    getByText('go').click();
    expect(handler).toHaveBeenCalledWith({});
  });

  it('returns a no-op when the operation is not registered', async () => {
    const registry = createOperationRegistry();

    function Probe(): React.ReactElement {
      const dispatch = useModuleAction('@rntme/identity-auth0', 'logout');
      return <button onClick={() => void dispatch({})}>go</button>;
    }

    const { getByText } = render(
      <RegistryProvider value={registry}>
        <Probe />
      </RegistryProvider>,
    );
    expect(() => getByText('go').click()).not.toThrow();
  });
});
```

Run: `pnpm -F @rntme/ui-runtime vitest run test/unit/use-module-action.test.tsx`
Expected: FAIL — `useModuleAction` is not exported.

- [ ] **Step 2: Implement `useModuleAction` in `packages/runtime/ui-runtime/src/client/hooks.ts`**

Append to the existing file:

```ts
export function useModuleAction(
  moduleName: string,
  name: string,
): (params?: Record<string, unknown>) => Promise<void> {
  const registry = useContext(RegistryContext);
  if (!registry) throw new Error('useModuleAction requires <RegistryProvider>');
  return async (params = {}) => {
    const handler = registry.lookupModule(moduleName, name);
    if (!handler) return;
    await handler(params);
  };
}
```

- [ ] **Step 3: Re-export from `packages/runtime/ui-runtime/src/client/index.ts`**

Add `useModuleAction` to the existing hooks export line:

```ts
export {
  useTransport,
  useStateStore,
  useOperationRegistry,
  useModuleAction,
  TransportProvider,
  StoreProvider,
  RegistryProvider,
} from './hooks.js';
```

- [ ] **Step 4: Re-run hook test**

Run: `pnpm -F @rntme/ui-runtime vitest run test/unit/use-module-action.test.tsx`
Expected: PASS — both cases.

- [ ] **Step 5: Stub `modules/identity/auth0/client/index.ts` with named component exports**

```ts
export { LoginScreen } from './components/LoginScreen.js';
export { UserBadge } from './components/UserBadge.js';
// `boot` is added in M3.
```

- [ ] **Step 6: Write a failing test for `LoginScreen`**

Create `modules/identity/auth0/test/unit/client/LoginScreen.test.tsx`:

```tsx
import * as React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createOperationRegistry, RegistryProvider } from '@rntme/ui-runtime/client';
import { LoginScreen } from '../../../client/components/LoginScreen.js';

describe('LoginScreen', () => {
  it('renders Sign-in button and dispatches the identity-auth0 login operation', () => {
    const registry = createOperationRegistry();
    const login = vi.fn();
    registry.registerModule('@rntme/identity-auth0', 'login', login);

    const { getByRole } = render(
      <RegistryProvider value={registry}>
        <LoginScreen />
      </RegistryProvider>,
    );

    getByRole('button', { name: /sign in/i }).click();
    expect(login).toHaveBeenCalledTimes(1);
  });
});
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/client/LoginScreen.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 7: Implement `LoginScreen.tsx`**

Create `modules/identity/auth0/client/components/LoginScreen.tsx`:

```tsx
import * as React from 'react';
import { useModuleAction } from '@rntme/ui-runtime/client';

export function LoginScreen(): React.ReactElement {
  const login = useModuleAction('@rntme/identity-auth0', 'login');
  return (
    <div className="rntme-auth-login">
      <h1>notes-demo</h1>
      <p>Sign in to view and create notes.</p>
      <button type="button" onClick={() => void login()}>
        Sign in
      </button>
    </div>
  );
}
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/client/LoginScreen.test.tsx`
Expected: PASS.

- [ ] **Step 8: Write a failing test for `UserBadge`**

Create `modules/identity/auth0/test/unit/client/UserBadge.test.tsx`:

```tsx
import * as React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  createOperationRegistry,
  createRuntimeStateStore,
  RegistryProvider,
  StoreProvider,
} from '@rntme/ui-runtime/client';
import { UserBadge } from '../../../client/components/UserBadge.js';

function withProviders(store: ReturnType<typeof createRuntimeStateStore>, registry: ReturnType<typeof createOperationRegistry>, ui: React.ReactElement) {
  return (
    <RegistryProvider value={registry}>
      <StoreProvider value={store}>{ui}</StoreProvider>
    </RegistryProvider>
  );
}

describe('UserBadge', () => {
  it('renders nothing when /auth/user is null', () => {
    const store = createRuntimeStateStore({});
    const registry = createOperationRegistry();
    const { container } = render(withProviders(store, registry, <UserBadge />));
    expect(container.textContent).toBe('');
  });

  it('renders email by default and dispatches logout on click', () => {
    const store = createRuntimeStateStore({});
    store.set('/auth/user', { sub: 'auth0|abc', email: 'e@x', name: 'E' });
    const registry = createOperationRegistry();
    const logout = vi.fn();
    registry.registerModule('@rntme/identity-auth0', 'logout', logout);

    const { getByText, getByRole } = render(withProviders(store, registry, <UserBadge />));
    expect(getByText('e@x')).toBeTruthy();
    getByRole('button', { name: /logout/i }).click();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('renders name when display="name"', () => {
    const store = createRuntimeStateStore({});
    store.set('/auth/user', { sub: 'auth0|abc', email: 'e@x', name: 'Eve' });
    const registry = createOperationRegistry();
    const { getByText } = render(withProviders(store, registry, <UserBadge display="name" />));
    expect(getByText('Eve')).toBeTruthy();
  });
});
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/client/UserBadge.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 9: Implement `UserBadge.tsx`**

Create `modules/identity/auth0/client/components/UserBadge.tsx`:

```tsx
import * as React from 'react';
import { useModuleAction, useStateStore } from '@rntme/ui-runtime/client';

type AuthUser = { sub: string; email: string | null; name: string | null };

export type UserBadgeProps = {
  display?: 'email' | 'name';
};

export function UserBadge(props: UserBadgeProps): React.ReactElement | null {
  const store = useStateStore();
  const logout = useModuleAction('@rntme/identity-auth0', 'logout');
  const [user, setUser] = React.useState<AuthUser | null>(
    () => (store.get('/auth/user') as AuthUser | null) ?? null,
  );

  React.useEffect(() => {
    return store.subscribe(() => {
      setUser((store.get('/auth/user') as AuthUser | null) ?? null);
    });
  }, [store]);

  if (!user) return null;
  const label =
    props.display === 'name' ? user.name ?? user.email ?? user.sub : user.email ?? user.name ?? user.sub;

  return (
    <div className="rntme-auth-badge">
      <span className="rntme-auth-badge__label">{label}</span>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
    </div>
  );
}
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/client/UserBadge.test.tsx`
Expected: PASS — all three cases.

- [ ] **Step 10: Run the full test sweep for both packages**

Run: `pnpm -F @rntme/ui-runtime test && pnpm -F @rntme/identity-auth0 test`
Expected: PASS in both.

- [ ] **Step 11: Commit**

```bash
git add packages/runtime/ui-runtime/src/client/hooks.ts packages/runtime/ui-runtime/src/client/index.ts packages/runtime/ui-runtime/test/unit/use-module-action.test.tsx modules/identity/auth0/client modules/identity/auth0/test/unit/client
git commit -m "feat(identity-auth0): LoginScreen + UserBadge components and useModuleAction hook"
```

---

## Task M3: Implement `client/index.ts` boot — Auth0Client, transport, state, operations

**Files:**
- Modify: `modules/identity/auth0/client/index.ts`
- Create: `modules/identity/auth0/test/unit/boot.test.ts`

- [ ] **Step 1: Write a failing test for the anon boot path**

Create `modules/identity/auth0/test/unit/boot.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuntimeStateStore } from '@rntme/ui-runtime/client';
import {
  createOperationRegistry,
  createTransportChain,
  createLifecycleBus,
  createModuleBootContext,
} from '@rntme/ui-runtime/client';

const auth0Mock = vi.hoisted(() => ({
  isAuthenticated: vi.fn(async () => false),
  handleRedirectCallback: vi.fn(async () => undefined),
  getTokenSilently: vi.fn(async () => 'tok'),
  getIdTokenClaims: vi.fn(async () => ({ sub: 'auth0|abc', email: 'e@x', name: 'Eve' })),
  loginWithRedirect: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
}));

vi.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: vi.fn().mockImplementation(() => auth0Mock),
}));

const cfg = {
  domain: 't.us.auth0.com',
  clientId: 'cid',
  audience: 'https://api/',
  redirectUri: 'https://app/',
};

function makeCtx(href = 'https://app/') {
  Object.defineProperty(window, 'location', { value: new URL(href), writable: true });
  const store = createRuntimeStateStore({});
  const bus = createLifecycleBus();
  const chain = createTransportChain(async () => new Response('{}', { status: 200 }));
  const registry = createOperationRegistry();
  const ctx = createModuleBootContext({
    moduleName: '@rntme/identity-auth0',
    config: cfg,
    store,
    bus,
    chain,
    registry,
  });
  return { ctx, store, chain, registry };
}

beforeEach(() => {
  for (const fn of Object.values(auth0Mock)) (fn as ReturnType<typeof vi.fn>).mockClear();
  auth0Mock.isAuthenticated.mockResolvedValue(false);
});

describe('boot — anon path', () => {
  it('writes /auth/status=anon and /auth/user=null when not authenticated', async () => {
    const { ctx, store } = makeCtx();
    const { boot } = await import('../../client/index.js');
    await boot(ctx);
    expect(store.get('/auth/status')).toBe('anon');
    expect(store.get('/auth/user')).toBe(null);
  });
});
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/boot.test.ts`
Expected: FAIL — `boot` is not exported from `client/index.ts`.

- [ ] **Step 2: Implement `boot` in `modules/identity/auth0/client/index.ts`**

Replace the file with:

```ts
import { Auth0Client } from '@auth0/auth0-spa-js';
import type { ModuleBootContext } from '@rntme/ui-runtime/client';

export { LoginScreen } from './components/LoginScreen.js';
export { UserBadge } from './components/UserBadge.js';

type AuthConfig = {
  domain: string;
  clientId: string;
  audience: string;
  redirectUri: string;
  scope?: string;
};

type AuthUser = { sub: string; email: string | null; name: string | null };

export async function boot(ctx: ModuleBootContext): Promise<void> {
  const cfg = ctx.config as unknown as AuthConfig;

  const client = new Auth0Client({
    domain: cfg.domain,
    clientId: cfg.clientId,
    authorizationParams: {
      audience: cfg.audience,
      redirect_uri: cfg.redirectUri,
      scope: cfg.scope ?? 'openid profile email',
    },
  });

  let token: string | null = null;

  ctx.transport.use(async (req, next) => {
    const headers = new Headers(req.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    const res = await next(new Request(req, { headers }));
    if (res.status === 401) {
      token = null;
      ctx.state.set('/auth/status', 'anon');
      ctx.state.set('/auth/user', null);
    }
    return res;
  });

  const url = new URL(window.location.href);
  if (url.searchParams.has('code') && url.searchParams.has('state')) {
    await client.handleRedirectCallback();
    window.history.replaceState({}, '', url.pathname);
  }

  if (await client.isAuthenticated()) {
    token = await client.getTokenSilently();
    const claims = await client.getIdTokenClaims();
    const user: AuthUser = {
      sub:   String(claims?.sub ?? ''),
      email: (claims?.email as string | undefined) ?? null,
      name:  (claims?.name as string | undefined) ?? null,
    };
    ctx.state.set('/auth/user', user);
    ctx.state.set('/auth/status', 'authed');
  } else {
    ctx.state.set('/auth/status', 'anon');
    ctx.state.set('/auth/user', null);
  }

  ctx.registerOperation('login',  async () => { await client.loginWithRedirect(); });
  ctx.registerOperation('logout', async () => {
    await client.logout({ logoutParams: { returnTo: cfg.redirectUri } });
  });
}
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/boot.test.ts`
Expected: PASS — anon test passes.

- [ ] **Step 3: Add the authed-redirect-callback test case**

Append to `boot.test.ts`:

```ts
describe('boot — authed redirect callback', () => {
  it('handles ?code/state, fetches token and claims, writes /auth/user and authed status', async () => {
    auth0Mock.isAuthenticated.mockResolvedValue(true);
    const replaceState = vi.spyOn(window.history, 'replaceState');

    const { ctx, store } = makeCtx('https://app/?code=abc&state=xyz');
    const { boot } = await import('../../client/index.js');
    await boot(ctx);

    expect(auth0Mock.handleRedirectCallback).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalled();
    expect(store.get('/auth/status')).toBe('authed');
    expect(store.get('/auth/user')).toEqual({ sub: 'auth0|abc', email: 'e@x', name: 'Eve' });
  });
});
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/boot.test.ts`
Expected: PASS — authed test passes (boot already implements this branch).

- [ ] **Step 4: Add the 401-clears-state test case**

Append:

```ts
describe('boot — Bearer middleware and 401 handling', () => {
  it('injects Authorization when token present and clears state on 401', async () => {
    auth0Mock.isAuthenticated.mockResolvedValue(true);

    let respondWith: Response = new Response('{}', { status: 200 });
    const baseFetch = vi.fn(async (req: Request) => {
      // Echo headers back through a custom property for assertion.
      (baseFetch as unknown as { lastReq: Request }).lastReq = req;
      return respondWith;
    });

    Object.defineProperty(window, 'location', {
      value: new URL('https://app/?code=abc&state=xyz'),
      writable: true,
    });
    const store = createRuntimeStateStore({});
    const bus = createLifecycleBus();
    const chain = createTransportChain(baseFetch);
    const registry = createOperationRegistry();
    const ctx = createModuleBootContext({
      moduleName: '@rntme/identity-auth0',
      config: cfg,
      store,
      bus,
      chain,
      registry,
    });

    const { boot } = await import('../../client/index.js');
    await boot(ctx);

    // Authed → token attached.
    await chain.fetch(new Request('https://api/x'));
    const sent = (baseFetch as unknown as { lastReq: Request }).lastReq;
    expect(sent.headers.get('authorization')).toBe('Bearer tok');
    expect(store.get('/auth/status')).toBe('authed');

    // Now simulate a 401.
    respondWith = new Response('{}', { status: 401 });
    await chain.fetch(new Request('https://api/x'));
    expect(store.get('/auth/status')).toBe('anon');
    expect(store.get('/auth/user')).toBe(null);
  });
});
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/boot.test.ts`
Expected: PASS — middleware test passes.

- [ ] **Step 5: Add the operations-registered test case**

Append:

```ts
describe('boot — module-level operations', () => {
  it('registers login and logout operations on the registry', async () => {
    const { ctx, registry } = makeCtx();
    const { boot } = await import('../../client/index.js');
    await boot(ctx);

    const login  = registry.lookupModule('@rntme/identity-auth0', 'login');
    const logout = registry.lookupModule('@rntme/identity-auth0', 'logout');
    expect(login).toBeDefined();
    expect(logout).toBeDefined();

    await login!({});
    expect(auth0Mock.loginWithRedirect).toHaveBeenCalledTimes(1);

    await logout!({});
    expect(auth0Mock.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: cfg.redirectUri } });
  });
});
```

Run: `pnpm -F @rntme/identity-auth0 vitest run test/unit/boot.test.ts`
Expected: PASS — ops test passes.

- [ ] **Step 6: Build the module to verify dual-target tsc works end-to-end**

Run: `pnpm -F @rntme/identity-auth0 build`
Expected: `dist/index.js` (server) and `dist/client/index.js` (browser) both emitted.

- [ ] **Step 7: Commit**

```bash
git add modules/identity/auth0/client/index.ts modules/identity/auth0/test/unit/boot.test.ts
git commit -m "feat(identity-auth0): boot orchestrator with Auth0Client, Bearer transport, state writes, login/logout ops"
```

---

## Task M4: Wire `notes-blueprint` to the module via `project.json#modules`, layout gating, and `BLUEPRINT_AUTH_MODULE_MISMATCH` validator

**Files:**
- Modify: `demo/notes-blueprint/project.json`
- Modify: `demo/notes-blueprint/services/app/ui/layouts/main.screen.json`
- Modify: `demo/notes-blueprint/services/app/ui/screens/home.spec.json`
- Modify: `packages/artifacts/blueprint/src/types/result.ts` (add error code)
- Modify: `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts` or `packages/artifacts/blueprint/src/compose/validate-modules.ts` (add auth/module catalog consistency validator)
- Create or modify: `packages/artifacts/blueprint/test/smoke-ui-modules.test.ts` and/or `packages/artifacts/blueprint/test/unit/validate-composition.test.ts` (verify the current test shape before editing)
- Modify: `packages/runtime/ui-runtime/src/client/entry.tsx` (skip routed-screen data fetch when screen root is invisible)
- Modify: `packages/runtime/ui-runtime/test/unit/entry.test.ts` (coverage for the skip)

- [ ] **Step 1: Update `demo/notes-blueprint/project.json`**

Replace the file with (key under `modules` is `"identity"` to match the module's declared `category`, per the blueprint `BLUEPRINT_CATEGORY_MISMATCH` rule):

```jsonc
{
  "name": "notes-demo",
  "services": ["app", "identity-auth0"],
  "modules": {
    "identity": {
      "package": "@rntme/identity-auth0",
      "publicConfig": {
        "domain":      "demo-rntme.us.auth0.com",
        "clientId":    "${AUTH0_SPA_CLIENT_ID}",
        "audience":    "https://notes-demo.rntme.com/api",
        "redirectUri": "https://notes-demo.rntme.com/"
      }
    }
  },
  "routes": {
    "ui":   { "/":     "app" },
    "http": { "/api":  "app" }
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
    { "target": "http:/api","use": ["requestContext", "auth"] }
  ]
}
```

- [ ] **Step 2: Update `demo/notes-blueprint/services/app/ui/layouts/main.screen.json`**

Replace the file with:

```jsonc
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["anonRoot", "authedTopbar"]
    },
    "anonRoot": {
      "type": "LoginScreen",
      "visible": { "$state": "/auth/status", "eq": "anon" }
    },
    "authedTopbar": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "visible": { "$state": "/auth/status", "eq": "authed" },
      "children": ["title", "userBadge"]
    },
    "title":     { "type": "Heading",   "props": { "level": 1, "text": "Notes" } },
    "userBadge": { "type": "UserBadge", "props": { "display": "email" } }
  }
}
```

Current `AppShell` renders the layout and routed screen as siblings; it does not support an `Outlet` component. Do not invent an `Outlet` unless this task explicitly adds slot semantics and tests them. For this migration, the layout owns only login/topbar chrome, and the routed screen is gated separately in Step 3.

- [ ] **Step 3: Gate the routed notes screen root**

Modify `demo/notes-blueprint/services/app/ui/screens/home.spec.json` so the existing root element `page` is visible only when authenticated:

```jsonc
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "visible": { "$state": "/auth/status", "eq": "authed" },
      "children": ["create-section", "delete-section", "list-section"]
    }
    // ...existing child elements unchanged...
  }
}
```

- [ ] **Step 4: Skip screen data fetches while the screen root is invisible**

Add a focused unit test in `packages/runtime/ui-runtime/test/unit/entry.test.ts`:

```ts
it('does not fetch routed screen data when the screen root is invisible', async () => {
  const { mountUiRuntime } = await import('../../src/client/entry.js');
  const manifest: CompiledManifest = {
    version: '2.0',
    metadata: { title: 'Notes' },
    routes: { '/': { layout: 'main', screen: 'home' } },
  };
  const layout: CompiledScreen = {
    spec: { root: 'layout', elements: { layout: { type: 'Stack', props: {} } } },
  };
  const screen: CompiledScreen = {
    spec: {
      root: 'page',
      elements: {
        page: {
          type: 'Stack',
          props: {},
          visible: { $state: '/auth/status', eq: 'authed' },
        },
      },
    },
    data: {
      '/data/notes': { method: 'GET', path: '/api/notes', refetchOn: ['mount'] },
    },
  };
  const transport = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestPath(input);
    if (url === '/_manifest.json') return Response.json(manifest);
    if (url === '/_layouts/main.json') return Response.json(layout);
    if (url === '/_screens/home.json') return Response.json(screen);
    if (url === '/api/notes') return Response.json([{ id: 'n1' }]);
    return new Response('missing', { status: 404 });
  }) as unknown as typeof fetch;

  await mountUiRuntime({
    manifestUrl: '/_manifest.json',
    target: document.querySelector<HTMLElement>('#root')!,
    transport,
    initialState: { auth: { status: 'anon' } },
  });

  expect(vi.mocked(transport).mock.calls.map(([input]) => requestPath(input))).not.toContain('/api/notes');
});
```

Then update `packages/runtime/ui-runtime/src/client/entry.tsx` so `enterRoute` checks the current screen root before running `refetchOn: ["mount"]` data fetches. Use the existing `evaluateVisible` helper; do not duplicate visibility semantics.

```ts
import { evaluateVisible } from './visibility.js';

function screenRootIsVisible(screen: CompiledScreen | null, getState: (path: string) => unknown): boolean {
  if (!screen?.spec) return true;
  const root = screen.spec.elements[screen.spec.root];
  return evaluateVisible(root?.visible, getState);
}

// in enterRoute, after rerender():
if (currentScreen.data && screenRootIsVisible(currentScreen, (p) => store.get(p))) {
  const fetches = Object.entries(currentScreen.data)
    .filter(([, ep]) => ep.refetchOn?.includes('mount'))
    .map(([statePath, ep]) => fetchEndpoint(statePath, ep));
  await Promise.all(fetches);
}
```

Run: `pnpm -F @rntme/ui-runtime vitest run test/unit/entry.test.ts`
Expected: PASS, including the new invisible-root data-fetch skip.

- [ ] **Step 5: Add the `BLUEPRINT_AUTH_MODULE_MISMATCH` error code**

In `packages/artifacts/blueprint/src/types/result.ts`, find the `ERROR_CODES` const (a `Readonly<Record<string,string>>` or string-union — match the existing shape) and add:

```ts
BLUEPRINT_AUTH_MODULE_MISMATCH: 'BLUEPRINT_AUTH_MODULE_MISMATCH',
```

If `BlueprintErrorCode` is a string-union type, also add it there.

- [ ] **Step 6: Implement the auth/module consistency validator in the module compose path**

Do not add this validator to `validateBlueprintComposition`; it only receives `project` + `services` and does not know module manifests. Add it after `discoverModules(...)` and `buildCatalog(...)` in `loadComposedBlueprint`, or as a helper in `packages/artifacts/blueprint/src/compose/validate-modules.ts` called from that location.

Validation rules:

1. For every `project.middleware.*` entry with `kind: "auth"`, `provider` must match the vendor of `catalog.categoryToModule.identity`.
2. `catalog.categoryToModule.identity` must exist when auth middleware exists.
3. `middleware.auth.moduleSlug` must match the package-local name of the identity module package. For `@rntme/identity-auth0`, the expected module service slug is `identity-auth0`. This preserves the existing backend/deploy convention where `moduleSlug` points at an integration-module service, while `project.json#modules.identity.package` points at the module package.

```ts
function packageLocalName(pkg: string): string {
  return pkg.includes('/') ? pkg.slice(pkg.lastIndexOf('/') + 1) : pkg;
}
```

Return `BLUEPRINT_AUTH_MODULE_MISMATCH` at `project.middleware.<name>` when no identity module is declared, at `project.middleware.<name>.provider` when the vendor differs, and at `project.middleware.<name>.moduleSlug` when the service slug differs from the package-local name.

- [ ] **Step 7: Add tests for the new validator**

Add (or extend) `packages/artifacts/blueprint/test/unit/validate-composition.test.ts` (or the on-disk smoke fixture file) with the cases below:

1. `middleware.auth.provider="auth0"` + `modules.identity = { package: "@rntme/identity-auth0" }` (vendor=auth0) → no `BLUEPRINT_AUTH_MODULE_MISMATCH`.
2. `middleware.auth.provider="auth0"` + no `modules.identity` declared → emits `BLUEPRINT_AUTH_MODULE_MISMATCH` at `project.middleware.auth`.
3. `middleware.auth.provider="clerk"` + `modules.identity = { package: "@rntme/identity-auth0" }` (vendor=auth0) → emits `BLUEPRINT_AUTH_MODULE_MISMATCH` at `project.middleware.auth.provider`.
4. `middleware.auth.moduleSlug="identity-clerk"` + `modules.identity.package="@rntme/identity-auth0"` → emits `BLUEPRINT_AUTH_MODULE_MISMATCH` at `project.middleware.auth.moduleSlug`.

Use on-disk smoke fixtures when package discovery is required; `validate-composition.test.ts` alone cannot exercise manifest vendor discovery unless you refactor the helper for direct injection.

Run the focused test file(s) you edited, for example:

```bash
pnpm -F @rntme/blueprint vitest run test/smoke-ui-modules.test.ts test/unit/validate-composition.test.ts
```

Expected: all four auth/module consistency cases pass, and existing module smoke coverage remains green.

- [ ] **Step 8: Verify blueprint compose accepts the updated demo**

Run: `pnpm -F @rntme/blueprint test`
Expected: PASS — including the new validator tests and any existing notes-demo fixtures.

If a notes-demo fixture is wired into blueprint tests and asserts the old `project.json` shape, update it to match the file from Step 1 before committing. Re-run until green.

- [ ] **Step 9: Commit**

```bash
git add demo/notes-blueprint/project.json demo/notes-blueprint/services/app/ui/layouts/main.screen.json demo/notes-blueprint/services/app/ui/screens/home.spec.json packages/artifacts/blueprint/src/types/result.ts packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts packages/artifacts/blueprint/src/compose/validate-modules.ts packages/artifacts/blueprint/test packages/runtime/ui-runtime/src/client/entry.tsx packages/runtime/ui-runtime/test/unit/entry.test.ts
git commit -m "feat(notes-demo): wire identity module + auth-vendor validator"
```

---

## Task M5: Wire `publicConfig` sidecar in deploy-dokploy (verify or add)

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`
- Modify: `packages/deploy/deploy-core/src/composed-project.ts`
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Modify: `packages/deploy/deploy-core/test/unit/plan.test.ts`
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`

`merged CLI/platform packages` is a git submodule. This task only edits files inside the submodule; the parent repo records a submodule pointer bump.

- [ ] **Step 1: Inventory existing references**

Run:

```bash
grep -rn "config\.json\|publicConfigJson\|virtualEntrySource\|RNTME_AUTH\|@RNTME_AUTH_SHELL_CONFIG@\|app\.js" packages/deploy/deploy-dokploy/src packages/deploy/deploy-core/src
```

Expected current baseline: `packages/deploy/deploy-dokploy/src/render.ts` still hand-builds `/srv/config.json` as `{ auth0: {...}, runtime: {...} }`, and `deploy-core` has no `publicConfigJson` field on `ComposedProjectInput`/`DomainServiceWorkload`. This task must replace the old shape; it is not a no-op.

- [ ] **Step 2: Surface `publicConfigJson` from the composed plan into the renderer**

The blueprint composer already produces `publicConfigJson: string | null` on `ComposedBlueprint` (see `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`). The deploy path must preserve it as a UI static sidecar, separate from backend runtime artifact files under `/srv/artifacts`.

Implement this propagation:

1. In `packages/deploy/deploy-core/src/composed-project.ts`, add `publicConfigJson?: string | null` to `ComposedProjectInput`.
2. In `apps/platform-http/src/deploy/executor.ts#toDeployCoreInput`, copy `value.publicConfigJson ?? null` from the composed blueprint into the deploy-core input.
3. In `packages/deploy/deploy-core/src/plan.ts`, add `publicConfigJson: string | null` to `DomainServiceWorkload` and set it from `project.publicConfigJson ?? null` for every domain-service workload.
4. In `packages/deploy/deploy-dokploy/src/render.ts`, remove the hand-built `auth0`/`runtime` config block and render:

```ts
'/srv/config.json': workload.publicConfigJson ?? '{}'
```

The Bearer-verification env vars on the **backend** workload (`RNTME_AUTH_*`, Kafka `SASL_*`) are unrelated to publicConfig and stay.

- [ ] **Step 3: Drop any `authShell` flag from the renderer**

If any CLI-side renderer calls `buildHtmlShell({ authShell: true })`, change the call to `buildHtmlShell()`. The flag itself is removed in M6. For now, just stop opting in. If no such CLI call exists, record "no CLI authShell call sites" in the commit body.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/deploy-core test
```

Expected: PASS. If snapshot tests existed for the old auth-shell config layout, update them to reflect the new sidecar shape (`Record<modulePackageName, publicConfig>`).

Minimum test expectations:

```ts
expect(input.publicConfigJson).toContain('@rntme/identity-auth0');
expect(app?.files?.['/srv/config.json']).toEqual(
  JSON.stringify({ '@rntme/identity-auth0': { domain: 'tenant.us.auth0.com', clientId: 'auth0-public-client-id', audience: 'https://commerce.example.com/api', redirectUri: 'https://commerce.example.com' } }, null, 2) + '\n',
);
expect(JSON.parse(app?.files?.['/srv/config.json'] ?? '{}')).not.toHaveProperty('auth0');
expect(JSON.parse(app?.files?.['/srv/config.json'] ?? '{}')).not.toHaveProperty('runtime');
```

- [ ] **Step 5: Commit (in submodule, then bump parent)**

```bash
cd /home/coder/work/rntme
git add packages/deploy/deploy-dokploy packages/deploy/deploy-core
git commit -m "feat(deploy): emit publicConfig sidecar from composed blueprint"
cd ..
git add apps packages/deploy packages/platform
git commit -m "chore(merged CLI/platform packages): bump submodule for publicConfig sidecar emission"
```

Do not create empty commits. The expected baseline requires edits in the current submodule revision.

---

## Task M6: Remove `app.js` esbuild branch and `authShell` flag from `@rntme/ui-runtime`

**Files:**
- Modify: `packages/runtime/ui-runtime/src/build.ts`
- Modify: `packages/runtime/ui-runtime/src/server/static-shell.ts`

- [ ] **Step 1: Edit `packages/runtime/ui-runtime/src/build.ts`**

Delete the second `await build({...})` call that uses `stdin: { contents: ... import { mountAuthenticatedApp } ... }` and writes `build/app.js`. Keep:

- The `main.js` build from `client/no-auth-entry.ts`.
- The Tailwind CSS build.
- All `import` lines and `sharedBuildOptions`.

Drop any references to `app.js` in console logs.

- [ ] **Step 2: Edit `packages/runtime/ui-runtime/src/server/static-shell.ts`**

Replace the file with:

```ts
export function buildHtmlShell(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rntme</title>
  <link rel="stylesheet" href="/assets/main.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/main.js"></script>
</body>
</html>`;
}
```

This removes both the `BuildHtmlShellOptions` type and the `authShell` branch. The `hydrateApp` boot in `main.js` already fetches `/config.json` itself when any module declares `boot: true`, so the HTML no longer needs to inject `__RNTME_AUTH_SHELL_CONFIG__`.

- [ ] **Step 3: Find and update remaining callers of `buildHtmlShell({...})`**

Run:

```bash
grep -rn "buildHtmlShell" packages/ packages/ 2>/dev/null
```

For each call site that passes `{ authShell: ... }`, drop the argument. Type checker will flag any leftover usages.

- [ ] **Step 4: Verify build emits only `main.js` + `main.css`**

Run: `pnpm -F @rntme/ui-runtime build`
Expected: only `build/main.js` and `build/main.css` produced; no `build/app.js`.

Run: `pnpm -F @rntme/ui-runtime test && pnpm -F @rntme/ui-runtime typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/ui-runtime/src/build.ts packages/runtime/ui-runtime/src/server/static-shell.ts
git commit -m "refactor(ui-runtime): drop app.js bundle and authShell HTML branch"
```

---

## Task M7: Delete `packages/ui-auth-shell` and clean workspace references

**Files:**
- Delete: entire `packages/ui-auth-shell/` directory
- Modify: `pnpm-workspace.yaml`
- Modify: `README.md`
- Modify: `packages/runtime/ui-runtime/README.md`
- Modify: any other `package.json` listing `@rntme/ui-auth-shell` as a dep (none expected — verify)

- [ ] **Step 1: Confirm cross-references**

Run:

```bash
grep -rln "@rntme/ui-auth-shell\|ui-auth-shell\|mountAuthenticatedApp\|__RNTME_AUTH_SHELL_CONFIG__" packages/ apps/ packages/ demo/ pnpm-workspace.yaml README.md AGENTS.md CLAUDE.md
```

Record the output. After all edits below, this command must return zero results.

- [ ] **Step 2: Remove from `pnpm-workspace.yaml`**

If `pnpm-workspace.yaml` lists `packages/ui-auth-shell` (or has a `packages/*` glob that picks it up), the directory deletion in Step 4 is sufficient. If there is an explicit entry, delete it.

- [ ] **Step 3: Strip references from `README.md` and `packages/runtime/ui-runtime/README.md`**

`README.md`:
- Delete the `@rntme/ui-auth-shell` row from the packages table.
- Delete `UIA["@rntme/ui-auth-shell"]:::pkg` and any incoming/outgoing edges from the dependency-graph mermaid diagram.

`packages/runtime/ui-runtime/README.md`:
- Delete the bullet "Optional `@rntme/ui-auth-shell` browser bundle path for Auth0-backed demos."
- Delete the paragraph that describes mounting `@rntme/ui-auth-shell` from `/assets/app.js`.
- Replace any reference to the `authShell` build flag with the new single-bundle flow (HTML loads `/assets/main.js`; the runtime fetches `/config.json` itself when any module declares `boot: true`).

- [ ] **Step 4: Delete the package directory**

```bash
rm -rf packages/ui-auth-shell
```

- [ ] **Step 5: Refresh the lockfile and re-run the full sweep**

```bash
pnpm install --frozen-lockfile=false
pnpm -r run typecheck
pnpm -r run lint
pnpm -r run test
```

Expected: PASS. If any package depended on `@rntme/ui-auth-shell` and its removal breaks typecheck, that consumer was a leftover from the old plan and must be updated to depend on `@rntme/identity-auth0/client` instead. (None are expected — verify and fix inline.)

- [ ] **Step 6: Confirm zero residual references**

Re-run the grep from Step 1. Expected: zero matches.

- [ ] **Step 7: Commit**

```bash
git add -A packages/ pnpm-workspace.yaml pnpm-lock.yaml README.md
git commit -m "chore: delete packages/ui-auth-shell, fold auth UI into identity-auth0 module"
```

---

## Task M8: Documentation refresh + final smoke

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `modules/identity/auth0/README.md`
- Modify: `demo/notes-blueprint/README.md`
- Modify (frontmatter only): `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md`
- Modify: `docs/superpowers/plans/2026-04-29-notes-demo-auth0.md` (mark Phase 4 superseded)

- [ ] **Step 1: Update the "Architecture in one paragraph" block in `CLAUDE.md`**

Replace any sentence that mentions `@rntme/ui-auth-shell` or "Auth0 PKCE login chrome" with one that says auth providers participate via the `client` block of an identity module: `client.boot` initializes the SDK, registers a Bearer transport middleware, and writes `/auth/status` and `/auth/user` to the state store; `client.components` ship `<LoginScreen />` and `<UserBadge />`; `client.operations` expose `login`/`logout`. Keep the paragraph one paragraph.

- [ ] **Step 2: Add a how-to to `AGENTS.md` §6 — "Add a new identity provider"**

Concrete steps an agent must follow to add Clerk/WorkOS/etc.:

1. Scaffold `modules/identity/<vendor>/` with the standard module package layout plus a `client/` subtree (mirror `modules/identity/auth0`).
2. `module.json#client.config.schema` must declare every required public config key.
3. `client/index.ts#boot(ctx)` must register a Bearer transport middleware via `ctx.transport.use`, write `/auth/status` and `/auth/user` to `ctx.state`, and register module-level operations through `ctx.registerOperation`.
4. `client/components/LoginScreen.tsx` and `client/components/UserBadge.tsx` must be exported by name from `client/index.ts` and registered in `module.json#client.components`.
5. The project consuming this provider declares it under `project.json#modules.identity` with the matching `package` name; the project's layout uses `visible: { $state: '/auth/status', eq: ... }` to gate anon vs authed branches.

Cross-reference: `docs/superpowers/specs/2026-04-30-notes-demo-auth0-migration-design.md`.

- [ ] **Step 3: Update `AGENTS.md` §3 layering**

In the layering section, add identity modules to the list of UI-contributing module categories alongside presentation and analytics. Note that identity modules are mixed (backend `capabilities` + `client` block).

- [ ] **Step 4: Rewrite `modules/identity/auth0/README.md`**

Cover:

- That this module is mixed: a canonical Identity gRPC service AND a UI auth path.
- The client surface: `boot` (state writes, transport middleware, ops), `LoginScreen`, `UserBadge`.
- Required `publicConfig`: `domain`, `clientId`, `audience`, `redirectUri`, optional `scope`.
- That the access token is held in module-private closure and never written to state.
- That a project layout must declare `visible: { $state: '/auth/status', ... }` gates around anon and authed branches.
- Limitations array stays accurate (already covers backend gaps; no edits needed there).

- [ ] **Step 5: Update `demo/notes-blueprint/README.md`**

Document:

- Required environment variables for deploy: `AUTH0_SPA_CLIENT_ID` (substituted into `project.json#modules.identity.publicConfig.clientId`), Auth0 backend audience, Redpanda SASL keys, `RNTME_AUTH_*` envs.
- Layout structure: anon branch renders `<LoginScreen />`; authed branch renders a horizontal topbar + `<UserBadge />`; the routed notes screen root is separately visible only while `/auth/status === "authed"`.
- Record that no `Outlet` primitive is used in this migration because the current `AppShell` renders layout and routed screen as siblings.

- [ ] **Step 6: Mark Phase 4 of the original auth0 spec/plan as superseded**

In `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md` add a frontmatter line near the top:

> **Status update (2026-04-30):** §6 (UI auth-shell) is superseded by `docs/superpowers/specs/2026-04-30-notes-demo-auth0-migration-design.md`. Phases 1–3, 5–7 remain authoritative.

In `docs/superpowers/plans/2026-04-29-notes-demo-auth0.md` add the same line near the top of Phase 4. Do not delete the historical task bodies.

- [ ] **Step 7: Final verification sweep**

Run:

```bash
pnpm -r run typecheck
pnpm -r run lint
pnpm -r run test
```

Expected: all green.

Run:

```bash
grep -rn "ui-auth-shell\|mountAuthenticatedApp\|__RNTME_AUTH_SHELL_CONFIG__" .
```

Expected: only matches inside `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md`, `docs/superpowers/plans/2026-04-29-notes-demo-auth0.md`, and the new migration spec/plan (historical references). Anywhere else = bug, fix inline before commit.

- [ ] **Step 8: Manual deploy smoke (per spec §13)**

After all eight tasks land on `main`, deploy `demo/notes-blueprint` to `notes-demo.rntme.com` via Dokploy and verify:

1. Cold load of `/` while signed-out renders `<LoginScreen />` (anon gate).
2. Sign-in flow: click → Auth0 redirect → return → `<LoginScreen />` hides; `<Topbar><UserBadge /></Topbar>` and notes list render (authed gate).
3. Create a note via the form: 201; ownership injected via `$pre.session.user_id`; row appears in the list.
4. Force-expire the token (clear `localStorage` `auth0` keys) and trigger any authed fetch: 401 → state flips to anon → layout shows `<LoginScreen />` without page reload.
5. Click Logout in `<UserBadge />`: Auth0 logout → return signed out.
6. `/srv/config.json` contains exactly `{ "@rntme/identity-auth0": { domain, clientId, audience, redirectUri } }` (or the domain-service workload-relative path if M5 wired it that way) — no extra keys, no `runtime` block, no top-level `auth0` block.
7. Repository contains no `packages/ui-auth-shell/` directory and no `app.js` esbuild output.

Record results in `~/.claude/projects/-home-coder-project/memory/notes_demo_auth0_deployed.md` (overwrite the existing memory).

- [ ] **Step 9: Commit docs**

```bash
git add CLAUDE.md AGENTS.md modules/identity/auth0/README.md demo/notes-blueprint/README.md docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md docs/superpowers/plans/2026-04-29-notes-demo-auth0.md
git commit -m "docs: identity-as-module migration — CLAUDE.md, AGENTS.md, READMEs, supersede note"
```

---

## End-to-end gate (after M8)

The migration is complete when **all** of the following hold simultaneously:

- `pnpm -r run test`, `typecheck`, and `lint` are green.
- `packages/ui-auth-shell` does not exist on disk.
- `packages/runtime/ui-runtime/src/build.ts` produces only `main.js` + `main.css`.
- `packages/runtime/ui-runtime/src/server/static-shell.ts` exports `buildHtmlShell(): string` (no options).
- `modules/identity/auth0/module.json` has a `client` block with `boot: true` and the two components and two operations declared in §5 of the spec.
- `demo/notes-blueprint/project.json` has a `modules.identity` entry with the publicConfig keys from §8.1 of the spec.
- `demo/notes-blueprint/services/app/ui/layouts/main.screen.json` uses `visible: { $state: '/auth/status', eq: ... }` on its anon and authed branches.
- The smoke checklist in §13 of the spec passes against a live `notes-demo.rntme.com` deployment.

Anything short of all eight conditions = migration not complete.
