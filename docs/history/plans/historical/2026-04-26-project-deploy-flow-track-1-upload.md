> Status: historical.
> Date: 2026-04-26.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# Project Deploy Flow — Track 1 (Upload) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy single-service publish model with a project-first publish model: CLI packs a project blueprint folder into a canonical JSON bundle, the platform validates it server-side via `@rntme/blueprint.loadComposedBlueprint`, stores it as an idempotent `project_version`, and exposes it through REST + UI. Drops `service`, `artifact_version`, and `artifact_tag` tables along with all related code.

**Architecture:** Approach A from `docs/history/specs/historical/2026-04-26-project-deploy-flow-design.md`. New repos / use-cases / routes / UI pages added to existing `platform-core` / `platform-storage` / `platform-http`. CLI rewrites `validate` + `publish` into one `project publish` command. Server-side blueprint validation imports `@rntme/blueprint` from the parent workspace via existing submodule path.

**Tech Stack:** TypeScript (NodeNext modules), pnpm workspace, Hono + Hono JSX + htmx + Tailwind CDN, Drizzle ORM + Postgres, rustfs S3-compatible blob store, Vitest, testcontainers-node for PG integration tests, `node:crypto` SHA-256, `@rntme/blueprint` from main workspace.

**Source spec:** `docs/history/specs/historical/2026-04-26-project-deploy-flow-design.md`.

**Out of scope for this plan:** Deploy targets, deployments, executor, smoke verification, deploy UI — all handled in Track 2.

---

## File Structure

### New files

```
rntme-cli/packages/platform-core/src/
├── repos/project-version-repo.ts          # ProjectVersionRepo interface
├── use-cases/project-versions.ts           # publishProjectVersion / list / get use-cases
├── validation/canonical-bundle.ts          # bundle parse + canonical hash
└── schemas/project-version.ts              # Zod schemas for entity + request

rntme-cli/packages/platform-storage/src/
├── repos/pg-project-version-repo.ts        # Postgres impl
└── schema/project-version.ts               # Drizzle table

rntme-cli/packages/platform-storage/drizzle/
└── 0002_project_first.sql                  # Drop legacy + create project_version (single migration)

rntme-cli/packages/platform-http/src/
├── routes/project-versions.ts              # POST/GET/list/bundle endpoints
├── ui/pages/project-version.tsx            # Version detail page
└── blueprint/load.ts                       # Server-side bundle materialize + loadComposedBlueprint wrapper

rntme-cli/packages/cli/src/
├── commands/project/publish.ts             # rntme project publish
├── commands/project/version/list.ts        # rntme project version list
├── commands/project/version/show.ts        # rntme project version show
├── bundle/                                  # New module
│   ├── build.ts                             # Walk folder → canonical bundle
│   ├── canonical.ts                         # Canonical JSON + SHA-256 (small, no deps)
│   └── types.ts                             # CanonicalBundle, BundleBuildResult
└── skills/sources/composing-blueprint.md   # Replaces composing-manifest.md (rewrite)
```

### Files modified

```
rntme-cli/packages/platform-core/src/
├── index.ts                                 # Re-exports drop legacy, add new
├── schemas/entities.ts                      # Drop ServiceSchema / ArtifactVersionSchema / TagSchema
├── schemas/requests.ts                      # Drop BundleSchema / PublishRequestSchema, etc.
└── auth/scopes.ts                           # (no change in this track — same scopes)

rntme-cli/packages/platform-storage/src/
├── schema/index.ts                          # Drop service/artifact exports
├── schema/projects.ts                       # Drop `service` table
└── index.ts                                 # Drop legacy repo exports

rntme-cli/packages/platform-http/src/
├── app.ts                                   # New mounting; body-limit regex update
├── resolve-deps.ts                          # Drop legacy repos, add ProjectVersionRepo
├── ui/pages/project.tsx                     # Replace services list with versions list
└── ui/pages/org.tsx                         # Project list still works (no changes needed unless services counted in)

rntme-cli/packages/cli/src/
├── bin/cli.ts                               # Command dispatch updates
├── commands/init.ts                         # Rewrite for project-first blueprint
└── skills/sources/publishing-via-rntme-cli.md   # Rewrite for project publish
```

### Files deleted

```
rntme-cli/packages/platform-core/src/
├── repos/service-repo.ts
├── repos/artifact-repo.ts
├── repos/tag-repo.ts
├── use-cases/services.ts
├── use-cases/tags.ts
├── use-cases/versions.ts
├── use-cases/publish-version.ts
└── validation/bundle.ts

rntme-cli/packages/platform-storage/src/
├── repos/pg-service-repo.ts
├── repos/pg-artifact-repo.ts
├── repos/pg-tag-repo.ts
├── schema/artifacts.ts                      # contains artifact_version + artifact_tag

rntme-cli/packages/platform-http/src/
├── routes/services.ts
├── routes/versions.ts
└── ui/pages/service.tsx

rntme-cli/packages/cli/src/
├── commands/validate.ts
├── commands/publish.ts
├── commands/service/                        # whole dir
├── commands/version/                        # whole dir
├── commands/tag/                            # whole dir
└── skills/sources/composing-manifest.md
```

Tests get the same treatment — every removed source file's tests go with it; every new source file gets a colocated test under the package's `test/unit/` (or `test/integration/`).

---

## Documentation-touch task

Per CLAUDE.md, every plan must include a documentation-touch task. This plan ends with **Task U-D1** (documentation refresh) which updates AGENTS.md, README.md, CLAUDE.md, package READMEs, and `docs/architecture.md` for the upload track. Track 2 has its own doc task.

---

## Tasks

### Task U-1: Migration — drop legacy + add `project_version`

**Files:**
- Modify: `rntme-cli/packages/platform-storage/src/schema/projects.ts` — remove the `service` table export.
- Delete: `rntme-cli/packages/platform-storage/src/schema/artifacts.ts`.
- Modify: `rntme-cli/packages/platform-storage/src/schema/index.ts` — drop artifacts re-export, drop `service` re-export, add new schema.
- Create: `rntme-cli/packages/platform-storage/src/schema/project-version.ts`.
- Create: `rntme-cli/packages/platform-storage/drizzle/0002_project_first.sql` (after generating).
- Modify: `rntme-cli/packages/platform-storage/drizzle/meta/_journal.json` (drizzle-kit handles).
- Modify: `rntme-cli/packages/platform-storage/src/migrate.ts` — verify no hardcoded references.

- [ ] **Step 1: Write the new Drizzle schema for `project_version`**

Create `rntme-cli/packages/platform-storage/src/schema/project-version.ts`:

```typescript
import { pgTable, uuid, text, timestamp, bigint, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { organization, account } from './identity.js';
import { project } from './projects.js';

export const projectVersion = pgTable(
  'project_version',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organization.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    seq: bigint('seq', { mode: 'number' }).notNull(),
    bundleDigest: text('bundle_digest').notNull(),
    bundleBlobKey: text('bundle_blob_key').notNull(),
    bundleSizeBytes: bigint('bundle_size_bytes', { mode: 'number' }).notNull(),
    summary: jsonb('summary').notNull(),
    uploadedByAccountId: uuid('uploaded_by_account_id')
      .notNull()
      .references(() => account.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    seqUq: unique('project_version_project_seq_uq').on(t.projectId, t.seq),
    digestUq: unique('project_version_project_digest_uq').on(t.projectId, t.bundleDigest),
    latestIdx: index('project_version_latest_idx').on(t.projectId, t.seq),
  }),
);
```

- [ ] **Step 2: Drop the `service` table from `schema/projects.ts`**

Modify `rntme-cli/packages/platform-storage/src/schema/projects.ts`:

```typescript
import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organization } from './identity.js';

export const project = pgTable(
  'project',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id').notNull().references(() => organization.id),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uq: unique('project_org_slug_uq').on(t.orgId, t.slug) }),
);
// service table removed — replaced by project_version (see schema/project-version.ts)
```

- [ ] **Step 3: Delete `schema/artifacts.ts`**

```bash
rm rntme-cli/packages/platform-storage/src/schema/artifacts.ts
```

- [ ] **Step 4: Update `schema/index.ts`**

Replace `rntme-cli/packages/platform-storage/src/schema/index.ts` so it exports identity, projects, project-version, audit, tokens — no artifacts:

```typescript
export * from './identity.js';
export * from './projects.js';
export * from './project-version.js';
export * from './audit.js';
export * from './tokens.js';
```

- [ ] **Step 5: Generate the migration**

Run from repo root:

```bash
cd rntme-cli/packages/platform-storage
pnpm drizzle-kit generate
```

Expected: `drizzle/0002_<random_name>.sql` created. Rename it to `0002_project_first.sql` and update `drizzle/meta/_journal.json` accordingly (replace the auto-generated tag with `project_first`).

Inspect the generated SQL — it should contain `DROP TABLE artifact_tag`, `DROP TABLE artifact_version`, `DROP TABLE service`, then `CREATE TABLE project_version`. If drizzle-kit emits the operations in the wrong FK order, hand-edit so drops happen first (`artifact_tag` → `artifact_version` → `service`), then create.

- [ ] **Step 6: Append RLS policy + denormalised-org enforcement to migration**

Edit `drizzle/0002_project_first.sql`, append:

```sql
ALTER TABLE "project_version" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "project_version"
  USING (org_id = current_setting('rntme.org_id')::uuid);
CREATE POLICY tenant_insert ON "project_version" FOR INSERT
  WITH CHECK (org_id = current_setting('rntme.org_id')::uuid);
```

Match the policy style from `rntme-cli/packages/platform-storage/src/sql/policies.sql` (read it once for the exact pattern; if the existing pattern uses different role grants, copy them).

- [ ] **Step 7: Run migration test**

Run from repo root:

```bash
pnpm -F @rntme-cli/platform-storage test test/integration/migrate.test.ts
```

Expected: PASS — fresh PG container migrates cleanly, legacy tables gone, `project_version` present. If no migration test exists, write one in this step:

```typescript
// rntme-cli/packages/platform-storage/test/integration/project-version-migration.test.ts
import { describe, it, expect } from 'vitest';
import { startTestPg } from './_setup.js';

describe('migration 0002 project_first', () => {
  it('drops legacy tables and creates project_version', async () => {
    const { pool, end } = await startTestPg();
    try {
      const tables = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
      );
      const names = tables.rows.map((r) => r.tablename);
      expect(names).toContain('project_version');
      expect(names).not.toContain('service');
      expect(names).not.toContain('artifact_version');
      expect(names).not.toContain('artifact_tag');
    } finally {
      await end();
    }
  });
});
```

(`startTestPg` already exists in the storage test fixtures — check `test/integration/` for the helper name; reuse what's there.)

- [ ] **Step 8: Commit**

```bash
git add rntme-cli/packages/platform-storage/src/schema/ \
        rntme-cli/packages/platform-storage/drizzle/ \
        rntme-cli/packages/platform-storage/test/integration/
git commit -m "feat(platform-storage): drop legacy service/artifact tables, add project_version"
```

---

### Task U-2: `ProjectVersion` zod schema

**Files:**
- Create: `rntme-cli/packages/platform-core/src/schemas/project-version.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts` — export new schemas.

- [ ] **Step 1: Write the failing test**

Create `rntme-cli/packages/platform-core/test/unit/schemas/project-version.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ProjectVersionSchema, ProjectVersionSummarySchema, PublishProjectVersionRequestSchema, CanonicalBundleSchema } from '../../../src/schemas/project-version.js';

describe('ProjectVersionSchema', () => {
  it('accepts a well-formed row', () => {
    const r = ProjectVersionSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      orgId: '22222222-2222-2222-2222-222222222222',
      projectId: '33333333-3333-3333-3333-333333333333',
      seq: 1,
      bundleDigest: 'sha256:' + 'a'.repeat(64),
      bundleBlobKey: 'projects/abc/versions/sha256-aaaa.json.gz',
      bundleSizeBytes: 1234,
      summary: { projectName: 'shop', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
      uploadedByAccountId: '44444444-4444-4444-4444-444444444444',
      createdAt: new Date(),
    });
    expect(r.success).toBe(true);
  });

  it('rejects bad digest format', () => {
    const r = ProjectVersionSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      orgId: '22222222-2222-2222-2222-222222222222',
      projectId: '33333333-3333-3333-3333-333333333333',
      seq: 1,
      bundleDigest: 'badformat',
      bundleBlobKey: 'k',
      bundleSizeBytes: 0,
      summary: { projectName: 'x', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
      uploadedByAccountId: '44444444-4444-4444-4444-444444444444',
      createdAt: new Date(),
    });
    expect(r.success).toBe(false);
  });
});

describe('CanonicalBundleSchema', () => {
  it('accepts a flat files dict', () => {
    const r = CanonicalBundleSchema.safeParse({
      version: 1,
      files: {
        'project.json': { name: 'x', services: [] },
        'pdm/entities/A.json': { name: 'A' },
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects path traversal', () => {
    const r = CanonicalBundleSchema.safeParse({
      version: 1,
      files: { '../../etc/passwd': {} },
    });
    expect(r.success).toBe(false);
  });

  it('rejects absolute paths', () => {
    const r = CanonicalBundleSchema.safeParse({
      version: 1,
      files: { '/etc/passwd': {} },
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/platform-core vitest run test/unit/schemas/project-version.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

Create `rntme-cli/packages/platform-core/src/schemas/project-version.ts`:

```typescript
import { z } from 'zod';
import { SlugSchema, UuidSchema } from './primitives.js';

const Sha256Digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);

// Forbid path traversal, absolute paths, and unsafe characters in bundle file keys.
const SafeRelPath = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_./-]+$/, 'invalid characters in path')
  .refine((p) => !p.startsWith('/'), 'must be relative')
  .refine((p) => !p.split('/').includes('..'), 'must not contain ..')
  .refine((p) => p.endsWith('.json'), 'must end with .json');

export const ProjectVersionSummarySchema = z.object({
  projectName: z.string().min(1),
  services: z.array(z.string().min(1)),
  routes: z.object({
    ui: z.record(z.string(), z.string()),
    http: z.record(z.string(), z.string()),
  }),
  middleware: z.record(z.string(), z.unknown()),
  mounts: z.array(z.unknown()),
});
export type ProjectVersionSummary = z.infer<typeof ProjectVersionSummarySchema>;

export const ProjectVersionSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  projectId: UuidSchema,
  seq: z.number().int().positive(),
  bundleDigest: Sha256Digest,
  bundleBlobKey: z.string().min(1),
  bundleSizeBytes: z.number().int().nonnegative(),
  summary: ProjectVersionSummarySchema,
  uploadedByAccountId: UuidSchema,
  createdAt: z.date(),
});
export type ProjectVersion = z.infer<typeof ProjectVersionSchema>;

export const CanonicalBundleSchema = z.object({
  version: z.literal(1),
  files: z.record(SafeRelPath, z.unknown()).refine(
    (files) => 'project.json' in files,
    'bundle must contain project.json',
  ),
});
export type CanonicalBundle = z.infer<typeof CanonicalBundleSchema>;

export const PublishProjectVersionRequestSchema = CanonicalBundleSchema; // body IS the bundle

export const ListProjectVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.coerce.number().int().positive().optional(),
});
```

- [ ] **Step 4: Re-export from `index.ts`**

Modify `rntme-cli/packages/platform-core/src/index.ts` — add:

```typescript
export * from './schemas/project-version.js';
```

(Order anywhere after `schemas/requests.js`. Drop `schemas/requests.js` re-export of legacy items in a later task; for now keep it — the legacy code still compiles.)

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm -F @rntme-cli/platform-core vitest run test/unit/schemas/project-version.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-core/src/schemas/project-version.ts \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-core/test/unit/schemas/project-version.test.ts
git commit -m "feat(platform-core): add ProjectVersion + CanonicalBundle schemas"
```

---

### Task U-3: `ProjectVersionRepo` interface

**Files:**
- Create: `rntme-cli/packages/platform-core/src/repos/project-version-repo.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts` — add re-export.

- [ ] **Step 1: Write the failing test (typecheck-style)**

Create `rntme-cli/packages/platform-core/test/unit/repos/project-version-repo.test.ts`:

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type { ProjectVersionRepo, ProjectVersionInsertRow } from '../../../src/repos/project-version-repo.js';
import type { ProjectVersion } from '../../../src/schemas/project-version.js';
import type { Result, PlatformError } from '../../../src/types/result.js';

describe('ProjectVersionRepo type contract', () => {
  it('declares the expected method signatures', () => {
    type R = ProjectVersionRepo;
    expectTypeOf<R['create']>().parameters.toMatchTypeOf<[args: {
      projectId: string;
      row: ProjectVersionInsertRow;
      auditActorAccountId: string;
      auditActorTokenId: string | null;
    }]>();
    expectTypeOf<R['create']>().returns.toMatchTypeOf<Promise<Result<ProjectVersion, PlatformError>>>();
    expectTypeOf<R['findByDigest']>().parameters.toMatchTypeOf<[projectId: string, digest: string]>();
    expectTypeOf<R['getBySeq']>().parameters.toMatchTypeOf<[projectId: string, seq: number]>();
  });
});
```

- [ ] **Step 2: Run typecheck to verify it fails**

```bash
pnpm -F @rntme-cli/platform-core typecheck
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the interface**

Create `rntme-cli/packages/platform-core/src/repos/project-version-repo.ts`:

```typescript
import type { ProjectVersion, ProjectVersionSummary } from '../schemas/project-version.js';
import type { Result, PlatformError } from '../types/result.js';

export type ProjectVersionInsertRow = {
  readonly id: string;
  readonly orgId: string;
  readonly bundleDigest: string;
  readonly bundleBlobKey: string;
  readonly bundleSizeBytes: number;
  readonly summary: ProjectVersionSummary;
  readonly uploadedByAccountId: string;
};

export interface ProjectVersionRepo {
  create(args: {
    projectId: string;
    row: ProjectVersionInsertRow;
    auditActorAccountId: string;
    auditActorTokenId: string | null;
  }): Promise<Result<ProjectVersion, PlatformError>>;

  findByDigest(projectId: string, bundleDigest: string): Promise<Result<ProjectVersion | null, PlatformError>>;

  getBySeq(projectId: string, seq: number): Promise<Result<ProjectVersion | null, PlatformError>>;

  getById(id: string): Promise<Result<ProjectVersion | null, PlatformError>>;

  listByProject(
    projectId: string,
    opts: { limit: number; cursor: number | undefined },
  ): Promise<Result<readonly ProjectVersion[], PlatformError>>;
}
```

- [ ] **Step 4: Re-export from `index.ts`**

Add to `rntme-cli/packages/platform-core/src/index.ts`:

```typescript
export * from './repos/project-version-repo.js';
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm -F @rntme-cli/platform-core typecheck && pnpm -F @rntme-cli/platform-core vitest run test/unit/repos/project-version-repo.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-core/src/repos/project-version-repo.ts \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-core/test/unit/repos/project-version-repo.test.ts
git commit -m "feat(platform-core): add ProjectVersionRepo interface"
```

---

### Task U-4: Canonical bundle utility (parse + hash)

**Files:**
- Create: `rntme-cli/packages/platform-core/src/validation/canonical-bundle.ts`.
- Create: `rntme-cli/packages/platform-core/test/unit/validation/canonical-bundle.test.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts`.

The platform-core already has `validation/canonical-json.ts` (used by `blobKey`, `bundleDigest` etc). This task adds a *bundle*-level utility that:

1. Parses `unknown` body bytes into `CanonicalBundle` (zod) and re-canonicalizes its files dict for hashing.
2. Computes `bundle_digest = "sha256:" + hex(SHA-256(canonical_json_bytes(bundle)))`.

- [ ] **Step 1: Write the failing test**

```typescript
// rntme-cli/packages/platform-core/test/unit/validation/canonical-bundle.test.ts
import { describe, it, expect } from 'vitest';
import { canonicalBundleDigest, parseCanonicalBundle } from '../../../src/validation/canonical-bundle.js';

describe('canonicalBundleDigest', () => {
  it('is deterministic across key order', () => {
    const a = { version: 1 as const, files: { 'b.json': {a: 1, b: 2}, 'a.json': {b: 2, a: 1} } };
    const b = { version: 1 as const, files: { 'a.json': {b: 2, a: 1}, 'b.json': {a: 1, b: 2} } };
    expect(canonicalBundleDigest(a)).toBe(canonicalBundleDigest(b));
  });

  it('emits sha256: prefix + 64 hex', () => {
    const d = canonicalBundleDigest({ version: 1, files: { 'project.json': {} } });
    expect(d).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('parseCanonicalBundle', () => {
  it('parses a valid bundle', () => {
    const raw = JSON.stringify({ version: 1, files: { 'project.json': { name: 'x', services: [] } } });
    const r = parseCanonicalBundle(Buffer.from(raw));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.bundle.files['project.json']).toEqual({ name: 'x', services: [] });
      expect(r.value.digest).toMatch(/^sha256:/);
    }
  });

  it('rejects malformed JSON', () => {
    const r = parseCanonicalBundle(Buffer.from('not json'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('PROJECT_VERSION_BUNDLE_PARSE_ERROR');
  });

  it('rejects path traversal', () => {
    const raw = JSON.stringify({ version: 1, files: { '../etc/passwd': {} } });
    const r = parseCanonicalBundle(Buffer.from(raw));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('PROJECT_VERSION_BUNDLE_INVALID_SHAPE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/platform-core vitest run test/unit/validation/canonical-bundle.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// rntme-cli/packages/platform-core/src/validation/canonical-bundle.ts
import { createHash } from 'node:crypto';
import { canonicalize } from './canonical-json.js';
import { CanonicalBundleSchema, type CanonicalBundle } from '../schemas/project-version.js';
import { ok, err, type Result, type PlatformError } from '../types/result.js';

export function canonicalBundleDigest(bundle: CanonicalBundle): string {
  const bytes = canonicalize(bundle);
  const h = createHash('sha256').update(bytes).digest('hex');
  return `sha256:${h}`;
}

export type ParsedCanonicalBundle = {
  bundle: CanonicalBundle;
  digest: string;
  size: number;
};

export function parseCanonicalBundle(bytes: Buffer): Result<ParsedCanonicalBundle, PlatformError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch (cause) {
    return err([
      { code: 'PROJECT_VERSION_BUNDLE_PARSE_ERROR', message: String(cause), cause },
    ]);
  }
  const r = CanonicalBundleSchema.safeParse(parsed);
  if (!r.success) {
    return err([
      {
        code: 'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
        message: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    ]);
  }
  return ok({
    bundle: r.data,
    digest: canonicalBundleDigest(r.data),
    size: bytes.byteLength,
  });
}
```

- [ ] **Step 4: Add error codes to `types/result.ts`**

The platform's `PlatformError` is a discriminated union or a string literal type for `code`. Read `rntme-cli/packages/platform-core/src/types/result.ts` once, then add the new codes (`PROJECT_VERSION_BUNDLE_PARSE_ERROR`, `PROJECT_VERSION_BUNDLE_INVALID_SHAPE`, `PROJECT_VERSION_BUNDLE_TOO_LARGE`, `PROJECT_VERSION_BLUEPRINT_INVALID`, `PROJECT_VERSION_DIGEST_MISMATCH`, `PROJECT_VERSION_NOT_FOUND`) to whichever enum/literal lives there. If there is no closed enum and codes are free-form strings, this step is a no-op.

- [ ] **Step 5: Re-export**

Add to `index.ts`:

```typescript
export { canonicalBundleDigest, parseCanonicalBundle, type ParsedCanonicalBundle } from './validation/canonical-bundle.js';
```

- [ ] **Step 6: Run tests**

```bash
pnpm -F @rntme-cli/platform-core vitest run test/unit/validation/canonical-bundle.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/platform-core/src/validation/canonical-bundle.ts \
        rntme-cli/packages/platform-core/src/types/result.ts \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-core/test/unit/validation/canonical-bundle.test.ts
git commit -m "feat(platform-core): canonical bundle parser + digest"
```

---

### Task U-5: Server-side bundle materialize + `loadComposedBlueprint` wrapper

**Files:**
- Create: `rntme-cli/packages/platform-http/src/blueprint/load.ts`.
- Create: `rntme-cli/packages/platform-http/test/unit/blueprint/load.test.ts`.
- Modify: `rntme-cli/packages/platform-http/package.json` — add dependency on `@rntme/blueprint` (workspace `*`).

`@rntme/blueprint` lives in the parent workspace at `packages/blueprint`. Since `rntme-cli` is a git submodule but the platform-http is the *consumer* and runs inside the parent workspace, importing it as a sibling workspace package works. The submodule has its own `pnpm-workspace.yaml` — this dependency declaration must point to the parent's `@rntme/blueprint` either via workspace catalog or a local path. **Verify the submodule's `pnpm-workspace.yaml` allows reaching `../../packages/blueprint` before assuming a `workspace:*` import works.** If not, add a local file dependency: `"@rntme/blueprint": "file:../../../packages/blueprint"`.

- [ ] **Step 1: Verify import path works**

Run from repo root:

```bash
ls packages/blueprint/dist/index.js 2>/dev/null || pnpm -F @rntme/blueprint build
```

Expected: build succeeds and `packages/blueprint/dist/index.js` exists.

Then check whether `rntme-cli` submodule's `pnpm-workspace.yaml` reaches the parent:

```bash
cat rntme-cli/pnpm-workspace.yaml
```

The submodule typically defines its own packages; the *outer* workspace at the repo root unifies both. Check `pnpm-workspace.yaml` at repo root — it should already include `rntme-cli/packages/*`. If yes, the resolution is via the outer workspace; declaring `"@rntme/blueprint": "workspace:*"` in `rntme-cli/packages/platform-http/package.json` works.

- [ ] **Step 2: Add dep to platform-http**

Edit `rntme-cli/packages/platform-http/package.json` `dependencies`:

```json
"@rntme/blueprint": "workspace:*"
```

Run `pnpm install -w` from repo root to update the lockfile.

- [ ] **Step 3: Write the failing test**

```typescript
// rntme-cli/packages/platform-http/test/unit/blueprint/load.test.ts
import { describe, it, expect } from 'vitest';
import { materializeAndCompose } from '../../../src/blueprint/load.js';
import type { CanonicalBundle } from '@rntme-cli/platform-core';

const minimalBundle: CanonicalBundle = {
  version: 1,
  files: {
    'project.json': {
      name: 'mini',
      services: ['app'],
      routes: { ui: { '/': 'app' }, http: {} },
      middleware: {},
      mounts: [],
    },
    'pdm/pdm.json': { name: 'mini', entities: [] },
    'services/app/qsm/qsm.json': { name: 'mini-app', projections: [] },
    'services/app/ui/manifest.json': { name: 'mini-app', layouts: [], screens: [] },
  },
};

describe('materializeAndCompose', () => {
  it('returns ok with composed result on a valid bundle', async () => {
    const r = await materializeAndCompose(minimalBundle);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.composed.project.name).toBe('mini');
      expect(r.value.summary.projectName).toBe('mini');
    }
  });

  it('returns err with PROJECT_VERSION_BLUEPRINT_INVALID for malformed blueprint', async () => {
    const bad: CanonicalBundle = { version: 1, files: { 'project.json': { name: 1 } } };
    const r = await materializeAndCompose(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('PROJECT_VERSION_BLUEPRINT_INVALID');
  });

  it('cleans up tmpdir', async () => {
    const r = await materializeAndCompose(minimalBundle);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const fs = await import('node:fs/promises');
      await expect(fs.access(r.value.tmpDir)).rejects.toBeTruthy(); // tmpDir is cleaned by the function
    }
  });
});
```

(The exact shape of `minimalBundle` may need to be adjusted to match what `loadComposedBlueprint` requires today — peek at `packages/blueprint/test/fixtures/product-catalog-project/` to copy a known-valid minimal layout. If a smaller-than-product-catalog fixture doesn't exist, write a minimal one in `packages/blueprint/test/fixtures/minimal-project/` first (separate task or inline here).)

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/unit/blueprint/load.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 5: Implement**

```typescript
// rntme-cli/packages/platform-http/src/blueprint/load.ts
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadComposedBlueprint, type ComposedBlueprint } from '@rntme/blueprint';
import {
  ok,
  err,
  type CanonicalBundle,
  type ProjectVersionSummary,
  type Result,
  type PlatformError,
} from '@rntme-cli/platform-core';

export type MaterializeResult = {
  composed: ComposedBlueprint;
  summary: ProjectVersionSummary;
  tmpDir: string; // already cleaned up by the time the caller sees this; only here for test introspection
};

export async function materializeAndCompose(
  bundle: CanonicalBundle,
): Promise<Result<MaterializeResult, PlatformError>> {
  const dir = await mkdtemp(join(tmpdir(), 'rntme-bundle-'));
  try {
    for (const [relPath, value] of Object.entries(bundle.files)) {
      const abs = join(dir, relPath);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, JSON.stringify(value));
    }
    const composed = loadComposedBlueprint(dir);
    if (!composed.ok) {
      return err([
        {
          code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
          message: composed.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
          // Pass through structured blueprint errors for surfacing in the API:
          details: { errors: composed.errors },
        },
      ]);
    }
    const project = composed.value.project;
    const summary: ProjectVersionSummary = {
      projectName: project.name,
      services: [...project.services],
      routes: {
        ui: { ...(project.routes.ui ?? {}) },
        http: { ...(project.routes.http ?? {}) },
      },
      middleware: { ...(project.middleware ?? {}) },
      mounts: [...(project.mounts ?? [])],
    };
    return ok({ composed: composed.value, summary, tmpDir: dir });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
```

If `PlatformError` doesn't permit `details`, drop that field and serialize the inner errors into `message`.

- [ ] **Step 6: Run tests**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/unit/blueprint/load.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/platform-http/src/blueprint/ \
        rntme-cli/packages/platform-http/test/unit/blueprint/ \
        rntme-cli/packages/platform-http/package.json \
        pnpm-lock.yaml
git commit -m "feat(platform-http): server-side blueprint materialize + compose"
```

---

### Task U-6: `PgProjectVersionRepo`

**Files:**
- Create: `rntme-cli/packages/platform-storage/src/repos/pg-project-version-repo.ts`.
- Create: `rntme-cli/packages/platform-storage/test/integration/pg-project-version-repo.test.ts`.
- Modify: `rntme-cli/packages/platform-storage/src/index.ts`.

Pattern to mirror: `rntme-cli/packages/platform-storage/src/repos/pg-artifact-repo.ts`. Use `pg_advisory_xact_lock(hashtext(projectId))` for seq allocation, `INSERT ... RETURNING *` style. Audit row through audit_log table (existing pattern in pg-artifact-repo.ts).

- [ ] **Step 1: Write the failing test**

```typescript
// rntme-cli/packages/platform-storage/test/integration/pg-project-version-repo.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PgProjectVersionRepo } from '../../src/repos/pg-project-version-repo.js';
import { setupTestDb, type TestDb } from './_setup.js';

describe('PgProjectVersionRepo (integration)', () => {
  let db: TestDb;
  beforeAll(async () => { db = await setupTestDb(); });
  afterAll(async () => { await db.end(); });

  it('creates a project_version with seq=1 and round-trips', async () => {
    const { tx, orgId, projectId, accountId } = await db.openOrgScopedTx();
    const repo = new PgProjectVersionRepo(tx);
    const r = await repo.create({
      projectId,
      row: {
        id: db.uuid(),
        orgId,
        bundleDigest: 'sha256:' + 'a'.repeat(64),
        bundleBlobKey: 'projects/p/versions/sha256-aaaa.json.gz',
        bundleSizeBytes: 100,
        summary: { projectName: 'p', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
        uploadedByAccountId: accountId,
      },
      auditActorAccountId: accountId,
      auditActorTokenId: null,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.seq).toBe(1);
  });

  it('returns idempotent same row on duplicate digest', async () => {
    const { tx, orgId, projectId, accountId } = await db.openOrgScopedTx();
    const repo = new PgProjectVersionRepo(tx);
    const args = {
      projectId,
      row: {
        id: db.uuid(),
        orgId,
        bundleDigest: 'sha256:' + 'b'.repeat(64),
        bundleBlobKey: 'k',
        bundleSizeBytes: 1,
        summary: { projectName: 'p', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
        uploadedByAccountId: accountId,
      },
      auditActorAccountId: accountId,
      auditActorTokenId: null,
    };
    const a = await repo.create(args);
    const b = await repo.create({ ...args, row: { ...args.row, id: db.uuid() } }); // same digest, different new id
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value.id).toBe(b.value.id);
  });

  it('listByProject returns latest first', async () => {
    const { tx, orgId, projectId, accountId } = await db.openOrgScopedTx();
    const repo = new PgProjectVersionRepo(tx);
    for (const c of ['c', 'd', 'e']) {
      await repo.create({
        projectId,
        row: {
          id: db.uuid(),
          orgId,
          bundleDigest: 'sha256:' + c.repeat(64),
          bundleBlobKey: c,
          bundleSizeBytes: 1,
          summary: { projectName: 'p', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
          uploadedByAccountId: accountId,
        },
        auditActorAccountId: accountId,
        auditActorTokenId: null,
      });
    }
    const r = await repo.listByProject(projectId, { limit: 10, cursor: undefined });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map((v) => v.seq)).toEqual([3, 2, 1]);
  });
});
```

`_setup.ts` already exists — reuse it. If it lacks `openOrgScopedTx` or `uuid`, extend it (copy from existing `pg-artifact-repo.test.ts` setup).

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/platform-storage vitest run test/integration/pg-project-version-repo.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// rntme-cli/packages/platform-storage/src/repos/pg-project-version-repo.ts
import {
  ok,
  err,
  type Result,
  type PlatformError,
  type ProjectVersionRepo,
  type ProjectVersion,
  type ProjectVersionSummary,
} from '@rntme-cli/platform-core';
import type { PgQueryable } from '../pg/pool.js';

export class PgProjectVersionRepo implements ProjectVersionRepo {
  constructor(private readonly db: PgQueryable) {}

  async findByDigest(projectId: string, bundleDigest: string): Promise<Result<ProjectVersion | null, PlatformError>> {
    try {
      const r = await this.db.query(
        `SELECT * FROM project_version WHERE project_id=$1 AND bundle_digest=$2 LIMIT 1`,
        [projectId, bundleDigest],
      );
      return ok(r.rows[0] ? rowToVersion(r.rows[0] as Record<string, unknown>) : null);
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }

  async getBySeq(projectId: string, seq: number): Promise<Result<ProjectVersion | null, PlatformError>> {
    try {
      const r = await this.db.query(
        `SELECT * FROM project_version WHERE project_id=$1 AND seq=$2 LIMIT 1`,
        [projectId, seq],
      );
      return ok(r.rows[0] ? rowToVersion(r.rows[0] as Record<string, unknown>) : null);
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }

  async getById(id: string): Promise<Result<ProjectVersion | null, PlatformError>> {
    try {
      const r = await this.db.query(`SELECT * FROM project_version WHERE id=$1 LIMIT 1`, [id]);
      return ok(r.rows[0] ? rowToVersion(r.rows[0] as Record<string, unknown>) : null);
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }

  async listByProject(
    projectId: string,
    opts: { limit: number; cursor: number | undefined },
  ): Promise<Result<readonly ProjectVersion[], PlatformError>> {
    try {
      if (opts.cursor !== undefined) {
        const r = await this.db.query(
          `SELECT * FROM project_version WHERE project_id=$1 AND seq<$2 ORDER BY seq DESC LIMIT $3`,
          [projectId, opts.cursor, opts.limit],
        );
        return ok(r.rows.map((row) => rowToVersion(row as Record<string, unknown>)));
      }
      const r = await this.db.query(
        `SELECT * FROM project_version WHERE project_id=$1 ORDER BY seq DESC LIMIT $2`,
        [projectId, opts.limit],
      );
      return ok(r.rows.map((row) => rowToVersion(row as Record<string, unknown>)));
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }

  async create(args: Parameters<ProjectVersionRepo['create']>[0]): Promise<Result<ProjectVersion, PlatformError>> {
    try {
      // 1. Idempotent short-circuit on duplicate digest.
      const dup = await this.db.query(
        `SELECT * FROM project_version WHERE project_id=$1 AND bundle_digest=$2`,
        [args.projectId, args.row.bundleDigest],
      );
      if (dup.rows[0]) return ok(rowToVersion(dup.rows[0] as Record<string, unknown>));

      // 2. Serialize seq allocation per project (advisory lock).
      await this.db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [args.projectId]);

      const last = await this.db.query(
        `SELECT COALESCE(MAX(seq),0)::bigint AS seq FROM project_version WHERE project_id=$1`,
        [args.projectId],
      );
      const nextSeq = Number(last.rows[0].seq) + 1;

      const ins = await this.db.query(
        `INSERT INTO project_version (
           id, org_id, project_id, seq, bundle_digest, bundle_blob_key, bundle_size_bytes,
           summary, uploaded_by_account_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9
         ) RETURNING *`,
        [
          args.row.id,
          args.row.orgId,
          args.projectId,
          nextSeq,
          args.row.bundleDigest,
          args.row.bundleBlobKey,
          args.row.bundleSizeBytes,
          args.row.summary,
          args.row.uploadedByAccountId,
        ],
      );
      const inserted = ins.rows[0] as Record<string, unknown>;

      // 3. Audit row.
      await this.db.query(
        `INSERT INTO audit_log (org_id, actor_account_id, actor_token_id, action, resource_kind, resource_id, payload)
         VALUES ($1,$2,$3,'project_version.published','project_version',$4,$5)`,
        [
          args.row.orgId,
          args.auditActorAccountId,
          args.auditActorTokenId,
          inserted['id'],
          { seq: nextSeq, digest: args.row.bundleDigest },
        ],
      );

      return ok(rowToVersion(inserted));
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }
}

function rowToVersion(r: Record<string, unknown>): ProjectVersion {
  return {
    id: r['id'] as string,
    orgId: r['org_id'] as string,
    projectId: r['project_id'] as string,
    seq: Number(r['seq']),
    bundleDigest: r['bundle_digest'] as string,
    bundleBlobKey: r['bundle_blob_key'] as string,
    bundleSizeBytes: Number(r['bundle_size_bytes']),
    summary: r['summary'] as ProjectVersionSummary,
    uploadedByAccountId: r['uploaded_by_account_id'] as string,
    createdAt: r['created_at'] as Date,
  };
}
```

- [ ] **Step 4: Re-export**

Add to `rntme-cli/packages/platform-storage/src/index.ts`:

```typescript
export { PgProjectVersionRepo } from './repos/pg-project-version-repo.js';
```

- [ ] **Step 5: Run tests**

```bash
pnpm -F @rntme-cli/platform-storage vitest run test/integration/pg-project-version-repo.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-storage/src/repos/pg-project-version-repo.ts \
        rntme-cli/packages/platform-storage/src/index.ts \
        rntme-cli/packages/platform-storage/test/integration/pg-project-version-repo.test.ts
git commit -m "feat(platform-storage): PgProjectVersionRepo with idempotent seq allocation"
```

---

### Task U-7: `publishProjectVersion` use-case

**Files:**
- Create: `rntme-cli/packages/platform-core/src/use-cases/project-versions.ts`.
- Create: `rntme-cli/packages/platform-core/test/unit/use-cases/project-versions.test.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts`.

Note: this use-case does **not** call `loadComposedBlueprint` — that runs in `platform-http` (Task U-8). The use-case only deals with parsed bundle + already-computed summary + idempotency lookup + blob upload + repo.create.

- [ ] **Step 1: Write the failing test**

```typescript
// rntme-cli/packages/platform-core/test/unit/use-cases/project-versions.test.ts
import { describe, it, expect, vi } from 'vitest';
import { publishProjectVersion } from '../../../src/use-cases/project-versions.js';
import type {
  ProjectVersion,
  ProjectVersionRepo,
  BlobStore,
  Ids,
  ProjectRepo,
  Project,
} from '../../../src/index.js';
import { ok } from '../../../src/types/result.js';

const makeFakeRepos = () => {
  const project: Project = {
    id: 'proj-1', orgId: 'org-1', slug: 'shop',
    displayName: 'Shop', archivedAt: null, createdAt: new Date(), updatedAt: new Date(),
  };
  const versions: ProjectVersion[] = [];
  const projectVersions: ProjectVersionRepo = {
    findByDigest: vi.fn(async (_pid, d) => ok(versions.find((v) => v.bundleDigest === d) ?? null)),
    getBySeq: vi.fn(async (_pid, s) => ok(versions.find((v) => v.seq === s) ?? null)),
    getById: vi.fn(async (id) => ok(versions.find((v) => v.id === id) ?? null)),
    listByProject: vi.fn(async () => ok(versions)),
    create: vi.fn(async ({ row }) => {
      const v: ProjectVersion = {
        id: row.id, orgId: row.orgId, projectId: 'proj-1',
        seq: versions.length + 1, bundleDigest: row.bundleDigest, bundleBlobKey: row.bundleBlobKey,
        bundleSizeBytes: row.bundleSizeBytes, summary: row.summary,
        uploadedByAccountId: row.uploadedByAccountId, createdAt: new Date(),
      };
      versions.push(v);
      return ok(v);
    }),
  };
  const projects: ProjectRepo = {
    findBySlug: vi.fn(async () => ok(project)),
  } as unknown as ProjectRepo;
  const blob: BlobStore = {
    putIfAbsent: vi.fn(async () => ok(undefined)),
    presignedGet: vi.fn(async () => ok('https://example.test/x')),
    getJson: vi.fn(async () => ok({})),
  };
  const ids: Ids = { uuid: () => '00000000-0000-0000-0000-000000000000' };
  return { projects, projectVersions, blob, ids, versions };
};

describe('publishProjectVersion', () => {
  it('happy path stores blob and creates row', async () => {
    const fakes = makeFakeRepos();
    const r = await publishProjectVersion({
      repos: { projects: fakes.projects, projectVersions: fakes.projectVersions },
      blob: fakes.blob, ids: fakes.ids,
    }, {
      orgId: 'org-1', projectId: 'proj-1', accountId: 'acc-1', tokenId: null,
      bundleBytes: Buffer.from('{"version":1,"files":{"project.json":{"name":"x","services":[]}}}'),
      bundleDigest: 'sha256:' + 'f'.repeat(64),
      summary: { projectName: 'x', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.seq).toBe(1);
      expect(fakes.blob.putIfAbsent).toHaveBeenCalledOnce();
    }
  });

  it('idempotent: dup digest skips blob upload and returns existing row', async () => {
    const fakes = makeFakeRepos();
    const args = {
      orgId: 'org-1', projectId: 'proj-1', accountId: 'acc-1', tokenId: null,
      bundleBytes: Buffer.from('x'),
      bundleDigest: 'sha256:' + '9'.repeat(64),
      summary: { projectName: 'x', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
    };
    const a = await publishProjectVersion({
      repos: { projects: fakes.projects, projectVersions: fakes.projectVersions },
      blob: fakes.blob, ids: fakes.ids,
    }, args);
    const b = await publishProjectVersion({
      repos: { projects: fakes.projects, projectVersions: fakes.projectVersions },
      blob: fakes.blob, ids: fakes.ids,
    }, args);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value.id).toBe(b.value.id);
    expect(fakes.blob.putIfAbsent).toHaveBeenCalledOnce(); // only the first call uploaded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/platform-core vitest run test/unit/use-cases/project-versions.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// rntme-cli/packages/platform-core/src/use-cases/project-versions.ts
import { gzipSync } from 'node:zlib';
import { ok, isOk, type Result, type PlatformError } from '../types/result.js';
import type { Ids } from '../ids.js';
import type { BlobStore } from '../blob/store.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { ProjectVersionRepo } from '../repos/project-version-repo.js';
import type { ProjectVersion, ProjectVersionSummary } from '../schemas/project-version.js';

type Deps = {
  repos: { projects: ProjectRepo; projectVersions: ProjectVersionRepo };
  blob: BlobStore;
  ids: Ids;
};

export type PublishProjectVersionInput = {
  orgId: string;
  projectId: string;
  accountId: string;
  tokenId: string | null;
  bundleBytes: Buffer;     // raw canonical-JSON bytes — used for blob storage
  bundleDigest: string;    // sha256:<hex>
  summary: ProjectVersionSummary;
};

export async function publishProjectVersion(
  deps: Deps,
  input: PublishProjectVersionInput,
): Promise<Result<ProjectVersion, PlatformError>> {
  // 1. Idempotency check.
  const existing = await deps.repos.projectVersions.findByDigest(input.projectId, input.bundleDigest);
  if (!isOk(existing)) return existing;
  if (existing.value) return ok(existing.value);

  // 2. Upload gzipped bundle to rustfs.
  const blobKey = projectVersionBlobKey(input.projectId, input.bundleDigest);
  const gz = gzipSync(input.bundleBytes);
  const up = await deps.blob.putIfAbsent(blobKey, gz);
  if (!isOk(up)) return up;

  // 3. Create row (which itself re-checks digest under advisory lock).
  return deps.repos.projectVersions.create({
    projectId: input.projectId,
    row: {
      id: deps.ids.uuid(),
      orgId: input.orgId,
      bundleDigest: input.bundleDigest,
      bundleBlobKey: blobKey,
      bundleSizeBytes: input.bundleBytes.byteLength,
      summary: input.summary,
      uploadedByAccountId: input.accountId,
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
}

export function projectVersionBlobKey(projectId: string, digest: string): string {
  // digest = "sha256:<hex>" → safe filename component
  const hex = digest.startsWith('sha256:') ? digest.slice(7) : digest;
  return `projects/${projectId}/versions/sha256-${hex}.json.gz`;
}

export type ListProjectVersionsInput = { projectId: string; limit: number; cursor: number | undefined };
export async function listProjectVersions(
  deps: { repos: { projectVersions: ProjectVersionRepo } },
  input: ListProjectVersionsInput,
): Promise<Result<readonly ProjectVersion[], PlatformError>> {
  return deps.repos.projectVersions.listByProject(input.projectId, { limit: input.limit, cursor: input.cursor });
}

export async function getProjectVersion(
  deps: { repos: { projectVersions: ProjectVersionRepo } },
  input: { projectId: string; seq: number },
): Promise<Result<ProjectVersion | null, PlatformError>> {
  return deps.repos.projectVersions.getBySeq(input.projectId, input.seq);
}
```

- [ ] **Step 4: Re-export**

Add to `rntme-cli/packages/platform-core/src/index.ts`:

```typescript
export * from './use-cases/project-versions.js';
```

- [ ] **Step 5: Run tests**

```bash
pnpm -F @rntme-cli/platform-core vitest run test/unit/use-cases/project-versions.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-core/src/use-cases/project-versions.ts \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-core/test/unit/use-cases/project-versions.test.ts
git commit -m "feat(platform-core): publishProjectVersion / list / get use-cases"
```

---

### Task U-8: HTTP route — `POST /v1/orgs/:orgSlug/projects/:projSlug/versions`

**Files:**
- Create: `rntme-cli/packages/platform-http/src/routes/project-versions.ts`.
- Create: `rntme-cli/packages/platform-http/test/integration/project-versions.test.ts` (testcontainers).
- Modify: `rntme-cli/packages/platform-http/src/app.ts` — mount the new router; update body-limit regex.

The actual route prefix used today is `/v1/orgs/:orgSlug/projects/:projSlug/...` (see `app.ts:151`). The spec text used `/v1/projects/:slug/versions` for brevity; the real path is org-scoped. **Use `/v1/orgs/:orgSlug/projects/:projSlug/versions` as the canonical prefix.** Update the spec only if a discrepancy turns up in review (this plan is the source of truth for actual paths).

- [ ] **Step 1: Write the failing integration test**

```typescript
// rntme-cli/packages/platform-http/test/integration/project-versions.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, type TestApp } from './_app.js'; // existing helper

const sampleBundle = {
  version: 1,
  files: {
    'project.json': { name: 'shop', services: ['app'], routes: { ui: { '/': 'app' }, http: {} }, middleware: {}, mounts: [] },
    'pdm/pdm.json': { name: 'shop', entities: [] },
    'services/app/qsm/qsm.json': { name: 'shop-app', projections: [] },
    'services/app/ui/manifest.json': { name: 'shop-app', layouts: [], screens: [] },
  },
};

describe('POST /v1/orgs/:orgSlug/projects/:projSlug/versions', () => {
  let app: TestApp;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });

  it('uploads a bundle and returns 201 with seq=1', async () => {
    const { token, orgSlug, projSlug } = await app.seedAdminWithProject('shop');
    const res = await app.request(`/v1/orgs/${orgSlug}/projects/${projSlug}/versions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/rntme-project-bundle+json',
      },
      body: JSON.stringify(sampleBundle),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.version.seq).toBe(1);
    expect(body.version.bundleDigest).toMatch(/^sha256:/);
  });

  it('returns 200 on duplicate upload (idempotent)', async () => {
    const { token, orgSlug, projSlug } = await app.seedAdminWithProject('shop2');
    const path = `/v1/orgs/${orgSlug}/projects/${projSlug}/versions`;
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/rntme-project-bundle+json' };
    const body = JSON.stringify(sampleBundle);
    const a = await app.request(path, { method: 'POST', headers, body });
    const b = await app.request(path, { method: 'POST', headers, body });
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    const aJson = await a.json(); const bJson = await b.json();
    expect(aJson.version.id).toBe(bJson.version.id);
  });

  it('returns 422 on invalid blueprint', async () => {
    const { token, orgSlug, projSlug } = await app.seedAdminWithProject('shop3');
    const bad = { version: 1, files: { 'project.json': { name: 1 } } };
    const res = await app.request(`/v1/orgs/${orgSlug}/projects/${projSlug}/versions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/rntme-project-bundle+json' },
      body: JSON.stringify(bad),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('PROJECT_VERSION_BLUEPRINT_INVALID');
  });

  it('returns 413 when bundle exceeds size cap', async () => {
    const { token, orgSlug, projSlug } = await app.seedAdminWithProject('shop4');
    const big = { version: 1, files: { 'project.json': { name: 'x', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] }, 'pdm/big.json': { blob: 'x'.repeat(11 * 1024 * 1024) } } };
    const res = await app.request(`/v1/orgs/${orgSlug}/projects/${projSlug}/versions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/rntme-project-bundle+json' },
      body: JSON.stringify(big),
    });
    expect(res.status).toBe(413);
  });

  it('rejects without version:publish scope', async () => {
    const { token, orgSlug, projSlug } = await app.seedReadOnlyTokenWithProject('shop5');
    const res = await app.request(`/v1/orgs/${orgSlug}/projects/${projSlug}/versions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/rntme-project-bundle+json' },
      body: JSON.stringify(sampleBundle),
    });
    expect(res.status).toBe(403);
  });
});
```

`buildTestApp` already exists for the e2e suite — reuse, possibly extending it with `seedAdminWithProject` / `seedReadOnlyTokenWithProject` helpers.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/integration/project-versions.test.ts
```

Expected: FAIL — module / route missing.

- [ ] **Step 3: Implement the router**

```typescript
// rntme-cli/packages/platform-http/src/routes/project-versions.ts
import { Hono } from 'hono';
import {
  parseCanonicalBundle,
  publishProjectVersion,
  listProjectVersions,
  getProjectVersion,
  ListProjectVersionsQuerySchema,
  isOk,
  blobKey,
} from '@rntme-cli/platform-core';
import type { BlobStore, Ids } from '@rntme-cli/platform-core';
import { requireScope, requireOrgMatch } from '../middleware/auth.js';
import { respond, resolveProject } from './helpers.js';
import { resolveDeps as defaultResolveDeps, type RequestRepos } from '../resolve-deps.js';
import { materializeAndCompose } from '../blueprint/load.js';
import type { PoolClient } from 'pg';

type Deps = {
  blob: BlobStore;
  ids: Ids;
  resolveDeps?: (tx: PoolClient) => RequestRepos;
};

const BUNDLE_CONTENT_TYPE = 'application/rntme-project-bundle+json';
const BUNDLE_MAX_BYTES = 10 * 1024 * 1024;

function projParams(c: { req: { param: (k: string) => string | undefined } }) {
  const orgSlug = c.req.param('orgSlug');
  const projSlug = c.req.param('projSlug');
  if (orgSlug === undefined || projSlug === undefined) return null;
  return { orgSlug, projSlug };
}

export function projectVersionRoutes(deps: Deps): Hono {
  const app = new Hono();
  const resolve = deps.resolveDeps ?? defaultResolveDeps;
  app.use('*', requireOrgMatch('orgSlug'));

  app.post('/versions', requireScope('version:publish'), async (c) => {
    const repos = resolve(c.get('tx'));
    const p = projParams(c);
    if (!p) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'missing path params' } }, 400);

    const proj = await resolveProject(repos, p.orgSlug, p.projSlug);
    if (!proj.ok) return respond(c, proj as never);

    const ct = c.req.header('content-type') ?? '';
    if (!ct.startsWith(BUNDLE_CONTENT_TYPE)) {
      return c.json({ error: { code: 'PROJECT_VERSION_BUNDLE_CONTENT_TYPE', message: `expected ${BUNDLE_CONTENT_TYPE}` } }, 415);
    }

    const bytes = Buffer.from(await c.req.arrayBuffer());
    if (bytes.byteLength > BUNDLE_MAX_BYTES) {
      return c.json({ error: { code: 'PROJECT_VERSION_BUNDLE_TOO_LARGE', message: `max ${BUNDLE_MAX_BYTES} bytes` } }, 413);
    }

    const parsed = parseCanonicalBundle(bytes);
    if (!isOk(parsed)) return respond(c, parsed);

    // Idempotent short-circuit BEFORE running the blueprint validator on a re-upload.
    const existing = await repos.projectVersions.findByDigest(proj.value.id, parsed.value.digest);
    if (!isOk(existing)) return respond(c, existing);
    if (existing.value) return c.json({ version: existing.value }, 200);

    // First time: validate the blueprint and compute summary.
    const composed = await materializeAndCompose(parsed.value.bundle);
    if (!composed.ok) return respond(c, composed);

    const s = c.get('subject');
    const r = await publishProjectVersion(
      { repos: { projects: repos.projects, projectVersions: repos.projectVersions }, blob: deps.blob, ids: deps.ids },
      {
        orgId: s.org.id,
        projectId: proj.value.id,
        accountId: s.account.id,
        tokenId: s.tokenId ?? null,
        bundleBytes: bytes,
        bundleDigest: parsed.value.digest,
        summary: composed.value.summary,
      },
    );
    return respond(c, r, 201, 'version');
  });

  app.get('/versions', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const p = projParams(c);
    if (!p) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'missing path params' } }, 400);
    const proj = await resolveProject(repos, p.orgSlug, p.projSlug);
    if (!proj.ok) return respond(c, proj as never);
    const q = ListProjectVersionsQuerySchema.safeParse({ limit: c.req.query('limit'), cursor: c.req.query('cursor') });
    if (!q.success) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: q.error.message } }, 400);
    const r = await listProjectVersions(
      { repos: { projectVersions: repos.projectVersions } },
      { projectId: proj.value.id, limit: q.data.limit, cursor: q.data.cursor },
    );
    return respond(c, r, 200, 'versions');
  });

  app.get('/versions/:seq', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const p = projParams(c);
    if (!p) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'missing path params' } }, 400);
    const proj = await resolveProject(repos, p.orgSlug, p.projSlug);
    if (!proj.ok) return respond(c, proj as never);
    const seq = Number(c.req.param('seq'));
    if (!Number.isInteger(seq) || seq <= 0) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'seq' } }, 400);
    const v = await getProjectVersion({ repos: { projectVersions: repos.projectVersions } }, { projectId: proj.value.id, seq });
    if (!isOk(v)) return respond(c, v);
    if (!v.value) return c.json({ error: { code: 'PROJECT_VERSION_NOT_FOUND', message: `seq=${seq}` } }, 404);
    return c.json({ version: v.value });
  });

  app.get('/versions/:seq/bundle', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const p = projParams(c);
    if (!p) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'missing path params' } }, 400);
    const proj = await resolveProject(repos, p.orgSlug, p.projSlug);
    if (!proj.ok) return respond(c, proj as never);
    const seq = Number(c.req.param('seq'));
    if (!Number.isInteger(seq) || seq <= 0) return c.json({ error: { code: 'PLATFORM_PARSE_PATH_INVALID', message: 'seq' } }, 400);
    const v = await getProjectVersion({ repos: { projectVersions: repos.projectVersions } }, { projectId: proj.value.id, seq });
    if (!isOk(v)) return respond(c, v);
    if (!v.value) return c.json({ error: { code: 'PROJECT_VERSION_NOT_FOUND', message: `seq=${seq}` } }, 404);
    const url = await deps.blob.presignedGet(v.value.bundleBlobKey, 600);
    if (!isOk(url)) return respond(c, url);
    return c.redirect(url.value, 302);
  });

  return app;
}
```

`resolveProject` is a new helper. Add it to `routes/helpers.ts`:

```typescript
// rntme-cli/packages/platform-http/src/routes/helpers.ts (add)
export async function resolveProject(
  repos: { organizations: OrganizationRepo; projects: ProjectRepo },
  orgSlug: string,
  projSlug: string,
): Promise<Result<{ org: Organization; project: Project }, PlatformError>> {
  const org = await repos.organizations.findBySlug(orgSlug);
  if (!isOk(org)) return org as never;
  if (!org.value) return err([{ code: 'PLATFORM_TENANCY_ORG_NOT_FOUND', message: orgSlug }]);
  const proj = await repos.projects.findBySlug(org.value.id, projSlug);
  if (!isOk(proj)) return proj as never;
  if (!proj.value) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: projSlug }]);
  if (proj.value.archivedAt) return err([{ code: 'PLATFORM_TENANCY_RESOURCE_ARCHIVED', message: projSlug }]);
  return ok({ org: org.value, project: proj.value });
}
```

(Match the existing `resolveService` pattern — read it first.)

- [ ] **Step 4: Update `app.ts`**

Replace the body-limit guard and route mount:

```typescript
// 1. body-limit regex — match the new project-version path:
const isPublish = /\/v1\/orgs\/[^/]+\/projects\/[^/]+\/versions\/?$/.test(url.pathname);

// 2. drop the old service / version routes:
//    remove imports of serviceRoutes, versionRoutes
//    remove .route('/orgs/:orgSlug/projects/:projSlug/services', ...)
//    remove .route('/orgs/:orgSlug/projects/:projSlug/services/:svcSlug', ...)

// 3. add the new project-version mount (under projects/:projSlug):
authed.route(
  '/orgs/:orgSlug/projects/:projSlug',
  projectVersionRoutes({ blob: deps.blob, ids: deps.ids }),
);
```

Add the import: `import { projectVersionRoutes } from './routes/project-versions.js';`

- [ ] **Step 5: Update `resolve-deps.ts`**

```typescript
// rntme-cli/packages/platform-http/src/resolve-deps.ts
import type { PoolClient } from 'pg';
import {
  PgOrganizationRepo,
  PgAccountRepo,
  PgMembershipMirrorRepo,
  PgWorkosEventLogRepo,
  PgProjectRepo,
  PgProjectVersionRepo,
  PgTokenRepo,
  PgAuditRepo,
  PgOutboxRepo,
} from '@rntme-cli/platform-storage';
import type {
  OrganizationRepo, AccountRepo, MembershipMirrorRepo, WorkosEventLogRepo,
  ProjectRepo, ProjectVersionRepo, TokenRepo, AuditRepo, OutboxRepo,
} from '@rntme-cli/platform-core';

export type RequestRepos = {
  organizations: OrganizationRepo;
  accounts: AccountRepo;
  memberships: MembershipMirrorRepo;
  workosEventLog: WorkosEventLogRepo;
  projects: ProjectRepo;
  projectVersions: ProjectVersionRepo;
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
    projectVersions: new PgProjectVersionRepo(tx),
    tokens: new PgTokenRepo(tx),
    audit: new PgAuditRepo(tx),
    outbox: new PgOutboxRepo(tx),
  };
}
```

(Drop `services`, `artifacts`, `tags`.)

- [ ] **Step 6: Run tests**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/integration/project-versions.test.ts
pnpm -F @rntme-cli/platform-http typecheck
```

Expected: PASS (5/5 tests). Some other tests (those targeting old service routes) will fail by typecheck — that's expected and addressed in Task U-12. Use `vitest run --bail` filtered to the new test file for now.

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/platform-http/src/routes/project-versions.ts \
        rntme-cli/packages/platform-http/src/routes/helpers.ts \
        rntme-cli/packages/platform-http/src/app.ts \
        rntme-cli/packages/platform-http/src/resolve-deps.ts \
        rntme-cli/packages/platform-http/test/integration/project-versions.test.ts
git commit -m "feat(platform-http): project-version upload + read routes"
```

---

### Task U-9: CLI bundle build module

**Files:**
- Create: `rntme-cli/packages/cli/src/bundle/canonical.ts`.
- Create: `rntme-cli/packages/cli/src/bundle/build.ts`.
- Create: `rntme-cli/packages/cli/src/bundle/types.ts`.
- Create: `rntme-cli/packages/cli/test/unit/bundle/build.test.ts`.

The CLI canonicalizes JSON identically to the server (otherwise digest mismatch). Reuse the same algorithm as `platform-core/src/validation/canonical-json.ts`. Either:

(a) Copy the file into `cli/src/bundle/canonical.ts` (CLI is a separate publishable package with no platform-core dep), or
(b) Add `@rntme-cli/platform-core` as a CLI dep and import.

**Choose (a)** — CLI must remain installable globally without dragging in storage / pg / hono. Copy the file (it's tiny) and keep the two implementations byte-for-byte identical. Add a contract test (Task U-9 step 4) that compares CLI vs core digests for a fixed input.

- [ ] **Step 1: Write the failing test**

```typescript
// rntme-cli/packages/cli/test/unit/bundle/build.test.ts
import { describe, it, expect } from 'vitest';
import { buildCanonicalBundle } from '../../../src/bundle/build.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fixture(structure: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-test-'));
  for (const [rel, val] of Object.entries(structure)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, typeof val === 'string' ? val : JSON.stringify(val));
  }
  return dir;
}

describe('buildCanonicalBundle', () => {
  it('builds a canonical bundle from a folder', async () => {
    const dir = fixture({
      'project.json': { name: 'shop', services: ['app'] },
      'pdm/pdm.json': { name: 'shop', entities: [] },
      'services/app/qsm/qsm.json': { name: 'shop-app' },
    });
    try {
      const r = await buildCanonicalBundle(dir);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(Object.keys(r.value.bundle.files).sort()).toEqual([
          'pdm/pdm.json', 'project.json', 'services/app/qsm/qsm.json',
        ]);
        expect(r.value.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects non-JSON files with CLI_BUNDLE_NON_JSON_FILE', async () => {
    const dir = fixture({
      'project.json': { name: 'x' },
      'pdm/notes.txt': 'free text',
    });
    try {
      const r = await buildCanonicalBundle(dir);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0].code).toBe('CLI_BUNDLE_NON_JSON_FILE');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects missing project.json', async () => {
    const dir = fixture({ 'pdm/pdm.json': { x: 1 } });
    try {
      const r = await buildCanonicalBundle(dir);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0].code).toBe('CLI_BUNDLE_MISSING_PROJECT_JSON');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects malformed JSON', async () => {
    const dir = fixture({ 'project.json': '{not json' });
    try {
      const r = await buildCanonicalBundle(dir);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0].code).toBe('CLI_BUNDLE_INVALID_JSON');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('digest is deterministic across two builds of the same content', async () => {
    const a = fixture({ 'project.json': { a: 1, b: 2 }, 'x/y.json': { p: 1, q: 2 } });
    const b = fixture({ 'project.json': { b: 2, a: 1 }, 'x/y.json': { q: 2, p: 1 } });
    try {
      const ra = await buildCanonicalBundle(a);
      const rb = await buildCanonicalBundle(b);
      expect(ra.ok && rb.ok).toBe(true);
      if (ra.ok && rb.ok) expect(ra.value.digest).toBe(rb.value.digest);
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/bundle/build.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement canonical.ts**

Copy `rntme-cli/packages/platform-core/src/validation/canonical-json.ts` to `rntme-cli/packages/cli/src/bundle/canonical.ts` (open the source first, then duplicate verbatim, replacing imports with stdlib equivalents). It exports `canonicalize(value): string`, `sha256Hex(s): string`, `canonicalDigest(value): string`.

- [ ] **Step 4: Implement types + build**

```typescript
// rntme-cli/packages/cli/src/bundle/types.ts
export type CanonicalBundle = {
  readonly version: 1;
  readonly files: Readonly<Record<string, unknown>>;
};

export type BundleBuildOk = {
  readonly bundle: CanonicalBundle;
  readonly digest: string;
  readonly bytes: Buffer;
};

export type BundleBuildError = { code: string; message: string; path?: string };

export type BundleBuildResult =
  | { ok: true; value: BundleBuildOk }
  | { ok: false; errors: readonly BundleBuildError[] };
```

```typescript
// rntme-cli/packages/cli/src/bundle/build.ts
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { canonicalize } from './canonical.js';
import { createHash } from 'node:crypto';
import type { CanonicalBundle, BundleBuildResult } from './types.js';

export async function buildCanonicalBundle(rootDir: string): Promise<BundleBuildResult> {
  let projectJsonFound = false;
  const files: Record<string, unknown> = {};
  const errors: { code: string; message: string; path?: string }[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = relative(rootDir, abs).split(/[/\\]/).join('/');
      if (!rel.endsWith('.json')) {
        errors.push({ code: 'CLI_BUNDLE_NON_JSON_FILE', message: 'only .json files are allowed', path: rel });
        continue;
      }
      const text = await readFile(abs, 'utf8');
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch (cause) {
        errors.push({ code: 'CLI_BUNDLE_INVALID_JSON', message: String(cause), path: rel });
        continue;
      }
      files[rel] = value;
      if (rel === 'project.json') projectJsonFound = true;
    }
  }

  try {
    const s = await stat(rootDir);
    if (!s.isDirectory()) return { ok: false, errors: [{ code: 'CLI_BUNDLE_NOT_A_DIRECTORY', message: rootDir }] };
  } catch (cause) {
    return { ok: false, errors: [{ code: 'CLI_BUNDLE_FOLDER_NOT_FOUND', message: rootDir + ': ' + String(cause) }] };
  }

  await walk(rootDir);
  if (!projectJsonFound) {
    errors.unshift({ code: 'CLI_BUNDLE_MISSING_PROJECT_JSON', message: 'project.json is required at blueprint root' });
  }
  if (errors.length > 0) return { ok: false, errors };

  const bundle: CanonicalBundle = { version: 1, files };
  const bytes = Buffer.from(canonicalize(bundle), 'utf8');
  const digest = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  return { ok: true, value: { bundle, digest, bytes } };
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/bundle/build.test.ts
```

Expected: PASS (5/5).

- [ ] **Step 6: Add cross-package digest contract test**

Create `rntme-cli/packages/cli/test/unit/bundle/digest-contract.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildCanonicalBundle } from '../../../src/bundle/build.js';
import { canonicalBundleDigest } from '@rntme-cli/platform-core'; // OK in tests — devDep
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('CLI ↔ platform-core digest agreement', () => {
  it('produces identical digests', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-digest-'));
    try {
      mkdirSync(join(dir, 'pdm'), { recursive: true });
      writeFileSync(join(dir, 'project.json'), JSON.stringify({ name: 'x', services: [] }));
      writeFileSync(join(dir, 'pdm/a.json'), JSON.stringify({ a: 1, b: 2 }));
      const cli = await buildCanonicalBundle(dir);
      expect(cli.ok).toBe(true);
      if (cli.ok) {
        const coreDigest = canonicalBundleDigest(cli.value.bundle);
        expect(cli.value.digest).toBe(coreDigest);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
```

Add `@rntme-cli/platform-core` to CLI's `devDependencies` (NOT dependencies — only the test pulls it in).

- [ ] **Step 7: Run contract test**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/bundle/digest-contract.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add rntme-cli/packages/cli/src/bundle/ \
        rntme-cli/packages/cli/test/unit/bundle/ \
        rntme-cli/packages/cli/package.json \
        pnpm-lock.yaml
git commit -m "feat(cli): canonical bundle build with cross-package digest contract"
```

---

### Task U-10: CLI `project publish` command

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/project/publish.ts`.
- Create: `rntme-cli/packages/cli/test/unit/commands/project/publish.test.ts`.
- Modify: `rntme-cli/packages/cli/src/api/endpoints.ts` — add `publishProjectVersion` API client call.
- Modify: `rntme-cli/packages/cli/src/api/types.ts` — add response types.

The publish command does:

1. Resolve `org` (`--org` → credentials default → error).
2. Resolve `project` (from `<folder>/project.json:name` → optional `--project` override).
3. **Local validate** by importing `@rntme/blueprint.loadComposedBlueprint(folder)`. CLI is a workspace package — the import works from the same workspace at dev/test time. For production, since CLI ships as an npm package, `@rntme/blueprint` becomes a runtime dep. Add it as a CLI dep.
4. If `--dry-run`: print summary + digest, exit 0.
5. Build canonical bundle.
6. POST to platform.
7. On 404: optionally create-project then retry.

- [ ] **Step 1: Add `@rntme/blueprint` as CLI runtime dep**

```bash
# Update rntme-cli/packages/cli/package.json:
#   dependencies: { ..., "@rntme/blueprint": "workspace:*" }
pnpm install -w
```

- [ ] **Step 2: Add API endpoint helpers**

Edit `rntme-cli/packages/cli/src/api/types.ts`, add:

```typescript
export type PublishProjectVersionResponse = {
  version: {
    id: string;
    orgId: string;
    projectId: string;
    seq: number;
    bundleDigest: string;
    bundleBlobKey: string;
    bundleSizeBytes: number;
    summary: { projectName: string; services: string[]; routes: { ui: Record<string, string>; http: Record<string, string> }; middleware: Record<string, unknown>; mounts: unknown[] };
    uploadedByAccountId: string;
    createdAt: string;
  };
};
```

Edit `rntme-cli/packages/cli/src/api/endpoints.ts`, add:

```typescript
export async function publishProjectVersion(
  client: ApiClient,
  args: { orgSlug: string; projectSlug: string; bundleBytes: Buffer },
): Promise<{ status: number; body: PublishProjectVersionResponse | { error: { code: string; message: string } } }> {
  return client.request({
    method: 'POST',
    path: `/v1/orgs/${encodeURIComponent(args.orgSlug)}/projects/${encodeURIComponent(args.projectSlug)}/versions`,
    body: args.bundleBytes,
    contentType: 'application/rntme-project-bundle+json',
  });
}
```

(Read `api/client.ts` to see the existing `request` signature; the body-as-Buffer + content-type may need a small adjustment if `client.request` currently only accepts JSON objects. Adjust as needed.)

- [ ] **Step 3: Write the failing test for the command**

```typescript
// rntme-cli/packages/cli/test/unit/commands/project/publish.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@rntme/blueprint', () => ({
  loadComposedBlueprint: () => ({
    ok: true,
    value: {
      project: { name: 'shop', services: ['app'], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
      services: {},
    },
  }),
  isOk: <T>(r: { ok: boolean }): r is { ok: true; value: T } => r.ok === true,
}));

import { runProjectPublish } from '../../../../src/commands/project/publish.js';

function fixture(): string {
  const d = mkdtempSync(join(tmpdir(), 'rntme-pub-'));
  mkdirSync(join(d, 'pdm'), { recursive: true });
  writeFileSync(join(d, 'project.json'), JSON.stringify({ name: 'shop', services: ['app'] }));
  writeFileSync(join(d, 'pdm/pdm.json'), JSON.stringify({ name: 'shop', entities: [] }));
  return d;
}

describe('runProjectPublish', () => {
  it('uploads bundle and prints version seq', async () => {
    const dir = fixture();
    const fakeApi = {
      publishProjectVersion: vi.fn(async () => ({ status: 201, body: { version: { id: 'v1', seq: 1, bundleDigest: 'sha256:abcd' } } })),
    };
    const ctx = makeCtx({ api: fakeApi as never, folder: dir, org: 'acme' });
    try {
      const code = await runProjectPublish(ctx);
      expect(code).toBe(0);
      expect(fakeApi.publishProjectVersion).toHaveBeenCalledOnce();
      expect(ctx.stdout).toContain('Published as version #1');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('idempotent: prints "Already published" on 200', async () => {
    const dir = fixture();
    const fakeApi = {
      publishProjectVersion: vi.fn(async () => ({ status: 200, body: { version: { id: 'v1', seq: 3, bundleDigest: 'sha256:zz' } } })),
    };
    const ctx = makeCtx({ api: fakeApi as never, folder: dir, org: 'acme' });
    try {
      const code = await runProjectPublish(ctx);
      expect(code).toBe(0);
      expect(ctx.stdout).toContain('Already published as version #3');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('--dry-run: validates locally and exits 0 without uploading', async () => {
    const dir = fixture();
    const fakeApi = { publishProjectVersion: vi.fn() };
    const ctx = makeCtx({ api: fakeApi as never, folder: dir, org: 'acme', dryRun: true });
    try {
      const code = await runProjectPublish(ctx);
      expect(code).toBe(0);
      expect(fakeApi.publishProjectVersion).not.toHaveBeenCalled();
      expect(ctx.stdout).toContain('Dry run');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('404 + --create-project: creates project, retries publish', async () => {
    const dir = fixture();
    const fakeApi = {
      publishProjectVersion: vi.fn()
        .mockResolvedValueOnce({ status: 404, body: { error: { code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: 'shop' } } })
        .mockResolvedValueOnce({ status: 201, body: { version: { id: 'v1', seq: 1, bundleDigest: 'sha256:aa' } } }),
      createProject: vi.fn(async () => ({ status: 201, body: { project: { slug: 'shop', id: 'p1' } } })),
    };
    const ctx = makeCtx({ api: fakeApi as never, folder: dir, org: 'acme', createProject: true });
    try {
      const code = await runProjectPublish(ctx);
      expect(code).toBe(0);
      expect(fakeApi.createProject).toHaveBeenCalledOnce();
      expect(fakeApi.publishProjectVersion).toHaveBeenCalledTimes(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

function makeCtx(opts: {
  api: unknown; folder: string; org: string; project?: string; dryRun?: boolean; createProject?: boolean;
}) {
  const stdoutLines: string[] = [];
  return {
    api: opts.api,
    folder: opts.folder,
    flags: { org: opts.org, project: opts.project, dryRun: !!opts.dryRun, createProject: !!opts.createProject },
    stdout: '' as string,
    write: (s: string) => { stdoutLines.push(s); /* mutate read-side: */ Object.assign(this, { stdout: stdoutLines.join('\n') }); },
    get stdoutText() { return stdoutLines.join('\n'); },
  };
}
```

(`makeCtx` is illustrative — match the actual `runProjectPublish` ctx shape used in the implementation.)

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/commands/project/publish.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 5: Implement the command**

```typescript
// rntme-cli/packages/cli/src/commands/project/publish.ts
import { readFile } from 'node:fs/promises';
import { join, resolve as resolvePath } from 'node:path';
import { loadComposedBlueprint } from '@rntme/blueprint';
import { buildCanonicalBundle } from '../../bundle/build.js';
import { resolveCommonContext } from '../../config/resolve.js';
import { publishProjectVersion as apiPublish, createProject as apiCreateProject } from '../../api/endpoints.js';
import type { CommonFlags } from '../harness.js';

export async function runProjectPublish(opts: {
  flags: CommonFlags & {
    folder?: string;
    org?: string;
    project?: string;
    createProject?: boolean;
    dryRun?: boolean;
  };
}): Promise<number> {
  const ctx = await resolveCommonContext(opts.flags);
  const folder = resolvePath(opts.flags.folder ?? '.');
  const orgSlug = opts.flags.org ?? ctx.defaultOrg;
  if (!orgSlug) {
    process.stderr.write('error: org slug not specified (--org or default in credentials)\n');
    return 1;
  }

  // 1. Read project.json for project slug.
  let projectJson: { name: string };
  try {
    projectJson = JSON.parse(await readFile(join(folder, 'project.json'), 'utf8'));
  } catch (cause) {
    process.stderr.write(`error: cannot read project.json: ${String(cause)}\n`);
    return 1;
  }
  const projectSlug = opts.flags.project ?? projectJson.name;

  // 2. Local validate.
  const composed = loadComposedBlueprint(folder);
  if (!composed.ok) {
    process.stderr.write('error: blueprint validation failed:\n');
    for (const e of composed.errors) {
      process.stderr.write(`  ${e.code}: ${e.message}\n`);
    }
    return 1;
  }

  // 3. Build canonical bundle.
  const bundleResult = await buildCanonicalBundle(folder);
  if (!bundleResult.ok) {
    process.stderr.write('error: bundle build failed:\n');
    for (const e of bundleResult.errors) {
      process.stderr.write(`  ${e.code}: ${e.message}${e.path ? ' [' + e.path + ']' : ''}\n`);
    }
    return 1;
  }

  if (opts.flags.dryRun) {
    process.stdout.write(
      `Dry run — bundle ok\n` +
      `  project: ${projectSlug}\n` +
      `  digest:  ${bundleResult.value.digest}\n` +
      `  size:    ${bundleResult.value.bytes.byteLength} bytes\n` +
      `  files:   ${Object.keys(bundleResult.value.bundle.files).length}\n`,
    );
    return 0;
  }

  // 4. Upload.
  const upload = async () =>
    apiPublish(ctx.api, { orgSlug, projectSlug, bundleBytes: bundleResult.value.bytes });

  let res = await upload();
  if (res.status === 404 && opts.flags.createProject) {
    const cr = await apiCreateProject(ctx.api, { orgSlug, slug: projectSlug, displayName: projectSlug });
    if (cr.status >= 400) {
      process.stderr.write(`error: create-project failed (${cr.status}): ${formatError(cr.body)}\n`);
      return 1;
    }
    res = await upload();
  }

  if (res.status === 200) {
    const v = (res.body as { version: { seq: number; bundleDigest: string } }).version;
    process.stdout.write(`Already published as version #${v.seq} (digest ${shortDigest(v.bundleDigest)})\n`);
    return 0;
  }
  if (res.status === 201) {
    const v = (res.body as { version: { seq: number; bundleDigest: string } }).version;
    process.stdout.write(`Published as version #${v.seq} (digest ${shortDigest(v.bundleDigest)})\n`);
    return 0;
  }

  process.stderr.write(`error: upload failed (${res.status}): ${formatError(res.body)}\n`);
  if (res.status === 404 && !opts.flags.createProject) {
    process.stderr.write(`hint: project '${projectSlug}' does not exist in org '${orgSlug}'. Use --create-project or run 'rntme project create ${projectSlug}' first.\n`);
  }
  return 1;
}

function shortDigest(d: string): string {
  return d.startsWith('sha256:') ? d.slice(0, 14) + '…' : d;
}
function formatError(body: unknown): string {
  const e = (body as { error?: { code?: string; message?: string } } | undefined)?.error;
  if (!e) return JSON.stringify(body);
  return `${e.code ?? 'UNKNOWN'}: ${e.message ?? ''}`;
}
```

- [ ] **Step 6: Wire into `bin/cli.ts`**

Add the dispatch case for `project publish` and `project version list/show` (the latter implemented in Task U-11) and update the USAGE text. Drop the old `validate`, `publish`, `service`, `version`, `tag` cases (Task U-12 deletes them).

- [ ] **Step 7: Run tests**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/commands/project/publish.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 8: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/project/publish.ts \
        rntme-cli/packages/cli/src/api/endpoints.ts \
        rntme-cli/packages/cli/src/api/types.ts \
        rntme-cli/packages/cli/src/bin/cli.ts \
        rntme-cli/packages/cli/test/unit/commands/project/publish.test.ts \
        rntme-cli/packages/cli/package.json \
        pnpm-lock.yaml
git commit -m "feat(cli): rntme project publish — local validate + canonical bundle upload"
```

---

### Task U-11: CLI `project version list` and `project version show`

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/project/version/list.ts`.
- Create: `rntme-cli/packages/cli/src/commands/project/version/show.ts`.
- Create: `rntme-cli/packages/cli/test/unit/commands/project/version/list.test.ts` and `show.test.ts`.
- Modify: `rntme-cli/packages/cli/src/api/endpoints.ts` — add `listProjectVersions`, `getProjectVersion`.

These mirror the deleted `commands/version/list.ts` and `commands/version/show.ts` patterns, but operate on project-version (not service-version). Tabulate via `output/tables.ts` (existing helper).

- [ ] **Step 1: Add API endpoint helpers**

Edit `api/endpoints.ts`:

```typescript
export async function listProjectVersions(
  client: ApiClient,
  args: { orgSlug: string; projectSlug: string; limit?: number; cursor?: number },
): Promise<{ status: number; body: { versions: ProjectVersionDTO[] } | { error: { code: string; message: string } } }> {
  const params = new URLSearchParams();
  if (args.limit !== undefined) params.set('limit', String(args.limit));
  if (args.cursor !== undefined) params.set('cursor', String(args.cursor));
  return client.request({
    method: 'GET',
    path: `/v1/orgs/${args.orgSlug}/projects/${args.projectSlug}/versions${params.toString() ? '?' + params : ''}`,
  });
}

export async function getProjectVersion(
  client: ApiClient,
  args: { orgSlug: string; projectSlug: string; seq: number },
): Promise<{ status: number; body: { version: ProjectVersionDTO } | { error: { code: string; message: string } } }> {
  return client.request({
    method: 'GET',
    path: `/v1/orgs/${args.orgSlug}/projects/${args.projectSlug}/versions/${args.seq}`,
  });
}
```

`ProjectVersionDTO` is the JSON-serialized `ProjectVersion`. Add it to `api/types.ts` mirroring `PublishProjectVersionResponse.version`.

- [ ] **Step 2: Implement `list.ts`** (test-first as in U-9/U-10)

```typescript
// rntme-cli/packages/cli/src/commands/project/version/list.ts
import { resolveCommonContext } from '../../../config/resolve.js';
import { listProjectVersions } from '../../../api/endpoints.js';
import { renderTable } from '../../../output/tables.js';
import type { CommonFlags } from '../../harness.js';

export async function runProjectVersionList(opts: {
  flags: CommonFlags & { org?: string; project?: string; limit?: number };
}): Promise<number> {
  const ctx = await resolveCommonContext(opts.flags);
  const orgSlug = opts.flags.org ?? ctx.defaultOrg;
  const projectSlug = opts.flags.project ?? ctx.defaultProject;
  if (!orgSlug || !projectSlug) {
    process.stderr.write('error: missing org or project slug\n');
    return 1;
  }
  const res = await listProjectVersions(ctx.api, { orgSlug, projectSlug, limit: opts.flags.limit ?? 50 });
  if (res.status >= 400) {
    process.stderr.write(`error: ${res.status}\n`);
    return 1;
  }
  const versions = (res.body as { versions: { seq: number; bundleDigest: string; createdAt: string; uploadedByAccountId: string; summary: { services: string[] } }[] }).versions;
  if (opts.flags.json) {
    process.stdout.write(JSON.stringify(versions, null, 2) + '\n');
    return 0;
  }
  process.stdout.write(renderTable({
    headers: ['Seq', 'Digest', 'Services', 'Uploaded'],
    rows: versions.map((v) => [
      `#${v.seq}`,
      v.bundleDigest.slice(0, 17) + '…',
      String(v.summary.services.length),
      v.createdAt,
    ]),
  }));
  return 0;
}
```

- [ ] **Step 3: Implement `show.ts`** (similar pattern; print summary as YAML or aligned key/values).

- [ ] **Step 4: Add unit tests for both commands** following the publish.test.ts pattern.

- [ ] **Step 5: Wire into `bin/cli.ts`** — `project version list`, `project version show <seq>`.

- [ ] **Step 6: Run tests**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/commands/project/version/
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/project/version/ \
        rntme-cli/packages/cli/src/api/endpoints.ts \
        rntme-cli/packages/cli/src/api/types.ts \
        rntme-cli/packages/cli/src/bin/cli.ts \
        rntme-cli/packages/cli/test/unit/commands/project/version/
git commit -m "feat(cli): rntme project version list / show"
```

---

### Task U-12: Drop legacy code (platform side)

**Files (delete):**
- `rntme-cli/packages/platform-core/src/repos/{service-repo,artifact-repo,tag-repo}.ts`
- `rntme-cli/packages/platform-core/src/use-cases/{services,tags,versions,publish-version}.ts`
- `rntme-cli/packages/platform-core/src/validation/bundle.ts`
- `rntme-cli/packages/platform-core/test/**` for the above
- `rntme-cli/packages/platform-storage/src/repos/{pg-service-repo,pg-artifact-repo,pg-tag-repo}.ts`
- `rntme-cli/packages/platform-storage/test/**` for the above
- `rntme-cli/packages/platform-http/src/routes/{services,versions}.ts`
- `rntme-cli/packages/platform-http/src/ui/pages/service.tsx`
- `rntme-cli/packages/platform-http/test/**` for the above

**Files modified:**
- `rntme-cli/packages/platform-core/src/index.ts` — drop re-exports.
- `rntme-cli/packages/platform-core/src/schemas/{entities,requests}.ts` — drop ServiceSchema, ArtifactVersionSchema, TagSchema, PublishRequestSchema, BundleSchema, CreateServiceInputSchema, MoveTagInputSchema, ListVersionsQuerySchema (the new ListProjectVersionsQuerySchema lives in schemas/project-version.ts).
- `rntme-cli/packages/platform-storage/src/index.ts` — drop re-exports.
- `rntme-cli/packages/platform-http/src/app.ts` — drop service / version route imports + mounts (already partly done in U-8; verify).

- [ ] **Step 1: Delete files**

```bash
rm rntme-cli/packages/platform-core/src/repos/service-repo.ts
rm rntme-cli/packages/platform-core/src/repos/artifact-repo.ts
rm rntme-cli/packages/platform-core/src/repos/tag-repo.ts
rm rntme-cli/packages/platform-core/src/use-cases/services.ts
rm rntme-cli/packages/platform-core/src/use-cases/tags.ts
rm rntme-cli/packages/platform-core/src/use-cases/versions.ts
rm rntme-cli/packages/platform-core/src/use-cases/publish-version.ts
rm rntme-cli/packages/platform-core/src/validation/bundle.ts
rm -r rntme-cli/packages/platform-core/test/unit/use-cases/{services,tags,versions,publish-version}.test.ts 2>/dev/null
rm -r rntme-cli/packages/platform-core/test/unit/validation/bundle.test.ts 2>/dev/null

rm rntme-cli/packages/platform-storage/src/repos/pg-service-repo.ts
rm rntme-cli/packages/platform-storage/src/repos/pg-artifact-repo.ts
rm rntme-cli/packages/platform-storage/src/repos/pg-tag-repo.ts
rm -r rntme-cli/packages/platform-storage/test/integration/pg-{service,artifact,tag}-repo.test.ts 2>/dev/null

rm rntme-cli/packages/platform-http/src/routes/services.ts
rm rntme-cli/packages/platform-http/src/routes/versions.ts
rm rntme-cli/packages/platform-http/src/ui/pages/service.tsx
rm -r rntme-cli/packages/platform-http/test/integration/{services,versions}.test.ts 2>/dev/null
```

- [ ] **Step 2: Update `platform-core/src/index.ts`**

Drop these lines:

```typescript
export * from './use-cases/services.js';
export * from './use-cases/tags.js';
export * from './use-cases/versions.js';
export * from './use-cases/publish-version.js';
export * from './repos/service-repo.js';
export * from './repos/artifact-repo.js';
export * from './repos/tag-repo.js';
export * from './validation/bundle.js';
```

- [ ] **Step 3: Trim `schemas/entities.ts`**

Drop `ServiceSchema` + `Service` type, `ArtifactVersionSchema` + `ArtifactVersion` type, `TagSchema` + `Tag` type. Keep `OrganizationSchema`, `AccountSchema`, `MembershipMirrorSchema`, `ProjectSchema`, `RoleSchema`, `ScopeSchema`, `AuthSubject*`, audit / token entities.

- [ ] **Step 4: Trim `schemas/requests.ts`**

Drop `BundleSchema`, `BundleInput`, `PublishRequestSchema`, `PublishRequest`, `CreateServiceInputSchema`, `PatchServiceInputSchema`, `MoveTagInputSchema`, `ListVersionsQuerySchema`. Keep `CreateProjectInputSchema`, `PatchProjectInputSchema`, `CreateTokenInputSchema`.

- [ ] **Step 5: Update `platform-storage/src/index.ts`**

Drop `PgServiceRepo`, `PgArtifactRepo`, `PgTagRepo` re-exports.

- [ ] **Step 6: Verify `app.ts` no longer imports them**

```bash
grep -nE 'serviceRoutes|versionRoutes|PgArtifactRepo|PgServiceRepo|PgTagRepo' rntme-cli/packages/platform-http/src/app.ts rntme-cli/packages/platform-http/src/resolve-deps.ts
```

Expected: no matches. Fix any remaining references.

- [ ] **Step 7: Run typecheck + tests across all touched packages**

```bash
pnpm -F @rntme-cli/platform-core typecheck && pnpm -F @rntme-cli/platform-core test
pnpm -F @rntme-cli/platform-storage typecheck && pnpm -F @rntme-cli/platform-storage test
pnpm -F @rntme-cli/platform-http typecheck && pnpm -F @rntme-cli/platform-http test
```

Expected: PASS across the board. Some old test files may still reference removed exports — delete them as you find them.

- [ ] **Step 8: Commit**

```bash
git add -A rntme-cli/packages/platform-core rntme-cli/packages/platform-storage rntme-cli/packages/platform-http
git commit -m "feat: drop legacy service/artifact/tag platform code"
```

---

### Task U-13: Drop legacy CLI commands + rewrite `init`

**Files (delete):**
- `rntme-cli/packages/cli/src/commands/validate.ts`
- `rntme-cli/packages/cli/src/commands/publish.ts`
- `rntme-cli/packages/cli/src/commands/service/` (whole dir)
- `rntme-cli/packages/cli/src/commands/version/` (whole dir)
- `rntme-cli/packages/cli/src/commands/tag/` (whole dir)
- `rntme-cli/packages/cli/src/skills/sources/composing-manifest.md`
- Tests for the above.

**Files modified:**
- `rntme-cli/packages/cli/src/bin/cli.ts` — drop dispatch cases, update USAGE.
- `rntme-cli/packages/cli/src/commands/init.ts` — rewrite to scaffold a project blueprint folder.
- `rntme-cli/packages/cli/src/skills/sources/publishing-via-rntme-cli.md` — rewrite for project publish.
- `rntme-cli/packages/cli/src/skills/starters/` — drop single-service starters, add project blueprint starter.

- [ ] **Step 1: Delete legacy files**

```bash
rm rntme-cli/packages/cli/src/commands/validate.ts
rm rntme-cli/packages/cli/src/commands/publish.ts
rm -r rntme-cli/packages/cli/src/commands/service/
rm -r rntme-cli/packages/cli/src/commands/version/
rm -r rntme-cli/packages/cli/src/commands/tag/
rm rntme-cli/packages/cli/src/skills/sources/composing-manifest.md
rm -r rntme-cli/packages/cli/src/skills/starters/artifacts/
rm rntme-cli/packages/cli/src/skills/starters/rntme.json.tmpl
rm -r rntme-cli/packages/cli/test/unit/commands/{service,version,tag}/ 2>/dev/null
rm -r rntme-cli/packages/cli/test/unit/commands/{validate,publish}.test.ts 2>/dev/null
```

- [ ] **Step 2: Rewrite `init.ts` test**

```typescript
// rntme-cli/packages/cli/test/unit/commands/init.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../../src/commands/init.js';

describe('runInit', () => {
  it('scaffolds a project blueprint folder with project.json + services/app/...', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-init-'));
    try {
      const code = await runInit({ flags: { folder: dir } });
      expect(code).toBe(0);
      expect(existsSync(join(dir, 'project.json'))).toBe(true);
      const projectJson = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
      expect(projectJson.services).toContain('app');
      expect(existsSync(join(dir, 'pdm/pdm.json'))).toBe(true);
      expect(existsSync(join(dir, 'services/app/qsm/qsm.json'))).toBe(true);
      expect(existsSync(join(dir, 'services/app/ui/manifest.json'))).toBe(true);
      // No legacy rntme.json
      expect(existsSync(join(dir, 'rntme.json'))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/commands/init.test.ts
```

Expected: FAIL — old init writes `rntme.json`.

- [ ] **Step 4: Rewrite `init.ts`**

```typescript
// rntme-cli/packages/cli/src/commands/init.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve as resolvePath } from 'node:path';
import type { CommonFlags } from './harness.js';

export async function runInit(opts: { flags: CommonFlags & { folder?: string; name?: string } }): Promise<number> {
  const root = resolvePath(opts.flags.folder ?? '.');
  const name = opts.flags.name ?? 'my-project';

  const project = {
    name,
    services: ['app'],
    routes: { ui: { '/': 'app' }, http: {} },
    middleware: {},
    mounts: [],
  };
  const pdm = { name, entities: [] };
  const qsm = { name: `${name}-app`, projections: [] };
  const uiManifest = { name: `${name}-app`, layouts: [], screens: [] };

  await mkdir(join(root, 'pdm'), { recursive: true });
  await mkdir(join(root, 'services', 'app', 'qsm'), { recursive: true });
  await mkdir(join(root, 'services', 'app', 'ui'), { recursive: true });

  await writeFile(join(root, 'project.json'), JSON.stringify(project, null, 2));
  await writeFile(join(root, 'pdm', 'pdm.json'), JSON.stringify(pdm, null, 2));
  await writeFile(join(root, 'services', 'app', 'qsm', 'qsm.json'), JSON.stringify(qsm, null, 2));
  await writeFile(join(root, 'services', 'app', 'ui', 'manifest.json'), JSON.stringify(uiManifest, null, 2));

  process.stdout.write(
    `Initialized project blueprint '${name}' at ${root}\n` +
    `\nNext steps:\n` +
    `  1. Edit project.json to add services and routes.\n` +
    `  2. Validate locally: rntme project publish --dry-run\n` +
    `  3. Publish: rntme project publish --create-project\n`,
  );
  return 0;
}
```

- [ ] **Step 5: Update `bin/cli.ts`**

Update USAGE text and dispatch:

```
Usage: rntme [options] <command> [subcommand] [args...]

Commands:
  login                            Save credentials to local credentials file
  logout                           Remove local credentials
  whoami                           Print the authenticated user/org

  init [--folder <path>] [--name]  Scaffold a project blueprint folder

  project create <slug>            Create a new project on the platform
  project list                     List projects in the org
  project show [slug]              Show a project
  project publish [...]            Publish the current blueprint folder as a new version
  project version list             List published project versions
  project version show <seq>       Show a project version

  token create <name>              Create a machine token
  token list                       List tokens in the org
  token revoke <id>                Revoke a token

  skills install --agent           Install skill pack for the chosen agent
```

Drop all references to `runValidateCommand`, `runPublish`, `runServiceCreate`, `runServiceList`, `runServiceShow`, `runVersionList`, `runVersionShow`, `runTagList`, `runTagSet`, `runTagDelete`. Drop their `import` lines. Replace the dispatch switch's `service|version|tag|validate|publish` arms.

- [ ] **Step 6: Rewrite `skills/sources/publishing-via-rntme-cli.md` and add `composing-blueprint.md`**

The two skill source files describe how an AI agent should:
- compose a project blueprint folder (was: composing-manifest.md, single-service);
- publish via rntme CLI (was: publishing-via-rntme-cli.md, single-service publish flow).

Rewrite both to reflect the new commands + folder layout. Each markdown is a self-contained skill — keep the existing front-matter convention (read one of the others to copy the format). Re-run the schema-sync verification:

```bash
pnpm -F @rntme-cli/cli vitest run test/unit/skills/
```

Update any snapshot tests that referenced legacy schemas (single-service `manifest`, `pdm`, `qsm`, ...). The skills now reference the project blueprint folder layout — provide a real example block based on `packages/blueprint/test/fixtures/product-catalog-project/`.

- [ ] **Step 7: Run all CLI tests**

```bash
pnpm -F @rntme-cli/cli typecheck && pnpm -F @rntme-cli/cli test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A rntme-cli/packages/cli
git commit -m "feat(cli): drop legacy single-service commands; init scaffolds project blueprint"
```

---

### Task U-14: UI — Project detail page (versions list)

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/ui/pages/project.tsx`.
- Create: `rntme-cli/packages/platform-http/src/ui/pages/project-version.tsx`.
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx` — register new routes, drop service detail route.

- [ ] **Step 1: Modify `project.tsx` to render versions list**

```tsx
// rntme-cli/packages/platform-http/src/ui/pages/project.tsx
import { Layout } from '../layout.js';
import { DataTable } from '../components/table.js';
import { EmptyState } from '../components/empty-state.js';
import { RelativeTime } from '../components/relative-time.js';
import type { AuthSubject, Organization, Project, ProjectVersion } from '@rntme-cli/platform-core';
import type { EnrichedSubject } from './org.js';

export function ProjectPage(props: {
  subject: EnrichedSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  project: Project;
  versions: readonly ProjectVersion[];
}) {
  const { subject, project, versions } = props;
  const back = `/${subject.org.slug}`;
  return (
    <Layout title={project.displayName} variant="authed" subject={subject as AuthSubject} otherOrgs={props.otherOrgs}>
      <nav class="mb-4 text-sm text-gray-500">
        <a href={back} class="hover:underline">Projects</a> <span class="mx-1">/</span>
        <span class="text-gray-900">{project.slug}</span>
      </nav>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">{project.displayName}</h1>
        <p class="text-sm text-gray-600">Slug: <code class="rounded bg-gray-100 px-1">{project.slug}</code></p>
      </header>
      <h2 class="mb-2 text-sm font-medium text-gray-900">Project versions</h2>
      {versions.length === 0 ? (
        <EmptyState
          title="No versions yet."
          hint="Publish a blueprint with the CLI:"
          code={`rntme project publish --create-project`}
        />
      ) : (
        <DataTable
          headers={['Seq', 'Digest', 'Services', 'Uploaded']}
          rows={versions.map((v) => ({
            key: v.id,
            cells: [
              <a
                href={`/${subject.org.slug}/projects/${project.slug}/versions/${v.seq}`}
                class="font-medium text-blue-700 hover:underline"
              >
                {`#${v.seq}`}
              </a>,
              <code class="text-xs text-gray-500">{v.bundleDigest.slice(0, 17)}…</code>,
              String(v.summary.services.length),
              <RelativeTime value={v.createdAt} />,
            ],
          }))}
        />
      )}
    </Layout>
  );
}
```

- [ ] **Step 2: Implement `project-version.tsx`**

```tsx
// rntme-cli/packages/platform-http/src/ui/pages/project-version.tsx
import { Layout } from '../layout.js';
import { DataTable } from '../components/table.js';
import { RelativeTime } from '../components/relative-time.js';
import type { AuthSubject, Organization, Project, ProjectVersion } from '@rntme-cli/platform-core';
import type { EnrichedSubject } from './org.js';

export function ProjectVersionPage(props: {
  subject: EnrichedSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  project: Project;
  version: ProjectVersion;
}) {
  const { subject, project, version } = props;
  const back = `/${subject.org.slug}/projects/${project.slug}`;
  return (
    <Layout title={`${project.displayName} #${version.seq}`} variant="authed" subject={subject as AuthSubject} otherOrgs={props.otherOrgs}>
      <nav class="mb-4 text-sm text-gray-500">
        <a href={`/${subject.org.slug}`} class="hover:underline">Projects</a> <span class="mx-1">/</span>
        <a href={back} class="hover:underline">{project.slug}</a> <span class="mx-1">/</span>
        <span class="text-gray-900">{`#${version.seq}`}</span>
      </nav>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">Version #{version.seq}</h1>
        <p class="text-xs text-gray-500 break-all">Digest: <code>{version.bundleDigest}</code></p>
        <p class="text-sm text-gray-600">
          {Math.round(version.bundleSizeBytes / 1024)} KB — uploaded <RelativeTime value={version.createdAt} />
        </p>
      </header>

      <section class="mb-6">
        <h2 class="mb-2 text-sm font-medium text-gray-900">Services</h2>
        {version.summary.services.length === 0 ? (
          <p class="text-sm text-gray-500">No services declared.</p>
        ) : (
          <ul class="list-disc pl-6 text-sm">
            {version.summary.services.map((s) => <li>{s}</li>)}
          </ul>
        )}
      </section>

      <section class="mb-6">
        <h2 class="mb-2 text-sm font-medium text-gray-900">Routes</h2>
        <DataTable
          headers={['Kind', 'Path', 'Service']}
          rows={[
            ...Object.entries(version.summary.routes.ui).map(([p, s]) => ({ key: 'ui:' + p, cells: ['UI', p, s] })),
            ...Object.entries(version.summary.routes.http).map(([p, s]) => ({ key: 'http:' + p, cells: ['HTTP', p, s] })),
          ]}
        />
      </section>

      <section class="mb-6">
        <h2 class="mb-2 text-sm font-medium text-gray-900">Middleware</h2>
        {Object.keys(version.summary.middleware).length === 0 ? (
          <p class="text-sm text-gray-500">No middleware declared.</p>
        ) : (
          <pre class="rounded bg-gray-50 p-3 text-xs">{JSON.stringify(version.summary.middleware, null, 2)}</pre>
        )}
      </section>

      <section>
        <a
          href={`/v1/orgs/${subject.org.slug}/projects/${project.slug}/versions/${version.seq}/bundle`}
          class="inline-block rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
        >
          Download bundle
        </a>
        {/* The Deploy button comes in Track 2. */}
      </section>
    </Layout>
  );
}
```

- [ ] **Step 3: Wire UI routes**

In `ui/app.tsx`, replace the service-detail route handler with the project-version detail route. Pass `versions` into `ProjectPage` and `version` into `ProjectVersionPage`. Read the existing service-detail route handler to copy the data-fetching pattern (it queries via repos and renders).

- [ ] **Step 4: Drop UI service detail page**

```bash
rm rntme-cli/packages/platform-http/src/ui/pages/service.tsx
rm rntme-cli/packages/platform-http/test/unit/ui/pages/service.test.ts 2>/dev/null
```

Update the `ui/app.tsx` route to render a 404 (or redirect to project detail) when someone hits `/{org}/projects/{proj}/services/{svc}` — though actually we should drop that path entirely; the legacy URL is fine to 404.

- [ ] **Step 5: Add UI tests**

```typescript
// rntme-cli/packages/platform-http/test/unit/ui/pages/project.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '../../../helpers/render.js'; // existing JSX render helper
import { ProjectPage } from '../../../../src/ui/pages/project.js';

describe('ProjectPage', () => {
  it('shows empty state when no versions', () => {
    const html = render(<ProjectPage subject={fakeSubject()} otherOrgs={[]} project={fakeProject()} versions={[]} />);
    expect(html).toContain('No versions yet');
    expect(html).toContain('rntme project publish');
  });

  it('lists versions when present', () => {
    const html = render(<ProjectPage subject={fakeSubject()} otherOrgs={[]} project={fakeProject()} versions={[fakeVersion()]} />);
    expect(html).toContain('#1');
  });
});
// fakeSubject / fakeProject / fakeVersion helpers
```

- [ ] **Step 6: Run UI tests**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/pages/
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/platform-http/src/ui/ \
        rntme-cli/packages/platform-http/test/unit/ui/
git commit -m "feat(platform-http): UI — project detail (versions) + project-version detail"
```

---

### Task U-15: E2E test — full upload flow

**Files:**
- Create: `rntme-cli/packages/platform-http/test/e2e/project-version-upload.e2e.test.ts`.

This is the gate that proves the upload track works end-to-end before merge.

- [ ] **Step 1: Write the failing E2E**

```typescript
// rntme-cli/packages/platform-http/test/e2e/project-version-upload.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTestApp, type TestApp } from './_app.js'; // existing helper

describe('Upload flow E2E', () => {
  let app: TestApp;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });

  it('CLI publish → platform stores version → UI shows it', async () => {
    const blueprint = mkdtempSync(join(tmpdir(), 'e2e-bp-'));
    try {
      mkdirSync(join(blueprint, 'pdm'), { recursive: true });
      mkdirSync(join(blueprint, 'services/app/qsm'), { recursive: true });
      mkdirSync(join(blueprint, 'services/app/ui'), { recursive: true });
      writeFileSync(join(blueprint, 'project.json'), JSON.stringify({
        name: 'e2e-shop', services: ['app'], routes: { ui: {}, http: {} }, middleware: {}, mounts: [],
      }));
      writeFileSync(join(blueprint, 'pdm/pdm.json'), JSON.stringify({ name: 'e2e-shop', entities: [] }));
      writeFileSync(join(blueprint, 'services/app/qsm/qsm.json'), JSON.stringify({ name: 'e2e-shop-app', projections: [] }));
      writeFileSync(join(blueprint, 'services/app/ui/manifest.json'), JSON.stringify({ name: 'e2e-shop-app', layouts: [], screens: [] }));

      const { token, orgSlug } = await app.seedAdmin();

      // Run CLI as a subprocess; OR call its publish function directly with the test app's URL injected.
      // The latter is simpler for CI:
      const { runProjectPublish } = await import('../../../cli/src/commands/project/publish.js');
      const cwd = process.cwd();
      try {
        process.chdir(blueprint);
        const code = await runProjectPublish({
          flags: {
            folder: blueprint,
            org: orgSlug,
            createProject: true,
            baseUrl: app.baseUrl,
            token,
          },
        });
        expect(code).toBe(0);
      } finally { process.chdir(cwd); }

      // Verify via API.
      const list = await app.request(`/v1/orgs/${orgSlug}/projects/e2e-shop/versions`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(list.status).toBe(200);
      const body = await list.json();
      expect(body.versions).toHaveLength(1);
      expect(body.versions[0].seq).toBe(1);

      // Verify via UI.
      const ui = await app.request(`/${orgSlug}/projects/e2e-shop`, { headers: { cookie: app.sessionCookie() } });
      const html = await ui.text();
      expect(html).toContain('#1');
      expect(html).toContain('e2e-shop');
    } finally {
      rmSync(blueprint, { recursive: true, force: true });
    }
  });
});
```

(`runProjectPublish` may need a `baseUrl` + `token` flag plumbed through `resolveCommonContext` for tests. If it doesn't yet, add those in U-10 step 5.)

- [ ] **Step 2: Run E2E**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/e2e/project-version-upload.e2e.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add rntme-cli/packages/platform-http/test/e2e/project-version-upload.e2e.test.ts
git commit -m "test(e2e): project-version upload — CLI → platform → UI"
```

---

### Task U-D1: Documentation refresh (upload track)

**Files:**
- Modify: `AGENTS.md` (parent repo) — package index updates, §3 layering, §6 how-tos.
- Modify: `README.md` (parent repo) — packages table.
- Modify: `CLAUDE.md` (parent repo) — Architecture in one paragraph: replace service-version mentions.
- Modify: `docs/architecture.md` — diagrams + text referencing service-version.
- Modify: per-package READMEs: `platform-core`, `platform-storage`, `platform-http`, `cli`.
- Modify: `rntme-cli/AGENTS.md` (if exists) — same kind of refresh inside the submodule.

- [ ] **Step 1: AGENTS.md (parent)**

Update the package index to drop `services / artifact_version / tag` and add `project_version` references; update the §6 how-tos:
- "Publish a project" recipe: `rntme project publish [--create-project]`.
- "Inspect a project version on the platform" recipe.

- [ ] **Step 2: README.md (parent)**

Update the packages table — drop CLI subcommands `validate`, `publish`, `service`, `version`, `tag`; add `project publish`, `project version list/show`. Update the architecture diagram (if it references service publishing) so it shows project-first.

- [ ] **Step 3: CLAUDE.md (parent)**

Replace the architecture-in-one-paragraph mentions of service-bundles with project-version + composed blueprint.

- [ ] **Step 4: docs/architecture.md (parent)**

Replace any service-version diagrams with project-version diagrams. Keep architecture-overview style.

- [ ] **Step 5: per-package READMEs**

Each removed export → corresponding README section dropped. Each added export → corresponding README section added (with one short example call per public function).

- [ ] **Step 6: Verify all README references**

```bash
grep -rn 'service_versions\|publish-version\|publishVersion\|artifact_version\|/services/' rntme-cli/packages/*/README.md AGENTS.md README.md CLAUDE.md docs/architecture.md
```

Expected: no false-positive matches (any remaining mentions are about historical context — explicitly framed as "previous design").

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md README.md CLAUDE.md docs/architecture.md \
        rntme-cli/packages/*/README.md \
        rntme-cli/AGENTS.md
git commit -m "docs: refresh for project-version upload track"
```

---

## Spec coverage check

Before declaring Track 1 complete, confirm each spec section is covered by tasks:

- §3 D1 (full replacement) → U-12, U-13.
- §3 D2 (canonical JSON bundle) → U-2, U-4, U-9.
- §3 D3 (no rntme.json) → U-13.
- §3 D9 (validation timing) → U-7 (idempotent skip), U-8 (re-validate at deploy is in Track 2).
- §3 D10 (--create-project flag) → U-10.
- §3 D11 (10 MB cap) → U-8.
- §3 D12 (gzip in rustfs) → U-7.
- §6.1 project_version table → U-1.
- §6.2 dropped tables → U-1, U-12.
- §6.3 RLS → U-1.
- §6.4 ProjectVersionRepo → U-3.
- §7 canonical bundle format → U-2, U-4.
- §8 upload flow (CLI + server) → U-9, U-10, U-7, U-8.
- §11.2 project detail page → U-14.
- §11.3 project-version detail page → U-14.
- §12 CLI changes → U-10, U-11, U-13.
- §14 error codes → U-2, U-4, U-7, U-9.
- §15 migration plan → U-1, U-12, U-13.
- §16 testing → U-7 (unit), U-6 (integration), U-15 (E2E).
- §17 documentation touches → U-D1.

Track 2 covers the deployment-related spec sections (4, 9, 10, 11.3 deploy form, 11.4 deploy targets nav, etc.).

---

### Task U-16: BlobStore.getRaw extension (forward-compat for Track 2)

Track 2's executor needs to fetch the gzipped bundle bytes from rustfs and gunzip them. The current `BlobStore` interface in `platform-core/src/blob/store.ts` exposes only `putIfAbsent`, `presignedGet`, `getJson`. Add `getRaw(key): Promise<Result<Buffer, PlatformError>>` here in Track 1 so Track 2 can land cleanly without an interface bump in flight.

**Files:**
- Modify: `rntme-cli/packages/platform-core/src/blob/store.ts` — add `getRaw` to `BlobStore` interface.
- Modify: `rntme-cli/packages/platform-storage/src/blob/s3-blob-store.ts` — implement.
- Create: `rntme-cli/packages/platform-storage/test/integration/s3-blob-store-getraw.test.ts`.

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { setupRustFs } from './_setup.js';

describe('S3BlobStore.getRaw', () => {
  it('round-trips arbitrary bytes', async () => {
    const { store } = await setupRustFs();
    const payload = Buffer.from([1, 2, 3, 4, 5, 0xff, 0x00]);
    await store.putIfAbsent('test/raw.bin', payload);
    const r = await store.getRaw('test/raw.bin');
    expect(r.ok).toBe(true);
    if (r.ok) expect(Buffer.compare(r.value, payload)).toBe(0);
  });
});
```

- [ ] **Step 2: Add to interface**

```typescript
// platform-core/src/blob/store.ts (add)
export interface BlobStore {
  putIfAbsent(key: string, body: Buffer): Promise<Result<void, PlatformError>>;
  presignedGet(key: string, expiresSeconds: number): Promise<Result<string, PlatformError>>;
  getJson<T = unknown>(key: string): Promise<Result<T, PlatformError>>;
  getRaw(key: string): Promise<Result<Buffer, PlatformError>>;
}
```

- [ ] **Step 3: Implement on S3BlobStore**

`rntme-cli/packages/platform-storage/src/blob/s3-blob-store.ts` — add `getRaw` that calls the existing S3 `GetObject` and returns the raw bytes (the existing `getJson` likely already fetches bytes then JSON-parses; refactor `getJson` to call `getRaw` internally).

- [ ] **Step 4: Run tests, commit**

```bash
pnpm -F @rntme-cli/platform-storage vitest run test/integration/s3-blob-store-getraw.test.ts
git add rntme-cli/packages/platform-core/src/blob/store.ts \
        rntme-cli/packages/platform-storage/src/blob/s3-blob-store.ts \
        rntme-cli/packages/platform-storage/test/integration/s3-blob-store-getraw.test.ts
git commit -m "feat(platform-core): BlobStore.getRaw for binary bundle reads"
```

---

## Closing checklist

- [ ] All tasks complete with green tests.
- [ ] `pnpm -r run typecheck`, `pnpm -r run test`, `pnpm -r run lint` all pass at repo root.
- [ ] Manual smoke against local dev platform: `rntme init`, then `rntme project publish --create-project`, then visit UI to see the version listed.
- [ ] Commit history is granular (one task = one commit).
- [ ] PR opened referencing this plan and the spec.
