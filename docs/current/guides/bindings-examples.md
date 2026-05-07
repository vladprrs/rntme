# Binding Examples: HTTP Artifact -> OpenAPI 3.1

Five examples, from minimal to kitchen sink, showing what
`generateOpenApi(validateBindings(parseBindingArtifact(input), resolvers), resolvers)`
produces. All examples are reproduced by
[`../demo-openapi.mjs`](/packages/artifacts/bindings/demo-openapi.mjs) (`node demo-openapi.mjs` after `pnpm build`).

## Pipeline

```text
binding artifact --parse--> BindingArtifact --validateStructural--> StructurallyValid
                                                                           |
          ValidatedBindings <--validateConsistency-- ResolvedBindings <--validateReferences--+
                  |
                  +--generateOpenApi--> OpenAPI 3.1 document
```

- `parseBindingArtifact` - Zod parse (`src/parse/parse.ts:5`).
- `validateStructural` - self-contained artifact checks: unique `method+path`,
  unique `(in,name)` and `bindTo`, symmetry between `{placeholder}` and `in:"path"`,
  `body` forbidden on `GET`, path parameters required (`src/validate/structural.ts:17`).
- `validateReferences` - resolves `graph` and `output.shape` through `resolvers`;
  checks `bindTo` against `signature.inputs` (`src/validate/references.ts:66`).
- `validateConsistency` - rejects `root` inputs, accepts only `rowset` outputs,
  checks `mode <-> required`, `type <-> location`, and requires every
  `required`/`nullable` input to be bound (`src/validate/consistency.ts:123`).
- `generateOpenApi` - side-effect-free emitter (`src/openapi/emit.ts:104`);
  resolvers are not called in this phase because everything is already in
  `ResolvedBinding.outputShape`.

## Domain Model

All examples use the same schema as the graph compiler
(`commerce.pdm.json` / `commerce.qsm.json`). Resolvers in `demo-openapi.mjs` return
simplified `GraphSignature` / `ResolvedShape` values:

| Shape | Fields |
| --- | --- |
| `OrderItem` | `id, orderId, productId, unitPrice(decimal), quantity` - all non-null |
| `CategorySalesRow` | `categoryId, revenue, totalQuantity, lineCount, avgItemPrice, categoryName?` (nullable) |

By default, `decimal` emits as `{type:'string', format:'decimal'}`; option
`decimalEncoding:'number'` switches it to `{type:'number'}` (`src/openapi/shapes.ts:8`).
Every shape field is included in `required`, including nullable fields: the key is always present
in responses, and absence is represented by `null` (`src/openapi/shapes.ts:58`).

Every binding in the artifact becomes an operation under the `method` key
(`get`/`post`); two different bindings with the same `method + path` are rejected at
the structural layer (`src/validate/structural.ts:88`).

---

## Example 1 - Minimal: `GET /v1/items`, No Parameters

**Goal:** fetch the whole table as exactly one operation.

```js
{
  version: '1.0',
  graphSpecRef: 'commerce.graphs.v1',
  pdmRef:       'commerce.domain.v1',
  qsmRef:       'commerce.read.v1',
  bindings: {
    listItems: {
      graph: 'listAllItems',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: { method: 'GET', path: '/v1/items', parameters: [] },
    },
  },
}
// signature: inputs: {}, output: { type: rowset<OrderItem>, from: 'items' }
```

**OpenAPI (abridged):**

```jsonc
{
  "openapi": "3.1.0",
  "info": { "title": "API", "version": "0.0.0" },
  "paths": {
    "/v1/items": {
      "get": {
        "operationId": "listItems",
        "responses": {
          "200": { "description": "OK", "content": { "application/json": {
            "schema": { "type": "array", "items": { "$ref": "#/components/schemas/OrderItem" } } } } },
          "400": { /* $ref ErrorResponse */ },
          "422": { /* $ref ErrorResponse */ },
          "500": { /* $ref ErrorResponse */ }
        }
      }
    }
  },
  "components": { "schemas": {
    "OrderItem":     { "type": "object", "required": ["id","orderId","productId","unitPrice","quantity"], "properties": { /* ... */ } },
    "ErrorResponse": { "type": "object", "required": ["code","message"], "properties": { "code": {"type":"string"}, "message": {"type":"string"}, "details": {} } }
  } }
}
```

Notes:
- `operationId` defaults to the binding key (`listItems`) and can be overridden through `http.operationId`
  (`src/openapi/emit.ts:89`).
- `info.title='API'`, `info.version='0.0.0'` are emitter defaults used when the artifact
  has no `openapi.info` and the caller passes no `options.info` (`src/openapi/emit.ts:32`).
- Response is always `type:'array'` with a `$ref` to the shape; singleton/scalar results are not supported at this stage
  (`src/validate/consistency.ts:41`).
- Standard `400/422/500` errors are included by default; disable with
  `generateOpenApi(v, r, { standardErrors: false })` (`src/openapi/emit.ts:27`, usage at
  `src/openapi/emit.ts:112`).

---

## Example 2 - Required Query Parameter

**Goal:** `GET /v1/items?minQty=...`, filter `quantity >= :minQty`.

```js
bindings: {
  itemsByMinQty: {
    graph: 'itemsByMinQty',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'GET', path: '/v1/items',
      parameters: [
        { name: 'minQty', in: 'query', bindTo: 'minQty', required: true },
      ],
    },
  },
}
// signature.inputs: { minQty: { type: scalar<integer>, mode: 'required' } }
```

**Parameters in the final operation:**

```jsonc
"parameters": [
  { "name": "minQty", "in": "query", "required": true, "schema": { "type": "integer" } }
]
```

Notes:
- `parameter.name` is the external HTTP name; `bindTo` is the graph input name. OpenAPI receives `name`
  (`src/openapi/parameters.ts:34`).
- `mode:'required'` allows only `required:true`; a mismatch is caught by the consistency layer
  with `BINDINGS_REQUIRED_MISMATCH` (`src/validate/consistency.ts:10`).
- The parameter schema is a projection of `input.type`; `mode` does not leak into the schema. It only affects
  `required` and `default` flags (`src/openapi/parameters.ts:31`).

---

## Example 3 - `predicate_optional` + `defaulted`

**Goal:** a price listing with optional filter and pagination:
`GET /v1/items/listing?minPrice=...&limit=...`.

```js
bindings: {
  priceListing: {
    graph: 'priceListing',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'GET', path: '/v1/items/listing',
      parameters: [
        { name: 'minPrice', in: 'query', bindTo: 'minPrice', required: false },
        { name: 'limit',    in: 'query', bindTo: 'limit',    required: false },
      ],
    },
  },
}
// signature.inputs:
//   minPrice: { type: scalar<decimal>, mode: 'predicate_optional' }
//   limit:    { type: scalar<integer>, mode: 'defaulted', default: 20 }
```

**Parameters:**

```jsonc
"parameters": [
  { "name": "minPrice", "in": "query", "required": false,
    "schema": { "type": "string", "format": "decimal" } },
  { "name": "limit",    "in": "query", "required": false,
    "schema": { "type": "integer", "default": 20 } }
]
```

Notes:
- `predicate_optional` and `defaulted` must use `required:false`
  (table `REQUIRED_BY_MODE`, `src/validate/consistency.ts:10`).
- `input.default` enters JSON Schema through `schemaWithDefault`
  only for `mode:'defaulted'` (`src/openapi/parameters.ts:19`); for `predicate_optional`,
  optionality is already encoded in SQL (`(? IS NULL) OR ...`), so at HTTP level it is simply
  `required:false`.
- `decimal` is encoded as string (precision-safe). For clients that reject this,
  use `generateOpenApi(v, r, { decimalEncoding: 'number' })` (`src/openapi/shapes.ts:13`).

---

## Example 4 - Path Parameter and Array in Body (POST)

**Goal:** `POST /v1/orders/{orderId}/items/search` with a JSON body containing an optional
`productIds` list; the graph filters within a specific order.

```js
bindings: {
  itemsOfOrder: {
    graph: 'itemsOfOrder',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'POST',
      path: '/v1/orders/{orderId}/items/search',
      parameters: [
        { name: 'orderId',    in: 'path', bindTo: 'orderId',    required: true  },
        { name: 'productIds', in: 'body', bindTo: 'productIds', required: false },
      ],
    },
  },
}
// signature.inputs:
//   orderId:    { type: scalar<integer>,     mode: 'required' }
//   productIds: { type: list<integer>,       mode: 'nullable' }
```

**Operation:**

```jsonc
"parameters": [
  { "name": "orderId", "in": "path", "required": true, "schema": { "type": "integer" } }
],
"requestBody": {
  "required": true,
  "content": { "application/json": { "schema": {
    "type": "object",
    "required": [],
    "properties": {
      "productIds": { "type": "array", "items": { "type": "integer" } }
    }
  } } }
}
```

Notes:
- Every `{name}` in the path must have a corresponding `in:"path"` parameter, and vice versa.
  Regex `/\{([^{}]+)\}/g` extracts placeholders (`src/validate/structural.ts:67`);
  mismatch gives `BINDINGS_PATH_PLACEHOLDER_MISMATCH`.
- `in:"path"` plus `required:false` is always an error: `BINDINGS_PATH_NOT_REQUIRED`
  (`src/validate/structural.ts:51`).
- `in:"body"` on `GET` is rejected by the structural layer (`BINDINGS_BODY_ON_GET`,
  `src/validate/structural.ts:60`). A list in `path` is impossible: `list` is allowed only in
  `query` and `body` (`src/validate/consistency.ts:51`).
- Body is always `application/json`; `requestBody.required:true` regardless of required flags on individual fields
  (`src/openapi/parameters.ts:68`). `required` in the inner schema contains only body parameters whose own `required:true`.
- A list in query would receive `style:'form', explode:true`, producing `?ids=1&ids=2&ids=3`
  (`src/openapi/parameters.ts:40`). Body does not need that hack.
- Subtle point: `mode:'nullable'` means SQL NULL is allowed, but today the emitter does not
  propagate nullability into the schema for a *parameter/body field*. The `productIds` schema has no `"null"` in its
  type. Nullable is reflected only in response shapes (`src/openapi/shapes.ts:30`). For users this means:
  to omit the list, omit the field entirely instead of writing `null`.

---

## Example 5 - Kitchen Sink: Aggregate With Four Parameters and `info` Override

**Goal:** reproduce the golden fixture
(`test/golden/category-sales/expected.openapi.json`), analogous to the fifth
`graph-ir-compiler` example but exposed as an HTTP operation. Demonstrates all three
parameter modes, `predicate_optional` + `defaulted` together, a custom response shape
with a nullable field, and an `info`/`servers` override through `artifact.openapi`.

```js
{
  version: '1.0',
  graphSpecRef: 'commerce.graphs.v1',
  pdmRef:       'commerce.domain.v1',
  qsmRef:       'commerce.read.v1',
  openapi: {
    info:    { title: 'Commerce Analytics API', version: '1.0.0' },
    servers: [{ url: 'https://api.example.com' }],
  },
  bindings: {
    getCategorySalesHttp: {
      graph: 'getCategorySales',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/analytics/category-sales',
        tags: ['analytics'],
        summary: 'Category sales aggregation',
        parameters: [
          { name: 'dateFrom',   in: 'query', bindTo: 'dateFrom',   required: true  },
          { name: 'dateTo',     in: 'query', bindTo: 'dateTo',     required: true  },
          { name: 'minRevenue', in: 'query', bindTo: 'minRevenue', required: false },
          { name: 'limit',      in: 'query', bindTo: 'limit',      required: false },
        ],
      },
    },
  },
}
// signature.inputs:
//   dateFrom/dateTo: scalar<date>    required
//   minRevenue:      scalar<decimal> predicate_optional
//   limit:           scalar<integer> defaulted(20)
// output: rowset<CategorySalesRow>  (includes nullable `categoryName`)
```

**OpenAPI (key fragments, `paths` + `components`):**

```jsonc
"paths": {
  "/v1/analytics/category-sales": {
    "get": {
      "operationId": "getCategorySalesHttp",
      "summary":     "Category sales aggregation",
      "tags":        ["analytics"],
      "responses": {
        "200": { "description": "OK", "content": { "application/json": {
          "schema": { "type": "array", "items": { "$ref": "#/components/schemas/CategorySalesRow" } } } } },
        "400": { /* $ref ErrorResponse */ },
        "422": { /* $ref ErrorResponse */ },
        "500": { /* $ref ErrorResponse */ }
      },
      "parameters": [
        { "name": "dateFrom",   "in": "query", "required": true,  "schema": { "type": "string",  "format": "date"    } },
        { "name": "dateTo",     "in": "query", "required": true,  "schema": { "type": "string",  "format": "date"    } },
        { "name": "minRevenue", "in": "query", "required": false, "schema": { "type": "string",  "format": "decimal" } },
        { "name": "limit",      "in": "query", "required": false, "schema": { "type": "integer", "default": 20       } }
      ]
    }
  }
},
"components": { "schemas": {
  "CategorySalesRow": {
    "type": "object",
    "required": ["categoryId","revenue","totalQuantity","lineCount","avgItemPrice","categoryName"],
    "properties": {
      "categoryId":    { "type": "integer" },
      "revenue":       { "type": "string", "format": "decimal" },
      "totalQuantity": { "type": "integer" },
      "lineCount":     { "type": "integer" },
      "avgItemPrice":  { "type": "string", "format": "decimal" },
      "categoryName":  { "type": ["string","null"] }
    }
  },
  "ErrorResponse": { /* ... */ }
} },
"servers": [{ "url": "https://api.example.com" }]
```

Notes:
- `artifact.openapi.info` and `artifact.openapi.servers` take priority over `options.info`/`options.servers`
  when calling `generateOpenApi`. Artifact values win; options are used only
  where the artifact has `undefined` (`src/openapi/emit.ts:34`). For `servers`, this is a whole-value `??`
  choice: if the artifact array is set, even empty, `options.servers` is ignored
  (`src/openapi/emit.ts:49`).
- `summary`, `tags`, and `description` are cosmetic and pass through to the operation 1:1
  (`src/openapi/emit.ts:92`).
- Nullable shape field `categoryName` emits as `type: ["string","null"]` (OpenAPI 3.1 union)
  and still remains in `required`: the contract is "key always exists, value may be `null`"
  (`src/openapi/shapes.ts:33`).
- `http.openapi` (per-operation) and `parameter.openapi` (per-parameter) are extension points
  for `x-*` / ready passthrough fields. They merge via deep merge: objects recursively,
  arrays/scalars replace (`src/openapi/passthrough.ts:5`). They are not used here for readability;
  setting `http.openapi = { 'x-rate-limit': 100, description: '...' }` would put those fields
  into the operation without extra logic.
- Adding a second binding with the same `method + path` makes the structural layer reject the artifact
  with `BINDINGS_DUPLICATE_METHOD_PATH` (`src/validate/structural.ts:95`). The key is
  `"${method} ${path}"`, so `GET /x` and `POST /x` are different keys and can coexist
  (merged into one `PathItem` during emit).

### Internal Representations

`validateBindings` returns `ValidatedBindings`, which is `ResolvedBindings` with a brand tag.
For each binding it contains:

```ts
// src/types/artifact.ts:57
type ResolvedBinding = {
  entry: BindingEntry;            // original http + target + graph id
  signature: GraphSignature;      // returned by resolveGraphSignature
  outputShape: ResolvedShape;     // returned by resolveShape (or placeholder for scalar)
};
```

The emitter reads only this already-resolved structure; it does no repeated lookups and no
graph parsing. That keeps `generateOpenApi` pure and cheap, while the references layer does
the ontology work.

---

## Not Yet Supported

See design doc `docs/history/specs/historical/2026-04-14-bindings-design.md`, section 2 (Non-goals):

- **Runtime HTTP adapter** - router + graph execution per HTTP request: a separate future
  package `@rntme/bindings-http`.
- **Outputs other than `rowset`** - `row` and scalars are rejected by the consistency layer
  (`BINDINGS_UNSUPPORTED_OUTPUT_TYPE`, `src/validate/consistency.ts:39`), even if resolver returns them.
- **`PUT` / `PATCH` / `DELETE`** - Zod schema accepts only `GET` and `POST`
  (`src/parse/schema.ts:28`). Graph IR is read-only today; the write layer comes separately.
- **Headers, cookies, security schemes, pagination, rate-limit** - not codified in the artifact;
  manual passthrough through `http.openapi` works, but the compiler does not know about them or validate them.
- **Scalar nullability in parameters and body** - `mode:'nullable'` does not become `type: [T, null]`
  in the parameter/body-field schema (see example 4). Reflected only in response shape.
- **Generator from GraphSpec** - a future `@rntme/graph-ir-compiler/from-graph-spec` can infer
  a reasonable default artifact from a graph; today the artifact is handwritten.
- **Serialization** - the SDK has neither YAML nor file output; result is returned as a JS object,
  and `JSON.stringify` is the caller's responsibility.
