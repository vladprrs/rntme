> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Audit Package A Blueprint/UI Fail-Fast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Close audit units U-048, U-050, U-319, U-320, U-321, and U-322 so invalid project blueprints and UI authoring artifacts fail during load/compose/compile instead of silently producing broken apps.

**Architecture:** Keep `@rntme/blueprint` as the project composition boundary and `@rntme/ui` as the artifact compiler. The strategic choice is strict fail-fast validation: malformed descriptors, unknown components, unknown routes, invalid source-file shapes, duplicate derived screen keys, and missing HTTP entries all become structured `Result.err` values.

**Tech Stack:** TypeScript ESM, Vitest, Zod, existing `Result<T>` helpers, package-local README/audit docs.

---

### Task 1: U-048 Malformed Service Descriptor

**Files:**
- Modify: `packages/artifacts/blueprint/src/load/load-blueprint.ts`
- Modify: `packages/artifacts/blueprint/src/types/result.ts`
- Modify: `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`

- [x] **Step 1: Write the failing test**

Add a test in `load-blueprint.test.ts` that copies `test/fixtures/product-catalog-project` into a temp directory, replaces `services/catalog/service.json` with `{"kind":"not-a-kind"}`, calls `loadBlueprint`, and expects:

```ts
expect(r.ok).toBe(false);
if (r.ok) return;
expect(r.errors[0]).toMatchObject({
  layer: 'load',
  code: ERROR_CODES.BLUEPRINT_SERVICE_JSON_MALFORMED,
  path: 'services/catalog/service.json',
});
expect(r.errors[0]!.message).toContain('service "catalog" service.json failed validation');
expect(r.errors[0]!.cause).toEqual(expect.any(Array));
```

- [x] **Step 2: Verify RED**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/load-blueprint.test.ts`

Expected before implementation: fail because `BLUEPRINT_SERVICE_JSON_MALFORMED` is not defined or malformed descriptors still produce the missing-service error.

- [x] **Step 3: Implement structured load error**

Append `BLUEPRINT_SERVICE_JSON_MALFORMED` to `ERROR_CODES` in `types/result.ts`. In `load-blueprint.ts`, after `ServiceDescriptorSchema.safeParse(...)`, if `success === false`, return `err([{ layer: 'load', code: ERROR_CODES.BLUEPRINT_SERVICE_JSON_MALFORMED, message: \`service "${slug}" service.json failed validation\`, path: \`services/${slug}/service.json\`, cause: parsedDescriptor.error.issues }])`.

- [x] **Step 4: Verify GREEN**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/load-blueprint.test.ts`

Expected after implementation: the load-blueprint unit suite passes.

### Task 2: U-050 Strict Project-Aware UI Resolvers

**Files:**
- Modify: `packages/artifacts/blueprint/src/compose/compile-service-ui.ts`
- Modify: `packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts`

- [x] **Step 1: Write failing compose tests**

Add or adjust tests so `loadComposedBlueprint(product-catalog-project)` fails when:

```ts
// Unknown route in services/app/ui screen action.
homeScreen.actions = {
  goMissing: { kind: 'navigation', navigateTo: '/missing' },
};

// Unknown component in services/app/ui screen spec.
homeSpec.elements.unknown = { type: 'NotInCatalog', props: {} };
homeSpec.elements.page.children = ['unknown'];
```

The expected blueprint error is `BLUEPRINT_SERVICE_UI_INVALID`, with `cause` containing `UNKNOWN_ROUTE` for the first mutation and `UNKNOWN_COMPONENT_TYPE` for the second mutation.

- [x] **Step 2: Verify RED**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/load-composed-blueprint.test.ts`

Expected before implementation: unknown route passes because `resolveRoute` returns `true`; unknown component may pass because the compile layer supplies a permissive component fallback.

- [x] **Step 3: Replace permissive fallbacks**

In `compile-service-ui.ts`, set:

```ts
resolveComponent: catRes.resolveComponent,
resolveRoute: (path) =>
  Object.keys(input.projectRoutes).some((pattern) => routePatternMatches(pattern, path)),
```

If the current input type does not expose project UI routes, pass them from `load-composed-blueprint.ts` into `compileServiceUi`. Implement `routePatternMatches` with the same colon-segment matching used by `@rntme/ui` validation. Do not keep a generic `{ childrenModel: 'list' }` fallback; built-in components must come from the composed catalog or an explicit built-in catalog helper.

- [x] **Step 4: Verify GREEN**

Run: `pnpm -F @rntme/blueprint vitest run test/unit/load-composed-blueprint.test.ts`

Expected after implementation: the route and component rejection tests pass and the normal product-catalog compose fixture still passes.

### Task 3: U-319/U-320 UI Parse Schemas

**Files:**
- Create: `packages/artifacts/ui/src/parse/schema.ts`
- Modify: `packages/artifacts/ui/src/resolve/resolve.ts`
- Modify: `packages/artifacts/ui/src/index.ts`
- Modify: `packages/artifacts/ui/test/unit/resolve.test.ts`

- [x] **Step 1: Write failing parse tests**

Add tests in `resolve.test.ts` that create temporary UI source trees by copying `test/fixtures/minimal-app` and then corrupt:

```ts
manifest.version = '1.0';
screenSpec.root = 42;
screenDescriptor.actions = { submit: { kind: 'command' } };
```

Expected errors:

```ts
MANIFEST_INVALID
SPEC_INVALID
SCREEN_SCHEMA_INVALID
```

- [x] **Step 2: Verify RED**

Run: `pnpm -F @rntme/ui vitest run test/unit/resolve.test.ts`

Expected before implementation: invalid JSON shapes are accepted or fail later with unrelated behavior.

- [x] **Step 3: Add Zod schemas**

Create Zod schemas for `SourceManifest`, `RouteEntry`, `ScreenDescriptor`, `DataBinding`, `ActionDef`, `ParamValue`, `SpecJson`, `ElementJson`, and `RefElement`. Use `.strict()` on object schemas so unknown mixed-shape element objects fail at parse. Validate manifest as `MANIFEST_INVALID`, specs as `SPEC_INVALID`, and screen descriptors as `SCREEN_SCHEMA_INVALID`.

- [x] **Step 4: Wire schemas into resolve**

Replace typed `JSON.parse(...) as T` trust with `readJson(filePath, schema, errorCode)` so each loaded file is schema-validated immediately after JSON parse.

- [x] **Step 5: Verify GREEN**

Run: `pnpm -F @rntme/ui vitest run test/unit/resolve.test.ts`

Expected after implementation: all resolve tests pass, including the three parse-layer failures.

### Task 4: U-322 Missing HTTP Map Entries Fail Emit

**Files:**
- Modify: `packages/artifacts/ui/src/emit/http-map.ts`
- Modify: `packages/artifacts/ui/src/emit/emit.ts`
- Modify: `packages/artifacts/ui/test/unit/emit.test.ts`

- [x] **Step 1: Write failing emit tests**

Add tests where an expanded screen contains:

```ts
screen.screen.data = { '/data/items': { binding: 'missingQuery' } };
screen.screen.actions = { save: { kind: 'command', binding: 'missingCommand', paramsFromState: {} } };
```

Calling `emit(expanded, {})` must return `Result.err` containing `EMIT_FAILED` paths for the data binding and command action.

- [x] **Step 2: Verify RED**

Run: `pnpm -F @rntme/ui vitest run test/unit/emit.test.ts`

Expected before implementation: the data binding and command action are silently omitted.

- [x] **Step 3: Return emit errors instead of throwing/dropping**

Change `resolveScreenHttp` to return `{ data, actions, errors }`. Missing data/command HTTP entries push `EMIT_FAILED` with paths such as `screen:home/data//data/items` and `screen:home/actions/save`. Category-to-module failures for module actions also become `EMIT_FAILED` instead of raw thrown errors at the public emit boundary.

- [x] **Step 4: Wire errors through emit**

In `emit.ts`, collect errors while compiling layouts and screens. If any exist, return `err(...errors)` before returning the artifact.

- [x] **Step 5: Verify GREEN**

Run: `pnpm -F @rntme/ui vitest run test/unit/emit.test.ts`

Expected after implementation: missing HTTP entries fail with structured `EMIT_FAILED` errors and existing emit behavior remains intact.

### Task 5: U-321 Duplicate Derived Screen Keys

**Files:**
- Modify: `packages/artifacts/ui/src/types/result.ts`
- Modify: `packages/artifacts/ui/src/resolve/resolve.ts`
- Modify: `packages/artifacts/ui/test/unit/resolve.test.ts`

- [x] **Step 1: Write failing duplicate-key test**

Create a temp copy of `minimal-app` with two routes:

```json
"/admin": { "layout": "main", "screen": "screens/admin/home" },
"/public": { "layout": "main", "screen": "screens/public/home" }
```

Create both file pairs. `resolve(tempDir)` must return `DUPLICATE_SCREEN_KEY` with a message naming `home` and both screen paths.

- [x] **Step 2: Verify RED**

Run: `pnpm -F @rntme/ui vitest run test/unit/resolve.test.ts`

Expected before implementation: the second screen overwrites the first.

- [x] **Step 3: Add duplicate detection**

Append `DUPLICATE_SCREEN_KEY` to `UiErrorCode`. In the route loop in `resolve.ts`, keep `screenPathByKey`. If a derived key already exists for a different base path, return `err({ code: 'DUPLICATE_SCREEN_KEY', message: ..., path: route.screen })` before reading or assigning the second screen.

- [x] **Step 4: Verify GREEN**

Run: `pnpm -F @rntme/ui vitest run test/unit/resolve.test.ts`

Expected after implementation: duplicate screen keys are rejected and all existing resolve tests pass.

### Task 6: Documentation Touch And Final Verification

**Files:**
- Modify: `packages/artifacts/blueprint/README.md`
- Modify: `packages/artifacts/ui/README.md`
- Modify: `docs/audit/00-waves.md`
- Modify: `docs/audit/01-current-priority-tasks.md`

- [x] **Step 1: Update package READMEs**

Update `@rntme/blueprint` README so `compileServiceUi` documents strict project route/component resolution. Update `@rntme/ui` README so parse schemas, duplicate screen-key errors, and emit missing-http behavior are no longer described as missing limitations.

- [x] **Step 2: Update audit docs**

Mark U-048, U-050, U-319, U-320, U-321, and U-322 closed with evidence lines in `docs/audit/00-waves.md` and remove or mark them closed in `docs/audit/01-current-priority-tasks.md` so the active queue reflects the current state.

- [x] **Step 3: Run package verification**

Run:

```bash
pnpm -F @rntme/blueprint test
pnpm -F @rntme/ui test
pnpm -F @rntme/blueprint build
pnpm -F @rntme/ui build
```

Expected: all four commands exit 0. These packages currently expose `build` as the TypeScript gate rather than a separate `typecheck` script.

- [x] **Step 4: Completion audit**

Map each audit unit to evidence:

```text
U-048 -> failing-path blueprint test + BLUEPRINT_SERVICE_JSON_MALFORMED code
U-050 -> compose tests reject unknown UI route/component
U-319/U-320 -> Zod parse schemas + MANIFEST_INVALID/SPEC_INVALID/SCREEN_SCHEMA_INVALID tests
U-321 -> duplicate screen-key test + DUPLICATE_SCREEN_KEY code
U-322 -> emit tests for data and command missing httpMap entries
Docs -> README and audit queue updates
```
