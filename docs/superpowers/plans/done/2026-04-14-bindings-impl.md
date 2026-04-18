# Bindings Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@rntme/bindings` — a TypeScript package that defines the HTTP-bindings artifact format, validates it, and generates an OpenAPI 3.1 document. No runtime HTTP adapter (deferred to a future epic).

**Architecture:** Four pure layers — `parse → validateStructural → validateReferences → validateConsistency → generateOpenApi`. Each returns `Result<T>` aggregating errors within a layer; fail-fast between layers. Shape / graph-signature lookup is abstracted behind a `BindingResolvers` interface so the package has zero dependency on `@rntme/graph-ir-compiler`.

**Tech Stack:** TypeScript ESM on Node ≥ 20, pnpm 9 workspace, Zod ^3.23, Vitest (with `toMatchFileSnapshot` for goldens), ESLint + Prettier. Mirrors the style of `packages/graph-ir-compiler`.

**Source spec:** `docs/superpowers/specs/2026-04-14-bindings-design.md`. All identifiers, error codes, and mapping rules in this plan reference section numbers in that spec. Related: `graph_ir_rc_7.md` §21.

---

## File Structure

```
packages/bindings/
├── package.json
├── tsconfig.json
├── tsconfig.check.json
├── eslint.config.mjs
├── vitest.config.ts
├── README.md
└── src/
    ├── index.ts                 # public API barrel
    ├── types/
    │   ├── result.ts            # Result + BindingsError + ERROR_CODES + Layer
    │   ├── resolvers.ts         # BindingResolvers + GraphSignature + ResolvedShape etc.
    │   ├── artifact.ts          # BindingArtifact + branded stages
    │   ├── openapi.ts           # OpenApiDoc structural types
    │   └── index.ts             # re-export barrel
    ├── parse/
    │   ├── schema.ts            # Zod schema for BindingArtifact
    │   └── parse.ts             # parseBindingArtifact
    ├── validate/
    │   ├── structural.ts        # validateStructural
    │   ├── references.ts        # validateReferences
    │   ├── consistency.ts       # validateConsistency
    │   └── index.ts             # validateBindings (orchestrator)
    └── openapi/
        ├── shapes.ts            # FieldType / ResolvedShape → JSON Schema
        ├── parameters.ts        # GraphInput → parameter / body property
        ├── responses.ts         # GraphOutput → responses (rowset-only in MVP)
        ├── errors.ts            # standard ErrorResponse + 400/422/500
        ├── passthrough.ts       # deep-merge
        └── emit.ts              # generateOpenApi orchestrator

packages/bindings/test/
├── smoke.test.ts
├── unit/
│   ├── parse/
│   │   ├── parse.test.ts
│   │   └── schema.test.ts
│   ├── validate/
│   │   ├── structural.test.ts
│   │   ├── references.test.ts
│   │   ├── consistency.test.ts
│   │   └── index.test.ts
│   └── openapi/
│       ├── shapes.test.ts
│       ├── parameters.test.ts
│       ├── responses.test.ts
│       ├── errors.test.ts
│       ├── passthrough.test.ts
│       └── emit.test.ts
└── golden/
    └── category-sales/
        ├── category-sales.test.ts
        ├── artifact.json
        ├── fixtures.ts          # fake resolvers
        └── expected.openapi.json
```

Every source file has exactly one responsibility. Each validation sub-layer is one file: this mirrors how the compiler package's `validate/structural/*.ts` is split, scaled down to three files because bindings has a smaller validation surface.

---

## Conventions

- **Imports use `.js` extensions** (ESM): `import { X } from './result.js'`. This matches the compiler package.
- **Tests import from `src/` via relative paths**, not the package name, to avoid requiring `build` before test.
- **Every source file is covered by a unit test** written first (TDD). Tests live under `test/unit/<area>/<file>.test.ts`.
- **Each task ends with a commit.** Commit subjects follow the pattern `feat(bindings): …` / `test(bindings): …` / `chore(bindings): …`. No `--no-verify`, no signing flags.
- **Existing git repo at `/home/coder/project`.** Branch: whatever is currently checked out. Do not create new branches unless requested.

---

## Task 1: Scaffold package skeleton

**Files:**
- Create: `packages/bindings/package.json`
- Create: `packages/bindings/tsconfig.json`
- Create: `packages/bindings/tsconfig.check.json`
- Create: `packages/bindings/eslint.config.mjs`
- Create: `packages/bindings/vitest.config.ts`
- Create: `packages/bindings/README.md`
- Create: `packages/bindings/src/index.ts`
- Create: `packages/bindings/test/smoke.test.ts`

- [ ] **Step 1: Create `packages/bindings/package.json`**

```json
{
  "name": "@rntme/bindings",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "HTTP bindings artifact + OpenAPI 3.1 generator for Graph IR.",
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
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create `packages/bindings/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 3: Create `packages/bindings/tsconfig.check.json`**

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

- [ ] **Step 4: Create `packages/bindings/eslint.config.mjs`**

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
      globals: {
        console: 'readonly',
        process: 'readonly',
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

- [ ] **Step 5: Create `packages/bindings/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 6: Create `packages/bindings/README.md`**

```md
# @rntme/bindings

HTTP bindings artifact and OpenAPI 3.1 generator for Graph IR.

See `docs/superpowers/specs/2026-04-14-bindings-design.md` in the monorepo for the design document.

## Status

Draft MVP. Provides:

- `parseBindingArtifact` — Zod-based structural parsing.
- `validateBindings` — four-layer validator (structural / references / consistency).
- `generateOpenApi` — emits an OpenAPI 3.1 document from a validated artifact.

Out of scope: runtime HTTP adapter (future epic).
```

- [ ] **Step 7: Create `packages/bindings/src/index.ts` (minimal, expanded in later tasks)**

```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 8: Create `packages/bindings/test/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('smoke', () => {
  it('exposes package version', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
```

- [ ] **Step 9: Install deps and verify scaffold**

Run:
```bash
pnpm install
pnpm --filter @rntme/bindings run typecheck
pnpm --filter @rntme/bindings run test
pnpm --filter @rntme/bindings run lint
pnpm --filter @rntme/bindings run build
```

Expected:
- `typecheck`: exits 0 with no output.
- `test`: `1 passed` (smoke).
- `lint`: exits 0.
- `build`: creates `dist/index.js` and `dist/index.d.ts`.

- [ ] **Step 10: Commit**

```bash
git add packages/bindings
git commit -m "chore(bindings): scaffold package skeleton"
```

---

## Task 2: Result type + error codes

**Files:**
- Create: `packages/bindings/src/types/result.ts`
- Test: `packages/bindings/test/unit/types/result.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/types/result.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, ERROR_CODES } from '../../../src/types/result.js';

describe('result', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err wraps errors', () => {
    const r = err([
      { layer: 'parse', code: 'BINDINGS_PARSE_SCHEMA_VIOLATION', message: 'boom' },
    ]);
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    if (!r.ok) expect(r.errors).toHaveLength(1);
  });

  it('ERROR_CODES contains every documented code', () => {
    const expected = [
      'BINDINGS_PARSE_SCHEMA_VIOLATION',
      'BINDINGS_DUPLICATE_BINDING_ID',
      'BINDINGS_DUPLICATE_METHOD_PATH',
      'BINDINGS_DUPLICATE_PARAM_NAME',
      'BINDINGS_DUPLICATE_BIND_TO',
      'BINDINGS_PATH_PLACEHOLDER_MISMATCH',
      'BINDINGS_BODY_ON_GET',
      'BINDINGS_PATH_NOT_REQUIRED',
      'BINDINGS_UNRESOLVED_GRAPH',
      'BINDINGS_UNKNOWN_BIND_TO',
      'BINDINGS_UNRESOLVED_OUTPUT_SHAPE',
      'BINDINGS_GRAPH_HAS_ROOT_INPUT',
      'BINDINGS_UNSUPPORTED_OUTPUT_TYPE',
      'BINDINGS_REQUIRED_MISMATCH',
      'BINDINGS_TYPE_LOCATION_INVALID',
      'BINDINGS_UNBOUND_INPUT',
      'BINDINGS_INTERNAL',
    ];
    for (const code of expected) {
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES]).toBe(code);
    }
  });
});
```

- [ ] **Step 2: Run the test — expect module-not-found failure**

```bash
pnpm --filter @rntme/bindings exec vitest run test/unit/types/result.test.ts
```
Expected: FAIL with `Cannot find module '.../result.js'`.

- [ ] **Step 3: Implement `packages/bindings/src/types/result.ts`**

```ts
export type Layer = 'parse' | 'structural' | 'references' | 'consistency' | 'internal';

export type BindingsError = {
  layer: Layer;
  code: BindingsErrorCode;
  message: string;
  path?: string;
  hint?: string;
};

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; errors: BindingsError[] };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = (errors: BindingsError[]): Err => ({ ok: false, errors });
export const isOk = <T>(r: Result<T>): r is Ok<T> => r.ok;
export const isErr = <T>(r: Result<T>): r is Err => !r.ok;

export const ERROR_CODES = {
  BINDINGS_PARSE_SCHEMA_VIOLATION: 'BINDINGS_PARSE_SCHEMA_VIOLATION',
  BINDINGS_DUPLICATE_BINDING_ID: 'BINDINGS_DUPLICATE_BINDING_ID',
  BINDINGS_DUPLICATE_METHOD_PATH: 'BINDINGS_DUPLICATE_METHOD_PATH',
  BINDINGS_DUPLICATE_PARAM_NAME: 'BINDINGS_DUPLICATE_PARAM_NAME',
  BINDINGS_DUPLICATE_BIND_TO: 'BINDINGS_DUPLICATE_BIND_TO',
  BINDINGS_PATH_PLACEHOLDER_MISMATCH: 'BINDINGS_PATH_PLACEHOLDER_MISMATCH',
  BINDINGS_BODY_ON_GET: 'BINDINGS_BODY_ON_GET',
  BINDINGS_PATH_NOT_REQUIRED: 'BINDINGS_PATH_NOT_REQUIRED',
  BINDINGS_UNRESOLVED_GRAPH: 'BINDINGS_UNRESOLVED_GRAPH',
  BINDINGS_UNKNOWN_BIND_TO: 'BINDINGS_UNKNOWN_BIND_TO',
  BINDINGS_UNRESOLVED_OUTPUT_SHAPE: 'BINDINGS_UNRESOLVED_OUTPUT_SHAPE',
  BINDINGS_GRAPH_HAS_ROOT_INPUT: 'BINDINGS_GRAPH_HAS_ROOT_INPUT',
  BINDINGS_UNSUPPORTED_OUTPUT_TYPE: 'BINDINGS_UNSUPPORTED_OUTPUT_TYPE',
  BINDINGS_REQUIRED_MISMATCH: 'BINDINGS_REQUIRED_MISMATCH',
  BINDINGS_TYPE_LOCATION_INVALID: 'BINDINGS_TYPE_LOCATION_INVALID',
  BINDINGS_UNBOUND_INPUT: 'BINDINGS_UNBOUND_INPUT',
  BINDINGS_INTERNAL: 'BINDINGS_INTERNAL',
} as const;

export type BindingsErrorCode = keyof typeof ERROR_CODES;
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm --filter @rntme/bindings exec vitest run test/unit/types/result.test.ts
```
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/types/result.ts packages/bindings/test/unit/types/result.test.ts
git commit -m "feat(bindings): add Result type and error-code registry"
```

---

## Task 3: Resolver types (GraphSignature, ResolvedShape, BindingResolvers)

**Files:**
- Create: `packages/bindings/src/types/resolvers.ts`
- Test: `packages/bindings/test/unit/types/resolvers.test.ts`

These are pure type declarations; the test only pins down the shape of a fake resolver so the compiler flags breaking-changes.

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/types/resolvers.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type {
  BindingResolvers,
  GraphSignature,
  ResolvedShape,
  ScalarPrimitive,
} from '../../../src/types/resolvers.js';

describe('resolver types', () => {
  it('compiles a minimal valid resolver', () => {
    const shape: ResolvedShape = {
      name: 'Row',
      origin: 'custom',
      fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
    };
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        limit: {
          type: { kind: 'scalar', primitive: 'integer' },
          mode: 'defaulted',
          default: 20,
        },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 'tail' },
    };
    const resolvers: BindingResolvers = {
      resolveGraphSignature: (id) => (id === 'g' ? sig : null),
      resolveShape: (name) => (name === 'Row' ? shape : null),
    };
    const primitives: ScalarPrimitive[] = ['integer', 'decimal', 'string', 'boolean', 'date', 'datetime'];
    expect(resolvers.resolveGraphSignature('g')?.id).toBe('g');
    expect(resolvers.resolveShape('Row')?.origin).toBe('custom');
    expect(primitives).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm --filter @rntme/bindings exec vitest run test/unit/types/resolvers.test.ts
```
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/types/resolvers.ts`**

```ts
export type ScalarPrimitive = 'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime';

export type FieldType =
  | { kind: 'scalar'; primitive: ScalarPrimitive }
  | { kind: 'array'; element: ScalarPrimitive };

export type ShapeField = { type: FieldType; nullable: boolean };

export type ShapeOrigin = 'custom' | 'pdm' | 'qsm';

export type ResolvedShape = {
  name: string;
  origin: ShapeOrigin;
  fields: Record<string, ShapeField>;
};

export type InputMode = 'required' | 'nullable' | 'defaulted' | 'predicate_optional' | 'root';

export type InputType =
  | { kind: 'scalar'; primitive: ScalarPrimitive }
  | { kind: 'list'; element: ScalarPrimitive }
  | { kind: 'row'; shape: string }
  | { kind: 'rowset'; shape: string };

export type GraphInput = {
  type: InputType;
  mode: InputMode;
  default?: unknown;
};

export type OutputType =
  | { kind: 'rowset'; shape: string }
  | { kind: 'row'; shape: string }
  | { kind: 'scalar'; primitive: ScalarPrimitive };

export type GraphSignature = {
  id: string;
  inputs: Record<string, GraphInput>;
  output: { type: OutputType; from: string };
};

export type BindingResolvers = {
  resolveGraphSignature(graphId: string): GraphSignature | null;
  resolveShape(shapeName: string): ResolvedShape | null;
};
```

- [ ] **Step 4: Run test — expect pass**

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/types/resolvers.ts packages/bindings/test/unit/types/resolvers.test.ts
git commit -m "feat(bindings): declare resolver types (GraphSignature, ResolvedShape)"
```

---

## Task 4: Artifact types (BindingArtifact + branded stages)

**Files:**
- Create: `packages/bindings/src/types/artifact.ts`
- Test: `packages/bindings/test/unit/types/artifact.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/types/artifact.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type {
  BindingArtifact,
  BindingEntry,
  HttpBinding,
  HttpParameter,
  StructurallyValid,
  ResolvedBindings,
  ValidatedBindings,
  ResolvedBinding,
  OperationPassthrough,
  ParameterPassthrough,
} from '../../../src/types/artifact.js';
import type { GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

describe('artifact types', () => {
  it('types compose cleanly', () => {
    const param: HttpParameter = {
      name: 'limit',
      in: 'query',
      bindTo: 'limit',
      required: false,
    };
    const http: HttpBinding = {
      method: 'GET',
      path: '/v1/things',
      parameters: [param],
    };
    const entry: BindingEntry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http,
    };
    const artifact: BindingArtifact = {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: { primary: entry },
    };

    // branded types are assignable from their raw structure at construction time:
    const structural = artifact as StructurallyValid;

    const sig: GraphSignature = {
      id: 'g',
      inputs: { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 } },
      output: { type: { kind: 'rowset', shape: 'R' }, from: 't' },
    };
    const shape: ResolvedShape = {
      name: 'R',
      origin: 'custom',
      fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
    };
    const resolvedBinding: ResolvedBinding = {
      entry,
      signature: sig,
      outputShape: shape,
    };
    const resolved = { artifact: structural, resolved: { primary: resolvedBinding } } as ResolvedBindings;
    const validated = resolved as ValidatedBindings;

    const op: OperationPassthrough = { 'x-rate-limit': { max: 60 } };
    const pp: ParameterPassthrough = { example: 10 };

    expect(artifact.bindings.primary?.http.method).toBe('GET');
    expect(validated.resolved.primary?.signature.id).toBe('g');
    expect(op['x-rate-limit']).toBeTruthy();
    expect(pp.example).toBe(10);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module '.../artifact.js'`.

- [ ] **Step 3: Implement `packages/bindings/src/types/artifact.ts`**

```ts
import type { GraphSignature, ResolvedShape } from './resolvers.js';

export type OperationPassthrough = Record<string, unknown>;
export type ParameterPassthrough = Record<string, unknown>;

export type HttpMethod = 'GET' | 'POST';
export type HttpParameterLocation = 'query' | 'path' | 'body';

export type HttpParameter = {
  name: string;
  in: HttpParameterLocation;
  bindTo: string;
  required: boolean;
  description?: string;
  openapi?: ParameterPassthrough;
};

export type HttpBinding = {
  method: HttpMethod;
  path: string;
  parameters: HttpParameter[];
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  openapi?: OperationPassthrough;
};

export type BindingEntry = {
  graph: string;
  target: { engine: string; dialect: string };
  http: HttpBinding;
};

export type OpenApiDefaults = {
  info?: { title?: string; version?: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
};

export type BindingArtifact = {
  version: '1.0';
  graphSpecRef: string;
  pdmRef: string;
  qsmRef: string;
  openapi?: OpenApiDefaults;
  bindings: Record<string, BindingEntry>;
};

// Branded stages through the validation pipeline.

declare const __structural: unique symbol;
declare const __resolved: unique symbol;
declare const __validated: unique symbol;

export type StructurallyValid = BindingArtifact & { readonly [__structural]: true };

export type ResolvedBinding = {
  entry: BindingEntry;
  signature: GraphSignature;
  outputShape: ResolvedShape;
};

export type ResolvedBindings = {
  artifact: StructurallyValid;
  resolved: Record<string, ResolvedBinding>;
  readonly [__resolved]: true;
};

export type ValidatedBindings = ResolvedBindings & { readonly [__validated]: true };
```

- [ ] **Step 4: Run test — expect pass**

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/types/artifact.ts packages/bindings/test/unit/types/artifact.test.ts
git commit -m "feat(bindings): declare BindingArtifact and branded stages"
```

---

## Task 5: OpenAPI document types

**Files:**
- Create: `packages/bindings/src/types/openapi.ts`
- Test: `packages/bindings/test/unit/types/openapi.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/types/openapi.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type {
  OpenApiDoc,
  JsonSchema,
  OperationObject,
  ParameterObject,
  ResponseObject,
  PathItem,
} from '../../../src/types/openapi.js';

describe('openapi types', () => {
  it('constructs a minimal OpenAPI 3.1 document', () => {
    const schema: JsonSchema = { type: 'integer' };
    const param: ParameterObject = { name: 'limit', in: 'query', required: false, schema };
    const resp: ResponseObject = {
      description: 'OK',
      content: { 'application/json': { schema: { type: 'array', items: schema } } },
    };
    const op: OperationObject = {
      operationId: 'list',
      parameters: [param],
      responses: { '200': resp },
    };
    const path: PathItem = { get: op };
    const doc: OpenApiDoc = {
      openapi: '3.1.0',
      info: { title: 'API', version: '0.0.0' },
      paths: { '/things': path },
      components: { schemas: {} },
    };
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/things']?.get?.operationId).toBe('list');
  });
});
```

- [ ] **Step 2: Run — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/types/openapi.ts`**

```ts
export type JsonSchema = {
  type?: string | string[];
  format?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  default?: unknown;
  enum?: unknown[];
  additionalProperties?: boolean | JsonSchema;
  // arbitrary extensions (x-…):
  [key: string]: unknown;
};

export type MediaType = {
  schema?: JsonSchema;
  example?: unknown;
  [key: string]: unknown;
};

export type ParameterObject = {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema?: JsonSchema;
  style?: string;
  explode?: boolean;
  example?: unknown;
  [key: string]: unknown;
};

export type RequestBodyObject = {
  required?: boolean;
  content: Record<string, MediaType>;
  description?: string;
  [key: string]: unknown;
};

export type ResponseObject = {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OperationObject = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  [key: string]: unknown;
};

export type PathItem = {
  get?: OperationObject;
  post?: OperationObject;
  [key: string]: OperationObject | undefined | string;
};

export type InfoObject = {
  title: string;
  version: string;
  description?: string;
};

export type ServerObject = {
  url: string;
  description?: string;
};

export type OpenApiDoc = {
  openapi: '3.1.0';
  info: InfoObject;
  servers?: ServerObject[];
  paths: Record<string, PathItem>;
  components: { schemas: Record<string, JsonSchema> };
};
```

- [ ] **Step 4: Run — expect pass**

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/types/openapi.ts packages/bindings/test/unit/types/openapi.test.ts
git commit -m "feat(bindings): declare OpenAPI 3.1 structural types"
```

---

## Task 6: Types barrel

**Files:**
- Create: `packages/bindings/src/types/index.ts`

Thin re-export barrel. No test — just verified by downstream imports.

- [ ] **Step 1: Create `packages/bindings/src/types/index.ts`**

```ts
export * from './result.js';
export * from './resolvers.js';
export * from './artifact.js';
export * from './openapi.js';
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter @rntme/bindings run typecheck
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/bindings/src/types/index.ts
git commit -m "feat(bindings): add types barrel"
```

---

## Task 7: Zod schema for BindingArtifact

**Files:**
- Create: `packages/bindings/src/parse/schema.ts`
- Test: `packages/bindings/test/unit/parse/schema.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/parse/schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { BindingArtifactSchema } from '../../../src/parse/schema.js';

const minimalArtifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
      },
    },
  },
};

describe('BindingArtifactSchema', () => {
  it('accepts a minimal valid artifact', () => {
    expect(BindingArtifactSchema.safeParse(minimalArtifact).success).toBe(true);
  });

  it('rejects unknown top-level version', () => {
    const bad = { ...minimalArtifact, version: '2.0' };
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid method', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.method = 'DELETE';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid parameter location', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.parameters[0].in = 'header';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects path without leading slash', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.path = 'v1/things';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects path containing query string', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.path = '/v1/things?limit=5';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts passthrough openapi fragments', () => {
    const ok = JSON.parse(JSON.stringify(minimalArtifact));
    ok.bindings.primary.http.openapi = { 'x-rate-limit': { max: 60 } };
    ok.bindings.primary.http.parameters[0].openapi = { example: 5 };
    expect(BindingArtifactSchema.safeParse(ok).success).toBe(true);
  });

  it('accepts optional top-level openapi defaults', () => {
    const ok = {
      ...minimalArtifact,
      openapi: {
        info: { title: 'T', version: '0.0.1' },
        servers: [{ url: 'https://api.example.com' }],
      },
    };
    expect(BindingArtifactSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects empty parameters name', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.parameters[0].name = '';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module '.../schema.js'`.

- [ ] **Step 3: Implement `packages/bindings/src/parse/schema.ts`**

```ts
import { z } from 'zod';

const nonEmptyString = z.string().min(1);

const pathString = z
  .string()
  .regex(/^\/[^?#]*$/, 'path must start with "/" and contain no "?" or "#"');

const passthrough = z.record(z.unknown());

const parameterSchema = z
  .object({
    name: nonEmptyString,
    in: z.enum(['query', 'path', 'body']),
    bindTo: nonEmptyString,
    required: z.boolean(),
    description: z.string().optional(),
    openapi: passthrough.optional(),
  })
  .strict();

const httpSchema = z
  .object({
    method: z.enum(['GET', 'POST']),
    path: pathString,
    parameters: z.array(parameterSchema),
    summary: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(nonEmptyString).optional(),
    operationId: nonEmptyString.optional(),
    openapi: passthrough.optional(),
  })
  .strict();

const bindingEntrySchema = z
  .object({
    graph: nonEmptyString,
    target: z
      .object({
        engine: nonEmptyString,
        dialect: nonEmptyString,
      })
      .strict(),
    http: httpSchema,
  })
  .strict();

const openApiDefaultsSchema = z
  .object({
    info: z
      .object({
        title: z.string().optional(),
        version: z.string().optional(),
        description: z.string().optional(),
      })
      .strict()
      .optional(),
    servers: z
      .array(
        z
          .object({
            url: nonEmptyString,
            description: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const BindingArtifactSchema = z
  .object({
    version: z.literal('1.0'),
    graphSpecRef: nonEmptyString,
    pdmRef: nonEmptyString,
    qsmRef: nonEmptyString,
    openapi: openApiDefaultsSchema.optional(),
    bindings: z.record(bindingEntrySchema),
  })
  .strict();

export type BindingArtifactParsed = z.infer<typeof BindingArtifactSchema>;
```

- [ ] **Step 4: Run test — expect pass**

Expected: `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/parse/schema.ts packages/bindings/test/unit/parse/schema.test.ts
git commit -m "feat(bindings): add Zod schema for BindingArtifact"
```

---

## Task 8: parseBindingArtifact

**Files:**
- Create: `packages/bindings/src/parse/parse.ts`
- Test: `packages/bindings/test/unit/parse/parse.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/parse/parse.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseBindingArtifact } from '../../../src/parse/parse.js';

const minimal = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [],
      },
    },
  },
};

describe('parseBindingArtifact', () => {
  it('parses an object', () => {
    const r = parseBindingArtifact(minimal);
    expect(r.ok).toBe(true);
  });

  it('parses a JSON string', () => {
    const r = parseBindingArtifact(JSON.stringify(minimal));
    expect(r.ok).toBe(true);
  });

  it('returns BINDINGS_PARSE_SCHEMA_VIOLATION on malformed JSON string', () => {
    const r = parseBindingArtifact('{ not json');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('BINDINGS_PARSE_SCHEMA_VIOLATION');
      expect(r.errors[0]?.layer).toBe('parse');
    }
  });

  it('returns BINDINGS_PARSE_SCHEMA_VIOLATION on wrong shape', () => {
    const r = parseBindingArtifact({ version: 'nope' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.every((e) => e.code === 'BINDINGS_PARSE_SCHEMA_VIOLATION')).toBe(true);
      expect(r.errors.every((e) => e.layer === 'parse')).toBe(true);
    }
  });

  it('includes JSON path on schema violations', () => {
    const bad = JSON.parse(JSON.stringify(minimal));
    bad.bindings.primary.http.method = 'PATCH';
    const r = parseBindingArtifact(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.path?.includes('http.method'))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module '.../parse.js'`.

- [ ] **Step 3: Implement `packages/bindings/src/parse/parse.ts`**

```ts
import { BindingArtifactSchema } from './schema.js';
import type { BindingArtifact } from '../types/artifact.js';
import { err, ok, ERROR_CODES, type Result, type BindingsError } from '../types/result.js';

export function parseBindingArtifact(input: unknown): Result<BindingArtifact> {
  let candidate: unknown = input;
  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input) as unknown;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'invalid JSON';
      return err([
        {
          layer: 'parse',
          code: ERROR_CODES.BINDINGS_PARSE_SCHEMA_VIOLATION,
          message,
        },
      ]);
    }
  }

  const parsed = BindingArtifactSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors: BindingsError[] = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : undefined;
      const base: BindingsError = {
        layer: 'parse',
        code: ERROR_CODES.BINDINGS_PARSE_SCHEMA_VIOLATION,
        message: issue.message,
      };
      return path !== undefined ? { ...base, path } : base;
    });
    return err(errors);
  }

  return ok(parsed.data as BindingArtifact);
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/parse/parse.ts packages/bindings/test/unit/parse/parse.test.ts
git commit -m "feat(bindings): implement parseBindingArtifact"
```

---

## Task 9: Structural validation

**Files:**
- Create: `packages/bindings/src/validate/structural.ts`
- Test: `packages/bindings/test/unit/validate/structural.test.ts`

Covers (design §4.3, §6.1 structural layer):
- duplicate `method + path`
- duplicate `(in, name)` within a binding
- duplicate `bindTo` within a binding
- path placeholder mismatch
- body on GET
- `in: "path"` with `required: false`

`BINDINGS_DUPLICATE_BINDING_ID` is not reachable after parse (object keys coalesce in JS); we still emit the error if the input happens to have the property registered twice (defensive check via `Object.keys` length comparison is impossible post-JSON.parse — left off). Skip that code at structural time.

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/validate/structural.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../../src/validate/structural.js';
import type { BindingArtifact } from '../../../src/types/artifact.js';

const base: BindingArtifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [
          { name: 'limit', in: 'query', bindTo: 'limit', required: false },
        ],
      },
    },
  },
};

const clone = (a: BindingArtifact): BindingArtifact =>
  JSON.parse(JSON.stringify(a)) as BindingArtifact;

const first = <T>(xs: T[]): T => {
  if (xs.length === 0) throw new Error('empty');
  return xs[0] as T;
};

describe('validateStructural', () => {
  it('accepts a minimal valid artifact', () => {
    const r = validateStructural(base);
    expect(r.ok).toBe(true);
  });

  it('detects duplicate method + path', () => {
    const bad = clone(base);
    bad.bindings.other = {
      graph: 'other',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [],
      },
    };
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_DUPLICATE_METHOD_PATH')).toBe(true);
  });

  it('detects duplicate (in, name) within a binding', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({
      name: 'limit',
      in: 'query',
      bindTo: 'other',
      required: false,
    });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_DUPLICATE_PARAM_NAME');
  });

  it('detects duplicate bindTo within a binding', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({
      name: 'limit2',
      in: 'query',
      bindTo: 'limit',
      required: false,
    });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_DUPLICATE_BIND_TO');
  });

  it('detects path placeholder mismatch (extra placeholder)', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.path = '/v1/things/{id}';
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_PATH_PLACEHOLDER_MISMATCH');
  });

  it('detects path placeholder mismatch (extra path parameter)', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({ name: 'id', in: 'path', bindTo: 'id', required: true });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_PATH_PLACEHOLDER_MISMATCH');
  });

  it('detects path parameter with required=false', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.path = '/v1/things/{id}';
    primary.http.parameters = [
      { name: 'id', in: 'path', bindTo: 'id', required: false },
    ];
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_PATH_NOT_REQUIRED')).toBe(true);
  });

  it('detects body parameter on GET', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({ name: 'payload', in: 'body', bindTo: 'payload', required: true });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_BODY_ON_GET')).toBe(true);
  });

  it('accepts POST with body parameters', () => {
    const good = clone(base);
    const primary = good.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.method = 'POST';
    primary.http.parameters.push({ name: 'payload', in: 'body', bindTo: 'payload', required: true });
    const r = validateStructural(good);
    expect(r.ok).toBe(true);
  });

  it('aggregates multiple errors in one err()', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({
      name: 'limit', // duplicate name
      in: 'query',
      bindTo: 'limit', // duplicate bindTo
      required: false,
    });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain('BINDINGS_DUPLICATE_PARAM_NAME');
      expect(codes).toContain('BINDINGS_DUPLICATE_BIND_TO');
    }
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module '.../structural.js'`.

- [ ] **Step 3: Implement `packages/bindings/src/validate/structural.ts`**

```ts
import type { BindingArtifact, BindingEntry, HttpParameter, StructurallyValid } from '../types/artifact.js';
import { err, ok, ERROR_CODES, type Result, type BindingsError } from '../types/result.js';

const PLACEHOLDER_RE = /\{([^{}]+)\}/g;

function extractPathPlaceholders(path: string): string[] {
  const names: string[] = [];
  for (const match of path.matchAll(PLACEHOLDER_RE)) {
    if (match[1] !== undefined) names.push(match[1]);
  }
  return names;
}

function checkBinding(
  id: string,
  entry: BindingEntry,
  errors: BindingsError[],
): void {
  const basePath = `bindings.${id}.http`;
  const paramPath = (i: number) => `${basePath}.parameters[${i}]`;
  const { method, path, parameters } = entry.http;

  // (in, name) uniqueness
  const seenName = new Set<string>();
  const seenBindTo = new Set<string>();
  parameters.forEach((p: HttpParameter, i: number) => {
    const key = `${p.in}:${p.name}`;
    if (seenName.has(key)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_DUPLICATE_PARAM_NAME,
        message: `Duplicate parameter (in=${p.in}, name="${p.name}") in binding "${id}"`,
        path: paramPath(i),
      });
    }
    seenName.add(key);

    if (seenBindTo.has(p.bindTo)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_DUPLICATE_BIND_TO,
        message: `Duplicate bindTo "${p.bindTo}" in binding "${id}"`,
        path: paramPath(i),
      });
    }
    seenBindTo.add(p.bindTo);

    if (p.in === 'path' && p.required !== true) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_PATH_NOT_REQUIRED,
        message: `Path parameter "${p.name}" must be required`,
        path: paramPath(i),
      });
    }

    if (method === 'GET' && p.in === 'body') {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_BODY_ON_GET,
        message: `GET binding "${id}" cannot have body parameters`,
        path: paramPath(i),
      });
    }
  });

  // path placeholders ↔ path parameters symmetric
  const placeholders = new Set(extractPathPlaceholders(path));
  const pathParams = new Set(parameters.filter((p) => p.in === 'path').map((p) => p.name));
  const missingParams = [...placeholders].filter((name) => !pathParams.has(name));
  const extraParams = [...pathParams].filter((name) => !placeholders.has(name));
  if (missingParams.length > 0 || extraParams.length > 0) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.BINDINGS_PATH_PLACEHOLDER_MISMATCH,
      message:
        `Path placeholders and parameters disagree in binding "${id}". ` +
        `Missing params: [${missingParams.join(', ')}]; extra params: [${extraParams.join(', ')}]`,
      path: `${basePath}.path`,
    });
  }
}

export function validateStructural(artifact: BindingArtifact): Result<StructurallyValid> {
  const errors: BindingsError[] = [];

  // method + path uniqueness across all bindings
  const seenMethodPath = new Map<string, string>();
  for (const [id, entry] of Object.entries(artifact.bindings)) {
    const key = `${entry.http.method} ${entry.http.path}`;
    const prev = seenMethodPath.get(key);
    if (prev !== undefined) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_DUPLICATE_METHOD_PATH,
        message: `Duplicate method+path "${key}": bindings "${prev}" and "${id}"`,
        path: `bindings.${id}.http.path`,
      });
    } else {
      seenMethodPath.set(key, id);
    }
  }

  for (const [id, entry] of Object.entries(artifact.bindings)) {
    checkBinding(id, entry, errors);
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as StructurallyValid);
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `10 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/validate/structural.ts packages/bindings/test/unit/validate/structural.test.ts
git commit -m "feat(bindings): implement structural validation layer"
```

---

## Task 10: Reference validation

**Files:**
- Create: `packages/bindings/src/validate/references.ts`
- Test: `packages/bindings/test/unit/validate/references.test.ts`

Covers: `BINDINGS_UNRESOLVED_GRAPH`, `BINDINGS_UNKNOWN_BIND_TO`, `BINDINGS_UNRESOLVED_OUTPUT_SHAPE`. Output: `ResolvedBindings` (artifact + per-binding resolved signature + outputShape).

Handling of non-rowset outputs: the reference layer may fail to resolve `outputShape` if `output.type.kind === 'scalar'` (there is no shape to resolve). In that case the layer skips `BINDINGS_UNRESOLVED_OUTPUT_SHAPE` and leaves the non-shape output for consistency to flag. We represent non-rowset outputs as "placeholder shape" in a separate internal-only branch — but since consistency rejects non-rowset, we simplify: if output is non-rowset, reference layer skips shape lookup and stores a synthetic empty shape object that is only valid inside `ResolvedBinding.outputShape`. Consistency then rejects the graph. This keeps `ResolvedBinding.outputShape` non-null for the type.

Test list:
- happy path
- unresolved graph
- unknown bindTo
- unresolved output shape (shape ref that resolver returns null for)
- scalar output → reference layer skips shape lookup (still OK here; consistency rejects)

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/validate/references.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validateReferences } from '../../../src/validate/references.js';
import type { StructurallyValid } from '../../../src/types/artifact.js';
import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const artifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
      },
    },
  },
} as unknown as StructurallyValid;

const defaultSig: GraphSignature = {
  id: 'g',
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
};

const defaultShape: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
};

const makeResolvers = (
  overrides: Partial<BindingResolvers> = {},
): BindingResolvers => ({
  resolveGraphSignature: (id) => (id === 'g' ? defaultSig : null),
  resolveShape: (name) => (name === 'Row' ? defaultShape : null),
  ...overrides,
});

describe('validateReferences', () => {
  it('resolves graph and output shape', () => {
    const r = validateReferences(artifact, makeResolvers());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.resolved.primary?.signature.id).toBe('g');
      expect(r.value.resolved.primary?.outputShape.name).toBe('Row');
    }
  });

  it('errors when graph unresolved', () => {
    const r = validateReferences(
      artifact,
      makeResolvers({ resolveGraphSignature: () => null }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BINDINGS_UNRESOLVED_GRAPH');
  });

  it('errors when bindTo unknown', () => {
    const sig: GraphSignature = { ...defaultSig, inputs: {} };
    const r = validateReferences(
      artifact,
      makeResolvers({ resolveGraphSignature: () => sig }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNKNOWN_BIND_TO')).toBe(true);
  });

  it('errors when output shape unresolved', () => {
    const r = validateReferences(
      artifact,
      makeResolvers({ resolveShape: () => null }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNRESOLVED_OUTPUT_SHAPE')).toBe(true);
  });

  it('skips output shape lookup for scalar output', () => {
    const scalarSig: GraphSignature = {
      ...defaultSig,
      output: { type: { kind: 'scalar', primitive: 'boolean' }, from: 't' },
    };
    const r = validateReferences(
      artifact,
      makeResolvers({ resolveGraphSignature: () => scalarSig }),
    );
    // reference layer passes; consistency layer will fail on unsupported output
    expect(r.ok).toBe(true);
  });

  it('aggregates multiple errors', () => {
    const r = validateReferences(artifact, {
      resolveGraphSignature: () => null,
      resolveShape: () => null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // when graph is missing, we cannot check bindTo/output; but we still produce UNRESOLVED_GRAPH per binding.
      expect(r.errors[0]?.code).toBe('BINDINGS_UNRESOLVED_GRAPH');
    }
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/validate/references.ts`**

```ts
import type {
  BindingEntry,
  ResolvedBinding,
  ResolvedBindings,
  StructurallyValid,
} from '../types/artifact.js';
import type { BindingResolvers, ResolvedShape } from '../types/resolvers.js';
import { err, ok, ERROR_CODES, type Result, type BindingsError } from '../types/result.js';

const PLACEHOLDER_SHAPE: ResolvedShape = {
  name: '__placeholder__',
  origin: 'custom',
  fields: {},
};

function resolveBinding(
  id: string,
  entry: BindingEntry,
  resolvers: BindingResolvers,
  errors: BindingsError[],
): ResolvedBinding | null {
  const basePath = `bindings.${id}`;
  const sig = resolvers.resolveGraphSignature(entry.graph);
  if (sig === null) {
    errors.push({
      layer: 'references',
      code: ERROR_CODES.BINDINGS_UNRESOLVED_GRAPH,
      message: `Binding "${id}" references unknown graph "${entry.graph}"`,
      path: `${basePath}.graph`,
    });
    return null;
  }

  // bindTo resolution
  entry.http.parameters.forEach((p, i) => {
    if (!(p.bindTo in sig.inputs)) {
      errors.push({
        layer: 'references',
        code: ERROR_CODES.BINDINGS_UNKNOWN_BIND_TO,
        message: `Parameter "${p.name}" in binding "${id}" binds to unknown input "${p.bindTo}" of graph "${entry.graph}"`,
        path: `${basePath}.http.parameters[${i}].bindTo`,
      });
    }
  });

  // Output shape resolution — only for rowset/row outputs.
  let outputShape = PLACEHOLDER_SHAPE;
  const { output } = sig;
  if (output.type.kind === 'rowset' || output.type.kind === 'row') {
    const shape = resolvers.resolveShape(output.type.shape);
    if (shape === null) {
      errors.push({
        layer: 'references',
        code: ERROR_CODES.BINDINGS_UNRESOLVED_OUTPUT_SHAPE,
        message: `Graph "${entry.graph}" output references unknown shape "${output.type.shape}"`,
        path: `${basePath}.graph`,
      });
      return null;
    }
    outputShape = shape;
  }

  return { entry, signature: sig, outputShape };
}

export function validateReferences(
  artifact: StructurallyValid,
  resolvers: BindingResolvers,
): Result<ResolvedBindings> {
  const errors: BindingsError[] = [];
  const resolved: Record<string, ResolvedBinding> = {};

  for (const [id, entry] of Object.entries(artifact.bindings)) {
    const rb = resolveBinding(id, entry, resolvers, errors);
    if (rb !== null) resolved[id] = rb;
  }

  if (errors.length > 0) return err(errors);
  return ok({ artifact, resolved } as ResolvedBindings);
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/validate/references.ts packages/bindings/test/unit/validate/references.test.ts
git commit -m "feat(bindings): implement reference validation layer"
```

---

## Task 11: Consistency validation

**Files:**
- Create: `packages/bindings/src/validate/consistency.ts`
- Test: `packages/bindings/test/unit/validate/consistency.test.ts`

Covers (design §4.4, §6.4 consistency):
- `BINDINGS_GRAPH_HAS_ROOT_INPUT` — any input with `mode: "root"` in the graph's signature.
- `BINDINGS_UNSUPPORTED_OUTPUT_TYPE` — output kind not `rowset`.
- `BINDINGS_REQUIRED_MISMATCH` — `required` value conflicts with input `mode` per table in §4.4.
- `BINDINGS_TYPE_LOCATION_INVALID` — `list<T>` in `path`; `row<>`/`rowset<>` anywhere.
- `BINDINGS_UNBOUND_INPUT` — input `mode` is `required` or `nullable` and has no matching parameter.

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/validate/consistency.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validateConsistency } from '../../../src/validate/consistency.js';
import type { ResolvedBindings, ResolvedBinding } from '../../../src/types/artifact.js';
import type { GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const outputShape: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
};

const makeResolved = (over: Partial<ResolvedBinding> = {}): ResolvedBindings => {
  const entry = over.entry ?? {
    graph: 'g',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'GET',
      path: '/v1/things',
      parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
    },
  };
  const signature: GraphSignature = over.signature ?? {
    id: 'g',
    inputs: {
      limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
    },
    output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
  };
  const binding: ResolvedBinding = {
    entry,
    signature,
    outputShape: over.outputShape ?? outputShape,
  };
  return {
    artifact: {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: { primary: entry },
    },
    resolved: { primary: binding },
  } as unknown as ResolvedBindings;
};

describe('validateConsistency', () => {
  it('accepts a clean binding', () => {
    const r = validateConsistency(makeResolved());
    expect(r.ok).toBe(true);
  });

  it('rejects graph with root input', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        $root: { type: { kind: 'row', shape: 'Root' }, mode: 'root' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_GRAPH_HAS_ROOT_INPUT')).toBe(true);
  });

  it('rejects non-rowset output', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {},
      output: { type: { kind: 'row', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNSUPPORTED_OUTPUT_TYPE')).toBe(true);
  });

  it('rejects required mismatch: mode=required with required=false', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_REQUIRED_MISMATCH')).toBe(true);
  });

  it('rejects required mismatch: mode=defaulted with required=true', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET' as const,
        path: '/v1/things',
        parameters: [{ name: 'limit', in: 'query' as const, bindTo: 'limit', required: true }],
      },
    };
    const r = validateConsistency(makeResolved({ signature: sig, entry }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_REQUIRED_MISMATCH')).toBe(true);
  });

  it('rejects list<T> in path', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: { ids: { type: { kind: 'list', element: 'integer' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET' as const,
        path: '/v1/things/{ids}',
        parameters: [{ name: 'ids', in: 'path' as const, bindTo: 'ids', required: true }],
      },
    };
    const r = validateConsistency(makeResolved({ signature: sig, entry }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_TYPE_LOCATION_INVALID')).toBe(true);
  });

  it('rejects row<> type on parameter (root-only types cannot bind)', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: { payload: { type: { kind: 'row', shape: 'Anything' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST' as const,
        path: '/v1/things',
        parameters: [{ name: 'payload', in: 'body' as const, bindTo: 'payload', required: true }],
      },
    };
    const r = validateConsistency(makeResolved({ signature: sig, entry }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_TYPE_LOCATION_INVALID')).toBe(true);
  });

  it('rejects unbound required input', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
        dateFrom: { type: { kind: 'scalar', primitive: 'date' }, mode: 'required' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNBOUND_INPUT')).toBe(true);
  });

  it('rejects unbound nullable input', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
        filter: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNBOUND_INPUT')).toBe(true);
  });

  it('accepts unbound defaulted and predicate_optional inputs', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
        minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET' as const,
        path: '/v1/things',
        parameters: [],
      },
    };
    const r = validateConsistency(makeResolved({ signature: sig, entry }));
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/validate/consistency.ts`**

```ts
import type {
  BindingEntry,
  HttpParameter,
  ResolvedBinding,
  ResolvedBindings,
  ValidatedBindings,
} from '../types/artifact.js';
import type { GraphInput, GraphSignature, InputMode, InputType } from '../types/resolvers.js';
import { err, ok, ERROR_CODES, type Result, type BindingsError } from '../types/result.js';

const REQUIRED_BY_MODE: Record<InputMode, readonly boolean[]> = {
  required: [true],
  defaulted: [false],
  predicate_optional: [false],
  nullable: [true, false],
  root: [],
};

function checkGraphShape(
  id: string,
  signature: GraphSignature,
  errors: BindingsError[],
): boolean {
  const basePath = `bindings.${id}.graph`;
  let fatal = false;

  for (const [inputName, input] of Object.entries(signature.inputs)) {
    if (input.mode === 'root') {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_GRAPH_HAS_ROOT_INPUT,
        message: `Graph "${signature.id}" has root input "${inputName}" and cannot be bound as HTTP endpoint`,
        path: basePath,
      });
      fatal = true;
    }
  }

  if (signature.output.type.kind !== 'rowset') {
    errors.push({
      layer: 'consistency',
      code: ERROR_CODES.BINDINGS_UNSUPPORTED_OUTPUT_TYPE,
      message: `Graph "${signature.id}" output kind "${signature.output.type.kind}" is not bindable — must be rowset`,
      path: basePath,
    });
    fatal = true;
  }

  return !fatal;
}

function checkTypeLocation(input: InputType, location: HttpParameter['in']): boolean {
  switch (input.kind) {
    case 'scalar':
      return true; // valid everywhere
    case 'list':
      return location !== 'path';
    case 'row':
    case 'rowset':
      return false; // forbidden anywhere (root would have been caught earlier)
  }
}

function checkParameters(
  id: string,
  entry: BindingEntry,
  signature: GraphSignature,
  errors: BindingsError[],
): void {
  const paramPath = (i: number) => `bindings.${id}.http.parameters[${i}]`;

  entry.http.parameters.forEach((p, i) => {
    const input = signature.inputs[p.bindTo];
    if (input === undefined) return; // already caught by reference layer

    const allowed = REQUIRED_BY_MODE[input.mode];
    if (!allowed.includes(p.required)) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_REQUIRED_MISMATCH,
        message:
          `Parameter "${p.name}" in binding "${id}" has required=${p.required}, ` +
          `but input "${p.bindTo}" has mode=${input.mode} (allowed required: [${allowed.join(', ')}])`,
        path: `${paramPath(i)}.required`,
      });
    }

    if (!checkTypeLocation(input.type, p.in)) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_TYPE_LOCATION_INVALID,
        message: `Parameter "${p.name}" binds input of kind "${input.type.kind}" to location "${p.in}", which is not allowed`,
        path: `${paramPath(i)}.in`,
      });
    }
  });
}

function checkUnbound(
  id: string,
  entry: BindingEntry,
  signature: GraphSignature,
  errors: BindingsError[],
): void {
  const basePath = `bindings.${id}.http.parameters`;
  const boundTargets = new Set(entry.http.parameters.map((p) => p.bindTo));

  for (const [inputName, input] of Object.entries(signature.inputs)) {
    if (input.mode === 'root') continue;
    if (input.mode !== 'required' && input.mode !== 'nullable') continue;
    if (!boundTargets.has(inputName)) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_UNBOUND_INPUT,
        message:
          `Input "${inputName}" of graph "${signature.id}" has mode=${input.mode} ` +
          `and must be bound by binding "${id}"`,
        path: basePath,
      });
    }
  }
}

export function validateConsistency(resolved: ResolvedBindings): Result<ValidatedBindings> {
  const errors: BindingsError[] = [];

  for (const [id, binding] of Object.entries(resolved.resolved)) {
    const shapeOk = checkGraphShape(id, binding.signature, errors);
    if (!shapeOk) continue; // don't run parameter checks against unbindable graph

    checkParameters(id, binding.entry, binding.signature, errors);
    checkUnbound(id, binding.entry, binding.signature, errors);
  }

  if (errors.length > 0) return err(errors);
  return ok(resolved as ValidatedBindings);
}

// Re-exports used in tests/doc only; keep within this file's surface.
export type { GraphInput };
```

- [ ] **Step 4: Run test — expect pass**

Expected: `10 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/validate/consistency.ts packages/bindings/test/unit/validate/consistency.test.ts
git commit -m "feat(bindings): implement consistency validation layer"
```

---

## Task 12: validateBindings orchestrator

**Files:**
- Create: `packages/bindings/src/validate/index.ts`
- Test: `packages/bindings/test/unit/validate/index.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/validate/index.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validateBindings } from '../../../src/validate/index.js';
import type { BindingArtifact } from '../../../src/types/artifact.js';
import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const artifact: BindingArtifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
      },
    },
  },
};

const goodSig: GraphSignature = {
  id: 'g',
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
};

const goodShape: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'g' ? goodSig : null),
  resolveShape: (name) => (name === 'Row' ? goodShape : null),
};

describe('validateBindings', () => {
  it('completes all three layers for a valid artifact', () => {
    const r = validateBindings(artifact, resolvers);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.resolved.primary?.signature.id).toBe('g');
  });

  it('fails fast at structural layer', () => {
    const bad = JSON.parse(JSON.stringify(artifact)) as BindingArtifact;
    bad.bindings.dup = { ...(bad.bindings.primary!) };
    const r = validateBindings(bad, resolvers);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.every((e) => e.layer === 'structural')).toBe(true);
    }
  });

  it('fails fast at references layer', () => {
    const r = validateBindings(artifact, {
      resolveGraphSignature: () => null,
      resolveShape: () => null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => e.layer === 'references')).toBe(true);
  });

  it('fails at consistency layer', () => {
    const sig: GraphSignature = {
      ...goodSig,
      inputs: { limit: { ...goodSig.inputs.limit!, mode: 'required' } },
    };
    const r = validateBindings(artifact, {
      resolveGraphSignature: () => sig,
      resolveShape: () => goodShape,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => e.layer === 'consistency')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/validate/index.ts`**

```ts
import type { BindingArtifact, ValidatedBindings } from '../types/artifact.js';
import type { BindingResolvers } from '../types/resolvers.js';
import type { Result } from '../types/result.js';
import { validateStructural } from './structural.js';
import { validateReferences } from './references.js';
import { validateConsistency } from './consistency.js';

export function validateBindings(
  artifact: BindingArtifact,
  resolvers: BindingResolvers,
): Result<ValidatedBindings> {
  const s = validateStructural(artifact);
  if (!s.ok) return s;
  const r = validateReferences(s.value, resolvers);
  if (!r.ok) return r;
  return validateConsistency(r.value);
}

export { validateStructural } from './structural.js';
export { validateReferences } from './references.js';
export { validateConsistency } from './consistency.js';
```

- [ ] **Step 4: Run test — expect pass**

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/validate/index.ts packages/bindings/test/unit/validate/index.test.ts
git commit -m "feat(bindings): add validateBindings orchestrator"
```

---

## Task 13: OpenAPI — shapes → JSON Schema

**Files:**
- Create: `packages/bindings/src/openapi/shapes.ts`
- Test: `packages/bindings/test/unit/openapi/shapes.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/openapi/shapes.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { fieldToJsonSchema, shapeToJsonSchema, primitiveToJsonSchema } from '../../../src/openapi/shapes.js';
import type { ResolvedShape } from '../../../src/types/resolvers.js';

describe('primitiveToJsonSchema', () => {
  it('maps integer', () => {
    expect(primitiveToJsonSchema('integer', { decimalEncoding: 'string' })).toEqual({ type: 'integer' });
  });
  it('maps decimal as string by default', () => {
    expect(primitiveToJsonSchema('decimal', { decimalEncoding: 'string' })).toEqual({
      type: 'string',
      format: 'decimal',
    });
  });
  it('maps decimal as number when option set', () => {
    expect(primitiveToJsonSchema('decimal', { decimalEncoding: 'number' })).toEqual({ type: 'number' });
  });
  it('maps string, boolean', () => {
    expect(primitiveToJsonSchema('string', { decimalEncoding: 'string' })).toEqual({ type: 'string' });
    expect(primitiveToJsonSchema('boolean', { decimalEncoding: 'string' })).toEqual({ type: 'boolean' });
  });
  it('maps date and datetime', () => {
    expect(primitiveToJsonSchema('date', { decimalEncoding: 'string' })).toEqual({
      type: 'string',
      format: 'date',
    });
    expect(primitiveToJsonSchema('datetime', { decimalEncoding: 'string' })).toEqual({
      type: 'string',
      format: 'date-time',
    });
  });
});

describe('fieldToJsonSchema', () => {
  it('maps scalar non-null', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: 'integer' });
  });

  it('maps scalar nullable with union type', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: ['string', 'null'] });
  });

  it('preserves format when adding null', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'scalar', primitive: 'datetime' }, nullable: true },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: ['string', 'null'], format: 'date-time' });
  });

  it('maps array of scalar', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'array', element: 'integer' }, nullable: false },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: 'array', items: { type: 'integer' } });
  });

  it('maps nullable array as union on outer type', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'array', element: 'integer' }, nullable: true },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: ['array', 'null'], items: { type: 'integer' } });
  });
});

describe('shapeToJsonSchema', () => {
  const shape: ResolvedShape = {
    name: 'Row',
    origin: 'custom',
    fields: {
      id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
      name: { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
    },
  };

  it('produces an object schema with all fields required', () => {
    expect(shapeToJsonSchema(shape, { decimalEncoding: 'string' })).toEqual({
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: ['string', 'null'] },
      },
    });
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/openapi/shapes.ts`**

```ts
import type { FieldType, ResolvedShape, ScalarPrimitive, ShapeField } from '../types/resolvers.js';
import type { JsonSchema } from '../types/openapi.js';

export type ShapeEmitOptions = {
  decimalEncoding: 'string' | 'number';
};

export function primitiveToJsonSchema(
  primitive: ScalarPrimitive,
  options: ShapeEmitOptions,
): JsonSchema {
  switch (primitive) {
    case 'integer':
      return { type: 'integer' };
    case 'decimal':
      return options.decimalEncoding === 'number'
        ? { type: 'number' }
        : { type: 'string', format: 'decimal' };
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
  }
}

function withNullable(schema: JsonSchema, nullable: boolean): JsonSchema {
  if (!nullable) return schema;
  if (typeof schema.type === 'string') {
    return { ...schema, type: [schema.type, 'null'] };
  }
  // No direct "type" on schema — wrap.
  return { ...schema, type: [...(Array.isArray(schema.type) ? schema.type : []), 'null'] };
}

export function fieldToJsonSchema(field: ShapeField, options: ShapeEmitOptions): JsonSchema {
  return fieldTypeToJsonSchema(field.type, field.nullable, options);
}

function fieldTypeToJsonSchema(
  type: FieldType,
  nullable: boolean,
  options: ShapeEmitOptions,
): JsonSchema {
  switch (type.kind) {
    case 'scalar':
      return withNullable(primitiveToJsonSchema(type.primitive, options), nullable);
    case 'array': {
      const items = primitiveToJsonSchema(type.element, options);
      return withNullable({ type: 'array', items }, nullable);
    }
  }
}

export function shapeToJsonSchema(shape: ResolvedShape, options: ShapeEmitOptions): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(shape.fields)) {
    properties[name] = fieldToJsonSchema(field, options);
    required.push(name);
  }
  return { type: 'object', required, properties };
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `15 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/openapi/shapes.ts packages/bindings/test/unit/openapi/shapes.test.ts
git commit -m "feat(bindings): OpenAPI shape/field → JSON Schema mapping"
```

---

## Task 14: OpenAPI — parameters and request body

**Files:**
- Create: `packages/bindings/src/openapi/parameters.ts`
- Test: `packages/bindings/test/unit/openapi/parameters.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/openapi/parameters.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { inputToParameter, collectRequestBody } from '../../../src/openapi/parameters.js';
import type { GraphInput } from '../../../src/types/resolvers.js';
import type { HttpParameter } from '../../../src/types/artifact.js';

const options = { decimalEncoding: 'string' as const };

describe('inputToParameter', () => {
  it('maps scalar query param', () => {
    const input: GraphInput = { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 };
    const p: HttpParameter = { name: 'limit', in: 'query', bindTo: 'limit', required: false };
    expect(inputToParameter(p, input, options)).toEqual({
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'integer', default: 20 },
    });
  });

  it('maps scalar path param', () => {
    const input: GraphInput = { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' };
    const p: HttpParameter = { name: 'id', in: 'path', bindTo: 'id', required: true };
    expect(inputToParameter(p, input, options)).toEqual({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  });

  it('maps list<T> query with style form explode', () => {
    const input: GraphInput = { type: { kind: 'list', element: 'integer' }, mode: 'nullable' };
    const p: HttpParameter = { name: 'ids', in: 'query', bindTo: 'ids', required: false };
    expect(inputToParameter(p, input, options)).toEqual({
      name: 'ids',
      in: 'query',
      required: false,
      style: 'form',
      explode: true,
      schema: { type: 'array', items: { type: 'integer' } },
    });
  });

  it('attaches description when present', () => {
    const input: GraphInput = { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' };
    const p: HttpParameter = {
      name: 'n',
      in: 'query',
      bindTo: 'n',
      required: true,
      description: 'a count',
    };
    expect(inputToParameter(p, input, options).description).toBe('a count');
  });
});

describe('collectRequestBody', () => {
  it('returns undefined when no body params', () => {
    const result = collectRequestBody(
      [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
      { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted' } },
      options,
    );
    expect(result).toBeUndefined();
  });

  it('collects body parameters into JSON object', () => {
    const result = collectRequestBody(
      [
        { name: 'ids', in: 'body', bindTo: 'ids', required: true },
        { name: 'threshold', in: 'body', bindTo: 'threshold', required: false },
      ],
      {
        ids: { type: { kind: 'list', element: 'integer' }, mode: 'required' },
        threshold: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'defaulted', default: 0 },
      },
      options,
    );
    expect(result).toEqual({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['ids'],
            properties: {
              ids: { type: 'array', items: { type: 'integer' } },
              threshold: { type: 'string', format: 'decimal', default: 0 },
            },
          },
        },
      },
    });
  });

  it('marks body required=false when no body param is required', () => {
    const result = collectRequestBody(
      [{ name: 'note', in: 'body', bindTo: 'note', required: false }],
      { note: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' } },
      options,
    );
    expect(result?.required).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/openapi/parameters.ts`**

```ts
import type { HttpParameter } from '../types/artifact.js';
import type { GraphInput, InputType } from '../types/resolvers.js';
import type { JsonSchema, ParameterObject, RequestBodyObject } from '../types/openapi.js';
import { primitiveToJsonSchema, type ShapeEmitOptions } from './shapes.js';

function inputTypeToSchema(type: InputType, options: ShapeEmitOptions): JsonSchema {
  switch (type.kind) {
    case 'scalar':
      return primitiveToJsonSchema(type.primitive, options);
    case 'list':
      return { type: 'array', items: primitiveToJsonSchema(type.element, options) };
    case 'row':
    case 'rowset':
      // Unreachable after consistency validation, but keep a total function.
      return { type: 'object' };
  }
}

function schemaWithDefault(schema: JsonSchema, input: GraphInput): JsonSchema {
  if (input.mode === 'defaulted' && input.default !== undefined) {
    return { ...schema, default: input.default };
  }
  return schema;
}

export function inputToParameter(
  param: HttpParameter,
  input: GraphInput,
  options: ShapeEmitOptions,
): ParameterObject {
  const baseSchema = schemaWithDefault(inputTypeToSchema(input.type, options), input);

  const result: ParameterObject = {
    name: param.name,
    in: param.in === 'body' ? 'query' : param.in, // body never reaches here
    required: param.required,
    schema: baseSchema,
  };

  if (param.in === 'query' && input.type.kind === 'list') {
    result.style = 'form';
    result.explode = true;
  }

  if (param.description !== undefined) result.description = param.description;

  return result;
}

export function collectRequestBody(
  parameters: HttpParameter[],
  inputs: Record<string, GraphInput>,
  options: ShapeEmitOptions,
): RequestBodyObject | undefined {
  const bodyParams = parameters.filter((p) => p.in === 'body');
  if (bodyParams.length === 0) return undefined;

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const p of bodyParams) {
    const input = inputs[p.bindTo];
    if (input === undefined) continue; // already flagged by reference layer
    properties[p.name] = schemaWithDefault(inputTypeToSchema(input.type, options), input);
    if (p.required) required.push(p.name);
  }

  const schema: JsonSchema = { type: 'object', required, properties };
  return {
    required: bodyParams.some((p) => p.required),
    content: { 'application/json': { schema } },
  };
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/openapi/parameters.ts packages/bindings/test/unit/openapi/parameters.test.ts
git commit -m "feat(bindings): OpenAPI parameter and requestBody emission"
```

---

## Task 15: OpenAPI — responses

**Files:**
- Create: `packages/bindings/src/openapi/responses.ts`
- Test: `packages/bindings/test/unit/openapi/responses.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/openapi/responses.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { successResponse } from '../../../src/openapi/responses.js';

describe('successResponse', () => {
  it('produces 200 with array of $ref for rowset output', () => {
    const resp = successResponse('CategorySalesRow');
    expect(resp).toEqual({
      description: 'OK',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/CategorySalesRow' },
          },
        },
      },
    });
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/openapi/responses.ts`**

```ts
import type { ResponseObject } from '../types/openapi.js';

export function successResponse(shapeName: string): ResponseObject {
  return {
    description: 'OK',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: { $ref: `#/components/schemas/${shapeName}` },
        },
      },
    },
  };
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/openapi/responses.ts packages/bindings/test/unit/openapi/responses.test.ts
git commit -m "feat(bindings): OpenAPI success-response emission"
```

---

## Task 16: OpenAPI — standard error responses

**Files:**
- Create: `packages/bindings/src/openapi/errors.ts`
- Test: `packages/bindings/test/unit/openapi/errors.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/openapi/errors.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ERROR_RESPONSE_SCHEMA_NAME, errorResponseSchema, standardErrorResponses } from '../../../src/openapi/errors.js';

describe('standard error responses', () => {
  it('exposes the schema name constant', () => {
    expect(ERROR_RESPONSE_SCHEMA_NAME).toBe('ErrorResponse');
  });

  it('builds ErrorResponse schema', () => {
    expect(errorResponseSchema()).toEqual({
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    });
  });

  it('builds 400/422/500 referencing ErrorResponse', () => {
    const out = standardErrorResponses();
    expect(Object.keys(out)).toEqual(['400', '422', '500']);
    expect(out['400']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    });
    expect(out['422']?.description).toBe('Semantic error');
    expect(out['500']?.description).toBe('Internal error');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/openapi/errors.ts`**

```ts
import type { JsonSchema, ResponseObject } from '../types/openapi.js';

export const ERROR_RESPONSE_SCHEMA_NAME = 'ErrorResponse';

export function errorResponseSchema(): JsonSchema {
  return {
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      details: {},
    },
  };
}

function errorResponse(description: string): ResponseObject {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${ERROR_RESPONSE_SCHEMA_NAME}` },
      },
    },
  };
}

export function standardErrorResponses(): Record<'400' | '422' | '500', ResponseObject> {
  return {
    '400': errorResponse('Validation error'),
    '422': errorResponse('Semantic error'),
    '500': errorResponse('Internal error'),
  };
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/openapi/errors.ts packages/bindings/test/unit/openapi/errors.test.ts
git commit -m "feat(bindings): OpenAPI standard ErrorResponse and 400/422/500"
```

---

## Task 17: OpenAPI — passthrough deep-merge

**Files:**
- Create: `packages/bindings/src/openapi/passthrough.ts`
- Test: `packages/bindings/test/unit/openapi/passthrough.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/openapi/passthrough.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { deepMerge } from '../../../src/openapi/passthrough.js';

describe('deepMerge', () => {
  it('merges plain objects recursively', () => {
    const result = deepMerge(
      { a: 1, b: { c: 2, d: 3 } },
      { b: { d: 30, e: 40 }, f: 5 },
    );
    expect(result).toEqual({ a: 1, b: { c: 2, d: 30, e: 40 }, f: 5 });
  });

  it('replaces arrays entirely', () => {
    const result = deepMerge({ tags: ['a', 'b'] }, { tags: ['c'] });
    expect(result).toEqual({ tags: ['c'] });
  });

  it('overwrites scalars', () => {
    const result = deepMerge({ x: 1, y: 'old' }, { y: 'new', z: true });
    expect(result).toEqual({ x: 1, y: 'new', z: true });
  });

  it('null in override unsets / replaces value', () => {
    expect(deepMerge({ x: { a: 1 } }, { x: null })).toEqual({ x: null });
  });

  it('does not mutate inputs', () => {
    const left = { a: { b: 1 } };
    const right = { a: { c: 2 } };
    const out = deepMerge(left, right);
    expect(left).toEqual({ a: { b: 1 } });
    expect(right).toEqual({ a: { c: 2 } });
    expect(out).toEqual({ a: { b: 1, c: 2 } });
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/openapi/passthrough.ts`**

```ts
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...left };
  for (const [key, rightValue] of Object.entries(right)) {
    const leftValue = result[key];
    if (isPlainObject(leftValue) && isPlainObject(rightValue)) {
      result[key] = deepMerge(leftValue, rightValue);
    } else {
      result[key] = rightValue;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/openapi/passthrough.ts packages/bindings/test/unit/openapi/passthrough.test.ts
git commit -m "feat(bindings): OpenAPI passthrough deep-merge"
```

---

## Task 18: OpenAPI — emit orchestrator (`generateOpenApi`)

**Files:**
- Create: `packages/bindings/src/openapi/emit.ts`
- Test: `packages/bindings/test/unit/openapi/emit.test.ts`

- [ ] **Step 1: Write failing test `packages/bindings/test/unit/openapi/emit.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateOpenApi } from '../../../src/openapi/emit.js';
import type { ValidatedBindings } from '../../../src/types/artifact.js';
import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const row: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: {
    id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    name: { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
  },
};

const signature: GraphSignature = {
  id: 'g',
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
};

const validated: ValidatedBindings = {
  artifact: {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'y',
    qsmRef: 'z',
    openapi: { info: { title: 'API', version: '1.0.0' } },
    bindings: {
      primary: {
        graph: 'g',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET',
          path: '/v1/things',
          parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
          tags: ['things'],
          summary: 'List things',
        },
      },
    },
  } as unknown as ValidatedBindings['artifact'],
  resolved: {
    primary: {
      entry: {
        graph: 'g',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET',
          path: '/v1/things',
          parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
          tags: ['things'],
          summary: 'List things',
        },
      },
      signature,
      outputShape: row,
    },
  },
} as unknown as ValidatedBindings;

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'g' ? signature : null),
  resolveShape: (name) => (name === 'Row' ? row : null),
};

describe('generateOpenApi', () => {
  it('emits a minimal valid document', () => {
    const r = generateOpenApi(validated, resolvers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doc = r.value;
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('API');
    expect(doc.components.schemas.Row).toBeDefined();
    expect(doc.components.schemas.ErrorResponse).toBeDefined();

    const op = doc.paths['/v1/things']?.get;
    expect(op?.operationId).toBe('primary');
    expect(op?.summary).toBe('List things');
    expect(op?.tags).toEqual(['things']);
    expect(op?.parameters?.[0]?.name).toBe('limit');
    expect(op?.responses['200']?.content?.['application/json']?.schema).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/Row' },
    });
    expect(Object.keys(op?.responses ?? {})).toEqual(['200', '400', '422', '500']);
  });

  it('uses http.operationId override when set', () => {
    const v = structuredClone(validated);
    v.resolved.primary!.entry.http.operationId = 'listThings';
    v.artifact.bindings.primary!.http.operationId = 'listThings';
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.paths['/v1/things']?.get?.operationId).toBe('listThings');
  });

  it('falls back to options.info/servers when artifact lacks them', () => {
    const v = structuredClone(validated);
    delete (v.artifact as { openapi?: unknown }).openapi;
    const r = generateOpenApi(v, resolvers, {
      info: { title: 'FromOptions', version: '0.0.1' },
      servers: [{ url: 'https://api.example.com' }],
    });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.info.title).toBe('FromOptions');
    expect(r.value.servers).toEqual([{ url: 'https://api.example.com' }]);
  });

  it('uses ultimate fallback info when neither artifact nor options provide it', () => {
    const v = structuredClone(validated);
    delete (v.artifact as { openapi?: unknown }).openapi;
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.info).toEqual({ title: 'API', version: '0.0.0' });
  });

  it('omits standard errors when option set to false', () => {
    const r = generateOpenApi(validated, resolvers, { standardErrors: false });
    if (!r.ok) throw new Error('expected ok');
    expect(Object.keys(r.value.paths['/v1/things']?.get?.responses ?? {})).toEqual(['200']);
    expect(r.value.components.schemas.ErrorResponse).toBeUndefined();
  });

  it('decimalEncoding=number switches decimal schema', () => {
    const shape: ResolvedShape = {
      name: 'Row',
      origin: 'custom',
      fields: { price: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false } },
    };
    const r = generateOpenApi(validated, {
      ...resolvers,
      resolveShape: () => shape,
    }, { decimalEncoding: 'number' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.components.schemas.Row).toEqual({
      type: 'object',
      required: ['price'],
      properties: { price: { type: 'number' } },
    });
  });

  it('merges http.openapi passthrough into operation', () => {
    const v = structuredClone(validated);
    v.resolved.primary!.entry.http.openapi = { 'x-rate-limit': { max: 60 } };
    v.artifact.bindings.primary!.http.openapi = { 'x-rate-limit': { max: 60 } };
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.paths['/v1/things']?.get?.['x-rate-limit']).toEqual({ max: 60 });
  });

  it('merges parameter openapi passthrough', () => {
    const v = structuredClone(validated);
    v.resolved.primary!.entry.http.parameters[0]!.openapi = { example: 5 };
    v.artifact.bindings.primary!.http.parameters[0]!.openapi = { example: 5 };
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.paths['/v1/things']?.get?.parameters?.[0]?.example).toBe(5);
  });

  it('deduplicates shapes shared across bindings', () => {
    const v = structuredClone(validated);
    const entry2 = structuredClone(v.resolved.primary!.entry);
    entry2.http.path = '/v1/other';
    v.resolved.secondary = {
      entry: entry2,
      signature,
      outputShape: row,
    };
    v.artifact.bindings.secondary = entry2;
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(Object.keys(r.value.components.schemas).sort()).toEqual(['ErrorResponse', 'Row']);
  });
});
```

Note: `structuredClone` is available in Node 17+; we run on Node ≥ 20 per root `engines`. It does not preserve class identity but faithfully deep-copies plain data, which is what we need for test fixtures.

- [ ] **Step 2: Run test — expect failure**

Expected: `Cannot find module`.

- [ ] **Step 3: Implement `packages/bindings/src/openapi/emit.ts`**

```ts
import type { ResolvedBinding, ValidatedBindings } from '../types/artifact.js';
import type { BindingResolvers } from '../types/resolvers.js';
import type {
  InfoObject,
  OpenApiDoc,
  OperationObject,
  ParameterObject,
  PathItem,
  ResponseObject,
  ServerObject,
  JsonSchema,
} from '../types/openapi.js';
import type { Result } from '../types/result.js';
import { ok } from '../types/result.js';
import { shapeToJsonSchema, type ShapeEmitOptions } from './shapes.js';
import { collectRequestBody, inputToParameter } from './parameters.js';
import { successResponse } from './responses.js';
import {
  ERROR_RESPONSE_SCHEMA_NAME,
  errorResponseSchema,
  standardErrorResponses,
} from './errors.js';
import { deepMerge } from './passthrough.js';

export type OpenApiGenOptions = {
  decimalEncoding?: 'string' | 'number';
  standardErrors?: false;
  info?: { title?: string; version?: string; description?: string };
  servers?: ServerObject[];
};

const DEFAULT_INFO: InfoObject = { title: 'API', version: '0.0.0' };

function resolveInfo(artifact: ValidatedBindings['artifact'], options: OpenApiGenOptions): InfoObject {
  const artifactInfo = artifact.openapi?.info;
  const optInfo = options.info;
  const title = artifactInfo?.title ?? optInfo?.title ?? DEFAULT_INFO.title;
  const version = artifactInfo?.version ?? optInfo?.version ?? DEFAULT_INFO.version;
  const description = artifactInfo?.description ?? optInfo?.description;
  const result: InfoObject = { title, version };
  if (description !== undefined) result.description = description;
  return result;
}

function resolveServers(
  artifact: ValidatedBindings['artifact'],
  options: OpenApiGenOptions,
): ServerObject[] | undefined {
  return artifact.openapi?.servers ?? options.servers;
}

function buildOperation(
  id: string,
  binding: ResolvedBinding,
  shapeOptions: ShapeEmitOptions,
  includeStandardErrors: boolean,
): OperationObject {
  const { entry, signature, outputShape } = binding;
  const { http } = entry;

  const baseParameters: ParameterObject[] = http.parameters
    .filter((p) => p.in !== 'body')
    .map((p) => {
      const input = signature.inputs[p.bindTo];
      if (input === undefined) {
        throw new Error(
          `Internal invariant: parameter "${p.name}" in binding "${id}" resolved past validation with unknown bindTo`,
        );
      }
      const base = inputToParameter(p, input, shapeOptions);
      if (p.openapi !== undefined) {
        return deepMerge(base as unknown as Record<string, unknown>, p.openapi) as unknown as ParameterObject;
      }
      return base;
    });

  const requestBody = collectRequestBody(http.parameters, signature.inputs, shapeOptions);

  const responses: Record<string, ResponseObject> = {
    '200': successResponse(outputShape.name),
  };
  if (includeStandardErrors) {
    Object.assign(responses, standardErrorResponses());
  }

  const operation: OperationObject = {
    operationId: http.operationId ?? id,
    responses,
  };
  if (http.summary !== undefined) operation.summary = http.summary;
  if (http.description !== undefined) operation.description = http.description;
  if (http.tags !== undefined) operation.tags = http.tags;
  if (baseParameters.length > 0) operation.parameters = baseParameters;
  if (requestBody !== undefined) operation.requestBody = requestBody;

  if (http.openapi !== undefined) {
    return deepMerge(operation as unknown as Record<string, unknown>, http.openapi) as unknown as OperationObject;
  }
  return operation;
}

export function generateOpenApi(
  validated: ValidatedBindings,
  _resolvers: BindingResolvers,
  options: OpenApiGenOptions = {},
): Result<OpenApiDoc> {
  const shapeOptions: ShapeEmitOptions = {
    decimalEncoding: options.decimalEncoding ?? 'string',
  };
  const includeStandardErrors = options.standardErrors !== false;

  const paths: Record<string, PathItem> = {};
  const schemas: Record<string, JsonSchema> = {};

  for (const [id, binding] of Object.entries(validated.resolved)) {
    const methodKey = binding.entry.http.method === 'GET' ? 'get' : 'post';
    const op = buildOperation(id, binding, shapeOptions, includeStandardErrors);
    const pathItem: PathItem = paths[binding.entry.http.path] ?? {};
    pathItem[methodKey] = op;
    paths[binding.entry.http.path] = pathItem;

    schemas[binding.outputShape.name] = shapeToJsonSchema(binding.outputShape, shapeOptions);
  }

  if (includeStandardErrors) {
    schemas[ERROR_RESPONSE_SCHEMA_NAME] = errorResponseSchema();
  }

  const doc: OpenApiDoc = {
    openapi: '3.1.0',
    info: resolveInfo(validated.artifact, options),
    paths,
    components: { schemas },
  };
  const servers = resolveServers(validated.artifact, options);
  if (servers !== undefined) doc.servers = servers;

  return ok(doc);
}
```

- [ ] **Step 4: Run test — expect pass**

Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings/src/openapi/emit.ts packages/bindings/test/unit/openapi/emit.test.ts
git commit -m "feat(bindings): generateOpenApi orchestrator"
```

---

## Task 19: Public index + typecheck + lint sweep

**Files:**
- Modify: `packages/bindings/src/index.ts`

- [ ] **Step 1: Expand `packages/bindings/src/index.ts`**

```ts
export const VERSION = '0.0.0';

export { parseBindingArtifact } from './parse/parse.js';
export { BindingArtifactSchema } from './parse/schema.js';
export type { BindingArtifactParsed } from './parse/schema.js';

export { validateBindings, validateStructural, validateReferences, validateConsistency } from './validate/index.js';

export { generateOpenApi } from './openapi/emit.js';
export type { OpenApiGenOptions } from './openapi/emit.js';

export {
  ok,
  err,
  isOk,
  isErr,
  ERROR_CODES,
} from './types/result.js';

export type {
  Result,
  BindingsError,
  BindingsErrorCode,
  Layer,
} from './types/result.js';

export type {
  BindingArtifact,
  BindingEntry,
  HttpBinding,
  HttpParameter,
  HttpMethod,
  HttpParameterLocation,
  OpenApiDefaults,
  StructurallyValid,
  ResolvedBinding,
  ResolvedBindings,
  ValidatedBindings,
  OperationPassthrough,
  ParameterPassthrough,
} from './types/artifact.js';

export type {
  BindingResolvers,
  GraphSignature,
  GraphInput,
  InputMode,
  InputType,
  OutputType,
  ResolvedShape,
  ShapeField,
  FieldType,
  ScalarPrimitive,
  ShapeOrigin,
} from './types/resolvers.js';

export type {
  OpenApiDoc,
  InfoObject,
  ServerObject,
  PathItem,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  MediaType,
  JsonSchema,
} from './types/openapi.js';
```

- [ ] **Step 2: Typecheck, lint, full test run**

```bash
pnpm --filter @rntme/bindings run typecheck
pnpm --filter @rntme/bindings run lint
pnpm --filter @rntme/bindings run test
pnpm --filter @rntme/bindings run build
```

Expected: all exit 0. Vitest reports ≥ 72 passing tests (smoke + all unit tests).

- [ ] **Step 3: Commit**

```bash
git add packages/bindings/src/index.ts
git commit -m "feat(bindings): expose public API barrel"
```

---

## Task 20: Golden end-to-end test — Category Sales

**Files:**
- Create: `packages/bindings/test/golden/category-sales/artifact.json`
- Create: `packages/bindings/test/golden/category-sales/fixtures.ts`
- Create: `packages/bindings/test/golden/category-sales/category-sales.test.ts`
- Create (via snapshot write): `packages/bindings/test/golden/category-sales/expected.openapi.json`

This is the full rc7 §22 example end-to-end: `parse → validate → generateOpenApi` → golden-file comparison.

- [ ] **Step 1: Create `packages/bindings/test/golden/category-sales/artifact.json`**

```json
{
  "version": "1.0",
  "graphSpecRef": "commerce.graphs.v1",
  "pdmRef": "commerce.domain.v1",
  "qsmRef": "commerce.read.v1",
  "openapi": {
    "info": { "title": "Commerce Analytics API", "version": "1.0.0" },
    "servers": [{ "url": "https://api.example.com" }]
  },
  "bindings": {
    "getCategorySalesHttp": {
      "graph": "getCategorySales",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/v1/analytics/category-sales",
        "tags": ["analytics"],
        "summary": "Category sales aggregation",
        "parameters": [
          { "name": "dateFrom",   "in": "query", "bindTo": "dateFrom",   "required": true  },
          { "name": "dateTo",     "in": "query", "bindTo": "dateTo",     "required": true  },
          { "name": "minRevenue", "in": "query", "bindTo": "minRevenue", "required": false },
          { "name": "limit",      "in": "query", "bindTo": "limit",      "required": false }
        ]
      }
    }
  }
}
```

- [ ] **Step 2: Create `packages/bindings/test/golden/category-sales/fixtures.ts`**

```ts
import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const categorySalesSig: GraphSignature = {
  id: 'getCategorySales',
  inputs: {
    dateFrom: { type: { kind: 'scalar', primitive: 'date' }, mode: 'required' },
    dateTo: { type: { kind: 'scalar', primitive: 'date' }, mode: 'required' },
    minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'CategorySalesRow' }, from: 'paged' },
};

const categorySalesRow: ResolvedShape = {
  name: 'CategorySalesRow',
  origin: 'custom',
  fields: {
    categoryId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    revenue: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
    totalQuantity: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    lineCount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    avgItemPrice: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
    categoryName: { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
  },
};

export const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'getCategorySales' ? categorySalesSig : null),
  resolveShape: (name) => (name === 'CategorySalesRow' ? categorySalesRow : null),
};
```

- [ ] **Step 3: Create `packages/bindings/test/golden/category-sales/category-sales.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBindingArtifact } from '../../../src/parse/parse.js';
import { validateBindings } from '../../../src/validate/index.js';
import { generateOpenApi } from '../../../src/openapi/emit.js';
import { resolvers } from './fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const artifactJson = readFileSync(join(here, 'artifact.json'), 'utf8');

describe('golden: category-sales', () => {
  it('parses, validates, and emits a stable OpenAPI document', async () => {
    const parsed = parseBindingArtifact(artifactJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validated = validateBindings(parsed.value, resolvers);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const emitted = generateOpenApi(validated.value, resolvers);
    expect(emitted.ok).toBe(true);
    if (!emitted.ok) return;

    const serialized = JSON.stringify(emitted.value, null, 2) + '\n';
    await expect(serialized).toMatchFileSnapshot(join(here, 'expected.openapi.json'));
  });
});
```

- [ ] **Step 4: Generate the snapshot by running Vitest in update mode**

```bash
pnpm --filter @rntme/bindings exec vitest run test/golden/category-sales/category-sales.test.ts -u
```

Expected: test passes, `expected.openapi.json` is written.

- [ ] **Step 5: Manually inspect `expected.openapi.json`**

Open the file and confirm:
- `openapi: "3.1.0"`
- `info.title === "Commerce Analytics API"`
- `paths["/v1/analytics/category-sales"].get.operationId === "getCategorySalesHttp"`
- `parameters` contains `dateFrom`, `dateTo`, `minRevenue`, `limit` (required flags per artifact)
- `responses.200.content["application/json"].schema === { type: "array", items: { $ref: "#/components/schemas/CategorySalesRow" } }`
- `responses` include `400`, `422`, `500`
- `components.schemas.CategorySalesRow` has all six fields with `required` listing all names
- `components.schemas.CategorySalesRow.properties.revenue === { type: "string", format: "decimal" }`
- `components.schemas.CategorySalesRow.properties.categoryName === { type: ["string", "null"] }`
- `components.schemas.ErrorResponse` exists

If any item is wrong, fix the relevant emit module, not the golden. Only regenerate the golden after the test passes without `-u`.

- [ ] **Step 6: Run the test without update flag**

```bash
pnpm --filter @rntme/bindings exec vitest run test/golden/category-sales/category-sales.test.ts
```

Expected: test passes.

- [ ] **Step 7: Full test + typecheck + lint**

```bash
pnpm --filter @rntme/bindings run typecheck
pnpm --filter @rntme/bindings run lint
pnpm --filter @rntme/bindings run test
pnpm --filter @rntme/bindings run build
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/bindings/test/golden
git commit -m "test(bindings): add category-sales golden end-to-end"
```

---

## Task 21: Root-level build/test integration

**Files:**
- (no changes) — `pnpm-workspace.yaml` already uses `packages/*` glob.

- [ ] **Step 1: Verify root-level scripts pick up the new package**

```bash
cd /home/coder/project
pnpm run build
pnpm run test
pnpm run lint
```

Expected:
- `pnpm run build` runs `build` in both `@rntme/graph-ir-compiler` and `@rntme/bindings`. Both succeed.
- `pnpm run test` runs `test` in both. All tests pass.
- `pnpm run lint` runs `lint` in both. No issues.

If `pnpm run test` fails because the compiler package doesn't cleanly run in workspace mode (unrelated to this work), stop and report — do not modify the compiler.

- [ ] **Step 2: No commit needed for a green run (no file changes).**

If a dependency lockfile was updated by `pnpm install` earlier, commit it separately:

```bash
git status
# If pnpm-lock.yaml changed:
git add pnpm-lock.yaml
git commit -m "chore(bindings): update lockfile for new workspace package"
```

---

## Self-Review

After writing, I checked the plan against the spec:

**Spec coverage check:**
- §2 scope (types + validator + OpenAPI, no runtime): covered by Tasks 1–20.
- §3 public API (`parseBindingArtifact`, `validateBindings`, `generateOpenApi`, `Result` helpers): Tasks 8, 12, 18, 19.
- §4 artifact format and structural rules: Task 7 (Zod) + Task 9 (structural checks).
- §4.4 `mode` ↔ `required` table and graph-role restriction: Task 11.
- §5 resolver interface and type contract: Task 3.
- §6 validation layers, branded types, error codes, aggregation semantics: Tasks 2, 4, 9–12.
- §7 OpenAPI mapping (primitives, nullable, shapes, parameters, body, responses, errors, passthrough, dedup, options): Tasks 13–18.
- §8 package layout and dependencies: Task 1.
- §9 testing (unit + integration + edge cases): unit tests in each task; edge cases distributed (nullable+required variants in Task 11, defaulted default-propagation in Task 14, `decimalEncoding` option in Task 18, passthrough override in Task 18, shape dedup in Task 18, graph-has-root/unsupported-output/unbound-input negatives in Task 11); end-to-end golden in Task 20.

**Placeholder scan:** no `TBD`/`TODO`/`FIXME` in task bodies. Every code step shows complete code. Every test step shows explicit assertions. No "similar to Task N" handwaves.

**Type consistency check:** reviewed `ResolvedBinding`, `ResolvedBindings`, `ValidatedBindings`, `ShapeEmitOptions`, `OpenApiGenOptions`, and error-code names across tasks — all match. `BINDINGS_UNBOUND_INPUT` (not `_REQUIRED_INPUT`) is used everywhere it appears. `decimalEncoding` option threads from `OpenApiGenOptions` → `ShapeEmitOptions` consistently.

**Scope boundary:** no task introduces runtime HTTP code, no task imports `@rntme/graph-ir-compiler` — consistent with §8.2.
