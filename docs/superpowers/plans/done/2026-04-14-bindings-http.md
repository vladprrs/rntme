# `@rntme/bindings-http` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@rntme/bindings-http` — a Hono-based HTTP runtime that executes graph queries described by `ValidatedBindings` (from `@rntme/bindings`) and returns JSON responses that match the generated OpenAPI 3.1 contract.

**Architecture:** Single public entry-point `createBindingsRouter(opts) → Hono`. On startup: compile every unique graph referenced by bindings, fail-fast with `BindingsRuntimeError` on any compile errors, build per-binding Zod schemas from the `GraphSignature`, wire Hono routes that extract → coerce → remap → execute → JSON-respond.

**Tech Stack:** TypeScript (ES2022, strict), Hono ^4, Zod ^3.23, `@rntme/bindings` (workspace), `@rntme/graph-ir-compiler` (workspace), `better-sqlite3` ^11 (peer), Vitest ^2.

**Spec:** `docs/superpowers/specs/2026-04-14-bindings-http-design.md`

**Sibling packages for reference:**
- `packages/bindings/` — conventions for tsconfig/eslint/vitest/prettier; Zod usage; Result type pattern.
- `packages/graph-ir-compiler/` — `compile`, `execute`, fixtures at `test/e2e/fixtures/`, `test/golden/category-sales/`.

---

## Task 1: Scaffold package

**Files:**
- Create: `packages/bindings-http/package.json`
- Create: `packages/bindings-http/tsconfig.json`
- Create: `packages/bindings-http/tsconfig.check.json`
- Create: `packages/bindings-http/vitest.config.ts`
- Create: `packages/bindings-http/eslint.config.mjs`
- Create: `packages/bindings-http/README.md`
- Create: `packages/bindings-http/.gitignore`
- Create: `packages/bindings-http/src/index.ts` (placeholder)
- Create: `packages/bindings-http/test/smoke.test.ts`

- [ ] **Step 1.1: Create package.json**

Exact versions copied from `packages/bindings/package.json` for devDeps. `hono` pinned to `^4.6.0` (current stable major). `zod` pinned to same version as `@rntme/bindings` (`^3.23.8`).

```json
{
  "name": "@rntme/bindings-http",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Hono-based HTTP runtime for @rntme/bindings.",
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
    "@rntme/bindings": "workspace:*",
    "@rntme/graph-ir-compiler": "workspace:*",
    "hono": "^4.6.0",
    "zod": "^3.23.8"
  },
  "peerDependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "better-sqlite3": "^11.0.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 1.2: Create tsconfig.json** (mirror `packages/bindings/tsconfig.json`)

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

- [ ] **Step 1.3: Create tsconfig.check.json**

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

- [ ] **Step 1.4: Create vitest.config.ts**

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

- [ ] **Step 1.5: Create eslint.config.mjs** (copy from `packages/bindings/eslint.config.mjs` verbatim — same content)

```js
// eslint.config.mjs
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

- [ ] **Step 1.6: Create .gitignore**

```
dist
node_modules
*.log
```

- [ ] **Step 1.7: Create README.md**

```markdown
# @rntme/bindings-http

Hono-based HTTP runtime for `@rntme/bindings`. Consumes `ValidatedBindings` and a compiled graph spec, returns a Hono sub-router.

See `docs/superpowers/specs/2026-04-14-bindings-http-design.md` in the monorepo for the design document.

## Status

Draft MVP. Provides:

- `createBindingsRouter(opts)` — factory returning `Hono` sub-router.
- Zod-based coercion of query/path/body parameters.
- Error responses `{ code, message, details? }` matching the generated OpenAPI.

Out of scope: auth, pagination envelope, streaming, multi-tenant routing, non-SQLite executors.
```

- [ ] **Step 1.8: Create placeholder src/index.ts**

```ts
export const VERSION = '0.0.0';
```

- [ ] **Step 1.9: Create smoke test**

`packages/bindings-http/test/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('smoke', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
```

- [ ] **Step 1.10: Install + verify toolchain**

```bash
cd /home/coder/project && pnpm install
```

Expected: installs without errors, resolves workspace deps.

```bash
cd /home/coder/project/packages/bindings-http && pnpm typecheck && pnpm test && pnpm lint
```

Expected: typecheck passes, smoke test passes, lint passes.

- [ ] **Step 1.11: Commit**

```bash
cd /home/coder/project
git add packages/bindings-http pnpm-lock.yaml
git commit -m "chore(bindings-http): scaffold package"
```

---

## Task 2: Error types and response builders

**Files:**
- Create: `packages/bindings-http/src/errors.ts`
- Create: `packages/bindings-http/test/unit/errors.test.ts`

- [ ] **Step 2.1: Write failing tests**

```ts
// test/unit/errors.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  BindingsRuntimeError,
  validationErrorBody,
  invalidBodyErrorBody,
  internalErrorBody,
} from '../../src/errors.js';

describe('BindingsRuntimeError', () => {
  it('carries aggregated errors', () => {
    const err = new BindingsRuntimeError([
      { bindingId: 'a', graphId: 'g1', cause: new Error('x') },
      { bindingId: 'b', graphId: 'g2', cause: { code: 'CompileFail' } },
    ]);
    expect(err.name).toBe('BindingsRuntimeError');
    expect(err.errors).toHaveLength(2);
    expect(err.errors[0]!.graphId).toBe('g1');
    expect(err.message).toMatch(/2 binding/);
  });
});

describe('validationErrorBody', () => {
  it('converts ZodError into { code, message, details }', () => {
    const schema = z.object({ a: z.coerce.number().int() });
    const r = schema.safeParse({ a: 'nope' });
    if (r.success) throw new Error('expected fail');
    const body = validationErrorBody(r.error);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Invalid request parameters');
    expect(body.details).toBeInstanceOf(Array);
    expect(body.details[0]).toMatchObject({ path: 'a' });
    expect(typeof body.details[0]!.code).toBe('string');
    expect(typeof body.details[0]!.message).toBe('string');
  });
});

describe('invalidBodyErrorBody', () => {
  it('returns fixed shape without details', () => {
    const body = invalidBodyErrorBody('malformed JSON');
    expect(body).toEqual({ code: 'INVALID_BODY', message: 'malformed JSON' });
  });
});

describe('internalErrorBody', () => {
  it('never leaks message or stack', () => {
    const body = internalErrorBody();
    expect(body).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });
});
```

- [ ] **Step 2.2: Run tests to verify fail**

```bash
cd /home/coder/project/packages/bindings-http && pnpm test
```

Expected: FAIL (module not found).

- [ ] **Step 2.3: Implement errors.ts**

```ts
// src/errors.ts
import type { ZodError } from 'zod';

export type RuntimeErrorEntry = {
  bindingId?: string;
  graphId: string;
  cause: unknown;
};

export class BindingsRuntimeError extends Error {
  readonly errors: readonly RuntimeErrorEntry[];

  constructor(errors: readonly RuntimeErrorEntry[]) {
    super(`Failed to initialize bindings runtime: ${errors.length} binding(s) could not be compiled`);
    this.name = 'BindingsRuntimeError';
    this.errors = errors;
  }
}

export type ErrorResponseBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type ValidationDetail = {
  path: string;
  message: string;
  code: string;
};

export function validationErrorBody(err: ZodError): ErrorResponseBody & { details: ValidationDetail[] } {
  return {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request parameters',
    details: err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    })),
  };
}

export function invalidBodyErrorBody(message: string): ErrorResponseBody {
  return { code: 'INVALID_BODY', message };
}

export function internalErrorBody(): ErrorResponseBody {
  return { code: 'INTERNAL_ERROR', message: 'Internal server error' };
}
```

- [ ] **Step 2.4: Verify tests pass**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add packages/bindings-http/src/errors.ts packages/bindings-http/test/unit/errors.test.ts
git commit -m "feat(bindings-http): BindingsRuntimeError and error response builders"
```

---

## Task 3: `honoPath` utility

Converts OpenAPI `/v1/orders/{orderId}/items` → Hono `/v1/orders/:orderId/items`.

**Files:**
- Create: `packages/bindings-http/src/startup/hono-path.ts`
- Create: `packages/bindings-http/test/unit/hono-path.test.ts`

- [ ] **Step 3.1: Write failing tests**

```ts
// test/unit/hono-path.test.ts
import { describe, it, expect } from 'vitest';
import { honoPath } from '../../src/startup/hono-path.js';

describe('honoPath', () => {
  it('returns path without placeholders unchanged', () => {
    expect(honoPath('/v1/items')).toBe('/v1/items');
  });

  it('converts single placeholder', () => {
    expect(honoPath('/v1/orders/{orderId}')).toBe('/v1/orders/:orderId');
  });

  it('converts two placeholders', () => {
    expect(honoPath('/v1/orders/{orderId}/items/{itemId}')).toBe('/v1/orders/:orderId/items/:itemId');
  });

  it('preserves segments between placeholders', () => {
    expect(honoPath('/a/{x}/b/{y}/c')).toBe('/a/:x/b/:y/c');
  });
});
```

- [ ] **Step 3.2: Run tests to verify fail**

```bash
pnpm test
```

Expected: FAIL (module not found).

- [ ] **Step 3.3: Implement honoPath**

```ts
// src/startup/hono-path.ts
const PLACEHOLDER_RE = /\{([^/}]+)\}/g;

export function honoPath(openApiPath: string): string {
  return openApiPath.replace(PLACEHOLDER_RE, ':$1');
}
```

- [ ] **Step 3.4: Verify tests pass**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add packages/bindings-http/src/startup/hono-path.ts packages/bindings-http/test/unit/hono-path.test.ts
git commit -m "feat(bindings-http): honoPath placeholder converter"
```

---

## Task 4: `primitiveSchema` — scalar primitives

Build the per-primitive fragment of the Zod schema. We start with scalars; `list<T>` comes next in Task 5.

**Files:**
- Create: `packages/bindings-http/src/startup/primitive-schema.ts`
- Create: `packages/bindings-http/test/unit/primitive-schema.test.ts`

- [ ] **Step 4.1: Write failing tests for scalar primitives**

```ts
// test/unit/primitive-schema.test.ts
import { describe, it, expect } from 'vitest';
import { primitiveSchema } from '../../src/startup/primitive-schema.js';
import type { InputType } from '@rntme/bindings';

const scalar = (primitive: 'integer' | 'string' | 'boolean' | 'date' | 'datetime' | 'decimal'): InputType => ({
  kind: 'scalar',
  primitive,
});

describe('primitiveSchema — integer', () => {
  const s = primitiveSchema(scalar('integer'));
  it('coerces numeric string', () => {
    expect(s.safeParse('42')).toMatchObject({ success: true, data: 42 });
  });
  it('passes through number', () => {
    expect(s.safeParse(42)).toMatchObject({ success: true, data: 42 });
  });
  it('rejects non-integer numeric string', () => {
    expect(s.safeParse('1.5').success).toBe(false);
  });
  it('rejects non-numeric string', () => {
    expect(s.safeParse('abc').success).toBe(false);
  });
});

describe('primitiveSchema — string', () => {
  const s = primitiveSchema(scalar('string'));
  it('accepts string', () => {
    expect(s.safeParse('hello').success).toBe(true);
  });
  it('rejects number', () => {
    expect(s.safeParse(42).success).toBe(false);
  });
});

describe('primitiveSchema — boolean', () => {
  const s = primitiveSchema(scalar('boolean'));
  it("coerces 'true' and '1' to true", () => {
    expect(s.safeParse('true')).toMatchObject({ success: true, data: true });
    expect(s.safeParse('1')).toMatchObject({ success: true, data: true });
  });
  it("coerces 'false' and '0' to false", () => {
    expect(s.safeParse('false')).toMatchObject({ success: true, data: false });
    expect(s.safeParse('0')).toMatchObject({ success: true, data: false });
  });
  it('passes through native booleans', () => {
    expect(s.safeParse(true)).toMatchObject({ success: true, data: true });
    expect(s.safeParse(false)).toMatchObject({ success: true, data: false });
  });
  it('rejects other strings', () => {
    expect(s.safeParse('yes').success).toBe(false);
  });
});

describe('primitiveSchema — date', () => {
  const s = primitiveSchema(scalar('date'));
  it('accepts YYYY-MM-DD', () => {
    expect(s.safeParse('2024-01-15')).toMatchObject({ success: true, data: '2024-01-15' });
  });
  it('rejects YYYY-MM-DD with time', () => {
    expect(s.safeParse('2024-01-15T10:00:00Z').success).toBe(false);
  });
  it('rejects non-date string', () => {
    expect(s.safeParse('not-a-date').success).toBe(false);
  });
});

describe('primitiveSchema — datetime', () => {
  const s = primitiveSchema(scalar('datetime'));
  it('accepts ISO with Z', () => {
    expect(s.safeParse('2024-01-15T10:20:30Z')).toMatchObject({
      success: true,
      data: '2024-01-15T10:20:30Z',
    });
  });
  it('accepts ISO with fractional seconds', () => {
    expect(s.safeParse('2024-01-15T10:20:30.123Z').success).toBe(true);
  });
  it('accepts ISO with tz offset', () => {
    expect(s.safeParse('2024-01-15T10:20:30+02:00').success).toBe(true);
  });
  it('rejects plain date', () => {
    expect(s.safeParse('2024-01-15').success).toBe(false);
  });
});

describe('primitiveSchema — decimal', () => {
  const s = primitiveSchema(scalar('decimal'));
  it('accepts numeric string', () => {
    expect(s.safeParse('123.45')).toMatchObject({ success: true, data: '123.45' });
  });
  it('accepts negative', () => {
    expect(s.safeParse('-0.5').success).toBe(true);
  });
  it('accepts integer-looking decimal', () => {
    expect(s.safeParse('100').success).toBe(true);
  });
  it('rejects native number (must be string)', () => {
    expect(s.safeParse(123.45).success).toBe(false);
  });
  it('rejects non-numeric', () => {
    expect(s.safeParse('abc').success).toBe(false);
  });
});
```

- [ ] **Step 4.2: Run tests to verify fail**

```bash
pnpm test test/unit/primitive-schema.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 4.3: Implement primitive-schema.ts (scalars only)**

```ts
// src/startup/primitive-schema.ts
import { z } from 'zod';
import type { InputType, ScalarPrimitive } from '@rntme/bindings';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

function scalarSchema(primitive: ScalarPrimitive): z.ZodTypeAny {
  switch (primitive) {
    case 'integer':
      return z.coerce.number().int();
    case 'string':
      return z.string();
    case 'boolean':
      return z.preprocess(
        (v) =>
          typeof v === 'boolean'
            ? v
            : v === 'true' || v === '1'
              ? true
              : v === 'false' || v === '0'
                ? false
                : v,
        z.boolean(),
      );
    case 'date':
      return z.string().regex(ISO_DATE_RE);
    case 'datetime':
      return z.string().regex(ISO_DATETIME_RE);
    case 'decimal':
      return z.string().regex(DECIMAL_RE);
  }
}

export function primitiveSchema(type: InputType): z.ZodTypeAny {
  if (type.kind === 'scalar') {
    return scalarSchema(type.primitive);
  }
  if (type.kind === 'list') {
    return z.preprocess(
      (v) => (Array.isArray(v) ? v : v === undefined ? v : [v]),
      z.array(scalarSchema(type.element)),
    );
  }
  throw new Error(`primitiveSchema: unsupported input type kind "${type.kind}"`);
}
```

- [ ] **Step 4.4: Verify scalar tests pass**

```bash
pnpm test test/unit/primitive-schema.test.ts
```

Expected: all scalar tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add packages/bindings-http/src/startup/primitive-schema.ts packages/bindings-http/test/unit/primitive-schema.test.ts
git commit -m "feat(bindings-http): primitiveSchema for scalar types"
```

---

## Task 5: `primitiveSchema` — `list<T>`

Cover the list branch (already implemented in Task 4 code) with its own tests.

**Files:**
- Modify: `packages/bindings-http/test/unit/primitive-schema.test.ts`

- [ ] **Step 5.1: Add failing tests for `list<T>`**

Append to `test/unit/primitive-schema.test.ts`:

```ts
describe('primitiveSchema — list<integer>', () => {
  const s = primitiveSchema({ kind: 'list', element: 'integer' });
  it('accepts array of numeric strings', () => {
    expect(s.safeParse(['1', '2', '3'])).toMatchObject({
      success: true,
      data: [1, 2, 3],
    });
  });
  it('wraps single scalar into array', () => {
    expect(s.safeParse('42')).toMatchObject({ success: true, data: [42] });
  });
  it('rejects non-integer element', () => {
    expect(s.safeParse(['1', 'abc']).success).toBe(false);
  });
  it('accepts empty array', () => {
    expect(s.safeParse([])).toMatchObject({ success: true, data: [] });
  });
});

describe('primitiveSchema — list<string>', () => {
  const s = primitiveSchema({ kind: 'list', element: 'string' });
  it('accepts array of strings', () => {
    expect(s.safeParse(['a', 'b'])).toMatchObject({
      success: true,
      data: ['a', 'b'],
    });
  });
});
```

- [ ] **Step 5.2: Run tests — should pass**

```bash
pnpm test test/unit/primitive-schema.test.ts
```

Expected: all tests pass (list branch was implemented in Task 4).

- [ ] **Step 5.3: Commit**

```bash
git add packages/bindings-http/test/unit/primitive-schema.test.ts
git commit -m "test(bindings-http): list<T> primitiveSchema coverage"
```

---

## Task 6: `buildSchemas` — per-binding composer

Builds `{ querySchema, pathSchema, bodySchema? }` for a single binding from `HttpParameter[]` + `GraphSignature`. Applies `.nullable()` and `.optional()` modifiers. Uses `.strict()` on object schemas so unknown keys surface as errors.

**Files:**
- Create: `packages/bindings-http/src/startup/zod-schema.ts`
- Create: `packages/bindings-http/test/unit/zod-schema.test.ts`

- [ ] **Step 6.1: Write failing tests**

```ts
// test/unit/zod-schema.test.ts
import { describe, it, expect } from 'vitest';
import { buildSchemas } from '../../src/startup/zod-schema.js';
import type { GraphSignature, HttpParameter } from '@rntme/bindings';

const sig: GraphSignature = {
  id: 'g',
  inputs: {
    dateFrom: { type: { kind: 'scalar', primitive: 'date' }, mode: 'required' },
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
    minRev: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
    nickname: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' },
    ids: { type: { kind: 'list', element: 'integer' }, mode: 'predicate_optional' },
  },
  output: { type: { kind: 'rowset', shape: 'X' }, from: 'z' },
};

const p = (name: string, loc: 'query' | 'path' | 'body', bindTo: string, required: boolean): HttpParameter =>
  ({ name, in: loc, bindTo, required });

describe('buildSchemas — query+path', () => {
  it('required date passes and missing fails', () => {
    const s = buildSchemas([p('dateFrom', 'query', 'dateFrom', true)], sig);
    expect(s.querySchema.safeParse({ dateFrom: '2024-01-01' }).success).toBe(true);
    expect(s.querySchema.safeParse({}).success).toBe(false);
  });

  it('defaulted parameter is optional and does NOT inject zod default', () => {
    const s = buildSchemas([p('limit', 'query', 'limit', false)], sig);
    const parsed = s.querySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({});
  });

  it('predicate_optional is optional', () => {
    const s = buildSchemas([p('minRev', 'query', 'minRev', false)], sig);
    expect(s.querySchema.safeParse({}).success).toBe(true);
    expect(s.querySchema.safeParse({ minRev: '100.5' }).success).toBe(true);
  });

  it('nullable input accepts null in body but not in query string', () => {
    const bodySchema = buildSchemas([p('nickname', 'body', 'nickname', true)], sig).bodySchema!;
    expect(bodySchema.safeParse({ nickname: null }).success).toBe(true);
    expect(bodySchema.safeParse({ nickname: 'alice' }).success).toBe(true);
  });

  it('strict object rejects unknown keys', () => {
    const s = buildSchemas([p('dateFrom', 'query', 'dateFrom', true)], sig);
    const r = s.querySchema.safeParse({ dateFrom: '2024-01-01', extra: 'no' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('separates body parameters from query when both present', () => {
    const s = buildSchemas(
      [p('dateFrom', 'query', 'dateFrom', true), p('ids', 'body', 'ids', true)],
      sig,
    );
    expect(s.querySchema.safeParse({ dateFrom: '2024-01-01' }).success).toBe(true);
    expect(s.bodySchema).toBeDefined();
    expect(s.bodySchema!.safeParse({ ids: [1, 2] }).success).toBe(true);
  });

  it('omits bodySchema when no body parameters', () => {
    const s = buildSchemas([p('dateFrom', 'query', 'dateFrom', true)], sig);
    expect(s.bodySchema).toBeUndefined();
  });

  it('handles path parameter (always required)', () => {
    const sig2: GraphSignature = {
      id: 'g2',
      inputs: { orderId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'X' }, from: 'z' },
    };
    const s = buildSchemas([{ name: 'orderId', in: 'path', bindTo: 'orderId', required: true }], sig2);
    expect(s.pathSchema.safeParse({ orderId: 'abc' }).success).toBe(true);
    expect(s.pathSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 6.2: Run tests to verify fail**

```bash
pnpm test test/unit/zod-schema.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 6.3: Implement zod-schema.ts**

```ts
// src/startup/zod-schema.ts
import { z } from 'zod';
import type { GraphSignature, HttpParameter, InputMode } from '@rntme/bindings';
import { primitiveSchema } from './primitive-schema.js';

export type BuiltSchemas = {
  querySchema: z.ZodTypeAny;
  pathSchema: z.ZodTypeAny;
  bodySchema?: z.ZodTypeAny;
};

export function buildSchemas(parameters: HttpParameter[], signature: GraphSignature): BuiltSchemas {
  const byLocation: Record<'query' | 'path' | 'body', Record<string, z.ZodTypeAny>> = {
    query: {},
    path: {},
    body: {},
  };

  for (const p of parameters) {
    const input = signature.inputs[p.bindTo];
    if (!input) {
      throw new Error(`buildSchemas: unknown bindTo "${p.bindTo}" (should be prevented by validateBindings)`);
    }

    let schema = primitiveSchema(input.type);

    if (isNullable(input.mode, p.in)) {
      schema = schema.nullable();
    }

    if (!p.required) {
      schema = schema.optional();
    }

    byLocation[p.in][p.name] = schema;
  }

  return {
    querySchema: z.object(byLocation.query).strict(),
    pathSchema: z.object(byLocation.path).strict(),
    bodySchema: Object.keys(byLocation.body).length > 0
      ? z.object(byLocation.body).strict()
      : undefined,
  };
}

function isNullable(mode: InputMode, location: 'query' | 'path' | 'body'): boolean {
  // Only the `nullable` mode yields null-acceptance at the schema level.
  // For query/path, JSON `null` is unrepresentable anyway; nullable only matters in body.
  if (mode !== 'nullable') return false;
  return location === 'body';
}
```

- [ ] **Step 6.4: Verify tests pass**

```bash
pnpm test test/unit/zod-schema.test.ts
```

Expected: all tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add packages/bindings-http/src/startup/zod-schema.ts packages/bindings-http/test/unit/zod-schema.test.ts
git commit -m "feat(bindings-http): buildSchemas per-binding Zod composer"
```

---

## Task 7: `remap` — HTTP name → graph input name

Builds a `Record<httpName, graphInputName>` lookup once per binding, then uses it at request time to rename keys.

**Files:**
- Create: `packages/bindings-http/src/runtime/remap.ts`
- Create: `packages/bindings-http/test/unit/remap.test.ts`

- [ ] **Step 7.1: Write failing tests**

```ts
// test/unit/remap.test.ts
import { describe, it, expect } from 'vitest';
import { buildBindToMap, remapToGraphInputs } from '../../src/runtime/remap.js';
import type { HttpParameter } from '@rntme/bindings';

const p = (name: string, bindTo: string): HttpParameter =>
  ({ name, in: 'query', bindTo, required: true });

describe('buildBindToMap', () => {
  it('returns map from http name to graph input name', () => {
    const m = buildBindToMap([p('dateFrom', 'dateFrom'), p('limitOverride', 'limit')]);
    expect(m).toEqual({ dateFrom: 'dateFrom', limitOverride: 'limit' });
  });
});

describe('remapToGraphInputs', () => {
  const map = { dateFrom: 'dateFrom', limitOverride: 'limit' };

  it('renames keys through the map', () => {
    expect(remapToGraphInputs({ dateFrom: '2024-01-01', limitOverride: 5 }, map)).toEqual({
      dateFrom: '2024-01-01',
      limit: 5,
    });
  });

  it('omits keys absent from input bag', () => {
    expect(remapToGraphInputs({ dateFrom: '2024-01-01' }, map)).toEqual({
      dateFrom: '2024-01-01',
    });
  });

  it('ignores unknown keys in the bag', () => {
    expect(remapToGraphInputs({ dateFrom: 'x', unrelated: 'y' }, map)).toEqual({
      dateFrom: 'x',
    });
  });
});
```

- [ ] **Step 7.2: Run tests to verify fail**

```bash
pnpm test test/unit/remap.test.ts
```

Expected: FAIL.

- [ ] **Step 7.3: Implement remap.ts**

```ts
// src/runtime/remap.ts
import type { HttpParameter } from '@rntme/bindings';

export type BindToMap = Record<string, string>;

export function buildBindToMap(parameters: HttpParameter[]): BindToMap {
  const map: BindToMap = {};
  for (const p of parameters) {
    map[p.name] = p.bindTo;
  }
  return map;
}

export function remapToGraphInputs(
  bag: Record<string, unknown>,
  bindToMap: BindToMap,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [httpName, graphInputName] of Object.entries(bindToMap)) {
    if (Object.prototype.hasOwnProperty.call(bag, httpName)) {
      out[graphInputName] = bag[httpName];
    }
  }
  return out;
}
```

- [ ] **Step 7.4: Verify tests pass**

```bash
pnpm test test/unit/remap.test.ts
```

Expected: all tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add packages/bindings-http/src/runtime/remap.ts packages/bindings-http/test/unit/remap.test.ts
git commit -m "feat(bindings-http): remap http params to graph inputs"
```

---

## Task 8: `extract` — pull raw values from Hono Context

Returns raw bag: strings for query/path (or arrays for multi-value query), JSON value for body.

**Files:**
- Create: `packages/bindings-http/src/runtime/extract.ts`
- Create: `packages/bindings-http/test/unit/extract.test.ts`

- [ ] **Step 8.1: Write failing tests**

```ts
// test/unit/extract.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { extractQuery, extractPath } from '../../src/runtime/extract.js';
import type { HttpParameter } from '@rntme/bindings';

const queryParam = (name: string, bindTo = name): HttpParameter =>
  ({ name, in: 'query', bindTo, required: false });

const listQueryParam = (name: string): HttpParameter =>
  ({ name, in: 'query', bindTo: name, required: false });

describe('extractQuery', () => {
  it('reads single value', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [queryParam('a')], new Set());
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q?a=hello'));
    expect(bag).toEqual({ a: 'hello' });
  });

  it('returns last value when single-valued param is duplicated', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [queryParam('a')], new Set());
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q?a=one&a=two'));
    expect(bag).toEqual({ a: 'two' });
  });

  it('returns array for list parameter', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [listQueryParam('ids')], new Set(['ids']));
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q?ids=1&ids=2&ids=3'));
    expect(bag).toEqual({ ids: ['1', '2', '3'] });
  });

  it('omits absent parameter', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [queryParam('a')], new Set());
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q'));
    expect(bag).toEqual({});
  });

  it('passes through unknown query parameters (so strict() can flag them)', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/q', (c) => {
      bag = extractQuery(c, [queryParam('a')], new Set());
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/q?a=1&unknown=2'));
    expect(bag).toEqual({ a: '1', unknown: '2' });
  });
});

describe('extractPath', () => {
  it('reads path parameters', async () => {
    const app = new Hono();
    let bag: Record<string, unknown> = {};
    app.get('/orders/:orderId/items/:itemId', (c) => {
      bag = extractPath(c, ['orderId', 'itemId']);
      return c.text('ok');
    });
    await app.fetch(new Request('http://x/orders/42/items/7'));
    expect(bag).toEqual({ orderId: '42', itemId: '7' });
  });
});
```

- [ ] **Step 8.2: Run tests to verify fail**

```bash
pnpm test test/unit/extract.test.ts
```

Expected: FAIL.

- [ ] **Step 8.3: Implement extract.ts**

```ts
// src/runtime/extract.ts
import type { Context } from 'hono';
import type { HttpParameter } from '@rntme/bindings';

/**
 * Query extraction.
 *
 * - `declared`: parameters declared in binding spec with `in: 'query'`.
 * - `listSet`: names of declared parameters whose input type is `list<T>`.
 *
 * Extraction policy:
 * - Declared list parameter → always array (empty if absent).
 * - Declared non-list parameter → single string (last wins if duplicated),
 *   or omitted entirely if not present on the request.
 * - Undeclared query keys → passed through as-is (single string, last wins).
 *   They will be rejected downstream by `.strict()` on the Zod schema.
 */
export function extractQuery(
  ctx: Context,
  declared: HttpParameter[],
  listSet: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // ctx.req.queries() returns Record<string, string[]> with ALL occurrences.
  const all = ctx.req.queries();

  const declaredNames = new Set(declared.map((p) => p.name));

  // Declared parameters: apply list vs single rules
  for (const p of declared) {
    const vals = all[p.name];
    if (listSet.has(p.name)) {
      out[p.name] = vals ?? [];
    } else if (vals !== undefined && vals.length > 0) {
      out[p.name] = vals[vals.length - 1];
    }
    // else: absent — leave unset (optional/required handled by Zod)
  }

  // Undeclared: pass through as single (last-wins) so `.strict()` can flag them.
  for (const [name, vals] of Object.entries(all)) {
    if (declaredNames.has(name)) continue;
    if (vals.length > 0) {
      out[name] = vals[vals.length - 1];
    }
  }

  return out;
}

export function extractPath(ctx: Context, names: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const n of names) {
    const v = ctx.req.param(n);
    if (v !== undefined) out[n] = v;
  }
  return out;
}
```

- [ ] **Step 8.4: Verify tests pass**

```bash
pnpm test test/unit/extract.test.ts
```

Expected: all tests pass.

- [ ] **Step 8.5: Commit**

```bash
git add packages/bindings-http/src/runtime/extract.ts packages/bindings-http/test/unit/extract.test.ts
git commit -m "feat(bindings-http): extract query and path from Hono context"
```

---

## Task 9: `compileForGraph` helper

Wraps `compile()` from `@rntme/graph-ir-compiler` to handle one-graph-at-a-time (workaround for current compiler limitation).

**Files:**
- Create: `packages/bindings-http/src/startup/compile-plan.ts`
- Create: `packages/bindings-http/test/unit/compile-plan.test.ts`

We lean on the compiler's own `test/e2e/fixtures/` for real PDM+QSM+graph to avoid rebuilding a parallel fixture. Paths are computed from `import.meta.url`.

- [ ] **Step 9.1: Write failing tests**

```ts
// test/unit/compile-plan.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileForGraph } from '../../src/startup/compile-plan.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');

const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

const spec = loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json'));
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json'));

describe('compileForGraph', () => {
  it('compiles a single graph from a multi-graph spec', () => {
    const r = compileForGraph(spec, 'getCategorySales', pdm, qsm);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sql.length).toBeGreaterThan(0);
      expect(r.value.paramOrder).toEqual(expect.arrayContaining(['dateFrom', 'dateTo']));
    }
  });

  it('returns compiler errors for unknown graph id', () => {
    const r = compileForGraph(spec, 'missingGraph', pdm, qsm);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 9.2: Run tests to verify fail**

```bash
pnpm test test/unit/compile-plan.test.ts
```

Expected: FAIL.

- [ ] **Step 9.3: Implement compileForGraph**

```ts
// src/startup/compile-plan.ts
import { compile, type CompileResult } from '@rntme/graph-ir-compiler';
import type { Result } from '@rntme/graph-ir-compiler';

export function compileForGraph(
  rawSpec: unknown,
  graphId: string,
  pdm: unknown,
  qsm: unknown,
): Result<CompileResult> {
  const spec = rawSpec as { graphs?: Record<string, unknown>; [k: string]: unknown };
  const graphs = spec?.graphs ?? {};
  const target = graphs[graphId];
  const singleGraphSpec = {
    ...spec,
    graphs: target === undefined ? {} : { [graphId]: target },
  };
  return compile(singleGraphSpec, pdm, qsm);
}
```

- [ ] **Step 9.4: Verify tests pass**

```bash
pnpm test test/unit/compile-plan.test.ts
```

Expected: both tests pass.

- [ ] **Step 9.5: Commit**

```bash
git add packages/bindings-http/src/startup/compile-plan.ts packages/bindings-http/test/unit/compile-plan.test.ts
git commit -m "feat(bindings-http): compileForGraph single-graph wrapper"
```

---

## Task 10: `buildPlan` — per-binding orchestration

Walks `validated.resolved`, runs `compileForGraph` once per unique graph id, aggregates errors and throws `BindingsRuntimeError`, returns `Record<bindingId, BindingPlan>`.

**Files:**
- Modify: `packages/bindings-http/src/startup/compile-plan.ts` (extend with `buildPlan`)
- Create: `packages/bindings-http/test/unit/build-plan.test.ts`

- [ ] **Step 10.1: Write failing tests**

```ts
// test/unit/build-plan.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBindings, parseBindingArtifact } from '@rntme/bindings';
import type { BindingResolvers, ValidatedBindings } from '@rntme/bindings';
import { buildPlan } from '../../src/startup/compile-plan.js';
import { BindingsRuntimeError } from '../../src/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

const spec = loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json'));
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json'));

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'getCategorySales'
      ? {
          id,
          inputs: {
            dateFrom: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            dateTo: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
            limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
          },
          output: { type: { kind: 'rowset', shape: 'CategorySalesAgg' }, from: 'paged' },
        }
      : null,
  resolveShape: (name) =>
    name === 'CategorySalesAgg'
      ? {
          name,
          origin: 'custom',
          fields: {
            categoryId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            revenue: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
            totalQuantity: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            lineCount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            avgItemPrice: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
          },
        }
      : null,
};

function makeValidated(): ValidatedBindings {
  const artifact = {
    version: '1.0',
    graphSpecRef: 'commerce.graphs.v1',
    pdmRef: 'commerce.domain.v1',
    qsmRef: 'commerce.read.v1',
    bindings: {
      getCategorySalesHttp: {
        graph: 'getCategorySales',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET',
          path: '/v1/analytics/category-sales',
          parameters: [
            { name: 'dateFrom', in: 'query', bindTo: 'dateFrom', required: true },
            { name: 'dateTo', in: 'query', bindTo: 'dateTo', required: true },
            { name: 'minRevenue', in: 'query', bindTo: 'minRevenue', required: false },
            { name: 'limit', in: 'query', bindTo: 'limit', required: false },
          ],
        },
      },
    },
  };
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse failed: ' + JSON.stringify(parsed.errors));
  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) throw new Error('validate failed: ' + JSON.stringify(validated.errors));
  return validated.value;
}

describe('buildPlan', () => {
  it('returns a plan for every binding with compiled SQL', () => {
    const validated = makeValidated();
    const plan = buildPlan(validated, spec, pdm, qsm);
    expect(Object.keys(plan)).toEqual(['getCategorySalesHttp']);
    expect(plan.getCategorySalesHttp!.compiled.sql.length).toBeGreaterThan(0);
    expect(plan.getCategorySalesHttp!.bindToMap).toEqual({
      dateFrom: 'dateFrom',
      dateTo: 'dateTo',
      minRevenue: 'minRevenue',
      limit: 'limit',
    });
    expect(plan.getCategorySalesHttp!.querySchema).toBeDefined();
  });

  it('throws BindingsRuntimeError when compile fails', () => {
    const validated = makeValidated();
    // Feed an empty spec — compile will fail for the referenced graph.
    const brokenSpec = { version: '1.0-rc7', pdmRef: 'x', qsmRef: 'y', shapes: {}, graphs: {} };
    expect(() => buildPlan(validated, brokenSpec, pdm, qsm)).toThrow(BindingsRuntimeError);
  });
});
```

- [ ] **Step 10.2: Run tests to verify fail**

```bash
pnpm test test/unit/build-plan.test.ts
```

Expected: FAIL.

- [ ] **Step 10.3: Extend compile-plan.ts with `buildPlan` + `BindingPlan` type**

Append to `src/startup/compile-plan.ts`:

```ts
import type { CompileResult } from '@rntme/graph-ir-compiler';
import type {
  ValidatedBindings,
  BindingEntry,
  GraphSignature,
  ResolvedShape,
  InputType,
  HttpParameter,
} from '@rntme/bindings';
import { BindingsRuntimeError, type RuntimeErrorEntry } from '../errors.js';
import { buildSchemas, type BuiltSchemas } from './zod-schema.js';
import { buildBindToMap, type BindToMap } from '../runtime/remap.js';

export type BindingPlan = {
  bindingId: string;
  entry: BindingEntry;
  signature: GraphSignature;
  outputShape: ResolvedShape;
  schemas: BuiltSchemas;
  bindToMap: BindToMap;
  listParamNames: Set<string>;
  pathParamNames: string[];
  bodyParamNames: string[];
  compiled: CompileResult;
};

export function buildPlan(
  validated: ValidatedBindings,
  graphSpec: unknown,
  pdm: unknown,
  qsm: unknown,
): Record<string, BindingPlan> {
  const uniqueGraphIds = new Set<string>();
  for (const r of Object.values(validated.resolved)) {
    uniqueGraphIds.add(r.entry.graph);
  }

  const compileCache = new Map<string, CompileResult>();
  const errors: RuntimeErrorEntry[] = [];

  for (const graphId of uniqueGraphIds) {
    const r = compileForGraph(graphSpec, graphId, pdm, qsm);
    if (r.ok) {
      compileCache.set(graphId, r.value);
    } else {
      for (const cause of r.errors) {
        errors.push({ graphId, cause });
      }
    }
  }

  if (errors.length > 0) {
    throw new BindingsRuntimeError(errors);
  }

  const plan: Record<string, BindingPlan> = {};
  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const { entry, signature, outputShape } = resolved;
    const schemas = buildSchemas(entry.http.parameters, signature);
    plan[bindingId] = {
      bindingId,
      entry,
      signature,
      outputShape,
      schemas,
      bindToMap: buildBindToMap(entry.http.parameters),
      listParamNames: collectListParams(entry.http.parameters, signature),
      pathParamNames: entry.http.parameters.filter((p) => p.in === 'path').map((p) => p.name),
      bodyParamNames: entry.http.parameters.filter((p) => p.in === 'body').map((p) => p.name),
      compiled: compileCache.get(entry.graph)!,
    };
  }
  return plan;
}

function collectListParams(parameters: HttpParameter[], signature: GraphSignature): Set<string> {
  const listSet = new Set<string>();
  for (const p of parameters) {
    if (p.in !== 'query') continue;
    const t: InputType | undefined = signature.inputs[p.bindTo]?.type;
    if (t && t.kind === 'list') listSet.add(p.name);
  }
  return listSet;
}
```

- [ ] **Step 10.4: Verify tests pass**

```bash
pnpm test test/unit/build-plan.test.ts
```

Expected: both tests pass.

- [ ] **Step 10.5: Commit**

```bash
git add packages/bindings-http/src/startup/compile-plan.ts packages/bindings-http/test/unit/build-plan.test.ts
git commit -m "feat(bindings-http): buildPlan aggregates compile and schemas"
```

---

## Task 11: `makeHandler` — request lifecycle closure

Composes `extract → zod parse → remap → executeCompiled → ctx.json`. Handles all error branches.

**Files:**
- Create: `packages/bindings-http/src/runtime/handler.ts`
- Create: `packages/bindings-http/test/unit/handler.test.ts`

- [ ] **Step 11.1: Write failing tests** (unit test uses real Hono app + in-memory SQLite; real DB is needed since handler calls `executeCompiled`)

```ts
// test/unit/handler.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { validateBindings, parseBindingArtifact } from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import { buildPlan } from '../../src/startup/compile-plan.js';
import { makeHandler } from '../../src/runtime/handler.js';
import { honoPath } from '../../src/startup/hono-path.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const spec = loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json'));
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json'));
const seedSql = readFileSync(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.sql'), 'utf8');

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'getCategorySales'
      ? {
          id,
          inputs: {
            dateFrom: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            dateTo: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
            limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
          },
          output: { type: { kind: 'rowset', shape: 'CategorySalesAgg' }, from: 'paged' },
        }
      : null,
  resolveShape: (name) =>
    name === 'CategorySalesAgg'
      ? {
          name,
          origin: 'custom',
          fields: {
            categoryId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            revenue: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
            totalQuantity: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            lineCount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            avgItemPrice: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
          },
        }
      : null,
};

const artifact = {
  version: '1.0',
  graphSpecRef: 'commerce.graphs.v1',
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
  bindings: {
    getCategorySalesHttp: {
      graph: 'getCategorySales',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/analytics/category-sales',
        parameters: [
          { name: 'dateFrom', in: 'query', bindTo: 'dateFrom', required: true },
          { name: 'dateTo', in: 'query', bindTo: 'dateTo', required: true },
          { name: 'minRevenue', in: 'query', bindTo: 'minRevenue', required: false },
          { name: 'limit', in: 'query', bindTo: 'limit', required: false },
        ],
      },
    },
  },
};

let db: Database.Database;
let app: Hono;

beforeAll(() => {
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse fail');
  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) throw new Error('validate fail');
  const plan = buildPlan(validated.value, spec, pdm, qsm);
  db = new Database(':memory:');
  db.exec(seedSql);
  app = new Hono();
  const bp = plan.getCategorySalesHttp!;
  app.get(honoPath(bp.entry.http.path), makeHandler(bp, { db }));
});

afterAll(() => {
  db.close();
});

describe('makeHandler — happy path', () => {
  it('returns 200 and a JSON array for valid query', async () => {
    const res = await app.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z',
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('categoryId');
    expect(body[0]).toHaveProperty('revenue');
  });
});

describe('makeHandler — 400 on validation errors', () => {
  it('400 when required param missing', async () => {
    const res = await app.fetch(new Request('http://x/v1/analytics/category-sales'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; details: Array<{ path: string }> };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.some((d) => d.path === 'dateFrom')).toBe(true);
  });

  it('400 when datetime is malformed', async () => {
    const res = await app.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=not-a-date&dateTo=2026-12-31T23:59:59Z',
      ),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('400 when unknown query parameter present', async () => {
    const res = await app.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z&evil=true',
      ),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe('makeHandler — 500 on execute failure', () => {
  it('returns 500 and calls onError when db is closed', async () => {
    const brokenDb = new Database(':memory:');
    brokenDb.close();
    const parsed = parseBindingArtifact(artifact);
    if (!parsed.ok) throw new Error('parse fail');
    const validated = validateBindings(parsed.value, resolvers);
    if (!validated.ok) throw new Error('validate fail');
    const plan = buildPlan(validated.value, spec, pdm, qsm);
    const errors: unknown[] = [];
    const localApp = new Hono();
    const bp = plan.getCategorySalesHttp!;
    localApp.get(
      honoPath(bp.entry.http.path),
      makeHandler(bp, {
        db: brokenDb,
        onError: (e) => {
          errors.push(e);
        },
      }),
    );
    const res = await localApp.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z',
      ),
    );
    expect(res.status).toBe(500);
    expect(errors).toHaveLength(1);
    const body = (await res.json()) as { code: string; message: string };
    expect(body).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });
});
```

- [ ] **Step 11.2: Run tests to verify fail**

```bash
pnpm test test/unit/handler.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 11.3: Implement handler.ts**

```ts
// src/runtime/handler.ts
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import { execute } from '@rntme/graph-ir-compiler';
import type { BindingPlan } from '../startup/compile-plan.js';
import {
  validationErrorBody,
  invalidBodyErrorBody,
  internalErrorBody,
} from '../errors.js';
import { extractQuery, extractPath } from './extract.js';
import { remapToGraphInputs } from './remap.js';

export type HandlerDeps = {
  db: BetterSqlite3.Database;
  onError?: (err: unknown, ctx: Context) => void;
};

type Handler = (c: Context) => Promise<Response>;

export function makeHandler(plan: BindingPlan, deps: HandlerDeps): Handler {
  const declaredQueryParams = plan.entry.http.parameters.filter((p) => p.in === 'query');
  const hasBody = plan.bodyParamNames.length > 0;

  return async (c) => {
    // 1. Extract path params.
    const pathBag = extractPath(c, plan.pathParamNames);
    const pathParsed = plan.schemas.pathSchema.safeParse(pathBag);
    if (!pathParsed.success) {
      return c.json(validationErrorBody(pathParsed.error), 400);
    }

    // 2. Extract query params.
    const queryBag = extractQuery(c, declaredQueryParams, plan.listParamNames);
    const queryParsed = plan.schemas.querySchema.safeParse(queryBag);
    if (!queryParsed.success) {
      return c.json(validationErrorBody(queryParsed.error), 400);
    }

    // 3. Extract and parse body if needed.
    let bodyValues: Record<string, unknown> = {};
    if (hasBody) {
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(invalidBodyErrorBody('Request body is not valid JSON'), 400);
      }
      if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
        return c.json(invalidBodyErrorBody('Request body must be a JSON object'), 400);
      }
      const bodyParsed = plan.schemas.bodySchema!.safeParse(rawBody);
      if (!bodyParsed.success) {
        return c.json(validationErrorBody(bodyParsed.error), 400);
      }
      bodyValues = bodyParsed.data as Record<string, unknown>;
    }

    // 4. Remap http names → graph input names.
    const combined: Record<string, unknown> = {
      ...(queryParsed.data as Record<string, unknown>),
      ...(pathParsed.data as Record<string, unknown>),
      ...bodyValues,
    };
    const graphInputs = remapToGraphInputs(combined, plan.bindToMap);

    // 5. Execute.
    let rows: unknown[];
    try {
      rows = execute(plan.compiled, graphInputs, deps.db);
    } catch (e) {
      deps.onError?.(e, c);
      return c.json(internalErrorBody(), 500);
    }

    // 6. Respond.
    return c.json(rows, 200);
  };
}
```

- [ ] **Step 11.4: Verify tests pass**

```bash
pnpm test test/unit/handler.test.ts
```

Expected: all tests pass.

- [ ] **Step 11.5: Commit**

```bash
git add packages/bindings-http/src/runtime/handler.ts packages/bindings-http/test/unit/handler.test.ts
git commit -m "feat(bindings-http): request handler closure"
```

---

## Task 12: `createBindingsRouter` — public entry point

Stitches Task 10 (`buildPlan`) + Task 11 (`makeHandler`) + Hono route registration + optional `/openapi.json` endpoint.

**Files:**
- Create: `packages/bindings-http/src/router.ts`
- Create: `packages/bindings-http/test/integration/router.test.ts`

- [ ] **Step 12.1: Write failing integration test**

```ts
// test/integration/router.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  validateBindings,
  parseBindingArtifact,
  generateOpenApi,
} from '@rntme/bindings';
import type { BindingResolvers } from '@rntme/bindings';
import { createBindingsRouter } from '../../src/router.js';
import { BindingsRuntimeError } from '../../src/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const spec = loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json'));
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json'));
const seedSql = readFileSync(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.sql'), 'utf8');

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'getCategorySales'
      ? {
          id,
          inputs: {
            dateFrom: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            dateTo: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
            limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
          },
          output: { type: { kind: 'rowset', shape: 'CategorySalesAgg' }, from: 'paged' },
        }
      : null,
  resolveShape: (name) =>
    name === 'CategorySalesAgg'
      ? {
          name,
          origin: 'custom',
          fields: {
            categoryId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            revenue: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
            totalQuantity: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            lineCount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            avgItemPrice: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
          },
        }
      : null,
};

const artifact = {
  version: '1.0',
  graphSpecRef: 'commerce.graphs.v1',
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
  bindings: {
    getCategorySalesHttp: {
      graph: 'getCategorySales',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/analytics/category-sales',
        parameters: [
          { name: 'dateFrom', in: 'query', bindTo: 'dateFrom', required: true },
          { name: 'dateTo', in: 'query', bindTo: 'dateTo', required: true },
          { name: 'minRevenue', in: 'query', bindTo: 'minRevenue', required: false },
          { name: 'limit', in: 'query', bindTo: 'limit', required: false },
        ],
      },
    },
  },
};

let db: Database.Database;

beforeAll(() => {
  db = new Database(':memory:');
  db.exec(seedSql);
});

afterAll(() => {
  db.close();
});

function validated() {
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse fail');
  const v = validateBindings(parsed.value, resolvers);
  if (!v.ok) throw new Error('validate fail');
  return v.value;
}

describe('createBindingsRouter — end to end', () => {
  it('serves the configured binding and returns rows', async () => {
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec: spec,
      pdm,
      qsm,
      db,
    });
    const res = await router.fetch(
      new Request(
        'http://x/v1/analytics/category-sales?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z&limit=5',
      ),
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('categoryId');
  });

  it('mounts GET /openapi.json when openApiDoc is provided', async () => {
    const openApiResult = generateOpenApi(validated(), resolvers);
    if (!openApiResult.ok) throw new Error('generateOpenApi failed');
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec: spec,
      pdm,
      qsm,
      db,
      openApiDoc: openApiResult.value,
    });
    const res = await router.fetch(new Request('http://x/openapi.json'));
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toContain('/v1/analytics/category-sales');
  });

  it('does not mount /openapi.json when openApiDoc is absent', async () => {
    const router = createBindingsRouter({
      validated: validated(),
      graphSpec: spec,
      pdm,
      qsm,
      db,
    });
    const res = await router.fetch(new Request('http://x/openapi.json'));
    expect(res.status).toBe(404);
  });

  it('throws BindingsRuntimeError when compile fails at startup', () => {
    const brokenSpec = { version: '1.0-rc7', pdmRef: 'x', qsmRef: 'y', shapes: {}, graphs: {} };
    expect(() =>
      createBindingsRouter({
        validated: validated(),
        graphSpec: brokenSpec,
        pdm,
        qsm,
        db,
      }),
    ).toThrow(BindingsRuntimeError);
  });
});
```

- [ ] **Step 12.2: Run tests to verify fail**

```bash
pnpm test test/integration/router.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 12.3: Implement router.ts**

```ts
// src/router.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import { buildPlan } from './startup/compile-plan.js';
import { honoPath } from './startup/hono-path.js';
import { makeHandler } from './runtime/handler.js';

export type BindingsRouterOptions = {
  validated: ValidatedBindings;
  graphSpec: unknown;
  pdm: unknown;
  qsm: unknown;
  db: BetterSqlite3.Database;
  openApiDoc?: OpenApiDoc;
  onError?: (err: unknown, ctx: Context) => void;
};

export function createBindingsRouter(opts: BindingsRouterOptions): Hono {
  const plan = buildPlan(opts.validated, opts.graphSpec, opts.pdm, opts.qsm);
  const app = new Hono();

  for (const bp of Object.values(plan)) {
    const route = honoPath(bp.entry.http.path);
    const handler = makeHandler(bp, { db: opts.db, onError: opts.onError });
    if (bp.entry.http.method === 'GET') {
      app.get(route, handler);
    } else {
      app.post(route, handler);
    }
  }

  if (opts.openApiDoc !== undefined) {
    const doc = opts.openApiDoc;
    app.get('/openapi.json', (c) => c.json(doc));
  }

  return app;
}
```

- [ ] **Step 12.4: Verify tests pass**

```bash
pnpm test test/integration/router.test.ts
```

Expected: all 4 integration tests pass.

- [ ] **Step 12.5: Commit**

```bash
git add packages/bindings-http/src/router.ts packages/bindings-http/test/integration/router.test.ts
git commit -m "feat(bindings-http): createBindingsRouter orchestrator"
```

---

## Task 13: Public API barrel

Wire up `src/index.ts` to export the public surface.

**Files:**
- Modify: `packages/bindings-http/src/index.ts`
- Create: `packages/bindings-http/test/unit/public-api.test.ts`

- [ ] **Step 13.1: Write failing test for the barrel**

```ts
// test/unit/public-api.test.ts
import { describe, it, expect } from 'vitest';
import * as api from '../../src/index.js';

describe('public API surface', () => {
  it('exports createBindingsRouter', () => {
    expect(typeof api.createBindingsRouter).toBe('function');
  });
  it('exports BindingsRuntimeError', () => {
    expect(typeof api.BindingsRuntimeError).toBe('function');
  });
  it('exports VERSION', () => {
    expect(typeof api.VERSION).toBe('string');
  });
});
```

- [ ] **Step 13.2: Run tests to verify fail**

```bash
pnpm test test/unit/public-api.test.ts
```

Expected: FAIL on `createBindingsRouter` and `BindingsRuntimeError` (currently index.ts only exports VERSION).

- [ ] **Step 13.3: Replace index.ts with public barrel**

```ts
// src/index.ts
export const VERSION = '0.0.0';

export { createBindingsRouter } from './router.js';
export type { BindingsRouterOptions } from './router.js';

export { BindingsRuntimeError } from './errors.js';
export type { RuntimeErrorEntry, ErrorResponseBody, ValidationDetail } from './errors.js';
```

- [ ] **Step 13.4: Verify tests pass**

```bash
pnpm test
```

Expected: all tests pass (old smoke test still green, new public-api tests green).

- [ ] **Step 13.5: Commit**

```bash
git add packages/bindings-http/src/index.ts packages/bindings-http/test/unit/public-api.test.ts
git commit -m "feat(bindings-http): public API barrel"
```

---

## Task 14: Final verification

Make sure `build`, `typecheck`, `test`, `lint` all pass cleanly on the new package and nothing else regressed.

- [ ] **Step 14.1: Full package check**

```bash
cd /home/coder/project/packages/bindings-http && pnpm typecheck && pnpm test && pnpm lint && pnpm build
```

Expected: all four commands succeed.

- [ ] **Step 14.2: Workspace-wide regression check**

```bash
cd /home/coder/project && pnpm -r run typecheck && pnpm -r run test
```

Expected: all workspace packages pass typecheck and tests.

- [ ] **Step 14.3: If everything green, commit (only if there are any leftover diffs, e.g., generated `dist/` is gitignored)**

```bash
cd /home/coder/project && git status
```

If nothing is tracked that shouldn't be — no commit needed. Otherwise stage and commit with message `chore(bindings-http): finalize MVP`.

---

## Out of scope (explicit)

The following are documented in the design spec as non-goals and are **not** part of this plan:

- Auth / CORS / rate-limiting / tracing middleware.
- Multi-tenant DB routing (`getDb: (ctx) => Database`).
- Streaming responses.
- Shape-aware post-processing of response rows (decimal-as-string conversion etc.).
- Mutations / write graphs / 422 response code.
- Multi-graph `compile()` support — workaround via `compileForGraph` stands.
- Non-SQLite executors.
- Client SDK generation.
- Hot reload / config reload.

## Dependencies between tasks

- Tasks 1 must complete before any other (scaffold).
- Tasks 2–9 are each self-contained units; can be done in order.
- Task 10 depends on 2, 6, 7, 9 (imports their outputs).
- Task 11 depends on 2, 8, 7, 10.
- Task 12 depends on 10, 11, 3.
- Task 13 depends on 2, 12.
- Task 14 is the final gate.
