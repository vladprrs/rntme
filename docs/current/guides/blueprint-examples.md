# Blueprint Examples

Use this index to find current blueprint patterns before inventing new ones.
When a complete pattern is not present in a demo, prefer the compact snippets in
the narrow guide over stale historical specs.

## Minimal Read Endpoint

Use these files for the smallest read path:

- `demo/notes-blueprint/pdm/entities/Note.json`
- `demo/notes-blueprint/services/app/qsm/projections/NoteView.json`
- `demo/notes-blueprint/services/app/graphs/listNotes.json`
- `demo/notes-blueprint/services/app/bindings/bindings.json`

Pattern:

1. PDM entity declares fields, keys, and state machine.
2. QSM entity mirror exposes read fields.
3. Graph IR `findMany` reads the projection and ends in `result`.
4. Binding exposes the graph with `exposure: "read"` and `GET`.

## State-Machine-Backed Action Service

Use these files:

- `demo/order-fulfillment-blueprint/pdm/entities/Order.json`
- `demo/order-fulfillment-blueprint/services/orders/graphs/placeOrder.json`
- `demo/order-fulfillment-blueprint/services/orders/graphs/confirmOrder.json`
- `demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json`

Pattern:

1. PDM transitions define legal events.
2. Graph IR action emits those transitions.
3. Binding exposes each action with `exposure: "action"` and `POST`.

## Authenticated Service Pattern

Use these files:

- `demo/notes-blueprint/project.json`
- `demo/notes-blueprint/services/identity-auth0/service.json`
- `demo/notes-blueprint/services/app/graphs/listNotes.json`
- `demo/notes-blueprint/services/app/bindings/bindings.json`

Pattern:

1. `project.json` references an existing identity module.
2. Middleware protects HTTP routes.
3. Bindings pass `authorization` through `inputFrom.header`.
4. Graph IR calls the existing identity module operation and uses the result.

This is a module consumption pattern. It is not module implementation guidance.

## UI Screen With Read Data And Command Action

Use these files:

- `demo/notes-blueprint/services/app/ui/manifest.json`
- `demo/notes-blueprint/services/app/ui/layouts/main.spec.json`
- `demo/notes-blueprint/services/app/ui/screens/home.screen.json`
- `demo/notes-blueprint/services/app/ui/screens/home.spec.json`
- `demo/notes-blueprint/services/app/bindings/bindings.json`

Pattern:

1. UI manifest routes `/` to a layout and screen.
2. Screen data binds `/data/notes` to a read binding.
3. Screen actions bind form state to action bindings.
4. Element `on.press` dispatches command actions.
5. Successful commands refetch the read data.

## Workflow Calling Action Bindings

Use these files:

- `demo/order-fulfillment-blueprint/workflows/workflows.json`
- `demo/order-fulfillment-blueprint/workflows/order-fulfillment.bpmn`
- `demo/order-fulfillment-blueprint/services/inventory/bindings/bindings.json`
- `demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json`

Pattern:

1. PDM event starts the BPMN process.
2. Message variables copy event fields into process variables.
3. Workflow service tasks call `<service>.<bindingId>` action bindings.
4. `resultVariable` stores a task result for later service-task inputs.

## Module-Backed Capability Consumption

Use these files:

- `demo/cv-extract-blueprint/project.json`
- `demo/cv-extract-blueprint/services/app/storage.json`
- `demo/cv-extract-blueprint/services/app/graphs/prepareResumeFileUpload.json`
- `demo/cv-extract-blueprint/services/app/graphs/extractResume.json`
- `demo/cv-extract-blueprint/services/app/bindings/bindings.json`

Pattern:

1. `project.json` references existing AI, storage, or marketing modules.
2. Domain service graphs call module operations through `call` nodes.
3. Domain bindings expose product actions.
4. Module internals stay behind canonical contracts and are not authored here.

## Local Composition Check

Run this against the blueprint folder after authoring:

```bash
bun -e "import { loadComposedBlueprint } from './packages/artifacts/blueprint/src/index.js'; const r = await loadComposedBlueprint('demo/notes-blueprint'); if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } console.log('OK');"
```
