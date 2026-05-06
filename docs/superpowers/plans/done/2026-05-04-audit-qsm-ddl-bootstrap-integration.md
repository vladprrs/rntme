# QSM DDL Bootstrap Integration Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-275 by adding QSM integration coverage for generated projection DDL and SQLite table bootstrap behavior.

**Architecture:** Add an integration suite inside `@rntme/qsm` that validates realistic PDM/QSM fixtures, generates projection DDL, applies the emitted SQL to an in-memory SQLite database, and verifies table/index/resolver alignment. The test uses real `better-sqlite3` but stays inside QSM to avoid adding a reverse dependency from QSM to projection-consumer.

**Tech Stack:** TypeScript strict ESM, Vitest, `better-sqlite3`, `@rntme/pdm`, `@rntme/qsm`.

---

## File Map

- Modify `packages/artifacts/qsm/package.json` to add test-only SQLite dependencies.
- Create `packages/artifacts/qsm/test/integration/ddl-bootstrap.test.ts` for SQLite-backed DDL bootstrap coverage.
- Modify `packages/artifacts/qsm/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Confirm Coverage Gap

- [x] **Step 1: Confirm missing integration directory**

Run:

```bash
test -d packages/artifacts/qsm/test/integration
```

Expected before implementation: exit code `1`, proving the audited integration coverage gap still exists.

### Task 2: SQLite DDL Integration Suite

- [x] **Step 1: Add test-only SQLite dependencies**

Add `better-sqlite3` and `@types/better-sqlite3` to `@rntme/qsm` dev dependencies using versions already present in nearby SQLite packages.

- [x] **Step 2: Add integration test helper**

Create `packages/artifacts/qsm/test/integration/ddl-bootstrap.test.ts` with helpers that load the issue-tracker PDM/QSM fixtures, validate them, generate DDL, apply the DDL to an in-memory SQLite database using `CREATE ... IF NOT EXISTS` rewriting, and inspect `sqlite_master` / `PRAGMA table_info`.

- [x] **Step 3: Cover explicit table fixture**

Add a test that uses `test/fixtures/issue-tracker.qsm.json`, bootstraps the emitted DDL, verifies `projection_issue` exists with mirror + idempotency columns and `idx_projection_issue_status`, and inserts/reads a row through the resolver's table name.

- [x] **Step 4: Cover default table fallback**

Add a test that omits `projection.table`, verifies generated DDL and resolver both use PDM `Issue.table` (`issues`), bootstraps SQLite, and proves `projection_issueview` is not created.

- [x] **Step 5: Cover composite key DDL executability**

Add a test for `IssueAssignment` that bootstraps composite-primary-key DDL and asserts `PRAGMA table_info` reports `issue_id` / `user_id` as ordered key columns.

- [x] **Step 6: Confirm GREEN**

Run:

```bash
pnpm -F @rntme/qsm test -- test/integration/ddl-bootstrap.test.ts
```

Expected: PASS.

### Task 3: Documentation And Audit Ledger

- [x] **Step 1: Update QSM README**

Document the new integration suite in "Where to look first" / invariants so future agents know where SQLite DDL bootstrap coverage lives.

- [x] **Step 2: Close U-275 in audit docs**

Mark U-275 `✅ closed | A11` in `docs/audit/00-waves.md`, remove it from `docs/audit/01-current-priority-tasks.md`, and add package evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/qsm typecheck
pnpm -F @rntme/qsm test
pnpm -F @rntme/qsm lint
pnpm -F @rntme/qsm build
```

Expected: all PASS.

---

## Self-Review

- Spec coverage: U-275 asks for integration/e2e coverage around QSM DDL and projection table bootstrap; this plan adds SQLite-backed integration tests for explicit tables, default table fallback, indexes, idempotency columns, and composite keys.
- Placeholder scan: no placeholders remain.
- Type consistency: test helpers use existing public QSM/PDM APIs and do not introduce a dependency from QSM to projection-consumer.
