# T004 — Scout receipt: Slice B handler shape + per-field source map

## Sampled bundle artifacts

- `demo/notes-blueprint/services/app/bindings/bindings.json` (service: app, 4 operations)
- `demo/notes-blueprint/services/app/graphs/shapes.json` (response shape defs)
- `demo/notes-blueprint/services/app/graphs/createNote.json` (sample graph with signature)
- `demo/order-fulfillment-blueprint/services/orders/bindings/bindings.json`
- `demo/order-fulfillment-blueprint/services/inventory/bindings/bindings.json`
- `apps/platform/blueprint/services/projects/bindings/bindings.json` (platform's own bindings — operation registration precedent)

## Per-field source map

| Field | Source class | Exact path / derivation | Notes |
| --- | --- | --- | --- |
| **summary** | (e) not-yet-exposed | not in any artifact | bindings carry no description; service.json has none. Ship `null`; UI keeps "Not yet exposed by handler". |
| **auth** | (a) bindings.json | `bindings.json:operation.inputFrom` keys | If `inputFrom` contains `authorization` → `'required'`; empty/missing → `'public'`. |
| **source artifact** | (a) bindings.json | bundle path + operation key | `services/<service>/bindings/bindings.json:<operationId>`. |
| **handler reference** | (a)+(c) | `bindings.json:operation.target` + `operation.graph` + `services/<service>/graphs/<graph>.json` | Returns `{engine, dialect, graph}`; UI later links to graph viewer (Slice C). |
| **request schema** | (a)+(b) | `bindings.json:operation.http.parameters` + shapes for body | Path/query/body params from `parameters[]` (`{name, in, required}`). Body schema name from graph `signature.inputs` type → `shapes.json` lookup. |
| **response schema fields** | (c)+(b) | graph `signature.output.type` → shapes lookup | Walk `services/<service>/graphs/<operation>.json` for `signature.output.type` (e.g. `row<DealListView>`); shapes[type].fields. |
| **response status code** | (e) not-yet-exposed | not in artifacts | Hardcode `null` (or skeleton 200) and surface as placeholder. |
| **response example** | (e) not-yet-exposed | not in artifacts | Ship `null`; UI placeholder. |
| **error responses** | (e) not-yet-exposed | not in artifacts | Ship `[]`; UI placeholder "Not yet documented". |
| **examples (curl/fetch/openapi)** | (a) skeleton-only | derivable from method + path + params | Skeleton strings only; real bodies/values absent. |
| **per-field descriptions** | (e) not-yet-exposed | not in any artifact | Render `null`/omit description rows. |
| **dependencies (chain + chips)** | (d) cross-artifact | graph nodes → QSM/PDM refs | Slow; defer to Slice C. |
| **raw artifact preview** | (a) bindings.json | filter bindings by operation key | Trivial; can be fully populated in B1. |

## Proposed handler shape (TS sketch — Judge to lock)

```ts
export type GetProjectEndpointDetailHandlerInput = {
  readonly projectId: string;
  readonly service: string;
  readonly operation: string;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
};

export type ProjectEndpointParameter = {
  readonly name: string;
  readonly in: 'path' | 'query' | 'body';
  readonly required: boolean;
  readonly description?: string | null;
};

export type ProjectEndpointRequestSchema = {
  readonly pathParams: readonly ProjectEndpointParameter[];
  readonly queryParams: readonly ProjectEndpointParameter[];
  readonly body: {
    readonly schemaName: string | null;
    readonly fields: readonly ProjectEndpointParameter[];
  } | null;
};

export type ProjectEndpointResponseSchema = {
  readonly successStatus: number | null;
  readonly schemaName: string | null;
  readonly fields: readonly ProjectEndpointParameter[];
  readonly example: unknown | null;
  readonly errors: readonly { readonly code: number; readonly message: string }[];
};

export type ProjectEndpointDetail = {
  readonly service: string;
  readonly operation: string;
  readonly method: string;
  readonly path: string;
  readonly summary: string | null;
  readonly auth: 'required' | 'public';
  readonly sourceArtifact: { readonly file: string; readonly key: string };
  readonly handler: { readonly engine: string; readonly dialect: string; readonly graph: string | null };
  readonly request: ProjectEndpointRequestSchema;
  readonly response: ProjectEndpointResponseSchema;
  readonly examples: { readonly curl: string; readonly fetch: string; readonly openapi: string };
  readonly rawBinding: unknown;
};

export type GetProjectEndpointDetailHandlerOutput =
  | { readonly status: 'ok'; readonly detail: ProjectEndpointDetail }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };
```

Use the same `PlatformError` envelope and discriminated `status: 'ok' | 'error'` pattern as the existing `listProjectDataModel` / `listProjectEndpoints` handlers.

## Proposed binding (`apps/platform/blueprint/services/projects/bindings/bindings.json`)

```json
"getProjectEndpointDetail": {
  "graph": "getProjectEndpointDetail",
  "target": { "engine": "native", "dialect": "platform" },
  "http": {
    "method": "GET",
    "path": "/{projectId}/endpoints/{service}/{operation}",
    "parameters": [
      { "name": "projectId", "in": "path", "bindTo": "projectId", "required": true },
      { "name": "service", "in": "path", "bindTo": "service", "required": true },
      { "name": "operation", "in": "path", "bindTo": "operation", "required": true }
    ]
  },
  "exposure": "read",
  "inputFrom": {
    "authorization": { "from": "header", "name": "authorization", "required": true },
    "sessionSubject": { "from": "header", "name": "x-rntme-user-sub", "required": false },
    "sessionStatus": { "from": "header", "name": "x-rntme-session-status", "required": false }
  }
}
```

## Proposed operations.json registration

```json
"getProjectEndpointDetail": {
  "handler": {
    "kind": "native",
    "entry": "./handlers/get-project-endpoint-detail.ts",
    "export": "getProjectEndpointDetailHandler"
  },
  "input": {
    "projectId": { "type": "string", "mode": "required" },
    "service": { "type": "string", "mode": "required" },
    "operation": { "type": "string", "mode": "required" },
    "sessionSubject": { "type": "string", "mode": "optional" },
    "sessionStatus": { "type": "string", "mode": "optional" }
  },
  "output": { "type": "GetProjectEndpointDetailResult" },
  "effect": "read",
  "idempotency": "none"
}
```

Judge T005 should confirm both shapes match the exact registration format the existing handlers use (Scout sketched from memory of `listProjectEndpoints`; Judge to verify the operations.json key set, e.g. whether the actual format uses `effect`/`idempotency` or different field names).

## Recommended slice sizing — SPLIT (B1 + B2)

- **B1 (T006)**: handler + Overview population + Raw tab
  - Native handler `getProjectEndpointDetail` (parses bindings.json, walks graph for response shape, maps shapes.json for fields)
  - bindings.json + operations.json registration
  - PlatformAPIExplorer Overview pane: populate Service / Operation / Method / Path (already done) + Auth + Source artifact + Handler reference + Request schema name + Response schema name; the remaining 4 placeholders stay
  - Raw tab: trivial JSON preview of the binding entry (use `getProjectArtifact` or include in handler output)
  - Tests: `platform-projects-handler.test.ts` for new handler; `components.test.tsx` for populated Overview
  - Docs touch: `docs/current/owners/apps/platform.md`

- **B2 (T008, queued after T007)**: Request / Response / Code-example tabs + parameter side-sheet
  - PlatformAPIExplorer Request tab: parameter table (path/query/body) + clickable rows opening side-sheet
  - PlatformAPIExplorer Response tab: status code chip (placeholder) + schema rows (from response.fields) + example block (placeholder)
  - PlatformAPIExplorer Code-example tabs: curl/fetch/openapi (skeleton-only)
  - Parameter side-sheet component
  - Additional CSS for tables/chips/side-sheet
  - Tests: extended `components.test.tsx`

**Why split?** B1 proves the handler contract end-to-end and ships meaningful Overview population (the most value-dense placeholder reduction). B2 adds purely UI work that depends on B1's shape but doesn't block handler correctness; if B1 surfaces shape issues the Worker can stop without dragging UI work down with it.

## Verification commands (Bun, NOT npm/npx — Scout sketch was wrong; Judge to lock)

For B1:

- `bun run --cwd apps/platform typecheck`
- `bun test --cwd apps/platform blueprint/test/platform-projects-handler.test.ts`
- `bun test --cwd apps/platform blueprint/test/platform-blueprint.test.ts` (registers handler in operations.json + bindings.json)
- `bun test --cwd apps/platform blueprint/test/platform-ui.test.ts` (no spec change in B1, but rerun to confirm no break)
- `bun run --cwd apps/platform/ui-module typecheck`
- `bun run --cwd apps/platform/ui-module lint`
- `bun run --cwd apps/platform/ui-module build`
- `bun test --cwd apps/platform/ui-module`

## Honest "not-yet-exposed" enumeration

These fields ship as `null` / empty even after B1 + B2 — UI must keep placeholder copy:

1. **summary** — no source field anywhere.
2. **response status code** — bindings carry no per-operation HTTP status; ship `null`.
3. **response example payload** — no source.
4. **error responses** — empty `[]`; no source.
5. **per-field descriptions** in request/response schemas — `null`; no source.
6. **example bodies in curl/fetch** — skeleton only; no canned payload data.

Worker T006 stop_if must include: "Detail field requires a data source not in (a) bindings.json, (b) shapes.json, or (c) graphs/*.json — record as not-yet-exposed and stop instead of inventing."

## Notes for Judge T005

- Confirm the proposed handler input/output shapes match the actual `listProjectDataModel` handler precedent (Scout sketched from memory; verify by reading the existing handler before locking T006 allowed_files).
- Confirm operations.json field names — Scout used `effect` and `idempotency`; the existing `listProjectEndpoints` registration may use different keys.
- Decide whether `getProjectEndpointDetail` needs its own pseudo-graph file under `apps/platform/blueprint/services/projects/graphs/` (the other native handlers do — confirm by listing that directory) or if it's pure-native.
- Confirm sample bundle paths used for fixtures match what `platform-projects-handler.test.ts` already loads.
- Production redeploy: Slice B adds a new backend handler. The CHANGE itself is local. Whether the handler ships to production is a separate `platform up` decision — keep that out of T006's scope. T1000 audit will flag it as a follow-up at most.
