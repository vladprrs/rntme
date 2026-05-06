# Event Store Actor Kind Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-363 by enforcing the `ActorRef` kind invariant at SQLite write time.

**Architecture:** Add `CHECK (actor_kind IS NULL OR actor_kind IN ('user','system','service'))` to fresh `event_log` DDL. For existing D9-compatible databases that lack the check, `applyEventStoreSchema` will rebuild `event_log` into a checked table and copy valid rows. If existing rows contain invalid `actor_kind`, schema application fails with `EVENT_STORE_SCHEMA_INCOMPATIBLE` so corruption is not carried forward.

**Tech Stack:** SQLite via better-sqlite3, TypeScript strict ESM, Vitest.

---

## File Map

- Modify `packages/runtime/event-store/src/store/schema.ts` to add the CHECK and migration/rebuild helper.
- Modify `packages/runtime/event-store/test/unit/schema.test.ts` to cover fresh CHECK enforcement and migration behavior.
- Modify `packages/runtime/event-store/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Failing Schema Tests

- [x] **Step 1: Add fresh schema CHECK test**

In `packages/runtime/event-store/test/unit/schema.test.ts`, add a test that applies the schema and directly inserts a row with `actor_kind='owner'`. Assert SQLite throws a CHECK failure.

- [x] **Step 2: Add valid legacy migration test**

Add a test that creates a D9-compatible `event_log` table without the CHECK, inserts a valid `actor_kind='user'` row, calls `applyEventStoreSchema(db)`, verifies the row remains, and then verifies a future `actor_kind='owner'` insert fails.

- [x] **Step 3: Add corrupted legacy migration test**

Add a test that creates a D9-compatible `event_log` table without the CHECK, inserts `actor_kind='owner'`, and asserts `applyEventStoreSchema(db)` throws `EVENT_STORE_SCHEMA_INCOMPATIBLE`.

- [x] **Step 4: Confirm RED**

Run:

```bash
pnpm -F @rntme/event-store test -- test/unit/schema.test.ts
```

Expected before implementation: FAIL because the fresh schema accepts arbitrary `actor_kind`, the legacy table is not rebuilt, and corrupted legacy rows are not detected.

### Task 2: Schema Enforcement

- [x] **Step 1: Add CHECK to fresh DDL**

Change the `actor_kind` column to:

```sql
actor_kind      TEXT CHECK (actor_kind IS NULL OR actor_kind IN ('user','system','service')),
```

- [x] **Step 2: Rebuild legacy event_log when missing CHECK**

Split the schema SQL enough to create a checked replacement table and recreate indexes after rebuild. Implement:

- `hasActorKindCheck(sql: string): boolean`
- `ensureEventLogActorKindCheck(db)`
- `assertNoInvalidActorKinds(db)`
- `rebuildEventLogWithActorKindCheck(db)`

The rebuild should:

1. create `event_log_checked` with the checked table DDL;
2. copy every existing event row by explicit column list;
3. drop old `event_log`;
4. rename `event_log_checked` to `event_log`;
5. recreate event_log indexes.

- [x] **Step 3: Confirm GREEN**

Run:

```bash
pnpm -F @rntme/event-store test -- test/unit/schema.test.ts
```

Expected: PASS.

### Task 3: Documentation And Audit Ledger

- [x] **Step 1: Update event-store README**

Document that the schema enforces actor kind at write time and that valid legacy D9 tables are rebuilt automatically while corrupted rows fail schema application.

- [x] **Step 2: Close U-363 in audit docs**

Mark U-363 `✅ closed | A9` in `docs/audit/00-waves.md`, remove it from `docs/audit/01-current-priority-tasks.md`, and add package evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/event-store typecheck
pnpm -F @rntme/event-store test
pnpm -F @rntme/event-store lint
pnpm -F @rntme/event-store build
```

Expected: all PASS.

---

## Self-Review

- Spec coverage: U-363 asks for a SQLite CHECK mirroring read-side actor-kind validation; this plan enforces it for fresh and valid existing schemas.
- Placeholder scan: no placeholders remain.
- Type consistency: migration names and test names match `schema.ts` and the existing `EVENT_STORE_SCHEMA_INCOMPATIBLE` error convention.
