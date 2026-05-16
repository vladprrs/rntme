# PDM Authoring

The Platform Domain Model is the project-wide domain source of truth. Author it
before QSM, Graph IR, bindings, UI, workflows, or seed data.

Package internals live in
[`../owners/packages/artifacts/pdm.md`](../owners/packages/artifacts/pdm.md).

## Files

```text
pdm/
  pdm.json
  entities/
    Note.json
    Project.json
```

`pdm/pdm.json` is the directory index:

```json
{ "version": "1" }
```

Each file in `pdm/entities/*.json` becomes one entity keyed by the filename
stem. `pdm/entities/Note.json` defines entity `Note`.

## Entity Shape

```json
{
  "ownerService": "app",
  "kind": "owned",
  "table": "notes",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "title": { "type": "string", "nullable": false, "column": "title" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": {
      "type": "datetime",
      "nullable": false,
      "column": "created_at",
      "generated": "createdAt"
    }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "deleted"],
    "transitions": {
      "create": {
        "from": null,
        "to": "active",
        "affects": ["title"]
      },
      "delete": {
        "from": "active",
        "to": "deleted"
      }
    }
  }
}
```

Required top-level fields:

- `ownerService`: service slug responsible for the entity.
- `kind`: `"owned"` or `"root"`.
- `table`: physical SQL table name.
- `fields`: logical field names mapped to scalar type, nullability, and column.
- `keys`: non-empty list of field names.
- `stateMachine`: optional for pure reference entities, but expected for
  mutable domain entities and required by QSM entity-mirror projections.

## Fields

Supported scalar types are:

```text
integer, decimal, string, boolean, date, datetime
```

Each field needs:

- `type`: one supported scalar.
- `nullable`: boolean.
- `column`: physical column name.
- `generated`: optional `"id"`, `"createdAt"`, `"updatedAt"`, or `"actor"`.

Generated fields are mirrored and emitted by downstream tooling, but state
machine `affects` must not list generated fields.

## Keys

Use logical field names, not SQL column names:

```json
"keys": ["id"]
```

Keys must reference declared fields and must not be empty.

## Relations

Relations are declared on the source entity. Use logical field names:

```json
{
  "relations": {
    "project": {
      "to": "Project",
      "cardinality": "one",
      "localKey": "projectId",
      "foreignKey": "id"
    }
  }
}
```

`to` must be an entity in the same PDM. Cross-service references are represented
inside the shared project PDM, not as foreign package types.

## State Machines And Event Types

State machines make mutable entities event-addressable:

- `stateField` must be a non-nullable `string` field.
- `initial` is always `null`.
- A creation transition has `from: null`.
- Creation transitions must declare `affects`.
- Self-loop transitions must declare a non-empty `affects`.
- `affects` cannot include key fields or generated fields.
- Every state must be reachable from a creation transition.

Each transition produces a PDM event type. By default the name is
`<Entity><TransitionPascal>`, such as `NoteCreate`. A transition may override
that with `eventType` when the domain language needs a different PascalCase
name.

These event types are used by Graph IR `emit`, workflows message starts, and
seed artifacts.

## Common Repairs

| Failure | Repair |
| --- | --- |
| Key references an unknown field | Add the field or fix the `keys` entry to use a logical field name. |
| Relation endpoint is unknown | Check `to`, `localKey`, and `foreignKey` against entity and field names. |
| State field is nullable or not a string | Make the state field non-nullable `string`. |
| Creation transition has no `affects` | Add an explicit `affects` array, even if the payload is small. |
| `affects` includes a key or generated field | Remove that field from `affects`; keys and generated fields are not mutable payload fields. |
| State is unreachable | Add a creation or forward transition that can reach the state. |

## Examples To Copy

- `demo/notes-blueprint/pdm/entities/Note.json`
- `demo/order-fulfillment-blueprint/pdm/entities/Order.json`
- `demo/order-fulfillment-blueprint/pdm/entities/StockReservation.json`
- `demo/cv-extract-blueprint/pdm/entities/Resume.json`
