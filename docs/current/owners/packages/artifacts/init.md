# @rntme/init

Project-level lifecycle init artifact parser and validator.

## Role in the system

- Depends on:
  - `@rntme/artifact-shared` for Result helpers and zod parse mapping.
  - `@rntme/pdm` for PDM resolver and derived event types supplied by blueprint.
  - `@rntme/seed` for `seed-events` validation in the first slice.
  - `zod` for structural parsing.
- Consumed by:
  - `@rntme/blueprint` during project composition.
- Position in pipeline:
  `init/init.json` + `init/files/**` -> parse -> structural validation -> cross-reference validation -> `ValidatedInitArtifact`.

## Artifact shape

`init/init.json` is project-level. It declares a project lifecycle BPMN process
and lifecycle init steps. The first supported provider is `seed-events`.

Example:

```json
{
  "initVersion": 1,
  "process": {
    "kind": "bpmn",
    "definition": "project-initialized.bpmn",
    "processId": "ProjectInitialized"
  },
  "steps": [
    {
      "id": "notes.welcome",
      "type": "init",
      "provider": "seed-events",
      "targetService": "app",
      "mode": "lifecycle",
      "input": { "path": "files/notes.seed.json" },
      "dependsOn": []
    }
  ]
}
```

## Public API

- `parseInitArtifact(raw)`
- `validateInitStructural(artifact)`
- `validateInitCrossRef(artifact, ctx)`
- `ERROR_CODES`, `ok`, `err`, `isOk`, `isErr`

## Invariants

- Paths are relative to `init/`.
- Absolute paths, parent traversal, backslashes, URI-scheme paths, and empty path segments are invalid.
- v1 supports only `provider: "seed-events"` and `mode: "lifecycle"`.
- `seed-events` validates against service-owned event types supplied by blueprint.
- This package validates authoring artifacts only. It does not publish events, run BPMN, or apply QSM.

## Where to look first

- `src/parse/schema.ts`
- `src/validate/structural.ts`
- `src/validate/cross-ref.ts`
- `test/unit/`

## Specs

- [`../../../superpowers/specs/2026-05-08-project-lifecycle-init-design.md`](/docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md)
