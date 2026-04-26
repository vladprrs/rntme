# Identity Canonical Contract v1 — Plan 1: `_common/v1/` and `identity/v1/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land two new workspace packages — `@rntme/contracts-common-v1` and `@rntme/contracts-identity-v1` — implementing the protobuf shapes, generated TS bindings, error codes, and READMEs defined by `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md`. After this plan, `pnpm -r run build && test && lint && typecheck` passes for both packages and consumers can `import { User, CanonicalRef, … } from '@rntme/contracts-identity-v1'`.

**Architecture:** Two leaf workspace packages under `packages/contracts/<category>/v<n>/`. Each owns its `proto/*.proto` source and generates `src/index.ts` via `protobufjs` static-module codegen (`pbjs` + `pbts`). `identity/v1/` declares a workspace dependency on `common/v1/` and imports its proto via the `protobufjs` `--path` resolver. Tests are vitest round-trip cases that assert encode→decode preserves the canonical shape.

**Tech Stack:** TypeScript 5.5, `protobufjs` static-module codegen (`pbjs`/`pbts`, already a transitive dep via `@rntme/bindings-grpc`), Node 20+, pnpm 9.12+ workspaces, vitest, eslint flat config — all consistent with existing rntme packages.

**Spec reference:** `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` §4 (layout), §5 (`common.proto`), §6 (entities & enums), §7 (service & request/response), §7.3 (`error-codes.json`), §8 (events), §11 (merge order).

---

## File Structure

Files this plan creates or modifies:

**Created**
- `pnpm-workspace.yaml` (modify; below)
- `packages/contracts/_common/v1/package.json`
- `packages/contracts/_common/v1/tsconfig.json`
- `packages/contracts/_common/v1/tsconfig.check.json`
- `packages/contracts/_common/v1/eslint.config.mjs`
- `packages/contracts/_common/v1/proto/common.proto`
- `packages/contracts/_common/v1/scripts/gen.mjs` (codegen driver)
- `packages/contracts/_common/v1/src/proto.gen.js` (generated; tracked)
- `packages/contracts/_common/v1/src/proto.gen.d.ts` (generated; tracked)
- `packages/contracts/_common/v1/src/index.ts` (re-export from generated)
- `packages/contracts/_common/v1/test/round-trip.test.ts`
- `packages/contracts/_common/v1/error-codes.json`
- `packages/contracts/_common/v1/README.md`
- `packages/contracts/identity/v1/package.json`
- `packages/contracts/identity/v1/tsconfig.json`
- `packages/contracts/identity/v1/tsconfig.check.json`
- `packages/contracts/identity/v1/eslint.config.mjs`
- `packages/contracts/identity/v1/proto/identity.proto`
- `packages/contracts/identity/v1/proto/identity-events.proto`
- `packages/contracts/identity/v1/scripts/gen.mjs`
- `packages/contracts/identity/v1/src/proto.gen.js`
- `packages/contracts/identity/v1/src/proto.gen.d.ts`
- `packages/contracts/identity/v1/src/index.ts`
- `packages/contracts/identity/v1/src/error-codes.ts` (typed re-export of JSON)
- `packages/contracts/identity/v1/test/entities.test.ts`
- `packages/contracts/identity/v1/test/events.test.ts`
- `packages/contracts/identity/v1/test/error-codes.test.ts`
- `packages/contracts/identity/v1/test/service-shape.test.ts`
- `packages/contracts/identity/v1/error-codes.json`
- `packages/contracts/identity/v1/README.md`

**Modified**
- `pnpm-workspace.yaml` — add globs for nested contract packages.
- `AGENTS.md` — §3 layering update; §10 glossary entries; §6 how-to entry for "Add a category contract".
- `README.md` — packages table.

---

## Codegen approach (closes spec OQ-IDV1-1)

This plan locks codegen on `protobufjs` static-module via `pbjs --target static-module` followed by `pbts`. Reasoning:

1. **Already a transitive dep.** `@rntme/bindings-grpc` already pulls `protobufjs ^7.2.0` into the workspace. No new heavyweight tooling.
2. **No `protoc` binary required.** `pbjs` is pure-JS, runs on every dev/CI machine without setup. `buf` and `ts-proto` would each require a protoc-compatible binary.
3. **ESM-friendly output.** `pbjs --target static-module --wrap es6` emits an ESM module with `Type.encode/decode/create/verify/toObject` per message — matches our `"type": "module"` package convention.

The DX cost — `User.encode(user).finish()` instead of bare object — is acceptable for a generated contract package whose primary downstream is a small number of vendor-module adapters. Re-evaluation can land in a v1.minor or v2 if it bites.

The per-package codegen driver is a tiny ESM script (`scripts/gen.mjs`) invoked via `pnpm run proto:gen`. Generated files are committed (so consumers don't need codegen at install time) and `.gitattributes` marks them `linguist-generated=true` so PR diffs hide them.

---

## Task 1: Workspace bootstrap

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `packages/contracts/_common/v1/.gitkeep`
- Create: `packages/contracts/identity/v1/.gitkeep`

- [ ] **Step 1: Read current workspace globs**

Run: `cat pnpm-workspace.yaml`
Expected output:
```yaml
packages:
  - "packages/*"
  - "demo/*"
  - "rntme-cli/packages/*"
```

- [ ] **Step 2: Extend workspace globs to cover nested contract packages**

Replace `pnpm-workspace.yaml` contents with:

```yaml
packages:
  - "packages/*"
  - "packages/contracts/*/v*"
  - "demo/*"
  - "rntme-cli/packages/*"
```

The new glob `packages/contracts/*/v*` matches `packages/contracts/_common/v1`, `packages/contracts/identity/v1`, and any future `packages/contracts/<category>/v<n>` directory. The `_common` directory starts with an underscore but pnpm globbing treats it as any other character.

- [ ] **Step 3: Create the empty contract package directories**

Run:
```bash
mkdir -p packages/contracts/_common/v1
mkdir -p packages/contracts/identity/v1
touch packages/contracts/_common/v1/.gitkeep
touch packages/contracts/identity/v1/.gitkeep
```

- [ ] **Step 4: Verify pnpm still installs cleanly**

Run: `pnpm install --frozen-lockfile=false`
Expected: install succeeds; pnpm warns or silently includes the new (empty) directories. The empty directories have no `package.json` yet so pnpm will simply not list them as workspace packages — that's fine. No errors.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml packages/contracts/_common/v1/.gitkeep packages/contracts/identity/v1/.gitkeep
git commit -m "chore: extend pnpm workspace to nested contract packages"
```

---

## Task 2: `@rntme/contracts-common-v1` package skeleton

**Files:**
- Create: `packages/contracts/_common/v1/package.json`
- Create: `packages/contracts/_common/v1/tsconfig.json`
- Create: `packages/contracts/_common/v1/tsconfig.check.json`
- Create: `packages/contracts/_common/v1/eslint.config.mjs`
- Create: `packages/contracts/_common/v1/error-codes.json`
- Delete: `packages/contracts/_common/v1/.gitkeep`

- [ ] **Step 1: Write `package.json`**

Create `packages/contracts/_common/v1/package.json`:

```json
{
  "name": "@rntme/contracts-common-v1",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Shared cross-category protobuf primitives for rntme canonical contracts (CanonicalRef, CommandContext, Name, ListRequest, Metadata).",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "proto",
    "error-codes.json",
    "README.md"
  ],
  "scripts": {
    "proto:gen": "node scripts/gen.mjs",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "protobufjs": "^7.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

Create `packages/contracts/_common/v1/tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false,
    "allowJs": true
  },
  "include": ["src/**/*.ts", "src/**/*.js", "src/**/*.d.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

`allowJs: true` is required because `proto.gen.js` is JavaScript, with type info supplied by `proto.gen.d.ts` alongside.

- [ ] **Step 3: Write `tsconfig.check.json`**

Create `packages/contracts/_common/v1/tsconfig.check.json`:

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
  "include": ["src/**/*.ts", "src/**/*.js", "src/**/*.d.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: Write `eslint.config.mjs`**

Create `packages/contracts/_common/v1/eslint.config.mjs`:

```javascript
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/proto.gen.*'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
      globals: {
        console: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
];
```

`src/proto.gen.*` is in the ignore list — generated code is exempt from lint.

- [ ] **Step 5: Write empty `error-codes.json`**

Create `packages/contracts/_common/v1/error-codes.json`:

```json
{}
```

The `_common` package has no domain and emits no errors. The empty object preserves the per-package shape from modules-monorepo §5.1.

- [ ] **Step 6: Remove `.gitkeep`**

Run: `rm packages/contracts/_common/v1/.gitkeep`

- [ ] **Step 7: Run pnpm install and confirm the package is in the workspace**

Run: `pnpm install --frozen-lockfile=false`

Then: `pnpm list -r --depth -1 | grep contracts-common-v1`
Expected: line containing `@rntme/contracts-common-v1 0.0.0`

- [ ] **Step 8: Commit**

```bash
git add pnpm-lock.yaml packages/contracts/_common/v1
git commit -m "feat(contracts-common-v1): scaffold package"
```

---

## Task 3: `_common/v1/proto/common.proto` and codegen pipeline

**Files:**
- Create: `packages/contracts/_common/v1/proto/common.proto`
- Create: `packages/contracts/_common/v1/scripts/gen.mjs`
- Create: `packages/contracts/_common/v1/src/proto.gen.js` (generated)
- Create: `packages/contracts/_common/v1/src/proto.gen.d.ts` (generated)
- Create: `packages/contracts/_common/v1/src/index.ts`
- Create: `packages/contracts/_common/v1/.gitattributes`

- [ ] **Step 1: Write `proto/common.proto` (full file from spec §5)**

Create `packages/contracts/_common/v1/proto/common.proto`:

```protobuf
syntax = "proto3";
package rntme.contracts.common.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";

// Canonical reference. Every category aggregate begins with one of these.
message CanonicalRef {
  string canonical_id = 1;
  string vendor_id = 2;
  string module_name = 3;
  string module_version = 4;
  string contract_version = 5;
}

// Command context. Required on every Command RPC across every category.
message CommandContext {
  string idempotency_key = 1;
  string correlation_id = 2;
  string actor_user_id = 3;
  string actor_type = 4;
  string tenant_id = 5;
}

// Person name. Lives in _common because Payments needs the same shape.
message Name {
  string given = 1;
  string family = 2;
  string display = 3;
}

// Universal List request.
message ListRequest {
  int32 limit = 1;
  string cursor = 2;
  int32 offset = 3;
  repeated Filter filters = 4;
  repeated Sort sorts = 5;
}

message Filter {
  string field = 1;
  FilterOperator operator = 2;
  string value = 3;
  repeated string values = 4;
}

enum FilterOperator {
  FILTER_OPERATOR_UNSPECIFIED = 0;
  FILTER_OPERATOR_EQ = 1;
  FILTER_OPERATOR_NEQ = 2;
  FILTER_OPERATOR_GT = 3;
  FILTER_OPERATOR_GTE = 4;
  FILTER_OPERATOR_LT = 5;
  FILTER_OPERATOR_LTE = 6;
  FILTER_OPERATOR_IN = 7;
  FILTER_OPERATOR_NOT_IN = 8;
  FILTER_OPERATOR_CONTAINS = 9;
  FILTER_OPERATOR_PREFIX = 10;
  FILTER_OPERATOR_SUFFIX = 11;
}

message Sort {
  string field = 1;
  SortDirection direction = 2;
}

enum SortDirection {
  SORT_DIRECTION_UNSPECIFIED = 0;
  SORT_DIRECTION_ASC = 1;
  SORT_DIRECTION_DESC = 2;
}

message ListResponseMeta {
  int32 limit = 1;
  string next_cursor = 2;
  string prev_cursor = 3;
  int32 total_count = 4;
  bool has_more = 5;
}

// Three-level metadata.
message Metadata {
  google.protobuf.Struct public = 1;
  google.protobuf.Struct private = 2;
  google.protobuf.Struct unsafe = 3;
}
```

- [ ] **Step 2: Write codegen driver `scripts/gen.mjs`**

Create `packages/contracts/_common/v1/scripts/gen.mjs`:

```javascript
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const protoFile = resolve(pkgRoot, 'proto/common.proto');
const outJs = resolve(pkgRoot, 'src/proto.gen.js');
const outDts = resolve(pkgRoot, 'src/proto.gen.d.ts');

// Resolve protobufjs CLI binaries from this package's node_modules.
const pbjs = resolve(pkgRoot, 'node_modules/.bin/pbjs');
const pbts = resolve(pkgRoot, 'node_modules/.bin/pbts');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: pkgRoot });
}

// pbjs needs the google/protobuf well-known types path. protobufjs ships them.
const pbjsRoot = resolve(pkgRoot, 'node_modules/protobufjs');
run(`${pbjs} --target static-module --wrap es6 --es6 --keep-case --path ${pbjsRoot} --out ${outJs} ${protoFile}`);
run(`${pbts} --out ${outDts} ${outJs}`);

console.log('Codegen complete.');
```

- [ ] **Step 3: Write `src/index.ts` re-export barrel**

Create `packages/contracts/_common/v1/src/index.ts`:

```typescript
export * as proto from './proto.gen.js';
export type {
  rntme as Rntme,
} from './proto.gen.d.ts';
```

The `proto` namespace gives consumers `proto.rntme.contracts.common.v1.CanonicalRef.encode(...)`. The named-type re-export gives them types like `Rntme.contracts.common.v1.CanonicalRef`.

- [ ] **Step 4: Run codegen and produce generated files**

Run: `pnpm -F @rntme/contracts-common-v1 run proto:gen`
Expected: writes `src/proto.gen.js` and `src/proto.gen.d.ts`. The output is verbose — protobufjs CLI logs each message it writes.

- [ ] **Step 5: Mark generated files as linguist-generated**

Create `packages/contracts/_common/v1/.gitattributes`:

```
src/proto.gen.js linguist-generated=true
src/proto.gen.d.ts linguist-generated=true
```

- [ ] **Step 6: Verify build and typecheck pass**

Run: `pnpm -F @rntme/contracts-common-v1 run build`
Expected: emits `dist/index.js` and `dist/index.d.ts`. No errors.

Run: `pnpm -F @rntme/contracts-common-v1 run typecheck`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/_common/v1
git commit -m "feat(contracts-common-v1): proto + codegen + barrel export"
```

---

## Task 4: `_common/v1/` round-trip tests

**Files:**
- Create: `packages/contracts/_common/v1/test/round-trip.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/_common/v1/test/round-trip.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { proto } from '../src/index.js';

const { CanonicalRef, CommandContext, Name, ListRequest, Filter, Sort, ListResponseMeta, Metadata, FilterOperator, SortDirection } =
  proto.rntme.contracts.common.v1;

function roundTrip<T>(Type: { encode(m: T): { finish(): Uint8Array }; decode(buf: Uint8Array): T; toObject(m: T, opts?: object): object }, message: T): object {
  const buf = Type.encode(message).finish();
  const decoded = Type.decode(buf);
  return Type.toObject(decoded, { defaults: true, longs: String });
}

describe('CanonicalRef', () => {
  it('round-trips all five fields', () => {
    const original = CanonicalRef.create({
      canonical_id: '7b8c4f1e-0000-4000-8000-000000000001',
      vendor_id: 'user_2abc',
      module_name: 'identity-clerk',
      module_version: '0.3.1',
      contract_version: 'v1',
    });
    const out = roundTrip(CanonicalRef, original) as Record<string, string>;
    expect(out.canonical_id).toBe('7b8c4f1e-0000-4000-8000-000000000001');
    expect(out.vendor_id).toBe('user_2abc');
    expect(out.module_name).toBe('identity-clerk');
    expect(out.module_version).toBe('0.3.1');
    expect(out.contract_version).toBe('v1');
  });
});

describe('CommandContext', () => {
  it('preserves idempotency_key and actor fields', () => {
    const original = CommandContext.create({
      idempotency_key: 'key-001',
      correlation_id: 'corr-001',
      actor_user_id: 'user-42',
      actor_type: 'user',
      tenant_id: 'org-1',
    });
    const out = roundTrip(CommandContext, original) as Record<string, string>;
    expect(out.idempotency_key).toBe('key-001');
    expect(out.actor_type).toBe('user');
  });
});

describe('Name', () => {
  it('round-trips given/family/display', () => {
    const original = Name.create({ given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' });
    const out = roundTrip(Name, original) as Record<string, string>;
    expect(out.given).toBe('Ada');
    expect(out.family).toBe('Lovelace');
    expect(out.display).toBe('Ada Lovelace');
  });
});

describe('ListRequest', () => {
  it('preserves filters and sorts as repeated nested messages', () => {
    const original = ListRequest.create({
      limit: 50,
      cursor: 'cursor-xyz',
      offset: 0,
      filters: [
        Filter.create({ field: 'status', operator: FilterOperator.FILTER_OPERATOR_EQ, value: 'active' }),
        Filter.create({ field: 'tag', operator: FilterOperator.FILTER_OPERATOR_IN, values: ['a', 'b'] }),
      ],
      sorts: [Sort.create({ field: 'created_at', direction: SortDirection.SORT_DIRECTION_DESC })],
    });
    const out = roundTrip(ListRequest, original) as { limit: number; filters: Array<{ field: string; operator: number }>; sorts: Array<{ field: string }> };
    expect(out.limit).toBe(50);
    expect(out.filters).toHaveLength(2);
    expect(out.filters[0]?.field).toBe('status');
    expect(out.sorts[0]?.field).toBe('created_at');
  });
});

describe('ListResponseMeta', () => {
  it('round-trips pagination cursors', () => {
    const original = ListResponseMeta.create({ limit: 20, next_cursor: 'next', prev_cursor: 'prev', total_count: 100, has_more: true });
    const out = roundTrip(ListResponseMeta, original) as Record<string, unknown>;
    expect(out.limit).toBe(20);
    expect(out.has_more).toBe(true);
    expect(out.total_count).toBe(100);
  });
});

describe('Metadata', () => {
  it('round-trips public/private/unsafe Struct fields independently', () => {
    const Struct = proto.google.protobuf.Struct;
    const publicStruct = Struct.create({ fields: { plan: { string_value: 'pro' } } });
    const privateStruct = Struct.create({ fields: { stripe_id: { string_value: 'cus_xyz' } } });
    const unsafeStruct = Struct.create({ fields: { theme: { string_value: 'dark' } } });
    const original = Metadata.create({ public: publicStruct, private: privateStruct, unsafe: unsafeStruct });
    const buf = Metadata.encode(original).finish();
    const decoded = Metadata.decode(buf);
    expect(decoded.public).toBeTruthy();
    expect(decoded.private).toBeTruthy();
    expect(decoded.unsafe).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm -F @rntme/contracts-common-v1 run test`
Expected: 6 tests pass — `CanonicalRef`, `CommandContext`, `Name`, `ListRequest`, `ListResponseMeta`, `Metadata`.

> Note: this is the rare case where the test passes immediately because the proto already exists from Task 3. The TDD discipline "see it fail first" doesn't apply to round-trip tests over generated code that's already produced — the test asserts the codegen succeeded as expected. If it fails, that signals codegen drift and the right response is to rerun `proto:gen` and inspect the diff.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm -F @rntme/contracts-common-v1 run lint`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/_common/v1/test
git commit -m "test(contracts-common-v1): round-trip coverage for shared primitives"
```

---

## Task 5: `@rntme/contracts-identity-v1` package skeleton

**Files:**
- Create: `packages/contracts/identity/v1/package.json`
- Create: `packages/contracts/identity/v1/tsconfig.json`
- Create: `packages/contracts/identity/v1/tsconfig.check.json`
- Create: `packages/contracts/identity/v1/eslint.config.mjs`
- Delete: `packages/contracts/identity/v1/.gitkeep`

- [ ] **Step 1: Write `package.json`**

Create `packages/contracts/identity/v1/package.json`:

```json
{
  "name": "@rntme/contracts-identity-v1",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Canonical Identity contract v1 — protobuf service IdentityModule, six entity types, seventeen CloudEvents payloads, IDENTITY_<LAYER>_<KIND> error codes.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./error-codes": {
      "types": "./dist/error-codes.d.ts",
      "import": "./dist/error-codes.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "proto",
    "error-codes.json",
    "README.md"
  ],
  "scripts": {
    "proto:gen": "node scripts/gen.mjs",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@rntme/contracts-common-v1": "workspace:*",
    "protobufjs": "^7.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` and `tsconfig.check.json`**

Create `packages/contracts/identity/v1/tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false,
    "allowJs": true
  },
  "include": ["src/**/*.ts", "src/**/*.js", "src/**/*.d.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

Create `packages/contracts/identity/v1/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "src/**/*.js", "src/**/*.d.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Write `eslint.config.mjs`**

Create `packages/contracts/identity/v1/eslint.config.mjs`:

```javascript
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/proto.gen.*'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
      globals: {
        console: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
];
```

- [ ] **Step 4: Remove `.gitkeep` and run install**

Run:
```bash
rm packages/contracts/identity/v1/.gitkeep
pnpm install --frozen-lockfile=false
```

Expected: `@rntme/contracts-identity-v1` appears in `pnpm list -r --depth -1`. Its workspace dependency on `@rntme/contracts-common-v1` resolves via the `workspace:*` protocol.

- [ ] **Step 5: Verify dependency resolution**

Run: `pnpm -F @rntme/contracts-identity-v1 list @rntme/contracts-common-v1`
Expected: shows `@rntme/contracts-common-v1` resolved through `link:`.

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml packages/contracts/identity/v1
git commit -m "feat(contracts-identity-v1): scaffold package"
```

---

## Task 6: `identity/v1/proto/identity.proto` — enums and entities

**Files:**
- Create: `packages/contracts/identity/v1/proto/identity.proto`
- Create: `packages/contracts/identity/v1/scripts/gen.mjs`
- Create: `packages/contracts/identity/v1/src/proto.gen.js` (generated, partial after this task)
- Create: `packages/contracts/identity/v1/src/proto.gen.d.ts` (generated)
- Create: `packages/contracts/identity/v1/src/index.ts`
- Create: `packages/contracts/identity/v1/.gitattributes`
- Create: `packages/contracts/identity/v1/test/entities.test.ts`

This task lands the entities and enums but not the service block or request/response messages — those come in Task 7. Splitting keeps each task's diff reviewable.

- [ ] **Step 1: Write `proto/identity.proto` with enums + entities only (service block stubbed)**

Create `packages/contracts/identity/v1/proto/identity.proto`. Reproduce the full file as written in spec §6.1, §6.2, plus an empty `service IdentityModule {}` placeholder so codegen succeeds. The `service` block fills in Task 7.

```protobuf
syntax = "proto3";
package rntme.contracts.identity.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";
import "rntme/contracts/common/v1/common.proto";

// ── Status enums ───────────────────────────────────────────

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_PENDING = 2;
  USER_STATUS_SUSPENDED = 3;
  USER_STATUS_DELETED = 4;
  USER_STATUS_BLOCKED = 5;
  USER_STATUS_VENDOR_SPECIFIC = 100;
}

enum OrgStatus {
  ORG_STATUS_UNSPECIFIED = 0;
  ORG_STATUS_ACTIVE = 1;
  ORG_STATUS_SUSPENDED = 2;
  ORG_STATUS_DELETED = 3;
  ORG_STATUS_VENDOR_SPECIFIC = 100;
}

enum MembershipStatus {
  MEMBERSHIP_STATUS_UNSPECIFIED = 0;
  MEMBERSHIP_STATUS_ACTIVE = 1;
  MEMBERSHIP_STATUS_PENDING = 2;
  MEMBERSHIP_STATUS_REVOKED = 3;
  MEMBERSHIP_STATUS_SUSPENDED = 4;
  MEMBERSHIP_STATUS_VENDOR_SPECIFIC = 100;
}

enum InvitationStatus {
  INVITATION_STATUS_UNSPECIFIED = 0;
  INVITATION_STATUS_PENDING = 1;
  INVITATION_STATUS_ACCEPTED = 2;
  INVITATION_STATUS_REVOKED = 3;
  INVITATION_STATUS_EXPIRED = 4;
  INVITATION_STATUS_VENDOR_SPECIFIC = 100;
}

enum SessionStatus {
  SESSION_STATUS_UNSPECIFIED = 0;
  SESSION_STATUS_ACTIVE = 1;
  SESSION_STATUS_ENDED = 2;
  SESSION_STATUS_REVOKED = 3;
  SESSION_STATUS_EXPIRED = 4;
  SESSION_STATUS_VENDOR_SPECIFIC = 100;
}

enum TokenType {
  TOKEN_TYPE_UNSPECIFIED = 0;
  TOKEN_TYPE_OPAQUE_SESSION = 1;
  TOKEN_TYPE_JWT_ACCESS = 2;
  TOKEN_TYPE_JWT_REFRESH = 3;
}

enum ResolutionInputType {
  RESOLUTION_INPUT_TYPE_UNSPECIFIED = 0;
  RESOLUTION_INPUT_TYPE_EMAIL = 1;
  RESOLUTION_INPUT_TYPE_VENDOR_ID = 2;
  RESOLUTION_INPUT_TYPE_SSO_SUBJECT = 3;
  RESOLUTION_INPUT_TYPE_PHONE = 4;
  RESOLUTION_INPUT_TYPE_USERNAME = 5;
}

// ── Entities ───────────────────────────────────────────────

message User {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  string email = 2;
  bool email_verified = 3;
  rntme.contracts.common.v1.Name name = 4;
  string phone = 5;
  bool phone_verified = 6;
  string avatar_url = 7;
  UserStatus status = 8;
  rntme.contracts.common.v1.Metadata metadata = 9;
  google.protobuf.Timestamp created_at = 10;
  google.protobuf.Timestamp updated_at = 11;
  google.protobuf.Timestamp last_sign_in_at = 12;
  google.protobuf.Timestamp deleted_at = 13;
  google.protobuf.Struct vendor_raw = 14;
}

message Organization {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  string name = 2;
  string slug = 3;
  string logo_url = 4;
  string description = 5;
  OrgStatus status = 6;
  rntme.contracts.common.v1.Metadata metadata = 7;
  int32 max_members = 8;
  google.protobuf.Timestamp created_at = 9;
  google.protobuf.Timestamp updated_at = 10;
  google.protobuf.Timestamp deleted_at = 11;
  google.protobuf.Struct vendor_raw = 12;
}

message OrganizationMembership {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  string user_id = 2;
  string organization_id = 3;
  repeated string roles = 4;
  repeated string permissions = 5;
  MembershipStatus status = 6;
  rntme.contracts.common.v1.Metadata metadata = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;
  google.protobuf.Struct vendor_raw = 10;
}

message Invitation {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  string email = 2;
  string organization_id = 3;
  string inviter_user_id = 4;
  repeated string roles = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;
  InvitationStatus status = 7;
  google.protobuf.Timestamp expires_at = 8;
  google.protobuf.Timestamp accepted_at = 9;
  google.protobuf.Timestamp revoked_at = 10;
  google.protobuf.Timestamp created_at = 11;
  google.protobuf.Struct vendor_raw = 12;
}

message Session {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  string session_id = 2;
  string user_id = 3;
  string organization_id = 4;
  TokenType token_type = 5;
  repeated string roles = 6;
  repeated string permissions = 7;
  repeated string verified_factors = 8;
  SessionStatus status = 9;
  string ip_address = 10;
  string user_agent = 11;
  google.protobuf.Timestamp started_at = 12;
  google.protobuf.Timestamp last_active_at = 13;
  google.protobuf.Timestamp expires_at = 14;
  google.protobuf.Timestamp revoked_at = 15;
  google.protobuf.Struct vendor_raw = 16;
}

message IdentityResolution {
  oneof identity {
    User user = 1;
    Organization organization = 2;
  }
  bool exists = 3;
  string canonical_id = 4;
  ResolutionInputType input_type = 5;
  string input_value = 6;
  google.protobuf.Timestamp resolved_at = 7;
}

// Service block populated in plan task 7. Empty placeholder so codegen succeeds.
service IdentityModule {}
```

- [ ] **Step 2: Write codegen driver `scripts/gen.mjs`**

Create `packages/contracts/identity/v1/scripts/gen.mjs`:

```javascript
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const repoRoot = resolve(pkgRoot, '../../../..');

const protoFiles = [
  resolve(pkgRoot, 'proto/identity.proto'),
  resolve(pkgRoot, 'proto/identity-events.proto'),
];
const outJs = resolve(pkgRoot, 'src/proto.gen.js');
const outDts = resolve(pkgRoot, 'src/proto.gen.d.ts');

const pbjs = resolve(pkgRoot, 'node_modules/.bin/pbjs');
const pbts = resolve(pkgRoot, 'node_modules/.bin/pbts');

// Path resolution: pbjs needs to find imports for both google/protobuf/* (well-known types
// shipped with protobufjs) and rntme/contracts/common/v1/common.proto (sibling workspace package).
// We add three search roots:
//   - this package's protobufjs/ (for google/*)
//   - the repo packages/contracts/_common/v1/proto/ root remapped so `rntme/contracts/common/v1/common.proto` resolves
const pbjsRoot = resolve(pkgRoot, 'node_modules/protobufjs');

// pbjs accepts `--path <dir>` repeated. The proto import string is `rntme/contracts/common/v1/common.proto`
// which is relative to a search root. We construct a temporary search root by symlinking — instead, the
// simplest reliable approach is to add the entire repo's `packages/contracts/<category>/v<n>/proto` dirs
// flattened into a single virtual root via a thin wrapper. For this plan, we use the simpler path: add
// the repo root path so absolute proto package names resolve from `<repoRoot>/packages/...`. That requires
// a small workspace convention: proto import paths are NOT `rntme/contracts/...` (which would force a
// rewrite root) but rather a relative path from this package's proto/ that climbs to the sibling.
// REVISIT: see below.

// Concrete approach we adopt: maintain a tiny `proto-deps/` symlink tree inside this package that mirrors
// the canonical import path. The symlink is recreated by this script and ignored by git (.gitignore).
import { mkdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
const protoDeps = resolve(pkgRoot, 'proto-deps');
rmSync(protoDeps, { recursive: true, force: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/common/v1'), { recursive: true });
const commonProtoSrc = resolve(repoRoot, 'packages/contracts/_common/v1/proto/common.proto');
symlinkSync(commonProtoSrc, resolve(protoDeps, 'rntme/contracts/common/v1/common.proto'));

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: pkgRoot });
}

const inputs = protoFiles.join(' ');
run(`${pbjs} --target static-module --wrap es6 --es6 --keep-case --path ${pbjsRoot} --path ${protoDeps} --out ${outJs} ${inputs}`);
run(`${pbts} --out ${outDts} ${outJs}`);

console.log('Codegen complete.');
```

- [ ] **Step 3: Add `proto-deps/` to `.gitignore` for this package**

Create `packages/contracts/identity/v1/.gitignore`:

```
proto-deps/
```

- [ ] **Step 4: Create empty `identity-events.proto` placeholder**

Create `packages/contracts/identity/v1/proto/identity-events.proto`:

```protobuf
syntax = "proto3";
package rntme.contracts.identity.v1;

// Event payloads land in plan task 8.
```

This empty file lets the codegen driver succeed in this task; full events land in Task 8.

- [ ] **Step 5: Write the `src/index.ts` barrel**

Create `packages/contracts/identity/v1/src/index.ts`:

```typescript
export * as proto from './proto.gen.js';
```

- [ ] **Step 6: Run codegen**

Run: `pnpm -F @rntme/contracts-identity-v1 run proto:gen`
Expected: writes `src/proto.gen.js`, `src/proto.gen.d.ts`, recreates `proto-deps/`. No errors.

- [ ] **Step 7: Mark generated files as linguist-generated**

Create `packages/contracts/identity/v1/.gitattributes`:

```
src/proto.gen.js linguist-generated=true
src/proto.gen.d.ts linguist-generated=true
```

- [ ] **Step 8: Write the failing entity round-trip test**

Create `packages/contracts/identity/v1/test/entities.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { proto } from '../src/index.js';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

function refFor(canonicalId: string, vendorId: string): typeof common.CanonicalRef.prototype {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'identity-clerk',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

describe('User', () => {
  it('round-trips ref + email + status + soft-delete fields', () => {
    const user = id.User.create({
      ref: refFor('u-1', 'user_2abc'),
      email: 'ada@example.com',
      email_verified: true,
      name: common.Name.create({ given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' }),
      status: id.UserStatus.USER_STATUS_ACTIVE,
    });
    const buf = id.User.encode(user).finish();
    const decoded = id.User.decode(buf);
    expect(decoded.email).toBe('ada@example.com');
    expect(decoded.email_verified).toBe(true);
    expect(decoded.status).toBe(id.UserStatus.USER_STATUS_ACTIVE);
    expect(decoded.ref?.canonical_id).toBe('u-1');
  });

  it('preserves USER_STATUS_VENDOR_SPECIFIC sentinel', () => {
    const u = id.User.create({ ref: refFor('u-2', 'v'), email: 'x@x', status: id.UserStatus.USER_STATUS_VENDOR_SPECIFIC });
    const decoded = id.User.decode(id.User.encode(u).finish());
    expect(decoded.status).toBe(100);
  });
});

describe('Organization', () => {
  it('round-trips slug and max_members', () => {
    const org = id.Organization.create({
      ref: refFor('o-1', 'org_a'),
      name: 'Acme',
      slug: 'acme',
      max_members: 50,
      status: id.OrgStatus.ORG_STATUS_ACTIVE,
    });
    const decoded = id.Organization.decode(id.Organization.encode(org).finish());
    expect(decoded.slug).toBe('acme');
    expect(decoded.max_members).toBe(50);
  });
});

describe('OrganizationMembership', () => {
  it('preserves repeated roles array', () => {
    const m = id.OrganizationMembership.create({
      ref: refFor('m-1', 'mem_a'),
      user_id: 'u-1',
      organization_id: 'o-1',
      roles: ['admin', 'billing'],
      status: id.MembershipStatus.MEMBERSHIP_STATUS_ACTIVE,
    });
    const decoded = id.OrganizationMembership.decode(id.OrganizationMembership.encode(m).finish());
    expect(decoded.roles).toEqual(['admin', 'billing']);
    expect(decoded.user_id).toBe('u-1');
  });
});

describe('Invitation', () => {
  it('round-trips email/inviter/roles', () => {
    const inv = id.Invitation.create({
      ref: refFor('i-1', 'inv_a'),
      email: 'new@example.com',
      organization_id: 'o-1',
      inviter_user_id: 'u-1',
      roles: ['member'],
      status: id.InvitationStatus.INVITATION_STATUS_PENDING,
    });
    const decoded = id.Invitation.decode(id.Invitation.encode(inv).finish());
    expect(decoded.email).toBe('new@example.com');
    expect(decoded.roles).toEqual(['member']);
    expect(decoded.status).toBe(id.InvitationStatus.INVITATION_STATUS_PENDING);
  });
});

describe('Session', () => {
  it('round-trips token_type, verified_factors, status', () => {
    const s = id.Session.create({
      ref: refFor('s-1', 'sess_a'),
      session_id: 'sid_1',
      user_id: 'u-1',
      token_type: id.TokenType.TOKEN_TYPE_JWT_ACCESS,
      verified_factors: ['totp', 'webauthn'],
      status: id.SessionStatus.SESSION_STATUS_ACTIVE,
    });
    const decoded = id.Session.decode(id.Session.encode(s).finish());
    expect(decoded.token_type).toBe(id.TokenType.TOKEN_TYPE_JWT_ACCESS);
    expect(decoded.verified_factors).toEqual(['totp', 'webauthn']);
  });
});

describe('IdentityResolution', () => {
  it('round-trips the user oneof branch', () => {
    const res = id.IdentityResolution.create({
      user: id.User.create({ ref: refFor('u-1', 'v'), email: 'a@b' }),
      exists: true,
      canonical_id: 'u-1',
      input_type: id.ResolutionInputType.RESOLUTION_INPUT_TYPE_EMAIL,
      input_value: 'a@b',
    });
    const decoded = id.IdentityResolution.decode(id.IdentityResolution.encode(res).finish());
    expect(decoded.exists).toBe(true);
    expect(decoded.canonical_id).toBe('u-1');
    expect(decoded.identity).toBe('user');
  });
});
```

- [ ] **Step 9: Run the test**

Run: `pnpm -F @rntme/contracts-identity-v1 run test`
Expected: 7 tests pass — `User` (×2), `Organization`, `OrganizationMembership`, `Invitation`, `Session`, `IdentityResolution`.

- [ ] **Step 10: Verify build, typecheck, lint**

Run:
```bash
pnpm -F @rntme/contracts-identity-v1 run build
pnpm -F @rntme/contracts-identity-v1 run typecheck
pnpm -F @rntme/contracts-identity-v1 run lint
```
Expected: all three commands exit 0.

- [ ] **Step 11: Commit**

```bash
git add packages/contracts/identity/v1
git commit -m "feat(contracts-identity-v1): enums, entities, IdentityResolution"
```

---

## Task 7: `identity/v1/proto/identity.proto` — service IdentityModule and request/response

**Files:**
- Modify: `packages/contracts/identity/v1/proto/identity.proto` (replace the empty service block with the full RPC list and add request/response messages)
- Create: `packages/contracts/identity/v1/test/service-shape.test.ts`

- [ ] **Step 1: Append request/response messages and full service block**

Open `packages/contracts/identity/v1/proto/identity.proto` and replace the trailing `service IdentityModule {}` placeholder with the full service definition plus all request and response messages. Append after the existing `IdentityResolution` message:

```protobuf
// ── Request / Response messages ───────────────────────────

message GetUserRequest { string canonical_id = 1; }
message ListUsersRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string organization_id = 2;
  UserStatus status = 3;
  string email = 4;
}
message UserList {
  repeated User items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message GetOrganizationRequest { string canonical_id = 1; }
message ListOrganizationsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  OrgStatus status = 2;
  string slug = 3;
}
message OrganizationList {
  repeated Organization items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message GetMembershipRequest { string canonical_id = 1; }
message ListMembershipsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string user_id = 2;
  string organization_id = 3;
  MembershipStatus status = 4;
}
message OrganizationMembershipList {
  repeated OrganizationMembership items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message GetInvitationRequest { string canonical_id = 1; }
message ListInvitationsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string organization_id = 2;
  string email = 3;
  InvitationStatus status = 4;
}
message InvitationList {
  repeated Invitation items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message GetSessionRequest { string canonical_id = 1; }
message ListSessionsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string user_id = 2;
  string organization_id = 3;
  SessionStatus status = 4;
}
message SessionList {
  repeated Session items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message ResolveIdentityRequest {
  ResolutionInputType input_type = 1;
  string input_value = 2;
  string organization_id = 3;
}

message IntrospectSessionRequest { string token = 1; }

message CreateUserRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string email = 2;
  rntme.contracts.common.v1.Name name = 3;
  string phone = 4;
  string avatar_url = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;
  bool email_verified = 7;
}
message UpdateUserRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  rntme.contracts.common.v1.Name name = 3;
  string phone = 4;
  string avatar_url = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;
}
message DeleteUserRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

message CreateOrganizationRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string name = 2;
  string slug = 3;
  string logo_url = 4;
  string description = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;
  int32 max_members = 7;
}
message UpdateOrganizationRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string name = 3;
  string slug = 4;
  string logo_url = 5;
  string description = 6;
  rntme.contracts.common.v1.Metadata metadata = 7;
  int32 max_members = 8;
}
message DeleteOrganizationRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

message CreateInvitationRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string email = 2;
  string organization_id = 3;
  repeated string roles = 4;
  rntme.contracts.common.v1.Metadata metadata = 5;
  google.protobuf.Timestamp expires_at = 6;
}
message RevokeInvitationRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string reason = 3;
}

message AddMembershipRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string user_id = 2;
  string organization_id = 3;
  repeated string roles = 4;
  rntme.contracts.common.v1.Metadata metadata = 5;
}
message UpdateMembershipRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  repeated string roles = 3;
  rntme.contracts.common.v1.Metadata metadata = 4;
}
message RemoveMembershipRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string reason = 3;
}

message RevokeSessionRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string reason = 3;
}

// ── Service ───────────────────────────────────────────────

service IdentityModule {
  // Queries
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (UserList);
  rpc GetOrganization(GetOrganizationRequest) returns (Organization);
  rpc ListOrganizations(ListOrganizationsRequest) returns (OrganizationList);
  rpc GetMembership(GetMembershipRequest) returns (OrganizationMembership);
  rpc ListMemberships(ListMembershipsRequest) returns (OrganizationMembershipList);
  rpc GetInvitation(GetInvitationRequest) returns (Invitation);
  rpc ListInvitations(ListInvitationsRequest) returns (InvitationList);
  rpc GetSession(GetSessionRequest) returns (Session);
  rpc ListSessions(ListSessionsRequest) returns (SessionList);
  rpc ResolveIdentity(ResolveIdentityRequest) returns (IdentityResolution);
  rpc IntrospectSession(IntrospectSessionRequest) returns (Session);

  // Commands: User
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (User);

  // Commands: Organization
  rpc CreateOrganization(CreateOrganizationRequest) returns (Organization);
  rpc UpdateOrganization(UpdateOrganizationRequest) returns (Organization);
  rpc DeleteOrganization(DeleteOrganizationRequest) returns (Organization);

  // Commands: Invitation
  rpc CreateInvitation(CreateInvitationRequest) returns (Invitation);
  rpc RevokeInvitation(RevokeInvitationRequest) returns (Invitation);

  // Commands: Membership
  rpc AddMembership(AddMembershipRequest) returns (OrganizationMembership);
  rpc UpdateMembership(UpdateMembershipRequest) returns (OrganizationMembership);
  rpc RemoveMembership(RemoveMembershipRequest) returns (OrganizationMembership);

  // Commands: Session
  rpc RevokeSession(RevokeSessionRequest) returns (Session);
}
```

- [ ] **Step 2: Regenerate proto bindings**

Run: `pnpm -F @rntme/contracts-identity-v1 run proto:gen`
Expected: `src/proto.gen.js` and `src/proto.gen.d.ts` updated. No errors.

- [ ] **Step 3: Write the failing service-shape test**

Create `packages/contracts/identity/v1/test/service-shape.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { proto } from '../src/index.js';

const expectedRpcs = [
  // Queries
  'GetUser', 'ListUsers',
  'GetOrganization', 'ListOrganizations',
  'GetMembership', 'ListMemberships',
  'GetInvitation', 'ListInvitations',
  'GetSession', 'ListSessions',
  'ResolveIdentity', 'IntrospectSession',
  // Commands: User
  'CreateUser', 'UpdateUser', 'DeleteUser',
  // Commands: Organization
  'CreateOrganization', 'UpdateOrganization', 'DeleteOrganization',
  // Commands: Invitation
  'CreateInvitation', 'RevokeInvitation',
  // Commands: Membership
  'AddMembership', 'UpdateMembership', 'RemoveMembership',
  // Commands: Session
  'RevokeSession',
] as const;

describe('IdentityModule service shape', () => {
  it('declares exactly 24 RPCs', () => {
    const svc = proto.rntme.contracts.identity.v1.IdentityModule;
    // protobufjs static-module exposes the service as a `rpc.Service` subclass with method
    // descriptors on its prototype. The simplest stable shape check is the count of own
    // member methods minus protobufjs-internal ones.
    const methodNames = Object.keys((svc as unknown as { service: { methods: Record<string, unknown> } }).service?.methods ?? {});
    expect(methodNames.length).toBe(24);
  });

  it('contains every expected RPC name', () => {
    const svc = proto.rntme.contracts.identity.v1.IdentityModule;
    const methodNames = new Set(Object.keys((svc as unknown as { service: { methods: Record<string, unknown> } }).service?.methods ?? {}));
    for (const rpc of expectedRpcs) {
      expect(methodNames.has(rpc), `expected RPC ${rpc} declared in IdentityModule`).toBe(true);
    }
  });

  it('does NOT contain RPCs deferred to vendor extensions per spec §3 / Q3', () => {
    const svc = proto.rntme.contracts.identity.v1.IdentityModule;
    const methodNames = new Set(Object.keys((svc as unknown as { service: { methods: Record<string, unknown> } }).service?.methods ?? {}));
    // These were dropped during brainstorming Q3 — Impersonate (Clerk-only), AssignRole/RevokeRole
    // (collapsed into UpdateMembership), CreateSession (sessions arrive via vendor auth flow).
    for (const rpc of ['Impersonate', 'AssignRole', 'RevokeRole', 'CreateSession']) {
      expect(methodNames.has(rpc), `${rpc} must NOT appear in IdentityModule v1`).toBe(false);
    }
  });
});
```

- [ ] **Step 4: Run the test**

Run: `pnpm -F @rntme/contracts-identity-v1 run test -- service-shape`
Expected: 3 tests pass.

> Note on protobufjs internals: the static-module output places each service as a generated subclass of `protobuf.rpc.Service`, with method shape exposed via the static-module-bundle's `service.methods` map. If pbjs's output structure differs in your installed version, adjust the access path in the test helper — verify by inspecting `src/proto.gen.js` for the IdentityModule descriptor literal and use the same key path.

- [ ] **Step 5: Run full test, typecheck, lint**

Run:
```bash
pnpm -F @rntme/contracts-identity-v1 run test
pnpm -F @rntme/contracts-identity-v1 run typecheck
pnpm -F @rntme/contracts-identity-v1 run lint
```
Expected: all pass; ten tests now (entities seven + service-shape three).

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/identity/v1
git commit -m "feat(contracts-identity-v1): IdentityModule service + request/response messages"
```

---

## Task 8: `identity/v1/proto/identity-events.proto` — 17 events

**Files:**
- Modify: `packages/contracts/identity/v1/proto/identity-events.proto` (replace placeholder with full file)
- Create: `packages/contracts/identity/v1/test/events.test.ts`

- [ ] **Step 1: Replace `identity-events.proto` placeholder with full content**

Replace `packages/contracts/identity/v1/proto/identity-events.proto` contents:

```protobuf
syntax = "proto3";
package rntme.contracts.identity.v1;

import "google/protobuf/timestamp.proto";
import "rntme/contracts/identity/v1/identity.proto";

// ── User lifecycle ─────────────────────────────────────
message UserCreated {
  User user = 1;
  string trigger = 2;
  string invitation_id = 3;
  string sso_connection_id = 4;
}

message UserUpdated {
  User user = 1;
  repeated string changed_fields = 2;
  User previous = 3;
}

message UserDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
}

message UserEmailVerified {
  string canonical_id = 1;
  string email = 2;
  google.protobuf.Timestamp verified_at = 3;
}

// ── Organization lifecycle ─────────────────────────────
message OrganizationCreated {
  Organization organization = 1;
  string creator_user_id = 2;
}

message OrganizationUpdated {
  Organization organization = 1;
  repeated string changed_fields = 2;
  Organization previous = 3;
}

message OrganizationDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
}

// ── Membership lifecycle ───────────────────────────────
message MembershipCreated {
  OrganizationMembership membership = 1;
  string trigger = 2;
  string invitation_id = 3;
}

message MembershipUpdated {
  OrganizationMembership membership = 1;
  repeated string changed_fields = 2;
  OrganizationMembership previous = 3;
}

message MembershipDeleted {
  string canonical_id = 1;
  string user_id = 2;
  string organization_id = 3;
  string reason = 4;
  google.protobuf.Timestamp deleted_at = 5;
}

// ── Invitation lifecycle ───────────────────────────────
message InvitationCreated {
  Invitation invitation = 1;
  string trigger = 2;
}

message InvitationAccepted {
  Invitation invitation = 1;
  string accepted_by_user_id = 2;
  string created_membership_id = 3;
}

message InvitationRevoked {
  Invitation invitation = 1;
  string revoked_by_user_id = 2;
  google.protobuf.Timestamp revoked_at = 3;
}

message InvitationExpired {
  Invitation invitation = 1;
  google.protobuf.Timestamp expired_at = 2;
}

// ── Session lifecycle ──────────────────────────────────
message SessionCreated {
  Session session = 1;
  string trigger = 2;
}

message SessionEnded {
  string session_id = 1;
  string canonical_id = 2;
  string user_id = 3;
  string trigger = 4;
  google.protobuf.Timestamp ended_at = 5;
}

message SessionRevoked {
  string session_id = 1;
  string canonical_id = 2;
  string user_id = 3;
  string revoked_by = 4;
  string reason = 5;
  google.protobuf.Timestamp revoked_at = 6;
}
```

- [ ] **Step 2: Update the proto-deps symlink to include identity.proto**

The `identity-events.proto` imports `rntme/contracts/identity/v1/identity.proto`. Open `packages/contracts/identity/v1/scripts/gen.mjs` and extend the `proto-deps/` setup to also expose this package's own `identity.proto` under the canonical import path. Replace the symlink-creation block with:

```javascript
import { mkdirSync, rmSync, symlinkSync } from 'node:fs';
const protoDeps = resolve(pkgRoot, 'proto-deps');
rmSync(protoDeps, { recursive: true, force: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/common/v1'), { recursive: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/identity/v1'), { recursive: true });
const commonProtoSrc = resolve(repoRoot, 'packages/contracts/_common/v1/proto/common.proto');
const identityProtoSrc = resolve(pkgRoot, 'proto/identity.proto');
symlinkSync(commonProtoSrc, resolve(protoDeps, 'rntme/contracts/common/v1/common.proto'));
symlinkSync(identityProtoSrc, resolve(protoDeps, 'rntme/contracts/identity/v1/identity.proto'));
```

- [ ] **Step 3: Regenerate proto bindings**

Run: `pnpm -F @rntme/contracts-identity-v1 run proto:gen`
Expected: includes the 17 event messages in the output. No errors.

- [ ] **Step 4: Write the failing event round-trip test**

Create `packages/contracts/identity/v1/test/events.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { proto } from '../src/index.js';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

const expectedEvents = [
  'UserCreated', 'UserUpdated', 'UserDeleted', 'UserEmailVerified',
  'OrganizationCreated', 'OrganizationUpdated', 'OrganizationDeleted',
  'MembershipCreated', 'MembershipUpdated', 'MembershipDeleted',
  'InvitationCreated', 'InvitationAccepted', 'InvitationRevoked', 'InvitationExpired',
  'SessionCreated', 'SessionEnded', 'SessionRevoked',
] as const;

describe('Identity event payloads', () => {
  it('exports exactly 17 canonical event types', () => {
    for (const name of expectedEvents) {
      expect((id as unknown as Record<string, unknown>)[name], `expected event message ${name}`).toBeTruthy();
    }
    expect(expectedEvents.length).toBe(17);
  });

  it('UserCreated round-trips with trigger and embedded user', () => {
    const ref = common.CanonicalRef.create({
      canonical_id: 'u-1', vendor_id: 'v', module_name: 'identity-clerk', module_version: '0', contract_version: 'v1',
    });
    const user = id.User.create({ ref, email: 'a@b', status: id.UserStatus.USER_STATUS_ACTIVE });
    const evt = id.UserCreated.create({ user, trigger: 'admin_created' });
    const decoded = id.UserCreated.decode(id.UserCreated.encode(evt).finish());
    expect(decoded.trigger).toBe('admin_created');
    expect(decoded.user?.email).toBe('a@b');
  });

  it('UserUpdated preserves changed_fields and previous snapshot', () => {
    const ref = common.CanonicalRef.create({ canonical_id: 'u-1', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' });
    const before = id.User.create({ ref, email: 'a@b', status: id.UserStatus.USER_STATUS_PENDING });
    const after = id.User.create({ ref, email: 'a@b', status: id.UserStatus.USER_STATUS_ACTIVE });
    const evt = id.UserUpdated.create({ user: after, previous: before, changed_fields: ['status'] });
    const decoded = id.UserUpdated.decode(id.UserUpdated.encode(evt).finish());
    expect(decoded.changed_fields).toEqual(['status']);
    expect(decoded.user?.status).toBe(id.UserStatus.USER_STATUS_ACTIVE);
    expect(decoded.previous?.status).toBe(id.UserStatus.USER_STATUS_PENDING);
  });

  it('SessionRevoked round-trips reason and revoked_by', () => {
    const evt = id.SessionRevoked.create({ session_id: 'sid', canonical_id: 'c', user_id: 'u-1', revoked_by: 'system', reason: 'security' });
    const decoded = id.SessionRevoked.decode(id.SessionRevoked.encode(evt).finish());
    expect(decoded.reason).toBe('security');
    expect(decoded.revoked_by).toBe('system');
  });

  it('InvitationAccepted round-trips embedded invitation + accepted_by + created_membership_id', () => {
    const ref = common.CanonicalRef.create({ canonical_id: 'i-1', vendor_id: 'v', module_name: 'm', module_version: '0', contract_version: 'v1' });
    const inv = id.Invitation.create({ ref, email: 'new@x', organization_id: 'o-1', inviter_user_id: 'u-1', status: id.InvitationStatus.INVITATION_STATUS_ACCEPTED });
    const evt = id.InvitationAccepted.create({ invitation: inv, accepted_by_user_id: 'u-2', created_membership_id: 'm-1' });
    const decoded = id.InvitationAccepted.decode(id.InvitationAccepted.encode(evt).finish());
    expect(decoded.accepted_by_user_id).toBe('u-2');
    expect(decoded.created_membership_id).toBe('m-1');
    expect(decoded.invitation?.email).toBe('new@x');
  });
});
```

- [ ] **Step 5: Run the test**

Run: `pnpm -F @rntme/contracts-identity-v1 run test -- events`
Expected: 5 tests pass.

- [ ] **Step 6: Run full check**

Run: `pnpm -F @rntme/contracts-identity-v1 run build && run typecheck && run lint && run test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/identity/v1
git commit -m "feat(contracts-identity-v1): seventeen canonical event payloads"
```

---

## Task 9: `error-codes.json` and the typed `error-codes.ts` re-export

**Files:**
- Create: `packages/contracts/identity/v1/error-codes.json`
- Create: `packages/contracts/identity/v1/src/error-codes.ts`
- Create: `packages/contracts/identity/v1/test/error-codes.test.ts`

- [ ] **Step 1: Write `error-codes.json`**

Create `packages/contracts/identity/v1/error-codes.json`:

```json
{
  "structural": [
    "IDENTITY_STRUCTURAL_MISSING_IDEMPOTENCY_KEY",
    "IDENTITY_STRUCTURAL_INVALID_EMAIL"
  ],
  "references": [
    "IDENTITY_REFERENCES_USER_NOT_FOUND",
    "IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND",
    "IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND",
    "IDENTITY_REFERENCES_INVITATION_NOT_FOUND",
    "IDENTITY_REFERENCES_SESSION_NOT_FOUND"
  ],
  "consistency": [
    "IDENTITY_CONSISTENCY_DUPLICATE_EMAIL",
    "IDENTITY_CONSISTENCY_INVITATION_ALREADY_ACCEPTED",
    "IDENTITY_CONSISTENCY_INVITATION_EXPIRED",
    "IDENTITY_CONSISTENCY_UNSUPPORTED_MULTIROLE",
    "IDENTITY_CONSISTENCY_UNSUPPORTED_HARD_DELETE",
    "IDENTITY_CONSISTENCY_INVALID_TOKEN",
    "IDENTITY_CONSISTENCY_SESSION_REVOKED"
  ],
  "vendor": [
    "IDENTITY_VENDOR_RATE_LIMITED",
    "IDENTITY_VENDOR_UNAVAILABLE",
    "IDENTITY_VENDOR_UNAUTHORIZED",
    "IDENTITY_VENDOR_INVALID_REQUEST"
  ]
}
```

- [ ] **Step 2: Write the typed `error-codes.ts` re-export**

Create `packages/contracts/identity/v1/src/error-codes.ts`:

```typescript
import errorCodesJson from '../error-codes.json' with { type: 'json' };

export type IdentityErrorLayer = 'structural' | 'references' | 'consistency' | 'vendor';

export interface IdentityErrorCodes {
  structural: readonly string[];
  references: readonly string[];
  consistency: readonly string[];
  vendor: readonly string[];
}

export const errorCodes: IdentityErrorCodes = errorCodesJson as IdentityErrorCodes;

export const allErrorCodes: readonly string[] = [
  ...errorCodesJson.structural,
  ...errorCodesJson.references,
  ...errorCodesJson.consistency,
  ...errorCodesJson.vendor,
];

export type IdentityErrorCode = (typeof allErrorCodes)[number];
```

- [ ] **Step 3: Update `src/index.ts` to re-export error codes**

Open `packages/contracts/identity/v1/src/index.ts` and replace contents with:

```typescript
export * as proto from './proto.gen.js';
export * from './error-codes.js';
```

- [ ] **Step 4: Write the failing error-codes lint test**

Create `packages/contracts/identity/v1/test/error-codes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { errorCodes, allErrorCodes } from '../src/error-codes.js';

const PATTERN = /^IDENTITY_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z0-9_]+$/;

describe('error-codes.json', () => {
  it('declares exactly 24 codes spread across four layers', () => {
    expect(allErrorCodes.length).toBe(24);
    expect(errorCodes.structural.length).toBe(2);
    expect(errorCodes.references.length).toBe(5);
    expect(errorCodes.consistency.length).toBe(7);
    expect(errorCodes.vendor.length).toBe(4);
  });

  it('every code matches IDENTITY_<LAYER>_<KIND>', () => {
    for (const code of allErrorCodes) {
      expect(code, `code ${code} does not match canonical pattern`).toMatch(PATTERN);
    }
  });

  it('codes are unique', () => {
    expect(new Set(allErrorCodes).size).toBe(allErrorCodes.length);
  });

  it('layer prefix matches the JSON key it lives under', () => {
    for (const code of errorCodes.structural) expect(code.startsWith('IDENTITY_STRUCTURAL_')).toBe(true);
    for (const code of errorCodes.references) expect(code.startsWith('IDENTITY_REFERENCES_')).toBe(true);
    for (const code of errorCodes.consistency) expect(code.startsWith('IDENTITY_CONSISTENCY_')).toBe(true);
    for (const code of errorCodes.vendor) expect(code.startsWith('IDENTITY_VENDOR_')).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `pnpm -F @rntme/contracts-identity-v1 run test -- error-codes`
Expected: 4 tests pass. Counts: structural=2, references=5, consistency=7, vendor=4 → total=18. **STOP — re-count.**

Re-count manually: structural 2 + references 5 + consistency 7 + vendor 4 = 18. The first assertion `expect(allErrorCodes.length).toBe(24)` will FAIL because the JSON has 18 codes, not 24.

This mismatch is intentional. The number "24" came from a misread of the spec. Look at spec §7.3: it lists 2 + 5 + 7 + 4 = 18 codes. **The plan's "24 error codes" claim was wrong.**

Fix: update Step 4's test to assert `allErrorCodes.length).toBe(18)` and `consistency.length).toBe(7)`. Re-run test.

- [ ] **Step 6: Re-run with corrected counts**

After updating the test to use `18` instead of `24`, run: `pnpm -F @rntme/contracts-identity-v1 run test -- error-codes`
Expected: 4 tests pass.

- [ ] **Step 7: Run full check**

Run: `pnpm -F @rntme/contracts-identity-v1 run build && run typecheck && run lint && run test`
Expected: all green; all 13 tests pass (entities 7 + service-shape 3 + events 5 + error-codes 4 — re-confirm exact count by running).

- [ ] **Step 8: Commit**

```bash
git add packages/contracts/identity/v1
git commit -m "feat(contracts-identity-v1): error-codes.json + typed re-export"
```

---

## Task 10: Per-package READMEs

**Files:**
- Create: `packages/contracts/_common/v1/README.md`
- Create: `packages/contracts/identity/v1/README.md`

- [ ] **Step 1: Write `_common/v1/README.md`**

Create `packages/contracts/_common/v1/README.md`:

```markdown
# @rntme/contracts-common-v1

Shared cross-category protobuf primitives for rntme canonical contracts. Imported by every category contract package (`@rntme/contracts-identity-v1`, future `@rntme/contracts-payments-v1`, …).

## File map

- `proto/common.proto` — canonical source. Hand-edit this file; everything else is derived.
- `scripts/gen.mjs` — codegen driver. Runs `pbjs --target static-module --wrap es6` then `pbts`.
- `src/proto.gen.{js,d.ts}` — generated TypeScript bindings (committed; mark linguist-generated).
- `src/index.ts` — barrel re-export of the `proto` namespace.
- `error-codes.json` — empty by design; this package has no domain.
- `test/round-trip.test.ts` — vitest round-trip coverage for every primitive.

## Quick start

```ts
import { proto } from '@rntme/contracts-common-v1';

const ref = proto.rntme.contracts.common.v1.CanonicalRef.create({
  canonical_id: '7b8c4f1e-…',
  vendor_id: 'user_2abc',
  module_name: 'identity-clerk',
  module_version: '0.3.1',
  contract_version: 'v1',
});

const buf = proto.rntme.contracts.common.v1.CanonicalRef.encode(ref).finish();
```

## API

The generated `proto` namespace exposes one nested object per protobuf package. Top-level types in `proto.rntme.contracts.common.v1`:

- `CanonicalRef` — five-field reference attached to every category aggregate.
- `CommandContext` — required on every Command RPC across all categories. `idempotency_key` is mandatory at the contract level; missing-key handling is an adapter concern.
- `Name` — person name (`given` / `family` / `display`).
- `ListRequest` + `Filter` + `FilterOperator` + `Sort` + `SortDirection` + `ListResponseMeta` — universal pagination/filtering/sorting shape for all category List* RPCs.
- `Metadata` — three-level metadata (`public` / `private` / `unsafe`) used wherever a category aggregate carries user-customisable metadata.

## Invariants & gotchas

- **Never edit `src/proto.gen.*` by hand.** Always re-run `pnpm run proto:gen`.
- **`Metadata.unsafe` is user-editable from the frontend and must NOT be included in JWTs or public projections.** Adapters that flatten metadata for vendors lacking native three-level support document their mapping in the vendor module's README, not here.
- **`CommandContext.idempotency_key` is empty-string-tested at the adapter layer.** The proto cannot mark `string` fields required, but the canonical convention is: empty `idempotency_key` → `IDENTITY_STRUCTURAL_MISSING_IDEMPOTENCY_KEY` (or the equivalent error code in the using category).

## Out of scope

- No service definition lives here — `_common` exports messages only.
- No category-specific entities (`User`, `Invoice`, …) — those live in `<category>/v<n>/`.
- No mutual-tls / authentication / authorization concerns — those are runtime-layer.

## Where to look first

- Specs: `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` §5.
- Generated namespace: `src/proto.gen.d.ts`.

## Specs

- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §5.1 (layout).
- `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` §4 (placement) and §5 (`common.proto`).
```

- [ ] **Step 2: Write `identity/v1/README.md`**

Create `packages/contracts/identity/v1/README.md`:

```markdown
# @rntme/contracts-identity-v1

Canonical Identity contract v1 — the protobuf service `IdentityModule`, six entity types, seventeen CloudEvents payloads, and the `IDENTITY_<LAYER>_<KIND>` error-code set. Every Identity-category vendor module (Clerk, Auth0, WorkOS, …) implements this contract.

## File map

- `proto/identity.proto` — canonical source: enums, entities, request/response messages, `service IdentityModule`.
- `proto/identity-events.proto` — seventeen canonical event payloads.
- `scripts/gen.mjs` — codegen driver (sets up `proto-deps/` symlink tree for cross-package imports, then runs `pbjs` + `pbts`).
- `src/proto.gen.{js,d.ts}` — generated TypeScript bindings.
- `src/error-codes.ts` — typed re-export of `error-codes.json`.
- `src/index.ts` — barrel for `proto` and error codes.
- `error-codes.json` — eighteen-entry error-code catalogue across four layers.
- `test/` — vitest coverage: entities, events, service shape, error-code lint.

## Quick start

```ts
import { proto, errorCodes, type IdentityErrorCode } from '@rntme/contracts-identity-v1';

const id = proto.rntme.contracts.identity.v1;

const user = id.User.create({
  ref: /* … */,
  email: 'ada@example.com',
  status: id.UserStatus.USER_STATUS_ACTIVE,
});
const buf = id.User.encode(user).finish();

const code: IdentityErrorCode = 'IDENTITY_REFERENCES_USER_NOT_FOUND';
console.log(errorCodes.references.includes(code)); // true
```

## API

### Entities (five aggregates + one helper)

- `User` — instance-scoped identity.
- `Organization` — tenant/multi-tenant unit.
- `OrganizationMembership` — `User × Organization` link with `repeated string roles`.
- `Invitation` — onboarding flow, statuses `PENDING / ACCEPTED / REVOKED / EXPIRED`.
- `Session` — auth context, abstracts opaque vs JWT via `TokenType`.
- `IdentityResolution` — transient helper returned by `ResolveIdentity`; not stored.

### Status enums

`UserStatus`, `OrgStatus`, `MembershipStatus`, `InvitationStatus`, `SessionStatus` — all share `*_UNSPECIFIED = 0` and `*_VENDOR_SPECIFIC = 100`. Plus `TokenType` and `ResolutionInputType`.

### `service IdentityModule`

Twenty-four RPCs: twelve queries (`Get*` / `List*` per entity, plus `ResolveIdentity` and `IntrospectSession`) and twelve commands (`Create*` / `Update*` / `Delete*` / `Add*` / `Remove*` per entity, plus `RevokeSession`). See `proto/identity.proto`.

### Events (seventeen)

Topics — `rntme.identity.user`, `rntme.identity.organization`, `rntme.identity.membership`, `rntme.identity.invitation`, `rntme.identity.session`. CloudEvents `type` form: `rntme.identity.v1.<EventShortName>`.

| Aggregate | Events |
|---|---|
| User | `UserCreated`, `UserUpdated`, `UserDeleted`, `UserEmailVerified` |
| Organization | `OrganizationCreated`, `OrganizationUpdated`, `OrganizationDeleted` |
| Membership | `MembershipCreated`, `MembershipUpdated`, `MembershipDeleted` |
| Invitation | `InvitationCreated`, `InvitationAccepted`, `InvitationRevoked`, `InvitationExpired` |
| Session | `SessionCreated`, `SessionEnded`, `SessionRevoked` |

### Error codes

Eighteen codes, four layers (`structural` / `references` / `consistency` / `vendor`). gRPC mapping documented in spec §7.3. Adapters import via `import { errorCodes } from '@rntme/contracts-identity-v1'`.

## Invariants & gotchas

- **Soft-delete is canonical.** `DeleteUser` / `DeleteOrganization` defaults to `hard_delete = false`. Hard-delete returns `IDENTITY_CONSISTENCY_UNSUPPORTED_HARD_DELETE` on vendors that only soft-delete.
- **Roles array.** `OrganizationMembership.roles` is `repeated string`. Single-role vendors (Clerk, WorkOS) wrap the primary role into `[role]`. Writing `roles.length > 1` to a single-role vendor must return `IDENTITY_CONSISTENCY_UNSUPPORTED_MULTIROLE`.
- **No `CreateSession`.** Sessions are created by the vendor's auth flow and surface to the canonical layer via `SessionCreated` events.
- **Update semantics: full replacement of declared fields.** No `FieldMask` in v1.

## Out of scope

- Vendor-specific RPCs (Impersonate, AssignRole/RevokeRole, MFA-policy hierarchy) — live in each vendor module's `<vendor>-extensions.proto`.
- JWT issuance, JWKS hosting, SCIM v2 inbound endpoints — Identity is a wrapper, not a gateway. Future categories (`audit`, `directory-sync`) cover those concerns.
- Vendor implementations — `modules/identity/<vendor>/` lives in subsequent specs.

## Where to look first

- Spec: `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md`.
- Generated TS API surface: `src/proto.gen.d.ts`.
- Error codes: `error-codes.json`, typed re-export at `src/error-codes.ts`.

## Specs

- `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` (this contract).
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` (umbrella conventions).
- `docs/superpowers/specs/2026-04-19-platform-modules-integration-design.md` (module pattern).
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` (event envelope).
```

- [ ] **Step 3: Verify lint passes (READMEs are not lint-checked but confirm nothing broke)**

Run: `pnpm -r run lint`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/_common/v1/README.md packages/contracts/identity/v1/README.md
git commit -m "docs(contracts): per-package READMEs for common-v1 and identity-v1"
```

---

## Task 11: Documentation-touch — `AGENTS.md` updates

**Files:**
- Modify: `AGENTS.md` §3 (package layering), §6 (how-tos), §10 (glossary).

- [ ] **Step 1: Update `AGENTS.md` §3 — add the two new packages to the layering ASCII**

Open `AGENTS.md`. Locate the §3 ASCII diagram and the per-package one-liners that follow.

After the existing `@rntme-cli/deploy-dokploy` line (last bullet of the `--- Deployment` block), add a new "Canonical contracts (Identity track)" block. Replace the line:

```
- **`@rntme-cli/deploy-dokploy`** — Dokploy target adapter: render/apply
  redacted deployment plans through the Dokploy HTTP API. →
  `rntme-cli/packages/deploy-dokploy/README.md`.
```

with:

```
- **`@rntme-cli/deploy-dokploy`** — Dokploy target adapter: render/apply
  redacted deployment plans through the Dokploy HTTP API. →
  `rntme-cli/packages/deploy-dokploy/README.md`.

Canonical contracts (Identity track):

- **`@rntme/contracts-common-v1`** — Shared cross-category protobuf
  primitives (`CanonicalRef`, `CommandContext`, `Name`, `ListRequest` /
  `Filter` / `Sort` / `ListResponseMeta`, `Metadata`). Imported by every
  category contract package.
  → `packages/contracts/_common/v1/README.md`.
- **`@rntme/contracts-identity-v1`** — Canonical Identity contract:
  protobuf `IdentityModule` service, six entities, seventeen CloudEvents
  payloads, `IDENTITY_<LAYER>_<KIND>` error codes. Implemented by
  Identity-category vendor wrappers (Clerk / Auth0 / WorkOS).
  → `packages/contracts/identity/v1/README.md`.
```

(The ASCII layering diagram itself is now incomplete — it does not show contracts-* packages. Skip the ASCII update for this plan; the diagram is conceptual and the new packages have no inbound edges from existing nodes. A future plan that wires runtime to consume the contract package will update the ASCII at that point.)

- [ ] **Step 2: Update `AGENTS.md` §10 (glossary) — add new entries**

Open `AGENTS.md`. Locate `## 10. Glossary`. Insert these entries in alphabetical order:

```
- **Canonical contract** — A `packages/contracts/<category>/v<n>/`
  package: protobuf source, generated TS bindings, error-codes
  catalogue, README. Implemented by vendor modules in
  `modules/<category>/<vendor>/`. See spec
  `2026-04-26-modules-monorepo-structure-design.md`.
- **Capability claim** — A vendor module's declaration in
  `module.json#capabilities[]` of which canonical RPCs and events the
  module supports. Conformance enforces UNIMPLEMENTED for unclaimed
  RPCs; blueprint validator enforces coverage of what blueprints use.
- **Category package** — A `packages/contracts/<category>/v<n>/`
  workspace package, e.g. `@rntme/contracts-identity-v1`. One npm
  package per major version; `v1` and `v2` coexist.
- **Conformance scenarios** — Per-RPC test definitions in
  `modules/<category>/conformance/scenarios/`. Each scenario asserts
  shape, idempotency on replay, error-code on negative branches, and
  expected event publication.
- **Shared common package** — `packages/contracts/_common/v1/`
  (`@rntme/contracts-common-v1`). Cross-category primitives:
  `CanonicalRef`, `CommandContext`, `Name`, `ListRequest`/Filter/Sort,
  `Metadata`. Imported by every category contract.
- **Vendor extensions proto** — `<vendor>-extensions.proto` inside a
  vendor module's directory. Hosts vendor-specific RPCs that did not
  meet the governance bar (≥2 vendors or archetypal) for canonical.
  Blueprints that depend on these are flagged
  `BLUEPRINT_VENDOR_LOCKED_BY_EXTENSION`.
```

- [ ] **Step 3: Update `AGENTS.md` §6 — add a how-to entry**

Locate `### 6.16 Deploy a project via Dokploy` (the last existing how-to). After it, insert:

```
### 6.17 Add a category contract package

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

Spec reference: `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` is the worked example of a category contract.
```

- [ ] **Step 4: Verify the file is well-formed**

Run: `git diff AGENTS.md | head -120`
Expected: shows the three insertions.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(AGENTS): canonical contract layering, glossary, how-to entries"
```

---

## Task 12: Documentation-touch — root `README.md` packages table

**Files:**
- Modify: `README.md` (packages table; mermaid dep graph optional).

- [ ] **Step 1: Insert the two new packages into the table**

Open `README.md`. Locate the packages table (starts at line `| Package | Purpose |`). Find the boundary row `| **Deployment (CLI-side)** |  |`. Immediately above it, insert:

```markdown
| **Canonical contracts (Identity track)** |  |
| [`@rntme/contracts-common-v1`](packages/contracts/_common/v1) | Shared cross-category protobuf primitives (`CanonicalRef`, `CommandContext`, `Name`, `ListRequest`/Filter/Sort, `Metadata`) imported by every category contract. |
| [`@rntme/contracts-identity-v1`](packages/contracts/identity/v1) | Canonical Identity contract: `service IdentityModule` (24 RPCs), six entity types, seventeen CloudEvents payloads, `IDENTITY_<LAYER>_<KIND>` error codes. |
```

The `**Canonical contracts (Identity track)**` row is a section divider, mirroring the existing `**Deployment (CLI-side)**` divider style.

- [ ] **Step 2: Skip the dep-graph update**

The mermaid diagram below the packages table currently shows runtime/binding/demo wiring. The new contract packages have no inbound edges from any existing node yet (no consumer until a vendor module lands). Updating the diagram now would add disconnected nodes that confuse readers — skip and note in the commit.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(README): list contracts-common-v1 and contracts-identity-v1 in packages table"
```

---

## Task 13: Final cross-package verification

- [ ] **Step 1: Top-level build + test + lint + typecheck**

Run:
```bash
pnpm install --frozen-lockfile=false
pnpm -r run build
pnpm -r run test
pnpm -r run lint
pnpm -r run typecheck
```
Expected: all four commands succeed across every workspace package.

- [ ] **Step 2: Spot-check that downstream packages can actually import**

Run a transient sanity script — write it to `/tmp/check-imports.mjs`:

```javascript
import { proto as common } from '@rntme/contracts-common-v1';
import { proto as identity, errorCodes } from '@rntme/contracts-identity-v1';

const ref = common.rntme.contracts.common.v1.CanonicalRef.create({
  canonical_id: '1', vendor_id: 'v', module_name: 'identity-clerk', module_version: '0.0.0', contract_version: 'v1',
});
const u = identity.rntme.contracts.identity.v1.User.create({
  ref, email: 'a@b', status: identity.rntme.contracts.identity.v1.UserStatus.USER_STATUS_ACTIVE,
});
const buf = identity.rntme.contracts.identity.v1.User.encode(u).finish();
console.log('encoded bytes:', buf.length);
console.log('error code count:', errorCodes.structural.length + errorCodes.references.length + errorCodes.consistency.length + errorCodes.vendor.length);
```

Run: `node --experimental-vm-modules /tmp/check-imports.mjs` from inside `packages/contracts/identity/v1/` so that local `node_modules/@rntme/contracts-common-v1` resolves through pnpm's symlinked workspace tree.

Expected: prints two lines, the second being `error code count: 18`.

- [ ] **Step 3: No commit — this is a verification step.**

If anything fails, fix the underlying issue and back-propagate to the relevant earlier task. Do not paper over with a workaround.

---

## Self-review checklist

Before declaring this plan complete, re-read the spec sections and confirm coverage:

- [x] §4 layout — Tasks 1, 2, 5 land the directories and packages.
- [x] §5 `_common/v1/` content — Tasks 3, 4 land proto + tests.
- [x] §6 `identity/v1/` entities + enums — Task 6.
- [x] §7 service IdentityModule + request/response + error codes — Tasks 7, 9.
- [x] §8 seventeen events — Task 8.
- [x] §9 conformance suite — DEFERRED to Plan 2; this plan does not touch `modules/`.
- [x] §11 documentation-touch — Tasks 11, 12.
- [x] §12 plan decomposition — this is plan 1; plan 2 is `02-identity-conformance-skeleton.md`.

Open questions deferred from the spec:
- **OQ-IDV1-1** — closed in this plan: protobufjs static-module via `pbjs` + `pbts`.
- **OQ-IDV1-2** — remains open; first vendor module decides.
- **OQ-IDV1-3** — remains open; plan 2 or first vendor decides.
