# Project Structure Authoring

Use this guide when creating the folder and file layout for a third-party
project blueprint. Keep the shell small first; add optional artifacts only when
the product task needs them.

## Required Skeleton

```text
my-blueprint/
  project.json
  pdm/
    pdm.json
    entities/
      <Entity>.json
  services/
    <service>/
      service.json
```

`project.json` declares the project name, service slugs, route mounts, optional
middleware, optional module references, and optional workflow manifest override.
Every slug in `project.json#services` must have a matching `services/<slug>/`
directory with `service.json`.

`services/<service>/service.json` is usually:

```json
{ "kind": "domain" }
```

Integration-module service slots are allowed when the project consumes an
existing module, but module implementation is outside these guides.

## Optional Service Artifacts

Add these files under a domain service as needed:

```text
services/<service>/
  qsm/
    qsm.json
    projections/
      <Projection>.json
  graphs/
    shapes.json
    <operation>.json
  bindings/
    bindings.json
  ui/
    manifest.json
    layouts/
      <layout>.spec.json
      <layout>.screen.json
    screens/
      <screen>.spec.json
      <screen>.screen.json
    fragments/
      <fragment>.spec.json
  seed/
    seed.json
  storage.json
```

Project-level workflows live outside services:

```text
workflows/
  workflows.json
  <process>.bpmn
```

## Small Domain-Service Shell

Start with the smallest project that can compose:

```json
{
  "name": "notes-demo",
  "services": ["app"],
  "routes": {
    "http": {
      "/api": "app"
    }
  }
}
```

Then add `services/app/service.json`:

```json
{ "kind": "domain" }
```

Add UI routing only when the service has `services/app/ui/manifest.json`:

```json
{
  "routes": {
    "ui": {
      "/": "app"
    },
    "http": {
      "/api": "app"
    }
  }
}
```

## File Ownership

- `project.json` owns service registration, project routes, middleware mounts,
  variables, module references, and workflow manifest location.
- `pdm/**` owns project-wide domain entities and event-type consequences.
- `services/<service>/qsm/**` owns that service's read-side projections.
- `services/<service>/graphs/**` owns Graph IR read/action operations.
- `services/<service>/bindings/bindings.json` owns HTTP exposure of graph
  operations.
- `services/<service>/ui/**` owns JSON UI routes, layouts, screens, fragments,
  data bindings, and command actions.
- `services/<service>/seed/seed.json` owns optional seed events for local data.
- `workflows/**` owns project-level BPMN mappings to action bindings.

## Examples To Copy

- `demo/notes-blueprint/project.json`
- `demo/notes-blueprint/services/app/service.json`
- `demo/order-fulfillment-blueprint/workflows/workflows.json`
- `demo/cv-extract-blueprint/services/app/ui/manifest.json`

## Validation Clues

- A service directory that is not listed in `project.json#services` is rejected.
- A listed service without a directory is rejected.
- A domain service with UI routing must have `ui/manifest.json`.
- An HTTP-routed service must have `bindings/bindings.json`.
- Optional service artifacts are discovered by conventional file paths; create
  the expected file when you want the artifact loaded.
