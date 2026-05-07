# @rntme/presentation-md-mermaid

Presentation UI module for generated rntme SPAs. It contributes `Markdown`
and `Mermaid` React components through `module.json#client.components`.

## File map

- `module.json` — module manifest with `Markdown` and `Mermaid` component
  declarations.
- `src/client.ts` — public client entry; exports both components.
- `src/Markdown.tsx` — `react-markdown` + `remark-gfm` renderer.
- `src/Mermaid.tsx` — Mermaid renderer with strict security mode.
- `src/index.ts` — package version export.
- `test/Markdown.test.tsx` — static markdown rendering coverage.

## Quick start

```bash
pnpm -F @rntme/presentation-md-mermaid run build
pnpm -F @rntme/presentation-md-mermaid run test
pnpm -F @rntme/presentation-md-mermaid run typecheck
```

## Components

| Component | Props | Purpose |
| --- | --- | --- |
| `Markdown` | `{ source: string }` | Renders Markdown with GitHub-flavored Markdown support through `remark-gfm`. |
| `Mermaid` | `{ source: string }` | Renders a Mermaid diagram into an inline SVG container. |

## Invariants & gotchas

- This module is client-only. It exports `./client` and `./module.json`; no
  backend service or provisioner is present.
- `Mermaid` initializes Mermaid with `startOnLoad: false` and
  `securityLevel: 'strict'` before each render.
- `Mermaid` writes the generated SVG into a local `div.rntme-mermaid`; it does
  not keep diagram state outside React props.
- `Markdown` expects a string `source`; data binding or defaulting belongs in
  the compiled screen spec.

## Where to look first

- "Change Markdown behavior" -> `src/Markdown.tsx`.
- "Change Mermaid rendering" -> `src/Mermaid.tsx`.
- "Add a new presentation component" -> `module.json#client.components` and
  `src/client.ts`.

## Specs

- [`../../../docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md`](/docs/superpowers/specs/2026-04-29-ui-module-contributions-design.md) — UI module contribution model.
