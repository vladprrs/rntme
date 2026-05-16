# Bindings Authoring

HTTP bindings expose Graph IR operations. Author bindings after the graph files
exist and after each graph has a clear read/action exposure.

Package internals live in
[`../owners/packages/artifacts/bindings.md`](../owners/packages/artifacts/bindings.md).

## File

```text
services/<service>/bindings/bindings.json
```

Top-level shape:

```json
{
  "version": "1.0",
  "graphSpecRef": "../graphs",
  "pdmRef": "../../pdm",
  "qsmRef": "../qsm",
  "bindings": {}
}
```

## Binding Entry

```json
{
  "graph": "listNotes",
  "target": {
    "engine": "sqlite",
    "dialect": "sqlite"
  },
  "http": {
    "method": "GET",
    "path": "/notes",
    "parameters": [
      {
        "name": "limit",
        "in": "query",
        "bindTo": "limit",
        "required": false
      }
    ]
  },
  "exposure": "read"
}
```

Required fields:

- `exposure`: `"read"` or `"action"`.
- `graph`: graph id from `services/<service>/graphs/<graph>.json`.
- `target`: external blueprint authoring uses the Graph IR SQLite target shown
  above.
- `http`: method, path, and parameter mapping.

Optional fields:

- `inputFrom`: bind graph inputs from request headers, query, body, form fields,
  or raw body bytes.
- `response`: customize JSON or redirect responses.
- `allowedRedirectHosts`: allowlist absolute redirect origins.

## Exposure

Use `exposure: "read"` for graph operations that only read local state and
perform read-effect calls. A read binding usually uses `GET`.

Use `exposure: "action"` for graph operations that emit events or perform
action-effect calls. An action binding normally uses `POST`.

`GET` actions are reserved for redirect-style callbacks and must declare a
redirect `response`.

## HTTP Parameters

Supported parameter locations:

- `path`
- `query`
- `body`

Rules:

- `http.method` is `"GET"` or `"POST"`.
- `http.path` starts with `/` and contains no query string.
- Path placeholders use `{name}` and must match `in: "path"` parameters.
- Path parameters must be `required: true`.
- `GET` bindings cannot use body parameters.
- Action bindings cannot use `http.parameters[]` entries with `in: "query"`.
  Redirect-style callbacks may use `inputFrom.query` with a redirect response.
- `bindTo` names a graph input and must be unique within a binding.
- Required and nullable graph inputs must be covered by `parameters` or
  `inputFrom`.
- `defaulted` and `predicate_optional` inputs may be omitted or bound with
  `required: false`.

## `inputFrom`

Use `inputFrom` for values that should not appear as ordinary route parameters:

```json
{
  "inputFrom": {
    "authorization": {
      "from": "header",
      "name": "authorization",
      "required": true
    }
  }
}
```

Supported sources:

- `{ "from": "header", "name": "...", "required": true }`
- `{ "from": "query", "name": "...", "required": false }`
- `{ "from": "body", "path": "..." }`
- `{ "from": "form", "name": "...", "required": true }`
- `{ "from": "bodyBytes" }`

Each `inputFrom` key must match a graph input and must not duplicate any
`parameters[].bindTo`.

## Responses

Without `response`, OpenAPI emits the graph output as JSON. Outputs may be
`row<Shape>` or `rowset<Shape>`.

Use `response` when a binding needs custom JSON or redirects:

```json
{
  "response": {
    "onOk": { "redirect": "/settings?connected=1", "status": 302 },
    "onErr": { "json": "$error", "status": 400 }
  }
}
```

Redirect statuses are `302` or `303`. Absolute redirect origins must be
allowlisted with `allowedRedirectHosts`.

## Examples To Copy

- `demo/notes-blueprint/services/app/bindings/bindings.json`
- `demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json`
- `demo/order-fulfillment-blueprint/services/inventory/bindings/bindings.json`
- `demo/cv-extract-blueprint/services/app/bindings/bindings.json`
