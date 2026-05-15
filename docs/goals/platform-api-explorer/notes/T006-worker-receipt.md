# T006 — Worker receipt: Slice B1 (handler + Overview + Raw tab)

## Result

done

## Summary

Implemented Slice B1 end-to-end. Added the `getProjectEndpointDetail` native handler (auth gate, bundle walk, `bindings[op]` parse, graph `signature.output.type` resolution restricted to `row<X>` and bare-identifier wrappers, `shapes.json` field lookup) plus its types/operations/bindings registration. Extended `PlatformAPIExplorer` to fetch detail via `useTransport` on selection (URL template via new optional `endpointDetailPathTemplate` prop, default `/api/projects/{projectId}/endpoints/{service}/{operation}`) with an in-component cache keyed by `${service}:${operation}`. Overview pane now populates the five real handler-backed rows (Auth, Source artifact, Handler, Request schema, Response schema) and falls back to "Not yet exposed by handler" placeholder when detail is missing/loading. Added a Raw tab that renders `detail.rawBinding` as a JSON `<pre>` preview. Summary, Examples, Dependencies remain explicit `is-placeholder` rows.

## Changed files (all inside allowed_files)

- `apps/platform/blueprint/services/projects/handlers/get-project-endpoint-detail.ts` — new native handler
- `apps/platform/blueprint/services/projects/handlers/types.ts` — added `GetProjectEndpointDetailHandlerInput/Output`, `ProjectEndpointDetail`, `ProjectEndpointParameter`, `ProjectEndpointRequestSchema`, `ProjectEndpointResponseSchema`
- `apps/platform/blueprint/services/projects/bindings/bindings.json` — registered `getProjectEndpointDetail` GET binding with three path params
- `apps/platform/blueprint/services/projects/operations.json` — registered the native operation (effect=read, idempotency=none)
- `apps/platform/blueprint/services/app/ui/screens/api.spec.json` — added `endpointDetailPathTemplate` prop
- `apps/platform/blueprint/test/platform-projects-handler.test.ts` — added 8-case `getProjectEndpointDetailHandler` describe block
- `apps/platform/blueprint/test/platform-blueprint.test.ts` — extended composition test + added `getProjectEndpointDetail` registration test
- `apps/platform/blueprint/test/platform-ui.test.ts` — pinned the new `endpointDetailPathTemplate` prop on `endpointsExplorer`
- `apps/platform/ui-module/module.json` — declared the new third optional prop
- `apps/platform/ui-module/src/components.tsx` — fetch-on-selection effect via `useTransport`, in-component cache, Overview/Raw tab bar, real-detail rendering with placeholder fallback
- `apps/platform/ui-module/assets/platform-ui.css` — added `rntme-pae-tabs`, `rntme-pae-tab`, `rntme-pae-raw`, `rntme-pae-raw-pre` styles
- `apps/platform/ui-module/test/components.test.tsx` — wrapped `renderWithStore` with no-op `TransportProvider`; extended interactive test with mock transport + canned `getProjectEndpointDetail` response asserting populated rows and Raw tab JSON; updated module.json prop assertion
- `docs/current/owners/apps/platform.md` — added `getProjectEndpointDetail` row to native operations table; updated API explorer paragraph

## Verification

| Command | Result |
| --- | --- |
| `bun run --cwd apps/platform typecheck` | pass |
| `bun test --cwd apps/platform blueprint/test/platform-projects-handler.test.ts` | pass (57 tests / 190 expects; +8 new) |
| `bun test --cwd apps/platform blueprint/test/platform-blueprint.test.ts` | pass (13 tests / 81 expects; +1 new) |
| `bun test --cwd apps/platform blueprint/test/platform-ui.test.ts` | pass (1 test / 44 expects) |
| `bun run --cwd apps/platform/ui-module typecheck` | pass |
| `bun run --cwd apps/platform/ui-module lint` | pass |
| `bun run --cwd apps/platform/ui-module build` | pass |
| `bun test --cwd apps/platform/ui-module` | pass (34 tests / 145 expects) |

PM trust-but-verify reran 4 of 8 (handler + composition + UI + ui-module) — counts match identically.

## Deferred (per Slice B2 / Slice C)

**Slice B2 (T008)**: Request tab (path/query/body parameter table + clickable parameter rows opening side-sheet); Response tab (status code chip + schema rows + example block placeholders); Code-example tabs (curl/fetch/openapi skeleton renderers in dedicated tabs); parameter side-sheet component; per-tab CSS for tables/chips/side-sheet.

**Still-pinned not-yet-exposed fields** (no source artifact in the bundle): `summary`, `response.successStatus`, `response.example`, `response.errors`, per-field `description`. Body schema name is null for primitive-input graphs (typical case).

**Response schema for `rowset<...>` outputs**: Per the locked stop_if rule, only `row<X>` and bare-identifier wrappers are resolved. `rowset<X>`, `Map<...>`, etc. report `schemaName: null` and `fields: []` rather than invent a generic-type parser.

**Slice C**: Findings panel, dependencies tab — still blocked on validation-report artifact source decision.

## Notes for Judge audit

- **Test transport mocking**: Wrapped `renderWithStore` with a no-op `TransportProvider` (transport never invoked in static markup). Interactive selection test provides a real canned-response `createTransportChain`; asserts populated rows ("Required", `services/.../bindings.json`, `native / platform`) and Raw-tab JSON content.
- **Output type wrapper**: Strict-regex `^row<X>$` + bare identifier `^X$` only. `rowset<NoteView>` (common) falls through to `null` — contracted behaviour, NOT a bug.
- **Selection auto-fetch effect**: Guarded by transport null/undefined, missing selection, missing projectId, and cache hit; safe in SSR/no-provider environments. Failed fetches cache an `{error}` envelope so they don't spin forever; failed entries fall back to placeholder copy.
- **`encodeURIComponent` on URL substitution**: Path params URL-encoded defensively.
- **Operations.json convention**: Used `effect: 'read'`, `idempotency: 'none'` matching every existing native operation. Output type name `GetProjectEndpointDetailResult` matches `<Op>Result` pattern.
- **No graph file under `services/projects/graphs/`**: Confirmed against precedent — none of the existing native handlers have one.
- **Preserved unrelated dirty state**: All pre-existing modifications outside `allowed_files` (data-model screens, deployment handler test, demo node_modules, goals state.yaml, etc.) untouched.
