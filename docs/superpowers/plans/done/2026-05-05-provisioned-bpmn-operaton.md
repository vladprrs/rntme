# Provisioned BPMN / Operaton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Supersession note (2026-05-06):** Tasks and snippets below that add
> `commands.handlersModule`, `services/*/commands/handlers.mjs`,
> `CodeCommandExecutor`, `GraphIrCommandExecutor`, or command-kind binding
> assumptions are superseded by
> `docs/superpowers/specs/2026-05-06-graph-ir-effect-operations-design.md`.
> Workflow service tasks now target action-exposed Graph IR operations, and
> domain-service behavior stays in operation graphs.

**Goal:** Add a first-class project-level BPMN workflow artifact, validate it through a new `@rntme/workflows` package, deploy it with provisioned Operaton plus a BPMN worker, and prove it with a new order-fulfillment demo.

**Architecture:** `@rntme/workflows` owns parse/structural/cross-ref validation and branded types. `@rntme/blueprint` discovers `workflows/` and supplies PDM event + project binding context. Deploy planning renders provisioned Redpanda, Operaton, and a separate `bpmn-worker` workload; runtime services stay service-local and communicate through Kafka events plus gRPC command bindings.

**Tech Stack:** TypeScript strict ESM, Zod v4, Vitest, pnpm workspaces, dependency-cruiser, SQLite/QSM, KafkaJS-compatible event bus, gRPC command bindings, Dokploy render/apply adapter.

---

## Scope Split

The spec crosses several packages. Keep the implementation as one PR only if each task below lands as a small commit. If execution stalls, split after Task 3: tasks 1-3 are artifact/blueprint validation, tasks 4-6 are deploy/worker infrastructure, tasks 7-9 are demo/docs/smoke.

## File Structure

Create:

- `packages/artifacts/workflows/package.json` - workspace package metadata.
- `packages/artifacts/workflows/tsconfig.json` - build config.
- `packages/artifacts/workflows/tsconfig.check.json` - test/typecheck config.
- `packages/artifacts/workflows/README.md` - package contract and where-to-look-first guide.
- `packages/artifacts/workflows/src/index.ts` - public exports.
- `packages/artifacts/workflows/src/types/artifact.ts` - authoring and branded workflow types.
- `packages/artifacts/workflows/src/types/context.ts` - cross-ref context interfaces supplied by blueprint/deploy tests.
- `packages/artifacts/workflows/src/types/result.ts` - `Result`, error codes, helpers.
- `packages/artifacts/workflows/src/parse/schema.ts` - Zod schema.
- `packages/artifacts/workflows/src/parse/parse.ts` - JSON/string parser.
- `packages/artifacts/workflows/src/validate/structural.ts` - PDM-free rules.
- `packages/artifacts/workflows/src/validate/cross-ref.ts` - event/binding/BPMN-file checks via context.
- `packages/artifacts/workflows/src/validate/index.ts` - aggregate validator.
- `packages/artifacts/workflows/test/unit/*.test.ts` - package unit tests.
- `packages/artifacts/blueprint/src/compose/project-workflows.ts` - blueprint discovery/context bridge.
- `packages/deploy/deploy-core/src/workflows.ts` - target-neutral workflow planning helpers.
- `packages/deploy/deploy-dokploy/src/workflow-render.ts` - Operaton compose + worker rendering helpers.
- `packages/runtime/bpmn-worker/` - new runtime package for Kafka/Operaton/gRPC bridge.
- `demo/order-fulfillment-blueprint/` - new demo blueprint.

Modify:

- `packages/artifacts/blueprint/package.json` - add `@rntme/workflows`.
- `packages/artifacts/blueprint/src/types/artifact.ts` - include validated workflows on `ComposedBlueprint`.
- `packages/artifacts/blueprint/src/types/result.ts` - add `BLUEPRINT_WORKFLOWS_INVALID`.
- `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts` - load workflows after binding registry exists.
- `packages/artifacts/blueprint/src/index.ts` - keep public exports stable; do not export workflow discovery unless another package imports it.
- `packages/deploy/deploy-core/package.json` - add `@rntme/workflows`.
- `packages/deploy/deploy-core/src/composed-project.ts` - add deploy-relevant workflow input shape.
- `packages/deploy/deploy-core/src/config.ts` - add workflow engine/worker config.
- `packages/deploy/deploy-core/src/errors.ts` - add workflow plan errors.
- `packages/deploy/deploy-core/src/plan.ts` - include workflow engine infrastructure and worker workload.
- `packages/deploy/deploy-core/src/index.ts` - export workflow plan types.
- `packages/deploy/deploy-dokploy/src/render.ts` - include Operaton/worker resources.
- `packages/deploy/deploy-dokploy/src/apply.ts` - resource ordering and apply-result kind coverage.
- `packages/deploy/deploy-dokploy/src/errors.ts` - workflow render/apply errors when a new failure mode is introduced.
- `apps/platform-http/src/deploy/*` - pass workflow artifacts through executor and add smoke checks.
- `README.md`, `AGENTS.md`, package READMEs, demo README - documentation touch.

---

### Task 1: Scaffold `@rntme/workflows`

**Files:**
- Create: `packages/artifacts/workflows/package.json`
- Create: `packages/artifacts/workflows/tsconfig.json`
- Create: `packages/artifacts/workflows/tsconfig.check.json`
- Create: `packages/artifacts/workflows/src/index.ts`
- Create: `packages/artifacts/workflows/src/types/artifact.ts`
- Create: `packages/artifacts/workflows/src/types/context.ts`
- Create: `packages/artifacts/workflows/src/types/result.ts`
- Create: `packages/artifacts/workflows/README.md`
- Test: `packages/artifacts/workflows/test/unit/result.test.ts`

- [x] **Step 1: Add package metadata**

Create `packages/artifacts/workflows/package.json`:

```json
{
  "name": "@rntme/workflows",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Project-level workflow artifact parser and validator for BPMN/Operaton mappings.",
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
    "zod": "^4.0.0"
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

- [x] **Step 2: Add TypeScript configs**

Create `packages/artifacts/workflows/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

Create `packages/artifacts/workflows/tsconfig.check.json`:

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

- [x] **Step 3: Define artifact and context types**

Create `packages/artifacts/workflows/src/types/artifact.ts`:

```ts
export type WorkflowVersion = 1;

export type WorkflowEventRef = {
  readonly service: string;
  readonly aggregateType: string;
  readonly eventType: string;
};

export type WorkflowDefinition = {
  readonly id: string;
  readonly bpmnFile: string;
  readonly processId: string;
};

export type WorkflowMappingValue =
  | string
  | number
  | boolean
  | null
  | readonly WorkflowMappingValue[]
  | { readonly [key: string]: WorkflowMappingValue };

export type WorkflowMessageStart = {
  readonly id: string;
  readonly definition: string;
  readonly messageName: string;
  readonly event: WorkflowEventRef;
  readonly businessKey: string;
  readonly variables?: Readonly<Record<string, WorkflowMappingValue>>;
};

export type WorkflowServiceTask = {
  readonly definition: string;
  readonly taskId: string;
  readonly bindingRef: string;
  readonly input?: Readonly<Record<string, WorkflowMappingValue>>;
  readonly resultVariable?: string;
};

export type WorkflowArtifact = {
  readonly workflowVersion: WorkflowVersion;
  readonly definitions: readonly WorkflowDefinition[];
  readonly messageStarts: readonly WorkflowMessageStart[];
  readonly serviceTasks: readonly WorkflowServiceTask[];
};

declare const StructurallyValidBrand: unique symbol;
declare const ValidatedBrand: unique symbol;

export type StructurallyValidWorkflows = WorkflowArtifact & {
  readonly [StructurallyValidBrand]: true;
};

export type ValidatedWorkflows = StructurallyValidWorkflows & {
  readonly [ValidatedBrand]: true;
};
```

Create `packages/artifacts/workflows/src/types/context.ts`:

```ts
import type { WorkflowEventRef } from './artifact.js';

export type WorkflowEventResolution = {
  readonly service: string;
  readonly aggregateType: string;
  readonly eventType: string;
};

export type WorkflowBindingResolution = {
  readonly service: string;
  readonly bindingId: string;
  readonly qualifiedId: string;
  readonly kind?: 'query' | 'command';
  readonly method?: 'GET' | 'POST';
  readonly path?: string;
};

export type WorkflowCrossRefContext = {
  readonly services: readonly string[];
  readonly fileExists?: (relativePath: string) => boolean;
  readonly resolveEvent: (ref: WorkflowEventRef) => WorkflowEventResolution | null;
  readonly resolveBindingRef: (ref: string) => WorkflowBindingResolution | null;
};
```

- [x] **Step 4: Define result helpers and error codes**

Create `packages/artifacts/workflows/src/types/result.ts`:

```ts
export type Layer = 'parse' | 'structural' | 'cross-ref' | 'internal';

export type WorkflowError = {
  readonly layer: Layer;
  readonly code: WorkflowErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly hint?: string;
};

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err = { readonly ok: false; readonly errors: readonly WorkflowError[] };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = (errors: readonly WorkflowError[]): Err => ({ ok: false, errors });
export const isOk = <T>(r: Result<T>): r is Ok<T> => r.ok;
export const isErr = <T>(r: Result<T>): r is Err => !r.ok;

export const ERROR_CODES = {
  WORKFLOWS_PARSE_SCHEMA_VIOLATION: 'WORKFLOWS_PARSE_SCHEMA_VIOLATION',
  WORKFLOWS_STRUCT_DEFINITION_ID_DUPLICATE: 'WORKFLOWS_STRUCT_DEFINITION_ID_DUPLICATE',
  WORKFLOWS_STRUCT_BPMN_FILE_DUPLICATE: 'WORKFLOWS_STRUCT_BPMN_FILE_DUPLICATE',
  WORKFLOWS_STRUCT_MESSAGE_START_ID_DUPLICATE: 'WORKFLOWS_STRUCT_MESSAGE_START_ID_DUPLICATE',
  WORKFLOWS_STRUCT_SERVICE_TASK_ID_DUPLICATE: 'WORKFLOWS_STRUCT_SERVICE_TASK_ID_DUPLICATE',
  WORKFLOWS_STRUCT_UNKNOWN_DEFINITION: 'WORKFLOWS_STRUCT_UNKNOWN_DEFINITION',
  WORKFLOWS_STRUCT_MAPPING_PATH_INVALID: 'WORKFLOWS_STRUCT_MAPPING_PATH_INVALID',
  WORKFLOWS_XREF_EVENT_UNKNOWN_SERVICE: 'WORKFLOWS_XREF_EVENT_UNKNOWN_SERVICE',
  WORKFLOWS_XREF_EVENT_UNKNOWN_AGGREGATE: 'WORKFLOWS_XREF_EVENT_UNKNOWN_AGGREGATE',
  WORKFLOWS_XREF_EVENT_UNKNOWN_TYPE: 'WORKFLOWS_XREF_EVENT_UNKNOWN_TYPE',
  WORKFLOWS_XREF_BINDING_REF_UNKNOWN: 'WORKFLOWS_XREF_BINDING_REF_UNKNOWN',
  WORKFLOWS_XREF_BINDING_NOT_COMMAND: 'WORKFLOWS_XREF_BINDING_NOT_COMMAND',
  WORKFLOWS_XREF_BINDING_SERVICE_MISMATCH: 'WORKFLOWS_XREF_BINDING_SERVICE_MISMATCH',
  WORKFLOWS_XREF_BPMN_FILE_MISSING: 'WORKFLOWS_XREF_BPMN_FILE_MISSING',
} as const;

export type WorkflowErrorCode = keyof typeof ERROR_CODES;
```

- [x] **Step 5: Add public exports**

Create `packages/artifacts/workflows/src/index.ts`:

```ts
export type {
  WorkflowArtifact,
  WorkflowDefinition,
  WorkflowEventRef,
  WorkflowMappingValue,
  WorkflowMessageStart,
  WorkflowServiceTask,
  StructurallyValidWorkflows,
  ValidatedWorkflows,
} from './types/artifact.js';
export type {
  WorkflowBindingResolution,
  WorkflowCrossRefContext,
  WorkflowEventResolution,
} from './types/context.js';
export {
  ERROR_CODES,
  err,
  isErr,
  isOk,
  ok,
  type Result,
  type WorkflowError,
  type WorkflowErrorCode,
} from './types/result.js';
```

- [x] **Step 6: Add README skeleton**

Create `packages/artifacts/workflows/README.md`:

```md
# @rntme/workflows

Project-level workflow artifact parser and validator for BPMN/Operaton mappings.

## Role in the system

- Depends on: `zod`.
- Consumed by: `@rntme/blueprint` for project composition; `@rntme/deploy-core` for deployment planning.
- Position in pipeline: `workflows/workflows.json` + BPMN files -> parse -> structural validation -> cross-reference validation -> `ValidatedWorkflows`.

## Public API

- `parseWorkflowArtifact(raw)`
- `validateWorkflowStructural(artifact)`
- `validateWorkflowCrossRef(artifact, ctx)`
- `validateWorkflows(artifact, ctx)`
- `ERROR_CODES`, `ok`, `err`, `isOk`, `isErr`

## Where to look first

- `src/parse/schema.ts`
- `src/validate/structural.ts`
- `src/validate/cross-ref.ts`
- `test/unit/`

## Specs

- `../../../docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`
```

- [x] **Step 7: Add and run result helper test**

Create `packages/artifacts/workflows/test/unit/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, err, isErr, isOk, ok } from '../../src/index.js';

describe('workflow result helpers', () => {
  it('construct and inspect ok/err results', () => {
    const good = ok({ value: 1 });
    expect(isOk(good)).toBe(true);
    expect(isErr(good)).toBe(false);

    const bad = err([
      {
        layer: 'parse',
        code: ERROR_CODES.WORKFLOWS_PARSE_SCHEMA_VIOLATION,
        message: 'bad',
      },
    ]);
    expect(isErr(bad)).toBe(true);
    expect(bad.errors[0]?.code).toBe('WORKFLOWS_PARSE_SCHEMA_VIOLATION');
  });
});
```

Run: `pnpm -F @rntme/workflows test -- test/unit/result.test.ts`

Expected before parse/validate implementation: PASS for result test.

- [x] **Step 8: Build and commit scaffold**

Run:

```bash
pnpm -F @rntme/workflows typecheck
pnpm -F @rntme/workflows lint
```

Expected: both commands exit 0.

Commit:

```bash
git add packages/artifacts/workflows
git commit -m "feat(workflows): scaffold workflow artifact package"
```

---

### Task 2: Implement Workflow Parse And Structural Validation

**Files:**
- Create: `packages/artifacts/workflows/src/parse/schema.ts`
- Create: `packages/artifacts/workflows/src/parse/parse.ts`
- Create: `packages/artifacts/workflows/src/validate/structural.ts`
- Create: `packages/artifacts/workflows/src/validate/index.ts`
- Modify: `packages/artifacts/workflows/src/index.ts`
- Test: `packages/artifacts/workflows/test/unit/parse.test.ts`
- Test: `packages/artifacts/workflows/test/unit/validate-structural.test.ts`

- [x] **Step 1: Write parse tests**

Create `packages/artifacts/workflows/test/unit/parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseWorkflowArtifact } from '../../src/index.js';

const valid = {
  workflowVersion: 1,
  definitions: [{ id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' }],
  messageStarts: [
    {
      id: 'orderPlaced',
      definition: 'orderFulfillment',
      messageName: 'OrderPlaced',
      event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      businessKey: '$event.data.orderId',
      variables: { orderId: '$event.data.orderId' },
    },
  ],
  serviceTasks: [
    {
      definition: 'orderFulfillment',
      taskId: 'reserveStock',
      bindingRef: 'inventory.reserveStock',
      input: { orderId: '$process.orderId' },
      resultVariable: 'reservation',
    },
  ],
};

describe('parseWorkflowArtifact', () => {
  it('parses a valid object', () => {
    const result = parseWorkflowArtifact(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.definitions[0]?.id).toBe('orderFulfillment');
  });

  it('parses a JSON string', () => {
    const result = parseWorkflowArtifact(JSON.stringify(valid));
    expect(result.ok).toBe(true);
  });

  it('rejects unknown fields', () => {
    const result = parseWorkflowArtifact({ ...valid, extra: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('WORKFLOWS_PARSE_SCHEMA_VIOLATION');
      expect(result.errors[0]?.path).toBeDefined();
    }
  });

  it('rejects unsupported workflowVersion', () => {
    const result = parseWorkflowArtifact({ ...valid, workflowVersion: 2 });
    expect(result.ok).toBe(false);
  });
});
```

Run: `pnpm -F @rntme/workflows test -- test/unit/parse.test.ts`

Expected: FAIL with missing `parseWorkflowArtifact` export.

- [x] **Step 2: Implement schema and parser**

Create `packages/artifacts/workflows/src/parse/schema.ts`:

```ts
import { z } from 'zod';

const nonEmptyString = z.string().min(1);

const eventRefSchema = z
  .object({
    service: nonEmptyString,
    aggregateType: nonEmptyString,
    eventType: nonEmptyString,
  })
  .strict();

export const workflowMappingValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(workflowMappingValueSchema),
    z.record(nonEmptyString, workflowMappingValueSchema),
  ]),
);

const definitionSchema = z
  .object({
    id: nonEmptyString,
    bpmnFile: nonEmptyString,
    processId: nonEmptyString,
  })
  .strict();

const messageStartSchema = z
  .object({
    id: nonEmptyString,
    definition: nonEmptyString,
    messageName: nonEmptyString,
    event: eventRefSchema,
    businessKey: nonEmptyString,
    variables: z.record(nonEmptyString, workflowMappingValueSchema).optional(),
  })
  .strict();

const serviceTaskSchema = z
  .object({
    definition: nonEmptyString,
    taskId: nonEmptyString,
    bindingRef: nonEmptyString,
    input: z.record(nonEmptyString, workflowMappingValueSchema).optional(),
    resultVariable: nonEmptyString.optional(),
  })
  .strict();

export const WorkflowArtifactSchema = z
  .object({
    workflowVersion: z.literal(1),
    definitions: z.array(definitionSchema),
    messageStarts: z.array(messageStartSchema).default([]),
    serviceTasks: z.array(serviceTaskSchema).default([]),
  })
  .strict();
```

Create `packages/artifacts/workflows/src/parse/parse.ts`:

```ts
import { WorkflowArtifactSchema } from './schema.js';
import type { WorkflowArtifact } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type Result, type WorkflowError } from '../types/result.js';

export function parseWorkflowArtifact(input: unknown): Result<WorkflowArtifact> {
  let candidate: unknown = input;

  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input) as unknown;
    } catch (e) {
      return err([
        {
          layer: 'parse',
          code: ERROR_CODES.WORKFLOWS_PARSE_SCHEMA_VIOLATION,
          message: e instanceof Error ? e.message : 'invalid JSON',
        },
      ]);
    }
  }

  const parsed = WorkflowArtifactSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors: WorkflowError[] = parsed.error.issues.map((issue) => {
      const base = {
        layer: 'parse' as const,
        code: ERROR_CODES.WORKFLOWS_PARSE_SCHEMA_VIOLATION,
        message: issue.message,
      };
      return issue.path.length > 0 ? { ...base, path: issue.path.join('.') } : base;
    });
    return err(errors);
  }

  return ok(parsed.data as WorkflowArtifact);
}
```

Update `packages/artifacts/workflows/src/index.ts`:

```ts
export { parseWorkflowArtifact } from './parse/parse.js';
export type {
  WorkflowArtifact,
  WorkflowDefinition,
  WorkflowEventRef,
  WorkflowMappingValue,
  WorkflowMessageStart,
  WorkflowServiceTask,
  StructurallyValidWorkflows,
  ValidatedWorkflows,
} from './types/artifact.js';
export type {
  WorkflowBindingResolution,
  WorkflowCrossRefContext,
  WorkflowEventResolution,
} from './types/context.js';
export {
  ERROR_CODES,
  err,
  isErr,
  isOk,
  ok,
  type Result,
  type WorkflowError,
  type WorkflowErrorCode,
} from './types/result.js';
```

- [x] **Step 3: Verify parse tests pass**

Run: `pnpm -F @rntme/workflows test -- test/unit/parse.test.ts`

Expected: PASS.

- [x] **Step 4: Write structural validation tests**

Create `packages/artifacts/workflows/test/unit/validate-structural.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseWorkflowArtifact, validateWorkflowStructural } from '../../src/index.js';

function artifact(overrides: Record<string, unknown> = {}) {
  return {
    workflowVersion: 1,
    definitions: [{ id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' }],
    messageStarts: [
      {
        id: 'orderPlaced',
        definition: 'orderFulfillment',
        messageName: 'OrderPlaced',
        event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
        businessKey: '$event.data.orderId',
        variables: { orderId: '$event.data.orderId' },
      },
    ],
    serviceTasks: [
      {
        definition: 'orderFulfillment',
        taskId: 'reserveStock',
        bindingRef: 'inventory.reserveStock',
        input: { orderId: '$process.orderId' },
        resultVariable: 'reservation',
      },
    ],
    ...overrides,
  };
}

function parseValid(raw: unknown) {
  const parsed = parseWorkflowArtifact(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

describe('validateWorkflowStructural', () => {
  it('accepts a structurally valid artifact', () => {
    const result = validateWorkflowStructural(parseValid(artifact()));
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate definition ids', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          definitions: [
            { id: 'orderFulfillment', bpmnFile: 'a.bpmn', processId: 'a' },
            { id: 'orderFulfillment', bpmnFile: 'b.bpmn', processId: 'b' },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.code)).toContain('WORKFLOWS_STRUCT_DEFINITION_ID_DUPLICATE');
  });

  it('rejects unknown definition refs', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          serviceTasks: [{ definition: 'missing', taskId: 'reserveStock', bindingRef: 'inventory.reserveStock' }],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_STRUCT_UNKNOWN_DEFINITION');
  });

  it('rejects mapping expressions outside v1 path grammar', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          messageStarts: [
            {
              id: 'orderPlaced',
              definition: 'orderFulfillment',
              messageName: 'OrderPlaced',
              event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
              businessKey: '$env.SECRET',
            },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_STRUCT_MAPPING_PATH_INVALID');
  });
});
```

Run: `pnpm -F @rntme/workflows test -- test/unit/validate-structural.test.ts`

Expected: FAIL with missing `validateWorkflowStructural`.

- [x] **Step 5: Implement structural validator**

Create `packages/artifacts/workflows/src/validate/structural.ts`:

```ts
import type {
  StructurallyValidWorkflows,
  WorkflowArtifact,
  WorkflowMappingValue,
} from '../types/artifact.js';
import { ERROR_CODES, err, ok, type Result, type WorkflowError } from '../types/result.js';

const RELATIVE_BPMN_RE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+\.bpmn$/;
const PATH_EXPR_RE = /^\$(event|process)(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/;

export function validateWorkflowStructural(
  artifact: WorkflowArtifact,
): Result<StructurallyValidWorkflows> {
  const errors: WorkflowError[] = [];
  const definitionIds = new Set<string>();
  const bpmnFiles = new Map<string, string>();

  for (const [idx, definition] of artifact.definitions.entries()) {
    if (definitionIds.has(definition.id)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_DEFINITION_ID_DUPLICATE,
        message: `duplicate workflow definition id "${definition.id}"`,
        path: `definitions.${idx}.id`,
      });
    }
    definitionIds.add(definition.id);

    const prior = bpmnFiles.get(definition.bpmnFile);
    if (prior !== undefined) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_BPMN_FILE_DUPLICATE,
        message: `definitions "${prior}" and "${definition.id}" both use BPMN file "${definition.bpmnFile}"`,
        path: `definitions.${idx}.bpmnFile`,
      });
    }
    bpmnFiles.set(definition.bpmnFile, definition.id);

    if (!RELATIVE_BPMN_RE.test(definition.bpmnFile)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_MAPPING_PATH_INVALID,
        message: `definition "${definition.id}" bpmnFile must be a relative .bpmn path inside workflows/`,
        path: `definitions.${idx}.bpmnFile`,
      });
    }
  }

  const messageStartIds = new Set<string>();
  for (const [idx, start] of artifact.messageStarts.entries()) {
    if (messageStartIds.has(start.id)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_MESSAGE_START_ID_DUPLICATE,
        message: `duplicate messageStart id "${start.id}"`,
        path: `messageStarts.${idx}.id`,
      });
    }
    messageStartIds.add(start.id);
    if (!definitionIds.has(start.definition)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_UNKNOWN_DEFINITION,
        message: `messageStart "${start.id}" references unknown definition "${start.definition}"`,
        path: `messageStarts.${idx}.definition`,
      });
    }
    checkMappingValue(start.businessKey, `messageStarts.${idx}.businessKey`, errors);
    for (const [name, value] of Object.entries(start.variables ?? {})) {
      checkMappingValue(value, `messageStarts.${idx}.variables.${name}`, errors);
    }
  }

  const taskIdsByDefinition = new Set<string>();
  for (const [idx, task] of artifact.serviceTasks.entries()) {
    const taskKey = `${task.definition}:${task.taskId}`;
    if (taskIdsByDefinition.has(taskKey)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_SERVICE_TASK_ID_DUPLICATE,
        message: `duplicate service task "${task.taskId}" in definition "${task.definition}"`,
        path: `serviceTasks.${idx}.taskId`,
      });
    }
    taskIdsByDefinition.add(taskKey);
    if (!definitionIds.has(task.definition)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_UNKNOWN_DEFINITION,
        message: `serviceTask "${task.taskId}" references unknown definition "${task.definition}"`,
        path: `serviceTasks.${idx}.definition`,
      });
    }
    for (const [name, value] of Object.entries(task.input ?? {})) {
      checkMappingValue(value, `serviceTasks.${idx}.input.${name}`, errors);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as StructurallyValidWorkflows);
}

function checkMappingValue(value: WorkflowMappingValue, path: string, errors: WorkflowError[]): void {
  if (typeof value === 'string') {
    if (value.startsWith('$') && !PATH_EXPR_RE.test(value)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_MAPPING_PATH_INVALID,
        message: `mapping expression "${value}" must start with $event or $process and use dot paths`,
        path,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => checkMappingValue(item, `${path}.${idx}`, errors));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      checkMappingValue(nested, `${path}.${key}`, errors);
    }
  }
}
```

Create `packages/artifacts/workflows/src/validate/index.ts`:

```ts
import type { WorkflowCrossRefContext } from '../types/context.js';
import type { ValidatedWorkflows, WorkflowArtifact } from '../types/artifact.js';
import type { Result } from '../types/result.js';
import { validateWorkflowStructural } from './structural.js';
import { validateWorkflowCrossRef } from './cross-ref.js';

export { validateWorkflowStructural, validateWorkflowCrossRef };

export function validateWorkflows(
  artifact: WorkflowArtifact,
  ctx: WorkflowCrossRefContext,
): Result<ValidatedWorkflows> {
  const structural = validateWorkflowStructural(artifact);
  if (!structural.ok) return structural;
  return validateWorkflowCrossRef(structural.value, ctx);
}
```

Add a temporary `packages/artifacts/workflows/src/validate/cross-ref.ts` so typecheck can run before Task 3:

```ts
import type { StructurallyValidWorkflows, ValidatedWorkflows } from '../types/artifact.js';
import type { WorkflowCrossRefContext } from '../types/context.js';
import { ok, type Result } from '../types/result.js';

export function validateWorkflowCrossRef(
  artifact: StructurallyValidWorkflows,
  _ctx: WorkflowCrossRefContext,
): Result<ValidatedWorkflows> {
  return ok(artifact as ValidatedWorkflows);
}
```

Update `packages/artifacts/workflows/src/index.ts` to export validators:

```ts
export { parseWorkflowArtifact } from './parse/parse.js';
export {
  validateWorkflowCrossRef,
  validateWorkflowStructural,
  validateWorkflows,
} from './validate/index.js';
export type {
  WorkflowArtifact,
  WorkflowDefinition,
  WorkflowEventRef,
  WorkflowMappingValue,
  WorkflowMessageStart,
  WorkflowServiceTask,
  StructurallyValidWorkflows,
  ValidatedWorkflows,
} from './types/artifact.js';
export type {
  WorkflowBindingResolution,
  WorkflowCrossRefContext,
  WorkflowEventResolution,
} from './types/context.js';
export {
  ERROR_CODES,
  err,
  isErr,
  isOk,
  ok,
  type Result,
  type WorkflowError,
  type WorkflowErrorCode,
} from './types/result.js';
```

- [x] **Step 6: Verify structural tests pass**

Run:

```bash
pnpm -F @rntme/workflows test -- test/unit/parse.test.ts test/unit/validate-structural.test.ts
pnpm -F @rntme/workflows typecheck
```

Expected: both commands exit 0.

- [x] **Step 7: Commit parse/structural validation**

```bash
git add packages/artifacts/workflows
git commit -m "feat(workflows): parse and structurally validate workflow artifacts"
```

---

### Task 3: Implement Workflow Cross-Reference Validation

**Files:**
- Modify: `packages/artifacts/workflows/src/validate/cross-ref.ts`
- Test: `packages/artifacts/workflows/test/unit/validate-cross-ref.test.ts`

- [x] **Step 1: Write cross-ref tests**

Create `packages/artifacts/workflows/test/unit/validate-cross-ref.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  parseWorkflowArtifact,
  validateWorkflowStructural,
  validateWorkflowCrossRef,
  type WorkflowBindingResolution,
  type WorkflowCrossRefContext,
  type WorkflowEventRef,
} from '../../src/index.js';

function parsed(raw: unknown) {
  const parsed = parseWorkflowArtifact(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const structural = validateWorkflowStructural(parsed.value);
  if (!structural.ok) throw new Error(JSON.stringify(structural.errors));
  return structural.value;
}

const base = {
  workflowVersion: 1,
  definitions: [{ id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' }],
  messageStarts: [
    {
      id: 'orderPlaced',
      definition: 'orderFulfillment',
      messageName: 'OrderPlaced',
      event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      businessKey: '$event.data.orderId',
    },
  ],
  serviceTasks: [{ definition: 'orderFulfillment', taskId: 'reserveStock', bindingRef: 'inventory.reserveStock' }],
};

function ctx(overrides: Partial<WorkflowCrossRefContext> = {}): WorkflowCrossRefContext {
  const bindings: Record<string, WorkflowBindingResolution> = {
    'inventory.reserveStock': {
      service: 'inventory',
      bindingId: 'reserveStock',
      qualifiedId: 'inventory.reserveStock',
      kind: 'command',
    },
    'inventory.listStock': {
      service: 'inventory',
      bindingId: 'listStock',
      qualifiedId: 'inventory.listStock',
      kind: 'query',
    },
  };
  return {
    services: ['orders', 'inventory'],
    fileExists: (path) => path === 'order-fulfillment.bpmn',
    resolveEvent: (ref: WorkflowEventRef) =>
      ref.service === 'orders' && ref.aggregateType === 'Order' && ref.eventType === 'OrderPlaced'
        ? ref
        : null,
    resolveBindingRef: (ref) => bindings[ref] ?? null,
    ...overrides,
  };
}

describe('validateWorkflowCrossRef', () => {
  it('accepts valid refs', () => {
    const result = validateWorkflowCrossRef(parsed(base), ctx());
    expect(result.ok).toBe(true);
  });

  it('rejects missing BPMN files', () => {
    const result = validateWorkflowCrossRef(parsed(base), ctx({ fileExists: () => false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_BPMN_FILE_MISSING');
  });

  it('rejects unknown events', () => {
    const result = validateWorkflowCrossRef(parsed(base), ctx({ resolveEvent: () => null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_EVENT_UNKNOWN_TYPE');
  });

  it('rejects unknown binding refs', () => {
    const result = validateWorkflowCrossRef(
      parsed({ ...base, serviceTasks: [{ definition: 'orderFulfillment', taskId: 'x', bindingRef: 'missing.command' }] }),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_BINDING_REF_UNKNOWN');
  });

  it('rejects query binding refs', () => {
    const result = validateWorkflowCrossRef(
      parsed({ ...base, serviceTasks: [{ definition: 'orderFulfillment', taskId: 'x', bindingRef: 'inventory.listStock' }] }),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_BINDING_NOT_COMMAND');
  });
});
```

Run: `pnpm -F @rntme/workflows test -- test/unit/validate-cross-ref.test.ts`

Expected: FAIL because the temporary cross-ref accepts invalid refs.

- [x] **Step 2: Implement cross-ref validation**

Replace `packages/artifacts/workflows/src/validate/cross-ref.ts`:

```ts
import type { StructurallyValidWorkflows, ValidatedWorkflows } from '../types/artifact.js';
import type { WorkflowCrossRefContext } from '../types/context.js';
import { ERROR_CODES, err, ok, type Result, type WorkflowError } from '../types/result.js';

export function validateWorkflowCrossRef(
  artifact: StructurallyValidWorkflows,
  ctx: WorkflowCrossRefContext,
): Result<ValidatedWorkflows> {
  const errors: WorkflowError[] = [];
  const serviceSet = new Set(ctx.services);

  for (const [idx, definition] of artifact.definitions.entries()) {
    if (ctx.fileExists !== undefined && !ctx.fileExists(definition.bpmnFile)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_BPMN_FILE_MISSING,
        message: `BPMN file "${definition.bpmnFile}" does not exist under workflows/`,
        path: `definitions.${idx}.bpmnFile`,
      });
    }
  }

  for (const [idx, start] of artifact.messageStarts.entries()) {
    if (!serviceSet.has(start.event.service)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_EVENT_UNKNOWN_SERVICE,
        message: `messageStart "${start.id}" references unknown service "${start.event.service}"`,
        path: `messageStarts.${idx}.event.service`,
      });
      continue;
    }
    if (ctx.resolveEvent(start.event) === null) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_EVENT_UNKNOWN_TYPE,
        message: `messageStart "${start.id}" references unknown event ${start.event.service}.${start.event.aggregateType}.${start.event.eventType}`,
        path: `messageStarts.${idx}.event`,
      });
    }
  }

  for (const [idx, task] of artifact.serviceTasks.entries()) {
    const resolved = ctx.resolveBindingRef(task.bindingRef);
    if (resolved === null) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_BINDING_REF_UNKNOWN,
        message: `serviceTask "${task.taskId}" references unknown binding "${task.bindingRef}"`,
        path: `serviceTasks.${idx}.bindingRef`,
      });
      continue;
    }
    if (resolved.kind !== 'command') {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_BINDING_NOT_COMMAND,
        message: `serviceTask "${task.taskId}" binding "${task.bindingRef}" must be a command binding`,
        path: `serviceTasks.${idx}.bindingRef`,
      });
    }
    const serviceFromRef = task.bindingRef.split('.')[0];
    if (serviceFromRef !== undefined && serviceFromRef !== resolved.service) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_BINDING_SERVICE_MISMATCH,
        message: `serviceTask "${task.taskId}" binding service "${serviceFromRef}" resolved to "${resolved.service}"`,
        path: `serviceTasks.${idx}.bindingRef`,
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as ValidatedWorkflows);
}
```

- [x] **Step 3: Verify workflow package**

Run:

```bash
pnpm -F @rntme/workflows test
pnpm -F @rntme/workflows typecheck
pnpm -F @rntme/workflows lint
```

Expected: all exit 0.

- [x] **Step 4: Commit cross-ref validation**

```bash
git add packages/artifacts/workflows
git commit -m "feat(workflows): validate workflow cross references"
```

---

### Task 4: Integrate Workflows Into Blueprint Composition

**Files:**
- Modify: `packages/artifacts/blueprint/package.json`
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`
- Modify: `packages/artifacts/blueprint/src/types/result.ts`
- Create: `packages/artifacts/blueprint/src/compose/project-workflows.ts`
- Modify: `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`
- Test: `packages/artifacts/blueprint/test/unit/project-workflows.test.ts`
- Test: `packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts`

- [x] **Step 1: Add dependency**

In `packages/artifacts/blueprint/package.json`, add:

```json
"@rntme/workflows": "workspace:*"
```

inside `dependencies`.

- [x] **Step 2: Write blueprint workflow integration test**

Create `packages/artifacts/blueprint/test/unit/project-workflows.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadComposedBlueprint } from '../../src/index.js';

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function scaffoldProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-workflows-blueprint-'));
  mkdirSync(join(dir, 'pdm/entities'), { recursive: true });
  mkdirSync(join(dir, 'services/orders/graphs'), { recursive: true });
  mkdirSync(join(dir, 'services/orders/bindings'), { recursive: true });
  mkdirSync(join(dir, 'services/orders/qsm/projections'), { recursive: true });
  mkdirSync(join(dir, 'services/inventory/graphs'), { recursive: true });
  mkdirSync(join(dir, 'services/inventory/bindings'), { recursive: true });
  mkdirSync(join(dir, 'services/inventory/qsm/projections'), { recursive: true });
  mkdirSync(join(dir, 'workflows'), { recursive: true });

  writeJson(join(dir, 'project.json'), {
    name: 'order-fulfillment',
    services: ['orders', 'inventory'],
    routes: { http: { '/api/orders': 'orders', '/api/inventory': 'inventory' } },
  });
  writeJson(join(dir, 'pdm/pdm.json'), { entities: ['Order', 'StockReservation'] });
  writeJson(join(dir, 'pdm/entities/Order.json'), {
    ownerService: 'orders',
    kind: 'owned',
    table: 'orders',
    fields: {
      id: { type: 'string', nullable: false, column: 'id' },
      sku: { type: 'string', nullable: false, column: 'sku' },
      quantity: { type: 'integer', nullable: false, column: 'quantity' },
      status: { type: 'string', nullable: false, column: 'status' },
    },
    keys: ['id'],
    stateMachine: {
      stateField: 'status',
      initial: null,
      states: ['placed', 'confirmed', 'cancelled'],
      transitions: {
        place: { from: null, to: 'placed', affects: ['sku', 'quantity'] },
        confirm: { from: 'placed', to: 'confirmed' },
        cancel: { from: 'placed', to: 'cancelled' },
      },
    },
  });
  writeJson(join(dir, 'pdm/entities/StockReservation.json'), {
    ownerService: 'inventory',
    kind: 'owned',
    table: 'stock_reservations',
    fields: {
      id: { type: 'string', nullable: false, column: 'id' },
      orderId: { type: 'string', nullable: false, column: 'order_id' },
      status: { type: 'string', nullable: false, column: 'status' },
    },
    keys: ['id'],
    stateMachine: {
      stateField: 'status',
      initial: null,
      states: ['reserved', 'rejected'],
      transitions: {
        reserve: { from: null, to: 'reserved', affects: ['orderId'] },
        reject: { from: null, to: 'rejected', affects: ['orderId'] },
      },
    },
  });

  for (const service of ['orders', 'inventory']) {
    writeJson(join(dir, `services/${service}/service.json`), { kind: 'domain' });
    writeJson(join(dir, `services/${service}/graphs/shapes.json`), { version: '1.0-rc7', shapes: {} });
    writeJson(join(dir, `services/${service}/qsm/qsm.json`), { projections: {}, relations: {} });
  }
  writeJson(join(dir, 'services/orders/graphs/confirmOrder.json'), {
    id: 'confirmOrder',
    signature: { inputs: {}, output: { type: 'row.CommandResult', from: 'emit' } },
    nodes: [],
  });
  writeJson(join(dir, 'services/orders/bindings/bindings.json'), {
    version: '1.0',
    graphSpecRef: '../graphs',
    pdmRef: '../../pdm',
    qsmRef: '../qsm',
    bindings: {
      confirmOrder: {
        kind: 'command',
        graph: 'confirmOrder',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'POST', path: '/confirm', parameters: [] },
      },
    },
  });
  writeJson(join(dir, 'services/inventory/graphs/reserveStock.json'), {
    id: 'reserveStock',
    signature: { inputs: {}, output: { type: 'row.CommandResult', from: 'emit' } },
    nodes: [],
  });
  writeJson(join(dir, 'services/inventory/bindings/bindings.json'), {
    version: '1.0',
    graphSpecRef: '../graphs',
    pdmRef: '../../pdm',
    qsmRef: '../qsm',
    bindings: {
      reserveStock: {
        kind: 'command',
        graph: 'reserveStock',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'POST', path: '/reserve', parameters: [] },
      },
    },
  });
  writeJson(join(dir, 'workflows/workflows.json'), {
    workflowVersion: 1,
    definitions: [{ id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' }],
    messageStarts: [
      {
        id: 'orderPlaced',
        definition: 'orderFulfillment',
        messageName: 'OrderPlaced',
        event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
        businessKey: '$event.data.id',
      },
    ],
    serviceTasks: [{ definition: 'orderFulfillment', taskId: 'reserveStock', bindingRef: 'inventory.reserveStock' }],
  });
  writeFileSync(join(dir, 'workflows/order-fulfillment.bpmn'), '<definitions id="orderFulfillment" />');
  return dir;
}

describe('project workflows', () => {
  it('loads validated workflows into composed blueprint', () => {
    const result = loadComposedBlueprint(scaffoldProject());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.workflows?.definitions[0]?.id).toBe('orderFulfillment');
  });
});
```

Run: `pnpm -F @rntme/blueprint test -- test/unit/project-workflows.test.ts`

Expected: FAIL because `ComposedBlueprint.workflows` is not implemented.

- [x] **Step 3: Add composed type and error code**

In `packages/artifacts/blueprint/src/types/artifact.ts`, add import:

```ts
import type { ValidatedWorkflows } from '@rntme/workflows';
```

Add to `ComposedBlueprint`:

```ts
  workflows?: ValidatedWorkflows | null;
```

In `packages/artifacts/blueprint/src/types/result.ts`, add:

```ts
  BLUEPRINT_WORKFLOWS_INVALID: 'BLUEPRINT_WORKFLOWS_INVALID',
```

to `ERROR_CODES`.

- [x] **Step 4: Implement project workflow loader**

Create `packages/artifacts/blueprint/src/compose/project-workflows.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseWorkflowArtifact,
  validateWorkflows,
  type ValidatedWorkflows,
  type WorkflowBindingResolution,
  type WorkflowCrossRefContext,
  type WorkflowEventRef,
} from '@rntme/workflows';
import type { EventTypeSpec } from '@rntme/pdm';
import type { RoutedBindingEntry, ValidatedServiceMember } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type Result } from '../types/result.js';

export function loadProjectWorkflows(input: {
  readonly rootDir: string;
  readonly services: Readonly<Record<string, ValidatedServiceMember>>;
  readonly bindingRegistry: Readonly<Record<string, RoutedBindingEntry>>;
}): Result<ValidatedWorkflows | null> {
  const relPath = 'workflows/workflows.json';
  const absPath = join(input.rootDir, relPath);
  if (!existsSync(absPath)) return ok(null);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (cause) {
    return err([
      {
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_WORKFLOWS_INVALID,
        message: 'failed to read workflows/workflows.json',
        path: relPath,
        cause: [cause instanceof Error ? cause.message : String(cause)],
      },
    ]);
  }

  const parsed = parseWorkflowArtifact(raw);
  if (!parsed.ok) return workflowErr(relPath, parsed.errors);

  const ctx = buildWorkflowContext(input.rootDir, input.services, input.bindingRegistry);
  const validated = validateWorkflows(parsed.value, ctx);
  if (!validated.ok) return workflowErr(relPath, validated.errors);

  return ok(validated.value);
}

function buildWorkflowContext(
  rootDir: string,
  services: Readonly<Record<string, ValidatedServiceMember>>,
  bindingRegistry: Readonly<Record<string, RoutedBindingEntry>>,
): WorkflowCrossRefContext {
  const events = new Map<string, EventTypeSpec>();
  for (const [serviceSlug, service] of Object.entries(services)) {
    for (const event of service.eventTypes) {
      events.set(eventKey(serviceSlug, event.aggregateType, event.eventType), event);
    }
  }

  return {
    services: Object.keys(services),
    fileExists: (relativePath) => existsSync(join(rootDir, 'workflows', relativePath)),
    resolveEvent: (ref: WorkflowEventRef) =>
      events.has(eventKey(ref.service, ref.aggregateType, ref.eventType))
        ? { service: ref.service, aggregateType: ref.aggregateType, eventType: ref.eventType }
        : null,
    resolveBindingRef: (ref: string): WorkflowBindingResolution | null => {
      const entry = bindingRegistry[ref];
      if (entry === undefined) return null;
      return {
        service: entry.service,
        bindingId: entry.bindingId,
        qualifiedId: entry.qualifiedId,
        kind: entry.kind,
        method: entry.method,
        path: entry.path,
      };
    },
  };
}

function eventKey(service: string, aggregateType: string, eventType: string): string {
  return `${service}:${aggregateType}:${eventType}`;
}

function workflowErr<T>(path: string, cause: readonly unknown[]): Result<T> {
  return err([
    {
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_WORKFLOWS_INVALID,
      message: 'workflow artifact failed validation',
      path,
      cause: [...cause],
    },
  ]);
}
```

- [x] **Step 5: Wire loader into composed blueprint**

In `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`, add import:

```ts
import { loadProjectWorkflows } from './project-workflows.js';
```

After `bindingRegistry` is built and before UI compile loop:

```ts
  const workflows = loadProjectWorkflows({
    rootDir: dir,
    services: validatedServices,
    bindingRegistry,
  });
  if (!workflows.ok) return workflows;
```

Add to returned object:

```ts
    workflows: workflows.value,
```

- [x] **Step 6: Verify blueprint integration**

Run:

```bash
pnpm -F @rntme/workflows build
pnpm -F @rntme/blueprint test -- test/unit/project-workflows.test.ts
pnpm -F @rntme/blueprint typecheck
```

Expected: all exit 0. If the test fixture's graph/bindings are too minimal for current validators, adjust the fixture to match existing `load-service-member` expectations rather than weakening validators.

- [x] **Step 7: Commit blueprint integration**

```bash
git add packages/artifacts/blueprint packages/artifacts/workflows
git commit -m "feat(blueprint): compose project workflow artifacts"
```

---

### Task 5: Add Deploy-Core Workflow Planning

**Files:**
- Modify: `packages/deploy/deploy-core/package.json`
- Modify: `packages/deploy/deploy-core/src/composed-project.ts`
- Modify: `packages/deploy/deploy-core/src/config.ts`
- Modify: `packages/deploy/deploy-core/src/errors.ts`
- Create: `packages/deploy/deploy-core/src/workflows.ts`
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Modify: `packages/deploy/deploy-core/src/index.ts`
- Test: `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts`

- [x] **Step 1: Add deploy-core dependency**

In `packages/deploy/deploy-core/package.json`, add:

```json
"@rntme/workflows": "workspace:*"
```

inside `dependencies`.

- [x] **Step 2: Write workflow planning tests**

Create `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProjectDeploymentPlan, type ComposedProjectInput } from '../../src/index.js';

const project: ComposedProjectInput = {
  name: 'order-fulfillment',
  services: {
    orders: { slug: 'orders', kind: 'domain', runtimeFiles: { 'manifest.json': '{}', 'pdm.json': '{}', 'qsm.json': '{}', 'bindings.json': '{}' } },
    inventory: { slug: 'inventory', kind: 'domain', runtimeFiles: { 'manifest.json': '{}', 'pdm.json': '{}', 'qsm.json': '{}', 'bindings.json': '{}' } },
  },
  workflows: {
    workflowVersion: 1,
    definitions: [{ id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' }],
    messageStarts: [
      {
        id: 'orderPlaced',
        definition: 'orderFulfillment',
        messageName: 'OrderPlaced',
        event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
        businessKey: '$event.data.orderId',
      },
    ],
    serviceTasks: [
      { definition: 'orderFulfillment', taskId: 'reserveStock', bindingRef: 'inventory.reserveStock' },
      { definition: 'orderFulfillment', taskId: 'confirmOrder', bindingRef: 'orders.confirmOrder' },
    ],
  },
};

describe('workflow planning', () => {
  it('plans provisioned Operaton and a BPMN worker when workflows are present', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: { engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' }, worker: { image: 'ghcr.io/acme/bpmn-worker:v1' } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.infrastructure.workflowEngine).toMatchObject({ kind: 'operaton', mode: 'provisioned' });
    expect(result.value.workloads.some((w) => w.kind === 'bpmn-worker')).toBe(true);
  });

  it('rejects workflows without a provisioned kafka bus', () => {
    const result = buildProjectDeploymentPlan(project, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'memory', mode: 'in-memory' },
      workflows: { engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' }, worker: { image: 'ghcr.io/acme/bpmn-worker:v1' } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.code)).toContain('DEPLOY_PLAN_WORKFLOWS_REQUIRE_EVENT_BUS');
  });

  it('does not plan workflow infrastructure for projects without workflows', () => {
    const result = buildProjectDeploymentPlan({ ...project, workflows: null }, {
      orgSlug: 'acme',
      environment: 'default',
      mode: 'preview',
      runtimeImage: 'ghcr.io/acme/runtime:v1',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.infrastructure.workflowEngine).toEqual({ kind: 'none' });
  });
});
```

Run: `pnpm -F @rntme/deploy-core test -- test/unit/plan-workflows.test.ts`

Expected: FAIL with unknown `workflows` config/project fields.

- [x] **Step 3: Add deploy input and config types**

In `packages/deploy/deploy-core/src/composed-project.ts`, import workflow types:

```ts
import type { ValidatedWorkflows } from '@rntme/workflows';
```

Add to `ComposedProjectInput`:

```ts
  readonly workflows?: ValidatedWorkflows | null;
```

In `packages/deploy/deploy-core/src/config.ts`, add:

```ts
export type WorkflowEngineConfig =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'operaton';
      readonly mode: 'provisioned';
      readonly image: string;
    };

export type BpmnWorkerConfig = {
  readonly image: string;
};
```

Add to `ProjectDeploymentConfig`:

```ts
  readonly workflows?: {
    readonly engine: WorkflowEngineConfig;
    readonly worker: BpmnWorkerConfig;
  };
```

Use an explicit image in every deploy target. The implementation task must verify the production tag against Operaton's published image metadata before adding a real target config.

- [x] **Step 4: Add deploy-core plan types**

In `packages/deploy/deploy-core/src/plan.ts`, add workload and infrastructure types:

```ts
export type PlannedWorkflowEngine =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'operaton';
      readonly mode: 'provisioned';
      readonly resourceName: string;
      readonly internalBaseUrl: string;
      readonly image: string;
    };

export type PlannedWorkflowSubscription = {
  readonly messageStartId: string;
  readonly topic: string;
  readonly service: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly processId: string;
  readonly messageName: string;
  readonly businessKey: string;
};

export type PlannedWorkflowServiceTask = {
  readonly definition: string;
  readonly taskId: string;
  readonly bindingRef: string;
  readonly targetService: string;
};

export type BpmnWorkerWorkload = {
  readonly kind: 'bpmn-worker';
  readonly slug: 'bpmn-worker';
  readonly resourceName: string;
  readonly image: string;
  readonly workflowManifestPath: '/srv/workflows/workflows.json';
  readonly workflowFiles: Readonly<Record<string, string>>;
  readonly subscriptions: readonly PlannedWorkflowSubscription[];
  readonly serviceTasks: readonly PlannedWorkflowServiceTask[];
};
```

Extend `DeploymentWorkload`:

```ts
  | BpmnWorkerWorkload
```

Extend `ProjectDeploymentPlan.infrastructure`:

```ts
    readonly workflowEngine: PlannedWorkflowEngine;
```

- [x] **Step 5: Add error codes**

In `packages/deploy/deploy-core/src/errors.ts`, add:

```ts
  DEPLOY_PLAN_WORKFLOWS_REQUIRE_EVENT_BUS: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_EVENT_BUS',
  DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
  DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING: 'DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING',
  DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_UNAVAILABLE: 'DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_UNAVAILABLE',
  DEPLOY_PLAN_WORKFLOWS_UNSUPPORTED_ENGINE: 'DEPLOY_PLAN_WORKFLOWS_UNSUPPORTED_ENGINE',
```

- [x] **Step 6: Implement planner helper**

Create `packages/deploy/deploy-core/src/workflows.ts`:

```ts
import type { ValidatedWorkflows } from '@rntme/workflows';
import type { ComposedProjectInput } from './composed-project.js';
import type { ProjectDeploymentConfig } from './config.js';
import type {
  BpmnWorkerWorkload,
  PlannedEventBus,
  PlannedWorkflowEngine,
  PlannedWorkflowServiceTask,
  PlannedWorkflowSubscription,
} from './plan.js';
import type { DeploymentPlanError } from './errors.js';

export function planWorkflowEngine(input: {
  readonly project: ComposedProjectInput;
  readonly config: ProjectDeploymentConfig;
  readonly eventBus: PlannedEventBus | undefined;
  readonly errors: DeploymentPlanError[];
}): { readonly engine: PlannedWorkflowEngine; readonly worker: BpmnWorkerWorkload | null } {
  const workflows = input.project.workflows;
  if (workflows === undefined || workflows === null) {
    return { engine: { kind: 'none' }, worker: null };
  }

  if (input.eventBus?.kind !== 'kafka' || input.eventBus.mode !== 'provisioned') {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_EVENT_BUS',
      message: 'workflow projects require a provisioned Kafka event bus in the MVP',
      path: 'eventBus',
    });
  }

  const workflowConfig = input.config.workflows;
  if (workflowConfig === undefined || workflowConfig.engine.kind !== 'operaton') {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
      message: 'workflow projects require provisioned Operaton config',
      path: 'workflows.engine',
    });
    return { engine: { kind: 'none' }, worker: null };
  }

  if (workflowConfig.worker.image.trim() === '') {
    input.errors.push({
      code: 'DEPLOY_PLAN_WORKFLOWS_WORKER_IMAGE_MISSING',
      message: 'workflow worker image must be a non-empty string',
      path: 'workflows.worker.image',
    });
  }

  const engineResource = resourceName(input.config.orgSlug, input.project.name, 'operaton');
  const workerResource = resourceName(input.config.orgSlug, input.project.name, 'bpmn-worker');
  const engine: PlannedWorkflowEngine = {
    kind: 'operaton',
    mode: 'provisioned',
    resourceName: engineResource,
    internalBaseUrl: `http://${engineResource}:8080`,
    image: workflowConfig.engine.image,
  };

  const worker: BpmnWorkerWorkload = {
    kind: 'bpmn-worker',
    slug: 'bpmn-worker',
    resourceName: workerResource,
    image: workflowConfig.worker.image,
    workflowManifestPath: '/srv/workflows/workflows.json',
    workflowFiles: {},
    subscriptions: buildSubscriptions(workflows, input.eventBus),
    serviceTasks: buildServiceTasks(workflows),
  };

  return { engine, worker };
}

function buildSubscriptions(
  workflows: ValidatedWorkflows,
  eventBus: PlannedEventBus | undefined,
): PlannedWorkflowSubscription[] {
  return workflows.messageStarts.map((start) => ({
    messageStartId: start.id,
    topic:
      eventBus?.kind === 'kafka' && eventBus.topicPrefix !== undefined
        ? `${eventBus.topicPrefix}.${start.event.service}.${start.event.aggregateType.toLowerCase()}`
        : `rntme.${start.event.service}.${start.event.aggregateType.toLowerCase()}`,
    service: start.event.service,
    aggregateType: start.event.aggregateType,
    eventType: start.event.eventType,
    processId: workflows.definitions.find((d) => d.id === start.definition)?.processId ?? start.definition,
    messageName: start.messageName,
    businessKey: start.businessKey,
  }));
}

function buildServiceTasks(workflows: ValidatedWorkflows): PlannedWorkflowServiceTask[] {
  return workflows.serviceTasks.map((task) => ({
    definition: task.definition,
    taskId: task.taskId,
    bindingRef: task.bindingRef,
    targetService: task.bindingRef.split('.')[0] ?? '',
  }));
}

function resourceName(orgSlug: string, projectSlug: string, workloadSlug: string): string {
  return `rntme-${orgSlug}-${projectSlug}-${workloadSlug}`;
}
```

- [x] **Step 7: Wire planner into `buildProjectDeploymentPlan`**

In `packages/deploy/deploy-core/src/plan.ts`, import:

```ts
import { planWorkflowEngine } from './workflows.js';
```

After `plannedEventBus` is computed and before final error check:

```ts
  const workflowPlan = planWorkflowEngine({
    project,
    config,
    eventBus: plannedEventBus,
    errors,
  });
```

After `const workloads = buildWorkloads(...)`, append worker:

```ts
  const allWorkloads =
    workflowPlan.worker === null ? workloads : [...workloads, workflowPlan.worker];
```

Use `allWorkloads` for `planEdge` and the returned `workloads` field:

```ts
  const { edge, errors: edgeErrors } = planEdge(project, config, allWorkloads, vars);
```

Returned infrastructure:

```ts
      workflowEngine: workflowPlan.engine,
```

Returned workloads:

```ts
    workloads: allWorkloads,
```

- [x] **Step 8: Export workflow types**

In `packages/deploy/deploy-core/src/index.ts`, export new helper/types if existing exports are explicit:

```ts
export type {
  BpmnWorkerWorkload,
  PlannedWorkflowEngine,
  PlannedWorkflowServiceTask,
  PlannedWorkflowSubscription,
} from './plan.js';
```

- [x] **Step 9: Verify deploy-core**

Run:

```bash
pnpm -F @rntme/workflows build
pnpm -F @rntme/deploy-core test -- test/unit/plan-workflows.test.ts
pnpm -F @rntme/deploy-core typecheck
```

Expected: all exit 0. If `planEdge` rejects `bpmn-worker`, keep worker out of edge target matching by ensuring no routes point to it.

- [x] **Step 10: Commit deploy-core workflow planning**

```bash
git add packages/deploy/deploy-core
git commit -m "feat(deploy-core): plan operaton workflow workloads"
```

---

### Task 6: Render And Apply Operaton/BPMN Worker In Dokploy

**Files:**
- Create: `packages/deploy/deploy-dokploy/src/workflow-render.ts`
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`

- [x] **Step 1: Write render test**

Create `packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderDokployPlan } from '../../src/index.js';
import type { ProjectDeploymentPlan } from '@rntme/deploy-core';

const plan: ProjectDeploymentPlan = {
  project: { orgSlug: 'acme', projectSlug: 'order-fulfillment', environment: 'default', mode: 'preview' },
  infrastructure: {
    eventBus: {
      kind: 'kafka',
      mode: 'provisioned',
      provider: 'redpanda',
      resourceName: 'rntme-acme-order-fulfillment-event-bus',
      internalBrokers: ['rntme-acme-order-fulfillment-event-bus:9092'],
      image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
      persistence: { mode: 'persistent', volumeName: 'rntme-acme-order-fulfillment-event-bus-data' },
    },
    workflowEngine: {
      kind: 'operaton',
      mode: 'provisioned',
      resourceName: 'rntme-acme-order-fulfillment-operaton',
      internalBaseUrl: 'http://rntme-acme-order-fulfillment-operaton:8080',
      image: 'operaton/operaton:test',
    },
  },
  workloads: [
    {
      kind: 'domain-service',
      slug: 'orders',
      serviceSlug: 'orders',
      resourceName: 'rntme-acme-order-fulfillment-orders',
      runtime: { image: 'ghcr.io/acme/runtime:v1' },
      artifact: { source: 'composed-project', serviceSlug: 'orders' },
      runtimeFiles: { 'manifest.json': '{}' },
      publicConfigJson: '{}',
      persistence: { mode: 'ephemeral' },
    },
    {
      kind: 'bpmn-worker',
      slug: 'bpmn-worker',
      resourceName: 'rntme-acme-order-fulfillment-bpmn-worker',
      image: 'ghcr.io/acme/bpmn-worker:v1',
      workflowManifestPath: '/srv/workflows/workflows.json',
      workflowFiles: { 'workflows.json': '{"workflowVersion":1}', 'order-fulfillment.bpmn': '<definitions />' },
      subscriptions: [],
      serviceTasks: [],
    },
    { kind: 'edge-gateway', slug: 'edge', resourceName: 'rntme-acme-order-fulfillment-edge', image: 'nginx:1.27-alpine' },
  ],
  edge: { routes: [], middleware: [] },
  diagnostics: { warnings: [] },
};

describe('workflow rendering', () => {
  it('renders Operaton and BPMN worker resources', () => {
    const result = renderDokployPlan(plan, {
      endpoint: 'https://dokploy.example',
      projectName: 'demo',
      allowCreateProject: true,
      publicBaseUrl: 'https://orders.example',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources.some((r) => r.kind === 'compose' && r.logicalId === 'workflow-engine')).toBe(true);
    const worker = result.value.resources.find((r) => r.kind === 'application' && r.logicalId === 'bpmn-worker');
    expect(worker).toBeDefined();
    if (worker?.kind === 'application') {
      expect(worker.env.some((e) => e.name === 'RNTME_OPERATON_BASE_URL')).toBe(true);
      expect(worker.files?.['/srv/workflows/workflows.json']).toBe('{"workflowVersion":1}');
    }
  });
});
```

Run: `pnpm -F @rntme/deploy-dokploy test -- test/unit/render-workflows.test.ts`

Expected: FAIL because workflow resources are not rendered.

- [x] **Step 2: Extend rendered resource types**

In `packages/deploy/deploy-dokploy/src/render.ts`, change `RenderedDokployComposeResource.infrastructureKind`:

```ts
  readonly infrastructureKind: 'event-bus' | 'workflow-engine';
```

Change `RenderedDokployApplicationResource.workloadKind` to continue using `DeploymentWorkload['kind']`; after Task 5 that union includes `bpmn-worker`.

- [x] **Step 3: Add workflow render helper**

Create `packages/deploy/deploy-dokploy/src/workflow-render.ts`:

```ts
import type { ProjectDeploymentPlan } from '@rntme/deploy-core';
import { dokployLabels } from './names.js';
import type { RenderedDokployApplicationResource, RenderedDokployComposeResource, RenderedEnvVar } from './render.js';

export function renderOperatonCompose(plan: ProjectDeploymentPlan): RenderedDokployComposeResource | null {
  const engine = plan.infrastructure.workflowEngine;
  if (engine.kind === 'none') return null;
  return {
    logicalId: 'workflow-engine',
    kind: 'compose',
    infrastructureKind: 'workflow-engine',
    name: engine.resourceName,
    image: engine.image,
    composeFile: [
      'services:',
      '  operaton:',
      `    image: ${engine.image}`,
      '    ports: []',
      '    networks:',
      '      - default',
      '      - dokploy-network',
      'networks:',
      '  dokploy-network:',
      '    external: true',
      '',
    ].join('\n'),
    env: [],
    labels: {
      ...dokployLabels(plan.project.orgSlug, plan.project.projectSlug, plan.project.environment, 'workflow-engine'),
      'rntme.infrastructure': 'workflow-engine',
      'rntme.provider': 'operaton',
    },
  };
}

export function renderBpmnWorker(
  plan: ProjectDeploymentPlan,
  workload: Extract<ProjectDeploymentPlan['workloads'][number], { kind: 'bpmn-worker' }>,
): RenderedDokployApplicationResource {
  const engine = plan.infrastructure.workflowEngine;
  const eventBusEnv = workerEventBusEnv(plan.infrastructure.eventBus);
  return {
    logicalId: workload.slug,
    kind: 'application',
    workloadKind: workload.kind,
    workloadSlug: workload.slug,
    name: workload.resourceName,
    image: workload.image,
    env: [
      ...eventBusEnv,
      {
        name: 'RNTME_OPERATON_BASE_URL',
        value: engine.kind === 'operaton' ? engine.internalBaseUrl : '',
        secret: false,
      },
      {
        name: 'RNTME_WORKFLOWS_MANIFEST_PATH',
        value: workload.workflowManifestPath,
        secret: false,
      },
    ],
    labels: dokployLabels(plan.project.orgSlug, plan.project.projectSlug, plan.project.environment, workload.slug),
    files: Object.fromEntries(
      Object.entries(workload.workflowFiles).map(([path, content]) => [`/srv/workflows/${path.replace(/^\/+/, '')}`, content]),
    ),
  };
}

function workerEventBusEnv(eventBus: ProjectDeploymentPlan['infrastructure']['eventBus']): RenderedEnvVar[] {
  if (eventBus.kind !== 'kafka') return [];
  if (eventBus.mode === 'provisioned') {
    return [
      { name: 'RNTME_EVENT_BUS_BROKERS', value: eventBus.internalBrokers.join(','), secret: false },
      { name: 'RNTME_EVENT_BUS_PROTOCOL', value: 'plaintext', secret: false },
      ...(eventBus.topicPrefix === undefined ? [] : [{ name: 'RNTME_EVENT_BUS_TOPIC_PREFIX', value: eventBus.topicPrefix, secret: false }]),
    ];
  }
  return [
    { name: 'RNTME_EVENT_BUS_BROKERS', value: eventBus.brokers.join(','), secret: false },
    { name: 'RNTME_EVENT_BUS_PROTOCOL', value: eventBus.security?.protocol ?? 'plaintext', secret: false },
  ];
}
```

- [x] **Step 4: Wire helper into render**

In `packages/deploy/deploy-dokploy/src/render.ts`, import:

```ts
import { renderBpmnWorker, renderOperatonCompose } from './workflow-render.js';
```

Update `renderInfrastructureResources`:

```ts
function renderInfrastructureResources(plan: ProjectDeploymentPlan): RenderedDokployResource[] {
  const resources: RenderedDokployResource[] = [];
  const eventBus = plan.infrastructure.eventBus;
  if (eventBus.mode === 'provisioned') resources.push(renderRedpandaCompose(plan));
  const workflowEngine = renderOperatonCompose(plan);
  if (workflowEngine !== null) resources.push(workflowEngine);
  return resources;
}
```

In `renderResource`, before the edge/domain/integration branches:

```ts
  if (workload.kind === 'bpmn-worker') {
    return renderBpmnWorker(plan, workload);
  }
```

Update `workloadHttpPort` if the type complains:

```ts
function workloadHttpPort(workload: Exclude<DeploymentWorkload, { kind: 'edge-gateway' | 'bpmn-worker' }>): number {
  return workload.kind === 'integration-module' ? 50052 : 3000;
}
```

And filter `bpmn-worker` out of upstreams:

```ts
.filter((w) => w.kind !== 'edge-gateway' && w.kind !== 'bpmn-worker')
```

- [x] **Step 5: Make apply ordering explicit**

In `packages/deploy/deploy-dokploy/src/apply.ts`, replace the simple compose-first sort with:

```ts
  const orderedResources = [...rendered.resources].sort(resourceOrder);
```

Add:

```ts
function resourceOrder(a: RenderedDokployResource, b: RenderedDokployResource): number {
  return resourceRank(a) - resourceRank(b);
}

function resourceRank(resource: RenderedDokployResource): number {
  if (resource.kind === 'compose' && resource.infrastructureKind === 'event-bus') return 0;
  if (resource.kind === 'compose' && resource.infrastructureKind === 'workflow-engine') return 1;
  if (resource.kind === 'application' && resource.workloadKind === 'domain-service') return 2;
  if (resource.kind === 'application' && resource.workloadKind === 'integration-module') return 2;
  if (resource.kind === 'application' && resource.workloadKind === 'bpmn-worker') return 3;
  if (resource.kind === 'application' && resource.workloadKind === 'edge-gateway') return 4;
  return 5;
}
```

Update `DeploymentApplyResource.infrastructureKind`:

```ts
  readonly infrastructureKind?: 'event-bus' | 'workflow-engine';
```

- [x] **Step 6: Verify deploy-dokploy**

Run:

```bash
pnpm -F @rntme/deploy-core build
pnpm -F @rntme/deploy-dokploy test -- test/unit/render-workflows.test.ts test/unit/apply.test.ts
pnpm -F @rntme/deploy-dokploy typecheck
```

Expected: all exit 0.

- [x] **Step 7: Commit Dokploy workflow rendering**

```bash
git add packages/deploy/deploy-dokploy
git commit -m "feat(deploy-dokploy): render operaton workflow resources"
```

---

### Task 7: Add BPMN Worker Package Skeleton And Core Tests

**Files:**
- Create: `packages/runtime/bpmn-worker/package.json`
- Create: `packages/runtime/bpmn-worker/tsconfig.json`
- Create: `packages/runtime/bpmn-worker/tsconfig.check.json`
- Create: `packages/runtime/bpmn-worker/README.md`
- Create: `packages/runtime/bpmn-worker/src/index.ts`
- Create: `packages/runtime/bpmn-worker/src/config.ts`
- Create: `packages/runtime/bpmn-worker/src/mapping.ts`
- Create: `packages/runtime/bpmn-worker/src/metadata.ts`
- Create: `packages/runtime/bpmn-worker/src/types.ts`
- Test: `packages/runtime/bpmn-worker/test/unit/mapping.test.ts`
- Test: `packages/runtime/bpmn-worker/test/unit/metadata.test.ts`

- [x] **Step 1: Add worker package metadata**

Create `packages/runtime/bpmn-worker/package.json`:

```json
{
  "name": "@rntme/bpmn-worker",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "BPMN worker bridge from Kafka events to Operaton service tasks and rntme gRPC command bindings.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@rntme/workflows": "workspace:*"
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

Create tsconfig files using the same content as Task 1, with `extends: "../../../tsconfig.base.json"`.

- [x] **Step 2: Define worker types**

Create `packages/runtime/bpmn-worker/src/types.ts`:

```ts
import type { WorkflowArtifact } from '@rntme/workflows';

export type EventEnvelopeLike = {
  readonly id?: string;
  readonly eventId?: string;
  readonly type?: string;
  readonly correlationId?: string;
  readonly correlationid?: string;
  readonly data?: unknown;
};

export type WorkerConfig = {
  readonly eventBusBrokers: readonly string[];
  readonly eventBusProtocol: 'plaintext' | 'sasl_ssl';
  readonly topicPrefix?: string;
  readonly operatonBaseUrl: string;
  readonly workflowsManifestPath: string;
};

export type LoadedWorkerManifest = WorkflowArtifact;

export type CommandMetadata = {
  readonly commandId: string;
  readonly correlationId: string;
  readonly causationId: string;
};
```

Create `packages/runtime/bpmn-worker/src/index.ts`:

```ts
export type {
  CommandMetadata,
  EventEnvelopeLike,
  LoadedWorkerManifest,
  WorkerConfig,
} from './types.js';
export { evaluateMappingValue } from './mapping.js';
export { buildCommandMetadata } from './metadata.js';
```

- [x] **Step 3: Write mapping and metadata tests**

Create `packages/runtime/bpmn-worker/test/unit/mapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateMappingValue } from '../../src/index.js';

describe('evaluateMappingValue', () => {
  it('resolves event and process dot paths', () => {
    const ctx = {
      event: { data: { orderId: 'ord_1' } },
      process: { reservation: { reservationId: 'res_1' } },
    };
    expect(evaluateMappingValue('$event.data.orderId', ctx)).toBe('ord_1');
    expect(evaluateMappingValue('$process.reservation.reservationId', ctx)).toBe('res_1');
  });

  it('maps nested objects', () => {
    const result = evaluateMappingValue(
      { orderId: '$process.orderId', quantity: 2, tags: ['$event.data.sku'] },
      { event: { data: { sku: 'sku-a' } }, process: { orderId: 'ord_1' } },
    );
    expect(result).toEqual({ orderId: 'ord_1', quantity: 2, tags: ['sku-a'] });
  });
});
```

Create `packages/runtime/bpmn-worker/test/unit/metadata.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCommandMetadata } from '../../src/index.js';

describe('buildCommandMetadata', () => {
  it('builds deterministic command metadata', () => {
    const metadata = buildCommandMetadata({
      processInstanceId: 'proc_1',
      taskId: 'reserveStock',
      activityInstanceId: 'act_1',
      sourceEventId: 'evt_1',
      sourceCorrelationId: 'corr_1',
      previousCommandId: null,
    });
    expect(metadata).toEqual({
      commandId: 'bpmn:proc_1:reserveStock:act_1',
      correlationId: 'corr_1',
      causationId: 'evt_1',
    });
  });
});
```

Run: `pnpm -F @rntme/bpmn-worker test`

Expected: FAIL with missing exports.

- [x] **Step 4: Implement mapping and metadata helpers**

Create `packages/runtime/bpmn-worker/src/mapping.ts`:

```ts
import type { WorkflowMappingValue } from '@rntme/workflows';

export type MappingContext = {
  readonly event: unknown;
  readonly process: unknown;
};

export function evaluateMappingValue(value: WorkflowMappingValue, ctx: MappingContext): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('$event.')) return readPath(ctx.event, value.slice('$event.'.length));
    if (value.startsWith('$process.')) return readPath(ctx.process, value.slice('$process.'.length));
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => evaluateMappingValue(item, ctx));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, evaluateMappingValue(nested, ctx)]),
    );
  }
  return value;
}

function readPath(source: unknown, path: string): unknown {
  let current = source;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
```

Create `packages/runtime/bpmn-worker/src/metadata.ts`:

```ts
import type { CommandMetadata } from './types.js';

export type CommandMetadataInput = {
  readonly processInstanceId: string;
  readonly taskId: string;
  readonly activityInstanceId: string;
  readonly sourceEventId: string | null;
  readonly sourceCorrelationId: string | null;
  readonly previousCommandId: string | null;
};

export function buildCommandMetadata(input: CommandMetadataInput): CommandMetadata {
  const commandId = `bpmn:${input.processInstanceId}:${input.taskId}:${input.activityInstanceId}`;
  return {
    commandId,
    correlationId: input.sourceCorrelationId ?? input.processInstanceId,
    causationId: input.previousCommandId ?? input.sourceEventId ?? input.processInstanceId,
  };
}
```

- [x] **Step 5: Verify worker core**

Run:

```bash
pnpm -F @rntme/bpmn-worker test
pnpm -F @rntme/bpmn-worker typecheck
pnpm -F @rntme/bpmn-worker lint
```

Expected: all exit 0.

- [x] **Step 6: Add README and commit**

Create `packages/runtime/bpmn-worker/README.md`:

```md
# @rntme/bpmn-worker

Bridge worker for provisioned BPMN/Operaton projects.

It subscribes to planned Kafka topics, starts Operaton process instances from
message starts, executes BPMN service tasks by calling rntme gRPC command
bindings, and writes deterministic command metadata for retries.

## Where to look first

- `src/mapping.ts`
- `src/metadata.ts`
- `test/unit/`

## Specs

- `../../../docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`
```

Commit:

```bash
git add packages/runtime/bpmn-worker
git commit -m "feat(bpmn-worker): add workflow mapping core"
```

---

### Task 8: Add Worker Integration Seams

**Files:**
- Create: `packages/runtime/bpmn-worker/src/worker.ts`
- Create: `packages/runtime/bpmn-worker/src/operaton.ts`
- Create: `packages/runtime/bpmn-worker/src/command-client.ts`
- Modify: `packages/runtime/bpmn-worker/src/index.ts`
- Test: `packages/runtime/bpmn-worker/test/integration/worker.test.ts`

- [x] **Step 1: Write fake-seam integration test**

Create `packages/runtime/bpmn-worker/test/integration/worker.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runWorkflowEventOnce, type OperatonClient, type RntmeCommandClient } from '../../src/index.js';

describe('runWorkflowEventOnce', () => {
  it('starts process and completes a service task through command client', async () => {
    const calls: string[] = [];
    const operaton: OperatonClient = {
      async startProcess(input) {
        calls.push(`start:${input.processId}:${input.businessKey}`);
        return { processInstanceId: 'proc_1' };
      },
      async fetchAndLock() {
        return [{ id: 'task_1', taskId: 'reserveStock', processInstanceId: 'proc_1', activityInstanceId: 'act_1', variables: { orderId: 'ord_1' } }];
      },
      async completeTask(id, variables) {
        calls.push(`complete:${id}:${String((variables as { reservation?: { reserved?: boolean } }).reservation?.reserved)}`);
      },
      async failTask(id, message) {
        calls.push(`fail:${id}:${message}`);
      },
    };
    const commands: RntmeCommandClient = {
      async execute(bindingRef, input, metadata) {
        calls.push(`command:${bindingRef}:${String((input as { orderId?: string }).orderId)}:${metadata.commandId}`);
        return { reserved: true, reservationId: 'res_1' };
      },
    };

    await runWorkflowEventOnce({
      manifest: {
        workflowVersion: 1,
        definitions: [{ id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' }],
        messageStarts: [
          {
            id: 'orderPlaced',
            definition: 'orderFulfillment',
            messageName: 'OrderPlaced',
            event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
            businessKey: '$event.data.orderId',
            variables: { orderId: '$event.data.orderId' },
          },
        ],
        serviceTasks: [
          {
            definition: 'orderFulfillment',
            taskId: 'reserveStock',
            bindingRef: 'inventory.reserveStock',
            input: { orderId: '$process.orderId' },
            resultVariable: 'reservation',
          },
        ],
      },
      event: {
        id: 'evt_1',
        correlationId: 'corr_1',
        data: { orderId: 'ord_1' },
      },
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton,
      commands,
    });

    expect(calls).toEqual([
      'start:orderFulfillment:ord_1',
      'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_1',
      'complete:task_1:true',
    ]);
  });
});
```

Run: `pnpm -F @rntme/bpmn-worker test -- test/integration/worker.test.ts`

Expected: FAIL with missing worker API.

- [x] **Step 2: Define seam interfaces**

Create `packages/runtime/bpmn-worker/src/operaton.ts`:

```ts
export type OperatonStartProcessInput = {
  readonly processId: string;
  readonly messageName: string;
  readonly businessKey: string;
  readonly variables: unknown;
};

export type OperatonTask = {
  readonly id: string;
  readonly taskId: string;
  readonly processInstanceId: string;
  readonly activityInstanceId: string;
  readonly variables: unknown;
};

export type OperatonClient = {
  readonly startProcess: (input: OperatonStartProcessInput) => Promise<{ readonly processInstanceId: string }>;
  readonly fetchAndLock: () => Promise<readonly OperatonTask[]>;
  readonly completeTask: (taskId: string, variables: unknown) => Promise<void>;
  readonly failTask: (taskId: string, message: string) => Promise<void>;
};
```

Create `packages/runtime/bpmn-worker/src/command-client.ts`:

```ts
import type { CommandMetadata } from './types.js';

export type RntmeCommandClient = {
  readonly execute: (bindingRef: string, input: unknown, metadata: CommandMetadata) => Promise<unknown>;
};
```

- [x] **Step 3: Implement single-event worker core**

Create `packages/runtime/bpmn-worker/src/worker.ts`:

```ts
import type { WorkflowArtifact, WorkflowEventRef } from '@rntme/workflows';
import { evaluateMappingValue } from './mapping.js';
import { buildCommandMetadata } from './metadata.js';
import type { EventEnvelopeLike } from './types.js';
import type { OperatonClient } from './operaton.js';
import type { RntmeCommandClient } from './command-client.js';

export type RunWorkflowEventOnceInput = {
  readonly manifest: WorkflowArtifact;
  readonly event: EventEnvelopeLike;
  readonly eventRef: WorkflowEventRef;
  readonly operaton: OperatonClient;
  readonly commands: RntmeCommandClient;
};

export async function runWorkflowEventOnce(input: RunWorkflowEventOnceInput): Promise<void> {
  const start = input.manifest.messageStarts.find(
    (candidate) =>
      candidate.event.service === input.eventRef.service &&
      candidate.event.aggregateType === input.eventRef.aggregateType &&
      candidate.event.eventType === input.eventRef.eventType,
  );
  if (start === undefined) return;

  const definition = input.manifest.definitions.find((candidate) => candidate.id === start.definition);
  if (definition === undefined) return;

  const variables = Object.fromEntries(
    Object.entries(start.variables ?? {}).map(([key, value]) => [
      key,
      evaluateMappingValue(value, { event: input.event, process: {} }),
    ]),
  );
  const businessKey = String(evaluateMappingValue(start.businessKey, { event: input.event, process: {} }) ?? '');
  const process = await input.operaton.startProcess({
    processId: definition.processId,
    messageName: start.messageName,
    businessKey,
    variables,
  });

  const tasks = await input.operaton.fetchAndLock();
  for (const task of tasks.filter((candidate) => candidate.processInstanceId === process.processInstanceId)) {
    const mapping = input.manifest.serviceTasks.find((candidate) => candidate.taskId === task.taskId);
    if (mapping === undefined) continue;
    try {
      const commandInput = Object.fromEntries(
        Object.entries(mapping.input ?? {}).map(([key, value]) => [
          key,
          evaluateMappingValue(value, { event: input.event, process: task.variables }),
        ]),
      );
      const metadata = buildCommandMetadata({
        processInstanceId: task.processInstanceId,
        taskId: task.taskId,
        activityInstanceId: task.activityInstanceId,
        sourceEventId: input.event.eventId ?? input.event.id ?? null,
        sourceCorrelationId: input.event.correlationId ?? input.event.correlationid ?? null,
        previousCommandId: null,
      });
      const result = await input.commands.execute(mapping.bindingRef, commandInput, metadata);
      const completionVars =
        mapping.resultVariable === undefined ? {} : { [mapping.resultVariable]: result };
      await input.operaton.completeTask(task.id, completionVars);
    } catch (cause) {
      await input.operaton.failTask(task.id, cause instanceof Error ? cause.message : String(cause));
    }
  }
}
```

Update `packages/runtime/bpmn-worker/src/index.ts`:

```ts
export type { RntmeCommandClient } from './command-client.js';
export type { OperatonClient, OperatonTask, OperatonStartProcessInput } from './operaton.js';
export type {
  CommandMetadata,
  EventEnvelopeLike,
  LoadedWorkerManifest,
  WorkerConfig,
} from './types.js';
export { evaluateMappingValue } from './mapping.js';
export { buildCommandMetadata } from './metadata.js';
export { runWorkflowEventOnce, type RunWorkflowEventOnceInput } from './worker.js';
```

- [x] **Step 4: Verify worker integration seam**

Run:

```bash
pnpm -F @rntme/bpmn-worker test
pnpm -F @rntme/bpmn-worker typecheck
```

Expected: both exit 0.

- [x] **Step 5: Commit worker seam**

```bash
git add packages/runtime/bpmn-worker
git commit -m "feat(bpmn-worker): add operaton command bridge seams"
```

---

### Task 9: Add Order Fulfillment Demo Blueprint

**Files:**
- Create: `demo/order-fulfillment-blueprint/project.json`
- Create: `demo/order-fulfillment-blueprint/pdm/pdm.json`
- Create: `demo/order-fulfillment-blueprint/pdm/entities/Order.json`
- Create: `demo/order-fulfillment-blueprint/pdm/entities/InventoryItem.json`
- Create: `demo/order-fulfillment-blueprint/pdm/entities/StockReservation.json`
- Create: `demo/order-fulfillment-blueprint/services/orders/**`
- Create: `demo/order-fulfillment-blueprint/services/inventory/**`
- Create: `demo/order-fulfillment-blueprint/workflows/workflows.json`
- Create: `demo/order-fulfillment-blueprint/workflows/order-fulfillment.bpmn`
- Create: `demo/order-fulfillment-blueprint/README.md`
- Test: `packages/artifacts/blueprint/test/smoke-order-fulfillment-demo.test.ts`

- [x] **Step 1: Write demo smoke test**

Create `packages/artifacts/blueprint/test/smoke-order-fulfillment-demo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadComposedBlueprint } from '../src/index.js';

describe('order-fulfillment BPMN demo blueprint', () => {
  it('composes with validated workflows', () => {
    const result = loadComposedBlueprint('../../../demo/order-fulfillment-blueprint');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.workflows?.definitions[0]?.id).toBe('orderFulfillment');
    expect(Object.keys(result.value.services).sort()).toEqual(['inventory', 'orders']);
  });
});
```

Run: `pnpm -F @rntme/blueprint test -- test/smoke-order-fulfillment-demo.test.ts`

Expected: FAIL because the demo does not exist.

- [x] **Step 2: Create blueprint skeleton**

Create directories:

```bash
mkdir -p demo/order-fulfillment-blueprint/pdm/entities
mkdir -p demo/order-fulfillment-blueprint/services/orders/{graphs,bindings,qsm/projections,seed}
mkdir -p demo/order-fulfillment-blueprint/services/inventory/{graphs,bindings,qsm/projections,seed}
mkdir -p demo/order-fulfillment-blueprint/workflows
```

Create `demo/order-fulfillment-blueprint/project.json`:

```json
{
  "name": "order-fulfillment",
  "services": ["orders", "inventory"],
  "routes": {
    "http": {
      "/api/orders": "orders",
      "/api/inventory": "inventory"
    }
  },
  "middleware": {
    "requestContext": { "kind": "request-context" }
  },
  "mounts": [
    { "target": "http:/api/orders", "use": ["requestContext"] },
    { "target": "http:/api/inventory", "use": ["requestContext"] }
  ]
}
```

Create service descriptors:

```json
{ "kind": "domain" }
```

at both:

- `demo/order-fulfillment-blueprint/services/orders/service.json`
- `demo/order-fulfillment-blueprint/services/inventory/service.json`

- [x] **Step 3: Add PDM entities**

Create `demo/order-fulfillment-blueprint/pdm/pdm.json`:

```json
{
  "entities": ["Order", "InventoryItem", "StockReservation"]
}
```

Create `demo/order-fulfillment-blueprint/pdm/entities/Order.json`:

```json
{
  "ownerService": "orders",
  "kind": "owned",
  "table": "orders",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "sku": { "type": "string", "nullable": false, "column": "sku" },
    "quantity": { "type": "integer", "nullable": false, "column": "quantity" },
    "reservationId": { "type": "string", "nullable": true, "column": "reservation_id" },
    "cancelReason": { "type": "string", "nullable": true, "column": "cancel_reason" },
    "status": { "type": "string", "nullable": false, "column": "status" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["placed", "confirmed", "cancelled"],
    "transitions": {
      "place": { "from": null, "to": "placed", "affects": ["sku", "quantity"] },
      "confirm": { "from": "placed", "to": "confirmed", "affects": ["reservationId"] },
      "cancel": { "from": "placed", "to": "cancelled", "affects": ["cancelReason"] }
    }
  }
}
```

Create `demo/order-fulfillment-blueprint/pdm/entities/InventoryItem.json`:

```json
{
  "ownerService": "inventory",
  "kind": "owned",
  "table": "inventory_items",
  "fields": {
    "sku": { "type": "string", "nullable": false, "column": "sku" },
    "available": { "type": "integer", "nullable": false, "column": "available" },
    "status": { "type": "string", "nullable": false, "column": "status" }
  },
  "keys": ["sku"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active"],
    "transitions": {
      "create": { "from": null, "to": "active", "affects": ["available"] }
    }
  }
}
```

Create `demo/order-fulfillment-blueprint/pdm/entities/StockReservation.json`:

```json
{
  "ownerService": "inventory",
  "kind": "owned",
  "table": "stock_reservations",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "orderId": { "type": "string", "nullable": false, "column": "order_id" },
    "sku": { "type": "string", "nullable": false, "column": "sku" },
    "quantity": { "type": "integer", "nullable": false, "column": "quantity" },
    "reason": { "type": "string", "nullable": true, "column": "reason" },
    "status": { "type": "string", "nullable": false, "column": "status" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["reserved", "rejected"],
    "transitions": {
      "reserve": { "from": null, "to": "reserved", "affects": ["orderId", "sku", "quantity"] },
      "reject": { "from": null, "to": "rejected", "affects": ["orderId", "sku", "quantity", "reason"] }
    }
  }
}
```

- [x] **Step 4: Add QSM mirrors**

Create `demo/order-fulfillment-blueprint/services/orders/qsm/qsm.json`:

```json
{
  "projections": {
    "OrderView": {
      "backing": "entity-mirror",
      "source": { "entity": "Order" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": ["sku", "quantity", "reservationId", "cancelReason", "status"]
    }
  },
  "relations": {}
}
```

Create `demo/order-fulfillment-blueprint/services/inventory/qsm/qsm.json`:

```json
{
  "projections": {
    "InventoryItemView": {
      "backing": "entity-mirror",
      "source": { "entity": "InventoryItem" },
      "keys": ["sku"],
      "grain": ["sku"],
      "exposed": ["available", "status"]
    },
    "StockReservationView": {
      "backing": "entity-mirror",
      "source": { "entity": "StockReservation" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": ["orderId", "sku", "quantity", "reason", "status"]
    }
  },
  "relations": {}
}
```

- [x] **Step 5: Add workflow manifest and BPMN source**

Create `demo/order-fulfillment-blueprint/workflows/workflows.json`:

```json
{
  "workflowVersion": 1,
  "definitions": [
    {
      "id": "orderFulfillment",
      "bpmnFile": "order-fulfillment.bpmn",
      "processId": "orderFulfillment"
    }
  ],
  "messageStarts": [
    {
      "id": "orderPlaced",
      "definition": "orderFulfillment",
      "messageName": "OrderPlaced",
      "event": {
        "service": "orders",
        "aggregateType": "Order",
        "eventType": "OrderPlaced"
      },
      "businessKey": "$event.data.id",
      "variables": {
        "orderId": "$event.data.id",
        "sku": "$event.data.sku",
        "quantity": "$event.data.quantity"
      }
    }
  ],
  "serviceTasks": [
    {
      "definition": "orderFulfillment",
      "taskId": "reserveStock",
      "bindingRef": "inventory.reserveStock",
      "input": {
        "orderId": "$process.orderId",
        "sku": "$process.sku",
        "quantity": "$process.quantity"
      },
      "resultVariable": "reservation"
    },
    {
      "definition": "orderFulfillment",
      "taskId": "confirmOrder",
      "bindingRef": "orders.confirmOrder",
      "input": {
        "orderId": "$process.orderId",
        "reservationId": "$process.reservation.reservationId"
      }
    },
    {
      "definition": "orderFulfillment",
      "taskId": "cancelOrder",
      "bindingRef": "orders.cancelOrder",
      "input": {
        "orderId": "$process.orderId",
        "reason": "$process.reservation.reason"
      }
    }
  ]
}
```

Create `demo/order-fulfillment-blueprint/workflows/order-fulfillment.bpmn` as a minimal BPMN XML file with `process id="orderFulfillment"`, a message start, service tasks with ids `reserveStock`, `confirmOrder`, `cancelOrder`, and an exclusive gateway. The XML can be minimal but must be accepted by the chosen Operaton deployment API during Task 11 smoke; if Operaton rejects it, fix the XML there without changing `workflows.json`.

- [x] **Step 6: Add graph and binding artifacts**

Add command/query graphs and bindings for:

`orders`:

- `placeOrder`
- `confirmOrder`
- `cancelOrder`
- `getOrder`

`inventory`:

- `reserveStock`
- `getReservation`

Create these graph files with the same authoring shape already used by `demo/notes-blueprint/services/app/graphs/createNote.json`: `signature.inputs`, `signature.output`, and `nodes[]`.

For `orders/placeOrder.json`, use inputs `sku: string` and `quantity: integer`, generate `newId` with `type: "uuid"`, and emit aggregate `Order`, transition `place`, payload `{ "sku": { "$param": "sku" }, "quantity": { "$param": "quantity" } }`.

For `orders/confirmOrder.json`, use inputs `orderId: string` and `reservationId: string`; emit aggregate `Order`, aggregateId `{ "$param": "orderId" }`, transition `confirm`, payload `{ "reservationId": { "$param": "reservationId" } }`.

For `orders/cancelOrder.json`, use inputs `orderId: string` and `reason: string`; emit aggregate `Order`, aggregateId `{ "$param": "orderId" }`, transition `cancel`, payload `{ "cancelReason": { "$param": "reason" } }`.

For `orders/getOrder.json`, use input `id: string`, `findMany` from `OrderView`, filter `orderView.id == $param.id`, limit 1, output `row<OrderView>`.

For `inventory/reserveStock.json`, use inputs `orderId: string`, `sku: string`, and `quantity: integer`. The first implementation may use a deterministic test fixture branch by SKU: emit `StockReserved` when `sku != "missing-stock"` and emit `StockReservationRejected` when `sku == "missing-stock"`. Keep this branch in graph authoring if the compiler supports the required guard; otherwise implement `reserveStock` as a code command handler in a follow-up task before enabling deployed smoke.

For `inventory/getReservation.json`, use input `orderId: string`, `findMany` from `StockReservationView`, filter `stockReservationView.orderId == $param.orderId`, limit 1, output `row<StockReservationView>`.

- [x] **Step 7: Verify demo compose**

Run:

```bash
pnpm -F @rntme/workflows build
pnpm -F @rntme/blueprint test -- test/smoke-order-fulfillment-demo.test.ts
```

Expected: PASS.

- [x] **Step 8: Add demo README**

Create `demo/order-fulfillment-blueprint/README.md` explaining:

- services and owned entities;
- BPMN process flow;
- success/failure smoke expectations;
- deploy target requires provisioned Redpanda and provisioned Operaton.

- [x] **Step 9: Commit demo**

```bash
git add demo/order-fulfillment-blueprint packages/artifacts/blueprint/test/smoke-order-fulfillment-demo.test.ts
git commit -m "feat(demo): add order fulfillment bpmn blueprint"
```

---

### Task 10: Platform Executor Plumbing And Smoke Hooks

**Files:**
- Modify: `packages/platform/platform-core/src/schemas/deploy-target.ts`
- Modify: `packages/platform/platform-core/src/repos/deploy-target-repo.ts`
- Modify: `packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts`
- Modify: `apps/platform-http/src/deploy/build-deploy-config.ts`
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [x] **Step 1: Confirm executor files**

Run:

```bash
rg -n "buildProjectDeploymentConfig|renderDokployPlan|applyDokployPlan|verify|smoke|deployment" apps/platform-http/src apps/platform-http/test
```

Expected hits include `apps/platform-http/src/deploy/build-deploy-config.ts`, `apps/platform-http/src/deploy/executor.ts`, `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts`, and `apps/platform-http/test/unit/deploy/executor.test.ts`. Do not edit unrelated UI pages.

- [x] **Step 2: Add failing deploy-config test**

In `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts`, add:

```ts
it('passes workflow deployment config through to deploy-core', () => {
  const config = buildProjectDeploymentConfig(
    {
      ...target(),
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      },
    },
    'acme',
    {},
  );

  expect(config.workflows).toEqual({
    engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
    worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
  });
});
```

Update the local `target(): DeployTarget` helper with:

```ts
    workflows: null,
```

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/build-deploy-config.test.ts
```

Expected: FAIL because workflow config is not wired through.

- [x] **Step 3: Add platform target schema support**

In `packages/platform/platform-core/src/schemas/deploy-target.ts`, add:

```ts
export const DeployTargetWorkflowsSchema = z
  .object({
    engine: z
      .object({
        kind: z.literal('operaton'),
        mode: z.literal('provisioned'),
        image: z.string().min(1),
      })
      .strict(),
    worker: z
      .object({
        image: z.string().min(1),
      })
      .strict(),
  })
  .strict()
  .nullable()
  .default(null);
export type DeployTargetWorkflows = z.infer<typeof DeployTargetWorkflowsSchema>;
const PatchDeployTargetWorkflowsSchema = DeployTargetWorkflowsSchema.optional();
```

Add `workflows: DeployTargetWorkflowsSchema` to `CreateDeployTargetRequestSchema` and `DeployTargetSchema`.

Add `workflows: PatchDeployTargetWorkflowsSchema` to `UpdateDeployTargetRequestSchema`.

In `packages/platform/platform-core/src/repos/deploy-target-repo.ts`, add `workflows` to insert/update row types next to `eventBusConfig` and `modules`.

In `packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts`, map `workflows` through the existing JSON config persistence. If the storage table has no dedicated column, store it inside the existing deploy-target config object only after adding a migration plan; do not silently drop it.

- [x] **Step 4: Pass workflow config through deployment config builder**

In `apps/platform-http/src/deploy/build-deploy-config.ts`, preserve existing event-bus/auth behavior and add to the returned object:

```ts
    ...(target.workflows === null ? {} : { workflows: target.workflows }),
```

- [x] **Step 5: Add failing executor test**

In `apps/platform-http/test/unit/deploy/executor.test.ts`, add:

```ts
it('passes workflow artifacts into planning and records workflow resources', async () => {
  const planProject = vi.fn(() =>
    ok({
      project: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
      infrastructure: {
        eventBus: { kind: 'kafka' as const, mode: 'provisioned' as const, provider: 'redpanda' as const, resourceName: 'bus', internalBrokers: ['bus:9092'], image: 'redpanda:test', persistence: { mode: 'persistent' as const, volumeName: 'bus-data' } },
        workflowEngine: { kind: 'operaton' as const, mode: 'provisioned' as const, resourceName: 'operaton', internalBaseUrl: 'http://operaton:8080', image: 'operaton/operaton:test' },
      },
      workloads: [],
      edge: { routes: [], middleware: [] },
      diagnostics: { warnings: [] },
    }),
  );
  const applyPlan = vi.fn(async () =>
    ok({
      target: { kind: 'dokploy' as const, environmentId: 'env_default' },
      deployment: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const },
      resources: [
        { logicalId: 'workflow-engine', resourceKind: 'compose' as const, infrastructureKind: 'workflow-engine' as const, targetResourceId: 'compose_1', targetResourceName: 'operaton', action: 'created' as const },
        { logicalId: 'bpmn-worker', resourceKind: 'application' as const, workloadSlug: 'bpmn-worker', kind: 'bpmn-worker' as const, targetResourceId: 'app_1', targetResourceName: 'bpmn-worker', action: 'created' as const },
      ],
      urls: { projectUrl: 'https://app.example.test', publicRoutes: [], protectedRouteChecks: [] },
      renderedPlanDigest: 'sha256:rendered',
      warnings: [],
      verificationHints: { healthUrl: 'https://app.example.test/health', publicRouteUrls: [] },
    }),
  );
  const composed = {
    ...composedBlueprint(),
    workflows: {
      workflowVersion: 1,
      definitions: [{ id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' }],
      messageStarts: [],
      serviceTasks: [],
    } as never,
  };
  const { deps, deployments } = setup({
    loadComposed: () => ({ ok: true, value: composed }),
    planProject: planProject as never,
    applyPlan: applyPlan as never,
    targetEventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
    targetWorkflows: {
      engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
      worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
    },
  });

  await runDeployment('deployment-1', 'org-1', deps);

  expect(planProject).toHaveBeenCalledWith(
    expect.objectContaining({ workflows: composed.workflows }),
    expect.objectContaining({
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      },
    }),
    expect.any(Object),
  );
  expect(deployments.setApplyResult).toHaveBeenCalledWith(
    'deployment-1',
    expect.objectContaining({
      resources: expect.arrayContaining([
        expect.objectContaining({ infrastructureKind: 'workflow-engine' }),
        expect.objectContaining({ kind: 'bpmn-worker' }),
      ]),
    }),
  );
});
```

Extend the `setup` override type in that test file with:

```ts
    targetWorkflows?: unknown;
```

and add `workflows: overrides.targetWorkflows ?? null` to the fake deploy target object.

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
```

Expected: FAIL until executor adaptation passes `workflows` into deploy-core input/config.

- [x] **Step 6: Add smoke hook assertions**

Extend verification so workflow deployments add two checks:

- worker `/health` if the worker has a public/internal inspectable URL in apply result;
- order-fulfillment public API smoke only when the deployed project slug is `order-fulfillment`.

If platform smoke cannot reach internal worker health, assert resource presence and leave worker runtime health to Dokploy inspect. Do not add an unreachable HTTP request.

- [x] **Step 7: Verify platform tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/build-deploy-config.test.ts test/unit/deploy/executor.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: both exit 0.

- [x] **Step 8: Commit platform plumbing**

```bash
git add apps/platform-http packages/platform/platform-core packages/platform/platform-storage
git commit -m "feat(platform-http): pass workflow deployment config"
```

---

### Task 11: End-To-End Validation And Hardening

**Files:**
- Modify files in the package that owns a failing integration/smoke test.
- Test: package-level commands below.

- [x] **Step 1: Run focused package test suite**

Run:

```bash
pnpm -F @rntme/workflows test
pnpm -F @rntme/blueprint test
pnpm -F @rntme/deploy-core test
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/bpmn-worker test
```

Expected: all exit 0.

- [x] **Step 2: Run focused typechecks**

Run:

```bash
pnpm -F @rntme/workflows typecheck
pnpm -F @rntme/blueprint typecheck
pnpm -F @rntme/deploy-core typecheck
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/bpmn-worker typecheck
pnpm -F @rntme/platform-http typecheck
```

Expected: all exit 0.

- [x] **Step 3: Run layering check**

Run:

```bash
pnpm depcruise
```

Expected: exit 0. If `@rntme/workflows` imports deploy/runtime/app packages, fix the import direction rather than adding a dependency-cruiser carve-out.

- [x] **Step 4: Run order-fulfillment local compose smoke**

Run:

```bash
pnpm --filter @rntme/blueprint exec node --input-type=module -e "import { loadComposedBlueprint } from '@rntme/blueprint'; const r = loadComposedBlueprint('../../../demo/order-fulfillment-blueprint'); if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } console.log('OK:', r.value.project.services.join(','), r.value.workflows?.definitions.length ?? 0);"
```

Expected output contains:

```text
OK: orders,inventory 1
```

- [x] **Step 5: Commit hardening fixes**

If Steps 1-4 required code changes:

```bash
git add packages/artifacts/workflows packages/artifacts/blueprint packages/deploy/deploy-core packages/deploy/deploy-dokploy packages/runtime/bpmn-worker demo/order-fulfillment-blueprint apps/platform-http
git commit -m "test: harden provisioned bpmn workflow path"
```

If no changes were required, do not create an empty commit.

---

### Task 12: Documentation Touch

**Files:**
- Modify: `packages/artifacts/workflows/README.md`
- Modify: `packages/artifacts/blueprint/README.md`
- Modify: `packages/deploy/deploy-core/README.md`
- Modify: `packages/deploy/deploy-dokploy/README.md`
- Modify: `apps/platform-http/README.md`
- Modify: `demo/order-fulfillment-blueprint/README.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: stale Zeebe references only where they describe current guidance, not historical docs.

- [x] **Step 1: Update package READMEs**

Add concise workflow sections:

- `packages/artifacts/blueprint/README.md`: mention `workflows/` discovery and `@rntme/workflows` validation.
- `packages/deploy/deploy-core/README.md`: document `ProjectDeploymentConfig.workflows`, `infrastructure.workflowEngine`, and `bpmn-worker`.
- `packages/deploy/deploy-dokploy/README.md`: document rendered Operaton resource and worker env/files.
- `apps/platform-http/README.md`: document deploy executor support for workflow config and smoke evidence.

- [x] **Step 2: Update root README**

In `README.md`:

- add `@rntme/workflows` to package table;
- update internal artifact list to include `workflows`;
- update dependency graph if it is stale after adding the package;
- add glossary entry for `Workflow artifact` and `BPMN worker`.

- [x] **Step 3: Update AGENTS.md**

In `AGENTS.md`:

- add `@rntme/workflows` to repository map and package one-liners;
- update package layering diagram if necessary;
- add common task "Add a BPMN workflow";
- add decision map entry pointing to `docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`;
- update memory/prior decisions language from "Zeebe owns cross-service sagas" to "Operaton owns current BPMN orchestration; older Zeebe docs are historical" where it is active guidance.

- [x] **Step 4: Search for stale current-guidance Zeebe language**

Run:

```bash
rg -n "Zeebe|zeebe" README.md AGENTS.md CLAUDE.md docs packages apps modules demo
```

For every hit, choose one:

- leave unchanged if the file is historical and says so;
- update to Operaton if the text is current navigation/guidance;
- add a short note "historical Zeebe target" if the context would otherwise mislead.

- [x] **Step 5: Verify docs changed only where intended**

Run:

```bash
git diff -- README.md AGENTS.md CLAUDE.md docs packages apps demo | less
```

Check that market-facing wording does not leak internal IR vocabulary beyond existing README technical sections.

- [x] **Step 6: Commit docs**

```bash
git add README.md AGENTS.md CLAUDE.md docs packages apps demo
git commit -m "docs: document provisioned bpmn workflows"
```

---

### Task 13: Final Verification

**Files:**
- No planned edits unless verification finds a real issue.

- [x] **Step 1: Run full focused verification**

Run:

```bash
pnpm -F @rntme/workflows build
pnpm -F @rntme/workflows test
pnpm -F @rntme/workflows lint
pnpm -F @rntme/blueprint test
pnpm -F @rntme/deploy-core test
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/bpmn-worker test
pnpm depcruise
```

Expected: all commands exit 0.

- [x] **Step 2: Run broad typecheck if time allows**

Run:

```bash
pnpm -r run typecheck
```

Expected: exit 0. If unrelated packages fail, capture exact package/error and decide whether the failure is introduced by this branch before fixing it.

- [x] **Step 3: Review git diff**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Expected:

- only intended files are modified;
- `git diff --check` exits 0;
- no generated `dist/`, `coverage/`, or local env files are staged.

- [x] **Step 4: Final commit if verification fixes were needed**

If verification required fixes:

```bash
git add packages/artifacts/workflows packages/artifacts/blueprint packages/deploy/deploy-core packages/deploy/deploy-dokploy packages/runtime/bpmn-worker demo/order-fulfillment-blueprint apps/platform-http README.md AGENTS.md CLAUDE.md docs
git commit -m "chore: verify provisioned bpmn workflow path"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Notes

Spec coverage:

- Project-level `workflows/` artifact: Tasks 1-4, 9.
- Separate `@rntme/workflows` package: Tasks 1-3.
- Blueprint discovery/composition: Task 4.
- Deploy-core Operaton/worker planning: Task 5.
- Dokploy rendering/apply: Task 6.
- BPMN worker bridge: Tasks 7-8.
- Order fulfillment demo with success/failure branches: Task 9.
- Platform smoke/deploy executor: Task 10.
- Documentation touch: Task 12.
- Verification: Tasks 11 and 13.

Known execution choices:

- The first implementation should keep Operaton API calls behind `OperatonClient`; only fake-seam tests are required before real API verification.
- The demo models insufficient stock as a successful command result with `reserved: false`, not as a command failure.
- Use an explicit pinned Operaton image for real deploy targets; `operaton/operaton:test` appears only in unit fixtures.

---

## Addendum: close demo reservation branch gap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this addendum task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the order-fulfillment demo's insufficient-stock branch truthful by carrying a successful business payload through command results and by wiring a service-local code command handler for `inventory.reserveStock`.

**Architecture:** Keep Graph IR command execution unchanged for ordinary commands. Add an optional `result` payload to `CommandResult`, allow the runtime to load service-local command handlers from mounted runtime artifacts, and compose those handlers ahead of the existing Graph IR executor so only named overrides use code. The demo handler appends either `StockReserved` or `StockReservationRejected` and returns `{ reserved: true, reservationId }` or `{ reserved: false, reason }` for the BPMN gateway.

**Tech Stack:** TypeScript strict ESM, Vitest, Hono runtime, `@grpc/grpc-js`/`protobufjs`, SQLite event store.

### Addendum Task A: Optional command result payload

**Files:**
- Modify: `packages/runtime/bindings-http/src/executor-contract.ts`
- Modify: `packages/contracts/handlers/v1/src/handlers.ts`
- Modify: `packages/tooling/module-scaffold/src/handlers.ts`
- Modify: `packages/runtime/bindings-grpc/src/emit/emit-proto.ts`
- Modify: `packages/runtime/bindings-grpc/src/server/handler.ts`
- Modify: `packages/runtime/bindings-grpc/test/unit/emit-proto.test.ts`
- Modify: `packages/runtime/bindings-grpc/test/integration/create-server.test.ts`
- Modify: `packages/runtime/bindings-grpc/test/fixtures/golden/minimal.proto`

- [x] **Step A1: Write failing gRPC payload tests**

Add assertions that generated `CommandResult` includes a JSON payload field and that a command executor returning `value.result` is visible to a gRPC client.

Run:

```bash
pnpm -F @rntme/bindings-grpc test -- test/unit/emit-proto.test.ts test/integration/create-server.test.ts
```

Expected before implementation: FAIL because `CommandResult` has no payload/result field and the server drops executor payloads.

- [x] **Step A2: Implement optional payload transport**

Add `result?: unknown` to command execution result types. Emit `google.protobuf.Struct result = 6;` in the generated proto, import `google/protobuf/struct.proto`, and copy `out.value.result` into the gRPC response only when present.

- [x] **Step A3: Verify**

Run:

```bash
pnpm -F @rntme/bindings-grpc test -- test/unit/emit-proto.test.ts test/integration/create-server.test.ts
pnpm -F @rntme/bindings-grpc typecheck
pnpm -F @rntme/contracts-handlers-v1 test
```

Expected: all commands exit 0.

### Addendum Task B: Runtime service-local code command handlers

**Files:**
- Modify: `packages/runtime/runtime/src/manifest/schema.ts`
- Modify: `packages/runtime/runtime/src/manifest/types.ts`
- Modify: `packages/runtime/runtime/src/manifest/validate.ts`
- Modify: `packages/runtime/runtime/src/types.ts`
- Modify: `packages/runtime/runtime/src/load/load-service.ts`
- Modify: `packages/runtime/runtime/src/start/start-service.ts`
- Create: `packages/runtime/runtime/src/plugins/executors/composite-command-executor.ts`
- Test: `packages/runtime/runtime/test/integration/startup.test.ts`

- [x] **Step B1: Write failing runtime handler test**

Add an integration test that creates a temporary copy of the issue-tracker fixture, writes `commands/handlers.mjs`, sets `manifest.commands.handlersModule = "commands/handlers.mjs"`, boots with gRPC enabled, and asserts the named handler result is returned through gRPC while other graph commands still use the Graph IR fallback.

Run:

```bash
pnpm -F @rntme/runtime test -- test/integration/startup.test.ts
```

Expected before implementation: FAIL because `commands` is rejected as an unknown manifest key or the handler is never loaded.

- [x] **Step B2: Implement manifest and executor wiring**

Add `commands?: { handlersModule?: string }` to manifest parse/validate output. Store the artifact directory on `ValidatedService`. In `startService`, load the ESM handler module from the service artifact directory when configured, accept either `handlers` or `default` as a handler map, and use a composite executor that tries loaded handlers first and falls back to `GraphIrCommandExecutor` on `COMMAND_NOT_FOUND`.

- [x] **Step B3: Verify**

Run:

```bash
pnpm -F @rntme/runtime test -- test/integration/startup.test.ts test/unit/code-command-executor.test.ts test/integration/plugin-contracts.test.ts
pnpm -F @rntme/runtime typecheck
```

Expected: all commands exit 0.

### Addendum Task C: Platform runtime artifact handler files

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`
- Modify: `apps/platform-http/README.md`

- [x] **Step C1: Write failing platform artifact test**

Add a bundled blueprint file `services/api/commands/handlers.mjs` to the deploy executor unit test and assert generated runtime files contain `commands/handlers.mjs` plus `manifest.commands.handlersModule`.

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
```

Expected before implementation: FAIL because command handler files are not copied and the runtime manifest has no `commands` block.

- [x] **Step C2: Implement optional command file copying**

When `services/<slug>/commands/handlers.mjs` exists in a published blueprint, copy the service `commands/` directory into runtime artifacts and add `{ "commands": { "handlersModule": "commands/handlers.mjs" } }` to that service runtime manifest.

- [x] **Step C3: Verify**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: all commands exit 0.

### Addendum Task D: Order-fulfillment failure branch demo

**Files:**
- Create: `demo/order-fulfillment-blueprint/services/inventory/commands/handlers.mjs`
- Modify: `demo/order-fulfillment-blueprint/workflows/workflows.json`
- Modify: `demo/order-fulfillment-blueprint/workflows/order-fulfillment.bpmn`
- Modify: `demo/order-fulfillment-blueprint/README.md`
- Modify: `packages/artifacts/blueprint/test/smoke-order-fulfillment-demo.test.ts`
- Modify: `packages/runtime/bpmn-worker/test/integration/worker.test.ts`

- [x] **Step D1: Write failing demo and worker tests**

Update smoke assertions to expect `reservation.reserved`, `$process.reservation.reservationId`, and `$process.reservation.reason`. Add a worker integration test where fake command execution returns `{ reserved: false, reason: "insufficient stock" }` and the completed task variables preserve that successful business result.

Run:

```bash
pnpm -F @rntme/blueprint test -- test/smoke-order-fulfillment-demo.test.ts
pnpm -F @rntme/bpmn-worker test -- test/integration/worker.test.ts
```

Expected before implementation: FAIL because the demo still branches on `aggregateId` and the README says cancellation is future work.

- [x] **Step D2: Implement demo handler and workflow paths**

Add a service-local `reserveStock` handler. It should use SKU `missing-stock` as the deterministic insufficient-stock fixture, append `StockReservationRejected`, and return `{ result: { reserved: false, reason: "insufficient stock" } }`; all other SKUs append `StockReserved` and return `{ result: { reserved: true, reservationId } }`. Update BPMN gateway conditions and workflow command inputs to use the typed result.

- [x] **Step D3: Verify**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/smoke-order-fulfillment-demo.test.ts
pnpm -F @rntme/bpmn-worker test -- test/integration/worker.test.ts
```

Expected: both commands exit 0.

### Addendum Task E: Documentation touch and review

**Files:**
- Modify: `packages/runtime/runtime/README.md`
- Modify: `packages/contracts/handlers/v1/README.md`
- Modify: `packages/runtime/bindings-grpc/README.md`
- Modify: `demo/order-fulfillment-blueprint/README.md`
- Modify: `apps/platform-http/README.md`

- [x] **Step E1: Update docs**

Document optional command result payloads, service-local handler module loading, platform handler artifact copying, and the demo's deterministic `missing-stock` failure branch.

- [x] **Step E2: Focused verification**

Run:

```bash
pnpm -F @rntme/bindings-grpc test -- test/unit/emit-proto.test.ts test/integration/create-server.test.ts
pnpm -F @rntme/runtime test -- test/integration/startup.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
pnpm -F @rntme/blueprint test -- test/smoke-order-fulfillment-demo.test.ts
pnpm -F @rntme/bpmn-worker test -- test/integration/worker.test.ts
pnpm -F @rntme/bindings-grpc typecheck
pnpm -F @rntme/runtime typecheck
pnpm -F @rntme/platform-http typecheck
```

Expected: all commands exit 0.
