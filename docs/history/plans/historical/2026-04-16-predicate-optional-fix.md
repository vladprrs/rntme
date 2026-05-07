> Status: historical.
> Date: 2026-04-16.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Fix `wrapPredicateOptional` param-position misalignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the param-position bug in `wrapPredicateOptional` so mixed required + predicate_optional params in a single filter produce correct SQL bindings.

**Architecture:** Swap the OR argument order in the `reduce` call so inner SQL is walked before the guard placeholder. Add regression tests at unit and e2e level with mixed params. Update docs.

**Tech Stack:** TypeScript, vitest, better-sqlite3

**Spec:** `docs/history/specs/historical/2026-04-16-predicate-optional-fix-design.md`

---

### Task 1: Unit test — update existing test expectation

**Files:**
- Modify: `packages/graph-ir-compiler/test/unit/lower/sqlite/predicate-optional.test.ts:20`

- [ ] **Step 1: Update the expect string to match new OR argument order**

In `packages/graph-ir-compiler/test/unit/lower/sqlite/predicate-optional.test.ts`, line 20, change the expected SQL:

```ts
// Before:
expect(sql).toContain('(? IS NULL) OR ("orderItem"."unit_price" >= ?)');

// After:
expect(sql).toContain('("orderItem"."unit_price" >= ?) OR (? IS NULL)');
```

- [ ] **Step 2: Run the test to verify it FAILS (fix not applied yet)**

Run: `cd packages/graph-ir-compiler && npx vitest run test/unit/lower/sqlite/predicate-optional.test.ts`

Expected: FAIL — the emitted SQL still has the old order `(? IS NULL) OR (...)`.

---

### Task 2: Unit test — add mixed-params regression test

**Files:**
- Modify: `packages/graph-ir-compiler/test/unit/lower/sqlite/predicate-optional.test.ts`

- [ ] **Step 1: Add the mixed required + predicate_optional test case**

Append inside the existing `describe` block, after the existing `it`:

```ts
  it('aligns param positions when required and predicate_optional params are mixed', () => {
    const rel: RelOp = {
      op: 'Filter',
      predicate: {
        and: [
          { eq: ['orderItem.status', { $param: 'status' }] },
          { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] },
        ],
      } as never,
      child: {
        op: 'Scan',
        table: 'order_items',
        alias: 'orderItem',
        fields: [
          { name: 'status', column: 'status', type: 'string', nullable: false },
          { name: 'unitPrice', column: 'unit_price', type: 'decimal', nullable: false },
        ],
      },
    };
    const { ast, paramOrder } = lowerFilterWithLifting(rel, new Set(['minPrice']));
    const sql = emitSql(ast);
    expect(paramOrder).toEqual(['status', 'minPrice', 'minPrice']);
    expect(sql).toContain(
      '(("orderItem"."status" = ?) AND ("orderItem"."unit_price" >= ?)) OR (? IS NULL)',
    );
  });
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `cd packages/graph-ir-compiler && npx vitest run test/unit/lower/sqlite/predicate-optional.test.ts`

Expected: FAIL — `paramOrder` is `['status', 'minPrice', 'minPrice']` (correct) but the SQL has the guard `?` before the inner predicate, so the `toContain` check fails.

---

### Task 3: Apply the compiler fix

**Files:**
- Modify: `packages/graph-ir-compiler/src/lower/sqlite/lower.ts:174`

- [ ] **Step 1: Swap the OR args in `wrapPredicateOptional`**

In `packages/graph-ir-compiler/src/lower/sqlite/lower.ts`, line 174, swap the two elements of the `args` array:

```ts
// Before (line 174):
      args: [{ kind: 'op', op: 'is_null', args: [{ kind: 'param', ordinal }] }, acc],

// After:
      args: [acc, { kind: 'op', op: 'is_null', args: [{ kind: 'param', ordinal }] }],
```

- [ ] **Step 2: Run unit tests to verify both pass**

Run: `cd packages/graph-ir-compiler && npx vitest run test/unit/lower/sqlite/predicate-optional.test.ts`

Expected: PASS — both tests (single param and mixed params) pass.

- [ ] **Step 3: Run all unit tests to check for regressions**

Run: `cd packages/graph-ir-compiler && npx vitest run test/unit/`

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/graph-ir-compiler/src/lower/sqlite/lower.ts packages/graph-ir-compiler/test/unit/lower/sqlite/predicate-optional.test.ts
git commit -m "fix(graph-ir-compiler): swap OR args in wrapPredicateOptional to align param positions

The guard placeholder was emitted before the inner predicate in SQL text,
but pushed to paramOrder after inner params. SQLite binds ? by walk-order,
so mixed filters silently bound the guard to the wrong value.

Swap args: [isNull, acc] → [acc, isNull] so inner ? precedes guard ? in
the emitted SQL, matching the push order in paramOrder."
```

---

### Task 4: E2e test — mixed params against real better-sqlite3

**Files:**
- Modify: `packages/graph-ir-compiler/test/e2e/predicate-optional.e2e.test.ts`

- [ ] **Step 1: Add the mixed-params graph spec and test cases**

Add a second `describe` block at the bottom of the file:

```ts
const mixedSpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
  shapes: {},
  graphs: {
    filterItemsMixed: {
      id: 'filterItemsMixed',
      signature: {
        inputs: {
          maxPrice: { type: 'decimal', mode: 'required' },
          minPrice: { type: 'decimal', mode: 'predicate_optional' },
        },
        output: { type: 'rowset<OrderItem>', from: 'f' },
      },
      nodes: [
        { id: 'items', type: 'findMany' as const, config: { source: { entity: 'OrderItem' } } },
        {
          id: 'f',
          type: 'filter' as const,
          config: {
            input: 'items',
            expr: {
              and: [
                { lte: ['orderItem.unitPrice', { $param: 'maxPrice' }] },
                { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] },
              ],
            },
          },
        },
      ],
    },
  },
};

describe('E2E: predicate_optional with mixed params', () => {
  it('filters correctly when both required and predicate_optional params are present', () => {
    const db = makeDb();
    try {
      const r = compile(mixedSpec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      // maxPrice=1000, minPrice=100 → only unit_price 500 matches
      const rows = execute(r.value, { maxPrice: 1000, minPrice: 100 }, db);
      expect(rows).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it('applies only the required filter when predicate_optional param is absent', () => {
    const db = makeDb();
    try {
      const r = compile(mixedSpec, pdm, qsm);
      if (!r.ok) throw new Error('compile failed');
      // maxPrice=1000, no minPrice → guard fires, prices ≤ 1000: 500, 20, 15, 5 → 4 rows
      const rows = execute(r.value, { maxPrice: 1000 }, db);
      expect(rows).toHaveLength(4);
    } finally {
      db.close();
    }
  });
});
```

- [ ] **Step 2: Run e2e tests to verify they pass**

Run: `cd packages/graph-ir-compiler && npx vitest run test/e2e/predicate-optional.e2e.test.ts`

Expected: all 4 tests PASS (2 original + 2 new).

- [ ] **Step 3: Run the full test suite**

Run: `cd packages/graph-ir-compiler && npx vitest run`

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/graph-ir-compiler/test/e2e/predicate-optional.e2e.test.ts
git commit -m "test(graph-ir-compiler): e2e regression for mixed required + predicate_optional params

Exercises the exact scenario that was broken: a single filter node with
both a required param (maxPrice) and a predicate_optional param (minPrice)
executed against real better-sqlite3."
```

---

### Task 5: Update documentation

**Files:**
- Modify: `demo/issue-tracker-api/KNOWN_ISSUES.md`

- [ ] **Step 1: Mark Finding 3 as CLOSED**

In `demo/issue-tracker-api/KNOWN_ISSUES.md`, replace the Finding 3 heading (line 29):

```markdown
### 3. `wrapPredicateOptional` — latent correctness bug in the compiler — **CLOSED**
```

Add a resolution block immediately after the heading (before the existing `**Where:**` line):

```markdown
**Resolution:** Swapped OR argument order in `wrapPredicateOptional` (`args: [acc, isNull]`) so inner `?` precedes guard `?` in emitted SQL, aligning with `paramOrder` push order. Regression tests added at unit and e2e level with mixed required + predicate_optional params.

```

- [ ] **Step 2: Update the "Deferred fix" section**

Replace the "Deferred fix — remaining upstream work" section (lines 55-57) with:

```markdown
## Deferred fix — remaining upstream work

All upstream items for this demo are now resolved. The compiler fix for `wrapPredicateOptional` landed in `@rntme/graph-ir-compiler`. The demo's `searchIssues` graph workaround (split filter nodes) remains valid but is no longer required.
```

- [ ] **Step 3: Commit**

```bash
git add demo/issue-tracker-api/KNOWN_ISSUES.md
git commit -m "docs(demo): close KNOWN_ISSUES Finding 3 — wrapPredicateOptional fixed"
```

---

### Task 6: Update memory

**Files:**
- Modify: `/home/coder/.claude/projects/-home-coder-project/memory/rntme_predicate_optional_bug.md`

- [ ] **Step 1: Update the memory file to reflect the fix**

Replace the entire content of `rntme_predicate_optional_bug.md` with:

```markdown
---
name: rntme predicate_optional positional-param bug
description: graph-ir-compiler wrapPredicateOptional had a param-position bug — fixed 2026-04-16 by swapping OR args
type: project
---
`packages/graph-ir-compiler/src/lower/sqlite/lower.ts::wrapPredicateOptional` had a latent bug where `(? IS NULL) OR (<inner>)` misaligned guard params with SQL walk-order when mixed with required params.

**Fixed 2026-04-16:** Swapped OR args to `[acc, isNull]` so inner `?` precedes guard `?` in emitted SQL. Regression tests added at unit (`test/unit/lower/sqlite/predicate-optional.test.ts`) and e2e (`test/e2e/predicate-optional.e2e.test.ts`) level with mixed required + predicate_optional params.

The demo's `searchIssues` graph workaround (split filter nodes) is no longer required but remains valid.
```

This step does not need a git commit (memory files are outside the repo).
