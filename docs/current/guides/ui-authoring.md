# UI Authoring

UI artifacts are JSON screens, layouts, fragments, data bindings, and command
actions. Author UI after the service has bindings for the data and commands the
screen needs.

Package internals live in
[`../owners/packages/artifacts/ui.md`](../owners/packages/artifacts/ui.md).

## Files

```text
services/<service>/ui/
  manifest.json
  layouts/
    main.spec.json
    main.screen.json
  screens/
    home.spec.json
    home.screen.json
  fragments/
    field-row.spec.json
```

Each layout and screen has a pair:

- `<name>.spec.json`: element tree.
- `<name>.screen.json`: metadata, data bindings, and actions.

Fragments only need `.spec.json` and are compiled away when referenced.

## Manifest

```json
{
  "version": "2.0",
  "pdmRef": "../../../pdm",
  "qsmRef": "../qsm",
  "graphSpecRef": "../graphs",
  "bindingsRef": "../bindings",
  "metadata": { "title": "Notes" },
  "layouts": { "main": "layouts/main" },
  "routes": {
    "/": { "layout": "main", "screen": "screens/home" }
  }
}
```

Routes point to base paths without `.spec.json` or `.screen.json`.

## Element Specs

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["heading", "notes-list"]
    },
    "heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "All notes" }
    },
    "notes-list": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "sm" },
      "children": ["note-card"],
      "repeat": { "statePath": "/data/notes" }
    },
    "note-card": {
      "type": "Card",
      "props": { "title": { "$item": "title" } }
    }
  }
}
```

Rules:

- `root` must name an element in `elements`.
- Every child id must exist.
- Every element must be reachable from `root`.
- `Slot` elements are allowed only in layouts.
- Component props are checked by the component catalog supplied during project
  composition.

## Screen Data

Screen data binds state paths to read bindings:

```json
{
  "metadata": { "title": "Home" },
  "data": {
    "/data/notes": {
      "binding": "listNotes",
      "refetchOn": ["mount"]
    }
  }
}
```

Data binding params may be literals or state refs:

```json
{
  "/data/resume": {
    "binding": "getResume",
    "params": { "id": { "$state": "/form/resumeId" } },
    "refetchOn": ["params"]
  }
}
```

Data bindings should resolve to read bindings.

## Command Actions

Command actions bind UI state to action bindings:

```json
{
  "actions": {
    "createNote": {
      "kind": "command",
      "binding": "createNote",
      "paramsFromState": {
        "title": "/form/title",
        "body": "/form/body"
      },
      "onSuccess": { "refetchData": ["/data/notes"] },
      "onError": { "showAlert": true }
    }
  }
}
```

Wire elements to actions through `on` handlers:

```json
{
  "submit-btn": {
    "type": "Button",
    "props": { "label": "Add", "variant": "primary" },
    "on": { "press": { "action": "dispatch", "params": { "name": "createNote" } } }
  }
}
```

Command action bindings should resolve to action bindings. `onSuccess` can
refetch data, navigate to a route, or clear form/action state paths.

## Navigation And Refetch

Navigation actions:

```json
{
  "kind": "navigation",
  "navigateTo": "/orders/:id",
  "paramsFromState": { "id": "/data/order/id" }
}
```

Refetch actions:

```json
{
  "kind": "refetch",
  "targets": ["/data/notes"]
}
```

## State Path Coverage

State references must be covered by data bindings or recognized state roots.
Common roots:

- `/data/...`
- `/form/...`
- `/route/params/...`
- `/actions/...`
- `/auth/...`
- `/currentUser`

Use `/form/...` for user input, `/data/...` for binding results, and
`/route/params/...` for route-derived params.

## Examples To Copy

- `demo/notes-blueprint/services/app/ui/manifest.json`
- `demo/notes-blueprint/services/app/ui/layouts/main.spec.json`
- `demo/notes-blueprint/services/app/ui/screens/home.screen.json`
- `demo/notes-blueprint/services/app/ui/screens/home.spec.json`
- `demo/cv-extract-blueprint/services/app/ui/screens/home.screen.json`
