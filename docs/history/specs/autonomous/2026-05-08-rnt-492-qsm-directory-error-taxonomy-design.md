> Status: autonomous-spec.
> Date: 2026-05-08.
> Current source: RNT-492, `docs/decision-system.md`, current QSM owner docs, and code/tests on `origin/main` at `c80ff2cd`.
> Why retained: SPEC rationale for splitting QSM directory loader failures into actionable, structured errors; verify current truth against code/tests before implementation.

# RNT-492 QSM directory error taxonomy - design

## Problem

`loadQsmDir` is the project-first entrypoint that turns a service `qsm/`
directory into one `QsmArtifact`. On `main`, it delegates to
`loadArtifactDir`, and QSM maps every directory-load failure to
`QSM_PARSE_DIR_INVALID`.

That hides the correction path. A missing `qsm.json`, malformed `qsm.json`,
invalid `qsm.json` schema, malformed `projections/*.json`, filesystem read
failure, and composed QSM parse error are all too similar from the caller's
view. Blueprint loading then wraps the QSM error as a generic
`BLUEPRINT_IO_ERROR`, so agents correcting a blueprint often see the service
directory path instead of the exact file to edit.

## Goals

- Make QSM directory-load failures distinguishable by `code`, `message`,
  `path`, and optional `cause`.
- Preserve `loadQsmDir(dir): Promise<Result<QsmArtifact>>`; do not throw across
  artifact package boundaries.
- Preserve already-structured `Result.err` returned by `parseQsm`; do not wrap
  parse-layer schema errors in a generic directory catch.
- Keep `QSM_PARSE_DIR_INVALID` registered for append-only error-code stability,
  but stop using it for known failure classes.
- Keep messages suitable for agent copy-paste correction: name the expected
  file or leaf file and the specific failed rule.
- Keep the shared PDM/QSM directory-loader pattern unless implementation finds
  a hard compatibility blocker.

## Non-goals

- No QSM validation change. `loadQsmDir` still returns a parsed `QsmArtifact`,
  not `ValidatedQsm`.
- No blueprint loader redesign. Blueprint may keep wrapping QSM load failures,
  but its `cause` should retain the structured QSM errors.
- No backward-compatibility shim for the old generic emitted error beyond
  leaving the code in `ERROR_CODES`.
- No new authoring format; QSM remains JSON-only.

## Current Context

- `packages/artifacts/qsm/src/load/load-dir.ts` calls
  `loadArtifactDir({ indexFile: 'qsm.json', leafDir: 'projections', ... })`
  and maps every loader-created error to `QSM_PARSE_DIR_INVALID`.
- `packages/artifacts/_shared/src/load.ts` already separates missing index
  file and missing leaf directory before the broad catch, but the callback only
  receives `{ message, path }`. JSON syntax, index-schema, leaf read, and leaf
  JSON failures are caught together with `path: dir`.
- `parseQsm` returns `QSM_PARSE_SCHEMA_VIOLATION` for JSON string syntax and
  Zod schema issues. In the directory path, leaf files are parsed before
  `parseQsm`, so malformed projection JSON never reaches that structured
  parser.
- `QsmError` currently has `layer`, `code`, `message`, optional `path`, and
  optional `hint`; it lacks `cause`.
- `packages/artifacts/qsm/test/unit/load-dir.test.ts` covers only happy path
  and missing `qsm.json`.
- `docs/current/owners/packages/artifacts/qsm.md` documents
  `QSM_PARSE_DIR_INVALID` as a stable parse error but does not define a
  directory-load error contract.
- `packages/artifacts/blueprint/src/load/load-blueprint.ts` wraps QSM load
  failures under `BLUEPRINT_IO_ERROR` with `cause: loadedQsm.errors`; preserving
  QSM error structure is enough for blueprint callers to inspect nested cause.

## Decision-System Fit

- **G1 / F6 Repeatability:** exact file-level failures make blueprint folder
  inputs deterministic and correctable without runtime-only diagnosis.
- **G2 / F5 LLM-authorability:** codified, path-specific errors improve
  fail-fast feedback for agent-authored artifacts.
- **G3 / F4 Inspectability:** structured loader errors become inspectable
  read-model composition state instead of opaque exceptions.
- **G5 / F2 Canonical-way:** extend the existing shared directory loader rather
  than hand-rolling a separate QSM loader.
- **F8 Standards/libraries:** continue to use Node filesystem APIs,
  `JSON.parse`, and Zod for strict index schema validation.

Applicable locked bets: **JSON-only authoring**, **4-layer validation:
parse -> structural -> references -> consistency**, **`Result<T>` everywhere**,
**Error code format `<PKG>_<LAYER>_<KIND>`**, and **Layering enforced by
dependency-cruiser**. This spec does not contradict any Goal, Filter, or
locked bet and does not require a decision-system update.

## Proposed Design

### 1. Extend QSM error shape

Add `cause?: unknown` to `QsmError`. Keep it optional so existing errors and
tests remain valid. Use `cause` for structured details that are useful to
callers but too verbose for `message`, such as Zod issues, original error
names, or nested parse errors.

Do not add `cause` to every existing parse/validation error. Only directory
loader changes need it now.

### 2. Append QSM directory error codes

Append new codes after `QSM_PARSE_DIR_INVALID` in
`packages/artifacts/qsm/src/types/result.ts`:

- `QSM_PARSE_DIR_INDEX_MISSING`: required `qsm.json` is absent or not readable
  as a file.
- `QSM_PARSE_DIR_PROJECTIONS_MISSING`: required `projections/` is absent or not
  readable as a directory.
- `QSM_PARSE_DIR_INDEX_JSON_INVALID`: `qsm.json` exists but is not valid JSON.
- `QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION`: parsed `qsm.json` fails
  `QsmDirectoryIndexSchema`.
- `QSM_PARSE_DIR_PROJECTION_JSON_INVALID`: a `projections/<name>.json` file is
  not valid JSON.
- `QSM_PARSE_DIR_READ_FAILED`: fallback for filesystem read/list/stat failures
  not covered by the explicit missing-file/missing-directory checks.

Leave `QSM_PARSE_DIR_INVALID` registered and documented as legacy/deprecated.
Do not delete or reorder existing codes.

### 3. Make shared directory loader report failure kind

Extend `loadArtifactDir` with richer failure metadata while keeping the current
PDM callsite source-compatible. The callback should receive a stable kind plus
path and cause, for example:

```ts
type LoadArtifactDirFailureKind =
  | 'index-missing'
  | 'leaf-dir-missing'
  | 'index-json-invalid'
  | 'index-schema-invalid'
  | 'leaf-json-invalid'
  | 'read-failed';

type LoadArtifactDirFailure = {
  kind: LoadArtifactDirFailureKind;
  message: string;
  path: string;
  cause?: unknown;
};
```

`IoErrorBuilder<E>` can be widened from `{ message; path }` to
`LoadArtifactDirFailure`. Existing PDM builders that destructure only
`message` and `path` will still compile structurally. If TypeScript inference
does not preserve compatibility, add a parallel optional `buildLoadError`
callback and keep `buildIoError` as the old path.

The helper should set paths as author-facing relative paths:

- `qsm.json` for missing, malformed, or schema-invalid index;
- `projections` for missing leaf directory or failed directory listing;
- `projections/<file>.json` for malformed or unreadable leaf JSON;
- the relative file or directory that failed for other filesystem errors.

### 4. Keep parse result errors intact

Structure `loadArtifactDir` so only filesystem, JSON decoding, and index-schema
validation are inside the generic failure conversion. The call to `parseFn`
must return directly. If `parseFn` returns `Err<E>`, that exact error array is
returned to the caller.

For QSM, composed projection schema violations should therefore remain
`QSM_PARSE_SCHEMA_VIOLATION` from `parseQsm`, with paths such as
`projections.ProductCard.keys`. The loader should not convert them to any
`QSM_PARSE_DIR_*` code.

### 5. Map failure kinds in QSM

In `loadQsmDir`, map shared failure kinds to QSM codes and messages:

- Missing `qsm.json`: `QSM_PARSE_DIR_INDEX_MISSING`, message
  `missing required file: qsm.json`.
- Missing `projections/`: `QSM_PARSE_DIR_PROJECTIONS_MISSING`, message
  `missing required directory: projections`.
- Malformed `qsm.json`: `QSM_PARSE_DIR_INDEX_JSON_INVALID`, message starts
  `invalid JSON in qsm.json: ...`.
- Invalid `qsm.json` schema: `QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION`, message
  `qsm.json failed validation`; `cause` carries Zod issues.
- Malformed projection JSON: `QSM_PARSE_DIR_PROJECTION_JSON_INVALID`, message
  starts `invalid JSON in projections/<file>.json: ...`.
- Other read/list/stat failures: `QSM_PARSE_DIR_READ_FAILED`, message includes
  the failed path and original error message.

Every emitted error should use `layer: 'parse'`. Keep `hint` optional; use it
only if a message would otherwise become too long.

## Alternatives Rejected

- **Keep one generic `QSM_PARSE_DIR_INVALID` with better messages.** Rejected
  because callers and agents still cannot branch on known failure classes, and
  the acceptance criteria require distinguishable codes.
- **Fork QSM away from `loadArtifactDir`.** Rejected because PDM and QSM share
  the same project-first directory shape. Duplicating traversal logic would
  violate the canonical-way filter unless the shared helper proves impossible
  to extend safely.
- **Validate QSM during `loadQsmDir`.** Rejected for this issue. The current
  contract loads and parses; structural/cross-ref validation remains a separate
  pipeline step with PDM context.

## Docs Touch

Implementation should update:

- `docs/current/owners/packages/artifacts/qsm.md`: document the directory-load
  error contract, new codes, path semantics, and legacy status of
  `QSM_PARSE_DIR_INVALID`.
- `packages/artifacts/qsm/README.md`: no change expected unless local command
  hints or current-doc target changes.
- `packages/artifacts/_shared` docs/comments if the shared helper API changes
  enough that its source comment becomes stale.

No `docs/decision-system.md` update is needed because the design follows
existing Goals/Filters/Bets.

## Validation and Evidence

Regression tests should cover at least:

- Missing `qsm.json` -> `QSM_PARSE_DIR_INDEX_MISSING`, `path: 'qsm.json'`.
- Missing `projections/` -> `QSM_PARSE_DIR_PROJECTIONS_MISSING`,
  `path: 'projections'`.
- Malformed `qsm.json` -> `QSM_PARSE_DIR_INDEX_JSON_INVALID`,
  `path: 'qsm.json'`.
- Invalid `qsm.json` schema -> `QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION`,
  `path: 'qsm.json'`, Zod issues in `cause`.
- Malformed `projections/ProductCard.json` ->
  `QSM_PARSE_DIR_PROJECTION_JSON_INVALID`,
  `path: 'projections/ProductCard.json'`.
- Invalid projection schema that reaches `parseQsm` remains
  `QSM_PARSE_SCHEMA_VIOLATION`, not any `QSM_PARSE_DIR_*` wrapper.
- Blueprint load of a bad service QSM retains the nested QSM error in
  `BLUEPRINT_IO_ERROR.cause`.

Suggested gates:

- `pnpm -F @rntme/qsm test`
- `pnpm -F @rntme/qsm build`
- `pnpm -F @rntme/blueprint test -- test/unit/load-blueprint.test.ts`
- `git diff --check`

## Risks

- Extending `loadArtifactDir` touches shared artifact code. Keep the API
  source-compatible for PDM, and run the existing shared/PDM tests if the
  implementation changes helper behavior beyond QSM mapping.
- `cause?: unknown` can accidentally leak large error objects. Store structured
  parser details and original error metadata, not file contents or secrets.
- Error-code churn can break docs/tests. Append only, keep
  `QSM_PARSE_DIR_INVALID`, and document that new known cases use the specific
  codes.
- Blueprint callers may still show only the outer `BLUEPRINT_IO_ERROR.message`.
  That is acceptable for this issue if the nested `cause` carries the exact
  QSM error; a future blueprint UX pass can flatten nested artifact errors.
