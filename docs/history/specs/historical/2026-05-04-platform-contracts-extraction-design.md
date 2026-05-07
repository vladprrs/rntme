> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Platform contracts extraction (layering refactor) — design

**Date:** 2026-05-04
**Status:** approved (brainstorm done, plan pending)
**Drives:** 6 follow-up PRs (4 contract extractions + 1 rename + 1 CI guard)

## 1. Problem statement

A static audit of the workspace dependency graph found five package-level edges that, while formally a DAG, violate the layering principle the project relies on:

> **Modules depend on contracts, not on implementations. Implementations (runtime / deploy-core / blueprint / ui-runtime) read modules through contracts, never the other way.**

| # | Edge | Where in code | Severity |
| - | ---- | -------------- | -------- |
| 1 | `identity-auth0` → `@rntme/deploy-core` | `modules/identity/auth0/src/provisioner.ts` imports `ProvisionerEnvMapping` | HIGH |
| 2 | `identity-auth0` → `@rntme/ui-runtime/client` | auth0 client block imports `ModuleBootContext`, `useModuleAction`, `useStateStore` | HIGH |
| 3 | `module-skeleton` → `@rntme/runtime` | `module-skeleton/src/handlers.ts` imports `CodeCommandHandlerMap` | MEDIUM |
| 4 | `module-skeleton` → `@rntme/event-store` | devDep only; tests | LOW |
| 5 | `blueprint` and `deploy-core` → `@rntme/module-skeleton` | Both import `parseModuleManifest`, `ModuleManifest`, `EdgeAuthDescriptor` | HIGH |

`identity-clerk` and `identity-workos` show the correct shape: they depend only on `@rntme/contracts-common-v1`, `@rntme/contracts-identity-v1`, `@rntme/conformance-identity` and external SDKs. Auth0 is the outlier because of its provisioner and its UI client block — and the contracts those need do not yet exist as standalone packages.

### Root cause

`packages/contracts/` currently contains **only domain contracts** (`identity/v1`, `ai-llm/v1`, `crm/v1`, `analytics/v1`, `_common/v1`). It has **no platform contracts** — i.e., no contract packages for the cross-cutting integration points that every module touches: the manifest schema, the provisioner runtime contract, the SPA client-runtime, and the command-handler map.

When those contracts have no package to live in, they get parked wherever convenient — manifest schema in `module-skeleton`, provisioner contract in `deploy-core`, client runtime in `ui-runtime`, handler-map in `runtime`. Modules then depend on those packages because that's where the contract is, and a structural violation is born.

### Why it matters (vision relevance)

Two market promises depend on the layering staying clean:

- **P1. "Authoring is JSON only."** Today, validating a blueprint folder transitively pulls `runtime` (because `blueprint` → `module-skeleton` → `runtime`). A lightweight `rntme blueprint validate` CLI is impossible.
- **P2. "Modules are interchangeable plug-ins by contract."** Today, a third-party author of `@thirdparty/identity-okta` would need to depend on `@rntme/deploy-core` (provisioner types) and `@rntme/ui-runtime` (client types) — i.e., on internal implementations. That contradicts vendor-pluggability.

Edges 1, 2, and 5 hit P1/P2 directly. Edges 3 and 4 are markers of the same root cause but lower severity (one type, one devDep).

## 2. Decision

Add a horizontal "platform contracts" layer between domain contracts and implementations. Concretely: extract the four cross-cutting contracts into their own packages under `packages/contracts/`, mirroring the existing pattern (`<concern>/v1`).

### Approach selected: A — one package per cross-cutting concern

Considered and rejected:

- **B (one fat `contracts-platform-v1`):** Mixes JSON schema (slow-moving) with React runtime types (fast-moving) and pulls React types into server-only modules. Too coarse.
- **C (hybrid: bundle module-facing contracts together):** Same mixing problem; doesn't scale to a future `EventBus` or `Surface` contract.

A wins because it mirrors `contracts/identity/v1` etc., gives gradual versioning, and lets a server-only vendor module skip the React-bearing contract.

### Bundled side-effects (in scope of this design)

- **CI guard via `dependency-cruiser`** to prevent regression. Without enforcement, the same drift returns within two sprints.
- **Rename `module-skeleton` → `module-scaffold`** to remove the false implication that it hosts contracts. After extraction it is *only* example handlers + scaffolding helpers.

### Out of scope

- Normalizing `Result<T>` across packages (existing per-package convention preserved).
- `runtime` ↔ `deploy` dependency rules beyond what edges 1–5 reveal.
- Versioning a `v2` of any existing contract.
- Touching `vision.md` or market-hero copy (this is internal hygiene, not a positioning change).

## 3. Package layout

```
packages/contracts/
├── _common/v1                  ← exists
├── identity/v1                 ← exists  (domain)
├── ai-llm/v1                   ← exists  (domain)
├── analytics/v1                ← exists  (domain)
├── crm/v1                      ← exists  (domain)
│
├── module/v1                   ← NEW    @rntme/contracts-module-v1
├── provisioner/v1              ← NEW    @rntme/contracts-provisioner-v1
├── client-runtime/v1           ← NEW    @rntme/contracts-client-runtime-v1
└── handlers/v1                 ← NEW    @rntme/contracts-handlers-v1
```

Plus:
```
packages/tooling/module-skeleton  →  packages/tooling/module-scaffold
                                     (renamed; manifest schema gone, runtime
                                      dep gone, event-store devDep gone)
```

### Dependency direction after the refactor

```
contracts/_common/v1
    ↑      ↑      ↑
contracts/{module,provisioner,handlers,client-runtime}/v1   (the new platform layer)
    ↑                ↑                ↑
    │                │                ↑
    │       identity-auth0 (and any future vendor module with a
    │                       provisioner or client block)
    │
artifacts/* (blueprint, qsm, pdm, ui, seed, bindings, graph-ir-compiler)
runtime/*  (runtime, ui-runtime, event-store, bindings-http, …)
deploy/*   (deploy-core, deploy-dokploy)
tooling/module-scaffold
platform/* (control plane)
```

**Invariant.** Modules see only `contracts/*` + external SDKs. Platform contracts see only other contracts + external. Implementations may consume contracts; they may not be consumed by modules.

### Consumer dependency delta

| Package | Adds | Removes |
| ------- | ---- | ------- |
| `identity-auth0` | `contracts-provisioner-v1`, `contracts-client-runtime-v1` | `deploy-core`, peerDep `ui-runtime`, devDep `ui-runtime` |
| `module-scaffold` (was `module-skeleton`) | `contracts-handlers-v1`, `contracts-module-v1` | `runtime`, devDep `event-store` |
| `blueprint` | `contracts-module-v1` | `module-skeleton` |
| `deploy-core` | `contracts-module-v1`, `contracts-provisioner-v1` | `module-skeleton` |
| `runtime` | `contracts-handlers-v1` | — |
| `ui-runtime` | `contracts-client-runtime-v1` | — |

## 4. Contract surfaces

### `@rntme/contracts-module-v1`

- **Source migration:** `packages/tooling/module-skeleton/src/manifest-shape.ts` whole file.
- **Exports:**
  - Schemas (zod): `ModuleManifestSchema`, `EdgeAuthDescriptorSchema`, `ModuleCapabilitiesSchema`, `ModuleSecretSchema`, `ProvisionerBlockSchema`, `ProvisionerProducesSchema`, `ProvisionerRequiresSchema`
  - Types: `ModuleManifest`, `EdgeAuthDescriptor`, `ModuleCapabilities`, `ModuleSecret`, `ProvisionerBlock`, `ProvisionerProduces`, `ProvisionerRequires`, `ClientBlock`, `ComponentDeclaration`, `OperationDeclaration`, `PropSchema`, `ModuleManifestError`, `ModuleManifestResult`
  - Functions: `parseModuleManifest`
- **Runtime deps:** `zod`. No internal deps.
- **Consumers:** `blueprint`, `deploy-core`, `module-scaffold`, `runtime` (where applicable), every vendor module shipping a `module.json`.

### `@rntme/contracts-provisioner-v1`

- **Source migration:**
  - `packages/deploy/deploy-core/src/provisioner-contract.ts` whole file.
  - From `packages/deploy/deploy-core/src/provisioner-env-mapping.ts`: only the **types** (`EnvMappingEntry`, `ProvisionerEnvMapping`, `ResolvedEnvEntry`). The function `resolveEnvMappings` stays in `deploy-core` because it consumes the orchestrator-side `ProvisionedModule` type.
  - Local minimal `Result<T,E>` (matches the per-package Result convention; `_common/v1` does not host Result).
- **Exports:**
  - Types: `ProvisionerContract<I>`, `ProvisionerInput<I>`, `ProvisionerOutput`, `ProvisionerLog`, `ProvisionerVendorError`, `ProvisionerEnvMapping`, `EnvMappingEntry`, `ResolvedEnvEntry`, `Result<T,E>`
- **Runtime deps:** none internal.
- **Consumers:** every vendor module with a provisioner; `deploy-core` (consumes the contract when running provisioners).

### `@rntme/contracts-client-runtime-v1`

- **Source migration:** parts of `packages/runtime/ui-runtime/src/client/`. Initial set:
  - `module-context.ts`, `hooks.ts`, `transport-chain.ts`, `lifecycle-bus.ts`, `operation-registry.ts`, `visibility.ts`, `router.ts`
- **Stays in `ui-runtime`** as host bootstrap:
  - `entry.tsx`, `no-auth-entry.ts`, `screen-loader.ts`, `state.ts`, `layout-manager.tsx`, `driver.ts`, `registry.ts`, `styles.css`
- **Exports:** the public surface currently shipped via `@rntme/ui-runtime/client` minus host-bootstrap names (`AppShell`, `Driver`, `RuntimeBridge`, `createRuntimeStateStore`, `createScreenLoader`, `mountUiRuntime`, `hydrateApp`, `ModuleSpec`).
- **Runtime deps:** `react` (peer), `@json-render/core` (peer — provides `StateStore`).
- **Consumers:** vendor module client blocks (`identity-auth0/client`, future UI-bearing modules); `ui-runtime` itself for mounting.
- **Side-effect:** `ui-runtime`'s `./client` subpath export is **retained** as a Node-free SPA host-bootstrap entry (not removed). It now exposes ONLY host-bootstrap symbols — `createDriver`, `createScreenLoader`, `createRegistry`, `createRuntimeStateStore`, `AppShell`, `hydrateApp`, `mountUiRuntime`, `ModuleSpec`, etc. — with zero contract surface. Reason: the root `@rntme/ui-runtime` entry re-exports `./server/index.js`, which imports `node:fs`/`node:path`/`node:url`; if the SPA's virtual entry imported the root, esbuild would walk into the Node-only graph and break the browser build. Modules continue to depend ONLY on `@rntme/contracts-client-runtime-v1`; `./client` is the SPA bundler's contract with the host, not a module-facing surface.

### `@rntme/contracts-handlers-v1`

- **Source migration:** the **types** (`CodeCommandHandler`, `CodeCommandHandlerMap`) from `packages/runtime/runtime/src/plugins/executors/code-command-executor.ts`. The executor implementation stays in `runtime` and imports the types back from the contract.
- **Exports:** `CodeCommandHandler`, `CodeCommandHandlerMap` (and any directly related handler-map types).
- **Runtime deps:** none internal.
- **Consumers:** `module-scaffold` (for `exampleHandlers`); `runtime` (re-exports for service authors); services with code blocks.

### `module-scaffold` (renamed from `module-skeleton`)

- **Keeps:** `src/handlers.ts` (`exampleHandlers`) and any future scaffolding helpers.
- **Loses:** `src/manifest-shape.ts` (gone to `contracts-module-v1`); dependency on `@rntme/runtime`; devDep on `@rntme/event-store`.
- **Tests:** rewritten on an in-memory mock event-store. Tests that lose meaning without a real event-store are deleted, not faked.
- **Runtime deps:** `contracts-handlers-v1`, `contracts-module-v1`, `zod` (if scaffolding helpers parse manifests).

## 5. Migration plan — six small PRs

Strategy: each PR self-contained (extract contract + migrate **all** consumers in the same PR). No temporary re-exports — pre-stable allows direct breaks (memory `project_pre_stable_stage.md`).

Merge order: **PR 1 → 2 → 3 → 4 → 5 → 6**. After PR 1 the skeleton has no external consumers, which shrinks the blast radius of PRs 4 and 5. PRs 2 and 3 may be developed in parallel branches.

### PR 1 — `@rntme/contracts-module-v1`

1. Create `packages/contracts/module/v1/` (package.json, tsconfig, README, `src/index.ts`).
2. `git mv packages/tooling/module-skeleton/src/manifest-shape.ts → packages/contracts/module/v1/src/manifest-shape.ts`.
3. Trim `module-skeleton/src/index.ts` (drop manifest re-exports).
4. `blueprint`: drop `@rntme/module-skeleton` from `package.json`, add `@rntme/contracts-module-v1`. Bulk-replace import paths.
5. `deploy-core`: same.
6. New README; AGENTS.md §3 + §10; CLAUDE.md "Architecture in one paragraph"; root README packages-table row.
7. Verification: `pnpm install --frozen-lockfile && pnpm -r run typecheck && pnpm -r run test && pnpm -r run build && pnpm -r run lint`.

**Blast radius:** `module-skeleton`, `blueprint`, `deploy-core`, the new package.

### PR 2 — `@rntme/contracts-provisioner-v1`

1. Create `packages/contracts/provisioner/v1/`.
2. `git mv deploy-core/src/provisioner-contract.ts → contracts-provisioner-v1/src/`.
3. From `deploy-core/src/provisioner-env-mapping.ts` cut **types** to `contracts-provisioner-v1/src/env-mapping-types.ts`. `resolveEnvMappings` stays in `deploy-core` and now imports types from the contract.
4. Add local minimal `result.ts` to the contract.
5. `deploy-core/src/index.ts`: drop exports that moved; update internal imports.
6. `identity-auth0/package.json`: drop `@rntme/deploy-core`, add `@rntme/contracts-provisioner-v1`. Update `provisioner.ts` import. Update `package.json#scripts.build:deps` to build the contract instead of `deploy-core`.
7. New README; AGENTS.md §3 + §10; if `§6 how-to "How do I add a provisioner to a vendor module"` does not exist yet, add it.
8. Verification.

**Blast radius:** `deploy-core`, `identity-auth0`, the new package.

### PR 3 — `@rntme/contracts-client-runtime-v1` (highest-risk PR)

1. Create `packages/contracts/client-runtime/v1/`.
2. `git mv` the file set listed in §4. Final list confirmed via grep at plan time (open question O1).
3. Update internal `ui-runtime` files (`entry.tsx`, `driver.ts`, `registry.ts`, `state.ts`, `layout-manager.tsx`, `screen-loader.ts`) to import from the new contract.
4. `ui-runtime/package.json`: add the contract to `dependencies`. **Keep** `./client` in the `exports` map but reduce it to a Node-free host-bootstrap entry — only `createDriver`, `createScreenLoader`, `createRegistry`, `createRuntimeStateStore`, `AppShell`, `hydrateApp`, `mountUiRuntime`, `ModuleSpec`, etc. (zero contract surface). The `./client` subpath cannot be deleted because the root `@rntme/ui-runtime` entry re-exports `./server/index.js`, which imports `node:fs`/`node:path`/`node:url`; the SPA's virtual entry must keep importing the Node-free `./client` subpath so esbuild does not walk into the Node-only graph.
5. `identity-auth0/package.json`: drop peerDep + devDep on `@rntme/ui-runtime`; add `@rntme/contracts-client-runtime-v1` to `dependencies`. Keep `react` peer.
6. Update auth0 client imports: `'@rntme/ui-runtime/client'` → `'@rntme/contracts-client-runtime-v1'`.
7. New README; AGENTS.md §3 + §10; CLAUDE.md "Architecture in one paragraph"; if any client-block authoring guide exists, update its import path.
8. Verification + extra: SPA bundle check (one copy of the contract package, no React Context dedup issue) + end-to-end smoke on a demo with auth0.

**Blast radius:** `ui-runtime`, `identity-auth0`, the new package.

### PR 4 — `@rntme/contracts-handlers-v1`

1. Create `packages/contracts/handlers/v1/`.
2. Cut `CodeCommandHandler` / `CodeCommandHandlerMap` types from `runtime/src/plugins/executors/code-command-executor.ts` to the contract. Executor implementation imports the types back.
3. `runtime/src/index.ts`: re-export from the contract (so service authors don't break) **or** remove the re-export and switch service consumers to import from the contract directly. Pick the cheaper path at plan time.
4. `module-skeleton/src/handlers.ts`: replace import path. `module-skeleton/package.json`: drop `@rntme/runtime`, add `@rntme/contracts-handlers-v1`.
5. New README; AGENTS.md §3 + §10; CLAUDE.md.
6. Verification.

**Blast radius:** `runtime` (minimal), `module-skeleton`, the new package. After PR 4 the skeleton depends only on two contracts.

### PR 5 — Rename `module-skeleton` → `module-scaffold` + cleanup

1. `git mv packages/tooling/module-skeleton packages/tooling/module-scaffold`.
2. `package.json#name`: rename. Update `description`.
3. Bulk-grep for `@rntme/module-skeleton` across the repo. After PRs 1–4 only `pnpm-lock.yaml` should still reference it; if any source/test/markdown still mentions it — fix in this PR.
4. Drop `@rntme/event-store` devDep. Rewrite tests on an in-memory mock; delete tests that lose meaning without a real event store.
5. Full README rewrite for `module-scaffold` (the package's role changed — examples only, no contracts).
6. AGENTS.md §10 (rename glossary entry); CLAUDE.md "Architecture in one paragraph"; root README packages-table.
7. `docs/architecture.md` (if it mentions skeleton); `docs/audit/00-waves.md` — close the wave entry tied to this refactor (memory `audit_waves_doc.md`).
8. Verification + repeat the demo end-to-end smoke.

**Blast radius:** the scaffold itself + grep updates.

### PR 6 — CI guard via `dependency-cruiser`

1. `pnpm add -Dw dependency-cruiser`.
2. `.dependency-cruiser.cjs` with the rules in §6.
3. Root `package.json#scripts.depcruise`: `depcruise --config .dependency-cruiser.cjs packages modules`.
4. Add a `pnpm depcruise` step to the CI workflow alongside `typecheck`/`test`/`lint`.
5. Local sanity: `pnpm depcruise` on main returns 0 violations.
6. Manual negative-test: temporarily inject a forbidden import, confirm the right rule fires, revert.
7. AGENTS.md: new section "Layering enforcement" (or extension to §11) listing the rules + the escape-hatch convention. CLAUDE.md "Non-obvious conventions": one-line bullet pointing to the guard. Root README "Commands" table: add `pnpm depcruise`.

**Blast radius:** root config + CI YAML.

### Per-PR doc obligations (CLAUDE.md "every plan must include a documentation-touch task")

| PR | New | Updated |
| -- | --- | ------- |
| 1 | `contracts/module/v1/README.md` | `module-skeleton`, `blueprint`, `deploy-core`; AGENTS.md §3 + §10; CLAUDE.md; root README |
| 2 | `contracts/provisioner/v1/README.md` | `deploy-core`, `identity-auth0`; AGENTS.md §3 + §10 (+ §6 if how-to missing); CLAUDE.md; root README |
| 3 | `contracts/client-runtime/v1/README.md` | `ui-runtime`, `identity-auth0`; AGENTS.md §3 + §10; CLAUDE.md; root README |
| 4 | `contracts/handlers/v1/README.md` | `runtime`, `module-skeleton`; AGENTS.md §3 + §10; CLAUDE.md; root README |
| 5 | — | full rewrite of `module-scaffold` README; AGENTS.md §10; CLAUDE.md "Architecture"; root README; `docs/audit/00-waves.md` |
| 6 | — | new section in AGENTS.md (or extension to §11); one bullet in CLAUDE.md "Non-obvious conventions"; one row in root README "Commands" |

`vision.md` and the market-hero `README.md` block are deliberately untouched — this refactor is internal hygiene, not a positioning change.

## 6. CI guard rules (`dependency-cruiser`)

### Rules

```js
{ name: 'modules-only-import-contracts',
  severity: 'error',
  comment: 'Vendor modules are plug-ins by contract. Imports from ' +
           'packages/{runtime,artifacts,deploy,platform,tooling}/* are forbidden.',
  from: { path: '^modules/' },
  to:   { path: '^packages/(?!contracts/)' } }

{ name: 'contracts-must-stay-leaves',
  severity: 'error',
  comment: 'Contracts must not depend on implementations or vendor modules. ' +
           'A contract may depend only on other contracts.',
  from: { path: '^packages/contracts/' },
  to:   { path: '^(packages/(?!contracts/)|modules/)' } }

{ name: 'tooling-only-imports-contracts',
  severity: 'error',
  comment: 'Tooling/scaffolding ships examples for module authors; it must ' +
           'not pull runtime/artifacts/deploy/platform into their graph.',
  from: { path: '^packages/tooling/' },
  to:   { path: '^packages/(runtime|artifacts|deploy|platform)/' } }

{ name: 'artifacts-must-not-import-runtime',
  severity: 'error',
  comment: 'Blueprint/QSM/PDM/UI/Bindings/etc. DESCRIBE what runtime later ' +
           'executes. They live above runtime in the meaning-graph. Any ' +
           'artifacts→runtime arrow is a bug.',
  from: { path: '^packages/artifacts/' },
  to:   { path: '^packages/runtime/' } }

{ name: 'deploy-must-not-import-runtime',
  severity: 'error',
  comment: 'Deploy plans/applies deployments; it does not depend on the ' +
           'runtime implementation. Anything needed from runtime must live ' +
           'in a contract.',
  from: { path: '^packages/deploy/' },
  to:   { path: '^packages/runtime/' } }

{ name: 'no-circular',
  severity: 'error',
  from: {},
  to: { circular: true } }
```

### Options

```js
options: {
  tsConfig: { fileName: 'tsconfig.base.json' },   // confirmed at plan time
  doNotFollow: { path: 'node_modules' },
  includeOnly: '^(packages|modules)/',
  exclude: { path: '(/test/|/dist/|/node_modules/|\\.test\\.ts$|\\.spec\\.ts$)' },
  enhancedResolveOptions: {
    exportsFields: ['exports'],
    conditionNames: ['import', 'require', 'node'],
  },
}
```

Tests are excluded so integration tests can legitimately reach into implementations.

### Why these rules and not more

Each rule is a surface for false positives. The set above catches every violation listed in §1 plus guarantees the root cause cannot recur. Wider rules (e.g., `runtime → not deploy`) are added only when a real case justifies them.

### Escape hatch

Real exceptions add a **named** `pathNot` to the specific rule with a comment + link to a spec or PR. We do not lower a rule to `severity: warn` — that trains the team to ignore it.

## 7. Testing and regression checks

This refactor is structural; no new behavior. Existing tests must stay green. Few new tests are needed.

### Test migration map

| PR | From | To | Scope |
| -- | ---- | -- | ----- |
| 1 | `module-skeleton/test/**/manifest-shape*.test.ts` | `contracts-module-v1/test/unit/` | `parseModuleManifest`, schema-shape tests |
| 2 | `deploy-core/test/**` provisioner-contract tests (if any) and env-mapping type tests | `contracts-provisioner-v1/test/unit/` | Contract-only tests. `resolveEnvMappings` tests stay in `deploy-core` |
| 3 | `ui-runtime/test/**/{module-context,hooks,transport-chain,visibility,router}*.test.ts` | `contracts-client-runtime-v1/test/unit/` | Tests that follow the migrated files |
| 4 | `runtime/test/**` type-level tests for handler-map (if any) | type-level checks colocated in the contract | minimal |
| 5 | `module-skeleton/test/**` (residual) | `module-scaffold/test/` | Rewritten on in-memory mock; meaning-less ones deleted |

### Per-PR verification gate (run locally before review)

```
pnpm install --frozen-lockfile
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

If any of the five fails, the PR is not opened.

### Extra checks for high-risk PRs

- **PR 3:** after `pnpm -F @rntme/ui-runtime run build`, confirm exactly one copy of `@rntme/contracts-client-runtime-v1` in the SPA bundle (otherwise React Contexts will not dedupe). Run an end-to-end smoke on a demo with auth0: login, `useModuleAction`, `useStateStore` reading `/auth/status`.
- **PR 5:** after replacements *and* `pnpm install` (which updates `pnpm-lock.yaml`), `git grep '@rntme/module-skeleton'` must return zero matches across the repo. Any remaining hit is a missed migration. Run the demo end-to-end again — scaffold sits deeper in the stack.
- **PR 6:** manual negative-test: inject a forbidden import, confirm the correct rule fires, revert. Repeat once for `contracts-must-stay-leaves` to confirm both directions.

### Optional new tests (not blockers)

- Round-trip test in `contracts-module-v1` ↔ `contracts-provisioner-v1`: the manifest's `ProvisionerBlock` shape must match the runtime contract's `ProvisionerInput.requires`. Add when drift first appears, not preemptively.
- `expectTypeOf` coverage in `contracts-client-runtime-v1` confirming `ModuleBootContext` matches what `ui-runtime` actually passes — useful as a contract signature check.

### Out of scope for verification

Performance, bundle size, manual `platform.rntme.com` integration test (released separately, not a PR-blocker).

## 8. Open questions for the implementation plan

- **O1.** Final file list for `contracts-client-runtime-v1`: exact split between contract files and host-bootstrap files in `ui-runtime/src/client/`. Resolved by a grep pass over actual cross-package imports during planning.
- **O2.** Whether `runtime/src/index.ts` continues to re-export `CodeCommandHandlerMap` after PR 4, or whether service authors switch to importing from the contract directly. Resolved by counting current import sites.

## 9. Acceptance criteria

- [ ] All five edges in §1 are gone (`pnpm depcruise` on main reports 0 violations against the rules in §6).
- [ ] No regression: `pnpm -r {typecheck,test,build,lint}` green; demo blueprint boots end-to-end.
- [ ] Documentation updated per the table in §5.
- [ ] CI guard live and proven via the manual negative-test in §7.
- [ ] `module-skeleton` no longer exists; `module-scaffold` ships with examples only.

## 10. References

- CLAUDE.md — "Architecture in one paragraph", "Product positioning", "Non-obvious conventions"
- `AGENTS.md` — §3 layering, §10 glossary, §11 documentation-touch checklist
- `docs/history/specs/historical/2026-04-26-docs-refresh-after-project-first-pivot-design.md` — cost evidence for letting docs drift
- `docs/history/specs/historical/2026-05-03-module-provisioner-contract-design.md` — provisioner contract design (consumed types, now to be relocated)
- Memories: `project_pre_stable_stage.md`, `audit_waves_doc.md`, `feedback_plan_checkpoints_autonomous.md`, `feedback_no_rationalization.md`
