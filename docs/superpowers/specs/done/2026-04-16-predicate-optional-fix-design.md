# Fix `wrapPredicateOptional` param-position misalignment

**Date:** 2026-04-16
**Package:** `@rntme/graph-ir-compiler`
**Status:** design approved

---

## Problem

`wrapPredicateOptional` (lower.ts:159-177) emits SQL `(? IS NULL) OR (<inner>)` but appends the guard param to `paramOrder` **after** all inner params. SQLite binds `?` by walk-order in the SQL text, not by array index. When a filter combines predicate_optional params with required/defaulted params, the guard `?` (leftmost in text) binds to the first inner param value instead of the guard value, silently corrupting the filter.

Existing tests pass only because they exercise filters with a single predicate_optional param and no siblings — every `?` binds to the same scalar, hiding the misalignment.

## Fix

### 1. Compiler change (one line)

In `packages/graph-ir-compiler/src/lower/sqlite/lower.ts`, function `wrapPredicateOptional`, swap the OR argument order:

```ts
// Before (line 174):
args: [{ kind: 'op', op: 'is_null', args: [{ kind: 'param', ordinal }] }, acc],

// After:
args: [acc, { kind: 'op', op: 'is_null', args: [{ kind: 'param', ordinal }] }],
```

This changes emitted SQL from `(? IS NULL) OR (<inner>)` to `(<inner>) OR (? IS NULL)`. Since `paramOrder` already has inner params first (pushed by `lowerExpr`) and guard params last (pushed by `wrapPredicateOptional`), positions align **by construction**.

**Why this works for N predicate_optional params:** `reduce` wraps layer by layer. Each guard `?` always appears after the inner `?` placeholders in both the SQL text and `paramOrder`, regardless of how many params are involved.

### 2. Unit test update

File: `test/unit/lower/sqlite/predicate-optional.test.ts`

**a)** Update existing test expectation to match the new OR argument order:
- Before: `(? IS NULL) OR ("orderItem"."unit_price" >= ?)`
- After: `("orderItem"."unit_price" >= ?) OR (? IS NULL)`

**b)** Add regression test: **mixed required + predicate_optional params in one filter**. Filter expression: `AND(eq orderItem.status $status, gte orderItem.unitPrice $minPrice)` where `status` is required and `minPrice` is predicate_optional. Assert:
- `paramOrder` is `['status', 'minPrice', 'minPrice']`
- SQL contains `(("orderItem"."status" = ?) AND ("orderItem"."unit_price" >= ?)) OR (? IS NULL)`

### 3. E2e test addition

File: `test/e2e/predicate-optional.e2e.test.ts`

Add a graph spec with two inputs in one filter node: required `maxPrice` + predicate_optional `minPrice`. Using the existing commerce fixture (`order_items` table, `unit_price` column):

- **With both params:** returns only rows matching both conditions.
- **Without predicate_optional param:** guard fires, only the required param filters.

This exercises the exact scenario that was broken: mixed params in a single filter node executed against real better-sqlite3.

### 4. Documentation updates

- Mark Finding 3 in `demo/issue-tracker-api/KNOWN_ISSUES.md` as **CLOSED** with resolution summary.
- Update memory file `rntme_predicate_optional_bug.md` to reflect fix is landed.

## Rejected alternative

**Push guard param before inner params (Option B):** Requires restructuring the call site because `lowerExpr` pushes inner params before `wrapPredicateOptional` runs. Would need pre-reserved slots or array splicing — more coupling, more fragile, no benefit over Option A.

## Scope

This fix is entirely within `@rntme/graph-ir-compiler`. No changes to the runtime, seed, or demo artifacts. The demo's `searchIssues` graph workaround (split filter nodes) remains valid but is no longer required after this fix.
