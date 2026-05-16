# Graph IR Query Authoring

Use query graphs for read behavior: listing, filtering, detail lookup, search,
aggregation, and UI data loading. In project blueprints, read graphs are still
operation-era graph files and should end with a `result` node.

Package internals live in
[`../owners/packages/artifacts/graph-ir-compiler.md`](../owners/packages/artifacts/graph-ir-compiler.md).

## Files

```text
services/<service>/graphs/
  shapes.json
  listNotes.json
  getNote.json
```

`shapes.json` holds reusable output shapes:

```json
{
  "NoteView": {
    "fields": {
      "id": { "type": "string", "nullable": false },
      "title": { "type": "string", "nullable": false },
      "createdAt": { "type": "datetime", "nullable": false }
    }
  }
}
```

Each graph file contains one graph object. The graph `id` must match the
filename stem.

## Graph Skeleton

```json
{
  "id": "listNotes",
  "signature": {
    "inputs": {
      "limit": { "type": "integer", "mode": "defaulted", "default": 100 }
    },
    "output": { "type": "rowset<NoteView>", "from": "out" }
  },
  "nodes": [
    {
      "id": "items",
      "type": "findMany",
      "config": { "source": { "projection": "NoteView" } }
    },
    {
      "id": "out",
      "type": "result",
      "value": { "$ref": "items" }
    }
  ]
}
```

For blueprint reads, prefer QSM projections as sources. They are the read-side
tables maintained from PDM events. Entity sources are compiler-supported, but
service read endpoints should usually query projections.

## Signatures

Inputs are named graph parameters:

```json
{
  "status": { "type": "string", "mode": "predicate_optional" },
  "limit": { "type": "integer", "mode": "defaulted", "default": 50 }
}
```

Supported input modes:

| Mode | Use |
| --- | --- |
| `required` | Caller must provide the value. |
| `nullable` | Caller may provide null; graph logic must account for it. |
| `defaulted` | Runtime supplies `default` when the caller omits the value. |
| `predicate_optional` | Optional filter input; use only inside `filter.config.expr`. |
| `root` | Internal/root input mode; avoid for HTTP-facing blueprint reads. |

Outputs should be `row<Shape>` or `rowset<Shape>` for HTTP bindings. The `from`
field should point at the final `result` node.

## Read Nodes

Use these nodes for query graphs:

- `findMany`: start a rowset from an entity, projection, or event type.
- `findOne`: start a single row from an entity, projection, or event type with
  a `where` expression.
- `filter`: apply boolean expressions.
- `map`: project fields into a named shape; field coverage must exactly match
  the shape.
- `reduce`: group and aggregate into a named shape; group plus measures must
  cover every shape field.
- `sort`: order by one or more fields.
- `limit`: cap rows with a literal count or `$param`.
- `result`: select the value returned by the operation.

## Expressions

Common expression forms:

```json
{ "$param": "limit" }
```

```json
{ "$literal": "active" }
```

```json
{ "eq": ["noteView.status", { "$literal": "active" }] }
```

```json
{
  "and": [
    { "eq": ["noteView.status", { "$literal": "active" }] },
    { "eq": ["noteView.ownerSub", { "$param": "ownerSub" }] }
  ]
}
```

Plain strings are field paths. Wrap string values in `$literal`; otherwise the
compiler treats them as fields.

Supported operators include comparison (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`),
logic (`and`, `or`, `not`), arithmetic (`add`, `sub`, `mul`, `div`), `between`,
`case`, `is_null`, `like`, `concat`, and `coalesce`.

## Dot Paths

Dot paths start at the source alias. The alias is lower-camel-cased from the
source name:

- `NoteView` -> `noteView`
- `OrderView` -> `orderView`

For relation dot navigation, QSM must declare the relation path. `many`
relations validate as metadata but cannot be lowered for SQL dot navigation.

## Binding Expectations

Read bindings should usually declare `exposure: "read"` and use `GET`. A read
graph exposed as `read` may perform local reads and read-effect calls, but it
must not emit events or call action-effect operations.

Examples:

- `demo/notes-blueprint/services/app/graphs/listNotes.json`
- `demo/notes-blueprint/services/app/graphs/getNote.json`
- `demo/order-fulfillment-blueprint/services/orders/graphs/getOrder.json`
