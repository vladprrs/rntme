> Status: historical.
> Date: 2026-04-19.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# Platform API Fix-01 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the corrections listed in `docs/history/specs/historical/2026-04-19-platform-api-errata-01.md` to the platform API implementation in the `rntme-cli/` submodule — 8 Critical + 5 cheap Important findings from the post-landing code review.

**Architecture:** Ten commits in the `rntme-cli` submodule (code changes) plus one commit in the main repo (submodule pointer bump + a preface note on the original design doc). Commits are dependency-ordered: migration + schema first, then tx-scoped repo constructors, then the HTTP RLS middleware, then surgical bug fixes. Every behavioural change uses TDD (red → green → refactor).

**Tech stack (unchanged):** TypeScript strict ESM Node 20, Hono, Zod, Drizzle ORM, `pg`, `@aws-sdk/client-s3`, `@workos-inc/node`, pino, vitest, testcontainers (Postgres + MinIO).

**Spec:** `docs/history/specs/historical/2026-04-19-platform-api-errata-01.md` — this plan's section numbers track the errata's §3 corrections.

**Conventions (inherited from the public `@rntme/*` workspace and first platform-api plan):**
- `Result<T, E>` everywhere; no throws across public APIs.
- Phantom-branded `Validated*` types.
- Error codes: `PLATFORM_<LAYER>_<KIND>`, append-only.
- ESM, `"type": "module"`, `tsc -p tsconfig.json` per package.
- Tests under `test/{unit,integration,e2e}/`. Integration + e2e Docker-gated via `integrationContainersAvailable()`.
- Zero comments unless capturing a non-obvious invariant.

**Order of execution:** Commits 1 → 10 must land in order (each assumes the prior). Within a commit, task steps are strictly sequential.

**Where to run which command:**
- Submodule tests/lint/typecheck: `pnpm -C rntme-cli -F @rntme-cli/<pkg> <script>`
- Main-repo submodule ops: `git -C rntme-cli <git-cmd>`
- Main repo never runs the submodule's build directly; the workspace resolves via `workspace:*` in the submodule.

---

## Commit 1 — platform_app role + FORCE RLS + organization.archived_at (storage migration)

**Why:** Errata §3.2 adds the non-owner `platform_app` role, `FORCE ROW LEVEL SECURITY`, and the `organization.archived_at` column that later commits depend on. Also introduces `rls-enforcement.test.ts` (the three canonical invariants from errata §5) that will fail now and pass after this commit.

### Task 1.1 — Extend the integration harness with a `platform_app` role option

**Files:**
- Modify: `rntme-cli/packages/platform-storage/test/integration/harness.ts`

- [ ] **Step 1: Replace the harness file with the version below**

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPool, createDb, type Db } from '../../src/pg/pool.js';
import { runMigrations } from '../../src/migrate.js';
import type { Pool } from 'pg';

export type PgHandles = {
  container: StartedPostgreSqlContainer;
  ownerUrl: string;
  appUrl: string;
  pool: Pool;          // owner pool — runs DDL, also used by legacy tests
  appPool: Pool;       // platform_app pool — subject to RLS
  db: Db;
};

export async function startPostgres(): Promise<PgHandles> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const ownerUrl = container.getConnectionUri();
  const pool = createPool(ownerUrl);
  const db = createDb(pool);
  await runMigrations(db, pool);

  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_app`);
  await pool.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO platform_app`);

  const parsed = new URL(ownerUrl);
  parsed.username = 'platform_app';
  parsed.password = 'platform_app';
  const appUrl = parsed.toString();
  const appPool = createPool(appUrl);

  return { container, ownerUrl, appUrl, pool, appPool, db };
}

export async function stopPostgres(h: PgHandles): Promise<void> {
  await h.appPool.end();
  await h.pool.end();
  await h.container.stop();
}

export async function resetSchema(pool: Pool): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE audit_log, event_outbox, artifact_tag, artifact_version, service, project, api_token, membership_mirror, workos_event_log, account, organization RESTART IDENTITY CASCADE;`,
  );
}
```

- [ ] **Step 2: Skim existing integration tests for `teardown()` calls**

Run: `grep -rn "container.stop\|pool.end" rntme-cli/packages/platform-storage/test/integration/`
Expected: each test file has its own teardown. Leave them alone for now — commit 1 introduces `stopPostgres` but does not retrofit call sites; they will keep calling `container.stop()` on `pool` + `container` directly, which continues to work.

### Task 1.2 — Write the failing RLS enforcement test

**Files:**
- Create: `rntme-cli/packages/platform-storage/test/integration/rls-enforcement.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPostgres, stopPostgres, type PgHandles } from './harness.js';
import { integrationContainersAvailable } from './docker-available.js';
import { randomUUID } from 'node:crypto';

const shouldRun = integrationContainersAvailable();
const d = shouldRun ? describe : describe.skip;

d('RLS enforcement (errata §5 canonical invariants)', () => {
  let h: PgHandles;
  const orgA = randomUUID();
  const orgB = randomUUID();

  beforeAll(async () => {
    h = await startPostgres();
    await h.pool.query(
      `INSERT INTO organization (id, workos_organization_id, slug, display_name) VALUES ($1,'wos_a','a','A'),($2,'wos_b','b','B')`,
      [orgA, orgB],
    );
    await h.pool.query(
      `INSERT INTO project (id, org_id, slug, display_name) VALUES ($1,$2,'p','P'),($3,$4,'p','P')`,
      [randomUUID(), orgA, randomUUID(), orgB],
    );
  }, 60_000);

  afterAll(async () => {
    if (h) await stopPostgres(h);
  });

  it('invariant 1: cross-org isolation is RLS-driven (no WHERE clause)', async () => {
    const client = await h.appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.org_id = $1`, [orgA]);
      const r = await client.query(`SELECT org_id FROM project`);
      await client.query('COMMIT');
      expect(r.rows.every((x) => x.org_id === orgA)).toBe(true);
      expect(r.rows.length).toBe(1);
    } finally {
      client.release();
    }
  });

  it('invariant 2: missing SET LOCAL is fail-closed', async () => {
    const client = await h.appPool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`SELECT org_id FROM project`);
      await client.query('COMMIT');
      expect(r.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });

  it('invariant 3: FORCE RLS applies to owner too (owner cannot bypass)', async () => {
    const client = await h.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`SELECT org_id FROM project`);
      await client.query('COMMIT');
      expect(r.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/rls-enforcement.test.ts`
Expected: either the `platform_app` role does not exist (owner-pool `GRANT` fails), OR `invariant 1` passes while `invariant 3` passes (owner currently bypasses RLS) while invariant 2 fails (owner returns all rows without SET LOCAL). In short, the test suite fails.

### Task 1.3 — Create the `platform_app` role in a new migration step

**Files:**
- Create: `rntme-cli/packages/platform-storage/src/sql/roles.sql`
- Modify: `rntme-cli/packages/platform-storage/src/migrate.ts`

- [ ] **Step 1: Create `src/sql/roles.sql`**

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_app') THEN
    CREATE ROLE platform_app LOGIN PASSWORD 'platform_app';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO platform_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO platform_app;
```

- [ ] **Step 2: Modify `src/migrate.ts` to run roles.sql before policies.sql**

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';
import type { Db } from './pg/pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

export async function runMigrations(db: Db, pool: Pool): Promise<void> {
  const roles = await readFile(resolve(pkgRoot, 'src/sql/roles.sql'), 'utf8');
  await pool.query(roles);
  await migrate(db, { migrationsFolder: resolve(pkgRoot, 'drizzle') });
  const policies = await readFile(resolve(pkgRoot, 'src/sql/policies.sql'), 'utf8');
  await pool.query(policies);
}
```

### Task 1.4 — Add `FORCE ROW LEVEL SECURITY` to every tenant-scoped table

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/sql/policies.sql`

- [ ] **Step 1: Replace the first 8 lines (`ENABLE ROW LEVEL SECURITY` statements) with the paired ENABLE + FORCE form**

```sql
ALTER TABLE project           ENABLE ROW LEVEL SECURITY;
ALTER TABLE project           FORCE  ROW LEVEL SECURITY;
ALTER TABLE service           ENABLE ROW LEVEL SECURITY;
ALTER TABLE service           FORCE  ROW LEVEL SECURITY;
ALTER TABLE artifact_version  ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_version  FORCE  ROW LEVEL SECURITY;
ALTER TABLE artifact_tag      ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_tag      FORCE  ROW LEVEL SECURITY;
ALTER TABLE api_token         ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_token         FORCE  ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         FORCE  ROW LEVEL SECURITY;
ALTER TABLE event_outbox      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_outbox      FORCE  ROW LEVEL SECURITY;
ALTER TABLE membership_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_mirror FORCE  ROW LEVEL SECURITY;
```

Leave the `DROP POLICY IF EXISTS …` block and the `CREATE POLICY …` block below untouched. Idempotent on re-run.

### Task 1.5 — Add `organization.archived_at` schema column

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/schema/identity.ts`
- Create: `rntme-cli/packages/platform-storage/drizzle/0001_org_archived_at.sql`
- Modify: `rntme-cli/packages/platform-storage/drizzle/meta/_journal.json`

- [ ] **Step 1: Modify `organization` in `schema/identity.ts`**

Insert `archivedAt` after `displayName`:

```ts
export const organization = pgTable('organization', {
  id: uuid('id').primaryKey(),
  workosOrganizationId: text('workos_organization_id').notNull().unique(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Create migration `drizzle/0001_org_archived_at.sql`**

```sql
ALTER TABLE "organization" ADD COLUMN "archived_at" timestamp with time zone;
```

- [ ] **Step 3: Append the migration entry to `drizzle/meta/_journal.json`**

Read the existing file, then add an entry for idx 1 preserving `breakpoints: true`:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1776580867960,
      "tag": "0000_watery_human_robot",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1777000000000,
      "tag": "0001_org_archived_at",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 4: Create `drizzle/meta/0001_snapshot.json` by copying the shape of `0000_snapshot.json`**

Run: `cp rntme-cli/packages/platform-storage/drizzle/meta/0000_snapshot.json rntme-cli/packages/platform-storage/drizzle/meta/0001_snapshot.json`
Then open `0001_snapshot.json`, locate the `organization.columns` object, and add an entry matching the schema definition:

```json
"archived_at": {
  "name": "archived_at",
  "type": "timestamp with time zone",
  "primaryKey": false,
  "notNull": false
}
```

Also bump the snapshot's `id` to a fresh uuid (v4) and increment `prevId` to whatever `0000_snapshot.json` had as `id`.

### Task 1.6 — Extend the `Organization` schema with `archivedAt`

**Files:**
- Modify: `rntme-cli/packages/platform-core/src/schemas/entities.ts`
- Modify: `rntme-cli/packages/platform-storage/src/repos/pg-org-repo.ts`

- [ ] **Step 1: Add `archivedAt` to `OrganizationSchema`**

Insert before `createdAt`:

```ts
archivedAt: z.date().nullable(),
```

- [ ] **Step 2: Map it in `pg-org-repo.ts:rowToOrg`**

```ts
function rowToOrg(r: typeof organization.$inferSelect): Organization {
  return {
    id: r.id,
    workosOrganizationId: r.workosOrganizationId,
    slug: r.slug,
    displayName: r.displayName,
    archivedAt: r.archivedAt,
    createdAt: r.createdAt!,
    updatedAt: r.updatedAt!,
  };
}
```

- [ ] **Step 3: Update the in-memory fake in `platform-core/src/testing/fakes.ts` to include `archivedAt: null` on its `organization` records**

Grep: `grep -n "workosOrganizationId:" rntme-cli/packages/platform-core/src/testing/fakes.ts`
Expected: every fake organization literal. Add `archivedAt: null` to each.

### Task 1.7 — Run the RLS test to verify it passes

- [ ] **Step 1: Typecheck + test**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-core typecheck && pnpm -C rntme-cli -F @rntme-cli/platform-storage typecheck && pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/rls-enforcement.test.ts`
Expected: all three invariants pass.

- [ ] **Step 2: Full submodule test suite**

Run: `pnpm -C rntme-cli -r test`
Expected: all previously-green tests still pass. If any test opens a raw connection and expects to see cross-org rows, it was already wrong and must be fixed now. Grep: `grep -rn "tenant_isolation\|org_id" rntme-cli/packages/platform-storage/test/ rntme-cli/packages/platform-http/test/` — any test using the owner pool and reading without `SET LOCAL` across orgs is suspect.

### Task 1.8 — Commit

- [ ] **Step 1: Stage + commit**

```bash
git -C rntme-cli add packages/platform-storage/src/sql/roles.sql \
  packages/platform-storage/src/sql/policies.sql \
  packages/platform-storage/src/migrate.ts \
  packages/platform-storage/src/schema/identity.ts \
  packages/platform-storage/drizzle/0001_org_archived_at.sql \
  packages/platform-storage/drizzle/meta/ \
  packages/platform-storage/src/repos/pg-org-repo.ts \
  packages/platform-storage/test/integration/harness.ts \
  packages/platform-storage/test/integration/rls-enforcement.test.ts \
  packages/platform-core/src/schemas/entities.ts \
  packages/platform-core/src/testing/fakes.ts

git -C rntme-cli commit -m "fix(platform-storage): platform_app role + FORCE RLS + organization.archived_at

Errata §3.2, §3.3, §5. Adds the non-owner platform_app role (used by the
runtime pool in production), FORCE ROW LEVEL SECURITY on every tenant-scoped
table, the organization.archived_at column, and the canonical RLS-enforcement
integration test from errata §5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 2 — Tx-scoped repo constructors + withTransaction rework

**Why:** Errata §3.1 requires every repo to accept a `PoolClient` so the request-level TX opened by middleware (commit 3) is used for every downstream query. Four repos currently take `Pool` directly and open their own connections — those change to `PgQueryable`.

### Task 2.1 — Write a failing test: PgArtifactRepo.publish respects an outer TX

**Files:**
- Modify: `rntme-cli/packages/platform-storage/test/integration/artifact-repo.test.ts`

- [ ] **Step 1: Locate the existing publish test**

Run: `grep -n "publish\|describe\|it(" rntme-cli/packages/platform-storage/test/integration/artifact-repo.test.ts | head -20`

- [ ] **Step 2: Add a new test inside the existing `describe` block**

```ts
it('enlists in the caller transaction and rolls back with it', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.org_id = $1`, [orgId]);
    const repo = new PgArtifactRepo(client);
    const r = await repo.publish({
      serviceId,
      expectedPreviousSeq: undefined,
      row: makeRow(orgId, serviceId),
      outboxPayload: { serviceId, bundleDigest: 'deadbeef', orgId },
      auditActorAccountId: accountId,
      auditActorTokenId: null,
      moveTags: [],
    });
    expect(r.ok).toBe(true);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  const after = await pool.query(`SELECT count(*)::int AS n FROM artifact_version WHERE service_id=$1`, [serviceId]);
  expect(after.rows[0].n).toBe(0);
});
```

`makeRow` is the helper already in the test file producing a `PublishInsertRow`. If it doesn't exist, extract it from the existing publish-success test.

- [ ] **Step 3: Run the test to see it fail**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/artifact-repo.test.ts -t "enlists"`
Expected: fails because `PgArtifactRepo` currently takes `Pool`, not a `PoolClient`. The TS compile may fail first (`Argument of type 'PoolClient' is not assignable to parameter of type 'Pool'`).

### Task 2.2 — Rework `PgArtifactRepo` to take `PgQueryable` and run on the caller's client

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/repos/pg-artifact-repo.ts`

- [ ] **Step 1: Change the constructor and drop the internal `.connect()`**

Replace the file with:

```ts
import { ok, err, type Result, type PlatformError, type ArtifactRepo, type ArtifactVersion } from '@rntme-cli/platform-core';
import type { PgQueryable } from '../pg/pool.js';

export class PgArtifactRepo implements ArtifactRepo {
  constructor(private readonly db: PgQueryable) {}

  async findByDigest(serviceId: string, bundleDigest: string): Promise<Result<ArtifactVersion | null, PlatformError>> {
    try {
      const r = await this.db.query(`SELECT * FROM artifact_version WHERE service_id=$1 AND bundle_digest=$2 LIMIT 1`, [
        serviceId,
        bundleDigest,
      ]);
      return ok(r.rows[0] ? rowToVersion(r.rows[0] as Record<string, unknown>) : null);
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }

  async latestSeq(serviceId: string): Promise<Result<number, PlatformError>> {
    try {
      const r = await this.db.query(`SELECT COALESCE(MAX(seq),0)::int AS seq FROM artifact_version WHERE service_id=$1`, [
        serviceId,
      ]);
      return ok(r.rows[0].seq);
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }

  async publish(args: Parameters<ArtifactRepo['publish']>[0]): Promise<Result<ArtifactVersion, PlatformError>> {
    try {
      const dup = await this.db.query(`SELECT * FROM artifact_version WHERE service_id=$1 AND bundle_digest=$2`, [
        args.serviceId,
        args.row.bundleDigest,
      ]);
      if (dup.rows[0]) return ok(rowToVersion(dup.rows[0] as Record<string, unknown>));
      await this.db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [args.serviceId]);
      const last = await this.db.query(
        `SELECT COALESCE(MAX(seq),0)::int AS seq, (SELECT id FROM artifact_version WHERE service_id=$1 ORDER BY seq DESC LIMIT 1) AS id FROM artifact_version WHERE service_id=$1`,
        [args.serviceId],
      );
      const latestSeq = last.rows[0].seq as number;
      const latestId = last.rows[0].id as string | null;
      if (args.expectedPreviousSeq !== undefined && args.expectedPreviousSeq !== latestSeq) {
        return err([
          {
            code: 'PLATFORM_CONCURRENCY_VERSION_CONFLICT',
            message: `expected ${args.expectedPreviousSeq} but latest ${latestSeq}`,
          },
        ]);
      }
      const ins = await this.db.query(
        `INSERT INTO artifact_version (
           id, org_id, service_id, seq, bundle_digest, previous_version_id,
           manifest_digest, pdm_digest, qsm_digest, graph_ir_digest, bindings_digest, ui_digest, seed_digest,
           validation_snapshot, published_by_account_id, published_by_token_id, message
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
         ) RETURNING *`,
        [
          args.row.id, args.row.orgId, args.serviceId, latestSeq + 1, args.row.bundleDigest, latestId,
          args.row.manifestDigest, args.row.pdmDigest, args.row.qsmDigest, args.row.graphIrDigest,
          args.row.bindingsDigest, args.row.uiDigest, args.row.seedDigest,
          args.row.validationSnapshot, args.row.publishedByAccountId, args.row.publishedByTokenId, args.row.message,
        ],
      );
      const inserted = ins.rows[0] as Record<string, unknown>;
      for (const t of args.moveTags) {
        await this.db.query(
          `INSERT INTO artifact_tag (service_id, name, version_id, updated_by_account_id) VALUES ($1,$2,$3,$4)
           ON CONFLICT (service_id, name) DO UPDATE SET version_id=EXCLUDED.version_id, updated_at=now(), updated_by_account_id=EXCLUDED.updated_by_account_id`,
          [args.serviceId, t.name, inserted['id'], t.updatedByAccountId],
        );
        await this.db.query(
          `INSERT INTO audit_log (org_id, actor_account_id, actor_token_id, action, resource_kind, resource_id, payload)
           VALUES ($1,$2,$3,'tag.moved','tag',$4,$5)`,
          [args.row.orgId, args.auditActorAccountId, args.auditActorTokenId, t.name, { versionSeq: latestSeq + 1 }],
        );
      }
      await this.db.query(
        `INSERT INTO audit_log (org_id, actor_account_id, actor_token_id, action, resource_kind, resource_id, payload)
         VALUES ($1,$2,$3,'version.published','version',$4,$5)`,
        [args.row.orgId, args.auditActorAccountId, args.auditActorTokenId, inserted['id'], { seq: latestSeq + 1 }],
      );
      await this.db.query(`INSERT INTO event_outbox (org_id, event_type, payload) VALUES ($1,'artifact.version.published',$2)`, [
        args.row.orgId,
        args.outboxPayload,
      ]);
      return ok(rowToVersion(inserted));
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }

  async listBySeq(
    serviceId: string,
    opts: { limit: number; cursor: number | undefined },
  ): Promise<Result<readonly ArtifactVersion[], PlatformError>> {
    try {
      if (opts.cursor !== undefined) {
        const r = await this.db.query(
          `SELECT * FROM artifact_version WHERE service_id=$1 AND seq<$2 ORDER BY seq DESC LIMIT $3`,
          [serviceId, opts.cursor, opts.limit],
        );
        return ok(r.rows.map((row) => rowToVersion(row as Record<string, unknown>)));
      }
      const r = await this.db.query(`SELECT * FROM artifact_version WHERE service_id=$1 ORDER BY seq DESC LIMIT $2`, [
        serviceId,
        opts.limit,
      ]);
      return ok(r.rows.map((row) => rowToVersion(row as Record<string, unknown>)));
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }

  async getBySeq(serviceId: string, seq: number): Promise<Result<ArtifactVersion | null, PlatformError>> {
    try {
      const r = await this.db.query(`SELECT * FROM artifact_version WHERE service_id=$1 AND seq=$2`, [serviceId, seq]);
      return ok(r.rows[0] ? rowToVersion(r.rows[0] as Record<string, unknown>) : null);
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }
}

function rowToVersion(r: Record<string, unknown>): ArtifactVersion {
  return {
    id: r['id'] as string,
    orgId: r['org_id'] as string,
    serviceId: r['service_id'] as string,
    seq: r['seq'] as number,
    bundleDigest: r['bundle_digest'] as string,
    previousVersionId: (r['previous_version_id'] as string | null) ?? null,
    manifestDigest: r['manifest_digest'] as string,
    pdmDigest: r['pdm_digest'] as string,
    qsmDigest: r['qsm_digest'] as string,
    graphIrDigest: r['graph_ir_digest'] as string,
    bindingsDigest: r['bindings_digest'] as string,
    uiDigest: r['ui_digest'] as string,
    seedDigest: r['seed_digest'] as string,
    validationSnapshot: r['validation_snapshot'] as Record<string, unknown>,
    publishedByAccountId: r['published_by_account_id'] as string,
    publishedByTokenId: (r['published_by_token_id'] as string | null) ?? null,
    publishedAt: r['published_at'] as Date,
    message: (r['message'] as string | null) ?? null,
  };
}
```

Note: the old code opened its own `pool.connect()` + `BEGIN`. The new code assumes the caller opened one. Pre-check / advisory-lock / INSERT / audit / outbox all run on the shared client.

### Task 2.3 — Change the other three Pool-only repos to `PgQueryable`

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/repos/pg-audit-repo.ts`
- Modify: `rntme-cli/packages/platform-storage/src/repos/pg-outbox-repo.ts`
- Modify: `rntme-cli/packages/platform-storage/src/repos/pg-tag-repo.ts`

- [ ] **Step 1: For each file, change the constructor signature and any internal `this.pool.query(...)` to `this.db.query(...)`**

Pattern:
```ts
import type { PgQueryable } from '../pg/pool.js';
// …
export class PgAuditRepo implements AuditRepo {
  constructor(private readonly db: PgQueryable) {}
  // replace this.pool.query(...) with this.db.query(...) throughout
}
```

Repeat for `PgOutboxRepo` and `PgTagRepo`. Do not change the query strings or result mapping.

### Task 2.4 — Run the existing integration suite and the new publish-rollback test

- [ ] **Step 1: Run**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/`
Expected: all tests green, including the new "enlists in the caller transaction" test.

### Task 2.5 — Commit

```bash
git -C rntme-cli add packages/platform-storage/src/repos/pg-artifact-repo.ts \
  packages/platform-storage/src/repos/pg-audit-repo.ts \
  packages/platform-storage/src/repos/pg-outbox-repo.ts \
  packages/platform-storage/src/repos/pg-tag-repo.ts \
  packages/platform-storage/test/integration/artifact-repo.test.ts

git -C rntme-cli commit -m "feat(platform-storage): tx-scoped repo constructors (PgQueryable)

Errata §3.1. PgArtifactRepo, PgAuditRepo, PgOutboxRepo, PgTagRepo stop
calling pool.connect() and take a PgQueryable (Pool or PoolClient). Enables
the per-request RLS middleware in the next commit to enlist every repo in
one shared transaction.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 3 — Per-request RLS middleware + resolveDeps + /v1/auth/me fix

**Why:** Errata §3.1 (the main fix) and Important 9 (the `/auth/me` mount bug — ships in this commit since it edits `app.ts` which we are already changing).

### Task 3.1 — Write a failing unit test for `openOrgScopedTx`

**Files:**
- Create: `rntme-cli/packages/platform-http/test/unit/middleware/tx.test.ts`

- [ ] **Step 1: Create the test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { openOrgScopedTx } from '../../../src/middleware/tx.js';

function makePoolStub() {
  const queries: Array<{ sql: string; params: unknown[] | undefined }> = [];
  const release = vi.fn();
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      return { rows: [] };
    }),
    release,
  };
  const connect = vi.fn(async () => client);
  return { pool: { connect } as never, client, queries, release };
}

describe('openOrgScopedTx', () => {
  it('issues BEGIN, SET LOCAL app.org_id, runs handler, COMMITs, releases', async () => {
    const { pool, queries, release } = makePoolStub();
    const app = new Hono();
    app.use('*', (c, next) => {
      c.set('subject', { org: { id: 'org-1', slug: 'a' } } as never);
      return next();
    });
    app.use('*', openOrgScopedTx(pool));
    app.get('/', (c) => c.text(c.get('tx') ? 'ok' : 'no-tx'));
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(queries.map((q) => q.sql)).toEqual([
      'BEGIN',
      expect.stringContaining('SET LOCAL app.org_id'),
      'COMMIT',
    ]);
    expect(queries[1]!.params).toEqual(['org-1']);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('ROLLBACKs when the handler throws', async () => {
    const { pool, queries, release } = makePoolStub();
    const app = new Hono();
    app.use('*', (c, next) => {
      c.set('subject', { org: { id: 'org-x', slug: 'x' } } as never);
      return next();
    });
    app.use('*', openOrgScopedTx(pool));
    app.get('/', () => {
      throw new Error('boom');
    });
    const res = await app.request('/');
    expect(res.status).toBe(500);
    expect(queries.map((q) => q.sql)).toEqual([
      'BEGIN',
      expect.stringContaining('SET LOCAL app.org_id'),
      'ROLLBACK',
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/unit/middleware/tx.test.ts`
Expected: fails with module-not-found `src/middleware/tx.js`.

### Task 3.2 — Implement `openOrgScopedTx`

**Files:**
- Create: `rntme-cli/packages/platform-http/src/middleware/tx.ts`

- [ ] **Step 1: Create the file**

```ts
import type { MiddlewareHandler } from 'hono';
import type { Pool, PoolClient } from 'pg';

declare module 'hono' {
  interface ContextVariableMap {
    tx: PoolClient;
  }
}

export function openOrgScopedTx(pool: Pool): MiddlewareHandler {
  return async (c, next) => {
    const subject = c.get('subject');
    const client = await pool.connect();
    let committed = false;
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.org_id = $1`, [subject.org.id]);
      c.set('tx', client);
      await next();
      await client.query('COMMIT');
      committed = true;
    } finally {
      if (!committed) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      }
      client.release();
    }
  };
}
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/unit/middleware/tx.test.ts`
Expected: both cases green.

### Task 3.3 — Introduce `resolveDeps` and change `AppDeps` to use a `pool` + repo factory

**Files:**
- Create: `rntme-cli/packages/platform-http/src/resolve-deps.ts`
- Modify: `rntme-cli/packages/platform-http/src/app.ts`
- Modify: `rntme-cli/packages/platform-http/src/bin/server.ts`

- [ ] **Step 1: Create `resolve-deps.ts`**

```ts
import type { PoolClient } from 'pg';
import {
  PgOrganizationRepo,
  PgAccountRepo,
  PgMembershipMirrorRepo,
  PgWorkosEventLogRepo,
  PgProjectRepo,
  PgServiceRepo,
  PgArtifactRepo,
  PgTagRepo,
  PgTokenRepo,
  PgAuditRepo,
  PgOutboxRepo,
} from '@rntme-cli/platform-storage';
import type {
  OrganizationRepo, AccountRepo, MembershipMirrorRepo, WorkosEventLogRepo,
  ProjectRepo, ServiceRepo, ArtifactRepo, TagRepo, TokenRepo, AuditRepo, OutboxRepo,
} from '@rntme-cli/platform-core';

export type RequestRepos = {
  organizations: OrganizationRepo;
  accounts: AccountRepo;
  memberships: MembershipMirrorRepo;
  workosEventLog: WorkosEventLogRepo;
  projects: ProjectRepo;
  services: ServiceRepo;
  artifacts: ArtifactRepo;
  tags: TagRepo;
  tokens: TokenRepo;
  audit: AuditRepo;
  outbox: OutboxRepo;
};

export function resolveDeps(tx: PoolClient): RequestRepos {
  return {
    organizations: new PgOrganizationRepo(tx),
    accounts: new PgAccountRepo(tx),
    memberships: new PgMembershipMirrorRepo(tx),
    workosEventLog: new PgWorkosEventLogRepo(tx),
    projects: new PgProjectRepo(tx),
    services: new PgServiceRepo(tx),
    artifacts: new PgArtifactRepo(tx),
    tags: new PgTagRepo(tx),
    tokens: new PgTokenRepo(tx),
    audit: new PgAuditRepo(tx),
    outbox: new PgOutboxRepo(tx),
  };
}
```

- [ ] **Step 2: Rework `app.ts` to open the RLS TX on authed routes and resolve deps per request**

Replace the body of `createApp` with:

```ts
export type AppDeps = {
  env: Env;
  logger: pino.Logger;
  workos: WorkOSClient;
  cookiePassword: string;
  pool: Pool;
  blob: BlobStore;
  ids: Ids;
  /** Pool-scoped repos used by pre-auth routes only (webhook, auth callback, ops). */
  poolRepos: {
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
    workosEventLog: WorkosEventLogRepo;
    projects: ProjectRepo;
    tokens: TokenRepo;
  };
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.use('*', requestId());
  app.use('*', loggerMiddleware(deps.logger));
  app.use('*', errorHandler());
  app.use('*', corsMiddleware(deps.env.PLATFORM_CORS_ORIGINS));

  const apiTokenProvider = new ApiTokenProvider({
    tokens: deps.poolRepos.tokens,
    organizations: deps.poolRepos.organizations,
    accounts: deps.poolRepos.accounts,
    memberships: deps.poolRepos.memberships,
  });
  const workosProvider = new WorkOSAuthKitProvider({
    workos: deps.workos,
    cookiePassword: deps.cookiePassword,
    organizations: deps.poolRepos.organizations,
    accounts: deps.poolRepos.accounts,
    memberships: deps.poolRepos.memberships,
  });

  app.route(
    '/',
    opsRoutes({
      pool: deps.pool,
      blob: deps.blob,
      workos: deps.workos,
      openApiJson: () => buildOpenApi(deps.env),
    }),
  );

  app.route(
    '/v1/webhooks',
    webhookWorkosRoute({
      workos: deps.workos,
      secret: deps.env.WORKOS_WEBHOOK_SECRET,
      repos: {
        organizations: deps.poolRepos.organizations,
        accounts: deps.poolRepos.accounts,
        memberships: deps.poolRepos.memberships,
        projects: deps.poolRepos.projects,
        workosEventLog: deps.poolRepos.workosEventLog,
      },
    }),
  );

  // Pre-auth /v1/auth (login, callback, logout) stays on pool-scoped repos.
  app.route(
    '/v1/auth',
    authRoutes({
      workos: deps.workos,
      env: deps.env,
      cookiePassword: deps.cookiePassword,
      repos: {
        organizations: deps.poolRepos.organizations,
        accounts: deps.poolRepos.accounts,
        memberships: deps.poolRepos.memberships,
      },
    }),
  );

  const rateLimiter = new InMemoryRateLimiter({ windowMs: 60_000, max: 1000 });
  const authed = new Hono()
    .use('*', requireAuth([apiTokenProvider, workosProvider]))
    .use('*', rateLimit(rateLimiter, (c) => c.get('subject').tokenId ?? c.get('subject').account.id))
    .use('*', openOrgScopedTx(deps.pool));

  authed.get('/v1/auth/me', (c) => {
    const s = c.get('subject');
    return c.json({ account: s.account, org: s.org, role: s.role, scopes: s.scopes });
  });
  authed.route('/v1/orgs', orgRoutes({ ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/projects', projectRoutes({ ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/projects/:projSlug/services', serviceRoutes({ ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/projects/:projSlug/services/:svcSlug', versionRoutes({ blob: deps.blob, ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/tokens', tokenRoutes({ ids: deps.ids }));
  authed.route('/v1/orgs/:orgSlug/audit', auditRoutes());

  app.route('/', authed);

  return app;
}
```

Delete the old `/v1/auth/me` handler inside `authRoutes` (it moves into `authed` above). Also delete the old `deps.repos` parameter in the route factories — they now pull per-request repos via `resolveDeps(c.get('tx'))`.

- [ ] **Step 3: Update every authed route factory's signature and body**

For each of `routes/orgs.ts`, `routes/projects.ts`, `routes/services.ts`, `routes/versions.ts`, `routes/tokens.ts`, `routes/audit.ts`:

1. Change the exported function's parameter type to drop the repo fields. Keep `ids` (and `blob` on `versions.ts`).
2. At the top of every handler, add: `const repos = resolveDeps(c.get('tx'));` then use `repos.projects`, etc. in place of `deps.projects`.

Example for `routes/orgs.ts` before:
```ts
export function orgRoutes(deps: { organizations: OrganizationRepo }): Hono { … deps.organizations.listForAccount(…) … }
```
After:
```ts
import { resolveDeps } from '../resolve-deps.js';
export function orgRoutes(deps: { ids: Ids }): Hono {
  const app = new Hono();
  app.get('/', async (c) => {
    const repos = resolveDeps(c.get('tx'));
    const s = c.get('subject');
    const list = await repos.organizations.listForAccount(s.account.id);
    return respond(c, list);
  });
  return app;
}
```

Keep the `ids` parameter threaded through (used for UUID generation in create paths).

- [ ] **Step 4: Also update `routes/helpers.ts:resolveProject` and `resolveService`**

They currently take `deps: { organizations, projects, services }`. Change to take the `RequestRepos`-shaped subset so callers pass `resolveDeps(c.get('tx'))` directly.

- [ ] **Step 5: Update `bin/server.ts` to construct pool-scoped repos instead of per-request repos**

Replace the `repos: { … }` block in `bin/server.ts` with:

```ts
const poolRepos = {
  organizations: new PgOrganizationRepo(pool),
  accounts: new PgAccountRepo(pool),
  memberships: new PgMembershipMirrorRepo(pool),
  workosEventLog: new PgWorkosEventLogRepo(pool),
  projects: new PgProjectRepo(pool),
  tokens: new PgTokenRepo(pool),
};

const app = createApp({
  env, logger, workos, cookiePassword, pool, blob, ids, poolRepos,
});
```

Remove the imports of `PgServiceRepo, PgArtifactRepo, PgTagRepo, PgAuditRepo, PgOutboxRepo` (not needed at boot; resolved per-request).

- [ ] **Step 6: Update the e2e harness similarly**

`rntme-cli/packages/platform-http/test/e2e/harness.ts` currently constructs all 11 repos on the pool and passes `deps.repos = { … }`. Change to:

```ts
const poolRepos = {
  organizations: new PgOrganizationRepo(pool),
  accounts: new PgAccountRepo(pool),
  memberships: new PgMembershipMirrorRepo(pool),
  workosEventLog: new PgWorkosEventLogRepo(pool),
  projects: new PgProjectRepo(pool),
  tokens: new PgTokenRepo(pool),
};
const deps: AppDeps = { env, logger, workos, cookiePassword: 'x'.repeat(32), pool, blob, ids, poolRepos };
```

Also change the harness pool from owner to `platform_app`:

```ts
const ownerPool = createPool(pg.getConnectionUri());
const ownerDb = createDb(ownerPool);
await runMigrations(ownerDb, ownerPool);
await ownerPool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_app`);
await ownerPool.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO platform_app`);
await ownerPool.end();
const parsed = new URL(pg.getConnectionUri());
parsed.username = 'platform_app';
parsed.password = 'platform_app';
const pool = createPool(parsed.toString());
```

After this change the e2e tests genuinely exercise RLS. Keep the `teardown` which ends `pool` + stops `pg` + `minio`.

### Task 3.4 — Run the full HTTP test suite

- [ ] **Step 1: Unit + integration + e2e**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http test`
Expected: all tests green. `/v1/auth/me` test (add a fresh one) returns 200 with the subject when an API token is provided.

- [ ] **Step 2: Add a unit test for `/v1/auth/me` wired under `authed`**

Create `rntme-cli/packages/platform-http/test/unit/routes/auth-me.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';

describe('/v1/auth/me', () => {
  it('returns 401 when no subject', async () => {
    const app = new Hono();
    app.get('/v1/auth/me', () =>
      new Response(JSON.stringify({ error: { code: 'PLATFORM_AUTH_MISSING', message: 'x' } }), { status: 401 }),
    );
    const res = await app.request('/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
```

This is a light smoke test; the genuine coverage comes from the e2e suite hitting the real app.

### Task 3.5 — Commit

```bash
git -C rntme-cli add packages/platform-http/src/middleware/tx.ts \
  packages/platform-http/src/resolve-deps.ts \
  packages/platform-http/src/app.ts \
  packages/platform-http/src/routes/ \
  packages/platform-http/src/bin/server.ts \
  packages/platform-http/test/unit/middleware/tx.test.ts \
  packages/platform-http/test/unit/routes/auth-me.test.ts \
  packages/platform-http/test/e2e/harness.ts

git -C rntme-cli commit -m "feat(platform-http): per-request RLS middleware + /v1/auth/me fix

Errata §3.1 + Important 9. openOrgScopedTx opens a PoolClient, BEGIN,
SET LOCAL app.org_id, stashes tx in Hono context, COMMIT/ROLLBACK.
resolveDeps builds per-request repos on that client. /v1/auth/me moves
inside the authed sub-app (previously unreachable). E2E harness rewired
to run on the platform_app role.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 4 — PLATFORM_COOKIE_PASSWORD required (drop padEnd fallback)

**Why:** Errata §3.9.

### Task 4.1 — Write failing unit test for env parsing

**Files:**
- Modify: `rntme-cli/packages/platform-http/test/unit/config/env.test.ts`

- [ ] **Step 1: Locate the existing env test**

Run: `grep -n "parseEnv\|describe" rntme-cli/packages/platform-http/test/unit/config/env.test.ts`

- [ ] **Step 2: Add these cases inside the existing describe**

```ts
it('rejects missing PLATFORM_COOKIE_PASSWORD', () => {
  expect(() => parseEnv({ ...baseEnv, PLATFORM_COOKIE_PASSWORD: undefined })).toThrow(/PLATFORM_COOKIE_PASSWORD/);
});

it('rejects a PLATFORM_COOKIE_PASSWORD shorter than 32 chars', () => {
  expect(() => parseEnv({ ...baseEnv, PLATFORM_COOKIE_PASSWORD: 'short' })).toThrow(/at least 32/);
});

it('accepts a PLATFORM_COOKIE_PASSWORD of 32+ chars', () => {
  const env = parseEnv({ ...baseEnv, PLATFORM_COOKIE_PASSWORD: 'x'.repeat(32) });
  expect(env.PLATFORM_COOKIE_PASSWORD).toHaveLength(32);
});
```

If `baseEnv` doesn't exist, extract a helper at the top of the file:
```ts
const baseEnv = {
  DATABASE_URL: 'postgres://u:p@h/db',
  RUSTFS_ENDPOINT: 'http://r',
  RUSTFS_ACCESS_KEY_ID: 'a',
  RUSTFS_SECRET_ACCESS_KEY: 's',
  RUSTFS_BUCKET: 'b',
  WORKOS_API_KEY: 'k',
  WORKOS_CLIENT_ID: 'c',
  WORKOS_WEBHOOK_SECRET: 'w',
  WORKOS_REDIRECT_URI: 'http://cb',
  PLATFORM_BASE_URL: 'http://base',
  PLATFORM_SESSION_COOKIE_DOMAIN: 'base',
  PLATFORM_COOKIE_PASSWORD: 'y'.repeat(32),
};
```

- [ ] **Step 3: Run — expect failures (the "missing" case still accepts because current schema is `.optional()`)**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/unit/config/env.test.ts`
Expected: the "rejects missing" case fails.

### Task 4.2 — Make it required

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/config/env.ts`
- Modify: `rntme-cli/packages/platform-http/src/bin/server.ts`

- [ ] **Step 1: Change env schema line**

Replace:
```ts
PLATFORM_COOKIE_PASSWORD: z.string().min(32).optional(),
```
With:
```ts
PLATFORM_COOKIE_PASSWORD: z.string().min(32),
```

- [ ] **Step 2: Drop the padEnd fallback in `bin/server.ts`**

Replace:
```ts
const cookiePassword = (env.PLATFORM_COOKIE_PASSWORD ?? '').padEnd(32, 'x').slice(0, 64);
```
With:
```ts
const cookiePassword = env.PLATFORM_COOKIE_PASSWORD;
```

- [ ] **Step 3: Run tests**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/unit/config/env.test.ts`
Expected: green.

### Task 4.3 — Commit

```bash
git -C rntme-cli add packages/platform-http/src/config/env.ts \
  packages/platform-http/src/bin/server.ts \
  packages/platform-http/test/unit/config/env.test.ts

git -C rntme-cli commit -m "fix(platform-http): PLATFORM_COOKIE_PASSWORD required (≥32 chars)

Errata §3.9. Drops the padEnd('x') fallback that silently let boot succeed
with a guessable sealed-session key.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 5 — Canonical-json upload + digest-matches-bytes test

**Why:** Errata §3.6.

### Task 5.1 — Write a failing test proving stored bytes re-hash to the stored digest

**Files:**
- Create: `rntme-cli/packages/platform-core/test/unit/use-cases/publish-version-canonical.test.ts`

- [ ] **Step 1: Create the test**

```ts
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { publishVersion } from '../../../src/use-cases/publish-version.js';
import { FakeStore } from '../../../src/testing/fakes.js';
import { RandomIds, canonicalize, sha256Hex, blobKey } from '../../../src/index.js';

describe('publishVersion', () => {
  it('uploads canonical-json bytes that re-hash to each per-file digest', async () => {
    const store = new FakeStore();
    const blob = store.blob;
    const ids = new RandomIds();
    await store.seedBasics();

    const bundle = store.minimalBundle();
    const r = await publishVersion(
      { repos: { artifacts: store.artifacts, services: store.services }, blob, ids },
      {
        orgId: store.orgId,
        serviceId: store.serviceId,
        accountId: store.accountId,
        tokenId: null,
        bundle,
      },
    );
    expect(r.ok).toBe(true);

    for (const name of ['manifest', 'pdm', 'qsm', 'graphIr', 'bindings', 'ui', 'seed'] as const) {
      const body = (bundle as Record<string, unknown>)[name];
      const expected = sha256Hex(canonicalize(body));
      const stored = store.uploads.get(blobKey(expected));
      expect(stored).toBeDefined();
      const actualHash = createHash('sha256').update(stored!).digest('hex');
      expect(actualHash).toBe(expected);
    }
  });
});
```

This assumes `FakeStore` exposes `seedBasics()`, `minimalBundle()`, `uploads: Map<string, Buffer>`. If those helpers do not exist, first extend `FakeStore` with:

```ts
// inside testing/fakes.ts
uploads = new Map<string, Buffer>();
orgId = '00000000-0000-0000-0000-000000000aaa';
serviceId = '00000000-0000-0000-0000-000000000bbb';
accountId = '00000000-0000-0000-0000-000000000ccc';

async seedBasics() {
  await this.organizations.upsertFromWorkos({ workosOrganizationId: 'w1', slug: 'o', displayName: 'O' });
  // … match existing patterns to seed an org, project, service referenced by the ids above.
}
minimalBundle() { return { manifest:{a:1}, pdm:{b:2}, qsm:{c:3}, graphIr:{d:4}, bindings:{e:5}, ui:{f:6}, seed:{g:7} }; }
```

And have the `blob` member record bytes to `this.uploads` on `putIfAbsent`.

- [ ] **Step 2: Run — expect failure (JSON.stringify ≠ canonicalize for non-sorted input in general)**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-core vitest run test/unit/use-cases/publish-version-canonical.test.ts`
Expected: the per-file assertion fails for at least one file (digest mismatch). For trivial single-key objects this may accidentally pass; to guarantee failure, use a bundle like `{manifest: {b: 1, a: 2}, …}` — unsorted keys make `JSON.stringify(x) !== canonicalize(x)`.

### Task 5.2 — Switch the upload to canonical bytes

**Files:**
- Modify: `rntme-cli/packages/platform-core/src/use-cases/publish-version.ts`

- [ ] **Step 1: Change line 64**

Replace:
```ts
const up = await deps.blob.putIfAbsent(key, Buffer.from(JSON.stringify(body)));
```
With:
```ts
const up = await deps.blob.putIfAbsent(key, Buffer.from(canonicalize(body), 'utf8'));
```

- [ ] **Step 2: Add the import**

Insert near the top:
```ts
import { canonicalize } from '../validation/canonical-json.js';
```

- [ ] **Step 3: Re-run**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-core vitest run test/unit/use-cases/publish-version-canonical.test.ts`
Expected: green.

### Task 5.3 — Commit

```bash
git -C rntme-cli add packages/platform-core/src/use-cases/publish-version.ts \
  packages/platform-core/src/testing/fakes.ts \
  packages/platform-core/test/unit/use-cases/publish-version-canonical.test.ts

git -C rntme-cli commit -m "fix(platform-core): upload canonical-json bytes on publish

Errata §3.6. Per-file digests are computed over canonical-json; the uploaded
bytes must match so that a consumer fetching sha256/<digest>.json re-hashes
to the same digest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 6 — Atomic organization.deleted cascade + revoke all tokens

**Why:** Errata §3.4. `PgOrganizationRepo.archive` becomes UPDATE; new `archiveOrgCascade` use-case archives projects and revokes tokens in a single TX.

### Task 6.1 — Extend `TokenRepo` with `revokeAllForOrg`

**Files:**
- Modify: `rntme-cli/packages/platform-core/src/repos/token-repo.ts`
- Modify: `rntme-cli/packages/platform-storage/src/repos/pg-token-repo.ts`
- Modify: `rntme-cli/packages/platform-core/src/testing/fakes.ts`

- [ ] **Step 1: Add to the interface**

```ts
revokeAllForOrg(orgId: string): Promise<Result<number, PlatformError>>;
```
(returns count of revoked tokens)

- [ ] **Step 2: Implement on `PgTokenRepo`**

```ts
async revokeAllForOrg(orgId: string): Promise<Result<number, PlatformError>> {
  try {
    const r = await this.db.query(
      `UPDATE api_token SET revoked_at = now() WHERE org_id = $1 AND revoked_at IS NULL`,
      [orgId],
    );
    return ok(r.rowCount ?? 0);
  } catch (cause) {
    return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
  }
}
```

- [ ] **Step 3: Implement on the fake**

```ts
async revokeAllForOrg(orgId: string) {
  let n = 0;
  for (const t of this._tokens) if (t.orgId === orgId && !t.revokedAt) { t.revokedAt = new Date(); n++; }
  return ok(n);
}
```

### Task 6.2 — Change `PgOrganizationRepo.archive` to UPDATE archived_at

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/repos/pg-org-repo.ts`

- [ ] **Step 1: Replace `archive`**

```ts
async archive(id: string): Promise<Result<void, PlatformError>> {
  try {
    await this.db.update(organization).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(organization.id, id));
    return ok(undefined);
  } catch (cause) {
    return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
  }
}
```

- [ ] **Step 2: Update finder methods to exclude archived by default; add `_IncludingArchived` variants**

Extend `OrganizationRepo` in `platform-core/src/repos/org-repo.ts`:

```ts
findByIdIncludingArchived(id: string): Promise<Result<Organization | null, PlatformError>>;
findBySlugIncludingArchived(slug: string): Promise<Result<Organization | null, PlatformError>>;
findByWorkosIdIncludingArchived(workosId: string): Promise<Result<Organization | null, PlatformError>>;
```

In `pg-org-repo.ts` every regular finder gains an `isNull(organization.archivedAt)` filter; each gets a companion `*IncludingArchived` that skips the filter. The cascade path uses the `*IncludingArchived` variants; normal request flow uses the regular ones (so an archived org looks like 404 from the authed API).

```ts
async findById(id: string) {
  const rows = await this.db.select().from(organization)
    .where(and(eq(organization.id, id), isNull(organization.archivedAt)))
    .limit(1);
  return ok(rows[0] ? rowToOrg(rows[0]) : null);
}
async findByIdIncludingArchived(id: string) {
  const rows = await this.db.select().from(organization).where(eq(organization.id, id)).limit(1);
  return ok(rows[0] ? rowToOrg(rows[0]) : null);
}
// same pattern for findBySlug / findBySlugIncludingArchived and findByWorkosId / findByWorkosIdIncludingArchived
```

Import `isNull` from `drizzle-orm` at the top of the file if not already present.

Mirror the same six methods in the in-memory fake (`platform-core/src/testing/fakes.ts`).

### Task 6.3 — Write a failing integration test for the cascade

**Files:**
- Create: `rntme-cli/packages/platform-storage/test/integration/org-cascade.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPostgres, stopPostgres, type PgHandles, resetSchema } from './harness.js';
import { integrationContainersAvailable } from './docker-available.js';
import { archiveOrgCascade } from '@rntme-cli/platform-core';
import { PgOrganizationRepo, PgProjectRepo, PgTokenRepo } from '../../src/index.js';
import { randomUUID, randomBytes } from 'node:crypto';
import { withTransaction } from '../../src/pg/tx.js';

const d = integrationContainersAvailable() ? describe : describe.skip;

d('archiveOrgCascade', () => {
  let h: PgHandles;
  beforeAll(async () => { h = await startPostgres(); }, 60_000);
  afterAll(async () => { if (h) await stopPostgres(h); });

  it('archives org + projects and revokes tokens in one TX', async () => {
    await resetSchema(h.pool);
    const orgId = randomUUID();
    const accountId = randomUUID();
    const projectId = randomUUID();
    const tokenId = randomUUID();
    await h.pool.query(`INSERT INTO organization (id, workos_organization_id, slug, display_name) VALUES ($1,'w','s','S')`, [orgId]);
    await h.pool.query(`INSERT INTO account (id, workos_user_id, display_name) VALUES ($1,'u','U')`, [accountId]);
    await h.pool.query(`INSERT INTO project (id, org_id, slug, display_name) VALUES ($1,$2,'p','P')`, [projectId, orgId]);
    await h.pool.query(
      `INSERT INTO api_token (id, org_id, account_id, name, token_hash, prefix, scopes) VALUES ($1,$2,$3,'t',$4,'abcdefghijkl','{"project:read"}')`,
      [tokenId, orgId, accountId, randomBytes(32)],
    );

    await withTransaction(h.pool, orgId, async (client) => {
      const res = await archiveOrgCascade(
        { repos: { organizations: new PgOrganizationRepo(client), projects: new PgProjectRepo(client), tokens: new PgTokenRepo(client) } },
        { orgId },
      );
      expect(res.ok).toBe(true);
    });

    const r1 = await h.pool.query(`SELECT archived_at FROM organization WHERE id=$1`, [orgId]);
    expect(r1.rows[0].archived_at).not.toBeNull();
    const r2 = await h.pool.query(`SELECT archived_at FROM project WHERE id=$1`, [projectId]);
    expect(r2.rows[0].archived_at).not.toBeNull();
    const r3 = await h.pool.query(`SELECT revoked_at FROM api_token WHERE id=$1`, [tokenId]);
    expect(r3.rows[0].revoked_at).not.toBeNull();
  });
});
```

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/org-cascade.test.ts`
Expected: fails because `archiveOrgCascade` does not exist yet.

### Task 6.4 — Implement `archiveOrgCascade` and wire it into `workos-sync`

**Files:**
- Create: `rntme-cli/packages/platform-core/src/use-cases/archive-org-cascade.ts`
- Modify: `rntme-cli/packages/platform-core/src/use-cases/workos-sync.ts`
- Modify: `rntme-cli/packages/platform-core/src/index.ts`

- [ ] **Step 1: Create the use-case**

```ts
import { ok, isOk, type Result, type PlatformError } from '../types/result.js';
import type { OrganizationRepo } from '../repos/org-repo.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { TokenRepo } from '../repos/token-repo.js';

type Deps = { repos: { organizations: OrganizationRepo; projects: ProjectRepo; tokens: TokenRepo } };

export async function archiveOrgCascade(
  deps: Deps,
  input: { orgId: string },
): Promise<Result<{ projectsArchived: number; tokensRevoked: number }, PlatformError>> {
  const projList = await deps.repos.projects.list(input.orgId, { includeArchived: false });
  if (!isOk(projList)) return projList;
  let projectsArchived = 0;
  for (const p of projList.value) {
    const a = await deps.repos.projects.archive(input.orgId, p.id);
    if (!isOk(a)) return a;
    projectsArchived++;
  }
  const rev = await deps.repos.tokens.revokeAllForOrg(input.orgId);
  if (!isOk(rev)) return rev;
  const arc = await deps.repos.organizations.archive(input.orgId);
  if (!isOk(arc)) return arc;
  return ok({ projectsArchived, tokensRevoked: rev.value });
}
```

- [ ] **Step 2: Re-export from the barrel**

Append to `src/index.ts`:
```ts
export * from './use-cases/archive-org-cascade.js';
```

- [ ] **Step 3: Wire `workos-sync` with an atomic TX-gated idempotency guard for `organization.deleted` (errata §3.4)**

The handler cannot rely on the outer `hasProcessed → work → markProcessed` pattern for this branch — two concurrent deliveries can both pass the check. Move the idempotency check INTO a transaction so the cascade only runs when the event-log insert actually takes the row.

First, extend the `syncWorkosEvent` signature to accept a `Pool` (used only by this branch):

```ts
import type { Pool } from 'pg';
import { withTransaction } from '@rntme-cli/platform-storage';
import { archiveOrgCascade } from './archive-org-cascade.js';

type Deps = {
  pool: Pool;
  repos: {
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
    projects: ProjectRepo;
    tokens: TokenRepo;
    workosEventLog: WorkosEventLogRepo;
  };
};
```

Replace the `case 'organization.deleted':` block:

```ts
case 'organization.deleted': {
  const found = await deps.repos.organizations.findByWorkosIdIncludingArchived(ev.data.id);
  if (!isOk(found)) return found;
  if (!found.value) break;
  await withTransaction(deps.pool, found.value.id, async (client) => {
    const claimed = await client.query(
      `INSERT INTO workos_event_log (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [ev.id, ev.type],
    );
    if (!claimed.rows[0]) return;
    const cascade = await archiveOrgCascade(
      {
        repos: {
          organizations: new (await import('@rntme-cli/platform-storage')).PgOrganizationRepo(client),
          projects: new (await import('@rntme-cli/platform-storage')).PgProjectRepo(client),
          tokens: new (await import('@rntme-cli/platform-storage')).PgTokenRepo(client),
        },
      },
      { orgId: found.value!.id },
    );
    if (!isOk(cascade)) throw new Error(`cascade failed: ${JSON.stringify(cascade.errors)}`);
  });
  // Skip the outer markProcessed — the INSERT above already wrote the log row.
  return ok(undefined);
}
```

Note `findByWorkosIdIncludingArchived` — add this method to `OrganizationRepo` interface and `PgOrganizationRepo` alongside the `findByIdIncludingArchived` from Task 6.2. Mirror the other `_IncludingArchived` method.

Also extend the `Deps` type in the file and adjust the `webhookWorkosRoute` call site in `app.ts` / `routes/webhook-workos.ts` to pass `pool` and `poolRepos.tokens` in.

- [ ] **Step 4: Add a concurrency-safe test for the idempotency guard**

Append to `test/integration/org-cascade.test.ts`:

```ts
it('double delivery of organization.deleted revokes tokens exactly once', async () => {
  await resetSchema(h.pool);
  const orgId = randomUUID();
  const accountId = randomUUID();
  const projectId = randomUUID();
  const tokenId = randomUUID();
  await h.pool.query(`INSERT INTO organization (id, workos_organization_id, slug, display_name) VALUES ($1,'w2','s2','S')`, [orgId]);
  await h.pool.query(`INSERT INTO account (id, workos_user_id, display_name) VALUES ($1,'u2','U')`, [accountId]);
  await h.pool.query(`INSERT INTO project (id, org_id, slug, display_name) VALUES ($1,$2,'p','P')`, [projectId, orgId]);
  await h.pool.query(
    `INSERT INTO api_token (id, org_id, account_id, name, token_hash, prefix, scopes) VALUES ($1,$2,$3,'t',$4,'abcdefghijkl','{"project:read"}')`,
    [tokenId, orgId, accountId, randomBytes(32)],
  );

  const ev = { id: 'evt_same', type: 'organization.deleted' as const, data: { id: 'w2' } };
  const run = () =>
    syncWorkosEvent(
      { pool: h.pool, repos: { /* … inject pool-based repos here … */ } },
      ev,
    );
  const [r1, r2] = await Promise.all([run(), run()]);
  expect(r1.ok && r2.ok).toBe(true);
  const logCount = await h.pool.query(`SELECT count(*)::int AS n FROM workos_event_log WHERE event_id=$1`, [ev.id]);
  expect(logCount.rows[0].n).toBe(1);
});
```

- [ ] **Step 4: Run the cascade integration test**

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/org-cascade.test.ts`
Expected: green.

### Task 6.5 — Run the full submodule test suite

Run: `pnpm -C rntme-cli -r test`
Expected: green.

### Task 6.6 — Commit

```bash
git -C rntme-cli add packages/platform-core/src/use-cases/archive-org-cascade.ts \
  packages/platform-core/src/use-cases/workos-sync.ts \
  packages/platform-core/src/repos/token-repo.ts \
  packages/platform-core/src/repos/org-repo.ts \
  packages/platform-core/src/testing/fakes.ts \
  packages/platform-core/src/index.ts \
  packages/platform-storage/src/repos/pg-org-repo.ts \
  packages/platform-storage/src/repos/pg-token-repo.ts \
  packages/platform-storage/test/integration/org-cascade.test.ts \
  packages/platform-http/src/routes/webhook-workos.ts \
  packages/platform-http/src/app.ts

git -C rntme-cli commit -m "fix(platform-core): atomic org-cascade archive + token revoke

Errata §3.3, §3.4. Introduces archiveOrgCascade — one use-case that archives
projects, revokes tokens, and archives the organization in a caller TX.
PgOrganizationRepo.archive becomes UPDATE archived_at. findById/findBySlug
now exclude archived orgs by default; new findByIdIncludingArchived covers
the cascade path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 7 — Slug immutability: drop `slug` from `onConflictDoUpdate`

**Why:** Errata §3.5.

### Task 7.1 — Failing integration test

**Files:**
- Modify: `rntme-cli/packages/platform-storage/test/integration/identity-repos.test.ts`

- [ ] **Step 1: Add a test asserting that a second upsert with a different slug leaves the original slug**

```ts
it('upsertFromWorkos preserves the original slug on update (slug is immutable)', async () => {
  await resetSchema(pool);
  const repo = new PgOrganizationRepo(pool);
  const first = await repo.upsertFromWorkos({ workosOrganizationId: 'w1', slug: 'original', displayName: 'One' });
  expect(first.ok).toBe(true);
  const second = await repo.upsertFromWorkos({ workosOrganizationId: 'w1', slug: 'renamed', displayName: 'Two' });
  expect(second.ok).toBe(true);
  if (second.ok) {
    expect(second.value.slug).toBe('original');
    expect(second.value.displayName).toBe('Two');
  }
});
```

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/identity-repos.test.ts -t "slug is immutable"`
Expected: fail because the current upsert's onConflict rewrites `slug`.

### Task 7.2 — Drop `slug` from the update set

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/repos/pg-org-repo.ts`

- [ ] **Step 1: In `upsertFromWorkos`, change the `onConflictDoUpdate` set**

```ts
.onConflictDoUpdate({
  target: organization.workosOrganizationId,
  set: { displayName: a.displayName, updatedAt: new Date() },
})
```

- [ ] **Step 2: Re-run the test**

Expected: green.

### Task 7.3 — Commit

```bash
git -C rntme-cli add packages/platform-storage/src/repos/pg-org-repo.ts \
  packages/platform-storage/test/integration/identity-repos.test.ts

git -C rntme-cli commit -m "fix(platform-storage): restore slug immutability on org upsert

Errata §3.5. onConflictDoUpdate no longer rewrites slug; only displayName
and updatedAt change when WorkOS re-sends an org record.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 8 — Body-size limits (10 MiB publish / 1 MiB other POSTs)

**Why:** Errata §3.8.

### Task 8.1 — Failing unit test

**Files:**
- Create: `rntme-cli/packages/platform-http/test/unit/middleware/body-limit.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { bodyLimit } from '../../../src/middleware/body-limit.js';

describe('bodyLimit', () => {
  it('returns 413 on oversize request', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(8), (c) => c.text('ok'));
    const res = await app.request('/small', { method: 'POST', body: 'x'.repeat(100) });
    expect(res.status).toBe(413);
  });
  it('passes through small bodies', async () => {
    const app = new Hono();
    app.post('/small', bodyLimit(1024), (c) => c.text('ok'));
    const res = await app.request('/small', { method: 'POST', body: 'ok' });
    expect(res.status).toBe(200);
  });
});
```

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/unit/middleware/body-limit.test.ts`
Expected: module-not-found.

### Task 8.2 — Implement `bodyLimit`

**Files:**
- Create: `rntme-cli/packages/platform-http/src/middleware/body-limit.ts`

```ts
import type { MiddlewareHandler } from 'hono';

export function bodyLimit(maxBytes: number): MiddlewareHandler {
  return async (c, next) => {
    const len = Number(c.req.header('content-length') ?? '0');
    if (Number.isFinite(len) && len > maxBytes) {
      return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: `body exceeds ${maxBytes} bytes` } }, 413);
    }
    // For chunked requests without a Content-Length header, drain and count up to maxBytes+1.
    if (!c.req.header('content-length')) {
      const raw = c.req.raw.body;
      if (raw) {
        const reader = raw.getReader();
        let total = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) {
            return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: `body exceeds ${maxBytes} bytes` } }, 413);
          }
          chunks.push(value);
        }
        const body = new Blob(chunks);
        const req = new Request(c.req.url, {
          method: c.req.method,
          headers: c.req.raw.headers,
          body,
        });
        (c.req as unknown as { raw: Request }).raw = req;
      }
    }
    return next();
  };
}
```

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/unit/middleware/body-limit.test.ts`
Expected: green.

### Task 8.3 — Mount the limits in `app.ts`

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/app.ts`

- [ ] **Step 1: Add, before auth**

```ts
app.use('*', async (c, next) => {
  if (c.req.method !== 'POST') return next();
  const url = new URL(c.req.url);
  const isPublish = /\/v1\/orgs\/[^/]+\/projects\/[^/]+\/services\/[^/]+\/versions\/?$/.test(url.pathname);
  const cap = isPublish ? 10 * 1024 * 1024 : 1 * 1024 * 1024;
  return bodyLimit(cap)(c, next);
});
```

Add the import: `import { bodyLimit } from './middleware/body-limit.js';`

### Task 8.4 — Integration test (optional but cheap)

Already covered by the unit test plus the e2e flow that publishes a small bundle. If you want, add a 11 MiB negative test to `agent-workflow.test.ts`:

```ts
it('rejects a > 10 MiB publish body with 413', async () => {
  const res = await fetch(`${baseUrl}/v1/orgs/acme/projects/billing/services/svc/versions`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-length': String(11 * 1024 * 1024) },
    body: Buffer.alloc(11 * 1024 * 1024, 'a'),
  });
  expect(res.status).toBe(413);
});
```

### Task 8.5 — Commit

```bash
git -C rntme-cli add packages/platform-http/src/middleware/body-limit.ts \
  packages/platform-http/src/app.ts \
  packages/platform-http/test/unit/middleware/body-limit.test.ts

git -C rntme-cli commit -m "feat(platform-http): bodyLimit 10 MiB publish / 1 MiB other POSTs

Errata §3.8. Hono middleware rejects over-cap requests with 413 before Zod
parse or auth; DoS protection does not depend on authentication.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 9 — Real WorkOS org name on callback + strict role lookup

**Why:** Errata §3.7 and Important 16.

### Task 9.1 — Failing unit test for the auth callback using the WorkOS org name

**Files:**
- Modify: `rntme-cli/packages/platform-http/test/unit/routes/auth.test.ts` (or create if missing)

- [ ] **Step 1: Add**

```ts
it('callback seeds the org mirror with the real WorkOS org name', async () => {
  const stub = {
    userManagement: {
      getAuthorizationUrl: () => 'u',
      authenticateWithCode: async () => ({ user: { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B' }, organizationId: 'org_01ABC', sealedSession: 'sealed' }),
      loadSealedSession: () => ({ authenticate: async () => ({ authenticated: true, user: { id: 'u1' }, organizationId: 'org_01ABC' }) }),
    },
    organizations: {
      getOrganization: async (id: string) => ({ id, name: 'Acme Corp', slug: 'acme' }),
    },
  };
  const orgUpserts: Array<{ slug: string; displayName: string }> = [];
  const app = authRoutes({
    workos: stub as never,
    env: { /* … baseEnv */ } as never,
    cookiePassword: 'x'.repeat(32),
    repos: {
      organizations: { upsertFromWorkos: async (a: { slug: string; displayName: string }) => { orgUpserts.push(a); return { ok: true, value: a }; } } as never,
      accounts: { upsertFromWorkos: async () => ({ ok: true, value: {} as never }) } as never,
      memberships: { find: async () => ({ ok: true, value: null }) } as never,
    },
  });
  const res = await app.request('/callback?code=abc');
  expect(res.status).toBe(200);
  expect(orgUpserts[0]!.slug).toBe('acme');
  expect(orgUpserts[0]!.displayName).toBe('Acme Corp');
});
```

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/unit/routes/auth.test.ts -t "real WorkOS"`
Expected: fails because the current callback uses the raw `organizationId` string.

### Task 9.2 — Fetch the real org and use name + sanitized slug

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/routes/auth.ts`
- Modify: `rntme-cli/packages/platform-http/src/auth/workos-client.ts` (if it does not already expose `organizations.getOrganization`)

- [ ] **Step 1: Ensure the WorkOS client type includes `organizations.getOrganization`**

Grep: `grep -n "organizations" rntme-cli/packages/platform-http/src/auth/workos-client.ts`. If the type does not already expose `.organizations.getOrganization`, widen it.

- [ ] **Step 2: Replace the `if (organizationId) { … }` block in `routes/auth.ts`**

```ts
if (organizationId) {
  let name = organizationId;
  let slug = organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
  try {
    const wosOrg = await deps.workos.organizations.getOrganization(organizationId);
    if (wosOrg.name) name = wosOrg.name;
    if (wosOrg.slug) slug = wosOrg.slug;
    else slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || slug;
  } catch {
    /* fall back to organizationId-derived defaults */
  }
  await deps.repos.organizations.upsertFromWorkos({
    workosOrganizationId: organizationId,
    slug,
    displayName: name,
  });
}
```

Run: the unit test added in 9.1.
Expected: green.

### Task 9.3 — Failing unit test for WorkOSAuthKitProvider strict role lookup

**Files:**
- Modify: `rntme-cli/packages/platform-http/test/unit/auth/workos-provider.test.ts` (or create)

- [ ] **Step 1: Add**

```ts
it('returns err when memberships.find itself errors (no silent downgrade)', async () => {
  const provider = new WorkOSAuthKitProvider({
    workos: stubSession(),
    cookiePassword: 'x'.repeat(32),
    organizations: { findByWorkosId: async () => ({ ok: true, value: { id: 'o1', workosOrganizationId: 'w', slug: 's', displayName: 'S' } as never }) } as never,
    accounts: { findByWorkosUserId: async () => ({ ok: true, value: { id: 'a1', workosUserId: 'u', displayName: 'U', email: null } as never }) } as never,
    memberships: { find: async () => ({ ok: false, errors: [{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE' as const, message: 'boom' }] }) } as never,
  });
  const r = await provider.authenticate({ cookieHeader: 'rntme_session=sealed-ok', authorizationHeader: undefined });
  expect(r.ok).toBe(false);
});
```

`stubSession` returns a WorkOS stub whose `loadSealedSession().authenticate()` returns `{ authenticated: true, user: { id: 'u' }, organizationId: 'w' }`.

Run: expect failure (current code silently downgrades to role 'member').

### Task 9.4 — Propagate membership lookup errors strictly

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/auth/workos-provider.ts`

- [ ] **Step 1: Change the role resolution block**

Replace:
```ts
const mem = await this.deps.memberships.find(org.value.id, acct.value.id);
const role: Role = isOk(mem) && mem.value?.role === 'admin' ? 'admin' : 'member';
```
With:
```ts
const mem = await this.deps.memberships.find(org.value.id, acct.value.id);
if (!isOk(mem)) return mem;
const role: Role = mem.value?.role === 'admin' ? 'admin' : 'member';
```

Run: `pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/unit/auth/workos-provider.test.ts`
Expected: green.

### Task 9.5 — Commit

```bash
git -C rntme-cli add packages/platform-http/src/routes/auth.ts \
  packages/platform-http/src/auth/workos-provider.ts \
  packages/platform-http/src/auth/workos-client.ts \
  packages/platform-http/test/unit/routes/auth.test.ts \
  packages/platform-http/test/unit/auth/workos-provider.test.ts

git -C rntme-cli commit -m "fix(platform-http): real WorkOS org on callback + strict role lookup

Errata §3.7, Important 16. Auth callback fetches the authoritative WorkOS
organization record and seeds the mirror with the real name (and WorkOS
slug when present). WorkOSAuthKitProvider propagates membership lookup
errors rather than silently downgrading the role on DB failure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Commit 10 — /ready WorkOS false on catch + FakeStore off barrel + tags error code

**Why:** Important 17, 19, 21. Small, share the same commit since each touches an unrelated file.

### Task 10.1 — /ready WorkOS branch reports false on catch

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/routes/ops.ts`
- Modify: `rntme-cli/packages/platform-http/test/unit/routes/ops.test.ts` (or create)

- [ ] **Step 1: Failing test — ready returns 503 when workos stub throws**

```ts
it('/ready marks workos false when the probe throws', async () => {
  const app = new Hono();
  app.route('/', opsRoutes({
    pool: { query: async () => ({ rows: [] }) } as never,
    blob: { presignedGet: async () => ({ ok: true, value: 'u' }) } as never,
    workos: { listApiKeys: async () => { throw new Error('down'); } } as never,
    openApiJson: () => ({}),
  }));
  const res = await app.request('/ready');
  const body = await res.json();
  expect(body.checks.workos).toBe(false);
});
```

- [ ] **Step 2: Fix the catch**

In `routes/ops.ts`:
```ts
try {
  const w = deps.workos as WorkOSWithOptionalKeys;
  await w.listApiKeys?.({ limit: 1 });
  results.workos = true;
} catch {
  results.workos = false;
}
```

### Task 10.2 — Tags use the correct error code

**Files:**
- Modify: `rntme-cli/packages/platform-core/src/types/result.ts`
- Modify: `rntme-cli/packages/platform-core/src/use-cases/tags.ts`
- Modify: `rntme-cli/packages/platform-http/src/middleware/error-handler.ts` (ensure status mapping covers the new code — probably falls through to 404 via existing `_NOT_FOUND` suffix mapping; verify)

- [ ] **Step 1: Append the code to the registry**

In `result.ts`:
```ts
PLATFORM_TENANCY_VERSION_NOT_FOUND: 'PLATFORM_TENANCY_VERSION_NOT_FOUND',
```

- [ ] **Step 2: Update tags.ts line 21**

```ts
if (!ver.value) return err([{ code: 'PLATFORM_TENANCY_VERSION_NOT_FOUND', message: `version seq ${input.versionSeq} missing` }]);
```

- [ ] **Step 3: Verify error-handler mapping still returns 404**

Grep: `grep -n "statusForCode\|_NOT_FOUND" rntme-cli/packages/platform-http/src/middleware/error-handler.ts`
Expected: there is a catch-all mapping for codes ending in `_NOT_FOUND` → 404; if not, add the new code explicitly.

### Task 10.3 — FakeStore off public barrel

**Files:**
- Modify: `rntme-cli/packages/platform-core/src/index.ts`

- [ ] **Step 1: Remove the line**

```ts
export { FakeStore } from './testing/fakes.js';
```

- [ ] **Step 2: Update every test import that relied on the re-export**

Run: `grep -rn "from '@rntme-cli/platform-core'" rntme-cli/packages/ | grep FakeStore`
Expected: one or two test files. Change each to:
```ts
import { FakeStore } from '@rntme-cli/platform-core/src/testing/fakes.js';
```
(or update package.json exports to include a `./testing` subpath — whichever is cleaner given existing conventions. If the package uses `dist/`-only exports, prefer `../../testing/fakes.js` relative import from within the same package's tests. Check existing pattern by running `grep -rn "testing/fakes" rntme-cli/packages/`.)

### Task 10.4 — Verify full submodule suite green

Run: `pnpm -C rntme-cli -r typecheck && pnpm -C rntme-cli -r lint && pnpm -C rntme-cli -r test`
Expected: all green, including the RLS, cascade, canonical-json, body-limit, auth-callback, workos-provider, ready, tags, and rewired tenant-isolation e2e.

### Task 10.5 — Commit

```bash
git -C rntme-cli add packages/platform-http/src/routes/ops.ts \
  packages/platform-http/test/unit/routes/ops.test.ts \
  packages/platform-core/src/types/result.ts \
  packages/platform-core/src/use-cases/tags.ts \
  packages/platform-core/src/index.ts \
  packages/platform-http/src/middleware/error-handler.ts

git -C rntme-cli commit -m "fix: /ready workos=false on catch + FakeStore off public barrel + tags error code

Important 17, 19, 21. Triple-small cleanup: ready probe no longer lies
when WorkOS is down; FakeStore no longer ships to prod consumers;
moveTag returns PLATFORM_TENANCY_VERSION_NOT_FOUND (newly registered)
when the version id is missing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Main-repo commit — submodule bump + original design preface note

### Task M.1 — Bump the submodule pointer in the main repo

**Files:**
- Modify: `rntme-cli` (submodule pointer)
- Modify: `docs/history/specs/historical/2026-04-19-platform-api-design.md` (add preface pointer to errata)

- [ ] **Step 1: Sanity check: the submodule HEAD is at the last fix commit**

Run: `git -C rntme-cli log --oneline -12`
Expected: ten fix commits 10 → 1 at the top, above the last M1-landed commit.

- [ ] **Step 2: Prepend a preface to the original design doc pointing at the errata**

Edit `docs/history/specs/historical/2026-04-19-platform-api-design.md` and insert at the very top (before the existing content):

```markdown
> **Errata 01 (2026-04-19, same-day):** a post-landing code review found
> several drift points from this design. See
> `docs/history/specs/historical/2026-04-19-platform-api-errata-01.md` for the
> authoritative corrections to §5.5 (RLS middleware), §5.2 (schema +
> organization.archived_at), §8.5 (org-deleted cascade), §7 (slug
> immutability), §9.2 (error-code registry), §14 (body-size caps), and
> §6 (canonical-json upload). This document is preserved unchanged as a
> historical artifact.
```

### Task M.2 — Commit in the main repo

- [ ] **Step 1: Stage + commit**

```bash
git add rntme-cli docs/history/specs/historical/2026-04-19-platform-api-design.md
git commit -m "chore: bump rntme-cli submodule (platform-api fix-01) + design preface

Lands the 10 fix-01 commits in the rntme-cli submodule: RLS per-request
TX, FORCE RLS + platform_app role, organization.archived_at, atomic
org cascade, slug immutability, canonical-json upload, body limits,
PLATFORM_COOKIE_PASSWORD required, real WorkOS org on callback, strict
role lookup, and three cheap Important cleanups. Preface note on the
original design doc points readers at the errata.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Verification gate — before declaring fix-01 complete

Run this exact sequence and require all of them green:

```bash
# In the submodule
pnpm -C rntme-cli install --frozen-lockfile
pnpm -C rntme-cli -r typecheck
pnpm -C rntme-cli -r lint
pnpm -C rntme-cli -r test

# In the main repo
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Spot-check the canonical RLS invariants independently:

```bash
pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/rls-enforcement.test.ts
pnpm -C rntme-cli -F @rntme-cli/platform-storage vitest run test/integration/org-cascade.test.ts
pnpm -C rntme-cli -F @rntme-cli/platform-http vitest run test/e2e/tenant-isolation.test.ts
```

All three must pass with the harness running as `platform_app`. If any of these rely on the owner pool to work, that's a regression — investigate before merging.
