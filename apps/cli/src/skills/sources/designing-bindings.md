---
name: designing-bindings
description: Use after designing-ui + designing-pdm, then sync with designing-graph-ir. Authors artifacts/bindings.json — the public HTTP surface for Graph IR operations.
---

## What you're building

`artifacts/bindings.json` bridges logical UI/data binding IDs to concrete HTTP routes. Each entry exposes exactly one Graph IR operation with `exposure: "read"` or `exposure: "action"`. The bindings package validates the HTTP shape, resolves graph inputs/output shapes, checks declared exposure against inferred operation effects, and emits OpenAPI 3.1.

Module calls are not authored as hidden binding hooks. Put external calls in the Graph IR operation with `call` nodes, then expose the graph through a binding.

## Checklist

1. From the UI artifact, enumerate every screen `data` binding. Each becomes a `read` exposure, normally `GET`, with path/query parameters mapped to Graph IR inputs via `bindTo`.
2. From the UI artifact, enumerate every `kind: "command"` action. Each becomes an `action` exposure, normally `POST`, with path/body parameters mapped to Graph IR inputs via `bindTo`.
3. For callback routes (OAuth, magic-link, hosted checkout returns), use `exposure: "action"` with `GET` only when `response.onOk` or `response.onErr` redirects.
4. Use REST-shaped paths: collection reads (`GET /v1/issues`), detail reads (`GET /v1/issues/{id}`), creation actions (`POST /v1/issues`), and transition actions (`POST /v1/issues/{id}/actions/submit`).
5. Ensure every `http.parameters[].bindTo` and every `inputFrom` key matches a Graph IR `signature.inputs` key.
6. Use `inputFrom` for headers/query/body/form fields that are not part of the regular HTTP parameter list, such as `authorization` for an Auth0 introspection call node.
7. Run `rntme project publish --dry-run`. Fix `BINDINGS_*` errors before moving on.

## Red flags

| Symptom | Problem |
|---|---|
| A read exposure points at a graph with `emit` or an action `call` | Consistency validation rejects it; use `exposure: "action"` or remove the action effect. |
| An action exposure uses query parameters for business inputs | Action inputs should be path/body/header/form unless this is a redirect callback modeled with `inputFrom`. |
| `inputFrom` duplicates a `parameters[].bindTo` value | One graph input has two sources; the structural layer rejects the binding. |
| A path placeholder has no matching `in: "path"` parameter | HTTP routing is ambiguous; placeholders and path params must match exactly. |
| A binding uses an HTTP path as a UI binding ID | UI `binding` values are logical IDs resolved through this artifact, not URLs. |
| A module call is modeled in `bindings.json` | Calls belong in Graph IR `call` nodes so effects, idempotency, and result dependencies are visible to the compiler. |

## Minimal Shape

```json
{
  "version": "1.0",
  "graphSpecRef": "notes.graphs.v1",
  "pdmRef": "notes.domain.v1",
  "qsmRef": "notes.read.v1",
  "bindings": {
    "listNotes": {
      "exposure": "read",
      "graph": "listNotes",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/v1/notes",
        "parameters": [
          { "name": "limit", "in": "query", "bindTo": "limit", "required": false }
        ]
      }
    },
    "createNote": {
      "exposure": "action",
      "graph": "createNote",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/v1/notes",
        "parameters": [
          { "name": "title", "in": "body", "bindTo": "title", "required": true },
          { "name": "body", "in": "body", "bindTo": "body", "required": true }
        ]
      },
      "inputFrom": {
        "authorization": { "from": "header", "name": "Authorization", "required": true }
      },
      "response": {
        "onOk": { "status": 201 }
      }
    }
  }
}
```

Walkthrough: `listNotes` exposes a read-only operation and returns the graph's declared `rowset<Shape>` result. `createNote` exposes an action operation; the graph can call `identity-auth0.IntrospectSession` using the `authorization` input, emit the local event, and return a custom `row<Shape>` result node. Runtime action responses include operation metadata such as event ids alongside the graph result.

## Common Error Codes

- `BINDINGS_EXPOSURE_ACTION_ON_READ_GRAPH` / `BINDINGS_READ_ON_ACTION_GRAPH` style consistency failures mean the binding exposure and graph effects disagree.
- `BINDINGS_UNKNOWN_GRAPH` means `graph` does not match a key in `artifacts/graph-ir.json`.
- `BINDINGS_UNKNOWN_BIND_TO` means a parameter or `inputFrom` key does not match `signature.inputs`.
- `BINDINGS_DUPLICATE_METHOD_PATH` means two entries claim the same route.
- `BINDINGS_CALLBACK_GET_REQUIRES_REDIRECT` means a GET action lacks redirect response behavior.

## Self-review

- Every UI `data` binding ID resolves to a `read` exposure.
- Every UI `kind: "command"` action ID resolves to an `action` exposure.
- Every route path is stable and resource-shaped.
- Every graph input is covered exactly once by `http.parameters[]` or `inputFrom`.
- Module/service calls are visible in Graph IR, not hidden in bindings.

## Next step

When this skill and `designing-graph-ir` agree on graph ids, input names, exposures, and result shapes, invoke Skill: designing-qsm and Skill: designing-graph-ir as needed, then Skill: composing-blueprint.
