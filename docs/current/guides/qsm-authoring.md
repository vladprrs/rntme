# QSM Authoring

The Query-Side Materialized model defines service-owned read projections over
the project PDM. Author QSM after PDM and before Graph IR reads that query
projection tables or dot-navigate relations.

Package internals live in
[`../owners/packages/artifacts/qsm.md`](../owners/packages/artifacts/qsm.md).

## Files

```text
services/<service>/qsm/
  qsm.json
  projections/
    NoteView.json
```

`qsm/qsm.json` is the index and relation map:

```json
{
  "version": "1",
  "relations": {}
}
```

Projection files live in `qsm/projections/*.json`. The filename stem is the
projection name.

## Entity-Mirror Projection

Most service read models should start with an entity mirror:

```json
{
  "backing": "entity-mirror",
  "source": { "entity": "Note" },
  "keys": ["id"],
  "grain": ["id"],
  "exposed": ["title", "body", "ownerSub", "status"],
  "table": "notes"
}
```

Rules:

- `source.entity` must name a PDM entity.
- The PDM entity must have a `stateMachine`.
- `keys` must match the PDM entity keys.
- `grain` must match `keys`.
- `exposed` contains PDM field names available through the projection.
- `exposed` must not include generated fields.
- `table` is optional; when omitted, entity mirrors normalize to the PDM
  entity table.
- Only one entity-mirror projection is allowed per source entity.

`demo/notes-blueprint/services/app/qsm/projections/NoteView.json` is the
smallest current example.

## Relations

Current QSM uses the `relations` map in `qsm/qsm.json`. Do not write the removed
`relationRoles` field.

Relation keys have the shape `<SourceProjection>.<pdmRelationName>`:

```json
{
  "version": "1",
  "relations": {
    "NoteView.project": {
      "to": "ProjectView",
      "localKey": "projectId",
      "foreignKey": "id",
      "cardinality": "one",
      "role": "dimension"
    }
  }
}
```

Rules:

- The source projection is the key prefix before the dot.
- The relation name after the dot must match a PDM relation on the source
  entity.
- `to` is a target projection name, not an entity name.
- `localKey` and `foreignKey` are logical field names.
- QSM relation `to`, `localKey`, `foreignKey`, and `cardinality` must match the
  corresponding PDM relation.
- `role` is optional and currently an annotation.

Graph IR dot navigation depends on these relations. If a graph filters on
`noteView.project.name`, the QSM must declare the single-hop relation from
`NoteView` to `ProjectView`, and the PDM must declare the matching entity
relation.

## Cardinality Caveat

`cardinality: "many"` can parse and cross-reference, but SQL dot navigation
cannot lower it. Use `many` only as a forward-compatible declaration, not as a
relation you expect Graph IR reads to traverse today.

## Authoring Checklist

1. Confirm the PDM entity has a state machine.
2. Create one projection file per read model.
3. Set `backing` to `"entity-mirror"` unless you are working on package
   internals.
4. Match `keys` and `grain` to the PDM entity keys.
5. List only author-facing fields in `exposed`; omit generated fields.
6. Add `relations` only when Graph IR needs dot navigation.
7. Keep relation names and keys identical to the PDM relation.

## Common Repairs

| Failure | Repair |
| --- | --- |
| Entity mirror requires state machine | Add a PDM state machine or choose an entity that already has one. |
| Keys or grain mismatch | Copy the PDM entity `keys` into both QSM arrays. |
| Unknown exposed field | Use PDM logical field names, not column names. |
| Generated field in `exposed` | Remove generated fields; they are mirrored implicitly. |
| Relation target unknown | Create the target projection or fix `to`. |
| Relation not in PDM | Add the PDM relation first or remove the QSM relation. |
| Fan-out navigation error | Avoid Graph IR dot navigation across `many` relations. |

## Examples To Copy

- `demo/notes-blueprint/services/app/qsm/qsm.json`
- `demo/notes-blueprint/services/app/qsm/projections/NoteView.json`
- `demo/order-fulfillment-blueprint/services/orders/qsm/projections/OrderView.json`
- `demo/order-fulfillment-blueprint/services/inventory/qsm/projections/InventoryItemView.json`
