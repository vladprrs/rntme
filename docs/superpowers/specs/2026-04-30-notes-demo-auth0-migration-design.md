# Notes-Demo Auth0 Migration to UI-Module Contributions — Design

**Status:** ready for plan
**Supersedes (Phase 4 only):** `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md` §6 (UI auth-shell)
**Builds on:** `docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md` (RNT-388)

## 1. Why this spec exists

Both source plans are merged on `main`:

- `2026-04-29-ui-module-contributions.md` (RNT-388, commit `bb4b4ce`) — established the module-as-UI-extension contract: `project.json#modules`, `client.boot/components/operations`, `module-action`, `transport-chain`, state-gated rendering, virtual entry, `publicConfig` sidecar.
- `2026-04-29-notes-demo-auth0.md` (commit `e786c6a`) — landed Auth0 OIDC introspection, ownership-via-`$pre`, Redpanda SASL_SSL, and a UI auth path **predating RNT-388**: a separate `packages/ui-auth-shell` package with `mountAuthenticatedApp`, vanilla-DOM chrome, hardcoded Auth0 SDK, a `/config.json` shape unique to that shell, and a special branch in `packages/runtime/ui-runtime/src/build.ts` producing a second `app.js` bundle.

After RNT-388, the auth path has a properly-typed home: a mixed module under `modules/identity/auth0/` with a `client` block. The shell package is now a parallel implementation of the same idea with worse boundaries (vanilla DOM, hardcoded vendor, build-time fork). This spec migrates the auth0 path onto the RNT-388 contract and deletes the shell.

## 2. Goal

After this migration:

- `modules/identity/auth0/` is a single mixed module: backend `capabilities` (already shipped) + `client.boot: true` + `client.components: [LoginScreen, UserBadge]` + `client.operations: [login, logout]` + `client.config.schema`.
- `demo/notes-blueprint/project.json` declares `modules: { identity: { package: "@rntme/identity-auth0", publicConfig: {...} } }`. No `/config.json` shape unique to auth.
- The login/topbar UX is authored in JSON: a layout screen with `visible:` gates over `/auth/status`, with module-contributed `<LoginScreen />` (anon branch) and `<UserBadge />` (authed branch topbar).
- `packages/ui-auth-shell` is deleted from the workspace.
- `packages/runtime/ui-runtime/src/build.ts` builds a single SPA bundle from the standard `no-auth-entry.ts`. The auth-shell branch is removed.
- Any future identity vendor (Clerk, WorkOS) is one new `modules/identity/<vendor>/` package + a `project.json#modules` swap, no edits to runtime/blueprint/demo.

## 3. Non-goals

- Multi-tenant Auth0 SPA support beyond the existing `domain`/`clientId`/`audience` triple.
- Any change to the merged backend pieces of the original auth0 plan (Phase 1 `IntrospectSession`, Phase 2 `$pre`/bindings, Phase 3 `auth` middleware on the HTTP layer, Redpanda SASL_SSL).
- Multi-language i18n for `<LoginScreen />` chrome. Hardcoded English strings ship in v1.
- Storing the access token outside module-private closure (no `/auth/token` in state-store).

## 4. Architecture summary

```
demo/notes-blueprint/project.json
  modules.identity = { package: "@rntme/identity-auth0", publicConfig: {...} }
                                │
                                ▼
@rntme/blueprint compose
  ├── catalogManifest.components += [LoginScreen, UserBadge]
  ├── catalogManifest.modulesWithBoot += ["@rntme/identity-auth0"]
  ├── catalogManifest.publicConfig["@rntme/identity-auth0"] = { domain, clientId, ... }
  └── renderVirtualEntry(catalog) → __rntme_ui_entry.ts
                                                │
                                                ▼  (esbuild → bundle)
                                  hydrateApp({components, modules})
                                                │
        ┌───────────────────────────────────────┼───────────────────────────────────────┐
        ▼                                       ▼                                       ▼
   GET /config.json                      module.boot(ctx)                          json-render
   (publicConfig sidecar)                  Auth0Client                          layout.visible
        │                                  ├── transport.use(Bearer)                    │
        └─→ ctx.config                     ├── state.set("/auth/status")                │
                                           ├── state.set("/auth/user")                  │
                                           └── registerOperation("login","logout")      ▼
                                                                                  anon branch:
                                                                                    <LoginScreen />
                                                                                  authed branch:
                                                                                    <Topbar><UserBadge /></Topbar>
                                                                                    <Outlet />  ← notes app
```

The runtime APIs already exist on `main` (`packages/runtime/ui-runtime/src/client/{module-context,transport-chain,operation-registry,lifecycle-bus,visibility,state}.ts`). This spec changes only authoring (module manifest + module client code + demo blueprint) and removes parallel mechanisms.

## 5. Module manifest changes

`modules/identity/auth0/module.json` adds a `client` block to the existing manifest. The backend `capabilities`, `category: "identity"`, `vendor: "auth0"`, `contract: "identity/v1"`, and `limitations` keep their current values.

```jsonc
{
  // ... existing fields unchanged ...
  "client": {
    "entry": "./client/index.ts",
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

Operations are module-level (no `appliesTo`). They are addressed from screens by `category: "identity"` (preferred — survives a future vendor swap) or `module: "@rntme/identity-auth0"`.

## 6. Module package layout

`modules/identity/auth0/` gains a `client/` subtree alongside the existing backend `src/`. The client uses repo-pinned React 19 (no second React major) and is type-checked with a new `tsconfig.client.json` that includes `dom` lib. `package.json#exports` exposes a second entry:

```jsonc
{
  "exports": {
    ".":        { "import": "./dist/server/index.js", "types": "./dist/server/index.d.ts" },
    "./client": { "import": "./dist/client/index.js", "types": "./dist/client/index.d.ts" }
  }
}
```

`@auth0/auth0-spa-js` moves from `packages/ui-auth-shell/package.json` to `modules/identity/auth0/package.json` as a regular dependency.

```
modules/identity/auth0/
├── module.json                 (extended)
├── package.json                (exports + auth0-spa-js dep)
├── tsconfig.json               (server, unchanged)
├── tsconfig.client.json        (NEW — dom + jsx)
├── tsconfig.check.json         (extended to cover client)
├── src/                        (backend, unchanged)
├── client/                     (NEW)
│   ├── index.ts                (boot + named component exports)
│   ├── components/
│   │   ├── LoginScreen.tsx
│   │   └── UserBadge.tsx
│   └── styles.css              (optional, scoped)
└── test/
    ├── unit/
    │   ├── boot.test.ts
    │   ├── LoginScreen.test.tsx
    │   └── UserBadge.test.tsx
    └── integration/conformance/    (existing)
```

## 7. Module client implementation

### 7.1 `client/index.ts`

Single file that exports `boot`, `LoginScreen`, `UserBadge`. The blueprint virtual-entry imports `* as mod_<pkg> from '@rntme/identity-auth0/client'` and the orchestration in `hydrateApp` picks `boot` and the named components.

```ts
import { Auth0Client } from '@auth0/auth0-spa-js';
import type { ModuleBootContext } from '@rntme/ui-runtime/client';
import { LoginScreen } from './components/LoginScreen.js';
import { UserBadge } from './components/UserBadge.js';

export { LoginScreen, UserBadge };

type AuthConfig = {
  domain: string;
  clientId: string;
  audience: string;
  redirectUri: string;
  scope?: string;
};

export async function boot(ctx: ModuleBootContext): Promise<void> {
  const cfg = ctx.config as AuthConfig;

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

  // Bearer middleware. Token lives in this closure only — never written to state.
  ctx.transport.use(async (req, next) => {
    if (token) req.headers.set('authorization', `Bearer ${token}`);
    const res = await next(req);
    if (res.status === 401) {
      token = null;
      ctx.state.set('/auth/status', 'anon');
      ctx.state.set('/auth/user', null);
    }
    return res;
  });

  // Redirect-callback handling on bootstrap.
  const url = new URL(window.location.href);
  if (url.searchParams.has('code') && url.searchParams.has('state')) {
    await client.handleRedirectCallback();
    window.history.replaceState({}, '', url.pathname);
  }

  if (await client.isAuthenticated()) {
    token = await client.getTokenSilently();
    const c = await client.getIdTokenClaims();
    ctx.state.set('/auth/user', {
      sub:   String(c?.sub ?? ''),
      email: (c?.email as string | undefined) ?? null,
      name:  (c?.name  as string | undefined) ?? null,
    });
    ctx.state.set('/auth/status', 'authed');
  } else {
    ctx.state.set('/auth/status', 'anon');
    ctx.state.set('/auth/user', null);
  }

  ctx.registerOperation('login',  () => client.loginWithRedirect());
  ctx.registerOperation('logout', () => client.logout({ logoutParams: { returnTo: cfg.redirectUri } }));
}
```

### 7.2 Components

`LoginScreen.tsx` — a self-contained anon screen. The Sign-in button calls the registered `login` operation through the `useOperationRegistry` hook (or whichever client-side hook the runtime exposes for module-level operations). No props.

`UserBadge.tsx` — reads `/auth/user` via `useStateStore`, renders email or name (per `display` prop, default `email`), and a Logout button that calls the `logout` operation. Returns `null` when `/auth/user` is `null`.

Both components are React 19, repo-pinned. Tests use `@testing-library/react` (already in workspace via ui-runtime tests).

### 7.3 State-store contract written by this module

| Path           | Type                                                                                  | Writer | Readers                                                                                            |
| -------------- | ------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `/auth/status` | `'anon'` \| `'authed'`                                                                | module | `visible` operators in layout screens                                                              |
| `/auth/user`   | `{ sub: string; email: string \| null; name: string \| null }` \| `null`              | module | `<UserBadge />`; any project-authored binding that wants `currentUser`                              |

The access token is not written to state. UI code that needs an authed network call uses the runtime transport, which already has the Bearer middleware applied.

## 8. notes-demo blueprint changes

### 8.1 `project.json` adds `modules` and keeps `middleware.auth`

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
  "routes":     { "ui": { "/": "app" }, "http": { "/api": "app" } },
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
    { "target": "ui:/",    "use": ["requestContext"] },
    { "target": "http:/api","use": ["requestContext", "auth"] }
  ]
}
```

The `modules.identity` key equals the module's declared `category: "identity"` (RNT-388 `BLUEPRINT_CATEGORY_MISMATCH` rule).

### 8.2 `middleware.auth.moduleSlug` cross-check

Today `moduleSlug` is a free-form string (`"identity-auth0"`). RNT-388 builds `categoryToModule["identity"] = "@rntme/identity-auth0"`. To prevent drift, blueprint composition must validate that the auth middleware references a module the catalog actually has:

- For `provider: "auth0"`, look up `categoryToModule["identity"]` → must equal a package whose manifest has `vendor: "auth0"`. Otherwise raise `BLUEPRINT_AUTH_MODULE_MISMATCH`.

This is a small additive validator in `packages/artifacts/blueprint/src/validate/composition.ts`, not a manifest change. (Phase 2 of the original auth0 plan added `BLUEPRINT_AUTH_AUDIENCE_MISMATCH` and `BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING`; this fits the same module.)

### 8.3 Layout screen and login screen

`services/app/ui/screens/layout.json` adds a state-gated split:

```jsonc
{
  "kind": "layout",
  "elements": {
    "anon":   {
      "type": "LoginScreen",
      "visible": { "$state": "/auth/status", "eq": "anon" }
    },
    "authed": {
      "type": "Stack",
      "visible": { "$state": "/auth/status", "eq": "authed" },
      "children": [
        {
          "type": "Topbar",
          "children": [{ "type": "UserBadge", "props": { "display": "email" } }]
        },
        { "type": "Outlet" }
      ]
    }
  }
}
```

`Topbar`, `Stack`, `Outlet` are layout primitives provided by the repo-pinned shadcn defaults already shipped with `@rntme/ui-runtime`. If a primitive is missing under that name, the migration plan substitutes the closest existing primitive and records the substitution in the demo's README.

The notes screens (list/detail/create) render under `<Outlet />`. They were already authored with `module-action` dispatch in mind (per the merged auth0 work), so no edits beyond removing any inline references to old shell artifacts.

### 8.4 No standalone login screen file

`<LoginScreen />` is module-contributed, so the demo does not need a `services/app/ui/screens/login.json`. The `visible:` gate in the layout is sufficient to render it on the anon branch.

## 9. Deploy adapter changes

`packages/deploy/deploy-dokploy/src/render.ts` previously emitted a custom `/srv/config.json` with shape `{ auth0: {...}, runtime: {...} }`. After the migration:

- `/srv/config.json` is the byte-for-byte output of `@rntme/blueprint`'s `renderPublicConfig(catalogManifest)`. Shape: `Record<modulePackageName, publicConfig>`.
- `RNTME_AUTH_*` envs on the **domain-service** workload (used by the backend HTTP middleware to verify Bearer tokens) keep their current names and values. They are independent of the SPA-side `publicConfig`.
- The Nginx noop block from the original auth0 plan stays.

`packages/runtime/runtime/` reads `RNTME_AUTH_*` and Kafka SASL envs as before.

`packages/deploy/deploy-core/src/plan.ts` validators that check `auth.provider`/`auth.audience`/`auth.moduleSlug`/module-workload existence keep their current behavior. A new validator added by §8.2 (`BLUEPRINT_AUTH_MODULE_MISMATCH`) prevents `moduleSlug` from drifting from `categoryToModule['identity']`.

## 10. ui-runtime build pipeline

`packages/runtime/ui-runtime/src/build.ts`:

- The second `build(...)` block that produces `build/app.js` from inline stdin importing `mountAuthenticatedApp` is removed entirely.
- The remaining build produces `build/main.js` from `client/no-auth-entry.ts` + `build/main.css` from Tailwind.
- The `__RNTME_AUTH_SHELL_CONFIG__` window indirection in any HTML template is removed. The standard `hydrateApp` in `packages/runtime/ui-runtime/src/client/entry.tsx` already fetches `/config.json` itself when at least one module declares `boot: true`.

Per-project SPA bundling (esbuild on the blueprint-emitted virtual entry) lives in the deploy renderer as already specified by RNT-388.

## 11. Removal of `packages/ui-auth-shell`

A single commit removes the package:

- `rm -r packages/ui-auth-shell`.
- Drop the entry from `pnpm-workspace.yaml` `packages:` list.
- Remove `@rntme/ui-auth-shell` references from any other `package.json` (devDeps/peerDeps).
- Remove mentions from `README.md`, `AGENTS.md`, `packages/runtime/ui-runtime/README.md`, and from any prior plan/spec frontmatter that linked to it.

No back-compat shim, no re-export. The pre-revenue project rule (`project_pre_stable_stage.md`) authorizes hard removal.

## 12. Migration task ordering

Eight tasks, one commit each. Tasks M1–M3 build the new path; M4 wires the demo to it; M5–M7 retire the old path; M8 documents.

| #   | Task                                                                                                                                | Touches                                                                                      | Gate                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Extend `modules/identity/auth0/module.json` with `client` block; add the auth0-spa-js dep; add `tsconfig.client.json` + exports.    | module manifest, package.json, tsconfigs                                                     | `pnpm -F @rntme/module-skeleton test` (manifest validates), `pnpm -F @rntme/identity-auth0 typecheck`                                 |
| M2  | Implement `client/components/LoginScreen.tsx` and `UserBadge.tsx` + unit tests.                                                     | `modules/identity/auth0/client/components/`, `test/unit/`                                    | component tests pass                                                                                                                  |
| M3  | Implement `client/index.ts` with `boot`, transport middleware, lifecycle, registered ops; unit test the boot lifecycle.             | `modules/identity/auth0/client/index.ts`, `test/unit/boot.test.ts`                           | boot test passes; `pnpm -F @rntme/identity-auth0 build`                                                                               |
| M4  | notes-demo `project.json#modules` + layout-screen with visible gates; remove any `login.json` workaround if present.                | `demo/notes-blueprint/project.json`, layout screen JSON                                      | `pnpm validate:notes-blueprint-seed` if applicable; `pnpm -F @rntme/blueprint test` covering project-with-modules-identity fixture   |
| M5  | deploy-dokploy renderer: `/srv/config.json` from `renderPublicConfig`; drop hand-built auth0 block; add `BLUEPRINT_AUTH_MODULE_MISMATCH` validator. | `packages/deploy/deploy-dokploy/src/render.ts`, `packages/artifacts/blueprint/src/validate/composition.ts`, tests | `pnpm -F @rntme/deploy-dokploy test`, `pnpm -F @rntme/blueprint test`                                                              |
| M6  | Remove the `app.js` esbuild branch in `packages/runtime/ui-runtime/src/build.ts`.                                                           | one file                                                                                     | `pnpm -F @rntme/ui-runtime build` produces only `main.js` + `main.css`                                                                |
| M7  | Delete `packages/ui-auth-shell`; clean workspace and READMEs.                                                                       | `rm -r`, `pnpm-workspace.yaml`, READMEs                                                      | `pnpm install --frozen-lockfile=false && pnpm -r run typecheck`                                                                       |
| M8  | Docs: AGENTS.md §6 ("how to add an identity provider"), §3 layering note, CLAUDE.md "Architecture in one paragraph", module README, demo README, mark Phase 4 of the original auth0 spec superseded. | docs                                                                                         | `pnpm -r run lint`, manual read-through                                                                                               |

Each task lands a green workspace. M3 is the riskiest; M7 is the most boring.

## 13. Smoke test plan

After M1–M8 land, deploy to `notes-demo.rntme.com` via Dokploy and verify:

1. Cold load of `/` while signed-out → `<LoginScreen />` renders (anon gate).
2. Click Sign in → Auth0 redirect → return → `<LoginScreen />` hides, `<Topbar><UserBadge /></Topbar>` + notes list render (authed gate).
3. Create note → 201; ownership injected via `$pre.session.user_id`.
4. Force-expire token (clear localStorage `auth0` keys), trigger any authed fetch → 401 → middleware sets `/auth/status = 'anon'` → layout flips back to `<LoginScreen />` without page reload.
5. Click Logout in `<UserBadge />` → Auth0 logout → return to `redirectUri` signed out.
6. `/srv/config.json` contains exactly `{ "@rntme/identity-auth0": { domain, clientId, audience, redirectUri } }` with no extra keys.
7. `packages/ui-auth-shell` and the `app.js` template no longer exist in the repo.

A subset of (1)–(5) is executable as a Vitest + jsdom integration test under `modules/identity/auth0/test/integration/`. Steps (6)–(7) are repo-state assertions that go in CI.

## 14. Risks and mitigations

| Risk                                                                                   | Mitigation                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout primitive (`Topbar`, `Stack`, `Outlet`) name not in shadcn defaults             | M4 substitutes the nearest existing primitive and records the choice in the demo README. If a critical primitive is missing, file follow-up. |
| `useOperationRegistry` hook surface inadequate for module-bound (no `target`) ops      | If the existing hook only addresses component-bound operations, M2 also adds a `useModuleOperation(category, name)` thin wrapper.            |
| `@auth0/auth0-spa-js` pulls Node-only deps when bundled into the module package        | esbuild already runs on the virtual entry (browser target). Verify in M3 by emitting and inspecting the bundle.                              |
| `getTokenSilently` triggers iframe network call before `/api/manifest` is reachable    | Existing flow already does this in `ui-auth-shell`; behavior is unchanged. Smoke step (1) covers it.                                         |
| `categoryToModule['identity']` collides with another future identity module            | `project.json#modules.identity` is a single key — declaring two identity modules in one project is already a key collision and rejected.    |

## 15. Open questions

None blocking. Closed during brainstorming:

- Migration scope = full replacement (no shim) — closed.
- Module ships components (`LoginScreen` + `UserBadge`) rather than operations only — closed.
- Token lives in module closure, not state-store — closed.
- `auth.moduleSlug` validated against `categoryToModule['identity']` — closed.
- Layout primitives = repo-pinned shadcn defaults — closed.
- Demo scope = notes-demo only — closed.
