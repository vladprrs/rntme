# Artifacts simplification audit

> Snapshot date: 2026-05-08.
>
> **Scope.** Cross-cutting simplification research across all eight packages
> under `packages/artifacts/**`: `bindings`, `blueprint`, `graph-ir-compiler`,
> `pdm`, `qsm`, `seed`, `ui`, `workflows` (~17K LOC TS).
>
> **Method.** Three parallel review passes over the full surface (not scoped
> to recent changes): code reuse / duplication, code quality / over-engineering,
> efficiency / architecture. Findings deduplicated and ranked by ROI. Every
> item cites file paths and line numbers as of commit `b2fbab17`.
>
> **Pre-stable assumption.** Per `memory: project_pre_stable_stage.md`, the
> codebase is pre-revenue with no external users; backward-compat shims and
> deprecated re-exports are not required. Renames and removals are free.

## How to read this document

Findings are grouped by impact tier, not by package. Each entry has:

- **Where** — files / line numbers
- **What** — the duplication or anti-pattern
- **Proposal** — concrete fix
- **Estimated payoff** — LOC removed, perf saved, or architectural clarity

Tier H1 items are mechanical sweeps that touch every package but are
low-risk. Tier H2 items are real perf wins on the boot/compile path. Tier M
items are localized cleanups. Tier L items are one-liners. Section "Did not
survive scrutiny" lists candidates that were considered and rejected with
reasons.

---

## Tier H1 — high-impact mechanical sweeps

### H1.1 `Result<T>` / `ok` / `err` / `isOk` / `isErr` reimplemented in every package

**Where.**
- `packages/artifacts/bindings/src/types/result.ts:11-18`
- `packages/artifacts/blueprint/src/types/result.ts:18-26`
- `packages/artifacts/graph-ir-compiler/src/types/result.ts:19-26`
- `packages/artifacts/pdm/src/types/result.ts:11-18`
- `packages/artifacts/qsm/src/types/result.ts:11-18`
- `packages/artifacts/workflows/src/types/result.ts:11-18`
- `packages/artifacts/ui/src/types/result.ts:64-82`
- `packages/artifacts/seed/src/types.ts:69-71`

**What.** Eight independent copies of the same five-line algebra. The `ui`
package diverges in API: `err(...errors: UiError[])` is variadic where
bindings/pdm/qsm/workflows/etc. use `err(errors[])`. Callers carry the
inconsistency in their head — a real foot-gun.

**Proposal.** Extract `packages/artifacts/_shared/result.ts` (or a tiny
internal `@rntme/artifact-result` package) parameterized by the error type:

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: readonly E[] };
export const ok = <T>(value: T) => ({ ok: true, value }) as const;
export const err = <E>(errors: readonly E[]) => ({ ok: false, errors }) as const;
```

Each package keeps only its `Layer` / `ErrorCode` / `*Error` types and
`ERROR_CODES` table. Migrate `ui` to the non-variadic form (callers already
build arrays before spreading).

**Payoff.** ~70 LOC removed; one consistent failure surface across the
artifact pipeline.

### H1.2 `parseX(input)` boilerplate copy-pasted in 7 packages

**Where.**
- `packages/artifacts/bindings/src/parse/parse.ts:5-37`
- `packages/artifacts/pdm/src/parse/parse.ts:11-44`
- `packages/artifacts/qsm/src/parse/parse.ts:11-44`
- `packages/artifacts/workflows/src/parse/parse.ts:5-42`
- `packages/artifacts/graph-ir-compiler/src/parse/parse.ts:4-34`
- `packages/artifacts/blueprint/src/parse/parse.ts:11-27`
- `packages/artifacts/seed/src/parse.ts:5-26`

**What.** The "string → `JSON.parse` → `safeParse` → map issues to errors with
`path: issue.path.join('.')`" pattern repeats almost verbatim. `pdm/parse.ts`
and `qsm/parse.ts` are word-for-word identical apart from schema name and
error code. `workflows/parse.ts:24-30` is the only one that handles the
`issue.keys` fallback for unrecognized-keys errors.

**Proposal.** A single helper in the shared module:

```ts
parseWithSchema<T, E>(
  input: unknown,
  schema: ZodType<T>,
  buildError: (msg: string, path?: string) => E,
): Result<T, E>
```

Each package's `parse.ts` collapses to a 3-liner. Canonicalize the
`issue.keys` formatting from `workflows/parse.ts`.

**Payoff.** ~150 LOC removed; one path-formatter to evolve.

### H1.3 `loadPdmDir` and `loadQsmDir` are near-identical

**Where.**
- `packages/artifacts/pdm/src/load/load-dir.ts:14-61`
- `packages/artifacts/qsm/src/load/load-dir.ts:15-69`
- and the inner loader inside `packages/artifacts/blueprint/src/load/load-blueprint.ts:50-128`

**What.** Same `existsSync` checks, same `readdirSync` + `JSON.parse(readFileSync(...))`
loop, same error wrap, same try/catch. Differences: the index filename
(`pdm.json` vs `qsm.json`), the leaf directory name (`entities` vs
`projections`), and that QSM also reads a `relations` field from the index.

**Proposal.** A `loadArtifactDir({ indexFile, leafDir, errorCode, parseFn })`
helper in the shared module (see H1.1). Slot the same helper into the
blueprint inner loader.

**Payoff.** ~60 LOC removed; lowers the barrier to adding similar dir-based
loaders for workflows/bindings.

### H1.4 `compile` and `explain` in graph-ir-compiler are 95% identical pipelines

**Where.**
- `packages/artifacts/graph-ir-compiler/src/index.ts:85-159` (`compile`)
- `packages/artifacts/graph-ir-compiler/src/index.ts:187-268` (`explain`)

**What.** Both run the same eight-stage pipeline (`parseAuthoringSpec →
parseGraphIrArtifacts → validateStructural → normalize → validateSemantic →
buildSemanticPlan → buildRelational → lowerToSqlite → emitSql`), differing
only in (a) whether intermediate artifacts are collected and (b) the shape
of the returned error envelope.

**Proposal.** Extract `_runPipeline(spec, pdm, qsm, { collect: boolean })`
returning `{ artifacts, result | errors }`. `compile` projects to
`Result<CompileResult>`; `explain` projects to `ExplainOutput`.

**Payoff.** ~80 LOC removed; eliminates silent drift between the two paths
when stages change.

---

## Tier H2 — real perf wins on the boot/compile path

### H2.1 `validateBlueprintComposition` runs three times per project load

**Where.** `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts:37, :58, :105`

**What.** The 341-line `validateBlueprintComposition` is invoked three times.
Lines 37 and 58 differ only by whether `catalogManifest`/`discoveredModules`
are passed (when modules exist); line 105 re-runs after `validatedServices`
is filled, but the second invocation already covered every check that doesn't
depend on `bindings`/`graphSpec`.

**Proposal.** Restructure to one merge-call after services load, threading
the optional module context.

**Payoff.** Two passes of routes/middleware/mounts/vars walk eliminated per
compile.

### H2.2 PDM/QSM re-parsed and re-validated on every graph compile

**Where.**
- `packages/artifacts/graph-ir-compiler/src/explain/explain.ts:40-86` —
  `parseGraphIrArtifacts` calls `parsePdm`+`validatePdm`+`parseQsm`+`validateQsm`
  on raw input
- Invoked by `compile` (`index.ts:94`), `explain` (`index.ts:194`),
  `compileOperation` (`operation/compile.ts:31`), `compileProjectionGraph`
  (`projection-compile.ts:41`)
- Boot loop: `packages/runtime/bindings-http/src/startup/compile-plan.ts:107`
  calls `compileOperationForGraph` once per `graphId` in the binding set →
  `compileOperation` re-parses both PDM and QSM Zod schemas every iteration

**What.** For a 30-graph service, this is 60 redundant Zod traversals at boot.
The `Validated*` brands exist precisely to skip this work; they are being
thrown away.

**Proposal.** Add a parallel signature `compileOperationFromValidated`
mirroring `compileProjectionGraphFromValidated` (`projection-compile.ts:48`).
Have `buildPlan` (`compile-plan.ts:95`) thread the already-`ValidatedPdm` /
`ValidatedQsm` through.

**Payoff.** Eliminates O(graphs × Zod-PDM-and-QSM-walks) at every service
boot.

### H2.3 `deriveEventTypes(pdm)` recomputed per `compileOperation`

**Where.**
- `packages/artifacts/graph-ir-compiler/src/operation/compile.ts:60`
- `packages/artifacts/graph-ir-compiler/src/emit/event-type.ts:14`
- `packages/artifacts/graph-ir-compiler/src/validate/semantic/sources.ts:264`
- The function itself: `packages/artifacts/pdm/src/derive/event-types.ts:25-38`
  — walks every entity × every transition

**What.** Blueprint already computes `allEventTypes` once at
`load-composed-blueprint.ts:80` and threads it to `loadServiceMember`. The
graph-ir-compiler then recomputes it on every operation compile.

**Proposal.** Cache on the `ValidatedPdm` brand, or pass via
`CompileOperationOptions` (`operation/compile.ts:13-18`).

**Payoff.** O(operations) full PDM walks eliminated per service boot.

### H2.4 Sequential sync I/O in blueprint loader

**Where.** `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts:88-103`
walks services serially calling `loadServiceMember`, which does up to 4–5
`readFileSync` calls (`load-service-member.ts:85, 122, 144, 179` plus
`service-graphs.ts:86, 98` reading every graph json). For a 5-service /
6-graph project that is ~30 reads in series. `loadPdmDir`/`loadQsmDir` are
also sync.

**Proposal.** Convert loaders to `node:fs/promises` and `Promise.all` over
services + over graphs-within-a-service. Same for module discovery
(`compose/modules.ts:43-117`). The codebase isn't sync-locked —
`materialize.ts:7` already uses `fs/promises`.

**Payoff.** Project load goes from ~30 serial reads to two parallel waves.

### H2.5 `validateStructural` in graph-ir-compiler runs 11 separate AST passes

**Where.** `packages/artifacts/graph-ir-compiler/src/validate/structural/index.ts:22-34`

**What.** Eleven sub-validators spread across `dag.ts` (3 traversals),
`command-shape.ts` (3), `output-from.ts` (2), `ids.ts`, `refs.ts`, `shapes.ts`,
`tier1-nodes.ts`, `tier1-expr.ts`, `role.ts`, `map-reduce.ts` (1 each). That
is ~16 walks of every node per validate.

**Proposal.** Single visitor calling per-node hooks once. Rules already
partition cleanly by node-kind.

**Payoff.** ~16× → 1× node walks per structural validate.

---

## Tier M — localized cleanups

### M.1 `ui/src/validate/references.ts` (498 lines) — the same loop runs twice over `screens` and `layouts`

**Where.** `packages/artifacts/ui/src/validate/references.ts:331-400` runs the
same 35-line loop twice with the only difference being path prefix `"layout:"`
vs `"screen:"`. Same shape in `validateModuleActions` at `:308-329`. Also:
`collectStatePaths` at `:13-37` and `collectStatePathsFromScreen` at `:39-59`
define the same `walk` recursive `$state`-collector twice.

**Proposal.** Extract `forEachContext(expanded, fn)` and one
`walkStateRefs(value, into)` helper.

**Payoff.** ~70 LOC removed in this single 498-line file.

### M.2 `lower/sqlite/lower.ts` switch arms repeat ctx setup

**Where.** `packages/artifacts/graph-ir-compiler/src/lower/sqlite/lower.ts:106-186`

**What.** The `Filter`, `Project`, `Aggregate`, and `Sort` arms all open with
the identical 4-line boilerplate (`toSelect → findScanMeta → makeColumnOf →
ctx`). Hoist into one `descend(rel, paramOrder, context)` returning
`{ child, ctx }`.

**Payoff.** ~20 LOC; clarifies that the four arms differ only in what they do
with `ctx` and `child`.

### M.3 Long `if ('eq' in expr)` ladder in local-read

**Where.** `packages/artifacts/graph-ir-compiler/src/operation/local-read.ts:208-228`

**What.** 21-line ladder of 11 sequential `if ('eq' in expr) ... if ('neq' in
expr) ...` checks, each calling `compareBinary` with a different lambda.

**Proposal.** `BINARY_OPS: Record<string, (a, b) => boolean>` lookup table.

**Payoff.** ~15 LOC; nesting flattened.

### M.4 Resolvers instantiated per-row inside local-read

**Where.** `packages/artifacts/graph-ir-compiler/src/operation/local-read.ts:158, :159, :267, :290, :293`

**What.** `createPdmResolver(ctx.pdm)` / `createQsmResolver(ctx.qsm)` rebuilt
on every read.

**Proposal.** Construct once at the entry point and store on
`ReadEvalContext`.

### M.5 Nested if/else with empty branch in bindings structural

**Where.** `packages/artifacts/bindings/src/validate/structural.ts:66-88`

**What.** 3-level nested branch where the first arm is intentionally empty
("GET is allowed on command bindings when response has redirect"). Flatten
with early returns.

### M.6 Move `lower/sqlite/event-delta/` out of `lower/sqlite/`

**Where.** `packages/artifacts/graph-ir-compiler/src/lower/sqlite/event-delta/`
(5 files, ~750 LOC).

**What.** This subtree is the entry-point for `compileProjectionGraph` and
never produces real SQLite read SQL — it produces a `DerivedCompileResult`
consumed by `projection-consumer`. Sitting next to `lower.ts`/`emit.ts` (which
do produce read-side SQL) is misleading.

**Proposal.** Move to `graph-ir-compiler/src/projection/event-delta/` to align
with `projection-compile.ts`.

### M.7 Type duplication between qsm and graph-ir-compiler

**Where.**
- `packages/artifacts/qsm/src/derive/ddl.ts:13-33` declares
  `DerivedTableSchemaLike` and `DerivedSqlTypeLocal`
- `packages/artifacts/graph-ir-compiler/src/types/projection.ts:9, :43-56`
  defines the canonical types

**What.** Copy-pasted "to avoid a package-level dependency cycle", but
graph-ir-compiler already depends on `@rntme/qsm`. The cycle does not exist.

**Proposal.** Move `DerivedTableSchema` / `DerivedSqlType` into `@rntme/qsm`;
import from there in graph-ir-compiler.

### M.8 Internal-only barrel re-exports verified by cross-workspace grep

Drop the following from each package's public `src/index.ts`:

- `bindings/src/index.ts:7` — `validateStructural`, `validateReferences`,
  `validateConsistency`, `BindingArtifactSchema`, `OperationPassthrough`,
  `ParameterPassthrough`, `ExpressionObject`, `ExpressionTemplate`,
  `StructurallyValid`. Only `validateBindings` is consumed externally.
- `blueprint/src/index.ts:5-15` — `buildBindingRegistry`, `buildUiHttpMap`,
  `resolveProjectBindingRef`, `createServiceBindingResolvers`,
  `compileServiceUi`, `discoverServiceArtifacts`, `discoverModules`,
  `loadServiceMember`, `readServiceGraphSpec`, `eventTypesForService`,
  `VarsManifest`, `VarBinding` (deploy-core has its own copy).
- `qsm/src/index.ts:14, :70-75` — `defaultTableName`, `RELATION_ROLE_VALUES`,
  `CARDINALITY_VALUES`, `ProjectionBacking`, `ProjectionSource`,
  `RelationRole`, `Cardinality`, `QsmRelation`.
- `pdm/src/index.ts:6` — `loadPdmDir`, `RelationCardinality` (test-only).
- `graph-ir-compiler/src/index.ts:22` — `GraphIrInternalError`,
  `GraphIrRuntimeError`, several effect helpers (test-only).
- `seed/src/index.ts:14-17` — `seedBuilder`, `SeedBuilder`, `wrapPayloads`,
  `SeedArtifactSchema`.

**Payoff.** ~40 LOC of re-exports removed; index-diff noise reduced for
future renames (free in pre-stable).

### M.9 Duplicate validation walks in composition.ts

**Where.** `packages/artifacts/blueprint/src/validate/composition.ts:112-139, :226-278`

**What.** Both walk `Object.entries(project.middleware ?? {})` and filter
`declaration.kind === 'auth'`. Lines 122-124 and 133-136 share an identical
ternary `declaration.kind === 'auth' && declaration.moduleSlug !== undefined ? ... : ...`.

**Proposal.** Single auth-middleware list build; extract
`authMiddlewarePath(name, declaration)` helper.

### M.10 Brand-symbol reinvention

**Where.**
- `pdm/src/types/artifact.ts:82-90`
- `qsm/src/types/artifact.ts:81-89`
- `workflows/src/types/artifact.ts:47-55`
- `blueprint/src/types/artifact.ts:81-84`
- `bindings/src/types/artifact.ts:76` (uses a different `__validated`
  convention)

**What.** Each declares its own `StructurallyValidBrand` / `ValidatedBrand`
symbols and applies the same `T & { readonly [Brand]: true }` pattern, with
one inconsistent variant.

**Proposal.** Generic `Branded<T, Tag>` and `StructurallyValid<T, Tag>` in
the shared module (see H1.1). Tightens convention and lets the
cross-package typing in `blueprint/src/types/artifact.ts:128-153` stay
consistent.

---

## Tier L — one-liners worth picking up incidentally

- `findDuplicates<T>(items, keyFn)` extraction — ~5 inlined Set-based dup
  checks across structural validators (`pdm/validate/structural.ts:12,15`;
  `qsm/validate/structural.ts:17,174-178`;
  `bindings/validate/structural.ts:91-92,144-145,175,236`;
  `workflows/validate/structural.ts:15,16,50,75-77`).
  `qsm/validate/structural.ts:174-178` already has a private generic version.
- `quoteIdentifier` helper duplicated in `qsm/derive/ddl.ts:294-296`,
  `lower/sqlite/lower.ts`, and `local-read.ts:318`.
- `collectParamRefs` walk duplicated in
  `local-read.ts:243-257` (`hasSkippedPredicateOptional`) and
  `lower/sqlite/lower.ts:212-226`.
- `lowerFilterWithLifting` (`lower/sqlite/lower.ts:28-34`) is dead — only one
  test uses it; the test can call `lowerToSqlite` directly.
- `bindings/types/input-from.ts:4-5` — `ExpressionTemplate = string` and
  `ExpressionObject = Record<string, unknown>` add zero information; inline.
- `seed/src/validate.ts` already builds `eventByType` map at `:36` but
  `simulateStateMachines` (`:194-248`) re-`find()`s per event.
- `qsm/src/derive/handler.ts:36-40` `IdempotencyGuard` type alias duplicates
  the `IDEMPOTENCY_GUARD` literal right below; `as const` on the literal is
  enough.
- `graph-ir-compiler/src/types/errors.ts:14-22` — `GraphIrRuntimeError`
  duplicates `GraphIrInternalError` with a narrower code; collapse with a
  `kind: 'internal' | 'runtime'` field.
- `graph-ir-compiler/src/parse/schema.ts:69-100` — `findManyNode`,
  `findOneNode`, `filterNode` etc. share the same `source` Zod union; extract
  one `sourceSchema`.
- `bindings/src/validate/structural.ts:189-227` — extract
  `validateRedirectTarget(...)`.

---

## Tier A — architectural questions (need a decision)

These are not mechanical fixes; they require design input before any code
moves.

### A.1 Fold `@rntme/seed` and/or `@rntme/workflows` into neighbours

**`@rntme/seed`** (10 src files, ~250 LOC) is hybrid: parse-time logic
(`parse.ts`, `validate.ts`, `wrap-payloads.ts`, `builder.ts`, `types.ts`,
`schema.ts`) plus runtime side-effects (`apply.ts` writes events to
`EventStore`). External consumers split cleanly:

- compile-time: only `packages/artifacts/blueprint/src/compose/load-service-member.ts:10`
- runtime: four files under `packages/runtime/runtime/src/`

The package also peer-deps `better-sqlite3` purely for type imports, which
complicates publishing/install.

**Proposal.** Move `apply.ts` / `builder.ts` into
`packages/runtime/runtime/src/seed/`; inline the schema+validator into
blueprint (or keep a tiny `seed-schema` package).

**`@rntme/workflows`** (31 lines of exports) has three external consumers:
blueprint and deploy-core (compile-time), and bpmn-worker (type-only —
verified all four `import type` lines in
`packages/runtime/bpmn-worker/src/{types,worker,mapping,kafka-consumer}.ts:1`).
Folding into blueprint or a single shared `@rntme/artifact-types` package is
plausible; the current 8-package fan-out has a low
coupling-to-consumer-count ratio for the small members.

**Decision question.** Are seed and workflows intended to gain independent
consumers / independent versioning, or is the package boundary purely
historical?

### A.2 `@rntme/pdm` + `@rntme/qsm` should stay split

Verified by import counts. Of 86 pdm-consumer files only 50 also import qsm
(36 use pdm without qsm, e.g. `projection-consumer/src/store/bootstrap.ts`).
Merging would force qsm-only use cases to depend on pdm and vice versa. **No
action needed.**

---

## Did not survive scrutiny

- **Cross-package "ref-check" helper.** Bindings, ui, qsm, workflows,
  blueprint each have a "look up X in resolver, push specific error if
  missing" pass. The lookup itself is a 1-liner — the value is in the
  surrounding domain logic, which is package-specific.
- **Identifier regex helper.** Only 3 hits across all schemas
  (`pdm/parse/schema.ts:39-54`, `bindings/parse/schema.ts:7`,
  `blueprint/parse/schema.ts:67`) and they encode different rules.
- **camelCase / snake_case utilities.** None found.
- **Hand-rolled validation duplicating Zod.** Scanned `bindings`, `qsm`,
  `pdm` validators for `typeof x !== 'string'` patterns — clean.
- **Async-without-await wrappers.** `materialize-and-compose.ts:19` and
  `materialize.ts:7` are properly async; `applySeed` is genuinely async.
- **Merge `bindings`+`ui`.** Both are HTTP-facing but their types and code
  paths share almost nothing (UI has its own resolver/expand/emit pipeline;
  bindings is graph-signature-driven). Splitting is justified.
- **Runtime hot-path bloat from artifact packages.** Cross-checked all
  `packages/runtime/**/src/**` imports — every production-runtime import of
  an artifact package is either `import type` or invoked at boot/load
  (`load-service.ts`, `compile-plan.ts:buildPlan`). No request-path artifact
  compilation.
- **`better-sqlite3` cost in graph-ir-compiler.** Verified all imports are
  `import type` (`graph-ir-compiler/src/index.ts:1`,
  `types/operation.ts:1`, `execute/execute.ts:1`,
  `operation/local-read.ts:1`). Fully erased; no runtime cost.
- **`graph-ir-compiler/src/parse/schema.ts` (323 lines).** Each node type
  needs its own discriminator and config shape; no abstraction collapses
  without losing per-node type narrowing.
- **`pdm/src/validate/state-machine.ts` (247 lines).** Most length is
  distinct error codes per invariant. Consolidating would erode error
  specificity.
- **`bindings/src/validate/structural.ts` (269 lines).** Past M.5 / L items,
  the rules really are independent.
- **`seed/src/validate.ts` (352 lines).** Four orthogonal validation phases,
  already in named helpers; splitting per phase doesn't pay off past the L
  items.

---

## Recommended sequencing

1. **H1.1 → H1.2 → H1.3** — create `packages/artifacts/_shared/` (or a tiny
   internal package), migrate one consumer, sweep the other seven. Single PR.
2. **H1.4** — graph-ir-compiler `_runPipeline` extraction. Standalone PR.
3. **H2.2 → H2.3** — thread `ValidatedPdm` / `ValidatedQsm` through to
   `compileOperation`; cache `eventTypes` on the brand. Real perf win at
   service boot.
4. **H2.1, H2.4, H2.5** — independent perf wins, can land in any order.
5. **M items** — pick up opportunistically when touching the relevant
   files.
6. **A.1** — schedule a brainstorm before any code touches.

Net estimate for H1+H2: ~360 LOC removed, the `ui.err` API divergence fixed,
and O(graphs × Zod-walks) eliminated from every service boot.
