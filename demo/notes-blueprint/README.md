# notes-demo blueprint

Minimal project-first blueprint for the Notes deploy-flow e2e walkthrough.

## Contents

One `app` service with one `Note` entity, two commands (`createNote`, `deleteNote`), two queries (`listNotes`, `getNote`), one UI screen at `/`, HTTP bindings mounted under `/api`, and one seed note.

## Local validation

```bash
pnpm install --frozen-lockfile
pnpm --filter @rntme/blueprint... build
pnpm --filter @rntme/blueprint exec node --input-type=module -e "import { loadComposedBlueprint } from '@rntme/blueprint'; \
  const r = loadComposedBlueprint('../../demo/notes-blueprint'); \
  if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } \
  console.log('OK:', Object.keys(r.value));"
```

Expected output starts with `OK:`.

## Notes

The UI asks for note ids explicitly because the current UI runtime supports `paramsFromState` but not generated parameters or item-bound command arguments. `createdAt` is generated from event time and intentionally not listed in `NoteView.exposed`, but it is declared in the graph output shape for API/UI responses.

Spec: `docs/superpowers/specs/2026-04-27-notes-demo-e2e-design.md`
