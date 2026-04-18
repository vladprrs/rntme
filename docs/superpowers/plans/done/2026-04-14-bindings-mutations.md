# `@rntme/bindings` Mutations Extension Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `@rntme/bindings` with a second `kind` — `"command"` — so a `BindingArtifact` can describe POST-based mutation endpoints whose underlying graphs have `role=command` (per the graph-ir-compiler mutations extension). Generate OpenAPI that surfaces the auto-derived `CommandResult` response shape and the mutation-specific `409 Conflict` response.

**Architecture:** Surgical extension of the existing four-layer pipeline — `parse → validateStructural → validateReferences → validateConsistency → generateOpenApi`. No new layers. Every change is additive and backwards-compatible:
- `BindingEntry.kind` — new optional field, parse-layer default `"query"`.
- `GraphSignature.role` — new optional field on the existing resolver contract; absent = `"query"`.
- `CommandResult` — reserved named shape, hardcoded inside `@rntme/bindings` so resolvers don't need to know about it.
- New error codes `BINDINGS_COMMAND_*` and a new `BINDINGS_QUERY_ON_COMMAND_GRAPH` surface cross-kind/role violations.
- OpenAPI emission branches on `kind`: commands emit a single-object `200`, include `409`, and register the `CommandResult` schema.

**Tech Stack:** TypeScript ESM on Node ≥ 20, Zod ^3.23, Vitest (with `toMatchFileSnapshot` for goldens). No new runtime dependencies.

**Source spec:** `docs/superpowers/specs/2026-04-14-mutations-design.md` — §4.4 (`CommandResult` shape), §4.6 (`GRAPH_MIXED_ROLE` / `CMD_*` context), §7.1 (`kind: "command"` binding), §7.2 (new `BINDINGS_COMMAND_*` codes), §7.4 (409/422/500/200 error model).

**Sibling packages for reference:**
- `packages/graph-ir-compiler/src/role/infer.ts` — `GraphRole = 'predicate' | 'mapper' | 'reducer' | 'query' | 'command'`.
- `packages/graph-ir-compiler/src/types/command.ts` — source of truth for `CommandResult = { aggregateId: string; version: number; eventIds: string[] }`.
- `packages/bindings/test/golden/category-sales/` — template for the new golden fixture layout.

**Scope:**
- In: public type additions, parse-layer `kind` default, structural/consistency validation, OpenAPI changes, golden test, barrel re-exports.
- Out: modifying `demo/issue-tracker-api`, `@rntme/bindings-http`, or `@rntme/graph-ir-compiler`. Callers will adopt the new `role` field separately; `role` stays optional to keep them compiling.

---

## File Structure

```
packages/bindings/src/
├── types/
│   ├── artifact.ts          # MODIFY: add BindingKind + optional kind on BindingEntry
│   ├── resolvers.ts         # MODIFY: add optional role on GraphSignature
│   └── result.ts            # MODIFY: add BINDINGS_COMMAND_* codes + BINDINGS_QUERY_ON_COMMAND_GRAPH
├── parse/
│   └── schema.ts            # MODIFY: kind enum with default "query"
├── validate/
│   ├── structural.ts        # MODIFY: command-specific rules (POST + no query param)
│   ├── references.ts        # MODIFY: bypass resolver for reserved CommandResult shape
│   └── consistency.ts       # MODIFY: kind↔role + row<CommandResult> output branch
├── openapi/
│   ├── command-result.ts    # NEW: reserved CommandResult shape + JSON schema
│   ├── errors.ts            # MODIFY: add 409 Conflict (commands only)
│   ├── responses.ts         # MODIFY: single-object vs rowset success response
│   └── emit.ts              # MODIFY: branch on kind for response + schema registration
└── index.ts                 # MODIFY: re-export BindingKind, GraphRole-less role alias

packages/bindings/test/
├── unit/
│   ├── parse/schema.test.ts              # MODIFY: accept/default kind
│   ├── validate/
│   │   ├── structural.test.ts            # MODIFY: POST + no query cases
│   │   └── consistency.test.ts           # MODIFY: role/kind crossover + command output
│   └── openapi/
│       ├── command-result.test.ts        # NEW: CommandResult shape + JSON schema
│       ├── responses.test.ts             # MODIFY: row variant
│       ├── errors.test.ts                # MODIFY: 409 Conflict
│       └── emit.test.ts                  # MODIFY: command OpenAPI smoke
└── golden/
    └── assign-issue/                     # NEW: command binding golden
        ├── artifact.json
        ├── expected.openapi.json
        ├── fixtures.ts
        └── assign-issue.test.ts
```

Single responsibility per file; split unchanged from the prior bindings plan.

---

## Task 1: Surface `BindingKind` + new error codes

**Files:**
- Modify: `packages/bindings/src/types/artifact.ts`
- Modify: `packages/bindings/src/types/result.ts`
- Modify: `packages/bindings/src/types/resolvers.ts`
- Modify: `packages/bindings/src/index.ts`
- Test: `packages/bindings/test/unit/types/result.test.ts`

- [ ] **Step 1.1: Write the failing test**

Add to `packages/bindings/test/unit/types/result.test.ts` (append inside the existing describe block — check the file first to see the current test name; use a new `it` block):

```typescript
import { ERROR_CODES } from '../../../src/types/result.js';

it('exposes command-kind error codes', () => {
  expect(ERROR_CODES.BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH).toBe('BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH');
  expect(ERROR_CODES.BINDINGS_QUERY_ON_COMMAND_GRAPH).toBe('BINDINGS_QUERY_ON_COMMAND_GRAPH');
  expect(ERROR_CODES.BINDINGS_COMMAND_METHOD_NOT_POST).toBe('BINDINGS_COMMAND_METHOD_NOT_POST');
  expect(ERROR_CODES.BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN).toBe('BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN');
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm --filter @rntme/bindings test -- test/unit/types/result.test.ts`
Expected: FAIL — properties are `undefined` on `ERROR_CODES`.

- [ ] **Step 1.3: Add error codes to `result.ts`**

Edit `packages/bindings/src/types/result.ts`, extend the `ERROR_CODES` object (keep existing entries, add these at the end before the closing `} as const`):

```typescript
  BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH: 'BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH',
  BINDINGS_QUERY_ON_COMMAND_GRAPH: 'BINDINGS_QUERY_ON_COMMAND_GRAPH',
  BINDINGS_COMMAND_METHOD_NOT_POST: 'BINDINGS_COMMAND_METHOD_NOT_POST',
  BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN: 'BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN',
```

- [ ] **Step 1.4: Add `BindingKind` and optional `kind` on `BindingEntry`**

Edit `packages/bindings/src/types/artifact.ts`. After `HttpBinding`, before `BindingEntry`, add:

```typescript
export type BindingKind = 'query' | 'command';
```

Change `BindingEntry` to:

```typescript
export type BindingEntry = {
  kind?: BindingKind;
  graph: string;
  target: { engine: string; dialect: string };
  http: HttpBinding;
};
```

- [ ] **Step 1.5: Add optional `role` on `GraphSignature`**

Edit `packages/bindings/src/types/resolvers.ts`. Add a type alias and the field:

```typescript
export type GraphRole = 'query' | 'command';

export type GraphSignature = {
  id: string;
  role?: GraphRole;
  inputs: Record<string, GraphInput>;
  output: { type: OutputType; from: string };
};
```

The omitted `role` deliberately mirrors the omitted `kind` — both default to `"query"` semantics in later layers. This keeps the existing demo/bindings-http resolvers compiling.

- [ ] **Step 1.6: Re-export from barrel**

Edit `packages/bindings/src/index.ts`. In the `types/artifact.js` re-export block, add `BindingKind`. In the `types/resolvers.js` re-export block, add `GraphRole`.

- [ ] **Step 1.7: Run test to verify it passes**

Run: `pnpm --filter @rntme/bindings test -- test/unit/types/result.test.ts`
Expected: PASS.

- [ ] **Step 1.8: Run full typecheck — no unrelated regressions**

Run: `pnpm --filter @rntme/bindings typecheck`
Expected: PASS. (Optional `kind` and `role` are strictly additive.)

- [ ] **Step 1.9: Commit**

```bash
git add packages/bindings/src/types/artifact.ts \
        packages/bindings/src/types/result.ts \
        packages/bindings/src/types/resolvers.ts \
        packages/bindings/src/index.ts \
        packages/bindings/test/unit/types/result.test.ts
git commit -m "feat(bindings): types — BindingKind, GraphRole, command error codes"
```

---

## Task 2: Parse — `kind` field with default

**Files:**
- Modify: `packages/bindings/src/parse/schema.ts`
- Test: `packages/bindings/test/unit/parse/schema.test.ts`

- [ ] **Step 2.1: Write the failing tests**

Append to `packages/bindings/test/unit/parse/schema.test.ts` (inside its `describe('BindingArtifactSchema', ...)`):

```typescript
it('defaults BindingEntry.kind to "query" when omitted', () => {
  const input = {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'y',
    qsmRef: 'z',
    bindings: {
      a: {
        graph: 'g',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'GET', path: '/v1/things', parameters: [] },
      },
    },
  };
  const r = BindingArtifactSchema.safeParse(input);
  expect(r.success).toBe(true);
  if (r.success) expect(r.data.bindings.a?.kind).toBe('query');
});

it('accepts BindingEntry.kind === "command"', () => {
  const input = {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'y',
    qsmRef: 'z',
    bindings: {
      cmd: {
        kind: 'command',
        graph: 'g',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'POST', path: '/v1/cmd', parameters: [] },
      },
    },
  };
  const r = BindingArtifactSchema.safeParse(input);
  expect(r.success).toBe(true);
  if (r.success) expect(r.data.bindings.cmd?.kind).toBe('command');
});

it('rejects unknown kind values', () => {
  const input = {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'y',
    qsmRef: 'z',
    bindings: {
      bad: {
        kind: 'mutation',
        graph: 'g',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'POST', path: '/v1/cmd', parameters: [] },
      },
    },
  };
  const r = BindingArtifactSchema.safeParse(input);
  expect(r.success).toBe(false);
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `pnpm --filter @rntme/bindings test -- test/unit/parse/schema.test.ts`
Expected: FAIL (extra `kind` rejected by current `.strict()` schema; default assertions fail).

- [ ] **Step 2.3: Extend `bindingEntrySchema` with `kind`**

Edit `packages/bindings/src/parse/schema.ts`. Update `bindingEntrySchema` to include `kind`:

```typescript
const bindingEntrySchema = z
  .object({
    kind: z.enum(['query', 'command']).default('query'),
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
```

Rationale: `.default('query')` on an optional field produces a populated `kind` in the parsed output. The `.strict()` still rejects unknown extra keys. `z.enum` rejects unknown `kind` values.

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `pnpm --filter @rntme/bindings test -- test/unit/parse/schema.test.ts`
Expected: PASS.

- [ ] **Step 2.5: Run full package tests to check for regressions**

Run: `pnpm --filter @rntme/bindings test`
Expected: PASS. (All existing artifacts keep parsing; `kind` is defaulted.)

- [ ] **Step 2.6: Commit**

```bash
git add packages/bindings/src/parse/schema.ts \
        packages/bindings/test/unit/parse/schema.test.ts
git commit -m "feat(bindings): parse — kind enum with default \"query\""
```

---

## Task 3: Structural validation — command method + forbidden query params

**Files:**
- Modify: `packages/bindings/src/validate/structural.ts`
- Test: `packages/bindings/test/unit/validate/structural.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Append to `packages/bindings/test/unit/validate/structural.test.ts` inside the `describe('validateStructural', ...)`:

```typescript
it('rejects command bindings with method !== POST', () => {
  const bad = clone(base);
  bad.bindings.primary!.kind = 'command';
  // base already has method: GET
  bad.bindings.primary!.http.path = '/v1/things/{id}';
  bad.bindings.primary!.http.parameters = [
    { name: 'id', in: 'path', bindTo: 'id', required: true },
  ];
  const r = validateStructural(bad);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_COMMAND_METHOD_NOT_POST')).toBe(true);
});

it('rejects command bindings with any in=query parameter', () => {
  const bad = clone(base);
  bad.bindings.primary!.kind = 'command';
  bad.bindings.primary!.http.method = 'POST';
  bad.bindings.primary!.http.parameters = [
    { name: 'limit', in: 'query', bindTo: 'limit', required: false },
  ];
  const r = validateStructural(bad);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN')).toBe(true);
});

it('accepts command bindings with POST + path + body only', () => {
  const good = clone(base);
  good.bindings.primary!.kind = 'command';
  good.bindings.primary!.http.method = 'POST';
  good.bindings.primary!.http.path = '/v1/things/{id}/actions/do';
  good.bindings.primary!.http.parameters = [
    { name: 'id', in: 'path', bindTo: 'id', required: true },
    { name: 'actor', in: 'body', bindTo: 'actor', required: true },
  ];
  const r = validateStructural(good);
  expect(r.ok).toBe(true);
});
```

Note: the top-level `base` fixture in that file has `kind` omitted, which the schema defaults — but tests here do not go through the schema. The tests write `.kind = 'command'` directly on the JS object. Update the fixture typing if needed by treating `BindingEntry.kind` as optional (it is, per Task 1). If you get a TS error, cast with `as BindingEntry` or drop into `.kind` via an assertion.

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `pnpm --filter @rntme/bindings test -- test/unit/validate/structural.test.ts`
Expected: FAIL on all three new tests.

- [ ] **Step 3.3: Add command-kind checks inside `checkBinding`**

Edit `packages/bindings/src/validate/structural.ts`. In `checkBinding`, after destructuring `const { method, path, parameters } = entry.http;`, add:

```typescript
const isCommand = entry.kind === 'command';
if (isCommand && method !== 'POST') {
  errors.push({
    layer: 'structural',
    code: ERROR_CODES.BINDINGS_COMMAND_METHOD_NOT_POST,
    message: `Command binding "${id}" must use method=POST (got ${method})`,
    path: `${basePath}.method`,
  });
}
```

Inside the existing `parameters.forEach((p, i) => { ... })` loop, after the body-on-GET check, add:

```typescript
if (isCommand && p.in === 'query') {
  errors.push({
    layer: 'structural',
    code: ERROR_CODES.BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN,
    message: `Command binding "${id}" cannot have query parameters (parameter "${p.name}")`,
    path: paramPath(i),
  });
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `pnpm --filter @rntme/bindings test -- test/unit/validate/structural.test.ts`
Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add packages/bindings/src/validate/structural.ts \
        packages/bindings/test/unit/validate/structural.test.ts
git commit -m "feat(bindings): structural — command method + no-query-param rules"
```

---

## Task 4: References — reserve `CommandResult` output shape

**Files:**
- Create: `packages/bindings/src/openapi/command-result.ts`
- Modify: `packages/bindings/src/validate/references.ts`
- Test: `packages/bindings/test/unit/validate/references.test.ts`
- Test: `packages/bindings/test/unit/openapi/command-result.test.ts`

Background: The spec (§4.4) declares `CommandResult` a reserved, auto-generated shape that is **not** written into the `shapes` catalog and **must not** require resolver lookup. The references layer currently calls `resolvers.resolveShape(output.type.shape)` for any `row<>`/`rowset<>` output and errors with `BINDINGS_UNRESOLVED_OUTPUT_SHAPE` if the resolver returns `null`. To keep resolvers unaware of `CommandResult`, `@rntme/bindings` owns the canonical shape and bypasses the resolver for that one name.

- [ ] **Step 4.1: Write the failing test for the built-in shape**

Create `packages/bindings/test/unit/openapi/command-result.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  COMMAND_RESULT_SHAPE_NAME,
  commandResultShape,
  commandResultJsonSchema,
} from '../../../src/openapi/command-result.js';

describe('CommandResult built-in', () => {
  it('uses the reserved name "CommandResult"', () => {
    expect(COMMAND_RESULT_SHAPE_NAME).toBe('CommandResult');
    expect(commandResultShape().name).toBe('CommandResult');
  });

  it('declares aggregateId / version / eventIds with correct nullability', () => {
    const shape = commandResultShape();
    expect(shape.fields.aggregateId).toEqual({
      type: { kind: 'scalar', primitive: 'string' },
      nullable: false,
    });
    expect(shape.fields.version).toEqual({
      type: { kind: 'scalar', primitive: 'integer' },
      nullable: false,
    });
    expect(shape.fields.eventIds).toEqual({
      type: { kind: 'array', element: 'string' },
      nullable: false,
    });
  });

  it('emits a stable JSON schema', () => {
    expect(commandResultJsonSchema()).toEqual({
      type: 'object',
      required: ['aggregateId', 'version', 'eventIds'],
      properties: {
        aggregateId: { type: 'string' },
        version: { type: 'integer' },
        eventIds: { type: 'array', items: { type: 'string' } },
      },
    });
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `pnpm --filter @rntme/bindings test -- test/unit/openapi/command-result.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 4.3: Create `openapi/command-result.ts`**

```typescript
import type { ResolvedShape } from '../types/resolvers.js';
import type { JsonSchema } from '../types/openapi.js';

export const COMMAND_RESULT_SHAPE_NAME = 'CommandResult';

export function commandResultShape(): ResolvedShape {
  return {
    name: COMMAND_RESULT_SHAPE_NAME,
    origin: 'custom',
    fields: {
      aggregateId: {
        type: { kind: 'scalar', primitive: 'string' },
        nullable: false,
      },
      version: {
        type: { kind: 'scalar', primitive: 'integer' },
        nullable: false,
      },
      eventIds: {
        type: { kind: 'array', element: 'string' },
        nullable: false,
      },
    },
  };
}

export function commandResultJsonSchema(): JsonSchema {
  return {
    type: 'object',
    required: ['aggregateId', 'version', 'eventIds'],
    properties: {
      aggregateId: { type: 'string' },
      version: { type: 'integer' },
      eventIds: { type: 'array', items: { type: 'string' } },
    },
  };
}
```

- [ ] **Step 4.4: Run the built-in test again**

Run: `pnpm --filter @rntme/bindings test -- test/unit/openapi/command-result.test.ts`
Expected: PASS.

- [ ] **Step 4.5: Write the failing test for references bypass**

Append to `packages/bindings/test/unit/validate/references.test.ts`:

```typescript
it('resolves reserved CommandResult shape without consulting resolver', () => {
  const cmdArtifact = {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'y',
    qsmRef: 'z',
    bindings: {
      cmd: {
        kind: 'command' as const,
        graph: 'g',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'POST' as const,
          path: '/v1/cmd',
          parameters: [{ name: 'actor', in: 'body' as const, bindTo: 'actor', required: true }],
        },
      },
    },
  } as unknown as StructurallyValid;

  const cmdSig: GraphSignature = {
    id: 'g',
    role: 'command',
    inputs: { actor: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' } },
    output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'emitX' },
  };

  // Resolver should NOT be asked for CommandResult — throw if it is, to prove the bypass.
  const resolvers: BindingResolvers = {
    resolveGraphSignature: (id) => (id === 'g' ? cmdSig : null),
    resolveShape: (name) => {
      if (name === 'CommandResult') throw new Error('resolver must not be consulted for CommandResult');
      return null;
    },
  };

  const r = validateReferences(cmdArtifact, resolvers);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value.resolved.cmd?.outputShape.name).toBe('CommandResult');
});
```

- [ ] **Step 4.6: Run test to verify it fails**

Run: `pnpm --filter @rntme/bindings test -- test/unit/validate/references.test.ts`
Expected: FAIL — current code calls `resolveShape('CommandResult')`, test throws.

- [ ] **Step 4.7: Bypass resolver in `references.ts`**

Edit `packages/bindings/src/validate/references.ts`. Add import:

```typescript
import { COMMAND_RESULT_SHAPE_NAME, commandResultShape } from '../openapi/command-result.js';
```

Replace the `output.type.kind === 'rowset' || output.type.kind === 'row'` block with:

```typescript
  let outputShape = PLACEHOLDER_SHAPE;
  const { output } = sig;
  if (output.type.kind === 'rowset' || output.type.kind === 'row') {
    if (output.type.shape === COMMAND_RESULT_SHAPE_NAME) {
      outputShape = commandResultShape();
    } else {
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
  }
```

- [ ] **Step 4.8: Run the references test to verify it passes**

Run: `pnpm --filter @rntme/bindings test -- test/unit/validate/references.test.ts`
Expected: PASS.

- [ ] **Step 4.9: Commit**

```bash
git add packages/bindings/src/openapi/command-result.ts \
        packages/bindings/src/validate/references.ts \
        packages/bindings/test/unit/openapi/command-result.test.ts \
        packages/bindings/test/unit/validate/references.test.ts
git commit -m "feat(bindings): reserve CommandResult as built-in output shape"
```

---

## Task 5: Consistency — `kind` × `role` crossover + command output contract

**Files:**
- Modify: `packages/bindings/src/validate/consistency.ts`
- Test: `packages/bindings/test/unit/validate/consistency.test.ts`

Context: Currently `checkGraphShape` in `consistency.ts` requires `output.type.kind === 'rowset'`, otherwise emits `BINDINGS_UNSUPPORTED_OUTPUT_TYPE`. For commands, `row<CommandResult>` is the *only* legal output. So the check must branch on the binding's declared `kind`. Additionally, mismatches between `binding.kind` and `signature.role` must be reported.

- [ ] **Step 5.1: Write the failing tests**

Append to `packages/bindings/test/unit/validate/consistency.test.ts`:

```typescript
import { COMMAND_RESULT_SHAPE_NAME, commandResultShape } from '../../../src/openapi/command-result.js';

const makeCommandResolved = (over: {
  signatureOverrides?: Partial<GraphSignature>;
  entryOverrides?: Partial<ResolvedBinding['entry']>;
} = {}): ResolvedBindings => {
  const baseSig: GraphSignature = {
    id: 'g',
    role: 'command',
    inputs: {
      id: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
      actor: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
    },
    output: { type: { kind: 'row', shape: COMMAND_RESULT_SHAPE_NAME }, from: 'emitX' },
  };
  const signature: GraphSignature = { ...baseSig, ...(over.signatureOverrides ?? {}) };
  const baseEntry = {
    kind: 'command' as const,
    graph: 'g',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'POST' as const,
      path: '/v1/things/{id}/do',
      parameters: [
        { name: 'id', in: 'path' as const, bindTo: 'id', required: true },
        { name: 'actor', in: 'body' as const, bindTo: 'actor', required: true },
      ],
    },
  };
  const entry = { ...baseEntry, ...(over.entryOverrides ?? {}) };
  const binding: ResolvedBinding = {
    entry,
    signature,
    outputShape: commandResultShape(),
  };
  return {
    artifact: {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: { cmd: entry },
    },
    resolved: { cmd: binding },
  } as unknown as ResolvedBindings;
};

it('accepts a well-formed command binding', () => {
  const r = validateConsistency(makeCommandResolved());
  expect(r.ok).toBe(true);
});

it('rejects kind=command on a non-command graph role', () => {
  const r = validateConsistency(
    makeCommandResolved({ signatureOverrides: { role: 'query' } }),
  );
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH')).toBe(true);
});

it('rejects kind=query on a command-role graph', () => {
  const sig: GraphSignature = {
    id: 'g',
    role: 'command',
    inputs: {
      limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
    },
    output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
  };
  // Base query-binding shape with a command-role signature.
  const r = validateConsistency(makeResolved({ signature: sig }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_QUERY_ON_COMMAND_GRAPH')).toBe(true);
});

it('rejects command with output != row<CommandResult>', () => {
  const r = validateConsistency(
    makeCommandResolved({
      signatureOverrides: {
        output: { type: { kind: 'rowset', shape: 'AnythingElse' }, from: 'x' },
      },
    }),
  );
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNSUPPORTED_OUTPUT_TYPE')).toBe(true);
});

it('rejects command with output row<SomeOtherShape>', () => {
  const r = validateConsistency(
    makeCommandResolved({
      signatureOverrides: {
        output: { type: { kind: 'row', shape: 'SomeOtherShape' }, from: 'x' },
      },
    }),
  );
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNSUPPORTED_OUTPUT_TYPE')).toBe(true);
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

Run: `pnpm --filter @rntme/bindings test -- test/unit/validate/consistency.test.ts`
Expected: FAIL — the accept-test fails because current `checkGraphShape` rejects `row<>` outputs; the new error-codes are not emitted.

- [ ] **Step 5.3: Rewrite `checkGraphShape` with a kind/role branch**

Edit `packages/bindings/src/validate/consistency.ts`. Add import:

```typescript
import { COMMAND_RESULT_SHAPE_NAME } from '../openapi/command-result.js';
```

Replace `checkGraphShape` with:

```typescript
function checkGraphShape(
  id: string,
  kind: 'query' | 'command',
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

  const role = signature.role ?? 'query';

  if (kind === 'command' && role !== 'command') {
    errors.push({
      layer: 'consistency',
      code: ERROR_CODES.BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH,
      message: `Binding "${id}" has kind="command" but graph "${signature.id}" has role="${role}"`,
      path: basePath,
    });
    fatal = true;
  }
  if (kind === 'query' && role === 'command') {
    errors.push({
      layer: 'consistency',
      code: ERROR_CODES.BINDINGS_QUERY_ON_COMMAND_GRAPH,
      message: `Binding "${id}" has kind="query" (default) but graph "${signature.id}" has role="command"`,
      path: basePath,
    });
    fatal = true;
  }

  if (kind === 'command') {
    const out = signature.output.type;
    const isCommandResultRow = out.kind === 'row' && out.shape === COMMAND_RESULT_SHAPE_NAME;
    if (!isCommandResultRow) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_UNSUPPORTED_OUTPUT_TYPE,
        message: `Command graph "${signature.id}" must output row<${COMMAND_RESULT_SHAPE_NAME}>, got ${out.kind === 'scalar' ? 'scalar' : `${out.kind}<${out.shape}>`}`,
        path: basePath,
      });
      fatal = true;
    }
  } else {
    if (signature.output.type.kind !== 'rowset') {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.BINDINGS_UNSUPPORTED_OUTPUT_TYPE,
        message: `Graph "${signature.id}" output kind "${signature.output.type.kind}" is not bindable — must be rowset`,
        path: basePath,
      });
      fatal = true;
    }
  }

  return !fatal;
}
```

And update the caller in `validateConsistency`:

```typescript
  for (const [id, binding] of Object.entries(resolved.resolved)) {
    const kind = binding.entry.kind ?? 'query';
    const shapeOk = checkGraphShape(id, kind, binding.signature, errors);
    if (!shapeOk) continue;

    checkParameters(id, binding.entry, binding.signature, errors);
    checkUnbound(id, binding.entry, binding.signature, errors);
  }
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `pnpm --filter @rntme/bindings test -- test/unit/validate/consistency.test.ts`
Expected: PASS.

- [ ] **Step 5.5: Run full package test suite**

Run: `pnpm --filter @rntme/bindings test`
Expected: PASS. (The existing golden test still passes — query-role signatures without an explicit `role` get `role='query'` by default.)

- [ ] **Step 5.6: Commit**

```bash
git add packages/bindings/src/validate/consistency.ts \
        packages/bindings/test/unit/validate/consistency.test.ts
git commit -m "feat(bindings): consistency — kind × role crossover + CommandResult output contract"
```

---

## Task 6: OpenAPI — command response + 409 Conflict

**Files:**
- Modify: `packages/bindings/src/openapi/responses.ts`
- Modify: `packages/bindings/src/openapi/errors.ts`
- Modify: `packages/bindings/src/openapi/emit.ts`
- Test: `packages/bindings/test/unit/openapi/responses.test.ts`
- Test: `packages/bindings/test/unit/openapi/errors.test.ts`
- Test: `packages/bindings/test/unit/openapi/emit.test.ts`

- [ ] **Step 6.1: Rewrite `responses.test.ts`**

The current file has one test calling `successResponse('CategorySalesRow')` with a single argument. Replace the entire file (signature is changing to require a second argument):

```typescript
import { describe, it, expect } from 'vitest';
import { successResponse } from '../../../src/openapi/responses.js';

describe('successResponse', () => {
  it('emits an array schema for rowset outputs', () => {
    const res = successResponse('CategorySalesRow', 'rowset');
    expect(res).toEqual({
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

  it('emits a single-object schema for row outputs', () => {
    const res = successResponse('CommandResult', 'row');
    expect(res).toEqual({
      description: 'OK',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CommandResult' },
        },
      },
    });
  });
});
```

- [ ] **Step 6.2: Run test to verify failure**

Run: `pnpm --filter @rntme/bindings test -- test/unit/openapi/responses.test.ts`
Expected: FAIL — current signature is `successResponse(shapeName: string)`.

- [ ] **Step 6.3: Update `responses.ts`**

Replace `packages/bindings/src/openapi/responses.ts` with:

```typescript
import type { ResponseObject } from '../types/openapi.js';

export type SuccessResponseKind = 'row' | 'rowset';

export function successResponse(
  shapeName: string,
  kind: SuccessResponseKind,
): ResponseObject {
  const ref = { $ref: `#/components/schemas/${shapeName}` };
  return {
    description: 'OK',
    content: {
      'application/json': {
        schema:
          kind === 'row'
            ? ref
            : { type: 'array', items: ref },
      },
    },
  };
}
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `pnpm --filter @rntme/bindings test -- test/unit/openapi/responses.test.ts`
Expected: PASS.

- [ ] **Step 6.5: Write failing test for conflict response**

Append to `packages/bindings/test/unit/openapi/errors.test.ts`:

```typescript
import { conflictResponse, standardErrorResponses, ERROR_RESPONSE_SCHEMA_NAME } from '../../../src/openapi/errors.js';

it('emits a 409 Conflict response for commands', () => {
  expect(conflictResponse()).toEqual({
    description: 'Concurrency conflict. Retry the command.',
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${ERROR_RESPONSE_SCHEMA_NAME}` },
      },
    },
  });
});

it('includes 409 when commandErrors=true', () => {
  const r = standardErrorResponses({ commandErrors: true });
  expect(Object.keys(r).sort()).toEqual(['400', '409', '422', '500']);
});

it('omits 409 by default', () => {
  const r = standardErrorResponses();
  expect(Object.keys(r).sort()).toEqual(['400', '422', '500']);
});
```

- [ ] **Step 6.6: Run failing test**

Run: `pnpm --filter @rntme/bindings test -- test/unit/openapi/errors.test.ts`
Expected: FAIL.

- [ ] **Step 6.7: Update `errors.ts`**

Edit `packages/bindings/src/openapi/errors.ts`. Add `conflictResponse` and a `commandErrors` option:

```typescript
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

export function conflictResponse(): ResponseObject {
  return errorResponse('Concurrency conflict. Retry the command.');
}

export type StandardErrorOptions = { commandErrors?: boolean };

export function standardErrorResponses(
  options: StandardErrorOptions = {},
): Record<string, ResponseObject> {
  const base: Record<string, ResponseObject> = {
    '400': errorResponse('Validation error'),
    '422': errorResponse('Semantic error'),
    '500': errorResponse('Internal error'),
  };
  if (options.commandErrors === true) {
    base['409'] = conflictResponse();
  }
  return base;
}
```

- [ ] **Step 6.8: Run errors tests to verify they pass**

Run: `pnpm --filter @rntme/bindings test -- test/unit/openapi/errors.test.ts`
Expected: PASS.

- [ ] **Step 6.9: Write failing test for end-to-end command emission**

Append to `packages/bindings/test/unit/openapi/emit.test.ts`:

```typescript
import { COMMAND_RESULT_SHAPE_NAME, commandResultJsonSchema, commandResultShape } from '../../../src/openapi/command-result.js';

it('emits a command binding with single-object response + 409 + CommandResult schema', () => {
  const cmdSig: GraphSignature = {
    id: 'assignIssue',
    role: 'command',
    inputs: {
      issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
      assigneeId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
      actor: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
    },
    output: { type: { kind: 'row', shape: COMMAND_RESULT_SHAPE_NAME }, from: 'emitAssign' },
  };

  const cmdEntry = {
    kind: 'command' as const,
    graph: 'assignIssue',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'POST' as const,
      path: '/v1/issues/{issueId}/actions/assign',
      parameters: [
        { name: 'issueId', in: 'path' as const, bindTo: 'issueId', required: true },
        { name: 'assigneeId', in: 'body' as const, bindTo: 'assigneeId', required: true },
        { name: 'actor', in: 'body' as const, bindTo: 'actor', required: true },
      ],
      tags: ['issues'],
      summary: 'Assign an issue',
    },
  };

  const v: ValidatedBindings = {
    artifact: {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: { assignIssue: cmdEntry },
    } as unknown as ValidatedBindings['artifact'],
    resolved: {
      assignIssue: { entry: cmdEntry, signature: cmdSig, outputShape: commandResultShape() },
    },
  } as unknown as ValidatedBindings;

  const cmdResolvers: BindingResolvers = {
    resolveGraphSignature: (id) => (id === 'assignIssue' ? cmdSig : null),
    resolveShape: () => null,
  };

  const r = generateOpenApi(v, cmdResolvers);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const op = r.value.paths['/v1/issues/{issueId}/actions/assign']?.post;
  expect(op?.operationId).toBe('assignIssue');
  expect(op?.responses['200']?.content?.['application/json']?.schema).toEqual({
    $ref: `#/components/schemas/${COMMAND_RESULT_SHAPE_NAME}`,
  });
  expect(Object.keys(op?.responses ?? {}).sort()).toEqual(['200', '400', '409', '422', '500']);
  expect(r.value.components.schemas.CommandResult).toEqual(commandResultJsonSchema());
});
```

- [ ] **Step 6.10: Run emit test to verify failure**

Run: `pnpm --filter @rntme/bindings test -- test/unit/openapi/emit.test.ts`
Expected: FAIL.

- [ ] **Step 6.11: Update `emit.ts` to branch on kind**

Edit `packages/bindings/src/openapi/emit.ts`. Add import:

```typescript
import { COMMAND_RESULT_SHAPE_NAME, commandResultJsonSchema } from './command-result.js';
```

Update `buildOperation` to pass the output kind into `successResponse` and to include the conflict response for commands:

```typescript
function buildOperation(
  id: string,
  binding: ResolvedBinding,
  shapeOptions: ShapeEmitOptions,
  includeStandardErrors: boolean,
): OperationObject {
  const { entry, signature, outputShape } = binding;
  const { http } = entry;
  const kind = entry.kind ?? 'query';
  const outputKind: 'row' | 'rowset' =
    signature.output.type.kind === 'row' ? 'row' : 'rowset';

  const baseParameters: ParameterObject[] = /* unchanged */;

  const requestBody = collectRequestBody(http.parameters, signature.inputs, shapeOptions);

  const responses: Record<string, ResponseObject> = {
    '200': successResponse(outputShape.name, outputKind),
  };
  if (includeStandardErrors) {
    Object.assign(responses, standardErrorResponses({ commandErrors: kind === 'command' }));
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
```

Update `generateOpenApi` to register the `CommandResult` schema when any command binding exists:

```typescript
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

    if ((binding.entry.kind ?? 'query') === 'command') {
      schemas[COMMAND_RESULT_SHAPE_NAME] = commandResultJsonSchema();
    } else {
      schemas[binding.outputShape.name] = shapeToJsonSchema(binding.outputShape, shapeOptions);
    }
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

Rationale: queries continue registering the binding's output shape as before; commands replace that with the reserved `CommandResult` schema. (A command binding's `outputShape` will always be the built-in `CommandResult` shape per Task 4; still, we register the JSON schema from `commandResultJsonSchema()` for a single stable source of truth.)

- [ ] **Step 6.12: Run emit tests to verify all pass**

Run: `pnpm --filter @rntme/bindings test -- test/unit/openapi/emit.test.ts`
Expected: PASS, including the existing query tests (which use rowset outputs).

- [ ] **Step 6.13: Run full package tests**

Run: `pnpm --filter @rntme/bindings test`
Expected: PASS.

- [ ] **Step 6.14: Commit**

```bash
git add packages/bindings/src/openapi/responses.ts \
        packages/bindings/src/openapi/errors.ts \
        packages/bindings/src/openapi/emit.ts \
        packages/bindings/test/unit/openapi/responses.test.ts \
        packages/bindings/test/unit/openapi/errors.test.ts \
        packages/bindings/test/unit/openapi/emit.test.ts
git commit -m "feat(bindings): openapi — command response + 409 Conflict + CommandResult schema"
```

---

## Task 7: Barrel re-exports

**Files:**
- Modify: `packages/bindings/src/index.ts`
- Test: `packages/bindings/test/smoke.test.ts`

- [ ] **Step 7.1: Write the failing smoke test**

Append to `packages/bindings/test/smoke.test.ts` (inside its existing describe block — check and reuse its `describe` label):

```typescript
it('re-exports the CommandResult built-ins', async () => {
  const pkg = await import('../src/index.js');
  expect(pkg.COMMAND_RESULT_SHAPE_NAME).toBe('CommandResult');
  expect(typeof pkg.commandResultShape).toBe('function');
  expect(typeof pkg.commandResultJsonSchema).toBe('function');
  expect(pkg.ERROR_CODES.BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH).toBe('BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH');
});
```

- [ ] **Step 7.2: Run test to verify failure**

Run: `pnpm --filter @rntme/bindings test -- test/smoke.test.ts`
Expected: FAIL — barrel does not export `commandResult*`.

- [ ] **Step 7.3: Update `index.ts` barrel**

Edit `packages/bindings/src/index.ts`. Add these exports:

```typescript
export {
  COMMAND_RESULT_SHAPE_NAME,
  commandResultShape,
  commandResultJsonSchema,
} from './openapi/command-result.js';
```

Also verify that Task 1 already added `BindingKind` and `GraphRole` to the type re-exports — add them if missing.

- [ ] **Step 7.4: Run smoke test to verify pass**

Run: `pnpm --filter @rntme/bindings test -- test/smoke.test.ts`
Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add packages/bindings/src/index.ts packages/bindings/test/smoke.test.ts
git commit -m "feat(bindings): barrel — export CommandResult built-ins + command kind types"
```

---

## Task 8: Golden — `assign-issue` command binding

**Files:**
- Create: `packages/bindings/test/golden/assign-issue/artifact.json`
- Create: `packages/bindings/test/golden/assign-issue/fixtures.ts`
- Create: `packages/bindings/test/golden/assign-issue/expected.openapi.json`
- Create: `packages/bindings/test/golden/assign-issue/assign-issue.test.ts`

This golden proves end-to-end emission for a command binding from the mutations-design spec §4.3 (the `assignIssueSafe` graph, reframed at the binding level).

- [ ] **Step 8.1: Create `artifact.json`**

```json
{
  "version": "1.0",
  "graphSpecRef": "issues.graphs.v1",
  "pdmRef": "issues.domain.v1",
  "qsmRef": "issues.read.v1",
  "openapi": {
    "info": { "title": "Issues API", "version": "1.0.0" },
    "servers": [{ "url": "https://api.example.com" }]
  },
  "bindings": {
    "assignIssue": {
      "kind": "command",
      "graph": "assignIssueSafe",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/v1/issues/{issueId}/actions/assign",
        "tags": ["issues"],
        "summary": "Assign an issue to a user (with capacity guard).",
        "parameters": [
          { "name": "issueId",    "in": "path", "bindTo": "issueId",    "required": true },
          { "name": "assigneeId", "in": "body", "bindTo": "assigneeId", "required": true },
          { "name": "actor",      "in": "body", "bindTo": "actor",      "required": true }
        ]
      }
    }
  }
}
```

- [ ] **Step 8.2: Create `fixtures.ts`**

```typescript
import type {
  BindingResolvers,
  GraphSignature,
  ResolvedShape,
} from '../../../src/types/resolvers.js';

const assignIssueSig: GraphSignature = {
  id: 'assignIssueSafe',
  role: 'command',
  inputs: {
    issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
    assigneeId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
    actor: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
  },
  output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'emitAssign' },
};

export const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'assignIssueSafe' ? assignIssueSig : null),
  // CommandResult is resolved inside @rntme/bindings; no domain shapes needed.
  resolveShape: (_name: string): ResolvedShape | null => null,
};
```

- [ ] **Step 8.3: Create `assign-issue.test.ts`**

Mirror `packages/bindings/test/golden/category-sales/category-sales.test.ts`:

```typescript
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

describe('golden: assign-issue', () => {
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

- [ ] **Step 8.4: Run the test once to materialize the snapshot**

Run: `pnpm --filter @rntme/bindings test -- test/golden/assign-issue/assign-issue.test.ts --update`
Expected: Test passes; `expected.openapi.json` is written by `toMatchFileSnapshot`.

- [ ] **Step 8.5: Review `expected.openapi.json`**

Open the generated `expected.openapi.json` and verify it contains:
- `paths["/v1/issues/{issueId}/actions/assign"].post.operationId === "assignIssue"`;
- `responses` has exactly `"200"`, `"400"`, `"409"`, `"422"`, `"500"` keys;
- `responses["200"].content["application/json"].schema` is `{ "$ref": "#/components/schemas/CommandResult" }` (not an array);
- `components.schemas.CommandResult.required` is `["aggregateId", "version", "eventIds"]`;
- `parameters[0]` is `issueId` in `path`, required;
- `requestBody.content["application/json"].schema.required` contains `"assigneeId"` and `"actor"`.

If any of those differ, **fix the implementation, not the golden**. Once the content is correct, it is fixed in place by `toMatchFileSnapshot` as the canonical expectation.

- [ ] **Step 8.6: Re-run the golden without `--update`**

Run: `pnpm --filter @rntme/bindings test -- test/golden/assign-issue/assign-issue.test.ts`
Expected: PASS.

- [ ] **Step 8.7: Run full package test suite one more time**

Run: `pnpm --filter @rntme/bindings test`
Expected: all tests PASS (including the pre-existing `category-sales` golden — which we deliberately did not change).

- [ ] **Step 8.8: Typecheck**

Run: `pnpm --filter @rntme/bindings typecheck`
Expected: PASS.

- [ ] **Step 8.9: Lint**

Run: `pnpm --filter @rntme/bindings lint`
Expected: PASS.

- [ ] **Step 8.10: Commit**

```bash
git add packages/bindings/test/golden/assign-issue/
git commit -m "test(bindings): golden — assign-issue command binding emits OpenAPI"
```

---

## Scope recap

This plan delivers exactly what mutations-design §7.1 and §7.2 require inside `@rntme/bindings`:

| Spec item | Delivered in |
|---|---|
| `BindingEntry.kind ∈ { "query", "command" }`, default `"query"` | Task 1 + Task 2 |
| `BINDINGS_COMMAND_ON_NON_COMMAND_GRAPH` | Task 1 + Task 5 |
| `BINDINGS_QUERY_ON_COMMAND_GRAPH` | Task 1 + Task 5 |
| `BINDINGS_COMMAND_METHOD_NOT_POST` | Task 1 + Task 3 |
| `BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN` | Task 1 + Task 3 |
| Reserved auto-generated `CommandResult` shape | Task 4 |
| OpenAPI 200 single-object response for commands | Task 6 |
| OpenAPI 409 Conflict for commands | Task 6 |
| End-to-end golden for a command binding | Task 8 |

Out of scope (deferred to downstream plans):
- Updating `demo/issue-tracker-api` / `@rntme/bindings-http` / `@rntme/graph-ir-compiler` to populate `GraphSignature.role` (they keep compiling because `role` is optional).
- Replacing the local `BindingResolvers` contract with PdmResolver/QsmResolver-based constructors (spec §7.7 dep-graph hint; a separate refactor).
- Breaking-change schema evolution of existing bindings (§7.3); MVP stays additive.
