# @rntme/ui

UI artifact parser, 4-layer validator, and typed handoff to `@rntme/ui-runtime`.

See [`docs/superpowers/specs/2026-04-15-ui-layer-design.md`](../../docs/superpowers/specs/2026-04-15-ui-layer-design.md).

## Role in the system

- Zero runtime dependencies beyond zod.
- Input to `@rntme/ui-runtime`: the Hono runtime consumes a `ValidatedUiArtifact`.
- Complements `@rntme/bindings` by layering a declarative UI on top of HTTP bindings.

## Install

```bash
pnpm add @rntme/ui zod
```

## Quick start

```ts
import { validateUi, type UiResolvers } from '@rntme/ui';

const resolvers: UiResolvers = { resolveBinding, resolveComponent, resolveRoute };
const res = validateUi(rawArtifact, resolvers);
if (!res.ok) throw new Error(JSON.stringify(res.errors));
```

## Four-layer validation

| Layer        | What it checks                                                                 |
| ------------ | ------------------------------------------------------------------------------- |
| parse        | Zod shape, enums (action `kind`, `refetchOn`), required fields.                 |
| structural   | Route paths, roots, children, orphans, Slot uniqueness, action/state-path refs in tree, navigation placeholder coverage. |
| references   | `binding`, `layout`, component `type`, navigation target routes resolve; binding kind matches declared slot (data=query, command-action=command). |
| consistency  | Required inputs covered, literal/state-path types match binding inputs, forbidden input modes (`root`/`predicate_optional`) rejected, list-prop shape matches dataset output. |

Error codes are exported from `UI_ERROR_CODES`.
