# Blueprint Authoring

This is the entrypoint for external coding agents authoring a runnable rntme
project blueprint. Use it as the workflow checklist, then open the narrow guide
for the artifact you are writing.

Owner docs under `docs/current/owners/**` remain the source of truth for package
APIs and internals. These guides focus on the authoring decisions needed to
produce valid JSON artifacts.

## Authoring Order

1. Restate the product task as domain entities, user-facing screens, and
   operations.
2. Create the project shell and service layout:
   [`project-structure-authoring.md`](project-structure-authoring.md).
3. Author the project PDM:
   [`pdm-authoring.md`](pdm-authoring.md).
4. Author service QSM mirrors and relations:
   [`qsm-authoring.md`](qsm-authoring.md).
5. Author Graph IR read operations and action operations.
6. Expose operations through HTTP bindings.
7. Add UI screens and actions when the task needs UI.
8. Add workflows or seed data only when the task needs them.
9. Run local composition checks.

## Cross-Cutting Rules

- Artifacts are JSON. Do not introduce YAML, TOML, TypeScript authoring
  artifacts, or ad hoc formats.
- The blueprint folder is the source of truth. The project should compose from
  files in that folder without hidden runtime-only behavior.
- Graph IR operations are the behavior path for third-party blueprints.
- Do not use native handler paths in external blueprints:
  `operations.json`, `handlers/*.ts`, `target.engine: "native"`, or workflow
  `nativeTasks`.
- Modules may be referenced as existing capability surfaces through
  `project.json#modules`, integration-module services, and Graph IR `call`
  nodes. These guides do not teach module implementation.
- Production rollout mechanics are outside this guide set.
- Prefer current demo blueprints and package tests as examples before inventing
  a new pattern.

## Working Loop

Use this loop for each authoring slice:

1. Read the relevant narrow guide and linked owner doc.
2. Copy the closest current demo shape.
3. Author the smallest coherent artifact set for the product task.
4. Compose locally.
5. Repair validation errors at the artifact layer that emitted them.

The most useful local check while authoring a blueprint is composition:

```bash
bun -e "import { loadComposedBlueprint } from './packages/artifacts/blueprint/src/index.js'; const r = await loadComposedBlueprint('demo/notes-blueprint'); if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } console.log('OK');"
```

Replace `demo/notes-blueprint` with the blueprint folder you are authoring.

## Existing Examples

- `demo/notes-blueprint` shows a compact authenticated app service with PDM,
  QSM, Graph IR read/action operations, bindings, UI, seed data, and an
  identity module reference.
- `demo/order-fulfillment-blueprint` shows two domain services and project
  workflows that call action bindings.
- `demo/cv-extract-blueprint` shows module-backed AI and storage calls plus a
  UI surface. Treat module usage there as consumption examples, not module
  authoring instructions.

## Where To Go Next

- Project shell and service layout:
  [`project-structure-authoring.md`](project-structure-authoring.md)
- Domain model:
  [`pdm-authoring.md`](pdm-authoring.md)
- Query-side mirrors:
  [`qsm-authoring.md`](qsm-authoring.md)
- Package internals:
  [`../owners/packages/artifacts/blueprint.md`](../owners/packages/artifacts/blueprint.md)
