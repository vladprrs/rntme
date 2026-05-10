# @rntme/presentation-tiptap

Tiptap rich-text editor UI module for generated rntme SPAs. It contributes a
`RichTextEditor` React component and element-scoped editor operations.

## File map

- `module.json` — module manifest with the `RichTextEditor` component and
  `toggleBold`, `toggleItalic`, `insertImage` operations.
- `src/client.ts` — public client entry; exports `RichTextEditor`.
- `src/RichTextEditor.tsx` — Tiptap React component and operation
  registration.
- `src/index.ts` — package version export.
- `test/RichTextEditor.test.tsx` — component and operation-registry coverage.

## Quick start

```bash
bun run build
bun test
bun run typecheck
```

## Browser component

`RichTextEditor` uses `@tiptap/react`, `@tiptap/starter-kit`, and
`@tiptap/extension-image`. It imports `useOperationRegistry` from
`@rntme/contracts-client-runtime-v1`, so it depends on the SPA host installing
the client-runtime providers.

Component props:

| Prop | Type | Purpose |
| --- | --- | --- |
| `placeholder` | string | Stored as `data-placeholder` on the editor wrapper. |
| `__rntmeElementId` | string | Runtime-injected element id used as the operation namespace. |

When `__rntmeElementId` and the Tiptap editor are available, the component
registers these element-scoped operations:

| Operation | Params | Effect |
| --- | --- | --- |
| `toggleBold` | none | Focuses the editor and toggles bold. |
| `toggleItalic` | none | Focuses the editor and toggles italic. |
| `insertImage` | `{ src: string }` | Inserts an image node with the provided `src`. |

## Invariants & gotchas

- This module is client-only. It ships `./client` and `./module.json`; no
  backend service or provisioner is present.
- Operations are registered under the runtime element id, not globally. A
  screen action must target the specific rendered `RichTextEditor` element.
- The editor starts with `'<p></p>'` and does not persist content by itself.
  Persistence belongs in screen actions/data bindings around the component.
- `immediatelyRender: false` keeps the component compatible with host-driven
  rendering and tests.

## Where to look first

- "Change editor extensions" -> `src/RichTextEditor.tsx` `useEditor`.
- "Add an editor operation" -> `module.json#client.operations` and the
  `register(id, { ... })` block in `src/RichTextEditor.tsx`.
- "Change public component props" -> `module.json#client.components` and
  `RichTextEditorProps`.

## Specs

- [`../../../packages/contracts/client-runtime/v1/README.md`](/docs/current/owners/packages/contracts/client-runtime/v1.md) — module browser contract and operation registry.
- [`../../../docs/history/specs/active-rationale/2026-04-29-ui-module-contributions-design.md`](/docs/history/specs/active-rationale/2026-04-29-ui-module-contributions-design.md) — UI module contribution model.
