# AGENTS.md — research map for coding agents

> Read this file first. It tells you where things live, what conventions
> govern the codebase, and how to approach common tasks. Per-package
> READMEs (`packages/*/README.md`) are the authoritative source for each
> package's internals.

## 1. Workflow expectations

- Research → Plan → Implement. Use the brainstorming and writing-plans
  skills; do not start editing code without a plan for non-trivial work.
- Optimize agent context for correctness, completeness, size, and trajectory.
  Preserve research, specs, plans, and reports as compacted artifacts instead
  of relying on chat history or tool logs. This follows the ACE/FCA discipline:
  the high-leverage review points are research and plans, not only final code.
- For brownfield work, produce or update the smallest durable artifact that
  keeps the next agent aligned: spec for intent, plan for exact edits and
  verification, report for code-vs-spec drift, README/AGENTS for navigation.
- Specs in `docs/superpowers/specs/` are the source of truth. Code that
  disagrees with a spec is a bug — fix the code, not the spec.
- Read the per-package `README.md` before opening any source file in that
  package. The README's "Where to look first" section is indexed by task.
- `docs/superpowers/specs/`, `docs/superpowers/plans/`, and
  `docs/superpowers/reports/` are tracked in git. New specs and plans
  land with the PR they describe so other contributors and CI can resolve
  the cross-references. Only the top-level `.superpowers/` cache is
  gitignored.
- **Every plan must include a documentation-touch task.** When a plan's
  code changes affect any per-package README, this file (§3 layering /
  §6 how-tos / §8 decisions / §10 glossary), `README.md` (packages table /
  dep graph / MVP scope / design docs), `CLAUDE.md`, `docs/architecture.md`,
  or `vision.md`, the plan MUST contain a final task that lands those doc
  updates in the same PR. See §11 for the checklist; see §7 for the
  anti-pattern.

## 2. Repository map

- `apps/`                   — runnable workspaces (`cli`, `platform-http`,
  `landing`)
- `packages/`               — workspace packages grouped by role:
  `artifacts/`, `runtime/`, `platform/`, `deploy/`, `tooling/`, and
  `contracts/`
- `demo/notes-blueprint/`   — canonical project-shape example
  (`project.json` + project-level PDM + services).
- `apps/cli/`               — `@rntme/cli`, the `rntme` CLI binary.
- `apps/platform-http/`     — `@rntme/platform-http`, Hono server at
  `platform.rntme.com`, REST/UI deploy surface, and background deploy executor.
- `apps/landing/`           — `@rntme/landing`, the public landing site.
- `packages/platform/`      — platform domain/storage packages.
- `packages/deploy/`        — deploy planner and Dokploy adapter packages.
- `docs/superpowers/specs/` — authoritative design specs (local-only)
- `docs/superpowers/specs/done/` — landed specs kept for cross-reference
- `docs/superpowers/plans/` — per-spec implementation plans (local-only)
- `docs/superpowers/reports/` — gap analyses (spec vs implementation)
- `docs/adr/`                — architectural decision records
- `docs/gaps/`               — known gaps per subsystem
- `graph_ir_rc_7.md`         — original Graph IR rc7 language spec
  (gitignored, local-only). Historical: first-step IR reference,
  superseded by later specs under `docs/superpowers/specs/`. Still
  useful for operator-level syntax/semantics; not canon.
- `README.md` (root)         — human-facing overview + CI badge + pointer
  back to this file

## 3. Package layering

ASCII dependency diagram. Arrow means "depends on".

```
              @rntme/contracts-module-v1   (leaf — manifest JSON shape)
                         |
                         v
                         @rntme/blueprint
                        /       |       \
                       /        |        \
              @rntme/pdm   @rntme/qsm   project-routed registry
                    \          /   \
                     \        /     \
              @rntme/graph-ir-compiler   @rntme/event-store
                         |                      |
                         +----------------------+
                         |
                 @rntme/bindings
                    /          \
       @rntme/bindings-http   @rntme/bindings-grpc
                    \          /
                     \        /       @rntme/ui
                      \      /            |
                       \    /             v
                        +--+------ @rntme/ui-runtime
                                      |
                                      v
                       @rntme/contracts-client-runtime-v1
                                      |
                                      v
                              @rntme/runtime
                               /     |     \
                              v      v      v
                         @rntme/seed  @rntme/projection-consumer
                                      @rntme/module-scaffold
                                                   |
                                                   v
                                  @rntme/contracts-handlers-v1
                                  (leaf — code command handler shape;
                                   runtime also depends on it and pins
                                   drift via runtime-compat type-test)

              Deployment (CLI-side; consumes validated/composed projects)
              @rntme/deploy-core ─── @rntme/deploy-dokploy
              (deploy-core also depends on @rntme/contracts-module-v1
               and @rntme/contracts-provisioner-v1; vendor modules with a
               provisioner block depend on @rntme/contracts-provisioner-v1
               directly, never on deploy-core)
```

One-line purpose per package (read the per-package README before touching):

- **`@rntme/blueprint`** — Project-first blueprint folder parser/validator.
  Owns Track A loading (`project.json`, project-level PDM assembly,
  service registry metadata, raw service-level multi-file QSM artifacts)
  and Track B composition (project routes/middleware validation,
  service artifact discovery, project-routed binding registry).
  → `packages/artifacts/blueprint/README.md`.
- **`@rntme/pdm`** — Parsing, validating, and resolving the project-shared
  PDM artifact. Canonical entity/field/relation/state source with
  root/owned entity classification. → `packages/artifacts/pdm/README.md`.
- **`@rntme/qsm`** — Query-side model on top of PDM: projections,
  derived DDL, resolver, relation metadata for JOINs. →
  `packages/artifacts/qsm/README.md`.
- **`@rntme/event-store`** — SQLite-backed event log with optimistic
  concurrency, monotonic cursor, and Kafka-style relay. →
  `packages/runtime/event-store/README.md`.
- **`@rntme/graph-ir-compiler`** — Parses the rc7 Graph IR, validates it
  (structural + semantic), lowers to SQL, emits, and executes queries
  and commands. → `packages/artifacts/graph-ir-compiler/README.md`.
- **`@rntme/bindings`** — HTTP bindings artifact: four-layer validator
  (parse → structural → references → consistency), `pre[]`,
  `inputFrom`, callback response shapes, and OpenAPI 3.1 emitter. →
  `packages/artifacts/bindings/README.md`.
- **`@rntme/bindings-http`** — Hono runtime for the bindings artifact;
  routes queries and commands, runs pre-fetch orchestration, applies the
  idempotency cache, callback redirects, maps errors to 400/409/422. →
  `packages/runtime/bindings-http/README.md`.
- **`@rntme/projection-consumer`** — Reads envelope events off the bus,
  applies them to projection tables idempotently, rolls back on fail. →
  `packages/runtime/projection-consumer/README.md`.
- **`@rntme/seed`** — Seed-envelope authoring: parse, validate, wrap
  payloads, and apply via the event-store's `appendRaw`. →
  `packages/artifacts/seed/README.md`.
- **`@rntme/ui`** — UI artifact compiler: JSON authoring → parse →
  validate → resolve → expand → compile → emit. No rendering. →
  `packages/artifacts/ui/README.md`.
- **`@rntme/ui-runtime`** — Serves the compiled UI artifact. Hono
  sub-router on the server side plus the SPA host bootstrap. React
  module-facing hooks/context/transport contracts live in
  `@rntme/contracts-client-runtime-v1`. →
  `packages/runtime/ui-runtime/README.md`.
- **`@rntme/runtime`** — Top-level service orchestrator. Loads a service
  manifest, boots event-store/bus/HTTP/gRPC surfaces, wires executor
  seams, modules, projections, seed, bindings + UI. →
  `packages/runtime/runtime/README.md`.
- **`@rntme/module-scaffold`** — Examples and scaffolding for rntme module
  authors. Holds `exampleHandlers` (an example `CodeCommandHandlerMap`); no
  contract surface — types come from `@rntme/contracts-handlers-v1` and the
  `module.json` shape from `@rntme/contracts-module-v1`. Authors copy this
  package as a starting point rather than depending on it. →
  `packages/tooling/module-scaffold/README.md`.
- **`@rntme/contracts-module-v1`** — JSON shape of `module.json`
  (manifest schema, types, `parseModuleManifest`). All loaders/composers
  depend on this; modules implement it via their `module.json`. →
  `packages/contracts/module/v1/README.md`.
- **`@rntme/contracts-provisioner-v1`** — Provisioner runtime contract:
  `ProvisionerContract`, `ProvisionerInput`/`Output`, `ProvisionerLog`,
  `ProvisionerVendorError`, env-mapping types. Leaf, types-only.
  `@rntme/deploy-core` implements; vendor modules with a provisioner block
  code against it. →
  `packages/contracts/provisioner/v1/README.md`.
- **`@rntme/contracts-client-runtime-v1`** — Browser-side platform contract:
  `ModuleBootContext`, hooks/providers, operation registry, transport chain,
  visibility evaluator, and router helpers. UI-bearing modules import this
  package; `@rntme/ui-runtime` hosts concrete instances and SPA bootstrap. →
  `packages/contracts/client-runtime/v1/README.md`.
- **`@rntme/contracts-handlers-v1`** — Code-command-handler runtime contract:
  `CodeCommandHandler`, `CodeCommandHandlerMap`, structurally-minimal
  `CommandExecutionContext` / `CommandExecutorOutput`. Leaf, types-only.
  Modules code their handlers against it; `@rntme/runtime` re-exports the
  same names and a drift gate in `runtime-compat.test.ts` pins the runtime's
  richer ctx assignable to the contract. →
  `packages/contracts/handlers/v1/README.md`.
- **`@rntme/deploy-core`** — Target-neutral project deployment
  planning from a validated/composed project model. Preview MVP only; no
  raw blueprint loading. The platform executor consumes project-version
  bundles, revalidates them, and calls this planner. →
  `packages/deploy/deploy-core/README.md`.
  Provision-phase surface: `runProvisioners`, `ProvisionerContract`, `resolveEnvMappings`, `DEPLOY_PROVISION_ERROR_CODES`.
- **`@rntme/deploy-dokploy`** — Dokploy target adapter: render/apply
  redacted deployment plans through the Dokploy HTTP API. Deploy target
  credentials are stored encrypted by `platform-storage`, not in rendered
  plans. →
  `packages/deploy/deploy-dokploy/README.md`.
- **`@rntme/cli`** — CLI binary and agent skill source bundle. →
  `apps/cli/README.md`.
- **`@rntme/platform-http`** — Platform HTTP/UI app and deployment executor. →
  `apps/platform-http/README.md`.
- **`@rntme/landing`** — Public landing site. →
  `apps/landing/README.md`.

Canonical contracts:

- **`@rntme/contracts-common-v1`** — Shared cross-category protobuf
  primitives (`CanonicalRef`, `CommandContext`, `Name`, `ListRequest` /
  `Filter` / `Sort` / `ListResponseMeta`, `Metadata`). Imported by every
  category contract package.
  → `packages/contracts/_common/v1/README.md`.
- **`@rntme/contracts-ai-llm-v1`** — Canonical AI/LLM contract:
  protobuf `AiLlmModule` service, Completion, AssistantThread, AsyncJob,
  sixteen CloudEvents payloads, MCP-shape tools, and
  `AI_LLM_<LAYER>_<KIND>` error codes. Implemented by AI/LLM-category
  vendor wrappers.
  → `packages/contracts/ai-llm/v1/README.md`.
- **`@rntme/contracts-identity-v1`** — Canonical Identity contract:
  protobuf `IdentityModule` service, six entities, seventeen CloudEvents
  payloads, `IDENTITY_<LAYER>_<KIND>` error codes. Implemented by
  Identity-category vendor wrappers (Clerk / Auth0 / WorkOS).
  → `packages/contracts/identity/v1/README.md`.
- **`@rntme/contracts-crm-v1`** — Canonical CRM contract: protobuf
  `CrmModule` service, Contact / Company / Deal / Activity / Note /
  AsyncJob aggregates, helper read models, twenty-one CloudEvents
  payloads, `CRM_<LAYER>_<KIND>` error codes. Implemented by
  CRM-category vendor wrappers.
  → `packages/contracts/crm/v1/README.md`.

Modules tree (vendor implementations):

- **`modules/<category>/`** — Category container. Holds the category
  README and a `conformance/` workspace package. Vendor modules live as
  `modules/<category>/<vendor>/` (e.g. `modules/identity/auth0/`).
  Presentation, analytics, and identity modules can contribute UI through
  `module.json#client`; identity modules are mixed modules because they
  also expose backend canonical contract capabilities.
- **`modules/crm/`** — CRM category root: README + `conformance/` workspace package.
- **`modules/crm/conformance/`** — Workspace package `@rntme/conformance-crm`: 34
  scenario stubs + fixtures (incl. amoCRM URL-encoded webhook). →
  `modules/crm/conformance/README.md`.
- **`modules/crm/bitrix24/`** — Workspace package `@rntme/crm-bitrix24`: Bitrix24
  vendor module for `@rntme/contracts-crm-v1`, backed by the official
  `@bitrix24/b24jssdk` SDK. → `modules/crm/bitrix24/README.md`.
- **`@rntme/conformance-identity`** — Per-RPC conformance scenarios for
  the Identity canonical contract. Drift-tested against
  `service IdentityModule`. Imported by every Identity vendor module.
  → `modules/identity/conformance/README.md`.
- **`modules/ai-llm/`** — AI/LLM category root: category README plus
  `conformance/` workspace package for shared scenarios and fixtures.
- **`modules/ai-llm/conformance/`** — Workspace package
  `@rntme/conformance-ai-llm`: 14 per-RPC scenario stubs, typed fixtures,
  drift tests against `service AiLlmModule`.
  → `modules/ai-llm/conformance/README.md`.
- **`@rntme/conformance-ai-llm`** — npm name for the package above (same
  relationship as `@rntme/conformance-identity` ↔ `modules/identity/conformance/`).
- **`demo/notes-blueprint`** — Canonical project-shape example
  (`project.json` + project-level PDM + services).

## 4. Project-wide conventions

- **`Result<T>` everywhere.** Shape: `{ ok: true; value: T } | { ok:
  false; errors: E[] }`. No exceptions in validation pipelines. Error
  recovery uses `isOk` / `isErr` helpers re-exported from each package.
- **Branded `Validated*` types.** Each validation pipeline produces a
  phantom-branded type (`StructurallyValid`, `ValidatedPdm`,
  `ValidatedBindings`, etc.). Constructible only by running the
  validator. Downstream APIs accept only the branded type — casting is
  an anti-pattern (§7).
- **Error codes.** Format: `<PKG>_<LAYER>_<KIND>`. Stable across
  releases. Append new codes; never reorder or delete. The registry
  per package is exported as `ERROR_CODES` and lives in
  `src/types/result.ts`.
- **No exceptions across package boundaries.** Inside a package, a
  runtime helper may throw; at the public API the exception becomes a
  `Result.err` with a code.
- **SQLite forever.** Target dialect is SQLite ≥ 3.30. Scale-out is via
  Turso (SQLite-compatible Rust rewrite), not Postgres. Do not
  introduce a Postgres-specific code path (§7).
- **Authoring artifacts are JSON.** No YAML, no TOML. Rationale in
  `docs/superpowers/specs/done/2026-04-14-bindings-design.md` and
  `docs/superpowers/specs/done/2026-04-13-graph-ir-sql-compiler-mvp-design.md`.
- **Layered validation.** Each artifact runs parse (Zod) → structural
  (no resolvers) → reference/cross-ref (resolver-based) →
  consistency/feature-gate. Every layer fails fast; the orchestrator
  returns the first layer's errors only.
- **MVP gates.** Many rc7 features parse but are validator-rejected.
  Each package's "Out of scope" section lists them.
- **Test categories.** `unit/`, `integration/`, `e2e/`, `golden/` under
  each `test/` directory. All tests run via Vitest (`vitest run`).
- **Compile target.** ESM, TypeScript `strict`, Node 20. `tsc` per
  package — no bundler except `ui-runtime`'s esbuild SPA build.

## 4.1 Layering enforcement

The §3 package layering is not a convention — it is mechanically
enforced by [`dependency-cruiser`](https://github.com/sverweij/dependency-cruiser).
The config lives at the repo root in `.dependency-cruiser.cjs` and is
invoked via `pnpm depcruise` (locally and in CI; see §5). CI fails the
build if any rule reports an `error`. The rules:

| Rule | From | To (forbidden) | Why |
| --- | --- | --- | --- |
| `modules-only-import-contracts` | `modules/**` | `packages/**` except `packages/contracts/**` | Vendor modules are plug-ins by contract; a module reaching into runtime/artifacts/deploy/platform/tooling is a layering bug. |
| `contracts-must-stay-leaves` | `packages/contracts/**` | any other workspace package or any `modules/**` | Contracts are the sealed surface every consumer depends on. A contract that depends back on an implementation creates a cycle by construction. |
| `tooling-only-imports-contracts` | `packages/tooling/**` | `packages/{runtime,artifacts,deploy,platform}/**` | Scaffolding ships examples for module authors; it must not pull production code into their graph. |
| `artifacts-must-not-import-runtime` | `packages/artifacts/**` | `packages/runtime/**` | Artifacts describe *what* the runtime executes. The arrow runs the other way. |
| `deploy-must-not-import-runtime` | `packages/deploy/**` | `packages/runtime/**` | Deploy plans/applies deployments. Anything it needs from runtime must be lifted into a contract. |
| `no-circular` | any | any (circular) | Cycles defeat tree-shaking, confuse build order, and almost always indicate a missing seam. |

Every rule has `severity: 'error'`. **Never** introduce `severity:
'warn'` — pre-stable (see CLAUDE.md "Non-obvious conventions") an
unenforced rule is just noise. If a genuinely justified exception comes
up, encode it as a named `pathNot` carve-out on the rule with a
comment that links to the spec or PR explaining the carve-out;
unjustified exceptions get rejected in review.

The rules are manually negative-tested as part of the dep-cruiser
introduction PR (see
`docs/superpowers/specs/2026-05-04-platform-contracts-extraction-design.md`,
PR 6) — adding or modifying a rule requires the same proof-of-fire
discipline.

## 5. Build / test / lint

| Command | Effect |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install deps (pnpm 9.12.0+) |
| `pnpm -r run build` | Run `tsc` in every package |
| `pnpm -r run typecheck` | Typecheck-only pass |
| `pnpm -r run test` | Vitest in every package |
| `pnpm -r run lint` | ESLint across `src/` and `test/` |
| `pnpm depcruise` | `dependency-cruiser` layering check (rules in `.dependency-cruiser.cjs`; see §4.1) |
| `pnpm -F @rntme/<pkg> test:watch` | Watch mode for one package |

CI runs `build → typecheck → test → lint → depcruise → vendor:check`
on push and PRs to `main`.

## 6. How to do common tasks

Each entry names the entry file, the spec to read first, and the
concrete steps. See each package README's "Where to look first" for
deeper, per-task pointers.

### 6.0 Add a UI module (client-only extension)

1. Read `docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md` §10–11, `packages/contracts/client-runtime/v1/README.md` for browser hooks/boot APIs, and `packages/tooling/module-scaffold/README.md` for the module package shape.
2. Create `modules/<category>/<vendor>/` with `package.json`, `module.json`, and `src/client.ts` (or `src/client.tsx`) exporting `./client` from `package.json` `exports` (include `"./module.json": "./module.json"` for compose resolution).
3. Add the package to the root `pnpm-workspace.yaml` glob if a new path is needed (`modules/*/*` already covers nested vendors).
4. Wire the module in the consumer `project.json` under `modules` (object form). If the manifest declares `category`, the project key **must** match that category string.
5. Run `pnpm -F @rntme/blueprint test` on a fixture that references the module to verify catalog + UI validation + virtual entry emission.

### 6.1 Add a new graph operator

1. Read `packages/artifacts/graph-ir-compiler/README.md` "Where to look first".
2. Read `graph_ir_rc_7.md` for IR semantics of the operator family.
3. Add the operator's shape to `src/parse/schema.ts` (Zod).
4. Extend the semantic-plan stage (`src/semantic-plan/`) if the
   operator affects plan structure.
5. Add a lowering rule under `src/lower/sqlite/`.
6. Wire a case into `src/emit/emit.ts` if the operator emits SQL.
7. Add a golden test under `test/e2e/` and a unit test for the lowering
   function.
8. Spec first: `docs/superpowers/specs/done/2026-04-13-graph-ir-sql-compiler-mvp-design.md`.

### 6.2 Add a new projection backing

1. Read `packages/artifacts/qsm/README.md` and
   `packages/runtime/projection-consumer/README.md`.
2. Extend `QsmArtifactSchema` in `packages/artifacts/qsm/src/parse/schema.ts` with
   the new `backing` variant.
3. Add a validator rule in `packages/artifacts/qsm/src/validate/structural.ts`.
4. Extend `deriveProjectionHandler` in
   `packages/artifacts/qsm/src/derive/handler.ts` and `compileApplyPlan` in
   `packages/runtime/projection-consumer/src/apply/compile.ts`.
5. Add cross-ref check in
   `packages/artifacts/qsm/src/validate/cross-ref.ts` if the backing references
   PDM.
6. Spec first: `docs/superpowers/specs/done/2026-04-14-mutations-design.md`
   §6.

### 6.3 Add a new HTTP binding kind

1. Read `packages/artifacts/bindings/README.md` and
   `packages/runtime/bindings-http/README.md`.
2. Extend `BindingKind` in `packages/artifacts/bindings/src/types/artifact.ts`.
3. Update `parse/schema.ts` default and `validate/structural.ts`
   method rules.
4. Update the kind × role matrix in
   `packages/artifacts/bindings/src/validate/consistency.ts`.
5. Extend `BindingPlan` union in `packages/runtime/bindings-http` and add a
   handler in `runtime/`.
6. Add OpenAPI emission rules in `packages/artifacts/bindings/src/openapi/`.
7. Specs first: `docs/superpowers/specs/done/2026-04-14-bindings-design.md`
   and `docs/superpowers/specs/done/2026-04-14-bindings-http-design.md`.

### 6.4 Add a new event-store driver

No precedent in the codebase yet — the only concrete driver is
`SqliteEventStore`. Read
`packages/runtime/event-store/README.md` (the `EventStore` interface and
contract) and `packages/runtime/runtime/README.md`'s plugin-seam section for
the closest analog (`DbDriver`). The new driver should implement the
exported `EventStore` interface and pass the same regression suite
under `packages/runtime/event-store/test/`.

### 6.5 Add a new field type to PDM

1. Read `packages/artifacts/pdm/README.md`.
2. Extend the `FieldType` enum in
   `packages/artifacts/pdm/src/types/artifact.ts`.
3. Update `parse/schema.ts`, `validate/structural.ts`, and
   `resolvers/pdm-resolver.ts`.
4. Update QSM mirror DDL in
   `packages/artifacts/qsm/src/derive/ddl.ts` and the graph-ir-compiler's
   lowering in `packages/artifacts/graph-ir-compiler/src/lower/sqlite/`.
5. Update `packages/artifacts/bindings/src/openapi/shapes.ts` for the JSON-schema
   mapping.
6. Spec first: `docs/superpowers/specs/done/2026-04-14-mutations-design.md`.

### 6.6 Wire a new package into the runtime

1. Read `packages/runtime/runtime/README.md`, specifically the plugin-seam
   table and the boot-order invariant.
2. If the package is a new backing (driver/bus/surface), implement the
   corresponding interface in
   `packages/runtime/runtime/src/plugins/interfaces.ts`.
3. Register the default implementation in the relevant
   `packages/runtime/runtime/src/plugins/*.ts`.
4. Update the manifest schema if the package needs declarative
   configuration (`packages/runtime/runtime/src/manifest/schema.ts`).
5. Add an entry to the plugin-seam contract suite in
   `packages/runtime/runtime/src/plugins/contract-tests.ts`.
6. Spec first:
   `docs/superpowers/specs/done/2026-04-15-runtime-packaging-design.md`.

### 6.7 Add a new spec

1. Use the writing-plans / brainstorming skills to frame the change.
2. Place the spec file under `docs/superpowers/specs/` using the
   `YYYY-MM-DD-<slug>-design.md` naming convention.
3. Cross-link it from the relevant per-package README's "Specs"
   section.
4. Update this file (§8) if the spec documents a decision that agents
   will look for later.

### 6.8 Reproduce a failing CI test

1. From the workspace root, `pnpm -F @rntme/<pkg> test` to narrow the
   failure to one package.
2. Re-run with `test:watch` and open the file reported.
3. Most fixtures live under `packages/<pkg>/test/fixtures/`;
   the per-package README "Where to look first" names the test
   families.

### 6.9 Add a platform module (code-executor-based integration service)

1. Read `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` (§5 module pattern, §12 contract).
2. Copy `packages/tooling/module-scaffold/` to `packages/<module-name>/` and update `package.json#name`.
3. Replace `src/handlers.ts` with your vendor-specific handlers; add vendor SDK to dependencies.
4. Use `CodeCommandExecutor` from `@rntme/runtime` to wire handlers in your module's bootstrap.
5. Follow the health-check convention in `packages/tooling/module-scaffold/README.md`.

### 6.10 Expose a service over gRPC

1. Read `packages/runtime/bindings-grpc/README.md` and spec §6.2.
2. In `artifacts/manifest.json`, add:

```json
"surface": {
  "http": { "enabled": true, "port": 3000 },
  "grpc": { "enabled": true, "port": 50051 }
}
```

3. Boot the service. The runtime uses `manifest.service.name` to derive `packageName` (`rntme.<name>.v1`) and `serviceName` (`<Name>Service`).
4. To obtain the `.proto` file for client codegen: instantiate `emitProto(validated, shapes, { packageName, serviceName })` in a one-off script, or (later) via `rntme-runtime emit-proto <serviceDir>` (follow-up).
5. `CommandExecutor` / `QueryExecutor` are the same seam as HTTP; domain services don't change anything to add gRPC.

### 6.11 Call a module via pre-fetch from a command binding

1. Read spec §7 and `packages/runtime/bindings-http/src/pre/` source.
2. Declare the module in `artifacts/manifest.json`:

```json
"modules": [
  { "name": "payments", "grpc": { "address": "payments:50051" }, "protoPath": "protos/payments.proto" }
]
```

3. Copy the module's `.proto` into `artifacts/protos/`.
4. In `artifacts/bindings.json`, add `pre[]` to a command binding:

```json
{
  "kind": "command",
  "graph": "createOrder",
  "http": { "method": "POST", "path": "/commands/createOrder", "parameters": [...] },
  "pre": [
    { "kind": "module-rpc", "module": "payments", "rpc": "CreateCheckoutSession",
      "input": { "customerId": "$body.customerId", "amount": "$body.amount" },
      "bindAs": "session" }
  ]
}
```

5. Reference `$pre.session.url` in the graph's emit payload to bake the vendor result into the event.
6. HTTP retries are safe: pass `Idempotency-Key` header from the client; the cache survives process restarts in `persistent` mode.
7. Invariants enforced by validator: `pre.length ≤ 2`, unique `bindAs`, `module` declared in manifest, `kind: command` only.

### 6.12 Define a vendor-callback endpoint (OAuth redirect, magic link, hosted checkout return)

1. Read spec §8.
2. In `artifacts/bindings.json`, add a command binding with:

```json
{
  "kind": "command",
  "graph": "completeFlow",
  "http": { "method": "GET", "path": "/oauth/<vendor>/callback", "parameters": [] },
  "inputFrom": {
    "state": { "from": "query", "name": "state", "required": true },
    "code":  { "from": "query", "name": "code",  "required": true }
  },
  "response": {
    "onOk":  { "redirect": "/app/settings?connected=1", "status": 302 },
    "onErr": { "redirect": "/app/errors/{$error.code}" }
  }
}
```

3. Make the `completeFlow` command graph read your `pending_flow` projection as a read-prelude (state→flow lookup), do a `pre[]` RPC to exchange the vendor code, and emit `FlowCompleted`.
4. Validator invariants: GET is allowed only when `response.onOk` or `response.onErr` is a redirect. `inputFrom.<name>` must equal a graph input. `inputFrom.body` / `form` are not allowed on GET.
5. Redirect templates support `{$result.field}` / `{$error.field}` substitutions. Omit `status` to default to 302.
6. Callback endpoint **lives on the domain service**, not the module — see spec §8.5.

### 6.13 Compose a multi-service project

1. Read `packages/artifacts/blueprint/README.md` and `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`.
2. Lay out the project blueprint folder: `project.json`, `pdm/`, `services/<name>/...`, and `modules/<name>/...`.
3. Validate with `loadProjectBlueprint(...)`; the validator surfaces composition errors such as missing services in routes, missing PDM ownership, and duplicate paths.
4. Compile the project-routed binding registry and verify the expected service prefixes resolve.
5. Until project-level runtime intake lands, run individual services with `@rntme/runtime` as before.

### 6.14 Deploy a project via Dokploy

1. Read `packages/deploy/deploy-core/README.md`, `packages/deploy/deploy-dokploy/README.md`, and `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md`.
2. Publish the blueprint version with the CLI: `rntme project publish --org <org> --project <project> <folder>`.
3. Start deployment through the platform control plane: `rntme project deploy --org <org> --project <project> --version <seq> --target <target-slug>`.
4. Observe it with `rntme project deployment watch --org <org> --project <project> <deployment-id>` or inspect history with `project deployment list/show`.
5. The platform executor, not the CLI, decrypts target credentials and calls `planDeployment(...)`, `renderDokployPlan(...)`, and `applyDokployPlan(...)`.
6. CLI tenancy resolution order is flag → env (`RNTME_ORG`/`RNTME_PROJECT`/`RNTME_SERVICE`) → `rntme.json` → credentials profile defaults (`defaultOrg`/`defaultProject`); persist defaults with `rntme login --token <pat> [--org <slug>] [--project <slug>]`.

### 6.15 Wire Auth0 into a project blueprint

1. Read `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md` §5-§9 and use `demo/notes-blueprint/` as the worked example.
2. Add an Identity integration module service, for example `services/identity-auth0/service.json` with `kind: "integration-module"`, and include it in `project.json#services`.
3. Add `project.json#middleware.auth` with `kind: "auth"`, `provider: "auth0"`, `audience`, and `moduleSlug`, then mount it only on protected HTTP routes.
4. Add `pre[]` to protected bindings: call `identity-auth0.IntrospectSession`, pass the Authorization header token and the same audience, and bind the canonical `Session` as `session`.
5. Reference `$pre.session.user_id` in Graph IR for owner writes or guards. Do not use vendor-specific `subject_id`; Auth0 `sub` is carried through canonical `Session.user_id`.
6. Keep secrets out of blueprints. Auth0 domain/client/audience public browser config is deploy-rendered; Auth0 and Redpanda secret values live in deploy target/Dokploy secret refs.

### 6.15a Add a new identity provider

1. Read `docs/superpowers/specs/2026-04-30-notes-demo-auth0-migration-design.md` and mirror `modules/identity/auth0/`.
2. Scaffold `modules/identity/<vendor>/` with the standard module package layout plus a `client/` subtree.
3. Declare every required public browser config key in `module.json#client.config.schema`.
4. Declare `"contract": "identity"` inside the `client` block. The runtime uses this to engage the identity-aware boot fallback (`/auth/status = 'anon'` if `boot()` crashes before setting it). The conformance test in `@rntme/module-scaffold` enforces this on every identity vendor that ships a client block.
5. Implement `client/index.ts#boot(ctx)` with `ModuleBootContext` from `@rntme/contracts-client-runtime-v1` so it registers a Bearer transport middleware via `ctx.transport.use`, writes `/auth/status` and `/auth/user` to `ctx.state`, and registers module operations through `ctx.registerOperation`.
6. Export `client/components/LoginScreen.tsx` and `client/components/UserBadge.tsx` by name from `client/index.ts`, then register them in `module.json#client.components`.
7. In the consuming project, declare the provider under `project.json#modules.identity` with a package name whose manifest vendor matches `project.json#middleware.auth.provider`.
8. Gate anonymous and authenticated layout branches with `visible: { "$state": "/auth/status", "eq": ... }`; do not fetch authenticated screen data while the screen root is invisible.

**Two transports.** Identity modules consumed by `kind: "auth"` middleware MUST expose `IntrospectSession` via two transports: gRPC (for runtime pre-step calls) and HTTP `GET /introspect` (for edge `auth_request`). Both wrap the same in-process handler. The module declares its HTTP port via `module.json#capabilities.edgeAuth.port` (default `50052`); deploy planning fails with `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` if a module targeted by an auth middleware does not declare this. See `packages/contracts/identity/v1/README.md#http-introspection-transport`.

### 6.16 Add a category contract package

A category contract is a versioned protobuf surface implemented by every vendor module in that category (Identity, Payments, …). To add one:

1. Create `packages/contracts/<category>/v1/` following the layout in
   `packages/contracts/identity/v1/` (the reference implementation):
   `package.json`, `tsconfig.json`, `tsconfig.check.json`,
   `eslint.config.mjs`, `proto/`, `scripts/gen.mjs`, `src/index.ts`,
   `error-codes.json`, `README.md`.
2. Workspace globs already cover `packages/contracts/*/v*` — no
   `pnpm-workspace.yaml` edit needed.
3. Depend on `@rntme/contracts-common-v1` for shared primitives. Do not
   inline `CanonicalRef`, `CommandContext`, `Name`, `ListRequest`, or
   `Metadata` — drift between categories breaks blueprint validation.
4. Define entities and a single `service <Category>Module` block.
5. Generate bindings: `pnpm -F @rntme/contracts-<category>-v1 run proto:gen`.
6. Cover every entity / enum / event / error-code with vitest
   round-trip tests, plus a service-shape test that asserts the exact
   RPC list.
7. Run the canonical lint: every error code must match
   `<CATEGORY>_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z0-9_]+`.
8. Documentation-touch: add to AGENTS.md §3 (this section), §10
   (glossary), and the root README packages table.

Spec reference: `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` is the worked example of a category contract.

### 6.17 Add an Identity vendor module

The first vendor module is shipped by a separate brainstorm + plan
(spec: TBD). When that lands, the steps will be:

1. Copy `packages/tooling/module-scaffold/` to `modules/identity/<vendor>/`.
2. Implement `service IdentityModule` from
   `@rntme/contracts-identity-v1` against the vendor's SDK.
3. Declare supported RPCs and events in `module.json#capabilities[]`.
4. Wire conformance: `import { identityConformanceSuite } from
   '@rntme/conformance-identity'` and run it through the framework
   runner (`@rntme/conformance-framework`, slated for modules-monorepo
   plan 1).
5. Pass mock-conformance on every PR; pass live-conformance on release
   tag.

Until that brainstorm lands, stop here — do NOT freelance an
implementation, because it would freeze a vendor-shaped contract before
the vendor selection (Clerk vs WorkOS vs …) is recorded in a spec.

### 6.18 Add an AI/LLM vendor module

The first AI/LLM vendor module is shipped by a separate brainstorm + plan.
When that lands, the steps will mirror Identity:

1. Copy `packages/tooling/module-scaffold/` to `modules/ai-llm/<vendor>/`.
2. Implement `service AiLlmModule` from `@rntme/contracts-ai-llm-v1`
   against the vendor's SDK (or gateway routing).
3. Provide an idempotency dedup-store (in-memory, Redis sidecar, or Postgres) with
   ≥24h TTL — major LLM vendors do not provide native idempotency.
4. Implement a webhook receiver for AsyncJob status callbacks (e.g. OpenAI Standard
   Webhooks for Batch API; Bedrock EventBridge for batch), verifying
   signatures and deduping before emitting canonical CloudEvents.
5. Declare supported RPCs, events, and the eight capability dimensions in
   `module.json#capabilities[]` (see `modules/ai-llm/README.md` for the
   decision tree).
6. Wire conformance: `import { aiLlmConformanceSuite } from
   '@rntme/conformance-ai-llm'` and run it through the shared framework runner
   (`@rntme/conformance-framework`, when it lands).
7. Pass mock-conformance on every PR; pass live-conformance on release tag
   (live mode requires API keys in a secret store).

Reference the canonical contract at `packages/contracts/ai-llm/v1/` and the
conformance suite at `modules/ai-llm/conformance/`.


### 6.19 Add a CRM vendor module

The pattern is the same as Identity / AI-LLM vendor modules but with the CRM canonical contract. Each vendor lands at `modules/crm/<vendor>/` with:

1. A handler implementation against `proto.rntme.contracts.crm.v1.CrmModule`. SaaS module wraps one CRM vendor; multi-CRM gateway proxies to many.
2. An idempotency dedup-store (in-memory, Redis sidecar, or Postgres) with ≥24h TTL — mandatory because most CRM vendors do not provide native idempotency on create/update.
3. A webhook receiver that handles the vendor's specific payload format. Most vendors send JSON; **amoCRM is the unique exception** — it sends `application/x-www-form-urlencoded` with bracket-notation nested keys (`leads[update][0][id]`). Use `qs` or equivalent for bracket-path decode.
4. **Special vendor quirks to map in the error-mapper:**
   - **Bitrix24** returns `HTTP 200 + body {"error":"QUERY_LIMIT_EXCEEDED"}` instead of HTTP 429. Adapter MUST parse body before status code.
   - **Bitrix24** does not retry webhooks (`webhook_retry_policy: "none"`). Use `event.offline.get` + `SyncDelta` for recovery.
   - **amoCRM** rotates refresh tokens on every refresh. Atomic save of new (access, refresh) pair is mandatory.
   - **Pipedrive** custom fields use 40-char hex hashes as keys; module's `FieldMapping` table is mandatory.
   - **Salesforce** custom fields use `__c` suffix; same FieldMapping pattern.
5. A `module.json` manifest declaring all ten capability fields (see `modules/crm/README.md` for the decision tree).
6. Vendor-specific extensions in `<vendor>-extensions.proto` if the vendor has features not in canon (Bitrix24 Smart Processes, SF Composite API graph, HubSpot Journal API v4 pull mode, etc.).
7. Conformance scenarios passing under both mock-vendor and live-sandbox modes (live mode requires API keys in a secret store).

Reference the canonical contract package at `packages/contracts/crm/v1/` and the conformance suite at `modules/crm/conformance/`.

Recommended first vendor: `module-crm-bitrix24` (RU P0 priority — 57.5% RU market, 152-FZ data-residency).


### How to ship a module with a provisioner

- **How to ship a module with a provisioner.** Module's `package.json` chains
  `pnpm run build:provisioner` after `tsc`, with the script
  `esbuild dist/<name>.js --bundle --platform=node --format=esm --target=node20 --external:node:* --outfile=dist/<name>.entry.js`.
  The provisioner source must keep `@rntme/contracts-provisioner-v1` as
  `import type` only; TSC strips type-only imports so esbuild never sees them.
  Point `module.json#provisioner.entry` at the bundled file. CLI publish embeds
  the file as a base64 asset; platform-http imports it from the materialized
  `tmpDir`.

### How to add a provisioner to a module

1. Implement `provision(input): Promise<Result<ProvisionerOutput, ProvisionerVendorError>>` (and optional `tearDown`) in `<module>/src/provisioner.ts`. Import `ProvisionerContract` from `@rntme/contracts-provisioner-v1` (types only — the leaf contract package). `resolveEnvMappings` and the runtime helpers stay on `@rntme/deploy-core`.
2. Add a `provisioner` block to the module's `module.json`. Declare every output you return in `produces[]` (with `kind` and `secret`); declare every credential blob you read in `requires[]`.
3. Register the `requires[].schema` ids in `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts` if not already registered.
4. Export an `ENV_MAPPINGS` constant from the same file if your outputs need to land as env vars on rendered resources.
5. Add a unit test that runs `provision()` twice in a row and asserts the second call issues zero mutating upstream calls (idempotence).
6. The conformance test in `packages/deploy/deploy-core/test/conformance/provisioner-contract.test.ts` will pick up the new module automatically if it is wired in `modules/<category>/<vendor>/`.

### How to add a target-secret schema

1. Add a zod schema entry to `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts` with a stable, versioned id (e.g. `stripe-restricted-key-v1`).
2. Reference the id in any module manifest's `provisioner.requires[].schema`.
3. Operators write the secret via `PUT /v1/orgs/:org/deploy-targets/:slug/secrets/:name` with `{ schema, value }` body. The platform validates `value` against the registered schema; `value` is never returned by GET.

### Declare a var that resolves from provisioner output

When a service needs a value the provisioner creates at deploy time (e.g., a freshly-issued OAuth client id):

1. In the module manifest, declare the output: `module.json#provisioner.produces: [{ name: "spaClient", kind: "single", secret: false }]`.
2. The provisioner's `provision()` function returns it under `publicOutputs.spaClient` (or however the produces shape is structured).
3. In the blueprint `project.json`, use the new var source:

```json
"vars": {
  "AUTH0_SPA_CLIENT_ID": { "from": "provision.identity.spaClient.id", "required": true }
}
```

   `identity` is the local module key from `project.json#modules`. `spaClient` matches `produces[].name`. `.id` is a JSON pointer into `publicOutputs.spaClient`.
4. Use `${AUTH0_SPA_CLIENT_ID}` inside any `publicConfig`/manifest field. The plan substitutes it after the provisioner runs.

The pipeline runs `provision → plan → render`, so by the time render bakes `config.json` the SPA client id is already known.

### Update a vendored module in a demo blueprint

When `modules/<category>/<vendor>/` changes, the demo blueprint's vendored copy must follow.

1. Edit `modules/<category>/<vendor>/`.
2. Build the module: `pnpm -F <pkg-name> build` (produces `dist/`, including `dist/provisioner.entry.js` if the module declares a `provisioner` block).
3. Run `pnpm vendor:sync` from the workspace root. This copies `module.json` and `package.json` from the source-of-truth to every `demo/<bp>/node_modules/<vendored-dir>/` whose `package.json#name` matches.
4. Commit both the source change and the vendored copy in the same PR.

CI runs `pnpm vendor:check`. PRs that edit `modules/` without re-vendoring fail the check with a clear error message pointing at the drifted file.

`dist/` is gitignored on both source and vendored sides — only `module.json` and `package.json` are tracked. Local builds (or fresh `pnpm install` followed by `pnpm -r build`) materialize `dist/` for both copies.


## 7. Anti-patterns / do not do

- Do not bypass `Validated*` brands by casting (`as ValidatedPdm`).
  The brand is the validator's one-way handshake.
- Do not introduce a Postgres dialect path. SQLite is the target; Turso
  is the scale-out story. Postgres-specific SQL breaks the compiler's
  `lower/sqlite/` assumptions.
- Do not skip a validation layer because "the input is trusted". Layers
  exist in a specific order for a reason; skipping them loses error
  messages downstream consumers expect.
- Do not catch and swallow errors in the `Result` pipeline. If a layer
  returns `err`, propagate it.
- Do not create new packages without updating §3 (package layering) and
  the root README.
- Do not edit specs under `docs/superpowers/specs/` to match a code
  bug. The specs are the source of truth; fix the code. Note:
  `graph_ir_rc_7.md` is historical (first-step IR spec, superseded by
  later specs) — not canon, do not cite it as such.
- Do not delete or renumber error codes. Consumers rely on them. Append
  new codes; deprecate in comments if needed.
- Do not write new authoring formats (YAML, TOML) for any artifact.
- Do not inline specs into READMEs. Link to the spec path and let the
  reader open it.
- Do not add line numbers to README "Where to look first" pointers.
  Lines drift; function and file names are stable.
- Do not write or merge an implementation plan whose code changes
  affect documentation surfaces without a documentation-touch task.
  The "specs are source of truth, code that disagrees is a bug" rule
  inverts when the docs themselves drift. See §11 for the doc-touch
  checklist; see
  `docs/superpowers/specs/done/2026-04-26-docs-refresh-after-project-first-pivot-design.md`
  for what un-tracked drift cost across the PR-12-to-PR-16 window.

## 8. Where decisions live

Map of "if you're tempted to do X, the decision-doc is Y":

- "Why SQLite, not Postgres?" →
  `docs/superpowers/specs/done/2026-04-15-runtime-packaging-design.md`
  (runtime target) and
  `docs/superpowers/specs/done/2026-04-16-predicate-optional-fix-design.md`
  (dialect-specific lowering).
- "Why entity-mirror only, not derived?" →
  `docs/superpowers/specs/done/2026-04-14-mutations-design.md` §6.
- "Why the four-layer validator for bindings?" →
  `docs/superpowers/specs/done/2026-04-14-bindings-design.md` §4 + §6.
- "Why JSON authoring, not YAML?" →
  `docs/superpowers/specs/done/2026-04-14-bindings-design.md` §12 and
  `docs/superpowers/specs/done/2026-04-13-graph-ir-sql-compiler-mvp-design.md`.
- "Why relations moved from PDM to QSM?" →
  `docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md`.
- "Why the seed lifecycle runs before the relay?" →
  `docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md`.
- "Why `predicate_optional` swaps OR args?" →
  `docs/superpowers/specs/done/2026-04-16-predicate-optional-fix-design.md`.
- "Event-driven architecture — what events, what consumers?" →
  `docs/adr/2026-04-15-event-driven-architecture.md`.
- "Why did blueprint become project-first, and where do project vs service
  responsibilities now live?" →
  `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`.
- "Why deploy via plan→render→apply, not raw CLI?" →
  `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md`.
- "Per-subsystem known gaps" → `docs/gaps/*.md` (pdm, bindings,
  commands-and-transactions, queries-and-projections, infra).
- "Why protobufjs + dynamic proto load vs. static codegen inside the runtime?" →
  `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` §6.2 +
  `packages/runtime/bindings-grpc/README.md`.
- "Why do modules import client/provisioner/manifest contracts instead of
  `ui-runtime`, `deploy-core`, or `module-scaffold`?" →
  `docs/superpowers/specs/2026-05-04-platform-contracts-extraction-design.md`.

## 9. Memory and prior decisions

Auto-memory entries captured during prior sessions may shape current
work. Read the local auto-memory index (per-user, not in the repo) for
the current list; entries document non-obvious invariants, fix
context, and cross-package constraints that are not derivable from the
code alone. Memory may be stale; always re-verify against the current
codebase before relying on it.

Known categorical entries to watch for:

- `rntme_predicate_optional_bug` — `wrapPredicateOptional` SQL
  positional alignment when mixing `predicate_optional` with other
  params. Regression tests live at
  `packages/artifacts/graph-ir-compiler/test/unit/lower/sqlite/predicate-optional.test.ts`
  and `.../test/e2e/predicate-optional.e2e.test.ts`.
- `rntme_turso_target` — future scale-out is Turso, not Postgres.
- `project_platform_vision` — rntme as one per-service runtime inside a
  larger DDD platform; Zeebe owns cross-service sagas.

## 10. Glossary

- **agent_execution_mode** — Capability flag in `module.json` for AI/LLM
  modules: `"delegated"` when vendor SaaS owns the agent loop, `"local"`
  when a module hosts an in-process agent runtime, and `"none"` when the
  module does not implement an Agent surface.
- **Audience** — OIDC/API identifier that the access token was issued for.
  Auth blueprints keep `project.json#middleware.auth.audience` equal to
  every `IntrospectSession` pre-step input audience.
- **Auth middleware** — Project middleware marker with `kind: "auth"`.
  The edge does not verify JWTs; runtime bindings call the configured
  Identity module through `pre[]` and reject inactive sessions.
- **boundary-event-only streaming** — AI/LLM v1 emits CloudEvents only at
  state transitions (`started`, `finished`, `failed`, `requires_action`),
  never per chunk. Future token streaming belongs in a server-streaming
  gRPC RPC; the event log stays for state.
- **Callback binding** — A command binding whose HTTP method is GET and whose `response.onOk` / `response.onErr` is a redirect; used for vendor returns (OAuth, magic links, hosted checkout).
- **Canonical AI/LLM contract** — `@rntme/contracts-ai-llm-v1`: service
  `AiLlmModule`, three aggregates (`Completion`, `AssistantThread`,
  `AsyncJob`), and sixteen events. The wrapper protocol every AI/LLM
  vendor module implements.
- **Canonical contract** — A `packages/contracts/<category>/v<n>/`
  package: protobuf source, generated TS bindings, error-codes
  catalogue, README. Implemented by vendor modules in
  `modules/<category>/<vendor>/`. See spec
  `2026-04-26-modules-monorepo-structure-design.md`.
- **Canonical CRM contract** — `@rntme/contracts-crm-v1`, the CRM
  category's protobuf service, aggregates, event payloads, helper read
  models, and CRM-prefixed error-code catalogue.
- **Capability claim** — A vendor module's declaration in
  `module.json#capabilities[]` of which canonical RPCs and events the
  module supports. Conformance enforces UNIMPLEMENTED for unclaimed
  RPCs; blueprint validator enforces coverage of what blueprints use.
- **Category package** — A `packages/contracts/<category>/v<n>/`
  workspace package, e.g. `@rntme/contracts-identity-v1`. One npm
  package per major version; `v1` and `v2` coexist.
- **Conformance scenarios** — Per-RPC test definitions in
  `modules/<category>/conformance/src/scenarios/`. Each scenario asserts
  shape, idempotency on replay, error-code on negative branches, and
  expected event publication.
- **Custom Field FieldMapping** — CRM module-local mapping between
  logical metadata names and vendor-specific custom-field keys such as
  `UF_CRM_*`, `__c`, or UUID-like property identifiers.
- **delegated thread** — AI/LLM v1 supports stateful conversation only for
  modules whose vendor offers a native stateful API. Modules without it
  declare `capabilities.thread: false` and return `UNIMPLEMENTED` for
  thread RPCs; no module-local emulation.
- **Deployment plan** — Target-neutral redacted descriptor produced by `@rntme/deploy-core` from a composed project; rendered by an adapter (`@rntme/deploy-dokploy`) to a target-specific shape.
- **Executor seam** — `CommandExecutor` / `QueryExecutor` interfaces decoupling bindings-http/grpc from graph-ir execution.
- **QSM** — Query-Side Model. Derived read-side projections on top of
  PDM. Owns relation metadata for JOINs (post 2026-04-16 migration).
- **Graph IR** — Intermediate representation for queries and commands.
  Canonical specs live under `docs/superpowers/specs/` (e.g.
  `2026-04-13-graph-ir-sql-compiler-mvp-design.md`,
  `2026-04-14-mutations-design.md`). `graph_ir_rc_7.md` is the
  historical rc7 language reference — useful for operator-level
  syntax/semantics but not canon.
- **Projection** — A QSM-declared table maintained by the
  projection-consumer. Backing modes: `entity-mirror` (1:1 with a PDM
  entity), `derived` (reserved, not implemented).
- **Envelope** — Event-store record shape: aggregate id, version,
  payload, actor, timestamp, correlation/causation ids.
- **Idempotency cache** — SQLite-backed cache of `(idempotency-key, command-run-id) → response`, 24h TTL, used by HTTP retries.
- **Labeled association capability** — CRM capability flag indicating
  whether a module can persist labels on `Association` edges. Modules
  without native labels reject non-empty labels with
  `CRM_CONSISTENCY_LABELS_NOT_SUPPORTED`.
- **Lead/Deal Schism resolution** — CRM v1 models vendor "lead" versus
  "deal/opportunity" naming differences through `Deal.qualification`
  instead of a separate Lead aggregate.
- **Module** — External integration service declared in `manifest.modules[]`; reached via gRPC; called from a binding's `pre[]`.
- **`@rntme/contracts-module-v1`** — JSON shape of `module.json` (manifest schema, types, `parseModuleManifest`). All loaders/composers depend on this; modules implement it via their `module.json`.
- **`@rntme/contracts-provisioner-v1`** — Provisioner runtime contract: ProvisionerContract, ProvisionerInput/Output, ProvisionerLog, ProvisionerVendorError, env-mapping types. deploy-core implements; modules with provisioner blocks code against it.
- **`@rntme/contracts-client-runtime-v1`** — Browser-side platform contract for module client blocks: ModuleBootContext, hooks/providers, operation registry, transport chain, visibility evaluator, and router helpers. UI modules import this instead of `@rntme/ui-runtime` internals.
- **`@rntme/contracts-handlers-v1`** — Code command handler runtime contract: CodeCommandHandler, CodeCommandHandlerMap, structurally-minimal CommandExecutionContext (`now`, `nextId`, `correlation`), CommandExecutorOutput. Modules code their handlers against this leaf contract; `@rntme/runtime` re-exports the same names and ships a `runtime-compat.test.ts` drift gate so the runtime's richer ctx (with `eventStore`, `qsmDb`, `actor`) remains structurally assignable to the contract.
- **Platform contract** — Leaf package under `packages/contracts/*/v1` that defines a cross-cutting boundary consumed by modules and implemented by platform/runtime packages.
- **Module conformance suite** — Per-category package
  `modules/<category>/conformance/` (e.g. `@rntme/conformance-identity`).
  Holds `Scenario` files keyed by canonical RPC. Drift-tested against
  the canonical contract's service definition; imported by every
  vendor module to run the suite under mock and live modes.
- **MCP-shape tool definition** — `ToolDefinition { name, description,
  input_schema: Struct, strict }`, matching the Model Context Protocol
  shape. Adapter modules convert it into vendor-native tool formats.
- **PDM** — Project Domain Model. The project-level entity/field/relation/
  state-machine artifact shared across services.
- **Pre-step** — A `pre[]` entry on a command binding; either `system` (idempotency-key) or `module-rpc`. Cap of 2 per binding.
- **`$pre` directive** — Graph IR expression directive for reading values
  produced by binding `pre[]` steps, for example
  `{ "$pre": "session.user_id" }`.
- **Project blueprint** — Folder with `project.json` + project-level PDM + per-service artifacts + modules. Canonical authoring/versioning/deploy unit.
- **Project PDM** — PDM artifact at the project level, shared across all services in the project.
- **provisioner** — module-side code that reconciles external state during deploy. Declares `produces[]` (outputs) and `requires[]` (target-secret credentials) in `module.json`.
- **provisioner outputs** — values returned by `provision()`. Public outputs persist as JSONB on `deployment.provisionResult`; secret outputs persist as encrypted ciphertext on `deployment.provisionResultCiphertext`.
- **Result<T>** — `{ ok: true; value: T } | { ok: false; errors: E[] }`.
  The workspace-wide fallible-return contract.
- **CRM helper aggregate AsyncJob** — CRM helper aggregate used for
  long-running `SYNC_FULL` work through `SubmitJob`, `GetJob`,
  `CancelJob`, and `ListJobs`.
- **Root entity** / **Owned entity** — Project-level PDM ownership classification. Root entities have independent lifecycle and identity; owned entities belong under a root entity boundary.
- **schema id** — versioned identifier for a target-secret shape, registered in `target-secrets/schemas.ts`.
- **Vendor extensions proto** — `<vendor>-extensions.proto` inside a
  vendor module's directory. Hosts vendor-specific RPCs that did not
  meet the governance bar (≥2 vendors or archetypal) for canonical.
  Blueprints that depend on these are flagged
  `BLUEPRINT_VENDOR_LOCKED_BY_EXTENSION`.
- **vendor-prefixed model addressing** — AI/LLM `model` field convention
  `<vendor>/<model>`, for example `openai/gpt-4o` or
  `anthropic/claude-sonnet-4-5`. SaaS modules validate the prefix
  against their declared vendor; gateways use it to route upstream.
- **Validated\*** — Phantom-branded type produced by a validator;
  downstream APIs require the brand.
- **Shared common package** — `packages/contracts/_common/v1/`
  (`@rntme/contracts-common-v1`). Cross-category primitives:
  `CanonicalRef`, `CommandContext`, `Name`, `ListRequest`/Filter/Sort,
  `Metadata`. Imported by every category contract.
- **SyncDelta watermark** — Monotonic timestamp returned by CRM
  `SyncDelta`; consumers can pass it as the next `since` value after
  draining the current cursor window.
- **target secret** — encrypted credential blob on `deploy_target`, keyed by name (e.g. `auth0Mgmt`), validated against a registered schema id (e.g. `auth0-mgmt-api-v1`).

- **Seed** — Declarative event-envelope bootstrap applied once per
  database, before the relay starts. Package: `@rntme/seed`.
- **Relay** — The event-store loop that reads appended events and
  publishes them to the Kafka-like bus. At-least-once, cursor-guarded.
- **Surface** — Runtime plugin seam for the HTTP (or equivalent)
  entry point. Default implementation: `HttpSurface` (Hono).
- **DbDriver** / **EventBus** — Runtime plugin seams for storage and
  messaging. Default implementations: `BetterSqliteDriver`,
  `InMemoryBus`.
- **MVP gate** — A spec feature that parses but is validator-rejected
  until its backing implementation lands.

## 11. Documentation maintenance

Every plan that touches code MUST include a final documentation-touch
task or block. The checklist below names the documentation surfaces
that may need updates; review it explicitly during plan-writing and
record the result. **"No docs need updating" is a valid outcome —
but it must be a recorded decision, not an omission.**

The `superpowers:writing-plans` skill produces the implementation plan;
the skill does not enforce this checklist on its own, so plan authors
apply it explicitly during plan self-review.

### 11.1 Doc-touch checklist

For each implementation plan, evaluate:

1. **Per-package `README.md`** — any change to a package's public API,
   error codes, invariants, out-of-scope items, or how-to pointers.
   Sections: API / Invariants & gotchas / Out of scope / Where to look
   first / Specs.
2. **AGENTS.md §3 (package layering)** — any new package, any moved or
   removed package, any changed dependency edge.
3. **AGENTS.md §6 (how-tos)** — any new authoring or operating workflow
   that an agent will look for later.
4. **AGENTS.md §8 (decisions live)** — any decision recorded in a new
   spec; add a "Why X?" → spec link.
5. **AGENTS.md §10 (glossary)** — any new vocabulary readers will
   encounter.
6. **`README.md` packages table / dep graph** — any new package or
   dep edge.
7. **`README.md` "MVP / Tier 1 scope"** — any feature that ships today
   or any new MVP gate that defers a feature.
8. **`README.md` "Design docs"** — any new spec under
   `docs/superpowers/specs/`.
9. **`CLAUDE.md` "Architecture in one paragraph"** — any package
   added/removed/repositioned, any change to plugin seams, any change
   to the artifact set or canonical authoring unit.
10. **`CLAUDE.md` "Product positioning"** — any change to the
    internal/market framings (rare; flag for explicit review).
11. **`docs/architecture.md`** — §3.2 container map for new packages;
    §4 for component-level changes; §6 for new cross-cutting
    abstractions; §5 L4 pointers if new diagnostic functions; §8
    glossary; §7 if observations need re-evaluation.
12. **`vision.md`** — only if the bounded-object framing or the platform
    pillars shift. Most plans will not touch vision.

### 11.2 Plan structure

The doc-touch task can be one task per affected file or a single
batched task — at the plan author's discretion — but it MUST land in
the same PR as the code changes that triggered it. Splitting docs into
a follow-up PR is the failure mode this rule exists to prevent.

When the checklist returns "no docs need updating", record that
explicitly as the doc-touch task body (e.g. *"Doc-touch evaluation:
no surfaces affected. Reasoning: changes are internal to
`packages/foo/src/internal/`; no public API, error codes, or
invariants moved."*).

## 12. Project lifecycle operations

Use the platform lifecycle operation surface for project-level redeploy and
decommission workflows. Do not hand-edit project status in storage except for
debugging a failed migration.

```bash
rntme project update --org <org> --project <project> --version <seq> --target <target> --wait
rntme project delete --org <org> --project <project> --confirm <project> --wait
rntme project operation watch --org <org> --project <project> <operation-id>
```

Rules:

1. Update requires an explicit target; do not rely on default-target fallback.
2. Delete requires exact project-slug confirmation and is blocked by active
   deployments.
3. Only one live operation may exist per project. Wait for it to finish or
   inspect/retry the failed operation before queuing another one.
4. `delete_failed` means teardown failed after the project entered delete
   flow; retry delete after reviewing operation logs.
