# @rntme/module-scaffold

Examples and scaffolding for **rntme module authors**. Holds an
`exampleHandlers` map; **no contract surface lives here**. Module authors
should **copy and modify** this package as a starting point — do not depend
on it as a runtime dep.

The handler runtime contract (`CodeCommandHandler`,
`CodeCommandHandlerMap`, structurally-minimal `CommandExecutionContext`,
`CommandExecutorOutput`) lives in
[`@rntme/contracts-handlers-v1`](../../contracts/handlers/v1/README.md).
The `module.json` manifest schema (`ModuleManifestSchema`,
`parseModuleManifest`, `ModuleManifest`) lives in
[`@rntme/contracts-module-v1`](../../contracts/module/v1/README.md). Author
your own modules against those contracts directly.

## File map

```
src/
  handlers.ts        — exampleHandlers (a CodeCommandHandlerMap with one echo handler)
  index.ts           — barrel: VERSION + exampleHandlers
test/unit/
  _smoke.test.ts     — exports + handler shape smoke
  handlers.test.ts   — exampleHandlers.echo unit test using the narrow contract ctx
package.json         — workspace package; depends only on @rntme/contracts-handlers-v1
README.md            — this file
```

## Quick start

Use this package as a template. There is no public API to call from
elsewhere in the workspace.

```bash
cp -r packages/tooling/module-scaffold modules/<category>/<vendor>
# Then in the new copy:
#   1. Update package.json#name (e.g. @rntme/<category>-<vendor>) and bump version.
#   2. Replace src/handlers.ts with your vendor-specific CodeCommandHandlerMap.
#   3. Keep @rntme/contracts-handlers-v1 in dependencies (already wired).
#   4. Add your vendor SDK to dependencies.
#   4b. Add @rntme/contracts-module-v1 (manifest schema) and
#       @rntme/contracts-client-runtime-v1 (only if shipping a `client` block)
#       to your dependencies.
#   5. Author module.json validated by parseModuleManifest from @rntme/contracts-module-v1.
#   6. Run `pnpm install` at the repo root.
#   7. Wire your handlers into a CodeCommandExecutor in your module's bootstrap.
```

## API

The package exports two values from `src/index.ts`:

| Export             | Type                                                | Notes                                                            |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------- |
| `VERSION`          | `string` (`'0.0.0'`)                                | Marker constant — useful only as a smoke import target.          |
| `exampleHandlers`  | `CodeCommandHandlerMap` (from contracts-handlers-v1) | One `echo` handler returning `{ ok: true, value: ... }`.          |

There is no validator, no schema, no manifest helper, and no executor in
this package. If you need any of those, import them from the contracts or
runtime packages directly.

### `exampleHandlers.echo` shape

```ts
import type { CommandExecutionContext } from '@rntme/contracts-handlers-v1';
import { exampleHandlers } from '@rntme/module-scaffold';

const ctx: CommandExecutionContext = {
  now: () => new Date().toISOString(),
  nextId: () => 'id-1',
  correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
};

const out = await exampleHandlers.echo(ctx, { message: 'hello' });
// out → { ok: true, value: { aggregateId: 'echo', version: 0, eventIds: [], commandId, correlationId, result: { echo: true } } }
```

The example exists to give copy-paste authors a working baseline that
typechecks against the narrow contract context and returns a
`CommandExecutorOutput`. Replace it with your own handlers when you copy
this package.

## Invariants & gotchas

- **No contract surface here.** This package only ships an example
  handler map. Manifest schema lives in `@rntme/contracts-module-v1`;
  handler/executor types live in `@rntme/contracts-handlers-v1`.
- **No runtime dependency.** The package depends only on
  `@rntme/contracts-handlers-v1` (handler types). It does **not**
  depend on `@rntme/event-store`, `@rntme/runtime`, or any other
  runtime piece. If you need a `CodeCommandExecutor`, instantiate it
  in your own module — `import { CodeCommandExecutor } from '@rntme/runtime'`.
- **Authors copy, they do not depend.** Adding `@rntme/module-scaffold`
  to a real module's `dependencies` is a smell. Copy the source, then
  delete this package from your dep list.
- **Handlers see the narrow contract context.** `CommandExecutionContext`
  exposes only `now`, `nextId`, and `correlation`. The runtime may pass
  a richer ctx; modules MUST NOT rely on extra fields. The drift gate
  in `@rntme/contracts-handlers-v1`'s `runtime-compat.test.ts` keeps the
  runtime's richer ctx assignable to the contract.
- **Pre-stable, no compat shims.** This package was renamed from
  `@rntme/module-skeleton` in the platform contracts extraction wave
  (PR 5). There is no `@rntme/module-skeleton` re-export shim — update
  your imports.

## Out of scope

- Manifest schema, parsers, validators → `@rntme/contracts-module-v1`.
- Provisioner contract, env-mapping types → `@rntme/contracts-provisioner-v1`.
- Browser/UI module contract (`ModuleBootContext`, hooks, transport
  middleware, visibility, router helpers) → `@rntme/contracts-client-runtime-v1`.
- Concrete executors, event-store, projection consumer, gRPC surface,
  HTTP surface → `@rntme/runtime` and friends.
- Conformance suites for category contracts → `modules/<category>/conformance`
  (e.g. `modules/identity/conformance`).
- Webhook receiver, idempotency cache, pre-fetch (`pre[]`) — modules use
  the runtime/bindings packages directly.

## Where to look first

- **What does a real module look like?** → `modules/identity/auth0/`
  (mixed module: backend handlers + UI client).
- **How is `module.json` validated?** → `parseModuleManifest` in
  `@rntme/contracts-module-v1`.
- **How is a handler map mounted at boot?** → `CodeCommandExecutor` in
  `packages/runtime/runtime/src/plugins/executors/`.
- **What's the contract drift gate?** →
  `packages/contracts/handlers/v1/test/unit/runtime-compat.test.ts`.

## Specs

- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md`
  — original platform-modules-integration spec (§5 module pattern, §12 contract).
- `docs/superpowers/specs/2026-05-04-platform-contracts-extraction-design.md`
  — the layering refactor that extracted contracts out of this package and
  renamed it to `module-scaffold`.
- `docs/superpowers/specs/done/2026-05-03-module-provisioner-contract-design.md`
  — provisioner block in `module.json` (now hosted by `@rntme/contracts-provisioner-v1`).
- `docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md`
  — UI module contributions + `client` block in `module.json`.
