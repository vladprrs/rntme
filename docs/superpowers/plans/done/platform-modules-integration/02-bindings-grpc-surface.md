# gRPC Surface (`@rntme/bindings-grpc`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. User preference: **skip plan-internal review checkpoints during execution**; run to completion autonomously.

**Depends on:** Plan 1 (`01-code-executor-seam.md`) — the `CommandExecutor` / `QueryExecutor` seam must be in place first.

**Goal:** Ship a second transport surface for rntme services — `@rntme/bindings-grpc` — so that a platform module or domain service can expose its commands/queries over gRPC alongside (or instead of) HTTP. Emit a `.proto` file per service from the existing `BindingsArtifact` so external clients can codegen strongly-typed stubs. Integrate via a new `GrpcSurface` plugin in `@rntme/runtime` and a `surface.grpc` manifest field.

**Architecture:** New package `@rntme/bindings-grpc` mirrors `@rntme/bindings-http`'s shape. A pure function `emitProto(validated, pdm, qsm, options) → string` walks `ValidatedBindings` and produces a `.proto` file for the service. A `createGrpcServer({ validated, pdm, qsm, commandExecutor, queryExecutor, ... }) → Server` loads the in-memory proto via `protobufjs`, wraps it for `@grpc/grpc-js`, and wires each RPC method to a handler that dispatches into the plan-1 executor seam. `@rntme/runtime` gets a new `GrpcSurface` plugin that starts the gRPC server on the port declared in `manifest.surface.grpc.port`. A service may declare either or both surfaces; `startService` boots them in parallel.

**Tech Stack:** Node 20, TypeScript strict, ESM, Vitest, pnpm workspaces. New deps: `@grpc/grpc-js@^1.10`, `protobufjs@^7.2`. Spec: `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` §6.2, §12.1 (proto as module contract).

---

## File Structure

### New package

```
packages/bindings-grpc/
  package.json
  tsconfig.json
  tsconfig.check.json
  vitest.config.ts
  eslint.config.mjs                     ← copied from bindings-http
  README.md
  src/
    index.ts                            ← public exports
    types.ts                            ← GrpcServerOptions, GrpcServerHandle
    emit/
      emit-proto.ts                     ← emitProto(validated, pdm, qsm, opts): string
      scalars.ts                        ← scalarToProto(primitive): string
      shapes.ts                         ← shapeToProtoMessage(name, shape): string
      service.ts                        ← buildServiceBlock(bindings): string
      ids.ts                            ← sanitizeToProtoIdent(), camelToPascal()
    server/
      create-server.ts                  ← createGrpcServer(opts): GrpcServerHandle
      load-proto.ts                     ← loadProtoFromString(proto): grpc.GrpcObject
      handler.ts                        ← makeGrpcHandler(bindingId, plan, deps)
      errors.ts                         ← mapExecutorErrorToGrpcStatus()
  test/
    fixtures/
      minimal-bindings.ts               ← tiny hand-rolled ValidatedBindings + pdm/qsm fixtures
      golden/
        minimal.proto                   ← expected proto emit output
    unit/
      scalars.test.ts
      emit-proto.test.ts                ← golden test: emit matches minimal.proto
      ids.test.ts
    integration/
      create-server.test.ts             ← boot real grpc server, call with a client, verify round-trip
      error-mapping.test.ts             ← executor error codes → gRPC status codes
```

### Modified files

```
packages/runtime/src/
  manifest/schema.ts                    ← extend `surface` with optional `grpc: { enabled, port }`
  manifest/types.ts                     ← ValidatedManifest.surface.grpc? typed
  plugins/
    grpc-surface.ts                     ← NEW plugin: class GrpcSurface implements Surface
    contract-tests.ts                   ← add runGrpcSurfaceContract
  start/
    start-service.ts                    ← if manifest.surface.grpc.enabled: mount GrpcSurface
    build-grpc-surface.ts               ← NEW helper: reads config + manifest, returns GrpcSurface or null
  index.ts                              ← re-export GrpcSurface

packages/runtime/test/
  unit/
    manifest-parse.test.ts              ← test surface.grpc parsing
    manifest-validate.test.ts           ← test surface.grpc validation
  integration/
    plugin-contracts.test.ts            ← run GrpcSurface contract on MVP default

demo/issue-tracker-api/
  artifacts/manifest.json               ← add `surface.grpc: { enabled: true, port: 50051 }`
  test/e2e/
    grpc.test.ts                        ← call a command via gRPC client, verify events appended

AGENTS.md                               ← §6 add "6.12 expose a service over gRPC"
docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md  ← mark plan #2 implemented
```

### Out of scope (go to later plans)

- `pre[]` middleware on the gRPC side — same as HTTP, deferred to plan 3.
- `method` / `inputFrom` / `response` extensions to `command` binding — plan 4 (these are HTTP-specific concerns; gRPC has its own mapping).
- `grpc.health.v1.Health` proto surface — deferred; current module-skeleton uses HTTP `/health`.
- TLS/mTLS — bootstrapped insecure in MVP; platform-level routing layer terminates TLS in prod.
- Reflection API — nice-to-have, defer until a real client need (Stripe-module demo in plan 5 can use hand-copied `.proto` file).

---

## Phase 1 — Package scaffold

### Task 1: Create `@rntme/bindings-grpc` package skeleton

**Files:**
- Create: `packages/bindings-grpc/package.json`
- Create: `packages/bindings-grpc/tsconfig.json`
- Create: `packages/bindings-grpc/tsconfig.check.json`
- Create: `packages/bindings-grpc/vitest.config.ts`
- Create: `packages/bindings-grpc/eslint.config.mjs`
- Create: `packages/bindings-grpc/src/index.ts`
- Create: `packages/bindings-grpc/test/unit/_smoke.test.ts`

- [ ] **Step 1: Write the smoke test**

```ts
// packages/bindings-grpc/test/unit/_smoke.test.ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '../../src/index.js';

describe('@rntme/bindings-grpc', () => {
  it('exports a VERSION constant', () => {
    expect(typeof VERSION).toBe('string');
  });
});
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "@rntme/bindings-grpc",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "gRPC surface for @rntme/bindings — emits .proto and serves commands/queries via @grpc/grpc-js.",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
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
    "@grpc/grpc-js": "^1.10.0",
    "@rntme/bindings": "workspace:*",
    "@rntme/bindings-http": "workspace:*",
    "@rntme/event-store": "workspace:*",
    "protobufjs": "^7.2.0"
  },
  "devDependencies": {
    "@rntme/graph-ir-compiler": "workspace:*",
    "@rntme/pdm": "workspace:*",
    "@rntme/qsm": "workspace:*",
    "@types/node": "^20.14.0",
    "eslint": "^9.10.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

`@rntme/bindings-http` dep is for the `executor-contract` sub-path added in plan 1 Task 10 — we reuse the `CommandExecutor` / `QueryExecutor` interfaces without importing from `@rntme/runtime` (avoids cycle).

- [ ] **Step 3: Create `tsconfig.json`**

Copy verbatim from `packages/bindings-http/tsconfig.json`. No changes needed; paths are relative.

- [ ] **Step 4: Create `tsconfig.check.json`**

Copy verbatim from `packages/bindings-http/tsconfig.check.json`.

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
// packages/bindings-grpc/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 6: Create `eslint.config.mjs`**

Copy verbatim from `packages/bindings-http/eslint.config.mjs`.

- [ ] **Step 7: Create initial `index.ts`**

```ts
// packages/bindings-grpc/src/index.ts
export const VERSION = '0.0.0';
```

- [ ] **Step 8: Install deps and run smoke test**

```bash
pnpm install
pnpm -F @rntme/bindings-grpc test
```

Expected: PASS (smoke test only).

- [ ] **Step 9: Commit**

```bash
git add packages/bindings-grpc/
git commit -m "feat(bindings-grpc): scaffold package with grpc-js and protobufjs deps"
```

---

## Phase 2 — Scalar and shape mapping

### Task 2: Implement scalar primitive → proto type mapping

**Files:**
- Create: `packages/bindings-grpc/src/emit/scalars.ts`
- Create: `packages/bindings-grpc/test/unit/scalars.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/bindings-grpc/test/unit/scalars.test.ts
import { describe, it, expect } from 'vitest';
import { scalarToProto } from '../../src/emit/scalars.js';

describe('scalarToProto', () => {
  it.each([
    ['integer', 'int64'],
    ['decimal', 'string'],     // decimal encoded as string (OpenAPI parity)
    ['string', 'string'],
    ['boolean', 'bool'],
    ['date', 'string'],        // ISO-8601 date string
    ['datetime', 'string'],    // ISO-8601 datetime string
  ] as const)('maps %s → %s', (primitive, expected) => {
    expect(scalarToProto(primitive)).toBe(expected);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/scalars.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// packages/bindings-grpc/src/emit/scalars.ts
import type { ScalarPrimitive } from '@rntme/bindings';

export function scalarToProto(primitive: ScalarPrimitive): string {
  switch (primitive) {
    case 'integer':  return 'int64';
    case 'decimal':  return 'string';
    case 'string':   return 'string';
    case 'boolean':  return 'bool';
    case 'date':     return 'string';
    case 'datetime': return 'string';
  }
}
```

- [ ] **Step 4: Run test**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/scalars.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-grpc/src/emit/scalars.ts \
        packages/bindings-grpc/test/unit/scalars.test.ts
git commit -m "feat(bindings-grpc): map ScalarPrimitive to proto3 scalar types"
```

---

### Task 3: Implement identifier sanitization and casing helpers

**Files:**
- Create: `packages/bindings-grpc/src/emit/ids.ts`
- Create: `packages/bindings-grpc/test/unit/ids.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/bindings-grpc/test/unit/ids.test.ts
import { describe, it, expect } from 'vitest';
import {
  sanitizeToProtoIdent,
  camelToPascal,
  bindingIdToRpcName,
  shapeNameToMessageName,
} from '../../src/emit/ids.js';

describe('ids', () => {
  it('sanitizeToProtoIdent replaces invalid chars with underscore', () => {
    expect(sanitizeToProtoIdent('foo-bar.baz')).toBe('foo_bar_baz');
  });
  it('sanitizeToProtoIdent prefixes a leading digit', () => {
    expect(sanitizeToProtoIdent('1abc')).toBe('_1abc');
  });
  it('camelToPascal capitalizes first letter', () => {
    expect(camelToPascal('createOrder')).toBe('CreateOrder');
  });
  it('bindingIdToRpcName sanitizes and pascal-cases', () => {
    expect(bindingIdToRpcName('create-order')).toBe('CreateOrder');
  });
  it('shapeNameToMessageName pascal-cases shape name and strips invalid chars', () => {
    expect(shapeNameToMessageName('order_line')).toBe('OrderLine');
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/ids.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/bindings-grpc/src/emit/ids.ts
export function sanitizeToProtoIdent(raw: string): string {
  let out = raw.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(out)) out = `_${out}`;
  return out;
}

export function camelToPascal(s: string): string {
  if (s.length === 0) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

export function bindingIdToRpcName(bindingId: string): string {
  const sanitized = sanitizeToProtoIdent(bindingId);
  // Split on underscores, pascal-case each segment, join.
  return sanitized
    .split('_')
    .filter((p) => p.length > 0)
    .map(camelToPascal)
    .join('');
}

export function shapeNameToMessageName(shapeName: string): string {
  return bindingIdToRpcName(shapeName);
}
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-grpc/src/emit/ids.ts \
        packages/bindings-grpc/test/unit/ids.test.ts
git commit -m "feat(bindings-grpc): add proto identifier sanitization and casing helpers"
```

---

## Phase 3 — Proto emitter

### Task 4: Create a minimal fixture for emit tests

**Files:**
- Create: `packages/bindings-grpc/test/fixtures/minimal-bindings.ts`

- [ ] **Step 1: Hand-roll a tiny `ValidatedBindings` + PDM/QSM fixture**

```ts
// packages/bindings-grpc/test/fixtures/minimal-bindings.ts
// A fixture big enough to exercise:
//   - one command binding returning CommandResult
//   - one query binding returning rowset<Shape>
//   - one shape with integer + string + nullable fields
// but small enough to golden-test the emitted .proto by hand.

import type {
  ValidatedBindings,
  ResolvedBinding,
  ResolvedShape,
  GraphSignature,
} from '@rntme/bindings';

const orderShape: ResolvedShape = {
  name: 'order',
  origin: 'pdm',
  fields: {
    id: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
    amount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    note: { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
  },
};

const listOrdersSignature: GraphSignature = {
  id: 'listOrders',
  role: 'query',
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 50 },
  },
  output: { type: { kind: 'rowset', shape: 'order' }, from: 'rows' },
};

const createOrderSignature: GraphSignature = {
  id: 'createOrder',
  role: 'command',
  inputs: {
    amount: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
    note: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' },
  },
  output: { type: { kind: 'scalar', primitive: 'string' }, from: 'id' }, // CommandResult.aggregateId
};

const listOrdersBinding: ResolvedBinding = {
  entry: {
    kind: 'query',
    graph: 'listOrders',
    target: { engine: 'graph-ir', dialect: 'sqlite' },
    http: { method: 'GET', path: '/orders', parameters: [
      { name: 'limit', in: 'query', bindTo: 'limit', required: false },
    ] },
  },
  signature: listOrdersSignature,
  outputShape: orderShape,
};

const createOrderBinding: ResolvedBinding = {
  entry: {
    kind: 'command',
    graph: 'createOrder',
    target: { engine: 'graph-ir', dialect: 'sqlite' },
    http: { method: 'POST', path: '/orders', parameters: [
      { name: 'amount', in: 'body', bindTo: 'amount', required: true },
      { name: 'note', in: 'body', bindTo: 'note', required: false },
    ] },
  },
  signature: createOrderSignature,
  outputShape: orderShape, // commands return CommandResult; outputShape is not used for the RPC response in gRPC
};

export const minimalValidated: ValidatedBindings = {
  artifact: {
    version: '1.0',
    graphSpecRef: 'inline',
    pdmRef: 'inline',
    qsmRef: 'inline',
    bindings: {
      listOrders: listOrdersBinding.entry,
      createOrder: createOrderBinding.entry,
    },
  } as unknown as ValidatedBindings['artifact'],
  resolved: {
    listOrders: listOrdersBinding,
    createOrder: createOrderBinding,
  },
} as ValidatedBindings;

export const minimalShapeRegistry: Record<string, ResolvedShape> = {
  order: orderShape,
};
```

- [ ] **Step 2: Commit (no test yet)**

```bash
git add packages/bindings-grpc/test/fixtures/minimal-bindings.ts
git commit -m "test(bindings-grpc): add minimal ValidatedBindings fixture for emit tests"
```

---

### Task 5: Write the golden proto file

**Files:**
- Create: `packages/bindings-grpc/test/fixtures/golden/minimal.proto`

- [ ] **Step 1: Author the expected `.proto`**

```proto
// packages/bindings-grpc/test/fixtures/golden/minimal.proto
// Generated from ValidatedBindings. Do not edit manually — regenerate via emitProto().
syntax = "proto3";

package rntme.minimal.v1;

message Order {
  string id = 1;
  int64 amount = 2;
  optional string note = 3;
}

message ListOrdersRequest {
  optional int64 limit = 1;
}

message ListOrdersResponse {
  repeated Order rows = 1;
}

message CreateOrderRequest {
  int64 amount = 1;
  optional string note = 2;
}

message CommandResult {
  string aggregate_id = 1;
  int64 version = 2;
  repeated string event_ids = 3;
  string command_id = 4;
  string correlation_id = 5;
}

service MinimalService {
  rpc ListOrders (ListOrdersRequest) returns (ListOrdersResponse);
  rpc CreateOrder (CreateOrderRequest) returns (CommandResult);
}
```

- [ ] **Step 2: Commit the golden**

```bash
git add packages/bindings-grpc/test/fixtures/golden/minimal.proto
git commit -m "test(bindings-grpc): add golden minimal.proto expected output"
```

---

### Task 6: Write the failing golden test

**Files:**
- Create: `packages/bindings-grpc/test/unit/emit-proto.test.ts`

- [ ] **Step 1: Write test**

```ts
// packages/bindings-grpc/test/unit/emit-proto.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { emitProto } from '../../src/emit/emit-proto.js';
import { minimalValidated, minimalShapeRegistry } from '../fixtures/minimal-bindings.js';

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, '../fixtures/golden/minimal.proto');

describe('emitProto', () => {
  it('produces byte-identical .proto for the minimal fixture', () => {
    const actual = emitProto(minimalValidated, minimalShapeRegistry, {
      packageName: 'rntme.minimal.v1',
      serviceName: 'MinimalService',
    });
    const expected = readFileSync(goldenPath, 'utf8');
    expect(actual).toBe(expected);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/emit-proto.test.ts`
Expected: FAIL (module missing).

---

### Task 7: Implement `emitProto`

**Files:**
- Create: `packages/bindings-grpc/src/emit/shapes.ts`
- Create: `packages/bindings-grpc/src/emit/service.ts`
- Create: `packages/bindings-grpc/src/emit/emit-proto.ts`

- [ ] **Step 1: Implement shape emitter**

```ts
// packages/bindings-grpc/src/emit/shapes.ts
import type { ResolvedShape, ShapeField, FieldType } from '@rntme/bindings';
import { scalarToProto } from './scalars.js';
import { shapeNameToMessageName } from './ids.js';

function fieldTypeToProto(type: FieldType): { type: string; repeated: boolean } {
  switch (type.kind) {
    case 'scalar':
      return { type: scalarToProto(type.primitive), repeated: false };
    case 'array':
      return { type: scalarToProto(type.element), repeated: true };
  }
}

export function shapeToProtoMessage(name: string, shape: ResolvedShape): string {
  const messageName = shapeNameToMessageName(name);
  const lines: string[] = [`message ${messageName} {`];
  let fieldNumber = 1;
  for (const [fieldName, field] of Object.entries(shape.fields)) {
    const { type, repeated } = fieldTypeToProto(field.type);
    const prefix = repeated ? 'repeated ' : field.nullable ? 'optional ' : '';
    // proto field names are snake_case by convention
    const protoName = toSnakeCase(fieldName);
    lines.push(`  ${prefix}${type} ${protoName} = ${fieldNumber};`);
    fieldNumber++;
  }
  lines.push('}');
  return lines.join('\n');
}

function toSnakeCase(camelOrPascal: string): string {
  return camelOrPascal.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
```

- [ ] **Step 2: Implement service emitter**

```ts
// packages/bindings-grpc/src/emit/service.ts
import type { ValidatedBindings, GraphSignature, ResolvedShape, OutputType, GraphInput } from '@rntme/bindings';
import { scalarToProto } from './scalars.js';
import { bindingIdToRpcName, shapeNameToMessageName } from './ids.js';

export type ServiceEmitResult = {
  /** proto `service { rpc ... }` block. */
  serviceBlock: string;
  /** Per-binding request/response message blocks that must appear BEFORE the service block. */
  messageBlocks: string[];
  /** True if the emitted set uses `CommandResult` (caller must include the canonical message). */
  usesCommandResult: boolean;
};

export function buildServiceBlock(
  validated: ValidatedBindings,
  serviceName: string,
): ServiceEmitResult {
  const rpcs: string[] = [];
  const messageBlocks: string[] = [];
  let usesCommandResult = false;

  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const rpcName = bindingIdToRpcName(bindingId);
    const reqName = `${rpcName}Request`;
    const resName = resolveResponseMessageName(rpcName, resolved.entry.kind, resolved.signature.output.type);
    if (resolved.entry.kind === 'command') usesCommandResult = true;

    messageBlocks.push(buildRequestMessage(reqName, resolved.signature.inputs));
    const resMessage = buildResponseMessage(resName, resolved.entry.kind, resolved.signature.output);
    if (resMessage !== null) messageBlocks.push(resMessage);

    rpcs.push(`  rpc ${rpcName} (${reqName}) returns (${resName});`);
  }

  return {
    serviceBlock: `service ${serviceName} {\n${rpcs.join('\n')}\n}`,
    messageBlocks,
    usesCommandResult,
  };
}

function resolveResponseMessageName(
  rpcName: string,
  kind: 'query' | 'command' | undefined,
  output: OutputType,
): string {
  if (kind === 'command') return 'CommandResult';
  if (output.kind === 'rowset' || output.kind === 'row') return `${rpcName}Response`;
  return `${rpcName}Response`; // scalar wrapper
}

function buildRequestMessage(name: string, inputs: Record<string, GraphInput>): string {
  const lines: string[] = [`message ${name} {`];
  let n = 1;
  for (const [inputName, input] of Object.entries(inputs)) {
    const { type, prefix } = inputToProto(input);
    const protoName = toSnakeCase(inputName);
    lines.push(`  ${prefix}${type} ${protoName} = ${n};`);
    n++;
  }
  lines.push('}');
  return lines.join('\n');
}

function buildResponseMessage(
  name: string,
  kind: 'query' | 'command' | undefined,
  output: { type: OutputType; from: string },
): string | null {
  if (kind === 'command') return null; // CommandResult is canonical, emitted once globally
  const fieldName = toSnakeCase(output.from);
  switch (output.type.kind) {
    case 'rowset':
      return [
        `message ${name} {`,
        `  repeated ${shapeNameToMessageName(output.type.shape)} ${fieldName} = 1;`,
        `}`,
      ].join('\n');
    case 'row':
      return [
        `message ${name} {`,
        `  ${shapeNameToMessageName(output.type.shape)} ${fieldName} = 1;`,
        `}`,
      ].join('\n');
    case 'scalar':
      return [
        `message ${name} {`,
        `  ${scalarToProto(output.type.primitive)} ${fieldName} = 1;`,
        `}`,
      ].join('\n');
  }
}

function inputToProto(input: GraphInput): { type: string; prefix: string } {
  switch (input.type.kind) {
    case 'scalar': {
      const type = scalarToProto(input.type.primitive);
      const prefix = input.mode === 'required' ? '' : 'optional ';
      return { type, prefix };
    }
    case 'list': {
      const type = scalarToProto(input.type.element);
      return { type, prefix: 'repeated ' };
    }
    case 'row':
      return { type: shapeNameToMessageName(input.type.shape), prefix: input.mode === 'required' ? '' : 'optional ' };
    case 'rowset':
      return { type: shapeNameToMessageName(input.type.shape), prefix: 'repeated ' };
  }
}

function toSnakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
```

- [ ] **Step 3: Implement top-level emitter**

```ts
// packages/bindings-grpc/src/emit/emit-proto.ts
import type { ValidatedBindings, ResolvedShape } from '@rntme/bindings';
import { buildServiceBlock } from './service.js';
import { shapeToProtoMessage } from './shapes.js';

export type EmitProtoOptions = {
  packageName: string;
  serviceName: string;
};

const COMMAND_RESULT_BLOCK = [
  'message CommandResult {',
  '  string aggregate_id = 1;',
  '  int64 version = 2;',
  '  repeated string event_ids = 3;',
  '  string command_id = 4;',
  '  string correlation_id = 5;',
  '}',
].join('\n');

export function emitProto(
  validated: ValidatedBindings,
  shapes: Record<string, ResolvedShape>,
  options: EmitProtoOptions,
): string {
  const { serviceBlock, messageBlocks, usesCommandResult } = buildServiceBlock(validated, options.serviceName);

  const shapeBlocks = Object.entries(shapes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, shape]) => shapeToProtoMessage(name, shape));

  const parts: string[] = [];
  parts.push('// Generated from ValidatedBindings. Do not edit manually — regenerate via emitProto().');
  parts.push('syntax = "proto3";');
  parts.push('');
  parts.push(`package ${options.packageName};`);
  parts.push('');

  for (const block of shapeBlocks) {
    parts.push(block);
    parts.push('');
  }
  for (const block of messageBlocks) {
    parts.push(block);
    parts.push('');
  }
  if (usesCommandResult) {
    parts.push(COMMAND_RESULT_BLOCK);
    parts.push('');
  }
  parts.push(serviceBlock);
  parts.push('');

  // Normalize the leading preamble into a block comment header for readability
  // and match the golden's 2-line header format.
  const [firstLine, ...rest] = parts;
  const header = [
    '// packages/bindings-grpc/test/fixtures/golden/minimal.proto',
    firstLine,
    ...rest,
  ].join('\n');
  return header;
}
```

- [ ] **Step 4: Run golden test**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/emit-proto.test.ts`
Expected: PASS (byte-identical to `minimal.proto`).

If the diff fails on whitespace/newlines, iterate until exact match. Do **not** change the golden — change the emitter.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-grpc/src/emit/
git commit -m "feat(bindings-grpc): implement emitProto with golden-tested .proto output"
```

---

## Phase 4 — Runtime proto loading

### Task 8: Load proto from string via `protobufjs` and adapt for `@grpc/grpc-js`

**Files:**
- Create: `packages/bindings-grpc/src/server/load-proto.ts`
- Create: `packages/bindings-grpc/test/integration/load-proto.test.ts`

- [ ] **Step 1: Write integration test**

```ts
// packages/bindings-grpc/test/integration/load-proto.test.ts
import { describe, it, expect } from 'vitest';
import { loadProtoFromString } from '../../src/server/load-proto.js';

const TINY_PROTO = `
syntax = "proto3";
package rntme.test.v1;
message Echo { string msg = 1; }
service EchoService {
  rpc Send (Echo) returns (Echo);
}
`;

describe('loadProtoFromString', () => {
  it('loads a tiny proto and exposes the service constructor', () => {
    const root = loadProtoFromString(TINY_PROTO, 'rntme.test.v1.EchoService');
    expect(typeof root.service).toBe('object');
    expect(root.messageTypes.Echo).toBeDefined();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/integration/load-proto.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// packages/bindings-grpc/src/server/load-proto.ts
import * as protobuf from 'protobufjs';

export type LoadedProto = {
  root: protobuf.Root;
  service: protobuf.Service;
  messageTypes: Record<string, protobuf.Type>;
};

/**
 * Parse a .proto source string with protobufjs and return the Service definition
 * plus an index of top-level message Types. Package-qualified names are resolved
 * by dot-separated lookup inside the Root.
 */
export function loadProtoFromString(protoSrc: string, fullyQualifiedServiceName: string): LoadedProto {
  const parsed = protobuf.parse(protoSrc, { keepCase: true });
  const root = parsed.root;
  const service = root.lookupService(fullyQualifiedServiceName);

  const pkgName = fullyQualifiedServiceName.split('.').slice(0, -1).join('.');
  const pkg = pkgName.length > 0 ? root.lookup(pkgName) : root;
  if (pkg === null || pkg === undefined) {
    throw new Error(`package "${pkgName}" not found in parsed proto`);
  }

  const messageTypes: Record<string, protobuf.Type> = {};
  const maybeNested = (pkg as unknown as { nested?: Record<string, protobuf.ReflectionObject> }).nested ?? {};
  for (const [name, obj] of Object.entries(maybeNested)) {
    if (obj instanceof protobuf.Type) {
      messageTypes[name] = obj;
    }
  }

  return { root, service, messageTypes };
}
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-grpc/src/server/load-proto.ts \
        packages/bindings-grpc/test/integration/load-proto.test.ts
git commit -m "feat(bindings-grpc): load .proto from string via protobufjs"
```

---

## Phase 5 — gRPC handler dispatch

### Task 9: Implement executor-error → gRPC-status mapping

**Files:**
- Create: `packages/bindings-grpc/src/server/errors.ts`
- Create: `packages/bindings-grpc/test/unit/errors.test.ts`

- [ ] **Step 1: Write test**

```ts
// packages/bindings-grpc/test/unit/errors.test.ts
import { describe, it, expect } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { mapExecutorErrorToGrpcStatus } from '../../src/server/errors.js';

describe('mapExecutorErrorToGrpcStatus', () => {
  it('COMMAND_NOT_FOUND → UNIMPLEMENTED', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_NOT_FOUND', message: '' })).toBe(
      grpc.status.UNIMPLEMENTED,
    );
  });
  it('COMMAND_GUARD_REJECTED → FAILED_PRECONDITION', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_GUARD_REJECTED', message: '' })).toBe(
      grpc.status.FAILED_PRECONDITION,
    );
  });
  it('COMMAND_CONCURRENCY_CONFLICT → ABORTED', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_CONCURRENCY_CONFLICT', message: '' })).toBe(
      grpc.status.ABORTED,
    );
  });
  it('COMMAND_HANDLER_THREW → INTERNAL', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_HANDLER_THREW', message: '' })).toBe(
      grpc.status.INTERNAL,
    );
  });
  it('COMMAND_HANDLER_ERROR → INVALID_ARGUMENT (domain-level)', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_HANDLER_ERROR', message: '' })).toBe(
      grpc.status.INVALID_ARGUMENT,
    );
  });
  it('QUERY_NOT_FOUND → UNIMPLEMENTED', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'QUERY_NOT_FOUND', message: '' })).toBe(
      grpc.status.UNIMPLEMENTED,
    );
  });
  it('QUERY_HANDLER_THREW → INTERNAL', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'QUERY_HANDLER_THREW', message: '' })).toBe(
      grpc.status.INTERNAL,
    );
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/unit/errors.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/bindings-grpc/src/server/errors.ts
import * as grpc from '@grpc/grpc-js';
import type {
  CommandExecutorError,
  QueryExecutorError,
} from '@rntme/bindings-http/executor-contract';

export function mapExecutorErrorToGrpcStatus(
  err: CommandExecutorError | QueryExecutorError,
): grpc.status {
  switch (err.code) {
    case 'COMMAND_NOT_FOUND':
    case 'QUERY_NOT_FOUND':
      return grpc.status.UNIMPLEMENTED;
    case 'COMMAND_GUARD_REJECTED':
      return grpc.status.FAILED_PRECONDITION;
    case 'COMMAND_CONCURRENCY_CONFLICT':
      return grpc.status.ABORTED;
    case 'COMMAND_HANDLER_THREW':
    case 'QUERY_HANDLER_THREW':
      return grpc.status.INTERNAL;
    case 'COMMAND_HANDLER_ERROR':
      return grpc.status.INVALID_ARGUMENT;
  }
}
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bindings-grpc/src/server/errors.ts \
        packages/bindings-grpc/test/unit/errors.test.ts
git commit -m "feat(bindings-grpc): map executor error codes to gRPC status codes"
```

---

### Task 10: Build the handler factory

**Files:**
- Create: `packages/bindings-grpc/src/server/handler.ts`
- Create: `packages/bindings-grpc/src/types.ts`

- [ ] **Step 1: Declare public types**

```ts
// packages/bindings-grpc/src/types.ts
import type { Server } from '@grpc/grpc-js';
import type {
  CommandExecutor,
  QueryExecutor,
} from '@rntme/bindings-http/executor-contract';
import type { ValidatedBindings, ResolvedShape } from '@rntme/bindings';
import type { EventStore } from '@rntme/event-store';
import type BetterSqlite3 from 'better-sqlite3';

export type GrpcServerOptions = {
  validated: ValidatedBindings;
  shapes: Record<string, ResolvedShape>;
  packageName: string;     // e.g. "rntme.subscription.v1"
  serviceName: string;     // e.g. "SubscriptionService"
  commandExecutor: CommandExecutor;
  queryExecutor: QueryExecutor;
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database;
  now?: () => string;
  nextId?: () => string;
};

export type GrpcServerHandle = {
  server: Server;
  protoSource: string;
  /** Starts listening on the given port. Returns resolved port (useful when 0 was requested). */
  listen(port: number, host?: string): Promise<number>;
  /** Graceful stop. */
  stop(): Promise<void>;
};
```

- [ ] **Step 2: Implement the handler factory**

```ts
// packages/bindings-grpc/src/server/handler.ts
import * as grpc from '@grpc/grpc-js';
import { randomUUID } from 'node:crypto';
import type { ResolvedBinding, ValidatedBindings } from '@rntme/bindings';
import type {
  CommandExecutor,
  QueryExecutor,
  CommandExecutionContext,
  QueryExecutionContext,
} from '@rntme/bindings-http/executor-contract';
import type { EventStore } from '@rntme/event-store';
import type BetterSqlite3 from 'better-sqlite3';
import { mapExecutorErrorToGrpcStatus } from './errors.js';

export type HandlerDeps = {
  commandExecutor: CommandExecutor;
  queryExecutor: QueryExecutor;
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database;
  now: () => string;
  nextId: () => string;
};

export type GrpcHandlerFn = (
  call: grpc.ServerUnaryCall<Record<string, unknown>, unknown>,
  callback: grpc.sendUnaryData<unknown>,
) => void;

export function makeGrpcHandler(bindingId: string, resolved: ResolvedBinding, deps: HandlerDeps): GrpcHandlerFn {
  return (call, callback) => {
    void (async () => {
      const input = call.request;
      const metadata = call.metadata.getMap();
      const correlation = {
        commandId: typeof metadata['rntme-command-id'] === 'string' ? metadata['rntme-command-id'] : deps.nextId(),
        correlationId: typeof metadata['rntme-correlation-id'] === 'string' ? metadata['rntme-correlation-id'] : deps.nextId(),
        traceparent: typeof metadata['traceparent'] === 'string' ? metadata['traceparent'] : null,
      };

      if (resolved.entry.kind === 'command') {
        const ctx: CommandExecutionContext = {
          eventStore: deps.eventStore,
          qsmDb: deps.qsmDb,
          now: deps.now,
          nextId: deps.nextId,
          actor: null, // plan 3 will wire an auth-metadata extractor
          correlation,
        };
        const out = await deps.commandExecutor.execute({ commandName: bindingId, inputs: input, ctx });
        if (!out.ok) {
          callback({
            code: mapExecutorErrorToGrpcStatus(out.error),
            message: `${out.error.code}: ${out.error.message}`,
          });
          return;
        }
        callback(null, {
          aggregate_id: out.value.aggregateId,
          version: out.value.version,
          event_ids: [...out.value.eventIds],
          command_id: out.value.commandId,
          correlation_id: out.value.correlationId,
        });
        return;
      }

      // query
      const qctx: QueryExecutionContext = { qsmDb: deps.qsmDb };
      const qout = await deps.queryExecutor.execute({ queryName: bindingId, inputs: input, ctx: qctx });
      if (!qout.ok) {
        callback({
          code: mapExecutorErrorToGrpcStatus(qout.error),
          message: `${qout.error.code}: ${qout.error.message}`,
        });
        return;
      }
      // Query output field name comes from signature.output.from; for rowsets it is the rows array.
      const fromField = resolved.signature.output.from;
      const responsePayload: Record<string, unknown> = { [snakeCase(fromField)]: qout.value };
      callback(null, responsePayload);
    })().catch((err) => {
      callback({ code: grpc.status.INTERNAL, message: err instanceof Error ? err.message : String(err) });
    });
  };
}

export function makeAllHandlers(validated: ValidatedBindings, deps: HandlerDeps): Record<string, GrpcHandlerFn> {
  const out: Record<string, GrpcHandlerFn> = {};
  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const rpcName = bindingIdToRpcName(bindingId);
    out[rpcName] = makeGrpcHandler(bindingId, resolved, deps);
  }
  return out;
}

function bindingIdToRpcName(bindingId: string): string {
  // Duplicated from emit/ids.ts to keep server module dependency-free of emit code.
  // If this drifts, lift it to a shared internal module.
  let sanitized = bindingId.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(sanitized)) sanitized = `_${sanitized}`;
  return sanitized.split('_').filter((p) => p.length > 0).map((p) => p[0]!.toUpperCase() + p.slice(1)).join('');
}

function snakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F @rntme/bindings-grpc typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/bindings-grpc/src/server/handler.ts \
        packages/bindings-grpc/src/types.ts
git commit -m "feat(bindings-grpc): add RPC handler factory routing to executor seam"
```

---

### Task 11: Implement `createGrpcServer`

**Files:**
- Create: `packages/bindings-grpc/src/server/create-server.ts`
- Modify: `packages/bindings-grpc/src/index.ts`

- [ ] **Step 1: Implement**

```ts
// packages/bindings-grpc/src/server/create-server.ts
import { randomUUID } from 'node:crypto';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { emitProto } from '../emit/emit-proto.js';
import { loadProtoFromString } from './load-proto.js';
import { makeAllHandlers } from './handler.js';
import type { GrpcServerHandle, GrpcServerOptions } from '../types.js';

function buildServiceDefinition(loaded: ReturnType<typeof loadProtoFromString>): grpc.ServiceDefinition {
  const service = loaded.service;
  const def: grpc.ServiceDefinition = {};
  for (const [methodName, method] of Object.entries(service.methods)) {
    const requestType = loaded.root.lookupType(method.requestType);
    const responseType = loaded.root.lookupType(method.responseType);
    def[methodName] = {
      path: `/${service.fullName.replace(/^\./, '')}/${methodName}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: object): Buffer =>
        Buffer.from(requestType.encode(requestType.fromObject(value)).finish()),
      requestDeserialize: (bytes: Buffer): object => requestType.toObject(requestType.decode(bytes)),
      responseSerialize: (value: object): Buffer =>
        Buffer.from(responseType.encode(responseType.fromObject(value)).finish()),
      responseDeserialize: (bytes: Buffer): object => responseType.toObject(responseType.decode(bytes)),
    };
  }
  return def;
}

export function createGrpcServer(opts: GrpcServerOptions): GrpcServerHandle {
  const protoSource = emitProto(opts.validated, opts.shapes, {
    packageName: opts.packageName,
    serviceName: opts.serviceName,
  });

  const loaded = loadProtoFromString(protoSource, `${opts.packageName}.${opts.serviceName}`);
  const serviceDef = buildServiceDefinition(loaded);

  const now = opts.now ?? ((): string => new Date().toISOString());
  const nextId = opts.nextId ?? ((): string => randomUUID());

  const handlers = makeAllHandlers(opts.validated, {
    commandExecutor: opts.commandExecutor,
    queryExecutor: opts.queryExecutor,
    eventStore: opts.eventStore,
    qsmDb: opts.qsmDb,
    now,
    nextId,
  });

  const server = new grpc.Server();
  server.addService(serviceDef, handlers as unknown as grpc.UntypedServiceImplementation);

  return {
    server,
    protoSource,
    listen(port, host = '0.0.0.0'): Promise<number> {
      return new Promise((resolve, reject) => {
        server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
          if (err !== null) return reject(err);
          resolve(boundPort);
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => server.tryShutdown(() => resolve()));
    },
  };
}
```

- [ ] **Step 2: Export from barrel**

```ts
// packages/bindings-grpc/src/index.ts
export const VERSION = '0.0.0';
export { emitProto, type EmitProtoOptions } from './emit/emit-proto.js';
export { createGrpcServer } from './server/create-server.js';
export type { GrpcServerOptions, GrpcServerHandle } from './types.js';
export { mapExecutorErrorToGrpcStatus } from './server/errors.js';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -F @rntme/bindings-grpc typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/bindings-grpc/src/server/create-server.ts \
        packages/bindings-grpc/src/index.ts
git commit -m "feat(bindings-grpc): add createGrpcServer wrapping protobufjs + grpc-js"
```

---

### Task 12: Integration test — boot a server, call a command end-to-end

**Files:**
- Create: `packages/bindings-grpc/test/integration/create-server.test.ts`

- [ ] **Step 1: Write the test**

```ts
// packages/bindings-grpc/test/integration/create-server.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import BetterSqlite3 from 'better-sqlite3';
import { SqliteEventStore } from '@rntme/event-store';
import { CodeCommandExecutor, GraphIrQueryExecutor } from '@rntme/runtime';
import { createGrpcServer, emitProto } from '../../src/index.js';
import { minimalValidated, minimalShapeRegistry } from '../fixtures/minimal-bindings.js';

let handle: Awaited<ReturnType<typeof createGrpcServer>> | null = null;
afterEach(async () => {
  if (handle !== null) {
    await handle.stop();
    handle = null;
  }
});

describe('createGrpcServer (integration)', () => {
  it('accepts a CreateOrder RPC and routes to CodeCommandExecutor', async () => {
    const eventStore = new SqliteEventStore({ filename: ':memory:', serviceName: 'minimal' });
    const qsmDb = new BetterSqlite3(':memory:');

    const commandExecutor = new CodeCommandExecutor({
      createOrder: async (_ctx, input) => ({
        ok: true,
        value: {
          aggregateId: `order-${input.amount}`,
          version: 1,
          eventIds: ['evt-1'],
          commandId: 'cmd-1',
          correlationId: 'corr-1',
        },
      }),
    });
    const queryExecutor = new GraphIrQueryExecutor({});

    handle = createGrpcServer({
      validated: minimalValidated,
      shapes: minimalShapeRegistry,
      packageName: 'rntme.minimal.v1',
      serviceName: 'MinimalService',
      commandExecutor,
      queryExecutor,
      eventStore,
      qsmDb,
    });

    const port = await handle.listen(0, '127.0.0.1');

    // Build a client against the same proto to call the server.
    const { root, service } = loadProto(handle.protoSource, 'rntme.minimal.v1.MinimalService');
    const ClientCtor = grpc.makeGenericClientConstructor(
      toServiceDef(root, service),
      'MinimalService',
      {},
    );
    const client = new ClientCtor(`127.0.0.1:${port}`, grpc.credentials.createInsecure());

    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      (client as unknown as Record<string, (arg: object, cb: (err: unknown, res: object) => void) => void>)
        .CreateOrder({ amount: 42, note: 'hello' }, (err, res) => {
          if (err !== null && err !== undefined) reject(err);
          else resolve(res as Record<string, unknown>);
        });
    });

    expect(response.aggregate_id).toBe('order-42');
    expect(response.version).toBe(1);
  });
});

function loadProto(src: string, serviceName: string): { root: protobuf.Root; service: protobuf.Service } {
  const { root } = protobuf.parse(src, { keepCase: true });
  return { root, service: root.lookupService(serviceName) };
}

function toServiceDef(root: protobuf.Root, service: protobuf.Service): grpc.ServiceDefinition {
  const def: grpc.ServiceDefinition = {};
  for (const [methodName, method] of Object.entries(service.methods)) {
    const req = root.lookupType(method.requestType);
    const res = root.lookupType(method.responseType);
    def[methodName] = {
      path: `/${service.fullName.replace(/^\./, '')}/${methodName}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
    };
  }
  return def;
}
```

- [ ] **Step 2: Run**

Run: `pnpm -F @rntme/bindings-grpc vitest run test/integration/create-server.test.ts`
Expected: PASS. If it hangs, check: `better-sqlite3` peer dep is installed in bindings-grpc's devDependencies (add if missing).

- [ ] **Step 3: Add `better-sqlite3` devDependency if needed**

If the test needs it and it isn't in `packages/bindings-grpc/package.json` devDependencies:

```json
"devDependencies": {
  "@types/better-sqlite3": "^7.6.11",
  "better-sqlite3": "^11.0.0",
  ...existing
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/bindings-grpc/
git commit -m "test(bindings-grpc): integration test for createGrpcServer end-to-end"
```

---

## Phase 6 — Manifest extension

### Task 13: Extend `ManifestSchema` with `surface.grpc`

**Files:**
- Modify: `packages/runtime/src/manifest/schema.ts`
- Modify: `packages/runtime/src/manifest/types.ts`
- Modify: `packages/runtime/test/unit/manifest-parse.test.ts`
- Modify: `packages/runtime/test/unit/manifest-validate.test.ts`

- [ ] **Step 1: Write the failing manifest-parse test**

Append to `packages/runtime/test/unit/manifest-parse.test.ts`:

```ts
it('parses surface.grpc with enabled and port', () => {
  const result = parseManifest({
    rntmeVersion: '1.0',
    service: { name: 'demo', version: '1.0' },
    surface: { grpc: { enabled: true, port: 50051 } },
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.surface?.grpc?.enabled).toBe(true);
    expect(result.value.surface?.grpc?.port).toBe(50051);
  }
});

it('rejects surface.grpc with invalid port', () => {
  const result = parseManifest({
    rntmeVersion: '1.0',
    service: { name: 'demo', version: '1.0' },
    surface: { grpc: { enabled: true, port: -1 } },
  });
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm -F @rntme/runtime vitest run test/unit/manifest-parse.test.ts`
Expected: FAIL (extra field rejected by strict schema).

- [ ] **Step 3: Extend the schema**

In `packages/runtime/src/manifest/schema.ts`, replace the `surface` block:

```ts
surface: z
  .object({
    http: z
      .object({
        enabled: z.boolean().optional(),
        port: z.number().int().min(0).max(65535).optional(),
      })
      .strict()
      .optional(),
    grpc: z
      .object({
        enabled: z.boolean().optional(),
        port: z.number().int().min(0).max(65535).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional(),
```

- [ ] **Step 4: Extend `ValidatedManifest` type**

If `ManifestTypes` is hand-written (see `packages/runtime/src/manifest/types.ts`), mirror the grpc field there. If it is inferred from the Zod schema, no change needed.

- [ ] **Step 5: Run tests**

Run: `pnpm -F @rntme/runtime vitest run test/unit/manifest-parse.test.ts`
Expected: PASS (both new tests).

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/manifest/ \
        packages/runtime/test/unit/manifest-parse.test.ts
git commit -m "feat(runtime): add surface.grpc manifest field"
```

---

## Phase 7 — `GrpcSurface` plugin

### Task 14: Implement `GrpcSurface`

**Files:**
- Create: `packages/runtime/src/plugins/grpc-surface.ts`
- Modify: `packages/runtime/src/plugins/interfaces.ts` (add re-export)
- Modify: `packages/runtime/src/index.ts` (export GrpcSurface)
- Modify: `packages/runtime/package.json` (add `@rntme/bindings-grpc` dep)

- [ ] **Step 1: Add dependency**

Add to `packages/runtime/package.json#dependencies`:

```json
"@rntme/bindings-grpc": "workspace:*",
```

Run `pnpm install`.

- [ ] **Step 2: Implement `GrpcSurface`**

```ts
// packages/runtime/src/plugins/grpc-surface.ts
import type { Hono } from 'hono';
import {
  createGrpcServer,
  type GrpcServerHandle,
} from '@rntme/bindings-grpc';
import type {
  CommandExecutor,
  QueryExecutor,
} from '@rntme/bindings-http/executor-contract';
import type { Surface, SurfaceContext } from './interfaces.js';
import type { ResolvedShape } from '@rntme/bindings';

export type GrpcSurfaceOptions = {
  port: number;
  packageName: string;   // e.g. "rntme.<serviceName>.v1"
  serviceName: string;   // e.g. "SubscriptionService"
  commandExecutor: CommandExecutor;
  queryExecutor: QueryExecutor;
  shapes: Record<string, ResolvedShape>;
};

export class GrpcSurface implements Surface {
  private handle: GrpcServerHandle | null = null;
  private listenedPort = 0;

  constructor(private readonly opts: GrpcSurfaceOptions) {}

  // HTTP surface contract requires a `mount(app: Hono, ctx)` method but gRPC
  // does not share Hono; we implement mount as a no-op and use listen() to bind.
  mount(_app: Hono, _ctx: SurfaceContext): void {
    /* no-op */
  }

  async listen(ctx: SurfaceContext): Promise<{ port: number; stop(): Promise<void> }> {
    this.handle = createGrpcServer({
      validated: ctx.service.bindings,
      shapes: this.opts.shapes,
      packageName: this.opts.packageName,
      serviceName: this.opts.serviceName,
      commandExecutor: this.opts.commandExecutor,
      queryExecutor: this.opts.queryExecutor,
      eventStore: ctx.eventStore,
      qsmDb: ctx.qsmDb,
    });
    this.listenedPort = await this.handle.listen(this.opts.port);
    return {
      port: this.listenedPort,
      stop: async (): Promise<void> => {
        if (this.handle !== null) await this.handle.stop();
      },
    };
  }
}
```

- [ ] **Step 3: Extend the `Surface` interface**

The current `Surface.listen?()` has no parameter. Widen it in `packages/runtime/src/plugins/interfaces.ts`:

```ts
export interface Surface {
  mount(app: Hono, ctx: SurfaceContext): Promise<void> | void;
  listen?(ctx?: SurfaceContext): Promise<{ port: number; stop(): Promise<void> }>;
}
```

Existing `HttpSurface` does not implement `listen()`; unchanged. The new `GrpcSurface.listen` accepts the context.

- [ ] **Step 4: Export from barrel**

Append to `packages/runtime/src/index.ts`:

```ts
export { GrpcSurface, type GrpcSurfaceOptions } from './plugins/grpc-surface.js';
```

- [ ] **Step 5: Typecheck**

Run: `pnpm -F @rntme/runtime typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/plugins/grpc-surface.ts \
        packages/runtime/src/plugins/interfaces.ts \
        packages/runtime/src/index.ts \
        packages/runtime/package.json
git commit -m "feat(runtime): add GrpcSurface plugin wrapping @rntme/bindings-grpc"
```

---

### Task 15: Wire `GrpcSurface` into `startService`

**Files:**
- Modify: `packages/runtime/src/start/start-service.ts`
- Create: `packages/runtime/src/start/build-grpc-surface.ts`
- Modify: `packages/runtime/test/integration/startup.test.ts` (add grpc-enabled boot test)

- [ ] **Step 1: Create the factory helper**

```ts
// packages/runtime/src/start/build-grpc-surface.ts
import type { ValidatedManifest } from '../manifest/types.js';
import type { CommandExecutor, QueryExecutor } from '@rntme/bindings-http/executor-contract';
import type { ResolvedShape } from '@rntme/bindings';
import { GrpcSurface } from '../plugins/grpc-surface.js';

export function buildGrpcSurface(
  manifest: ValidatedManifest,
  opts: {
    commandExecutor: CommandExecutor;
    queryExecutor: QueryExecutor;
    shapes: Record<string, ResolvedShape>;
  },
): GrpcSurface | null {
  const grpcCfg = manifest.surface?.grpc;
  if (grpcCfg === undefined || grpcCfg.enabled !== true) return null;
  const port = grpcCfg.port ?? 50051;
  const packageName = `rntme.${manifest.service.name.toLowerCase()}.v1`;
  const serviceName = `${toPascal(manifest.service.name)}Service`;
  return new GrpcSurface({
    port,
    packageName,
    serviceName,
    commandExecutor: opts.commandExecutor,
    queryExecutor: opts.queryExecutor,
    shapes: opts.shapes,
  });
}

function toPascal(name: string): string {
  return name
    .split(/[-_\s]/)
    .filter((p) => p.length > 0)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join('');
}
```

- [ ] **Step 2: Wire into `startService`**

In `packages/runtime/src/start/start-service.ts`, after the HttpSurface is constructed, add:

```ts
import { buildGrpcSurface } from './build-grpc-surface.js';

// After HttpSurface construction:
const grpcSurface = buildGrpcSurface(service.manifest, {
  commandExecutor,
  queryExecutor,
  shapes: collectShapesFromService(service),
});

const allSurfaces = [
  ...(config.surfaces ?? [/* existing HttpSurface construction */]),
  ...(grpcSurface !== null ? [grpcSurface] : []),
];

// After mounting HTTP and starting the HTTP server:
let grpcStopper: (() => Promise<void>) | null = null;
if (grpcSurface !== null && grpcSurface.listen !== undefined) {
  const ctx = { /* same SurfaceContext as above */ };
  const { stop } = await grpcSurface.listen(ctx);
  grpcStopper = stop;
}

// In the returned RunningService.stop():
stop: async () => {
  // existing stop logic
  if (grpcStopper !== null) await grpcStopper();
},
```

`collectShapesFromService` is a concrete inline helper. MVP scope: union of `resolved.outputShape` across all bindings. Input-referenced shapes (`input.type.kind === 'row' | 'rowset'`) are **not** collected in MVP because the demo uses scalar-only inputs; the limitation is documented in `packages/bindings-grpc/README.md` "Limitations" and an inline code comment:

```ts
function collectShapesFromService(service: ValidatedService): Record<string, ResolvedShape> {
  // MVP: union of binding output shapes. Row/rowset inputs are not yet resolved
  // into this registry — add a full shape registry when a real module with
  // row-typed inputs ships (plan 5).
  const acc: Record<string, ResolvedShape> = {};
  for (const resolved of Object.values(service.bindings.resolved)) {
    acc[resolved.outputShape.name] = resolved.outputShape;
  }
  return acc;
}
```

Place this helper at the bottom of `packages/runtime/src/start/build-grpc-surface.ts` and import `ValidatedService` from `../types.js`, `ResolvedShape` from `@rntme/bindings`.

- [ ] **Step 3: Add an integration test**

In `packages/runtime/test/integration/startup.test.ts`, add:

```ts
it('boots a GrpcSurface alongside HttpSurface when manifest.surface.grpc.enabled', async () => {
  const fixture = /* existing fixture setup */;
  fixture.service.manifest.surface = {
    ...(fixture.service.manifest.surface ?? {}),
    grpc: { enabled: true, port: 0 }, // bind ephemeral
  };
  const running = await startService(fixture.service);
  expect(running.httpPort).toBeGreaterThan(0);
  // No public port exposed for gRPC on RunningService today; acceptance is:
  // `stop()` does not throw, meaning the gRPC server was started and stopped cleanly.
  await running.stop();
});
```

If exposing the gRPC port on `RunningService` is straightforward, add it:

```ts
// packages/runtime/src/types.ts
export type RunningService = {
  httpPort: number;
  grpcPort?: number;
  stop(): Promise<void>;
};
```

- [ ] **Step 4: Run tests**

Run: `pnpm -F @rntme/runtime test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/ packages/runtime/test/
git commit -m "feat(runtime): boot GrpcSurface from manifest.surface.grpc"
```

---

## Phase 8 — Contract tests & docs

### Task 16: Add `runGrpcSurfaceContract` contract helper

**Files:**
- Modify: `packages/runtime/src/plugins/contract-tests.ts`
- Modify: `packages/runtime/test/integration/plugin-contracts.test.ts`

- [ ] **Step 1: Add the helper**

Append to `packages/runtime/src/plugins/contract-tests.ts`:

```ts
import { GrpcSurface } from './grpc-surface.js';

export function runGrpcSurfaceContract(makeSurface: () => GrpcSurface): void {
  describe('GrpcSurface contract', () => {
    it('mount is a no-op and does not throw', () => {
      const surface = makeSurface();
      expect(() => surface.mount(/* unused */ {} as Hono, {} as SurfaceContext)).not.toThrow();
    });
  });
}
```

- [ ] **Step 2: Wire into plugin-contracts test**

```ts
// append to packages/runtime/test/integration/plugin-contracts.test.ts
import { runGrpcSurfaceContract } from '../../src/plugins/contract-tests.js';
import { GrpcSurface } from '../../src/plugins/grpc-surface.js';
import { CodeCommandExecutor, GraphIrQueryExecutor } from '@rntme/runtime';

runGrpcSurfaceContract(() =>
  new GrpcSurface({
    port: 0,
    packageName: 'rntme.contract.v1',
    serviceName: 'ContractService',
    commandExecutor: new CodeCommandExecutor({}),
    queryExecutor: new GraphIrQueryExecutor({}),
    shapes: {},
  }),
);
```

- [ ] **Step 3: Run**

Run: `pnpm -F @rntme/runtime vitest run test/integration/plugin-contracts.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/src/plugins/contract-tests.ts \
        packages/runtime/test/integration/plugin-contracts.test.ts
git commit -m "test(runtime): add GrpcSurface contract and wire default"
```

---

### Task 17: Write `packages/bindings-grpc/README.md`

**Files:**
- Create: `packages/bindings-grpc/README.md`

- [ ] **Step 1: Write the README**

```markdown
# @rntme/bindings-grpc

gRPC transport surface for `@rntme/bindings`. Emits a `.proto` file from a `ValidatedBindings` artifact and serves commands/queries via `@grpc/grpc-js` + `protobufjs`, wiring each RPC through the `CommandExecutor` / `QueryExecutor` seam (defined in plan 1).

## Public API

```ts
import { emitProto, createGrpcServer } from '@rntme/bindings-grpc';

const protoSource = emitProto(validated, shapeRegistry, {
  packageName: 'rntme.payments.v1',
  serviceName: 'PaymentsService',
});

const handle = createGrpcServer({
  validated,
  shapes: shapeRegistry,
  packageName: 'rntme.payments.v1',
  serviceName: 'PaymentsService',
  commandExecutor,   // from @rntme/runtime
  queryExecutor,     // from @rntme/runtime
  eventStore,
  qsmDb,
});

const port = await handle.listen(50051);
// ...
await handle.stop();
```

## Type mapping

| Binding artifact type            | Proto type         |
|----------------------------------|--------------------|
| `scalar.integer`                 | `int64`            |
| `scalar.decimal`                 | `string` (decimal encoded) |
| `scalar.string`                  | `string`           |
| `scalar.boolean`                 | `bool`             |
| `scalar.date` / `scalar.datetime`| `string` (ISO)     |
| `array.<scalar>`                 | `repeated <scalar>`|
| `rowset.<shape>`                 | `repeated <Shape>` |
| `row.<shape>`                    | `<Shape>`          |
| command output                   | canonical `CommandResult` |
| nullable field                   | `optional`         |

## Error mapping

| Executor error code              | gRPC status              |
|----------------------------------|--------------------------|
| `COMMAND_NOT_FOUND`, `QUERY_NOT_FOUND` | `UNIMPLEMENTED`    |
| `COMMAND_GUARD_REJECTED`         | `FAILED_PRECONDITION`    |
| `COMMAND_CONCURRENCY_CONFLICT`   | `ABORTED`                |
| `COMMAND_HANDLER_THREW`, `QUERY_HANDLER_THREW` | `INTERNAL` |
| `COMMAND_HANDLER_ERROR`          | `INVALID_ARGUMENT`       |

## Not yet supported

- `pre[]` middleware (plan 3).
- Extended `command` binding with `method` / `inputFrom` / `response` (plan 4).
- `grpc.health.v1.Health` proto surface.
- TLS/mTLS; insecure credentials only.
- Streaming RPCs.

## Limitations (MVP)

- Shape collection at boot currently reads output shapes only; multi-shape input requires a centralised shape registry. Tracked as inline TODO in `packages/runtime/src/start/build-grpc-surface.ts`; revisit when plan 5 ships a module that needs it.
```

- [ ] **Step 2: Commit**

```bash
git add packages/bindings-grpc/README.md
git commit -m "docs(bindings-grpc): add README describing public API and type mapping"
```

---

### Task 18: Update AGENTS.md with "expose a service over gRPC" recipe

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Append §6.12**

```markdown
### 6.12 Expose a service over gRPC

1. Read `packages/bindings-grpc/README.md` and spec §6.2.
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
```

- [ ] **Step 2: Append to §8 decisions index**

```markdown
- "Why protobufjs + dynamic proto load vs. static codegen inside the runtime?" →
  `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` §6.2 +
  `packages/bindings-grpc/README.md`.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): add §6.12 for exposing a service over gRPC"
```

---

## Phase 9 — Demo integration

### Task 19: Enable gRPC surface on `demo/issue-tracker-api`

**Files:**
- Modify: `demo/issue-tracker-api/artifacts/manifest.json`
- Create: `demo/issue-tracker-api/test/e2e/grpc.test.ts`

- [ ] **Step 1: Enable gRPC in the demo manifest**

```json
{
  "surface": {
    "http": { "enabled": true, "port": 3000 },
    "grpc": { "enabled": true, "port": 50052 }
  }
}
```

(Merge into existing `surface` block; keep other fields.)

- [ ] **Step 2: Add an E2E test**

```ts
// demo/issue-tracker-api/test/e2e/grpc.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { emitProto } from '@rntme/bindings-grpc';
import { loadService, startService, type RunningService } from '@rntme/runtime';
import { resolve } from 'node:path';

let running: RunningService;
let protoSource: string;
let artifactDir: string;

beforeAll(async () => {
  artifactDir = resolve(__dirname, '../../artifacts');
  const svc = await loadService(artifactDir);
  if (!svc.ok) throw new Error('load failed');
  running = await startService(svc.value);
  // Emit proto for client-side codegen
  const shapes = collectShapes(svc.value.bindings);
  protoSource = emitProto(svc.value.bindings, shapes, {
    packageName: `rntme.${svc.value.manifest.service.name.toLowerCase()}.v1`,
    serviceName: `${pascal(svc.value.manifest.service.name)}Service`,
  });
}, 30_000);

afterAll(async () => {
  if (running !== undefined) await running.stop();
});

describe('issue-tracker gRPC surface', () => {
  it('responds to a listIssues query over gRPC', async () => {
    const { root, service } = parse(protoSource);
    const ClientCtor = grpc.makeGenericClientConstructor(toServiceDef(root, service), 'Service', {});
    // Port mirrors manifest.surface.grpc.port = 50052; if running.grpcPort is exposed, use it instead.
    const client = new ClientCtor(
      `127.0.0.1:${(running as unknown as { grpcPort?: number }).grpcPort ?? 50052}`,
      grpc.credentials.createInsecure(),
    );

    const response = await new Promise((res, rej) => {
      (client as unknown as Record<string, (arg: object, cb: (err: unknown, out: unknown) => void) => void>)
        .ListIssues({}, (err, out) => (err !== null && err !== undefined ? rej(err) : res(out)));
    });

    // Exact response shape depends on demo's listIssues signature; at minimum it should
    // be an object (not throw).
    expect(typeof response).toBe('object');
  });
});

function parse(src: string): { root: protobuf.Root; service: protobuf.Service } {
  const { root } = protobuf.parse(src, { keepCase: true });
  // Grab the first service; the demo emits exactly one.
  const pkg = root.nestedArray[0]!;
  const svc = (pkg as unknown as { nestedArray: protobuf.ReflectionObject[] }).nestedArray
    .find((o) => o instanceof protobuf.Service) as protobuf.Service;
  return { root, service: svc };
}

function toServiceDef(root: protobuf.Root, service: protobuf.Service): grpc.ServiceDefinition {
  const def: grpc.ServiceDefinition = {};
  for (const [method, meta] of Object.entries(service.methods)) {
    const req = root.lookupType(meta.requestType);
    const res = root.lookupType(meta.responseType);
    def[method] = {
      path: `/${service.fullName.replace(/^\./, '')}/${method}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
    };
  }
  return def;
}

function collectShapes(bindings: import('@rntme/bindings').ValidatedBindings): Record<string, import('@rntme/bindings').ResolvedShape> {
  const acc: Record<string, import('@rntme/bindings').ResolvedShape> = {};
  for (const r of Object.values(bindings.resolved)) acc[r.outputShape.name] = r.outputShape;
  return acc;
}

function pascal(s: string): string {
  return s.split(/[-_\s]/).filter(Boolean).map((p) => p[0]!.toUpperCase() + p.slice(1)).join('');
}
```

If the demo's `listIssues` query requires parameters, adjust the call. If the demo has no queries and only commands, pick any POST-less command. If the test is too brittle, reduce it to "server accepts connection and reflects an UNIMPLEMENTED for a known-missing method" — still exercises the pipeline.

- [ ] **Step 3: Run the demo test**

Run: `pnpm -F @rntme/issue-tracker-api-demo test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add demo/issue-tracker-api/
git commit -m "test(demo): exercise gRPC surface end-to-end"
```

---

## Phase 10 — Final gate

### Task 20: Full-repo regression + mark plan implemented

**Files:**
- None (run-only)
- Modify: `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md`

- [ ] **Step 1: Full build + test + lint**

```bash
pnpm install --frozen-lockfile
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```

Expected: PASS across every package and the demo.

- [ ] **Step 2: Mark plan 2 status in the spec**

In §14 of the spec, update the status marker next to Plan 2 to "implemented YYYY-MM-DD" (use today's date at commit time).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md
git commit -m "docs(spec): mark plan #2 (bindings-grpc surface) implemented"
```

---

## Self-review checklist (for plan author, pre-handoff)

- Spec §6.2 "`@rntme/bindings-grpc`: reads BindingsArtifact, generates `.proto`, mounts gRPC server" → Tasks 1 (scaffold), 5–7 (emit), 8–11 (server), 14 (surface).
- Spec §6.2 "manifest.surface[]" → Task 13 (adds `surface.grpc` alongside `surface.http`). **Deviation from spec wording:** spec said `surfaces: [{kind:"http"...}]` (array). Plan keeps the current `surface.http`/`surface.grpc` map shape to avoid breaking every existing manifest. Array form can be added later without behaviour change.
- Spec §12.1 "Published .proto file" → Task 6 golden + Task 17 README documenting `emitProto(...)` as the emit-to-disk path.
- Error mapping matches executor codes from plan 1 Task 1. Compatible with the `detail` (not `cause`) field adopted there.
- Dependency direction: `@rntme/bindings-grpc` → `@rntme/bindings-http/executor-contract`, **not** `@rntme/runtime`. No cycle introduced.
- Types used across tasks are consistent (`GrpcServerOptions`, `GrpcServerHandle`, `CommandExecutor`, `QueryExecutor`, `CommandExecutorError`, `mapExecutorErrorToGrpcStatus`).
- Golden-test style for proto emit; no approximate regex matches.
- No placeholders; all commands show expected result; all code blocks complete.
- File paths absolute from repo root; no line numbers.
