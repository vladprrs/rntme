> Status: historical.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Completed RNT-500 execution plan retained as historical rationale and handoff context; it is not current-state truth by itself.

# RNT-500 OpenAPI BindingResolvers Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `generateOpenApi` expose the truthful public contract `generateOpenApi(validated, options?)`, with validation-owned resolver use and compile-time drift guards.

**Architecture:** Keep graph signature and shape resolution in `validateBindings(artifact, resolvers)`, where `ValidatedBindings.resolved` is produced. Change the OpenAPI emitter to consume only that resolved data plus optional generation options. Add a package-local TypeScript contract assertion so a future third resolver argument fails typecheck even if it is named with an underscore.

**Tech Stack:** TypeScript, pnpm workspace filters, Vitest golden/unit tests, OpenAPI 3.1 emitter in `@rntme/bindings`.

---

## Context

Accepted SPEC: `docs/history/specs/autonomous/2026-05-08-rnt-500-openapi-binding-resolvers-design.md`.

Canonical workspace:
- Branch: `auto/rnt-500-openapi-binding-resolvers`
- Worktree: `/home/coder/work/rntme/.worktrees/rnt-500-openapi-binding-resolvers`
- PR: https://github.com/vladprrs/rntme/pull/186

Current evidence checked during PLAN:
- `packages/artifacts/bindings/src/openapi/emit.ts` imports `BindingResolvers` only for `_resolvers`.
- `buildOperation` reads `ResolvedBinding.signature` and `ResolvedBinding.outputShape`; the emitter does not call `resolveGraphSignature` or `resolveShape`.
- In-repo stale call sites are in runtime load, bindings demo, bindings golden tests, bindings OpenAPI unit tests, and current owner/guide docs.
- `pnpm -F @rntme/bindings exec tsc -p tsconfig.check.json --noUnusedParameters true --pretty false` passes before implementation, so package-local `noUnusedParameters` is not expected to require unrelated cleanup.

Decision constraints:
- Remove the unused resolver parameter. Do not add overloads or compatibility shims.
- Keep resolver callbacks required by `validateBindings`, not by OpenAPI emission.
- No OpenAPI output drift is expected; golden snapshots should stay byte-for-byte unchanged after updating test call sites.
- No `docs/decision-system.md` update is expected; the accepted design follows G4/F3, G5/F2, G2/F5, F8, and G6/F7.

## File Structure

- Modify `packages/artifacts/bindings/src/openapi/emit.ts`: remove `BindingResolvers` import and change `generateOpenApi(validated, options?)`.
- Create `packages/artifacts/bindings/test/type/openapi-contract.ts`: compile-time public signature assertion included by `tsconfig.check.json` but not run by Vitest.
- Modify `packages/artifacts/bindings/tsconfig.json`: add package-local `noUnusedParameters: true`.
- Modify `packages/artifacts/bindings/test/unit/openapi/emit.test.ts`: update all emitter calls and remove emitter-only resolver fixtures.
- Modify `packages/artifacts/bindings/test/unit/openapi/callback-operation.test.ts`: update calls and remove `dummyResolvers`.
- Modify `packages/artifacts/bindings/test/golden/category-sales/category-sales.test.ts`: keep resolvers for validation, remove them from the emitter call.
- Modify `packages/artifacts/bindings/test/golden/assign-issue/assign-issue.test.ts`: keep resolvers for validation, remove them from the emitter call.
- Modify `packages/artifacts/bindings/demo-openapi.mjs`: keep resolvers for validation, remove them from the emitter call.
- Modify `packages/runtime/runtime/src/load/load-service.ts`: call `generateOpenApi(validatedBindings)`.
- Modify `docs/current/owners/packages/artifacts/bindings.md`: update quick start and options examples.
- Modify `docs/current/guides/bindings-authoring.md`: update the input contract and resolver responsibility wording.
- Modify `docs/current/guides/bindings-examples.md`: update pipeline examples and option-call snippets.

No local README change is expected because `packages/artifacts/bindings/README.md` only links the owner doc and lists the same package test command.

## Implementation Tasks

### Task 1: Add The Public Signature Drift Guard

**Files:**
- Create: `packages/artifacts/bindings/test/type/openapi-contract.ts`
- Modify: `packages/artifacts/bindings/tsconfig.json`

- [ ] **Step 1: Create a failing type contract assertion**

Create `packages/artifacts/bindings/test/type/openapi-contract.ts`:

```ts
import { generateOpenApi, type OpenApiGenOptions } from '../../src/openapi/emit.js';
import type { ValidatedBindings } from '../../src/types/artifact.js';
import type { OpenApiDoc } from '../../src/types/openapi.js';
import type { Result } from '../../src/types/result.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

type GenerateOpenApiFunctionContract = Expect<Equal<
  typeof generateOpenApi,
  (validated: ValidatedBindings, options?: OpenApiGenOptions) => Result<OpenApiDoc>
>>;

type GenerateOpenApiParameterContract = Expect<Equal<
  Parameters<typeof generateOpenApi>,
  [validated: ValidatedBindings, options?: OpenApiGenOptions]
>>;
```

- [ ] **Step 2: Run typecheck and confirm the guard fails before implementation**

Run:

```bash
pnpm -F @rntme/bindings typecheck
```

Expected now: FAIL with a TypeScript error equivalent to `Type 'false' does not satisfy the constraint 'true'` in `test/type/openapi-contract.ts`, because current `generateOpenApi` still has three parameters.

- [ ] **Step 3: Enable package-local unused-parameter checking**

Change `packages/artifacts/bindings/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false,
    "noUnusedParameters": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

This is intentionally package-local. `tsconfig.check.json` extends this file, so test/type contract files also run under the same setting.

- [ ] **Step 4: Commit the failing guard**

Run:

```bash
git add packages/artifacts/bindings/test/type/openapi-contract.ts packages/artifacts/bindings/tsconfig.json
git commit -m "test(bindings): guard openapi generator contract"
```

### Task 2: Change The Emitter API

**Files:**
- Modify: `packages/artifacts/bindings/src/openapi/emit.ts`

- [ ] **Step 1: Remove the resolver import**

Delete this import from `packages/artifacts/bindings/src/openapi/emit.ts`:

```ts
import type { BindingResolvers } from '../types/resolvers.js';
```

- [ ] **Step 2: Change the public function signature**

Replace the current function signature:

```ts
export function generateOpenApi(
  validated: ValidatedBindings,
  _resolvers: BindingResolvers,
  options: OpenApiGenOptions = {},
): Result<OpenApiDoc> {
```

with:

```ts
export function generateOpenApi(
  validated: ValidatedBindings,
  options: OpenApiGenOptions = {},
): Result<OpenApiDoc> {
```

Do not change the body. The body already reads `validated.artifact` and `validated.resolved`.

- [ ] **Step 3: Run the typecheck and confirm stale callers fail**

Run:

```bash
pnpm -F @rntme/bindings typecheck
```

Expected now: FAIL on stale two/three-argument test calls such as `generateOpenApi(v, resolvers, { standardErrors: false })`. The contract assertion from Task 1 should pass after the signature change.

- [ ] **Step 4: Commit the emitter API change**

Run:

```bash
git add packages/artifacts/bindings/src/openapi/emit.ts
git commit -m "fix(bindings): remove openapi resolver parameter"
```

### Task 3: Update Bindings Tests And Demo Call Sites

**Files:**
- Modify: `packages/artifacts/bindings/test/unit/openapi/emit.test.ts`
- Modify: `packages/artifacts/bindings/test/unit/openapi/callback-operation.test.ts`
- Modify: `packages/artifacts/bindings/test/golden/category-sales/category-sales.test.ts`
- Modify: `packages/artifacts/bindings/test/golden/assign-issue/assign-issue.test.ts`
- Modify: `packages/artifacts/bindings/demo-openapi.mjs`

- [ ] **Step 1: Update `emit.test.ts` imports and fixtures**

In `packages/artifacts/bindings/test/unit/openapi/emit.test.ts`, change:

```ts
import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';
```

to:

```ts
import type { GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';
```

Delete the top-level `const resolvers: BindingResolvers` fixture; after the emitter signature changes, no test in this file needs a resolver object for OpenAPI emission.

Delete the `const cmdResolvers: BindingResolvers` fixture inside the action-binding test; the action test already builds a complete `ValidatedBindings` object.

- [ ] **Step 2: Update all `emit.test.ts` emitter calls**

Use these call forms:

```ts
const r = generateOpenApi(validated);
const r = generateOpenApi(v);
const r = generateOpenApi(v, {
  info: { title: 'FromOptions', version: '0.0.1' },
  servers: [{ url: 'https://api.example.com' }],
});
const r = generateOpenApi(validated, { standardErrors: false });
const r = generateOpenApi(v, { decimalEncoding: 'number' });
```

Every existing two-argument resolver call, for example `generateOpenApi(validated, resolvers)`, becomes `generateOpenApi(validated)`.
Every existing three-argument resolver call, for example `generateOpenApi(v, resolvers, { decimalEncoding: 'number' })`, becomes `generateOpenApi(v, { decimalEncoding: 'number' })`.

- [ ] **Step 3: Update callback operation tests**

In `packages/artifacts/bindings/test/unit/openapi/callback-operation.test.ts`, change:

```ts
import type { GraphSignature, ResolvedShape, BindingResolvers } from '../../../src/types/resolvers.js';

const dummyResolvers: BindingResolvers = {
  resolveGraphSignature: () => null,
  resolveShape: () => null,
};
```

to:

```ts
import type { GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';
```

Then update the first call from:

```ts
const doc = generateOpenApi(makeValidated('stripeCallback', {
  exposure: 'action',
  graph: 'callbackAck',
  target: { engine: 'graph-ir', dialect: 'sqlite' },
  http: { method: 'GET', path: '/oauth/stripe/callback', parameters: [] },
  inputFrom: {
    state: { from: 'query', name: 'state', required: true },
    code: { from: 'query', name: 'code', required: true },
  },
  response: {
    onOk: { redirect: '/app/connected?flow={$result.aggregateId}', status: 302 },
    onErr: { redirect: '/app/error?c={$error.code}' },
  },
}), dummyResolvers);
```

to:

```ts
const doc = generateOpenApi(makeValidated('stripeCallback', {
  exposure: 'action',
  graph: 'callbackAck',
  target: { engine: 'graph-ir', dialect: 'sqlite' },
  http: { method: 'GET', path: '/oauth/stripe/callback', parameters: [] },
  inputFrom: {
    state: { from: 'query', name: 'state', required: true },
    code: { from: 'query', name: 'code', required: true },
  },
  response: {
    onOk: { redirect: '/app/connected?flow={$result.aggregateId}', status: 302 },
    onErr: { redirect: '/app/error?c={$error.code}' },
  },
}));
```

Apply the same trailing-argument removal for the other three calls in that file: the two calls for `callback` and the one call for `createOrder` should no longer pass `dummyResolvers`.

- [ ] **Step 4: Update golden tests**

In both golden tests, keep `resolvers` for `validateBindings`, but change the emitted call:

```ts
const emitted = generateOpenApi(validated.value);
```

Files:
- `packages/artifacts/bindings/test/golden/category-sales/category-sales.test.ts`
- `packages/artifacts/bindings/test/golden/assign-issue/assign-issue.test.ts`

- [ ] **Step 5: Update the demo**

In `packages/artifacts/bindings/demo-openapi.mjs`, keep `resolvers` for validation:

```js
const validated = validateBindings(parsed.value, resolvers);
```

Change the emitter call to:

```js
const emitted = generateOpenApi(validated.value);
```

- [ ] **Step 6: Search for remaining stale bindings-package calls**

Run:

```bash
grep -RIn "generateOpenApi" packages/artifacts/bindings --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.turbo
```

Expected: no `generateOpenApi(validated, resolvers)` or `generateOpenApi(v, resolvers, { standardErrors: false })` usage remains. Imports of `generateOpenApi` are still expected.

- [ ] **Step 7: Run bindings tests and typecheck**

Run:

```bash
pnpm -F @rntme/bindings test
pnpm -F @rntme/bindings typecheck
```

Expected: both PASS. Golden snapshots should not update.

- [ ] **Step 8: Commit bindings call-site updates**

Run:

```bash
git add packages/artifacts/bindings/test packages/artifacts/bindings/demo-openapi.mjs
git commit -m "test(bindings): use resolved openapi emission contract"
```

### Task 4: Update Runtime Caller

**Files:**
- Modify: `packages/runtime/runtime/src/load/load-service.ts`

- [ ] **Step 1: Update the runtime OpenAPI call**

Change:

```ts
const openapi = generateOpenApi(validatedBindings, bindingResolvers);
```

to:

```ts
const openapi = generateOpenApi(validatedBindings);
```

Do not remove `bindingResolvers` from `load-service.ts`; it is still required earlier by `validateBindings(parsedBindings.value, bindingResolvers)`.

- [ ] **Step 2: Run affected runtime build**

Run:

```bash
pnpm -F @rntme/runtime build
```

Expected: PASS. If this fails because dependency `dist` outputs are missing in a fresh worktree, first run:

```bash
pnpm -F @rntme/runtime... build
```

Then rerun:

```bash
pnpm -F @rntme/runtime build
```

- [ ] **Step 3: Commit runtime call-site update**

Run:

```bash
git add packages/runtime/runtime/src/load/load-service.ts
git commit -m "fix(runtime): use openapi emitter resolved contract"
```

### Task 5: Update Current Docs

**Files:**
- Modify: `docs/current/owners/packages/artifacts/bindings.md`
- Modify: `docs/current/guides/bindings-authoring.md`
- Modify: `docs/current/guides/bindings-examples.md`

- [ ] **Step 1: Update owner quick start**

In `docs/current/owners/packages/artifacts/bindings.md`, change:

```ts
const openapi = generateOpenApi(validated.value, resolvers);
```

to:

```ts
const openapi = generateOpenApi(validated.value);
```

Add this bullet under `Validation Invariants` after the output-shape resolver bullet:

```md
- `BindingResolvers` are used by `validateBindings`; OpenAPI emission consumes the already-resolved `ValidatedBindings`.
```

Change the decimal option bullet from:

```md
- Decimal OpenAPI encoding defaults to string with `format: "decimal"`; pass `{ decimalEncoding: "number" }` to `generateOpenApi` to emit JSON numbers.
```

to:

```md
- Decimal OpenAPI encoding defaults to string with `format: "decimal"`; pass `{ decimalEncoding: "number" }` as the second `generateOpenApi` argument to emit JSON numbers.
```

- [ ] **Step 2: Update the authoring guide input contract**

In `docs/current/guides/bindings-authoring.md`, replace:

```text
parseBindingArtifact(input)      -> Result<BindingArtifact>
validateBindings(artifact, res)  -> Result<ValidatedBindings>
generateOpenApi(valid, res, opt) -> Result<OpenApiDoc>
```

with:

```text
parseBindingArtifact(input)             -> Result<BindingArtifact>
validateBindings(artifact, resolvers)   -> Result<ValidatedBindings>
generateOpenApi(validated, options?)    -> Result<OpenApiDoc>
```

Replace:

```md
Exactly one artifact, one resolver object, and one optional options object.
```

with:

```md
Exactly one artifact, one validation resolver object, and one optional OpenAPI options object.
```

Keep the table rows, but ensure the `BindingResolvers` row says it is used by validation. Use this wording:

```md
| `BindingResolvers` | host environment (code) | returns `GraphSignature` and `ResolvedShape` by name during validation |
```

- [ ] **Step 3: Update examples guide pipeline snippets and option calls**

In `docs/current/guides/bindings-examples.md`, change the opening sentence from:

```md
`generateOpenApi(validateBindings(parseBindingArtifact(input), resolvers), resolvers)`
```

to:

```md
`generateOpenApi(validateBindings(parseBindingArtifact(input), resolvers))`
```

Update option examples:

```md
`generateOpenApi(v, { standardErrors: false })`
```

and:

```md
use `generateOpenApi(v, { decimalEncoding: 'number' })`
```

Leave the existing explanation that the emitter performs no repeated graph or shape lookups, and make sure it reads naturally with the two-argument contract.

- [ ] **Step 4: Search current docs for stale calls**

Run:

```bash
grep -RIn "generateOpenApi" docs/current packages/artifacts/bindings/README.md --exclude-dir=node_modules --exclude-dir=dist
```

Expected: docs show `generateOpenApi(validated)` or `generateOpenApi(validated, options)`, not resolver arguments. Mentions that resolvers are used by validation are expected.

- [ ] **Step 5: Commit docs updates**

Run:

```bash
git add docs/current/owners/packages/artifacts/bindings.md docs/current/guides/bindings-authoring.md docs/current/guides/bindings-examples.md
git commit -m "docs(bindings): document openapi resolved contract"
```

### Task 6: Final Verification And Handoff

**Files:**
- All files changed by Tasks 1-5.

- [ ] **Step 1: Run the required gates**

Run:

```bash
pnpm -F @rntme/bindings test
pnpm -F @rntme/bindings typecheck
pnpm -F @rntme/bindings build
pnpm -F @rntme/runtime build
git diff --check
```

Expected: all PASS.

If `@rntme/runtime build` fails only because dependency `dist` outputs are absent, run:

```bash
pnpm -F @rntme/runtime... build
pnpm -F @rntme/runtime build
```

and record both commands in the DEV stage comment.

- [ ] **Step 2: Confirm no stale resolver call remains**

Run:

```bash
grep -RIn "generateOpenApi" packages docs/current --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.turbo
```

Expected allowed patterns:
- `generateOpenApi(validated.value)`
- `generateOpenApi(validatedBindings)`
- `generateOpenApi(v, { standardErrors: false })`
- documentation explaining that `BindingResolvers` are for `validateBindings`

Expected disallowed patterns:
- `generateOpenApi(validated.value, resolvers)`
- `generateOpenApi(validatedBindings, bindingResolvers)`
- `generateOpenApi(v, resolvers, { standardErrors: false })`

- [ ] **Step 3: Confirm golden output did not change**

Run:

```bash
git diff -- packages/artifacts/bindings/test/golden
```

Expected: test source call-site diffs only. `expected.openapi.json` files should not change. If a golden JSON file changes, stop and inspect the diff; this plan expects no emitted OpenAPI document drift.

- [ ] **Step 4: Update the canonical branch and push**

From the canonical worktree:

```bash
git fetch --prune origin
git rebase origin/main
pnpm -F @rntme/bindings test
pnpm -F @rntme/bindings typecheck
pnpm -F @rntme/bindings build
pnpm -F @rntme/runtime build
git diff --check
git push origin auto/rnt-500-openapi-binding-resolvers
```

If rebase reports conflicts, resolve only files owned by RNT-500, rerun the gates above, and record the conflict in the DEV stage comment.

- [ ] **Step 5: DEV stage comment requirements**

Post a `[STAGE:DEV]` comment in Russian on the same Multica issue with:
- verdict;
- files changed;
- branch/worktree/PR;
- commits pushed;
- exact gates run and pass/fail output summary;
- whether golden JSON changed;
- any blocker or product question;
- next stage recommendation.

## Acceptance Criteria Mapping

- Remove unused resolver parameter from API/callers: Tasks 2-4.
- Public API/docs/tests match chosen contract: Tasks 1, 3, and 5.
- TypeScript catches future unused resolver drift: Task 1 exact signature assertion plus package `noUnusedParameters`.
- Existing OpenAPI golden tests updated intentionally: Task 3 updates test calls; Task 6 verifies snapshot JSON unchanged.
- Affected package/runtime gates required: Task 6.

## Risks And Collision Points

- Out-of-repo callers break because the API is pre-stable. Do not add an overload; docs are the migration surface.
- `noUnusedParameters` does not catch underscore-prefixed parameters. The `test/type/openapi-contract.ts` assertion is the load-bearing guard against `_resolvers` returning.
- Runtime `load-service.ts` still needs `bindingResolvers` for validation. Removing it entirely would be a bug.
- If another agent has touched the same canonical worktree, stop before rebasing or editing and inspect `git status -sb` plus issue comments. Do not overwrite unrelated changes.
