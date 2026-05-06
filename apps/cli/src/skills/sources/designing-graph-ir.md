---
name: designing-graph-ir
description: Use after designing-bindings. Paired with designing-qsm. Authors artifacts/graph-ir.json — effect-aware operation graphs for reads, actions, module calls, branches, emits, and results.
---

## What you're building

`artifacts/graph-ir.json` is an authoring spec with `version: "1.0-rc7"`, `pdmRef`, `qsmRef`, `shapes`, and `graphs`. Each graph is a typed DAG compiled as one operation. Effects are inferred from local reads, local emits, and `call` nodes; bindings expose the graph as either `exposure: "read"` or `exposure: "action"`.

Every operation graph should end in an explicit `result` node. Bindings and OpenAPI use `signature.output.type` (`row<Shape>` or `rowset<Shape>`) plus `signature.output.from` to determine the response.

## Checklist

1. From `bindings.json`, enumerate every binding entry and its `graph` id. Read exposures must have no action effects. Action exposures may read, call, branch, and emit.
2. Declare every response shape in `shapes`. Use `rowset<ShapeName>` for list/aggregation reads and `row<ShapeName>` for single rows or action responses.
3. Declare every external input in `signature.inputs`. Inputs are supplied by binding `http.parameters[]` or `inputFrom`; module-call outputs are referenced with `$ref`, not declared as inputs.
4. For read operations, build a data chain with `findMany` or `findOne`, optional `filter`, optional `map`/`reduce`, optional `sort`, optional `limit`, and a final `result` node.
5. For action operations, add any local reads/guards first, then `call`, `branch`, `uuid`, and `emit` nodes as needed, followed by a `result` node with the business response.
6. For module/service calls, use `type: "call"` with `target`, `input`, and `policy`. Reference call outputs with `$ref`, for example `{ "$ref": "session.result.user_id" }`.
7. For state changes, use `emit` against a PDM aggregate/transition. Payload fields must match the transition's `affects` fields and types.
8. Run `rntme project publish --dry-run`. Fix `GRAPH_IR_*`, `STRUCT_*`, `SEM_*`, `CMD_*`, and operation effect errors before advancing.

## Red flags

| Symptom | Problem |
|---|---|
| A binding uses `exposure: "read"` but the graph has `emit` or an action `call` | Exposure and inferred effects disagree; make it an action or remove the effect. |
| A graph has no `result` node | Current runtime surfaces need an explicit response node. |
| A module call result is threaded through binding inputs | Calls belong inside the graph; use `$ref` to read call output. |
| `emit` references a PDM aggregate or transition that does not exist | Semantic validation emits `CMD_UNKNOWN_AGGREGATE` or `CMD_UNKNOWN_TRANSITION`. |
| Dot-navigation crosses service boundaries | Cross-service joins are forbidden. Use service/module operations or BPMN orchestration. |
| `predicate_optional` inputs are mixed with fixed params in one filter | Keep optional predicates in a dedicated filter to avoid positional SQL binding mistakes. |

## Read Operation Example

```json
{
  "id": "listNotes",
  "signature": {
    "inputs": {
      "limit": { "type": "integer", "mode": "defaulted", "default": 20 }
    },
    "output": { "type": "rowset<NoteRow>", "from": "out" }
  },
  "nodes": [
    {
      "id": "notes",
      "type": "findMany",
      "config": { "source": { "projection": "NoteView" } }
    },
    {
      "id": "paged",
      "type": "limit",
      "config": { "input": "notes", "count": { "$param": "limit" } }
    },
    {
      "id": "out",
      "type": "result",
      "value": { "$ref": "paged" }
    }
  ]
}
```

## Action Operation Example

```json
{
  "id": "createNote",
  "signature": {
    "inputs": {
      "title": { "type": "string", "mode": "required" },
      "body": { "type": "string", "mode": "required" },
      "authorization": { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<NoteActionResult>", "from": "out" }
  },
  "nodes": [
    {
      "id": "session",
      "type": "call",
      "target": { "module": "identity-auth0", "operation": "IntrospectSession" },
      "input": {
        "token": { "$param": "authorization" },
        "audience": { "$literal": "${auth.audience}" }
      },
      "policy": {
        "timeoutMs": 1000,
        "retry": { "attempts": 2, "retryOn": "transient" },
        "idempotency": { "mode": "none" },
        "onError": "fail"
      }
    },
    { "id": "newId", "type": "uuid", "config": {} },
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$node": "newId" },
        "transition": "create",
        "payload": {
          "title": { "$param": "title" },
          "body": { "$param": "body" },
          "ownerSub": { "$ref": "session.result.user_id" }
        }
      }
    },
    {
      "id": "out",
      "type": "result",
      "value": {
        "noteId": { "$ref": "emit.aggregateId" },
        "version": { "$ref": "emit.version" }
      }
    }
  ]
}
```

## Branching Pattern

Use `branch` when one action has mutually exclusive outcomes. The branch node selects which downstream node runs; unselected emit nodes expose `didRun: false`, which can be used in the result shape.

```json
{
  "id": "decision",
  "type": "branch",
  "cases": [
    { "when": { "gte": [{ "$ref": "item.available" }, { "$param": "quantity" }] }, "then": "emitReserved" },
    { "default": true, "then": "emitRejected" }
  ]
}
```

## Self-review

- Each graph has exactly one externally meaningful `result` node and `signature.output.from` points to it.
- Read bindings reference only read-effect graphs.
- Action bindings reference graphs whose state changes or external action calls are visible in inferred effects.
- Every `call` target resolves through the operation registry and has an idempotency policy.
- Every `emit` payload matches PDM transition fields.
- Every shape used by `signature.output.type`, `map.into`, or `reduce.into` is declared under `shapes`.

## Next step

When BOTH this skill and `designing-qsm` are green, re-check `designing-bindings` for matching inputs/exposures, then invoke Skill: composing-blueprint.
