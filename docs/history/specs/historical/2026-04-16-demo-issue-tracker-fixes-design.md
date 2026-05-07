> Status: historical.
> Date: 2026-04-16.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Demo issue-tracker-api fixes

Date: 2026-04-16

## Problem

E2E testing of `demo/issue-tracker-api` revealed 4 issues after the KNOWN_ISSUES findings (1-4) were resolved:

1. **Seeded aggregates have broken write side.** Every command on a seeded issue (7001-7010) fails with `state "undefined"`. Root cause: `replayAggregateState()` expects `{before, after}` payload wrapper, but seed events have flat payloads.
2. **Sprint burndown always empty.** The only sprint-tagged issue (7010) is `closed`, and the `sprintBurndown` graph filters out closed issues.
3. **Missing `x-actor-id` not enforced.** README says the header is required, but commands succeed without it. Actual runtime behavior: actor is `null` when header is absent.
4. **List endpoints return raw IDs.** `listIssues`, `listIssuesUi`, `searchIssues` return FK integers instead of enriched names. **Deferred to a separate task** — involves JOIN compilation validation across multiple graph types.

## Approach

Normalize seed payloads at validation time in `@rntme/seed` (approach 2 from brainstorm). Fix demo artifacts and seed data. Add dedicated e2e tests for seed scenarios.

## Design

### 1. Payload normalization in `@rntme/seed` validate()

**Location:** `packages/seed/src/validate.ts`

**Change:** After parsing and validating seed events, add a normalization step. New function `wrapPayloads(events, pdm)` or extend existing `normalize()`:

For each event:
- If `payload` already has `{before, after}` shape — skip.
- If flat — build the wrapper:
  - Look up PDM entity by `aggregateType`.
  - Derive transition name from `eventType` by stripping entity prefix (e.g. `IssueReport` -> `report`, `IssueSubmit` -> `submit`).
  - Look up `transition.from`, `transition.to`, `transition.affects`, and `stateMachine.stateField` from PDM.
  - If `transition.from === null` (creation): `before: null`, `after: { ...flatPayload, [stateField]: transition.to }`.
  - If non-creation: `before: { fields from affects with values from accumulated state }`, `after: { ...flatPayload, [stateField]: transition.to }`.
- For non-creation events, maintain accumulated state per stream (fold `after` into running state) to compute `before` values.

**Contract change:** `validate()` needs PDM (or its entity+stateMachine subset) as a second argument. The runtime already has the PDM available at the point where it calls validate.

**Note on `stateField` in flat payload:** Seed events currently include `status` in their flat payload (e.g. `{ "status": "open" }`). After normalization, the `status` value comes from `transition.to` in the `after` block. If the flat payload contains a value for `stateField`, it should be ignored in favor of `transition.to` (the PDM is authoritative). Alternatively, validate that they match and error if they don't.

### 2. Seed data — burndown issues

**Location:** `demo/issue-tracker-api/artifacts/seed.json`

Changes:
- **Issue-7010:** Remove the last two events (`IssueResolve`, `IssueClose`). Final state becomes `in_progress` with `sprintId: 1`.
- **Issue-7011 (new):** Add a new issue attached to Sprint-1, driven through `report -> submit -> assign -> resolve`. Final state: `resolved` with `sprintId: 1`. Fields: `projectId: 1, reporterId: 3, priority: medium, storyPoints: 3`.

Result: `GET /v1/sprints/1/burndown` returns 2+ buckets (`in_progress`, `resolved`), demonstrating the `reduce` node's grouping.

### 3. sprintBurndown graph — remove closed filter

**Location:** `demo/issue-tracker-api/artifacts/graphs/sprintBurndown.json`

Change the filter expression from:

```json
{
  "and": [
    { "eq": ["issue.sprintId", { "$param": "sprintId" }] },
    { "neq": ["issue.status", { "$literal": "closed" }] }
  ]
}
```

To:

```json
{ "eq": ["issue.sprintId", { "$param": "sprintId" }] }
```

Burndown should show all statuses — standard behavior for sprint progress tracking.

### 4. README — actor header documentation

**Location:** `demo/issue-tracker-api/README.md`

Change:

> All `POST`s require an `x-actor-id` request header

To:

> All `POST`s accept an optional `x-actor-id` request header — the runtime turns it into `{ kind: 'user', id }` and stamps every event envelope's `actor` with it. If omitted, `actor` is `null`.

### 5. E2E test for seed scenarios

**Location:** `demo/issue-tracker-api/test/seed-e2e.test.ts`

Infrastructure: spawn `tsx src/server.ts` as subprocess (same pattern as `smoke.test.ts`), port 3012, 15s boot timeout.

Test cases:

1. **Mutate seeded open issue** — `POST /v1/issues/7004/actions/assign {assigneeId: 1}` -> 200, version 3.
2. **Mutate seeded draft issue** — `POST /v1/issues/7005/actions/submit` -> 200, version 2.
3. **Illegal transition on seeded closed issue** — `POST /v1/issues/7001/actions/submit` -> 422, message contains `"closed"`.
4. **Burndown with data** — `GET /v1/sprints/1/burndown` -> 200, array with >= 2 elements, each has `issueCount > 0`.
5. **Burndown non-existent sprint** — `GET /v1/sprints/999/burndown` -> 200, empty array.

## Out of scope

### JOIN enrichment for list/search endpoints

`listIssues`, `listIssuesUi`, `searchIssues` return raw FK IDs. This requires:

- Adding `map` nodes with JOIN-path fields to multiple graphs.
- Validating `chainToSqlJoins` works with `sort` + `limit` + JOIN combinations.
- Potentially filling `qsm.json` `relationRoles` (currently `{}`).
- New or extended shapes in `shapes.json`.
- `searchIssues` has predicate_optional complexity that compounds with JOINs.

Files to investigate: `qsm.json`, `packages/graph-ir-compiler/src/lower/sqlite/joins.ts`, `listIssues.json`, `listIssuesUi.json`, `searchIssues.json`, `shapes.json`.

This is a separate brainstorm+implementation cycle.

## Files touched

| Package | File | Change |
|---------|------|--------|
| `@rntme/seed` | `src/validate.ts` | `wrapPayloads()` — flat-to-`{before,after}` normalization using PDM |
| `@rntme/seed` | `src/types.ts` (maybe) | Update `validate()` signature if PDM param added |
| `@rntme/seed` | tests | Unit tests for payload normalization |
| `@rntme/runtime` | `src/start/start-service.ts` or `src/load/load-service.ts` | Pass PDM to seed validate |
| demo | `artifacts/seed.json` | Trim 7010, add 7011 |
| demo | `artifacts/graphs/sprintBurndown.json` | Remove `neq closed` filter |
| demo | `README.md` | Actor header wording |
| demo | `test/seed-e2e.test.ts` | New e2e test file |
