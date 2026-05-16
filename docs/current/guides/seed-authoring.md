# Seed Authoring

Seed artifacts declare initial event envelopes for local data. Use seed when a
blueprint needs predictable starter records for demos, tests, or first-run
fixtures.

Package internals live in
[`../owners/packages/artifacts/seed.md`](../owners/packages/artifacts/seed.md).

## File

```text
services/<service>/seed/seed.json
```

Blueprint composition loads the file when the service advertises a seed artifact
through normal service artifact discovery.

## Shape

```json
{
  "seedVersion": 1,
  "events": [
    {
      "id": "seed:Note:welcome:v1",
      "subject": "Note-00000000-0000-0000-0000-000000000001",
      "rntAggregateType": "Note",
      "rntAggregateId": "00000000-0000-0000-0000-000000000001",
      "rntVersion": 1,
      "eventType": "NoteCreate",
      "data": {
        "title": "Welcome",
        "body": "Seeded note",
        "ownerSub": "system"
      },
      "time": "2026-04-29T00:00:00.000Z",
      "rntSchemaVersion": 1
    }
  ]
}
```

Rules:

- `seedVersion` is exactly `1`.
- Each event `id` is unique.
- `subject` groups a stream; `(subject, rntVersion)` must be unique.
- Versions are contiguous per subject starting at `1`.
- The first event for a subject must be a PDM creation transition.
- `rntAggregateType` must name a PDM entity.
- `eventType` must be derived from that entity's state-machine transition.
- `data` must contain exactly the payload fields for the event type.
- `time` is an ISO datetime string with an offset.
- Actor fields are optional; if one of `rntActorKind` and `rntActorId` is set,
  both must be set. Omitted actor defaults to system seed.

Seed event types correspond to service-owned PDM event types. Composition and
runtime validation catch unknown aggregate types, unknown event types, payload
mismatches, duplicate ids, duplicate versions, version gaps, and invalid
state-machine order.

## When To Use Seed

Use seed for:

- starter records a demo needs immediately;
- deterministic integration-test fixtures;
- local smoke data that should flow through the normal event pipeline.

Avoid seed for:

- data that should be produced by a user workflow;
- backfills or migrations;
- shortcuts that bypass PDM state-machine transitions.

## Examples To Copy

- `demo/notes-blueprint/services/app/seed/seed.json`
- `demo/cv-extract-blueprint/services/app/seed/seed.json`
