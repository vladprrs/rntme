> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Runtime Config Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-289 by validating `Partial<RuntimeConfig>` before `startService` begins booting runtime resources.

**Architecture:** Add a focused `src/start/runtime-config.ts` module that owns the `RuntimeConfig` type, `validateRuntimeConfig`, and `RuntimeConfigError`. `startService` will assert config validity first, before reading env, starting buses, opening SQLite handles, or mounting surfaces. Validation stays structural and conservative: plugin escape hatches are accepted when they expose the required methods, and invalid field combinations such as `skipSeed` with `seedMode` fail fast.

**Tech Stack:** TypeScript strict ESM, Hono types, runtime plugin interfaces, Vitest.

---

## File Map

- Create `packages/runtime/runtime/src/start/runtime-config.ts` for the config type, validation result, validation error class, and structural guards.
- Modify `packages/runtime/runtime/src/start/start-service.ts` to import `RuntimeConfig` and call `assertValidRuntimeConfig(config)` at the top.
- Modify `packages/runtime/runtime/src/index.ts` to export `validateRuntimeConfig`, `RuntimeConfigError`, and validation types.
- Modify `packages/runtime/runtime/src/types.ts` and `packages/runtime/runtime/src/load/load-service.ts` to keep `GraphSpec` aligned with `@rntme/graph-ir-compiler`'s parsed authoring spec during verification.
- Create `packages/runtime/runtime/test/unit/runtime-config.test.ts` for validator behavior.
- Modify `packages/runtime/runtime/test/integration/startup.test.ts` to prove `startService` rejects invalid config before arbitrary boot crashes.
- Modify `packages/runtime/runtime/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Failing Tests

- [x] **Step 1: Add unit validator tests**

Create `packages/runtime/runtime/test/unit/runtime-config.test.ts` with tests for:

```ts
expect(validateRuntimeConfig({ bus: {} })).toMatchObject({
  ok: false,
  errors: [expect.objectContaining({ code: 'RUNTIME_CONFIG_EVENT_BUS_INVALID', path: 'bus' })],
});

expect(validateRuntimeConfig({ skipSeed: true, seedMode: 'strict' })).toMatchObject({
  ok: false,
  errors: [expect.objectContaining({ code: 'RUNTIME_CONFIG_SEED_MODE_WITH_SKIP_SEED' })],
});
```

Also add a positive test covering a minimal valid custom config with a bus, db driver, surface, command executor, and query executor.

- [x] **Step 2: Add startService rejection test**

Add an integration test to `packages/runtime/runtime/test/integration/startup.test.ts`:

```ts
  it('rejects invalid RuntimeConfig before booting resources', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

    await expect(
      startService(loaded.value, { bus: {} as EventBus }),
    ).rejects.toMatchObject({
      code: 'RUNTIME_CONFIG_INVALID',
      errors: [expect.objectContaining({ code: 'RUNTIME_CONFIG_EVENT_BUS_INVALID', path: 'bus' })],
    });
  });
```

- [x] **Step 3: Confirm RED**

Run:

```bash
pnpm -F @rntme/runtime test -- test/unit/runtime-config.test.ts test/integration/startup.test.ts
```

Expected before implementation: unit test fails because `runtime-config.ts` does not exist; integration test fails with a raw boot-time error instead of `RUNTIME_CONFIG_INVALID`.

### Task 2: Runtime Config Module

- [x] **Step 1: Implement validation module**

Create `packages/runtime/runtime/src/start/runtime-config.ts` with:

- `RuntimeConfig` moved from `start-service.ts`.
- `RuntimeConfigValidationErrorCode` union for invalid fields.
- `RuntimeConfigValidationError`.
- `RuntimeConfigError` with top-level `code: 'RUNTIME_CONFIG_INVALID'`.
- `validateRuntimeConfig(config: unknown)`.
- `assertValidRuntimeConfig(config: unknown): Partial<RuntimeConfig>`.

Validate:

- config itself is an object, not `null` or an array;
- `db.open` exists when `db` is provided;
- `bus.producer` and `bus.consumer` exist when `bus` is provided; optional `start`/`stop` are functions if present;
- `surfaces` is a non-empty array and each entry has `mount`; optional `listen` is a function if present;
- `actorFromRequest`, `onReady`, `commandExecutor.execute`, `queryExecutor.execute`, and `externalAdapterClient.call` have the expected function shape;
- `seedMode` is `strict` or `upsertByEventId`;
- `skipSeed` is boolean and cannot be paired with `seedMode`;
- `artifactDir` is a non-empty string when provided;
- `runtimeEnv` is a record whose values are strings or `undefined`.

- [x] **Step 2: Wire validation into startService**

At the start of `startService`, replace direct `config` use with:

```ts
const runtimeConfig = assertValidRuntimeConfig(config);
const runtimeEnv = runtimeConfig.runtimeEnv ?? process.env;
```

Then use `runtimeConfig` for all remaining config fields.

- [x] **Step 3: Export public validation helpers**

Update `packages/runtime/runtime/src/index.ts` to export:

```ts
export {
  validateRuntimeConfig,
  RuntimeConfigError,
  type RuntimeConfigValidationError,
  type RuntimeConfigValidationResult,
} from './start/runtime-config.js';
```

- [x] **Step 4: Confirm GREEN**

Run:

```bash
pnpm -F @rntme/runtime test -- test/unit/runtime-config.test.ts test/integration/startup.test.ts
```

Expected: PASS.

### Task 3: Documentation And Audit Ledger

- [x] **Step 1: Update runtime README**

Document the runtime config validation contract under the `RuntimeConfig` section and add the new validation exports to the API table.

- [x] **Step 2: Close U-289 in audit docs**

Mark U-289 `✅ closed | A7` in `docs/audit/00-waves.md`, remove it from `docs/audit/01-current-priority-tasks.md`, and update Package D evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/runtime typecheck
pnpm -F @rntme/runtime test
pnpm -F @rntme/runtime lint
pnpm -F @rntme/runtime build
```

Expected: all PASS.

---

## Self-Review

- Spec coverage: U-289 asks for runtime config validation and tests for invalid combinations; this plan adds public validation, startService fail-fast, and coverage for invalid plugin shape plus `skipSeed`/`seedMode`.
- Placeholder scan: no placeholders remain.
- Type consistency: `RuntimeConfig` moves to `runtime-config.ts`, remains exported through `start-service.ts`, and public validation helpers are exported from `index.ts`.
