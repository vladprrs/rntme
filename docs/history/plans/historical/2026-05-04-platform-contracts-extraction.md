> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Platform contracts extraction — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract four cross-cutting platform contracts (`module/v1`, `provisioner/v1`, `client-runtime/v1`, `handlers/v1`) into `packages/contracts/`, rename `module-skeleton` → `module-scaffold`, and add a `dependency-cruiser` CI guard. Remove every layering violation listed in `docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md` §1.

**Architecture:** Six self-contained PRs in fixed merge order (1→2→3→4→5→6). Each PR creates its package, moves files via `git mv` (preserving history), updates every consumer's imports + `package.json`, ships docs in the same commit, and is gated on `pnpm install --frozen-lockfile && pnpm -r run typecheck && pnpm -r run test && pnpm -r run build && pnpm -r run lint` (= **the 5 gates**). Pre-stable per `project_pre_stable_stage.md` — no backward-compat shims; consumers swap deps directly.

**Tech Stack:** pnpm 9 workspace, TypeScript 5, Vitest, zod, React 19 (for `client-runtime/v1`), `dependency-cruiser` (PR 6 only).

---

## Conventions used in this plan

- **The 5 gates** = `pnpm install --frozen-lockfile && pnpm -r run typecheck && pnpm -r run test && pnpm -r run build && pnpm -r run lint`. Every task that ends with verification runs this. If any step fails, fix before committing.
- **Branch strategy:** one branch per PR, off the same upstream base (`main` or current dev branch). At the end of each PR's tasks, push the branch and open a PR.
- **Bulk replace:** use `git ls-files <glob> | xargs sed -i 's|FROM|TO|g'` patterns. Always commit-stage and re-grep before committing to confirm no stragglers.
- **Commits inside a PR:** small commits within a PR are fine. The PR is the unit of merge; the commits inside are the unit of revert.
- **Doc obligation:** every PR must include the doc updates listed for it (CLAUDE.md hard rule).

---

## Pre-flight

### Task 0.1: Confirm clean baseline

**Files:** none.

- [ ] **Step 1: Check current branch and uncommitted state**

```bash
git status --short
git branch --show-current
```

Expected: any uncommitted modifications are unrelated to this work, or they're already on a separate branch. If this branch is already named for one of the upcoming PRs (e.g., `extract-contracts-module-v1`), proceed; otherwise create the per-PR branch at the start of each PR's first task.

- [ ] **Step 2: Confirm the spec is committed and accessible**

```bash
test -f docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md && echo "spec OK"
```

Expected: `spec OK`.

- [ ] **Step 3: Run 5 gates against baseline**

```bash
pnpm install --frozen-lockfile
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

Expected: all green. If anything fails on baseline, **stop and report**: pre-existing breakage must be resolved before structural refactoring.

---

## PR 1 — `@rntme/contracts-module-v1`

**PR branch:** `extract-contracts-module-v1`

**Blast radius:** new package + `module-skeleton/src/{manifest-shape.ts,index.ts}` + `blueprint` (4 src + 2 test + package.json) + `deploy-core` (2 src + 1 test + package.json) + `artifacts/ui` (1 src + package.json).

### Task 1.1: Create package skeleton

**Files:**
- Create: `packages/contracts/module/v1/package.json`
- Create: `packages/contracts/module/v1/tsconfig.json`
- Create: `packages/contracts/module/v1/tsconfig.check.json`
- Create: `packages/contracts/module/v1/vitest.config.ts`
- Create: `packages/contracts/module/v1/eslint.config.mjs`
- Create: `packages/contracts/module/v1/src/index.ts` (placeholder, real content in next task)
- Create: `packages/contracts/module/v1/README.md`

- [ ] **Step 1: Create branch**

```bash
git checkout -b extract-contracts-module-v1
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "@rntme/contracts-module-v1",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "description": "Module manifest contract — the JSON shape every rntme module exposes via module.json: capabilities, secrets, edge auth, client block, provisioner block.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 4: Write tsconfig.check.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 5: Write vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
```

- [ ] **Step 6: Write eslint.config.mjs** (mirror of `contracts/identity/v1`)

```js
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
      globals: { console: 'readonly', process: 'readonly', structuredClone: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
];
```

- [ ] **Step 7: Write `src/index.ts` placeholder**

```ts
export const VERSION = '1.0.0';
```

- [ ] **Step 8: Write README.md** (per CLAUDE.md uniform template — File map / Quick start / API / Invariants / Out of scope / Where to look / Specs)

```markdown
# @rntme/contracts-module-v1

Module manifest contract for rntme. Defines the JSON shape every module exposes via `module.json` — capabilities, secrets, edge auth, client block, provisioner block — plus the zod schemas and a `parseModuleManifest` helper.

## File map

- `src/manifest-shape.ts` — zod schemas + types + `parseModuleManifest`.
- `src/index.ts` — public re-exports.

## Quick start

```ts
import { parseModuleManifest, type ModuleManifest } from '@rntme/contracts-module-v1';

const result = parseModuleManifest(rawJson);
if (!result.ok) {
  // result.errors is a Result<T> error list
}
```

## API

Schemas: `ModuleManifestSchema`, `EdgeAuthDescriptorSchema`, `ModuleCapabilitiesSchema`, `ModuleSecretSchema`, `ProvisionerBlockSchema`, `ProvisionerProducesSchema`, `ProvisionerRequiresSchema`.

Types: `ModuleManifest`, `EdgeAuthDescriptor`, `ModuleCapabilities`, `ModuleSecret`, `ProvisionerBlock`, `ProvisionerProduces`, `ProvisionerRequires`, `ClientBlock`, `ComponentDeclaration`, `OperationDeclaration`, `PropSchema`, `ModuleManifestError`, `ModuleManifestResult`.

Functions: `parseModuleManifest`.

## Invariants & gotchas

- This package owns only the **JSON declarative shape** of a manifest. The runtime contract for provisioners (what code a provisioner implements) lives in `@rntme/contracts-provisioner-v1`. Do not put runtime types here.
- `parseModuleManifest` returns `Result<ModuleManifest, ModuleManifestError>` — never throws.

## Out of scope

- Provisioner runtime contract (see `contracts-provisioner-v1`).
- Module client runtime APIs (see `contracts-client-runtime-v1`).
- Example handlers / scaffolding (see `module-scaffold`).

## Where to look first

`manifest-shape.ts` → `parseModuleManifest`.

## Specs

- `docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md` — extraction rationale.
- `docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md` — manifest shape origin.
```

- [ ] **Step 9: Verify package builds (empty src is OK at this stage)**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/contracts-module-v1 run build
```

Expected: build succeeds; `dist/index.js` exists.

- [ ] **Step 10: Commit skeleton**

```bash
git add packages/contracts/module/v1/
git commit -m "feat(contracts-module-v1): scaffold empty package"
```

### Task 1.2: Move `manifest-shape.ts` and wire exports

**Files:**
- Move: `packages/tooling/module-skeleton/src/manifest-shape.ts` → `packages/contracts/module/v1/src/manifest-shape.ts`
- Modify: `packages/contracts/module/v1/src/index.ts`
- Modify: `packages/tooling/module-skeleton/src/index.ts`

- [ ] **Step 1: `git mv`**

```bash
git mv packages/tooling/module-skeleton/src/manifest-shape.ts \
       packages/contracts/module/v1/src/manifest-shape.ts
```

- [ ] **Step 2: Replace `src/index.ts` of `contracts-module-v1`**

```ts
export const VERSION = '1.0.0';

export {
  EdgeAuthDescriptorSchema,
  ModuleCapabilitiesSchema,
  ModuleManifestSchema,
  ModuleSecretSchema,
  ProvisionerBlockSchema,
  ProvisionerProducesSchema,
  ProvisionerRequiresSchema,
  parseModuleManifest,
} from './manifest-shape.js';
export type {
  ClientBlock,
  ComponentDeclaration,
  EdgeAuthDescriptor,
  ModuleCapabilities,
  ModuleManifest,
  ModuleManifestError,
  ModuleManifestResult,
  ModuleSecret,
  OperationDeclaration,
  PropSchema,
  ProvisionerBlock,
  ProvisionerProduces,
  ProvisionerRequires,
} from './manifest-shape.js';
```

- [ ] **Step 3: Replace `module-skeleton/src/index.ts`** (keep only `exampleHandlers` + VERSION)

```ts
export const VERSION = '0.0.0';

export { exampleHandlers } from './handlers.js';
```

- [ ] **Step 4: Build the new contract**

```bash
pnpm -F @rntme/contracts-module-v1 run build
```

Expected: build succeeds; types and JS in `dist/`.

### Task 1.3: Move manifest-shape tests

**Files:**
- Move: `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts` → `packages/contracts/module/v1/test/unit/manifest-shape.test.ts`

- [ ] **Step 1: `git mv` test**

```bash
mkdir -p packages/contracts/module/v1/test/unit
git mv packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts \
       packages/contracts/module/v1/test/unit/manifest-shape.test.ts
```

- [ ] **Step 2: Update import inside the test**

The test currently imports from a relative path inside `module-skeleton/src/`. Replace any `from '../../src/manifest-shape'` (or similar) with `from '../../src/manifest-shape.js'` if it's now relative to the new location, **or** with `from '../../src/index.js'` if it tested the public surface. Inspect first:

```bash
grep -n "manifest-shape\|from " packages/contracts/module/v1/test/unit/manifest-shape.test.ts | head
```

Adjust import paths so the test runs from inside `contracts-module-v1`.

- [ ] **Step 3: Run the test**

```bash
pnpm -F @rntme/contracts-module-v1 run test
```

Expected: tests pass.

### Task 1.4: Migrate `blueprint` consumers

**Files:**
- Modify: `packages/artifacts/blueprint/package.json`
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`
- Modify: `packages/artifacts/blueprint/src/types/result.ts`
- Modify: `packages/artifacts/blueprint/src/compose/catalog.ts`
- Modify: `packages/artifacts/blueprint/src/compose/modules.ts`
- Modify: `packages/artifacts/blueprint/test/unit/catalog.test.ts`
- Modify: `packages/artifacts/blueprint/test/unit/validate-composition.test.ts`

- [ ] **Step 1: Bulk-replace import path in src + test**

```bash
git ls-files 'packages/artifacts/blueprint/src/**' 'packages/artifacts/blueprint/test/**' \
  | xargs grep -l "@rntme/module-skeleton" \
  | xargs sed -i "s|'@rntme/module-skeleton'|'@rntme/contracts-module-v1'|g"
```

- [ ] **Step 2: Verify no stragglers**

```bash
grep -rn "@rntme/module-skeleton" packages/artifacts/blueprint/src packages/artifacts/blueprint/test
```

Expected: no matches.

- [ ] **Step 3: Update `blueprint/package.json` deps**

In `dependencies`: replace `"@rntme/module-skeleton": "workspace:*"` with `"@rntme/contracts-module-v1": "workspace:*"`.

- [ ] **Step 4: Build + test blueprint**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/blueprint run build
pnpm -F @rntme/blueprint run test
```

Expected: green.

### Task 1.5: Migrate `deploy-core` consumers

**Files:**
- Modify: `packages/deploy/deploy-core/package.json`
- Modify: `packages/deploy/deploy-core/src/provision.ts`
- Modify: `packages/deploy/deploy-core/src/composed-project.ts`
- Modify: `packages/deploy/deploy-core/test/conformance/provisioner-contract.test.ts`

- [ ] **Step 1: Bulk-replace**

```bash
git ls-files 'packages/deploy/deploy-core/src/**' 'packages/deploy/deploy-core/test/**' \
  | xargs grep -l "@rntme/module-skeleton" \
  | xargs sed -i "s|'@rntme/module-skeleton'|'@rntme/contracts-module-v1'|g"
```

- [ ] **Step 2: Update `deploy-core/package.json`** — replace dep `@rntme/module-skeleton` with `@rntme/contracts-module-v1`.

- [ ] **Step 3: Verify + build + test**

```bash
grep -rn "@rntme/module-skeleton" packages/deploy/deploy-core/src packages/deploy/deploy-core/test
pnpm install --frozen-lockfile
pnpm -F @rntme/deploy-core run build
pnpm -F @rntme/deploy-core run test
```

Expected: zero matches; green build/test.

### Task 1.6: Migrate `artifacts/ui` consumer

**Files:**
- Modify: `packages/artifacts/ui/package.json`
- Modify: `packages/artifacts/ui/src/validate/resolvers-type.ts`

- [ ] **Step 1: Bulk-replace**

```bash
git ls-files 'packages/artifacts/ui/src/**' \
  | xargs grep -l "@rntme/module-skeleton" \
  | xargs sed -i "s|'@rntme/module-skeleton'|'@rntme/contracts-module-v1'|g"
```

- [ ] **Step 2: Update `artifacts/ui/package.json`** — replace dep.

- [ ] **Step 3: Build + test**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/ui run build
pnpm -F @rntme/ui run test
```

Expected: green.

### Task 1.7: Fix skeleton tests broken by the trimmed `index.ts`

The skeleton has two smoke tests that imported the manifest schema from `@rntme/module-skeleton`:
- `test/unit/_smoke.test.ts` — imports only `VERSION, exampleHandlers` from `../../src/index.js`. Survives the trim. **No change needed.**
- `test/public-contract/_smoke.test.ts` — imports `VERSION, exampleHandlers, ModuleManifestSchema, parseModuleManifest` from `@rntme/module-skeleton`. **Breaks** after Task 1.2 trims `index.ts`.

**Decision:** delete `test/public-contract/_smoke.test.ts`. The manifest validator's coverage now lives in `contracts-module-v1/test/unit/manifest-shape.test.ts` (migrated in Task 1.3). The skeleton's smoke test was duplicating that coverage; keeping a duplicate after the move would only invite drift.

- [ ] **Step 1: Delete the duplicate smoke test**

```bash
git rm packages/tooling/module-skeleton/test/public-contract/_smoke.test.ts
rmdir packages/tooling/module-skeleton/test/public-contract 2>/dev/null || true
```

- [ ] **Step 2: Run remaining skeleton tests**

```bash
pnpm -F @rntme/module-skeleton run test
```

Expected: green. The remaining tests are `_smoke.test.ts` (unit), `handlers.test.ts`, `boot-skeleton.test.ts` (the latter two still pass; they don't touch the manifest schema).

### Task 1.8: Doc updates for PR 1

**Files:**
- Modify: `packages/tooling/module-skeleton/README.md` — note that the manifest schema now lives in `contracts-module-v1`.
- Modify: `packages/artifacts/blueprint/README.md` — update dep mention.
- Modify: `packages/deploy/deploy-core/README.md` — update dep mention.
- Modify: `AGENTS.md` (§3 layering, §10 glossary) — add `contracts-module-v1`.
- Modify: `CLAUDE.md` "Architecture in one paragraph" — mention `contracts/module/v1`.
- Modify: top-level `README.md` packages-table — add row.

- [ ] **Step 1: AGENTS.md edits**

In §10 glossary, add an entry like:

```markdown
- **`@rntme/contracts-module-v1`** — JSON shape of `module.json` (manifest schema, types, `parseModuleManifest`). All loaders/composers depend on this; modules implement it via their `module.json`.
```

In §3 (layering), add `contracts-module-v1` to the platform-contracts row (or create the row if absent — see spec §5 doc table for the §3 layout).

- [ ] **Step 2: CLAUDE.md edit**

In "Architecture in one paragraph", add to the contracts list mentioned: `…, plus the manifest contract `@rntme/contracts-module-v1`…`. Keep the paragraph one paragraph.

- [ ] **Step 3: top-level README.md packages-table**

Add a row for `@rntme/contracts-module-v1`. Match the existing column shape (name | path | description).

- [ ] **Step 4: per-package README adjustments**

Open each of skeleton/blueprint/deploy-core README and update the "imports manifest schema from …" text. Most likely just one-line edits.

### Task 1.9: PR 1 final verification + commit + open PR

- [ ] **Step 1: Run all 5 gates**

```bash
pnpm install --frozen-lockfile
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

Expected: all green.

- [ ] **Step 2: Re-grep for `@rntme/module-skeleton` outside skeleton itself**

```bash
git grep "@rntme/module-skeleton" -- ':!pnpm-lock.yaml' ':!packages/tooling/module-skeleton'
```

Expected: zero matches (skeleton still self-references; lock will update on install).

- [ ] **Step 3: Commit + push**

```bash
git add -A
git commit -m "refactor(contracts): extract @rntme/contracts-module-v1 from module-skeleton

Migrates the module manifest contract (zod schemas + types + parseModuleManifest)
out of the tooling package and into a dedicated platform contract. Updates
blueprint, deploy-core, and artifacts/ui consumers. Spec:
docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md."
git push -u origin extract-contracts-module-v1
```

- [ ] **Step 4: Open PR via gh**

```bash
gh pr create --title "refactor(contracts): extract contracts-module-v1" --body "$(cat <<'EOF'
## Summary
- Adds `@rntme/contracts-module-v1` (manifest schema + types + `parseModuleManifest`).
- Migrates `blueprint`, `deploy-core`, `artifacts/ui` consumers.
- Spec: `docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md`.

## Test plan
- [x] `pnpm -r run typecheck` green
- [x] `pnpm -r run test` green
- [x] `pnpm -r run build` green
- [x] `pnpm -r run lint` green
- [x] `git grep @rntme/module-skeleton` returns zero outside skeleton itself

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 2 — `@rntme/contracts-provisioner-v1`

**PR branch:** `extract-contracts-provisioner-v1` (off main, after PR 1 merges)

**Blast radius:** new package + `deploy-core/src/{provisioner-contract.ts,provisioner-env-mapping.ts,index.ts,…}` + `deploy-core/test/conformance/provisioner-contract.test.ts` + `identity-auth0/src/provisioner.ts` + `identity-auth0/package.json` (deps + build:deps script).

### Task 2.1: Create package skeleton

**Files:**
- Create: `packages/contracts/provisioner/v1/{package.json,tsconfig.json,tsconfig.check.json,vitest.config.ts,eslint.config.mjs,src/index.ts,README.md}`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b extract-contracts-provisioner-v1
```

- [ ] **Step 2: Write `package.json`** — same shape as PR 1's, but:
  - `name`: `@rntme/contracts-provisioner-v1`
  - `description`: `Provisioner runtime contract — what a vendor module's provisioner code receives, returns, and can fail with. Used by deploy orchestrators that run provisioners.`
  - `dependencies`: empty (no zod, no internal deps; just types)

- [ ] **Step 3: Write tsconfig + tsconfig.check + vitest.config + eslint.config + placeholder index.ts** — mirror PR 1 templates exactly.

- [ ] **Step 4: Build empty package**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/contracts-provisioner-v1 run build
```

Expected: green.

- [ ] **Step 5: Commit skeleton**

```bash
git add packages/contracts/provisioner/v1/
git commit -m "feat(contracts-provisioner-v1): scaffold empty package"
```

### Task 2.2: Move `provisioner-contract.ts` and split env-mapping

**Files:**
- Move: `packages/deploy/deploy-core/src/provisioner-contract.ts` → `packages/contracts/provisioner/v1/src/provisioner-contract.ts`
- Create: `packages/contracts/provisioner/v1/src/result.ts` (local minimal Result)
- Create: `packages/contracts/provisioner/v1/src/env-mapping-types.ts` (cut types from env-mapping)
- Modify: `packages/deploy/deploy-core/src/provisioner-env-mapping.ts` (drop types, import from contract)
- Modify: `packages/contracts/provisioner/v1/src/index.ts`

- [ ] **Step 1: `git mv` the contract file**

```bash
git mv packages/deploy/deploy-core/src/provisioner-contract.ts \
       packages/contracts/provisioner/v1/src/provisioner-contract.ts
```

- [ ] **Step 2: Create `result.ts` in the new contract** (the moved file imports `Result` from `./result.js`)

```ts
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
```

- [ ] **Step 3: Create `env-mapping-types.ts`**

```ts
export type EnvMappingEntry = {
  readonly from: string;
  readonly envName: string;
  readonly secret: boolean;
  readonly target: string;
};

export type ProvisionerEnvMapping = Readonly<Record<string, readonly EnvMappingEntry[]>>;

export type ResolvedEnvEntry = {
  readonly module: string;
  readonly target: string;
  readonly envName: string;
  readonly value: string;
  readonly secret: boolean;
};
```

- [ ] **Step 4: Replace `contracts-provisioner-v1/src/index.ts`**

```ts
export const VERSION = '1.0.0';
export type {
  ProvisionerContract,
  ProvisionerInput,
  ProvisionerOutput,
  ProvisionerLog,
  ProvisionerVendorError,
} from './provisioner-contract.js';
export type {
  EnvMappingEntry,
  ProvisionerEnvMapping,
  ResolvedEnvEntry,
} from './env-mapping-types.js';
export type { Result } from './result.js';
```

- [ ] **Step 5: Update `deploy-core/src/provisioner-env-mapping.ts`**

Remove the three type declarations (`EnvMappingEntry`, `ProvisionerEnvMapping`, `ResolvedEnvEntry`) from the file. At the top, replace whatever produced them with:

```ts
import type {
  EnvMappingEntry,
  ProvisionerEnvMapping,
  ResolvedEnvEntry,
} from '@rntme/contracts-provisioner-v1';
```

Keep `resolveEnvMappings` and helper functions intact.

- [ ] **Step 6: Build the contract**

```bash
pnpm -F @rntme/contracts-provisioner-v1 run build
```

Expected: green.

### Task 2.3: Update `deploy-core` package.json + internal imports + index re-exports

**Files:**
- Modify: `packages/deploy/deploy-core/package.json`
- Modify: `packages/deploy/deploy-core/src/index.ts`

- [ ] **Step 1: Add the contract to `deploy-core` deps**

In `packages/deploy/deploy-core/package.json#dependencies`, add: `"@rntme/contracts-provisioner-v1": "workspace:*"`.

- [ ] **Step 2: Update `deploy-core/src/index.ts`**

Find the line:

```ts
export type { EnvMappingEntry, ProvisionerEnvMapping, ResolvedEnvEntry } from './provisioner-env-mapping.js';
```

Replace with:

```ts
export type { EnvMappingEntry, ProvisionerEnvMapping, ResolvedEnvEntry } from '@rntme/contracts-provisioner-v1';
```

If there are also re-exports from the moved `./provisioner-contract.js`, change them to `from '@rntme/contracts-provisioner-v1'` likewise.

- [ ] **Step 3: Find any other internal imports of moved types**

```bash
grep -rn "provisioner-contract\|ProvisionerContract\|ProvisionerInput\|ProvisionerOutput\|ProvisionerLog\|ProvisionerVendorError" \
  packages/deploy/deploy-core/src
```

For each match, ensure the import resolves: imports of these types must come from `@rntme/contracts-provisioner-v1` (not from `./provisioner-contract.js`).

- [ ] **Step 4: Build deploy-core**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/deploy-core run build
```

Expected: green.

### Task 2.4: Migrate `deploy-core/test/conformance/provisioner-contract.test.ts`

**Files:**
- Modify (or move): `packages/deploy/deploy-core/test/conformance/provisioner-contract.test.ts`

- [ ] **Step 1: Inspect what the test imports**

```bash
head -30 packages/deploy/deploy-core/test/conformance/provisioner-contract.test.ts
```

- [ ] **Step 2: Decide migrate vs. update-in-place**

If the test exclusively tests the contract surface (no orchestrator coupling), `git mv` it to `packages/contracts/provisioner/v1/test/unit/`. Otherwise update its imports to `@rntme/contracts-provisioner-v1` and leave it in deploy-core.

- [ ] **Step 3: Run the test**

```bash
pnpm -F @rntme/deploy-core run test     # if kept here
# or
pnpm -F @rntme/contracts-provisioner-v1 run test    # if moved
```

Expected: green.

### Task 2.5: Migrate `identity-auth0`

**Files:**
- Modify: `modules/identity/auth0/src/provisioner.ts` (single import line)
- Modify: `modules/identity/auth0/package.json` (drop `@rntme/deploy-core`, add the contract; update `build:deps`)

- [ ] **Step 1: Update import**

In `modules/identity/auth0/src/provisioner.ts`, replace:

```ts
import type { ProvisionerEnvMapping } from '@rntme/deploy-core';
```

With:

```ts
import type { ProvisionerEnvMapping } from '@rntme/contracts-provisioner-v1';
```

- [ ] **Step 2: Update `auth0/package.json` dependencies**

Remove: `"@rntme/deploy-core": "workspace:*"`.
Add: `"@rntme/contracts-provisioner-v1": "workspace:*"`.

- [ ] **Step 3: Update `auth0/package.json#scripts.build:deps`**

Change the `pnpm -F @rntme/deploy-core run build` segment to `pnpm -F @rntme/contracts-provisioner-v1 run build`.

- [ ] **Step 4: Verify auth0 still builds**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/identity-auth0 run build
pnpm -F @rntme/identity-auth0 run test
```

Expected: green.

### Task 2.6: Doc updates for PR 2

- Modify: `packages/contracts/provisioner/v1/README.md` — uniform-template README (mirror PR 1 README structure but for provisioner contract).
- Modify: `packages/deploy/deploy-core/README.md` — note the contract is extracted.
- Modify: `modules/identity/auth0/README.md` — point provisioner reference to the new contract.
- Modify: `AGENTS.md` §3 + §10 (add `contracts-provisioner-v1`); §6 add a `How do I add a provisioner to a vendor module` how-to if absent.
- Modify: `CLAUDE.md` "Architecture in one paragraph" — mention the new contract.
- Modify: top-level `README.md` packages-table — add row.

- [ ] **Step 1**: write `contracts-provisioner-v1/README.md`. The template is identical to PR 1's; substitute Provisioner-specific File map, API, etc.

- [ ] **Step 2..N**: edit each doc file as listed.

### Task 2.7: PR 2 final verification + commit + open PR

- [ ] **Step 1: Run 5 gates**

```bash
pnpm install --frozen-lockfile
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

Expected: green.

- [ ] **Step 2: Negative-grep**

```bash
git grep "@rntme/deploy-core" modules/identity/auth0/
```

Expected: zero matches.

- [ ] **Step 3: Commit + push + open PR**

```bash
git add -A
git commit -m "refactor(contracts): extract @rntme/contracts-provisioner-v1 from deploy-core

Moves the provisioner runtime contract (ProvisionerContract, ProvisionerInput,
ProvisionerOutput, ProvisionerLog, ProvisionerVendorError) and the env-mapping
types out of deploy-core into a dedicated contract package. Migrates auth0 off
its @rntme/deploy-core dependency. resolveEnvMappings stays in deploy-core."
git push -u origin extract-contracts-provisioner-v1
gh pr create --title "refactor(contracts): extract contracts-provisioner-v1" --body "$(cat <<'EOF'
## Summary
- Adds `@rntme/contracts-provisioner-v1` (ProvisionerContract, ProvisionerInput/Output, ProvisionerLog, ProvisionerVendorError, env-mapping types).
- Migrates `identity-auth0` off its `@rntme/deploy-core` dependency.
- `resolveEnvMappings` stays in `deploy-core`; only types move.
- Spec: docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md

## Test plan
- [x] 5 gates green (typecheck, test, build, lint, install)
- [x] `git grep '@rntme/deploy-core' modules/identity/auth0` returns zero matches

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 3 — `@rntme/contracts-client-runtime-v1` (highest-risk PR)

**PR branch:** `extract-contracts-client-runtime-v1` (off main after PR 2 merges)

**Blast radius:** new package + 7 file moves out of `ui-runtime/src/client/` + `ui-runtime/{src/index of client,host bootstrap files,package.json}` + auth0 client (3 files + package.json) + tiptap module + google-analytics module + `blueprint/src/compose/virtual-entry.ts` + `blueprint/test/smoke-ui-modules.test.ts` + `apps/platform-http/test/unit/deploy/executor.test.ts` (test).

### Task 3.1: Discovery — confirm exact file split (resolve open question O1)

**Files:** none modified; reading only.

- [ ] **Step 1: For each candidate file in `ui-runtime/src/client/`, run a cross-package grep**

```bash
for f in module-context hooks transport-chain lifecycle-bus operation-registry visibility router; do
  echo "=== $f.ts (or .tsx) — external consumers ==="
  git grep -l "ui-runtime/client/$f\|from '@rntme/ui-runtime/client'" -- ':!packages/runtime/ui-runtime'
done
```

- [ ] **Step 2: Confirm host-bootstrap files stay**

For `entry.tsx`, `no-auth-entry.ts`, `screen-loader.ts`, `state.ts`, `layout-manager.tsx`, `driver.ts`, `registry.ts`, `styles.css` — confirm no module imports them directly. They stay in ui-runtime.

- [ ] **Step 3: Document the final file list**

Record the confirmed list in PR description (and reuse below). Default list (per spec): MOVE = `module-context.ts`, `hooks.ts`, `transport-chain.ts`, `lifecycle-bus.ts`, `operation-registry.ts`, `visibility.ts`, `router.ts`. STAY = the rest.

### Task 3.2: Create package skeleton

**Files:** new package skeleton (mirror PR 1).

- [ ] **Step 1: Create branch + skeleton files**

Same as PR 1 Task 1.1 but with:
- `name`: `@rntme/contracts-client-runtime-v1`
- `description`: `Client runtime contract — types, hooks, and providers a module's client block consumes when mounted in a SPA host.`
- `dependencies`: `react: peer ^19`, `@json-render/core: workspace:*` (or peer; check what ui-runtime currently uses).
- `peerDependencies`: `react: ^19`.

- [ ] **Step 2: Build + commit empty skeleton**

### Task 3.3: Move files out of `ui-runtime/src/client/`

**Files:**
- Move 7 files (per Task 3.1) into `packages/contracts/client-runtime/v1/src/`.
- Modify: `packages/contracts/client-runtime/v1/src/index.ts` (re-export everything that the old `ui-runtime/src/client/index.ts` re-exported from these files).
- Modify: `packages/runtime/ui-runtime/src/client/index.ts` (drop re-exports of moved symbols; keep host-bootstrap re-exports).

- [ ] **Step 1: `git mv` the 7 files**

```bash
mkdir -p packages/contracts/client-runtime/v1/src
for f in module-context.ts hooks.ts transport-chain.ts lifecycle-bus.ts operation-registry.ts visibility.ts router.ts; do
  git mv "packages/runtime/ui-runtime/src/client/$f" \
         "packages/contracts/client-runtime/v1/src/$f"
done
```

- [ ] **Step 2: Update `contracts-client-runtime-v1/src/index.ts`** — copy the moved-symbols subset of the old `ui-runtime/src/client/index.ts` re-exports.

```ts
export const VERSION = '1.0.0';

export { createOperationRegistry, type OperationRegistry, type OperationHandler } from './operation-registry.js';
export { createLifecycleBus, type LifecycleBus, type LifecycleEvents } from './lifecycle-bus.js';
export {
  createTransportChain,
  type TransportChain,
  type TransportMiddleware,
} from './transport-chain.js';
export { evaluateVisible, type Visible } from './visibility.js';
export { createModuleBootContext, type ModuleBootContext } from './module-context.js';
export {
  useTransport,
  useStateStore,
  useOperationRegistry,
  useModuleAction,
  TransportProvider,
  StoreProvider,
  RegistryProvider,
} from './hooks.js';
export { matchRoute, expandTemplate, type RouteMatch } from './router.js';
```

- [ ] **Step 3: Trim `ui-runtime/src/client/index.ts`**

Replace it with re-exports of host-bootstrap items only:

```ts
export { createScreenLoader, type ScreenLoader } from './screen-loader.js';
export { createRegistry, type RuntimeBridge } from './registry.js';
export { createDriver, type Driver, type DriverOptions } from './driver.js';
export { createRuntimeStateStore, type RuntimeStateStoreOptions } from './state.js';
export { AppShell, type AppShellProps } from './layout-manager.js';
export { hydrateApp, mountUiRuntime, type ModuleSpec, type MountUiRuntimeOptions, type MountUiRuntimeResult } from './entry.js';
```

(Or keep this file but delete it later if nothing inside ui-runtime needs the aggregated export.)

- [ ] **Step 4: Update `ui-runtime/src/client/*` host files**

The host files (`entry.tsx`, `driver.ts`, `registry.ts`, `state.ts`, `layout-manager.tsx`, `screen-loader.ts`, `no-auth-entry.ts`) currently import from `./hooks.js`, `./module-context.js`, etc. (relative). Replace those with `from '@rntme/contracts-client-runtime-v1'`.

```bash
git ls-files 'packages/runtime/ui-runtime/src/client/**' \
  | xargs grep -l "from './\\(hooks\\|module-context\\|transport-chain\\|lifecycle-bus\\|operation-registry\\|visibility\\|router\\)" \
  | while read f; do
      sed -i \
        -e "s|from './hooks\\.js'|from '@rntme/contracts-client-runtime-v1'|g" \
        -e "s|from './module-context\\.js'|from '@rntme/contracts-client-runtime-v1'|g" \
        -e "s|from './transport-chain\\.js'|from '@rntme/contracts-client-runtime-v1'|g" \
        -e "s|from './lifecycle-bus\\.js'|from '@rntme/contracts-client-runtime-v1'|g" \
        -e "s|from './operation-registry\\.js'|from '@rntme/contracts-client-runtime-v1'|g" \
        -e "s|from './visibility\\.js'|from '@rntme/contracts-client-runtime-v1'|g" \
        -e "s|from './router\\.js'|from '@rntme/contracts-client-runtime-v1'|g" \
        "$f"
    done
```

- [ ] **Step 5: Update `ui-runtime/package.json`**

Add `"@rntme/contracts-client-runtime-v1": "workspace:*"` to `dependencies`.

- [ ] **Step 6: Remove subpath export from `ui-runtime/package.json`**

Delete the `"./client"` block from the `exports` map. Keep `"."` (main entry).

- [ ] **Step 7: Build**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/contracts-client-runtime-v1 run build
pnpm -F @rntme/ui-runtime run build
```

Expected: green.

### Task 3.4: Migrate `identity-auth0` client

**Files:**
- Modify: `modules/identity/auth0/client/index.ts`
- Modify: `modules/identity/auth0/client/components/LoginScreen.tsx`
- Modify: `modules/identity/auth0/client/components/UserBadge.tsx`
- Modify: `modules/identity/auth0/test/unit/boot.test.ts`
- Modify: `modules/identity/auth0/test/unit/client/LoginScreen.test.tsx`
- Modify: `modules/identity/auth0/test/unit/client/UserBadge.test.tsx`
- Modify: `modules/identity/auth0/package.json`
- Modify: `modules/identity/auth0/Dockerfile` (if it references `@rntme/ui-runtime/client`)

- [ ] **Step 1: Bulk-replace import paths**

```bash
git ls-files 'modules/identity/auth0/**/*.{ts,tsx}' \
  | xargs grep -l "@rntme/ui-runtime/client" \
  | xargs sed -i "s|'@rntme/ui-runtime/client'|'@rntme/contracts-client-runtime-v1'|g"
```

- [ ] **Step 2: Inspect `Dockerfile`**

```bash
grep -n "ui-runtime/client" modules/identity/auth0/Dockerfile
```

If it references the path (probably as a build-time copy), replace with `contracts-client-runtime-v1`.

- [ ] **Step 3: Update `auth0/package.json`**

In `peerDependencies`: remove `@rntme/ui-runtime`.
In `devDependencies`: remove `@rntme/ui-runtime`.
In `dependencies`: add `"@rntme/contracts-client-runtime-v1": "workspace:*"`.

- [ ] **Step 4: Build + test auth0**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/identity-auth0 run build
pnpm -F @rntme/identity-auth0 run test
```

Expected: green.

### Task 3.5: Migrate other modules using `ui-runtime/client`

**Files:**
- Modify: `modules/presentation/tiptap/{src/RichTextEditor.tsx,test/RichTextEditor.test.tsx,package.json}`
- Modify: `modules/analytics/google-analytics/{src/client.ts,test/unit/boot.test.ts,package.json}`

- [ ] **Step 1: Bulk-replace import paths**

```bash
git ls-files \
  'modules/presentation/tiptap/**/*.{ts,tsx}' \
  'modules/analytics/google-analytics/**/*.{ts,tsx}' \
  | xargs grep -l "@rntme/ui-runtime/client" \
  | xargs sed -i "s|'@rntme/ui-runtime/client'|'@rntme/contracts-client-runtime-v1'|g"
```

- [ ] **Step 2: Update each module's `package.json`**

For `tiptap` and `google-analytics` — same pattern as auth0 (Step 3 above): drop ui-runtime if present, add `contracts-client-runtime-v1`.

- [ ] **Step 3: Build + test each** (workspace names verified at plan time)

```bash
pnpm -F @rntme/presentation-tiptap run build && pnpm -F @rntme/presentation-tiptap run test
pnpm -F @rntme/analytics-google-analytics run build && pnpm -F @rntme/analytics-google-analytics run test
```

### Task 3.6: Migrate `blueprint` virtual-entry + smoke test

**Files:**
- Modify: `packages/artifacts/blueprint/src/compose/virtual-entry.ts`
- Modify: `packages/artifacts/blueprint/test/smoke-ui-modules.test.ts`

- [ ] **Step 1: Bulk-replace**

```bash
git ls-files 'packages/artifacts/blueprint/**' \
  | xargs grep -l "@rntme/ui-runtime/client" \
  | xargs sed -i "s|'@rntme/ui-runtime/client'|'@rntme/contracts-client-runtime-v1'|g"
```

- [ ] **Step 2: Inspect `virtual-entry.ts`**

```bash
grep -n "ui-runtime\|contracts-client-runtime" packages/artifacts/blueprint/src/compose/virtual-entry.ts
```

If `virtual-entry.ts` generates **string-literal imports** for runtime SPA bundling (i.e., it emits `import … from '@rntme/ui-runtime/client'` as text, not as a TS import), that text must point to the new package too.

- [ ] **Step 3: Build + test blueprint**

```bash
pnpm -F @rntme/blueprint run build
pnpm -F @rntme/blueprint run test
```

### Task 3.7: Migrate `apps/platform-http` test

**Files:**
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [ ] **Step 1: Bulk-replace**

```bash
sed -i "s|'@rntme/ui-runtime/client'|'@rntme/contracts-client-runtime-v1'|g" \
  apps/platform-http/test/unit/deploy/executor.test.ts
```

- [ ] **Step 2: Run platform-http tests**

```bash
pnpm -F @rntme/platform-http run test
```

### Task 3.8: SPA bundle dedup check

- [ ] **Step 1: Build SPA bundle in ui-runtime**

```bash
pnpm -F @rntme/ui-runtime run build
```

- [ ] **Step 2: Confirm exactly one copy of `contracts-client-runtime-v1` in the bundle**

Inspect the build output. If ui-runtime emits a single bundled JS file:

```bash
grep -c "contracts-client-runtime-v1" $(find packages/runtime/ui-runtime/dist -name '*.js')
```

Or, if the ESM output keeps them as separate modules, ensure no duplicate package versions:

```bash
pnpm why @rntme/contracts-client-runtime-v1
```

Expected: only one workspace version referenced. React contexts will not dedupe if there are multiple copies — this is the highest-risk regression in PR 3.

### Task 3.9: Demo end-to-end smoke

- [ ] **Step 1: Build the demo**

```bash
cd demo/notes-blueprint     # or whichever demo includes auth0
pnpm install
pnpm <demo-build-command-from-runbook>
```

- [ ] **Step 2: Boot the SPA + manual smoke**

Run the demo locally per its runbook. Confirm:
- `LoginScreen` mounts.
- Click "login" — auth0 client.boot called, redirects to auth0 (or mock).
- After return, `useStateStore` returns `/auth/status` populated; `UserBadge` renders the email.

If any of these break, the React Context dedupe is at fault. Verify by checking for two copies of `@rntme/contracts-client-runtime-v1` in the bundle/`node_modules`.

### Task 3.10: Doc updates + final verification + commit

- Modify: `packages/contracts/client-runtime/v1/README.md` (uniform template).
- Modify: `packages/runtime/ui-runtime/README.md` — note the client SDK now lives in the contract; ui-runtime hosts only bootstrap.
- Modify: `modules/identity/auth0/README.md` — update import path.
- Modify: `AGENTS.md` §3 + §10.
- Modify: `CLAUDE.md` "Architecture in one paragraph".
- Modify: top-level `README.md` packages-table.

- [ ] **Step 1: Doc edits.**

- [ ] **Step 2: Run 5 gates**

```bash
pnpm install --frozen-lockfile
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

Expected: green.

- [ ] **Step 3: Negative-grep**

```bash
git grep "@rntme/ui-runtime/client" -- ':!pnpm-lock.yaml'
```

Expected: zero matches.

- [ ] **Step 4: Commit + push + open PR**

```bash
git add -A
git commit -m "refactor(contracts): extract @rntme/contracts-client-runtime-v1 from ui-runtime

Moves the client SDK (ModuleBootContext, hooks, transport/lifecycle/operation
registries, visibility, router utilities) out of @rntme/ui-runtime/client into
a dedicated platform contract. Removes the ./client subpath export. Migrates
auth0, tiptap, google-analytics, blueprint, platform-http test."
git push -u origin extract-contracts-client-runtime-v1
gh pr create --title "refactor(contracts): extract contracts-client-runtime-v1" --body "$(cat <<'EOF'
## Summary
- Adds `@rntme/contracts-client-runtime-v1` (ModuleBootContext, hooks, Provider symbols, transport/lifecycle/operation registries, visibility evaluator, router utilities).
- Removes the `./client` subpath export from `@rntme/ui-runtime`.
- Migrates auth0, presentation-tiptap, analytics-google-analytics, blueprint virtual-entry, platform-http test.
- ui-runtime keeps host-bootstrap (entry, driver, registry, state, layout-manager, screen-loader).
- Spec: docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md

## Test plan
- [x] 5 gates green
- [x] SPA bundle has exactly one copy of contracts-client-runtime-v1
- [x] Demo end-to-end: LoginScreen mounts, useModuleAction works, useStateStore reads /auth/status
- [x] `git grep '@rntme/ui-runtime/client'` returns zero matches outside pnpm-lock.yaml

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 4 — `@rntme/contracts-handlers-v1`

**PR branch:** `extract-contracts-handlers-v1`

**Blast radius:** new package + `runtime/src/plugins/executors/code-command-executor.ts` + `module-skeleton/src/handlers.ts` + `module-skeleton/package.json`. **No public re-export break** (runtime/src/index.ts does not currently re-export the handler types — confirmed via grep).

### Task 4.1: Create package skeleton

**Files:** new package skeleton.

- [ ] **Step 1**: branch `extract-contracts-handlers-v1`; mirror PR 1 templates with:
  - `name`: `@rntme/contracts-handlers-v1`
  - `description`: `Code command handler contract — type a service or module's command handler must implement to be wired into the runtime executor.`
  - `dependencies`: empty (types only)

- [ ] **Step 2**: Build empty + commit.

### Task 4.2: Move handler types

**Files:**
- Modify: `packages/runtime/runtime/src/plugins/executors/code-command-executor.ts`
- Create: `packages/contracts/handlers/v1/src/handlers.ts`
- Modify: `packages/contracts/handlers/v1/src/index.ts`

**Important context** (verified at plan time): `CodeCommandHandler` references `CommandExecutionContext` and `CommandExecutorOutput`, which are re-exported by `runtime/src/plugins/executors/types.ts` from `@rntme/bindings-http/executor-contract`. The real definitions live in `packages/runtime/bindings-http/src/executor-contract.ts` and depend on runtime-internal types (`EventStore` from `@rntme/event-store`, `BetterSqlite3.Database`).

**This means we cannot directly import those types into the contract** — that would be `contracts → runtime/event-store`, violating R2 (contracts must be leaves).

**Strategy:** the contract declares a **minimal structural shape** of `CommandExecutionContext` and `CommandExecutorOutput` — just the fields a module's command handler legitimately needs. Runtime keeps its richer internal types; contravariance of function arguments means a richer runtime context is assignable where the contract's narrower context is expected. The contract pins the minimum; runtime can carry more, modules see less. `eventStore`, `qsmDb`, and `actor` (the runtime-internal capabilities) intentionally do NOT appear in the contract — modules don't need them.

A type-test in the contract package asserts that runtime's actual types remain assignable to the contract — so any future drift fails the build, not at runtime.

- [ ] **Step 1: Create `contracts-handlers-v1/src/handlers.ts`**

```ts
// Module-facing minimal shape of a command-handler invocation.
// Runtime may pass a richer ctx; modules see only the fields below.
// Drift is pinned by the type-test in test/unit/runtime-compat.test.ts.

export type CorrelationCtx = Readonly<{
  commandId: string;
  correlationId: string;
  traceparent: string | null;
}>;

export type CommandExecutionContext = Readonly<{
  now: () => string;
  nextId: () => string;
  correlation: CorrelationCtx;
}>;

export type CommandExecutionResult = Readonly<{
  aggregateId: string;
  version: number;
  eventIds: readonly string[];
  commandId: string;
  correlationId: string;
}>;

export type CommandExecutorErrorCode =
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_GUARD_REJECTED'
  | 'COMMAND_CONCURRENCY_CONFLICT'
  | 'COMMAND_HANDLER_THREW'
  | 'COMMAND_HANDLER_ERROR';

export type CommandExecutorError = Readonly<{
  code: CommandExecutorErrorCode;
  message: string;
  detail?: unknown;
}>;

export type CommandExecutorOutput =
  | Readonly<{ ok: true; value: CommandExecutionResult }>
  | Readonly<{ ok: false; error: CommandExecutorError }>;

export type CodeCommandHandler = (
  ctx: CommandExecutionContext,
  input: Record<string, unknown>,
) => Promise<CommandExecutorOutput>;

export type CodeCommandHandlerMap = Record<string, CodeCommandHandler>;
```

- [ ] **Step 2: Update `contracts-handlers-v1/src/index.ts`**

```ts
export const VERSION = '1.0.0';
export type {
  CorrelationCtx,
  CommandExecutionContext,
  CommandExecutionResult,
  CommandExecutorErrorCode,
  CommandExecutorError,
  CommandExecutorOutput,
  CodeCommandHandler,
  CodeCommandHandlerMap,
} from './handlers.js';
```

- [ ] **Step 3: Add a runtime-compatibility type-test**

Create `packages/contracts/handlers/v1/test/unit/runtime-compat.test.ts`:

```ts
import { expectTypeOf, test } from 'vitest';
import type {
  CodeCommandHandler as ContractHandler,
  CodeCommandHandlerMap as ContractMap,
  CommandExecutionContext as ContractCtx,
  CommandExecutorOutput as ContractOut,
} from '@rntme/contracts-handlers-v1';
import type {
  CommandExecutionContext as RuntimeCtx,
  CommandExecutorOutput as RuntimeOut,
} from '@rntme/bindings-http/executor-contract';

test('runtime context is assignable to contract context (subtype)', () => {
  // A richer runtime ctx flowing into a function typed for the narrower
  // contract ctx is fine via contravariance.
  expectTypeOf<RuntimeCtx>().toMatchTypeOf<ContractCtx>();
});

test('runtime output matches contract output exactly', () => {
  expectTypeOf<RuntimeOut>().toEqualTypeOf<ContractOut>();
});

test('a module handler typed against the contract is callable from runtime', () => {
  type _Wire = ContractHandler extends (ctx: RuntimeCtx, input: Record<string, unknown>) => Promise<RuntimeOut>
    ? true
    : false;
  expectTypeOf<_Wire>().toEqualTypeOf<true>();
});
```

The test asserts that runtime's types (richer) flow into contract types (narrower) cleanly. If runtime's types ever drift away from the contract's invariants, this build breaks first.

To run it, the contract package's `package.json#devDependencies` must include `@rntme/bindings-http: workspace:*` (devDep only — does **not** put it in the published runtime graph; depcruise excludes test files).

- [ ] **Step 4: Update `runtime/src/plugins/executors/code-command-executor.ts`**

Remove the local declarations:

```ts
export type CodeCommandHandler = (
  ctx: CommandExecutionContext,
  input: Record<string, unknown>,
) => Promise<CommandExecutorOutput>;

export type CodeCommandHandlerMap = Record<string, CodeCommandHandler>;
```

Replace the import line at the top — keep `CommandExecutor`, `CommandExecutorInput`, `CommandExecutorOutput`, `CommandExecutionContext` coming from `./types.js` (those are runtime-internal). Add:

```ts
import type { CodeCommandHandler, CodeCommandHandlerMap } from '@rntme/contracts-handlers-v1';
```

The `CodeCommandExecutor` class can keep using the rich runtime context internally; only the handler **signature** comes from the contract.

- [ ] **Step 5: Update `runtime/package.json`**

Add `"@rntme/contracts-handlers-v1": "workspace:*"` to `dependencies`.

- [ ] **Step 6: Build**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/contracts-handlers-v1 run build
pnpm -F @rntme/contracts-handlers-v1 run test
pnpm -F @rntme/runtime run build
```

Expected: green. If the contract's structural types are not assignable from runtime's, runtime's actual types have grown apart from what they ought to be — fix at the runtime side (tighten the contract's structural shape only as a last resort, after confirming the divergence is intentional).

### Task 4.3: Update `module-skeleton` source + tests

**Files:**
- Modify: `packages/tooling/module-skeleton/src/handlers.ts`
- Modify: `packages/tooling/module-skeleton/test/unit/_smoke.test.ts` (currently imports `CommandExecutionContext` from `@rntme/runtime`)
- Modify: `packages/tooling/module-skeleton/test/unit/handlers.test.ts` (inspect at execution time)
- Modify: `packages/tooling/module-skeleton/package.json`

- [ ] **Step 1: Replace import in `handlers.ts`**

In `module-skeleton/src/handlers.ts`:

```ts
import type { CodeCommandHandlerMap } from '@rntme/runtime';
```

→

```ts
import type { CodeCommandHandlerMap } from '@rntme/contracts-handlers-v1';
```

- [ ] **Step 2: Update smoke test import**

In `packages/tooling/module-skeleton/test/unit/_smoke.test.ts`:

```ts
import type { CommandExecutionContext } from '@rntme/runtime';
```

→

```ts
import type { CommandExecutionContext } from '@rntme/contracts-handlers-v1';
```

The cast `as unknown as CommandExecutionContext` works the same against the contract's narrower shape.

- [ ] **Step 3: Update `handlers.test.ts` if needed**

```bash
grep -n "from '@rntme/runtime'\|from '@rntme/event-store'" packages/tooling/module-skeleton/test/unit/handlers.test.ts
```

For each match, redirect to `@rntme/contracts-handlers-v1` if the imported symbol is one of the contract types. Anything that imports `@rntme/event-store` is integration-coupled to the real store — flag for review in PR 5 (where we'll delete it).

- [ ] **Step 4: Update `module-skeleton/package.json`**

Remove `"@rntme/runtime": "workspace:*"` from `dependencies`.
Add `"@rntme/contracts-handlers-v1": "workspace:*"` to `dependencies`.
Keep `"@rntme/event-store": "workspace:*"` in `devDependencies` for now (PR 5 removes it together with the integration test).

- [ ] **Step 5: Build + test skeleton**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/module-skeleton run build
pnpm -F @rntme/module-skeleton run test
```

Expected: green. `boot-skeleton.test.ts` still passes here because event-store is still in devDeps; it'll be dealt with in PR 5.

### Task 4.4: Doc updates for PR 4

- Modify: `packages/contracts/handlers/v1/README.md`.
- Modify: `packages/runtime/runtime/README.md` — note the contract.
- Modify: `packages/tooling/module-skeleton/README.md`.
- Modify: `AGENTS.md` §3 + §10.
- Modify: `CLAUDE.md`.
- Modify: top-level `README.md`.

### Task 4.5: PR 4 verification + commit + open PR

- [ ] **Step 1: Run 5 gates** — green expected.
- [ ] **Step 2: Negative-grep** — confirm `module-skeleton` no longer depends on `@rntme/runtime`.

```bash
grep -n "@rntme/runtime" packages/tooling/module-skeleton/package.json
```

Expected: zero matches.

- [ ] **Step 3: Commit + push + open PR**

```bash
git add -A
git commit -m "refactor(contracts): extract @rntme/contracts-handlers-v1 from runtime

Moves the CodeCommandHandler / CodeCommandHandlerMap signature into a
dedicated contract package with a structurally-minimal CommandExecutionContext
(no eventStore / qsmDb / actor — those are runtime-internal). Adds a
expectTypeOf compatibility test pinning runtime types to remain assignable
to the contract. module-skeleton now depends only on contracts-handlers-v1."
git push -u origin extract-contracts-handlers-v1
gh pr create --title "refactor(contracts): extract contracts-handlers-v1" --body "$(cat <<'EOF'
## Summary
- Adds @rntme/contracts-handlers-v1 with structurally-minimal CommandExecutionContext + CommandExecutorOutput + CodeCommandHandler/Map.
- Runtime types remain richer; type-test in the contract pins assignability.
- module-skeleton imports the contract (drops @rntme/runtime runtime dep).
- Spec: docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md

## Test plan
- [x] 5 gates green
- [x] pnpm -F @rntme/contracts-handlers-v1 run test includes expectTypeOf compatibility checks
- [x] grep '@rntme/runtime' packages/tooling/module-skeleton/package.json returns zero matches

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 5 — Rename `module-skeleton` → `module-scaffold` + cleanup

**PR branch:** `rename-module-scaffold`

**Blast radius:** the directory itself + every reference to `@rntme/module-skeleton` in metadata files (after PRs 1–4, source consumers are gone; lock file + scaffold's own README/package.json remain).

### Task 5.1: Rename directory + package name

**Files:**
- Move: `packages/tooling/module-skeleton/` → `packages/tooling/module-scaffold/`
- Modify: `packages/tooling/module-scaffold/package.json`

- [ ] **Step 1: Branch + git mv**

```bash
git checkout main && git pull && git checkout -b rename-module-scaffold
git mv packages/tooling/module-skeleton packages/tooling/module-scaffold
```

- [ ] **Step 2: Update `package.json`**

```bash
sed -i \
  -e 's|"@rntme/module-skeleton"|"@rntme/module-scaffold"|' \
  -e 's|"description": ".*"|"description": "Examples and scaffolding for rntme module authors. Holds exampleHandlers; no contract surface. Use this as a starting point — copy and modify."|' \
  packages/tooling/module-scaffold/package.json
```

### Task 5.2: Drop `event-store` devDep + remove integration test

**Files:**
- Delete: `packages/tooling/module-scaffold/test/unit/boot-skeleton.test.ts` (integration test against `SqliteEventStore` + `CodeCommandExecutor`)
- Modify: `packages/tooling/module-scaffold/package.json` (drop devDep)

The `boot-skeleton.test.ts` test wires `exampleHandlers` to a real `SqliteEventStore` and a real `CodeCommandExecutor`. It's an integration test of *example code* — toy code that exists to illustrate, not to be load-bearing. Per spec §6 PR 5, tests that lose meaning without the real event-store are deleted, not faked. This one qualifies.

- [ ] **Step 1: Delete the integration test**

```bash
git rm packages/tooling/module-scaffold/test/unit/boot-skeleton.test.ts
```

- [ ] **Step 2: Drop event-store from devDeps**

In `packages/tooling/module-scaffold/package.json#devDependencies`, delete `"@rntme/event-store": "workspace:*"`.

- [ ] **Step 3: Sanity-grep**

```bash
grep -rn "@rntme/event-store\|SqliteEventStore" packages/tooling/module-scaffold
```

Expected: zero matches. (`handlers.test.ts` and `_smoke.test.ts` should not need event-store after PR 4 redirected types to the contract.)

- [ ] **Step 4: Build + test**

```bash
pnpm install --frozen-lockfile
pnpm -F @rntme/module-scaffold run build
pnpm -F @rntme/module-scaffold run test
```

Expected: green.

### Task 5.3: Bulk-replace remaining `@rntme/module-skeleton` references

Source consumers are already migrated by PRs 1 & 4. This task catches anything else: docs, READMEs, CHANGELOG, ad-hoc scripts.

- [ ] **Step 1: Bulk-replace**

```bash
git ls-files \
  | xargs grep -l "@rntme/module-skeleton" 2>/dev/null \
  | xargs sed -i "s|@rntme/module-skeleton|@rntme/module-scaffold|g"
```

- [ ] **Step 2: Verify zero stragglers**

```bash
git grep "@rntme/module-skeleton"
```

Expected: zero matches.

### Task 5.4: Full README rewrite for `module-scaffold`

**Files:**
- Modify: `packages/tooling/module-scaffold/README.md` — full rewrite.

- [ ] **Step 1: Replace README with scaffold-purpose content**

Use the uniform template (File map / Quick start / API / Invariants / Out of scope / Where to look / Specs). The new package is `Examples and scaffolding for rntme module authors`. The README must NOT claim to host the manifest contract.

### Task 5.5: Doc updates outside the package

**Files:**
- Modify: `AGENTS.md` §10 (rename glossary entry).
- Modify: `CLAUDE.md` "Architecture in one paragraph" — replace `module-skeleton` with `module-scaffold`.
- Modify: top-level `README.md` packages-table — rename row.
- Modify: `docs/architecture.md` (if present and mentions skeleton).
- Modify: `docs/audit/00-waves.md` — close the wave entry tied to this refactor.

- [ ] **Step 1: AGENTS.md** — rename glossary entry; verify §3 mentions `module-scaffold` not `module-skeleton`.
- [ ] **Step 2: CLAUDE.md** — single substitution.
- [ ] **Step 3: top-level README.md** — single row update.
- [ ] **Step 4: docs/architecture.md** — substitute references.
- [ ] **Step 5: docs/audit/00-waves.md** — append a "Closed: platform contracts extraction wave" line under the relevant wave (per memory `audit_waves_doc.md`).

### Task 5.6: PR 5 verification + commit + open PR

- [ ] **Step 1: Run 5 gates.**
- [ ] **Step 2: Demo end-to-end smoke** (PR 5 touches scaffold deeply; rerun the demo once).
- [ ] **Step 3: Commit + push + open PR.**

```bash
git add -A
git commit -m "refactor(tooling): rename module-skeleton → module-scaffold

The package no longer hosts contracts (those moved to contracts-module-v1
in PR 1). Renames the package, drops @rntme/event-store devDep, rewrites
tests on an in-memory mock, fully rewrites the README. Closes the layering
refactor wave."
git push -u origin rename-module-scaffold
gh pr create --title "refactor(tooling): rename module-skeleton → module-scaffold" --body "$(cat <<'EOF'
## Summary
- Renames the package: `@rntme/module-skeleton` → `@rntme/module-scaffold`.
- After PRs 1 & 4 the package no longer hosts contracts; this rename matches its actual role (examples + scaffolding).
- Drops `@rntme/event-store` devDep; deletes the integration test that depended on it.
- Closes the layering refactor wave in `docs/audit/00-waves.md`.
- Spec: docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md

## Test plan
- [x] 5 gates green
- [x] `git grep '@rntme/module-skeleton'` returns zero matches across the repo
- [x] Demo end-to-end smoke green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 6 — CI guard via `dependency-cruiser`

**PR branch:** `add-dependency-cruiser-guard`

**Blast radius:** root config (`package.json`, new `.dependency-cruiser.cjs`) + CI workflow (`.github/workflows/ci.yml`).

### Task 6.1: Install dependency-cruiser

- [ ] **Step 1: Branch + install**

```bash
git checkout main && git pull && git checkout -b add-dependency-cruiser-guard
pnpm add -Dw dependency-cruiser
```

- [ ] **Step 2: Confirm install**

```bash
pnpm exec depcruise --version
```

Expected: prints a semver.

### Task 6.2: Write `.dependency-cruiser.cjs`

**Files:**
- Create: `.dependency-cruiser.cjs`

- [ ] **Step 1: Create file**

```js
module.exports = {
  forbidden: [
    {
      name: 'modules-only-import-contracts',
      severity: 'error',
      comment: 'Vendor modules are plug-ins by contract. Imports from packages/{runtime,artifacts,deploy,platform,tooling}/* are forbidden.',
      from: { path: '^modules/' },
      to:   { path: '^packages/(?!contracts/)' },
    },
    {
      name: 'contracts-must-stay-leaves',
      severity: 'error',
      comment: 'Contracts must not depend on implementations or vendor modules. A contract may depend only on other contracts.',
      from: { path: '^packages/contracts/' },
      to:   { path: '^(packages/(?!contracts/)|modules/)' },
    },
    {
      name: 'tooling-only-imports-contracts',
      severity: 'error',
      comment: 'Tooling/scaffolding ships examples for module authors; it must not pull runtime/artifacts/deploy/platform into their graph.',
      from: { path: '^packages/tooling/' },
      to:   { path: '^packages/(runtime|artifacts|deploy|platform)/' },
    },
    {
      name: 'artifacts-must-not-import-runtime',
      severity: 'error',
      comment: 'Artifacts (blueprint, qsm, pdm, …) describe what the runtime executes; any artifacts→runtime arrow is a bug.',
      from: { path: '^packages/artifacts/' },
      to:   { path: '^packages/runtime/' },
    },
    {
      name: 'deploy-must-not-import-runtime',
      severity: 'error',
      comment: 'Deploy plans/applies deployments. Anything needed from runtime must live in a contract.',
      from: { path: '^packages/deploy/' },
      to:   { path: '^packages/runtime/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.base.json' },
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^(packages|modules)/',
    exclude: { path: '(/test/|/dist/|/node_modules/|\\.test\\.ts$|\\.spec\\.ts$)' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node'],
    },
  },
};
```

### Task 6.3: Add depcruise script + sanity-run locally

- [ ] **Step 1: Add to root `package.json#scripts`**

```json
"depcruise": "depcruise --config .dependency-cruiser.cjs packages modules"
```

- [ ] **Step 2: Run locally**

```bash
pnpm depcruise
```

Expected: zero violations. If anything fails, that's a real layering issue uncovered post-refactor — investigate (likely a missed migration; do not silence the rule).

### Task 6.4: Manual negative-test (one-time, must verify by hand)

- [ ] **Step 1: Inject a violation**

In `modules/identity/auth0/src/index.ts`, add at the top:

```ts
import '@rntme/runtime';
```

- [ ] **Step 2: Run depcruise**

```bash
pnpm depcruise
```

Expected: fails with rule `modules-only-import-contracts`. Confirm the error message includes both the rule name and the comment text from the config.

- [ ] **Step 3: Inject the second violation**

Revert step 1. In `packages/contracts/module/v1/src/index.ts`, add:

```ts
import '@rntme/runtime';
```

- [ ] **Step 4: Run depcruise**

Expected: fails with rule `contracts-must-stay-leaves`.

- [ ] **Step 5: Revert all violations and re-run**

```bash
git checkout -- modules/identity/auth0/src/index.ts packages/contracts/module/v1/src/index.ts
pnpm depcruise
```

Expected: zero violations. Both rules proven to fire correctly.

### Task 6.5: Add depcruise to CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Inspect existing CI**

```bash
cat .github/workflows/ci.yml
```

- [ ] **Step 2: Add a step alongside `typecheck`/`test`/`lint`**

```yaml
      - name: dependency layering check
        run: pnpm depcruise
```

Place it under the same job that runs the other gates, after `pnpm install`.

### Task 6.6: Doc updates for PR 6

- Modify: `AGENTS.md` — new section (or §11 extension) `Layering enforcement`. Document the 6 rules + escape-hatch convention (named `pathNot` with comment + spec/PR link, never `severity: warn`).
- Modify: `CLAUDE.md` "Non-obvious conventions" — add one bullet:

```markdown
- **Layering is enforced.** `dependency-cruiser` runs in CI and blocks merges that violate the rules in `.dependency-cruiser.cjs` (modules import only contracts, contracts are leaves, tooling stays above implementations, artifacts/deploy never import runtime, no cycles). See AGENTS.md §Layering enforcement.
```

- Modify: top-level `README.md` "Commands" table — add `pnpm depcruise` row.

### Task 6.7: PR 6 verification + commit + open PR

- [ ] **Step 1: Run 5 gates + depcruise**

```bash
pnpm install --frozen-lockfile
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm -r run lint
pnpm depcruise
```

Expected: all green.

- [ ] **Step 2: Commit + push + open PR**

```bash
git add -A
git commit -m "ci: add dependency-cruiser layering guard

Locks the platform-contracts layering: modules import only contracts,
contracts are leaves, tooling cannot pull implementations, artifacts and
deploy cannot import runtime, no cycles. Rules manually proven to fire
on injected violations. Spec:
docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md."
git push -u origin add-dependency-cruiser-guard
gh pr create --title "ci: add dependency-cruiser layering guard" --body "$(cat <<'EOF'
## Summary
- Adds `dependency-cruiser` with 6 rules locking the platform-contracts layering.
- Rules: modules→contracts only, contracts are leaves, tooling cannot pull implementations, artifacts/deploy never import runtime, no cycles.
- CI runs `pnpm depcruise` alongside typecheck/test/lint.
- Manually proven to fire on injected violations in both directions (modules→runtime and contracts→runtime).
- Spec: docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md §6

## Test plan
- [x] `pnpm depcruise` returns 0 violations on main
- [x] Negative-test confirmed: violation in modules/identity/auth0 fires `modules-only-import-contracts`; violation in packages/contracts/module/v1 fires `contracts-must-stay-leaves`
- [x] CI workflow green on this PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance criteria (mirror spec §9)

After all 6 PRs merge:

- [ ] All 5 violations from spec §1 are gone (`pnpm depcruise` reports 0 violations against the rules in spec §6).
- [ ] No regression: `pnpm -r {typecheck,test,build,lint}` green on `main`.
- [ ] Demo blueprint boots end-to-end and the auth0 client mounts correctly.
- [ ] Documentation updated per spec §5 doc table.
- [ ] CI guard live and proven via the manual negative-test (PR 6 Task 6.4).
- [ ] `module-skeleton` no longer exists in the workspace; `module-scaffold` ships with examples only.

## Notes for implementer

- **Type-only imports.** Many of the moved symbols are TypeScript types only. They erase at runtime — there is no JS bundle impact from moving a type. The dep additions in `package.json` are still required for `pnpm install` to resolve the import path.
- **`Result<T,E>` minimal in contracts.** Each new contract that needs `Result` declares its own minimal version. We do not normalize Result project-wide in this refactor.
- **Demo-blueprint runbook.** The exact commands depend on the demo's local runbook. Confirm during PR 3/PR 5 demo smokes.
- **Branch hygiene.** PRs 2 and 3 may be developed in parallel branches but must merge in order. PRs 1, 4, 5 must be sequential due to overlap with `module-skeleton`.
