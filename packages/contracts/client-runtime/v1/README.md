# @rntme/contracts-client-runtime-v1

Client runtime contract for rntme. Defines the small browser-facing API that a
vendor module's `module.json#client` block consumes when mounted into a SPA
host.

This package is a platform contract, not a host implementation. UI-bearing
modules import hooks, providers, transport middleware, lifecycle and operation
registries, visibility evaluation, router helpers, and `ModuleBootContext` from
here. `@rntme/ui-runtime` imports the same contract when it boots the SPA host.

## Role in the system

- Depends on:
  - `@json-render/core` — `StateStore` type consumed by module hooks and boot
    context.
  - `react` — peer dependency for providers and hooks.
- Consumed by:
  - UI-bearing modules under `modules/<category>/<vendor>/`, including
    `@rntme/identity-auth0`, `@rntme/analytics-google-analytics`, and
    `@rntme/presentation-tiptap`.
  - `@rntme/ui-runtime`, which creates the concrete store, transport chain,
    operation registry, and module boot contexts at runtime.
- Position in pipeline:
  `module.json#client` + module `./client` export
    -> `@rntme/blueprint` virtual SPA entry
    -> `@rntme/ui-runtime` host bootstrap
    -> this contract's hooks/context/registries used by module code.

## File map

```
packages/contracts/client-runtime/v1/src/
  index.ts                  Public export barrel and VERSION.
  hooks.ts                  React contexts, providers, and module hooks.
  lifecycle-bus.ts          In-process lifecycle event emitter.
  module-context.ts         `createModuleBootContext` and `ModuleBootContext`.
  operation-registry.ts     Module operation registry used by UI components.
  router.ts                 `matchRoute` and `expandTemplate`.
  transport-chain.ts        Fetch-compatible middleware chain.
  visibility.ts             json-render-style visibility evaluator.
```

Tests live in `test/unit/` and follow the moved contract files.

## Quick start

### Module boot code

```ts
import type { ModuleBootContext } from '@rntme/contracts-client-runtime-v1';

export async function boot(ctx: ModuleBootContext): Promise<void> {
  ctx.transport.use(async (req, next) => {
    const nextReq = new Request(req, {
      headers: { ...Object.fromEntries(req.headers), Authorization: 'Bearer token' },
    });
    return next(nextReq);
  });

  ctx.state.set('/auth/status', 'authed');
  ctx.registerOperation('logout', async () => {
    ctx.state.set('/auth/status', 'anon');
  });
}
```

### Module React component

```tsx
import {
  useModuleAction,
  useStateStore,
} from '@rntme/contracts-client-runtime-v1';

export function UserBadge() {
  const store = useStateStore();
  const logout = useModuleAction('identity', 'logout');
  const user = store.get('/auth/user') as { email?: string } | null;
  return <button onClick={() => void logout()}>{user?.email ?? 'Sign out'}</button>;
}
```

## API

| Export | Purpose |
| --- | --- |
| `VERSION` | Contract package version string. |
| `createModuleBootContext`, `ModuleBootContext` | Host-created context passed to `client.boot(ctx)`. |
| `createTransportChain`, `TransportChain`, `TransportMiddleware` | Fetch-compatible middleware stack used by modules to add headers or side effects. |
| `createOperationRegistry`, `OperationRegistry`, `OperationHandler` | Register and invoke module operations such as `login` / `logout`. |
| `createLifecycleBus`, `LifecycleBus`, `LifecycleEvents` | In-process lifecycle event bus for host/module coordination. |
| `useTransport`, `useStateStore`, `useOperationRegistry`, `useModuleAction` | React hooks for module components. |
| `TransportProvider`, `StoreProvider`, `RegistryProvider` | React providers installed by the SPA host. |
| `evaluateVisible`, `Visible` | Visibility predicate evaluator for state-gated layout/screen branches. |
| `matchRoute`, `expandTemplate`, `RouteMatch` | Route pattern matching and `:param` substitution helpers. |

## Invariants & gotchas

- **Modules depend on contracts, not implementations.** Module client code must
  import from `@rntme/contracts-client-runtime-v1`, not from
  `@rntme/ui-runtime` internals.
- **The host owns concrete instances.** Modules receive a `ModuleBootContext`
  from `@rntme/ui-runtime`; they do not create the global store, transport
  chain, or root operation registry themselves except in tests.
- **React is a peer dependency.** Consumers must use the same React instance as
  the SPA host or context providers and hooks will not match.
- **Transport middleware is ordered.** Middleware runs in registration order,
  so auth modules that add `Authorization` should boot before modules that
  depend on authenticated fetches.
- **State paths are string contracts.** Common auth paths are `/auth/status`
  and `/auth/user`; changing them is a UI-module contract change, not a local
  component detail.
- **No server code.** This package is browser/module-facing contract code only.
  Hono routes, asset serving, screen loading, driver behavior, and SPA mounting
  stay in `@rntme/ui-runtime`.

## Out of scope / known limits

- No compiled UI artifact serving; that belongs to `@rntme/ui-runtime`.
- No json-render component catalog; module components use this package only to
  reach state, transport, and operations.
- No persistent storage policy; modules decide whether a vendor SDK stores
  session data, and the SPA host owns the in-memory json-render store.
- No public `hydrateApp` / `mountUiRuntime`; those are host bootstrap exports
  from `@rntme/ui-runtime`.

## Where to look first

- "Add a new module hook" -> `src/hooks.ts`; add a focused test in
  `test/unit/use-module-action.test.tsx` or a new adjacent test.
- "Change boot context shape" -> `src/module-context.ts`; update module tests
  that call `createModuleBootContext`.
- "Change operation behavior" -> `src/operation-registry.ts`.
- "Change transport middleware semantics" -> `src/transport-chain.ts`.
- "Change visibility rules" -> `src/visibility.ts`.
- "Change route matching" -> `src/router.ts`.

## Specs

- [`../../../../docs/superpowers/specs/2026-05-04-platform-contracts-extraction-design.md`](../../../../docs/superpowers/specs/2026-05-04-platform-contracts-extraction-design.md) — platform contracts extraction, including the `client-runtime/v1` split from `@rntme/ui-runtime`.
- [`../../../../docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md`](../../../../docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md) — UI module contribution model and generated virtual entry.
