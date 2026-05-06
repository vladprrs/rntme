# @rntme/bindings

HTTP bindings artifact: parser, layered validator, and OpenAPI 3.1 emitter for Graph IR operations. A binding now exposes a graph with `exposure: "read"` or `exposure: "action"`; the validator checks that declared exposure against the graph's inferred effects.

## Role In The System

- Depends on: `zod`; no runtime packages.
- Consumed by: `@rntme/bindings-http`, `@rntme/bindings-grpc`, `@rntme/runtime`, `@rntme/blueprint`, CLI/platform bundling.
- Pipeline: authoring JSON -> parse -> structural -> references -> consistency -> `ValidatedBindings` -> OpenAPI.

## File Map

```
src/
  index.ts              public barrel
  parse/schema.ts       strict Zod schema for bindings.json
  parse/parse.ts        parseBindingArtifact
  validate/
    structural.ts       path/method/inputFrom/redirect checks
    references.ts       graph signature + output shape resolution
    consistency.ts      exposure/effect and input binding checks
    index.ts            fail-fast orchestrator
  openapi/              OpenAPI 3.1 emitter
  types/
    artifact.ts         BindingArtifact, BindingEntry, BindingExposure
    resolvers.ts        BindingResolvers, GraphSignature, EffectSummary-backed signature types
    input-from.ts       callback/header/query/body/form input sources and response shape
    result.ts           Result helpers and ERROR_CODES
```

## Quick Start

```ts
import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
  type BindingResolvers,
} from '@rntme/bindings';

const raw = {
  version: '1.0',
  graphSpecRef: 'issues.graphs.v1',
  pdmRef: 'issues.domain.v1',
  qsmRef: 'issues.read.v1',
  bindings: {
    listIssues: {
      exposure: 'read',
      graph: 'listIssues',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/issues',
        parameters: [
          { name: 'status', in: 'query', bindTo: 'status', required: false },
          { name: 'limit', in: 'query', bindTo: 'limit', required: false },
        ],
      },
    },
  },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => id === 'listIssues'
    ? {
        id,
        inputs: {
          status: { type: { kind: 'scalar', primitive: 'string' }, mode: 'predicate_optional' },
          limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
        },
        output: { type: { kind: 'rowset', shape: 'IssueRow' }, from: 'out' },
        effects: { localReads: true, localEmits: [], calls: [], waits: false },
      }
    : null,
  resolveShape: (name) => name === 'IssueRow'
    ? { name, origin: 'qsm', fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } } }
    : null,
};

const parsed = parseBindingArtifact(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

const validated = validateBindings(parsed.value, resolvers);
if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

const openapi = generateOpenApi(validated.value, resolvers);
```

## Binding Shape

Each entry has:

- `exposure`: `"read"` or `"action"`.
- `graph`: graph id in the referenced Graph IR artifact.
- `target`: currently `{ engine: "sqlite", dialect: "sqlite" }`; stored as an opaque target descriptor.
- `http`: method, path, and parameter declarations.
- Optional `inputFrom`: binds graph inputs from request headers, query, body, or form fields. Keys must not overlap `http.parameters[].bindTo`.
- Optional `response`: callback/custom response rules. GET action bindings are allowed only when `response.onOk` or `response.onErr` redirects.

Module/service calls are represented in Graph IR with `call` nodes, and their effects are included in the graph signature.

## Validation Invariants

- Validation layers are fail-fast: parse -> structural -> references -> consistency.
- `exposure: "read"` forbids action effects: local emits and calls whose registry effect is `action`.
- `exposure: "action"` normally uses `POST`. `GET` is reserved for redirect-style callbacks.
- Action bindings cannot bind graph inputs from query parameters.
- Path placeholders and `in: "path"` parameters must match exactly; path params are always required.
- Root inputs cannot be bound to HTTP.
- Required/nullable graph inputs must be covered by either `http.parameters[]` or `inputFrom`.
- Output must be `row<Shape>` or `rowset<Shape>`; the shape is resolved through `BindingResolvers.resolveShape`.
- `inputFrom` keys must match graph input names and must not duplicate `parameters[].bindTo`.
- Redirect strings reject protocol-relative URLs and unallowlisted absolute origins.
- Decimal OpenAPI encoding defaults to string with `format: "decimal"`; pass `{ decimalEncoding: "number" }` to `generateOpenApi` to emit JSON numbers.

## Where To Look First

- Add a new binding field: `src/types/artifact.ts`, `src/parse/schema.ts`, then the relevant validator and OpenAPI emitter.
- Add a structural rule: `src/validate/structural.ts` plus `test/unit/validate/structural.test.ts`.
- Add an exposure/effect rule: `src/validate/consistency.ts` plus consistency tests.
- Change OpenAPI responses: `src/openapi/responses.ts`, `src/openapi/emit.ts`, and golden tests under `test/golden/`.
- Trace validation: `src/validate/index.ts` -> `structural.ts` -> `references.ts` -> `consistency.ts`.

## Specs

- [`../../../docs/superpowers/specs/2026-05-06-graph-ir-effect-operations-design.md`](../../../docs/superpowers/specs/2026-05-06-graph-ir-effect-operations-design.md) — effect operations, binding exposure, and handler removal.
- [`../../../docs/superpowers/specs/done/2026-04-14-bindings-design.md`](../../../docs/superpowers/specs/done/2026-04-14-bindings-design.md) — original artifact and OpenAPI design background.
- [`../../../docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md`](../../../docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md) — historical module/callback context now expressed through operation calls and `inputFrom`.
