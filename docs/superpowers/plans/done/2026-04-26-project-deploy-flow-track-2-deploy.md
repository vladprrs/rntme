> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# Project Deploy Flow — Track 2 (Deploy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-org deploy targets (encrypted Dokploy credentials), per-project deployment records, an in-process executor that wires `deploy-core.plan → deploy-dokploy.render → deploy-dokploy.apply → SmokeVerifier`, plus the UI/REST surfaces that let an authenticated user click "Deploy" on a project version and watch it complete.

**Architecture:** Approach A from the spec — extend `platform-core` / `platform-storage` / `platform-http`. The executor lives in `platform-http` and runs as an in-process async job (`setImmediate`) per deployment, with heartbeat + orphan-detect. Secret encryption uses AES-256-GCM keyed off `PLATFORM_SECRET_ENCRYPTION_KEY`. UI uses the existing Hono JSX + htmx + Tailwind CDN shell with htmx polling on the deployment-detail page.

**Tech Stack:** TypeScript (NodeNext), Hono + Hono JSX + htmx, Drizzle ORM + Postgres, rustfs blob, `node:crypto` (AES-256-GCM, SHA-256), Vitest + testcontainers-node, `@rntme-cli/deploy-core` + `@rntme-cli/deploy-dokploy` (PR 16), `@rntme/blueprint`.

**Source spec:** `docs/superpowers/specs/done/2026-04-26-project-deploy-flow-design.md`.

**Depends on:** Track 1 (`docs/superpowers/plans/done/2026-04-26-project-deploy-flow-track-1-upload.md`) — `project_version` table, `ProjectVersionRepo`, the upload route, the project-version UI page. Do not start Track 2 until Track 1 is merged into `main`.

**Out of scope for this plan:** Cancellation of in-flight deployments, `agent-browser` UI smoke, per-API-route smoke, multi-target failover, drift detection, automatic rollback. Those are recorded as follow-ups in §4.2 of the spec.

---

## File Structure

### New files

```
rntme-cli/packages/platform-core/src/
├── repos/deploy-target-repo.ts            # DeployTargetRepo interface
├── repos/deployment-repo.ts                # DeploymentRepo interface
├── secret/secret-cipher.ts                 # SecretCipher seam (interface only)
├── schemas/deploy-target.ts                # zod entity + request schemas
├── schemas/deployment.ts                   # zod entity + status enum
├── use-cases/deploy-targets.ts             # CRUD + rotateApiToken + setDefault
└── use-cases/deployments.ts                # startDeployment + listDeployments + getDeployment

rntme-cli/packages/platform-storage/src/
├── repos/pg-deploy-target-repo.ts
├── repos/pg-deployment-repo.ts
├── secret/aes-gcm-cipher.ts                # SecretCipher impl with PLATFORM_SECRET_ENCRYPTION_KEY
└── schema/{deploy-target,deployment,deployment-log-line}.ts   # Drizzle tables

rntme-cli/packages/platform-storage/drizzle/
└── 0003_deploy.sql                         # New tables, enum, RLS

rntme-cli/packages/platform-http/src/
├── deploy/
│   ├── executor.ts                          # runDeployment(id, deps): orchestrates plan → render → apply → verify
│   ├── smoke-verifier.ts                    # SmokeVerifier (HEAD/GET against verificationHints)
│   ├── dokploy-client-factory.ts            # Decrypts apiToken, returns DokployClient closing over it
│   ├── orphan-detect.ts                     # On startup + 60s interval — finalize stale deployments
│   ├── build-deploy-config.ts               # ProjectDeploymentConfig from DeployTarget + overrides
│   └── log-redactor.ts                      # Redact env-style secrets out of error messages
├── routes/deploy-targets.ts                 # POST/GET/PATCH/DELETE org-scoped
├── routes/deployments.ts                    # POST/GET/list/logs project-scoped
├── ui/pages/deploy-targets.tsx              # List + detail/edit
├── ui/pages/deployment.tsx                  # Detail with status polling block
├── ui/pages/deployments-list.tsx            # Project-scoped list
├── ui/fragments/deployment-logs.tsx         # htmx polling fragment
└── ui/fragments/deployment-status.tsx       # htmx polling fragment for the status badge / actions

rntme-cli/packages/platform-http/test/fixtures/
└── mock-dokploy.ts                          # In-memory Hono server simulating Dokploy HTTP API
```

### Files modified

```
rntme-cli/packages/platform-core/src/index.ts                # re-exports
rntme-cli/packages/platform-core/src/auth/scopes.ts          # add deploy:target:manage, deploy:execute
rntme-cli/packages/platform-core/src/schemas/entities.ts     # add to ScopeSchema enum
rntme-cli/packages/platform-storage/src/schema/index.ts      # re-exports
rntme-cli/packages/platform-storage/src/index.ts             # PgDeployTargetRepo, PgDeploymentRepo, AesGcmCipher
rntme-cli/packages/platform-http/src/app.ts                  # mount new routes; init orphan-detect; init secret cipher
rntme-cli/packages/platform-http/src/config/env.ts           # add PLATFORM_SECRET_ENCRYPTION_KEY required env
rntme-cli/packages/platform-http/src/resolve-deps.ts         # add new repos
rntme-cli/packages/platform-http/src/ui/pages/project-version.tsx  # add Deploy button (form trigger)
rntme-cli/packages/platform-http/src/ui/layout.tsx           # sidebar — add "Deploy Targets"
```

---

## Documentation-touch task

Per CLAUDE.md, every plan must include a documentation-touch task. **Task D-D1** covers AGENTS.md, READMEs, CLAUDE.md, and `docs/architecture.md` updates for the deploy track.

---

## Tasks

### Task D-1: Migration — deploy targets, deployments, log lines

**Files:**
- Create: `rntme-cli/packages/platform-storage/src/schema/deploy-target.ts`.
- Create: `rntme-cli/packages/platform-storage/src/schema/deployment.ts`.
- Create: `rntme-cli/packages/platform-storage/src/schema/deployment-log-line.ts`.
- Modify: `rntme-cli/packages/platform-storage/src/schema/index.ts` — add exports.
- Create: `rntme-cli/packages/platform-storage/drizzle/0003_deploy.sql` (after generation).

- [ ] **Step 1: Schema — `deploy_target`**

```typescript
// rntme-cli/packages/platform-storage/src/schema/deploy-target.ts
import { pgTable, uuid, text, timestamp, boolean, smallint, jsonb, customType, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { organization } from './identity.js';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return 'bytea'; },
});

export const deployTarget = pgTable(
  'deploy_target',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    kind: text('kind').notNull(),
    dokployUrl: text('dokploy_url').notNull(),
    dokployProjectId: text('dokploy_project_id'),
    dokployProjectName: text('dokploy_project_name'),
    allowCreateProject: boolean('allow_create_project').notNull().default(false),
    apiTokenCiphertext: bytea('api_token_ciphertext').notNull(),
    apiTokenNonce: bytea('api_token_nonce').notNull(),
    apiTokenKeyVersion: smallint('api_token_key_version').notNull(),
    eventBusConfig: jsonb('event_bus_config').notNull(),
    policyValues: jsonb('policy_values').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUq: unique('deploy_target_org_slug_uq').on(t.orgId, t.slug),
  }),
);
```

- [ ] **Step 2: Schema — `deployment`**

```typescript
// rntme-cli/packages/platform-storage/src/schema/deployment.ts
import { pgTable, uuid, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { organization, account } from './identity.js';
import { project } from './projects.js';
import { projectVersion } from './project-version.js';
import { deployTarget } from './deploy-target.js';

export const deploymentStatus = pgEnum('deployment_status', [
  'queued', 'running', 'succeeded', 'succeeded_with_warnings', 'failed', 'failed_orphaned',
]);

export const deployment = pgTable(
  'deployment',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organization.id),
    projectVersionId: uuid('project_version_id').notNull().references(() => projectVersion.id, { onDelete: 'restrict' }),
    targetId: uuid('target_id').notNull().references(() => deployTarget.id, { onDelete: 'restrict' }),
    status: deploymentStatus('status').notNull().default('queued'),
    configOverrides: jsonb('config_overrides').notNull().default({} as unknown as Record<string, unknown>),
    renderedPlanDigest: text('rendered_plan_digest'),
    applyResult: jsonb('apply_result'),
    verificationReport: jsonb('verification_report'),
    warnings: jsonb('warnings').notNull().default([] as unknown as unknown[]),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    startedByAccountId: uuid('started_by_account_id').notNull().references(() => account.id),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  },
  (t) => ({
    projIdx: index('deployment_project_idx').on(t.projectId, t.queuedAt),
    targetIdx: index('deployment_target_idx').on(t.targetId),
    liveIdx: index('deployment_live_idx').on(t.status, t.lastHeartbeatAt),
  }),
);
```

- [ ] **Step 3: Schema — `deployment_log_line`**

```typescript
// rntme-cli/packages/platform-storage/src/schema/deployment-log-line.ts
import { pgTable, bigserial, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { deployment } from './deployment.js';
import { organization } from './identity.js';

export const deploymentLogLine = pgTable(
  'deployment_log_line',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    deploymentId: uuid('deployment_id').notNull().references(() => deployment.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organization.id),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    level: text('level').notNull(),
    step: text('step').notNull(),
    message: text('message').notNull(),
  },
  (t) => ({ logIdx: index('deployment_log_line_idx').on(t.deploymentId, t.id) }),
);
```

- [ ] **Step 4: Re-export from `schema/index.ts`**

```typescript
// rntme-cli/packages/platform-storage/src/schema/index.ts
export * from './identity.js';
export * from './projects.js';
export * from './project-version.js';
export * from './deploy-target.js';
export * from './deployment.js';
export * from './deployment-log-line.js';
export * from './audit.js';
export * from './tokens.js';
```

- [ ] **Step 5: Generate migration**

```bash
cd rntme-cli/packages/platform-storage
pnpm drizzle-kit generate
```

Rename output to `drizzle/0003_deploy.sql`. Update `drizzle/meta/_journal.json`.

Inspect the SQL: ensure CREATE TYPE for `deployment_status` is before CREATE TABLE, and FK references resolve (deploy_target before deployment before deployment_log_line).

- [ ] **Step 6: Append RLS policies**

Edit `0003_deploy.sql`, append:

```sql
ALTER TABLE "deploy_target" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "deploy_target" USING (org_id = current_setting('rntme.org_id')::uuid);
CREATE POLICY tenant_insert ON "deploy_target" FOR INSERT WITH CHECK (org_id = current_setting('rntme.org_id')::uuid);

ALTER TABLE "deployment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "deployment" USING (org_id = current_setting('rntme.org_id')::uuid);
CREATE POLICY tenant_insert ON "deployment" FOR INSERT WITH CHECK (org_id = current_setting('rntme.org_id')::uuid);

ALTER TABLE "deployment_log_line" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "deployment_log_line" USING (org_id = current_setting('rntme.org_id')::uuid);
CREATE POLICY tenant_insert ON "deployment_log_line" FOR INSERT WITH CHECK (org_id = current_setting('rntme.org_id')::uuid);

-- Partial unique: at most one default target per org
CREATE UNIQUE INDEX one_default_per_org ON "deploy_target" (org_id) WHERE is_default;

-- CHECK constraint enforced at app level via DDL too:
ALTER TABLE "deployment" ADD CONSTRAINT terminal_means_finished CHECK (
  (status IN ('queued', 'running') AND finished_at IS NULL)
  OR
  (status NOT IN ('queued', 'running') AND finished_at IS NOT NULL)
);
```

- [ ] **Step 7: Migration test**

```typescript
// rntme-cli/packages/platform-storage/test/integration/deploy-migration.test.ts
import { describe, it, expect } from 'vitest';
import { startTestPg } from './_setup.js';

describe('migration 0003 deploy', () => {
  it('creates deploy_target / deployment / deployment_log_line + enum', async () => {
    const { pool, end } = await startTestPg();
    try {
      const tables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
      const names = tables.rows.map((r) => r.tablename);
      expect(names).toContain('deploy_target');
      expect(names).toContain('deployment');
      expect(names).toContain('deployment_log_line');

      const types = await pool.query(`SELECT typname FROM pg_type WHERE typname='deployment_status'`);
      expect(types.rows).toHaveLength(1);

      // CHECK constraint exists:
      const checks = await pool.query(
        `SELECT conname FROM pg_constraint WHERE conrelid='deployment'::regclass AND conname='terminal_means_finished'`,
      );
      expect(checks.rows).toHaveLength(1);
    } finally { await end(); }
  });
});
```

```bash
pnpm -F @rntme-cli/platform-storage vitest run test/integration/deploy-migration.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add rntme-cli/packages/platform-storage/src/schema/ \
        rntme-cli/packages/platform-storage/drizzle/ \
        rntme-cli/packages/platform-storage/test/integration/deploy-migration.test.ts
git commit -m "feat(platform-storage): deploy_target / deployment / deployment_log_line tables"
```

---

### Task D-2: SecretCipher — interface + AES-256-GCM impl

**Files:**
- Create: `rntme-cli/packages/platform-core/src/secret/secret-cipher.ts` (interface).
- Create: `rntme-cli/packages/platform-core/test/unit/secret/secret-cipher.test.ts` (typecheck contract).
- Create: `rntme-cli/packages/platform-storage/src/secret/aes-gcm-cipher.ts` (impl).
- Create: `rntme-cli/packages/platform-storage/test/unit/secret/aes-gcm-cipher.test.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts` — re-export.
- Modify: `rntme-cli/packages/platform-storage/src/index.ts` — re-export.

- [ ] **Step 1: Interface**

```typescript
// rntme-cli/packages/platform-core/src/secret/secret-cipher.ts
import type { Result, PlatformError } from '../types/result.js';

export type EncryptedSecret = {
  readonly ciphertext: Buffer;
  readonly nonce: Buffer;
  readonly keyVersion: number;
};

export interface SecretCipher {
  encrypt(plaintext: string): Result<EncryptedSecret, PlatformError>;
  decrypt(secret: EncryptedSecret): Result<string, PlatformError>;
}
```

- [ ] **Step 2: Re-export interface**

Add to `rntme-cli/packages/platform-core/src/index.ts`:

```typescript
export * from './secret/secret-cipher.js';
```

- [ ] **Step 3: Impl test (failing)**

```typescript
// rntme-cli/packages/platform-storage/test/unit/secret/aes-gcm-cipher.test.ts
import { describe, it, expect } from 'vitest';
import { AesGcmCipher } from '../../../src/secret/aes-gcm-cipher.js';

const KEY32 = '0'.repeat(64); // hex(32 bytes of zero) — for tests only

describe('AesGcmCipher', () => {
  const cipher = new AesGcmCipher({ keyHex: KEY32, currentKeyVersion: 1 });

  it('round-trips plaintext', () => {
    const enc = cipher.encrypt('hello-secret');
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = cipher.decrypt(enc.value);
    expect(dec.ok).toBe(true);
    if (dec.ok) expect(dec.value).toBe('hello-secret');
  });

  it('rejects tampered ciphertext', () => {
    const enc = cipher.encrypt('hello-secret');
    if (!enc.ok) throw new Error('setup');
    const tampered = { ...enc.value, ciphertext: Buffer.concat([enc.value.ciphertext.slice(0, -1), Buffer.from([0xff])]) };
    const dec = cipher.decrypt(tampered);
    expect(dec.ok).toBe(false);
  });

  it('rejects unknown key version', () => {
    const enc = cipher.encrypt('s');
    if (!enc.ok) throw new Error('setup');
    const dec = cipher.decrypt({ ...enc.value, keyVersion: 99 });
    expect(dec.ok).toBe(false);
    if (!dec.ok) expect(dec.errors[0].code).toBe('PLATFORM_SECRET_UNKNOWN_KEY_VERSION');
  });

  it('rejects bad key length on construction', () => {
    expect(() => new AesGcmCipher({ keyHex: 'abcd', currentKeyVersion: 1 })).toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm -F @rntme-cli/platform-storage vitest run test/unit/secret/aes-gcm-cipher.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 5: Implementation**

```typescript
// rntme-cli/packages/platform-storage/src/secret/aes-gcm-cipher.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  ok, err,
  type SecretCipher, type EncryptedSecret,
  type Result, type PlatformError,
} from '@rntme-cli/platform-core';

export type AesGcmCipherOptions = {
  /** Hex-encoded 32-byte key, current. */
  readonly keyHex: string;
  readonly currentKeyVersion: number;
  /** Optional historical keys for decrypt during rotation. */
  readonly historicalKeys?: ReadonlyMap<number, string>;
};

export class AesGcmCipher implements SecretCipher {
  private readonly currentKey: Buffer;
  private readonly currentKeyVersion: number;
  private readonly keysByVersion: Map<number, Buffer>;

  constructor(opts: AesGcmCipherOptions) {
    if (!/^[0-9a-f]{64}$/i.test(opts.keyHex)) {
      throw new Error('AesGcmCipher: keyHex must be a 64-char hex string (32 bytes)');
    }
    this.currentKey = Buffer.from(opts.keyHex, 'hex');
    this.currentKeyVersion = opts.currentKeyVersion;
    this.keysByVersion = new Map([[opts.currentKeyVersion, this.currentKey]]);
    if (opts.historicalKeys) {
      for (const [v, hex] of opts.historicalKeys) {
        if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(`AesGcmCipher: historical keyHex v${v} invalid`);
        this.keysByVersion.set(v, Buffer.from(hex, 'hex'));
      }
    }
  }

  encrypt(plaintext: string): Result<EncryptedSecret, PlatformError> {
    try {
      const nonce = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', this.currentKey, nonce);
      const enc = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
      const tag = c.getAuthTag();
      return ok({
        ciphertext: Buffer.concat([enc, tag]),
        nonce,
        keyVersion: this.currentKeyVersion,
      });
    } catch (cause) {
      return err([{ code: 'PLATFORM_SECRET_ENCRYPT_FAILED', message: String(cause), cause }]);
    }
  }

  decrypt(secret: EncryptedSecret): Result<string, PlatformError> {
    const key = this.keysByVersion.get(secret.keyVersion);
    if (!key) return err([{ code: 'PLATFORM_SECRET_UNKNOWN_KEY_VERSION', message: `v${secret.keyVersion}` }]);
    try {
      const tag = secret.ciphertext.slice(secret.ciphertext.length - 16);
      const enc = secret.ciphertext.slice(0, secret.ciphertext.length - 16);
      const d = createDecipheriv('aes-256-gcm', key, secret.nonce);
      d.setAuthTag(tag);
      const out = Buffer.concat([d.update(enc), d.final()]);
      return ok(out.toString('utf8'));
    } catch (cause) {
      return err([{ code: 'PLATFORM_SECRET_DECRYPT_FAILED', message: String(cause), cause }]);
    }
  }
}
```

- [ ] **Step 6: Re-export impl**

```typescript
// rntme-cli/packages/platform-storage/src/index.ts
export { AesGcmCipher, type AesGcmCipherOptions } from './secret/aes-gcm-cipher.js';
```

- [ ] **Step 7: Run tests**

```bash
pnpm -F @rntme-cli/platform-storage vitest run test/unit/secret/
```

Expected: PASS (4/4).

- [ ] **Step 8: Commit**

```bash
git add rntme-cli/packages/platform-core/src/secret/ \
        rntme-cli/packages/platform-storage/src/secret/ \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-storage/src/index.ts \
        rntme-cli/packages/platform-storage/test/unit/secret/aes-gcm-cipher.test.ts
git commit -m "feat: SecretCipher interface + AES-256-GCM impl with key versioning"
```

---

### Task D-3: Add new scopes

**Files:**
- Modify: `rntme-cli/packages/platform-core/src/schemas/entities.ts` — extend `ScopeSchema` enum.
- Modify: `rntme-cli/packages/platform-core/src/auth/scopes.ts` — extend role grants.

- [ ] **Step 1: Write failing test**

```typescript
// rntme-cli/packages/platform-core/test/unit/auth/scopes.test.ts
import { describe, it, expect } from 'vitest';
import { scopesForRole } from '../../../src/auth/scopes.js';

describe('scopesForRole', () => {
  it('grants admin deploy:target:manage and deploy:execute', () => {
    const s = scopesForRole('admin');
    expect(s).toContain('deploy:target:manage');
    expect(s).toContain('deploy:execute');
  });
  it('grants member deploy:execute but NOT deploy:target:manage', () => {
    const s = scopesForRole('member');
    expect(s).toContain('deploy:execute');
    expect(s).not.toContain('deploy:target:manage');
  });
});
```

```bash
pnpm -F @rntme-cli/platform-core vitest run test/unit/auth/scopes.test.ts
```

Expected: FAIL — `deploy:target:manage` not in enum.

- [ ] **Step 2: Add to ScopeSchema**

```typescript
// rntme-cli/packages/platform-core/src/schemas/entities.ts (modify ScopeSchema)
export const ScopeSchema = z.enum([
  'project:read',
  'project:write',
  'version:publish',
  'member:read',
  'token:manage',
  'deploy:target:manage',
  'deploy:execute',
]);
```

- [ ] **Step 3: Update role grants**

```typescript
// rntme-cli/packages/platform-core/src/auth/scopes.ts
const ROLE_SCOPES: Record<Role, readonly Scope[]> = {
  admin: [
    'project:read', 'project:write', 'version:publish',
    'member:read', 'token:manage',
    'deploy:target:manage', 'deploy:execute',
  ],
  member: [
    'project:read', 'project:write', 'version:publish',
    'deploy:execute',
  ],
};
```

- [ ] **Step 4: Run tests**

```bash
pnpm -F @rntme-cli/platform-core test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/platform-core/src/schemas/entities.ts \
        rntme-cli/packages/platform-core/src/auth/scopes.ts \
        rntme-cli/packages/platform-core/test/unit/auth/scopes.test.ts
git commit -m "feat(platform-core): add deploy:target:manage and deploy:execute scopes"
```

---

### Task D-4: Zod schemas for DeployTarget + Deployment

**Files:**
- Create: `rntme-cli/packages/platform-core/src/schemas/deploy-target.ts`.
- Create: `rntme-cli/packages/platform-core/src/schemas/deployment.ts`.
- Create: `rntme-cli/packages/platform-core/test/unit/schemas/deploy-target.test.ts` and `deployment.test.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts`.

- [ ] **Step 1: Write failing tests**

```typescript
// rntme-cli/packages/platform-core/test/unit/schemas/deploy-target.test.ts
import { describe, it, expect } from 'vitest';
import {
  DeployTargetSchema,
  CreateDeployTargetRequestSchema,
  UpdateDeployTargetRequestSchema,
  RotateApiTokenRequestSchema,
} from '../../../src/schemas/deploy-target.js';

describe('CreateDeployTargetRequestSchema', () => {
  it('accepts a well-formed payload', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-staging',
      displayName: 'Staging',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing apiToken', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'x', displayName: 'X', kind: 'dokploy',
      dokployUrl: 'https://x', eventBus: { kind: 'kafka', brokers: [] }, policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(false);
  });

  it('forbids apiToken in update payload', () => {
    const r = UpdateDeployTargetRequestSchema.safeParse({ apiToken: 'leak' });
    expect(r.success).toBe(false);
  });

  it('requires apiToken in rotate payload', () => {
    const r = RotateApiTokenRequestSchema.safeParse({});
    expect(r.success).toBe(false);
    const r2 = RotateApiTokenRequestSchema.safeParse({ apiToken: 'dkp_new' });
    expect(r2.success).toBe(true);
  });
});
```

```typescript
// rntme-cli/packages/platform-core/test/unit/schemas/deployment.test.ts
import { describe, it, expect } from 'vitest';
import { DeploymentStatusSchema, StartDeploymentRequestSchema } from '../../../src/schemas/deployment.js';

describe('DeploymentStatus', () => {
  it('accepts canonical statuses', () => {
    for (const s of ['queued', 'running', 'succeeded', 'succeeded_with_warnings', 'failed', 'failed_orphaned']) {
      expect(DeploymentStatusSchema.safeParse(s).success).toBe(true);
    }
  });
  it('rejects unknown', () => {
    expect(DeploymentStatusSchema.safeParse('cancelled').success).toBe(false);
  });
});

describe('StartDeploymentRequest', () => {
  it('accepts minimal body (only projectVersionSeq)', () => {
    expect(StartDeploymentRequestSchema.safeParse({ projectVersionSeq: 1 }).success).toBe(true);
  });
  it('accepts overrides', () => {
    expect(
      StartDeploymentRequestSchema.safeParse({
        projectVersionSeq: 1,
        targetSlug: 'dokploy-staging',
        configOverrides: { integrationModuleImages: { 'mod-x': 'r/mod-x:1' } },
      }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm -F @rntme-cli/platform-core vitest run test/unit/schemas/deploy-target.test.ts test/unit/schemas/deployment.test.ts
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement schemas**

```typescript
// rntme-cli/packages/platform-core/src/schemas/deploy-target.ts
import { z } from 'zod';
import { SlugSchema, UuidSchema } from './primitives.js';

const KafkaSecurity = z
  .object({
    protocol: z.enum(['plaintext', 'sasl_ssl']),
    secretRefs: z.record(z.string(), z.string()).optional(),
  })
  .optional();

export const EventBusConfigSchema = z.object({
  kind: z.literal('kafka'),
  mode: z.enum(['external']).optional(),
  brokers: z.array(z.string().min(1)),
  topicPrefix: z.string().optional(),
  security: KafkaSecurity,
});
export type EventBusConfig = z.infer<typeof EventBusConfigSchema>;

export const PolicyValuesSchema = z.record(z.string(), z.record(z.string(), z.unknown())).default({});
export type PolicyValues = z.infer<typeof PolicyValuesSchema>;

export const DeployTargetKind = z.enum(['dokploy']);

export const CreateDeployTargetRequestSchema = z
  .object({
    slug: SlugSchema,
    displayName: z.string().min(1).max(120),
    kind: DeployTargetKind,
    dokployUrl: z.string().url(),
    dokployProjectId: z.string().min(1).optional(),
    dokployProjectName: z.string().min(1).optional(),
    allowCreateProject: z.boolean().default(false),
    apiToken: z.string().min(1),
    eventBus: EventBusConfigSchema,
    policyValues: PolicyValuesSchema,
    isDefault: z.boolean().default(false),
  })
  .refine(
    (v) => Boolean(v.dokployProjectId) || (Boolean(v.dokployProjectName) && v.allowCreateProject),
    { message: 'either dokployProjectId or (dokployProjectName + allowCreateProject) is required' },
  );
export type CreateDeployTargetRequest = z.infer<typeof CreateDeployTargetRequestSchema>;

export const UpdateDeployTargetRequestSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  dokployUrl: z.string().url().optional(),
  dokployProjectId: z.string().min(1).nullable().optional(),
  dokployProjectName: z.string().min(1).nullable().optional(),
  allowCreateProject: z.boolean().optional(),
  eventBus: EventBusConfigSchema.optional(),
  policyValues: PolicyValuesSchema.optional(),
}).strict(); // strict() forbids unexpected `apiToken` field

export const RotateApiTokenRequestSchema = z.object({ apiToken: z.string().min(1) });

export const DeployTargetSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  slug: SlugSchema,
  displayName: z.string(),
  kind: DeployTargetKind,
  dokployUrl: z.string(),
  dokployProjectId: z.string().nullable(),
  dokployProjectName: z.string().nullable(),
  allowCreateProject: z.boolean(),
  // ciphertext + nonce + keyVersion are NEVER exposed via API; only the redacted shape:
  apiTokenRedacted: z.literal('***'),
  eventBus: EventBusConfigSchema,
  policyValues: PolicyValuesSchema,
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DeployTarget = z.infer<typeof DeployTargetSchema>;

// Internal full-row shape used inside the executor:
export type DeployTargetWithSecret = Omit<DeployTarget, 'apiTokenRedacted'> & {
  apiTokenCiphertext: Buffer;
  apiTokenNonce: Buffer;
  apiTokenKeyVersion: number;
};
```

```typescript
// rntme-cli/packages/platform-core/src/schemas/deployment.ts
import { z } from 'zod';
import { UuidSchema } from './primitives.js';

export const DeploymentStatusSchema = z.enum([
  'queued', 'running', 'succeeded', 'succeeded_with_warnings', 'failed', 'failed_orphaned',
]);
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;

export const VerificationCheckSchema = z.object({
  name: z.string(),
  url: z.string(),
  status: z.union([z.number().int(), z.literal('timeout'), z.literal('error')]),
  latencyMs: z.number().int().nonnegative(),
  ok: z.boolean(),
  note: z.string().optional(),
});

export const VerificationReportSchema = z.object({
  checks: z.array(VerificationCheckSchema),
  ok: z.boolean(),
  partialOk: z.boolean(),
});
export type VerificationReport = z.infer<typeof VerificationReportSchema>;

export const StartDeploymentRequestSchema = z.object({
  projectVersionSeq: z.number().int().positive(),
  targetSlug: z.string().min(1).optional(),
  configOverrides: z.object({
    integrationModuleImages: z.record(z.string(), z.string()).optional(),
    policyOverrides: z.record(z.string(), z.unknown()).optional(),
  }).default({}),
});
export type StartDeploymentRequest = z.infer<typeof StartDeploymentRequestSchema>;

export const DeploymentSchema = z.object({
  id: UuidSchema,
  projectId: UuidSchema,
  orgId: UuidSchema,
  projectVersionId: UuidSchema,
  targetId: UuidSchema,
  status: DeploymentStatusSchema,
  configOverrides: z.record(z.string(), z.unknown()),
  renderedPlanDigest: z.string().nullable(),
  applyResult: z.record(z.string(), z.unknown()).nullable(),
  verificationReport: VerificationReportSchema.nullable(),
  warnings: z.array(z.unknown()),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedByAccountId: UuidSchema,
  queuedAt: z.date(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  lastHeartbeatAt: z.date().nullable(),
});
export type Deployment = z.infer<typeof DeploymentSchema>;

export const DeploymentLogLineSchema = z.object({
  id: z.number().int().nonnegative(),
  deploymentId: UuidSchema,
  ts: z.date(),
  level: z.enum(['info', 'warn', 'error']),
  step: z.string(),
  message: z.string(),
});
export type DeploymentLogLine = z.infer<typeof DeploymentLogLineSchema>;
```

- [ ] **Step 4: Re-export**

Add to `rntme-cli/packages/platform-core/src/index.ts`:

```typescript
export * from './schemas/deploy-target.js';
export * from './schemas/deployment.js';
```

- [ ] **Step 5: Run tests**

```bash
pnpm -F @rntme-cli/platform-core test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-core/src/schemas/deploy-target.ts \
        rntme-cli/packages/platform-core/src/schemas/deployment.ts \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-core/test/unit/schemas/
git commit -m "feat(platform-core): DeployTarget + Deployment zod schemas"
```

---

### Task D-5: Repo interfaces — `DeployTargetRepo`, `DeploymentRepo`

**Files:**
- Create: `rntme-cli/packages/platform-core/src/repos/deploy-target-repo.ts`.
- Create: `rntme-cli/packages/platform-core/src/repos/deployment-repo.ts`.
- Create: `rntme-cli/packages/platform-core/test/unit/repos/deploy-target-repo.test.ts`.
- Create: `rntme-cli/packages/platform-core/test/unit/repos/deployment-repo.test.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts`.

- [ ] **Step 1: Write the failing typecheck-style tests**

(Mirror Task U-3 — `expectTypeOf` assertions for each method signature.)

- [ ] **Step 2: Implement `DeployTargetRepo`**

```typescript
// rntme-cli/packages/platform-core/src/repos/deploy-target-repo.ts
import type { DeployTarget, DeployTargetWithSecret, EventBusConfig, PolicyValues } from '../schemas/deploy-target.js';
import type { Result, PlatformError } from '../types/result.js';

export type DeployTargetInsertRow = {
  readonly id: string;
  readonly orgId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly kind: 'dokploy';
  readonly dokployUrl: string;
  readonly dokployProjectId: string | null;
  readonly dokployProjectName: string | null;
  readonly allowCreateProject: boolean;
  readonly apiTokenCiphertext: Buffer;
  readonly apiTokenNonce: Buffer;
  readonly apiTokenKeyVersion: number;
  readonly eventBusConfig: EventBusConfig;
  readonly policyValues: PolicyValues;
  readonly isDefault: boolean;
};

export type DeployTargetUpdateRow = {
  readonly displayName?: string;
  readonly dokployUrl?: string;
  readonly dokployProjectId?: string | null;
  readonly dokployProjectName?: string | null;
  readonly allowCreateProject?: boolean;
  readonly eventBusConfig?: EventBusConfig;
  readonly policyValues?: PolicyValues;
};

export interface DeployTargetRepo {
  create(args: { row: DeployTargetInsertRow; auditActorAccountId: string; auditActorTokenId: string | null }): Promise<Result<DeployTarget, PlatformError>>;
  update(args: { orgId: string; slug: string; patch: DeployTargetUpdateRow; auditActorAccountId: string; auditActorTokenId: string | null }): Promise<Result<DeployTarget, PlatformError>>;
  rotateApiToken(args: { orgId: string; slug: string; ciphertext: Buffer; nonce: Buffer; keyVersion: number; auditActorAccountId: string; auditActorTokenId: string | null }): Promise<Result<DeployTarget, PlatformError>>;
  setDefault(args: { orgId: string; slug: string; auditActorAccountId: string; auditActorTokenId: string | null }): Promise<Result<DeployTarget, PlatformError>>;
  delete(args: { orgId: string; slug: string; auditActorAccountId: string; auditActorTokenId: string | null }): Promise<Result<void, PlatformError>>;
  list(orgId: string): Promise<Result<readonly DeployTarget[], PlatformError>>;
  getBySlug(orgId: string, slug: string): Promise<Result<DeployTarget | null, PlatformError>>;
  getDefault(orgId: string): Promise<Result<DeployTarget | null, PlatformError>>;
  /** ONLY called by the executor — full row including secret fields, RLS-scoped. */
  getWithSecretById(id: string): Promise<Result<DeployTargetWithSecret | null, PlatformError>>;
}
```

- [ ] **Step 3: Implement `DeploymentRepo`**

```typescript
// rntme-cli/packages/platform-core/src/repos/deployment-repo.ts
import type { Deployment, DeploymentStatus, DeploymentLogLine, VerificationReport } from '../schemas/deployment.js';
import type { Result, PlatformError } from '../types/result.js';

export type DeploymentInsertRow = {
  readonly id: string;
  readonly projectId: string;
  readonly orgId: string;
  readonly projectVersionId: string;
  readonly targetId: string;
  readonly configOverrides: Record<string, unknown>;
  readonly startedByAccountId: string;
};

export type DeploymentFinalize = {
  readonly status: Exclude<DeploymentStatus, 'queued' | 'running'>;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly applyResult?: Record<string, unknown>;
  readonly verificationReport?: VerificationReport;
  readonly warnings?: unknown[];
};

export interface DeploymentRepo {
  create(args: { row: DeploymentInsertRow; auditActorAccountId: string; auditActorTokenId: string | null }): Promise<Result<Deployment, PlatformError>>;
  getById(id: string): Promise<Result<Deployment | null, PlatformError>>;
  listByProject(projectId: string, opts: { status?: DeploymentStatus[]; limit: number; cursor?: Date }): Promise<Result<readonly Deployment[], PlatformError>>;
  transition(id: string, status: 'running', side: { startedAt: Date }): Promise<Result<void, PlatformError>>;
  setRenderedDigest(id: string, digest: string): Promise<Result<void, PlatformError>>;
  setApplyResult(id: string, applyResult: Record<string, unknown>): Promise<Result<void, PlatformError>>;
  finalize(id: string, args: DeploymentFinalize): Promise<Result<void, PlatformError>>;
  touchHeartbeat(id: string): Promise<Result<void, PlatformError>>;
  appendLog(args: { deploymentId: string; orgId: string; level: 'info' | 'warn' | 'error'; step: string; message: string }): Promise<Result<void, PlatformError>>;
  readLogs(args: { deploymentId: string; sinceLineId: number; limit: number }): Promise<Result<{ lines: readonly DeploymentLogLine[]; lastLineId: number }, PlatformError>>;
  findStaleRunning(staleAfterSeconds: number): Promise<Result<readonly { id: string; orgId: string }[], PlatformError>>;
}
```

- [ ] **Step 4: Re-export**

Add to `rntme-cli/packages/platform-core/src/index.ts`:

```typescript
export * from './repos/deploy-target-repo.js';
export * from './repos/deployment-repo.js';
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm -F @rntme-cli/platform-core typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-core/src/repos/deploy-target-repo.ts \
        rntme-cli/packages/platform-core/src/repos/deployment-repo.ts \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-core/test/unit/repos/
git commit -m "feat(platform-core): DeployTargetRepo + DeploymentRepo interfaces"
```

---

### Task D-6: `PgDeployTargetRepo`

**Files:**
- Create: `rntme-cli/packages/platform-storage/src/repos/pg-deploy-target-repo.ts`.
- Create: `rntme-cli/packages/platform-storage/test/integration/pg-deploy-target-repo.test.ts`.
- Modify: `rntme-cli/packages/platform-storage/src/index.ts`.

Mirror the existing `pg-project-version-repo.ts` style. Audit each create/update/rotate/setDefault/delete via `audit_log` table.

- [ ] **Step 1: Write failing integration tests** (testcontainers PG; cover: create + getBySlug, update without apiToken, rotateApiToken increments version, setDefault atomic swap, delete-when-no-deployments OK, delete-with-active-deployment fails with `DEPLOY_TARGET_IN_USE`)

- [ ] **Step 2: Implement repo**

Key methods:

```typescript
async create(args) {
  // 1. Insert.
  // 2. If args.row.isDefault === true → this.unsetOtherDefaults(args.row.orgId) inside the same tx.
  // 3. Audit row 'deploy_target.created'.
  // 4. Return rowToTarget(inserted) — with apiTokenRedacted: '***'.
}

async setDefault(args) {
  // 1. SELECT FOR UPDATE the row by (orgId, slug). 404 if missing.
  // 2. UPDATE deploy_target SET is_default = false WHERE org_id = $1 AND id <> $2;
  // 3. UPDATE deploy_target SET is_default = true WHERE id = $2;
  // 4. Audit 'deploy_target.set_default'.
}

async delete(args) {
  // 1. SELECT id FROM deploy_target WHERE org_id=$1 AND slug=$2.
  // 2. SELECT count(*) FROM deployment WHERE target_id=$id AND status IN ('queued','running').
  //    If > 0 → return err with code DEPLOY_TARGET_IN_USE.
  // 3. DELETE FROM deploy_target WHERE id=$id.
  // 4. Audit 'deploy_target.deleted'.
}

async rotateApiToken(args) {
  // 1. UPDATE deploy_target SET api_token_ciphertext=$, api_token_nonce=$, api_token_key_version=$ WHERE org_id=$, slug=$ RETURNING *.
  // 2. Audit 'deploy_target.api_token_rotated'.
}

async getWithSecretById(id) {
  // SELECT *, api_token_ciphertext, api_token_nonce, api_token_key_version
  //   FROM deploy_target WHERE id=$1 LIMIT 1.
  // Map to DeployTargetWithSecret (no redaction).
}
```

For `rowToTarget(row)` (the redacting mapper):

```typescript
function rowToTarget(r: Record<string, unknown>): DeployTarget {
  return {
    id: r['id'] as string,
    orgId: r['org_id'] as string,
    slug: r['slug'] as string,
    displayName: r['display_name'] as string,
    kind: r['kind'] as 'dokploy',
    dokployUrl: r['dokploy_url'] as string,
    dokployProjectId: (r['dokploy_project_id'] ?? null) as string | null,
    dokployProjectName: (r['dokploy_project_name'] ?? null) as string | null,
    allowCreateProject: r['allow_create_project'] as boolean,
    apiTokenRedacted: '***' as const,
    eventBus: r['event_bus_config'] as EventBusConfig,
    policyValues: r['policy_values'] as PolicyValues,
    isDefault: r['is_default'] as boolean,
    createdAt: r['created_at'] as Date,
    updatedAt: r['updated_at'] as Date,
  };
}
```

- [ ] **Step 3: Re-export**

```typescript
// platform-storage/src/index.ts (add)
export { PgDeployTargetRepo } from './repos/pg-deploy-target-repo.js';
```

- [ ] **Step 4: Run tests**

```bash
pnpm -F @rntme-cli/platform-storage vitest run test/integration/pg-deploy-target-repo.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/platform-storage/src/repos/pg-deploy-target-repo.ts \
        rntme-cli/packages/platform-storage/src/index.ts \
        rntme-cli/packages/platform-storage/test/integration/pg-deploy-target-repo.test.ts
git commit -m "feat(platform-storage): PgDeployTargetRepo with redacting reads + audit rows"
```

---

### Task D-7: `PgDeploymentRepo`

**Files:**
- Create: `rntme-cli/packages/platform-storage/src/repos/pg-deployment-repo.ts`.
- Create: `rntme-cli/packages/platform-storage/test/integration/pg-deployment-repo.test.ts`.
- Modify: `rntme-cli/packages/platform-storage/src/index.ts`.

Pattern as in D-6. Notable methods:

- `transition(id, 'running', { startedAt })` — `UPDATE deployment SET status='running', started_at=$2, last_heartbeat_at=$2 WHERE id=$1 AND status='queued'`. If no row updated → return error `DEPLOYMENT_INVALID_TRANSITION`.
- `finalize(id, args)` — `UPDATE deployment SET status=$, finished_at=now(), error_code=$, error_message=$, apply_result=$, verification_report=$, warnings=$ WHERE id=$1 AND status NOT IN ('succeeded','succeeded_with_warnings','failed','failed_orphaned')`.
- `appendLog` — INSERT INTO deployment_log_line. Cap message length at 8 KiB; if longer, truncate + append `… (truncated)`.
- `readLogs({ sinceLineId, limit })` — `SELECT * FROM deployment_log_line WHERE deployment_id=$1 AND id > $2 ORDER BY id ASC LIMIT $3`. Return `lastLineId = max(lines.id) ?? sinceLineId`.
- `findStaleRunning(staleAfterSeconds)` — pool-scoped (NOT inside an org-scoped tx — it's a system loop). Returns `[{ id, orgId }]` for caller to finalize them inside per-org tx. Implementation uses a separate tx that sets `SET LOCAL ROLE rntme_admin` (if your RLS policy uses a special role; otherwise `SET LOCAL row_security = off`). Document the assumption in code comments.

- [ ] **Step 1-5: TDD as before. Tests cover:**
  - create + getById round-trip;
  - transition queued → running (success + no-op when already running);
  - finalize success;
  - finalize idempotent (already-final row doesn't change);
  - touchHeartbeat updates timestamp;
  - findStaleRunning returns rows with NULL or old heartbeat;
  - readLogs incremental cursor.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-storage/src/repos/pg-deployment-repo.ts \
        rntme-cli/packages/platform-storage/src/index.ts \
        rntme-cli/packages/platform-storage/test/integration/pg-deployment-repo.test.ts
git commit -m "feat(platform-storage): PgDeploymentRepo with lifecycle, heartbeat, log lines"
```

---

### Task D-8: Use-case — `manage-deploy-target`

**Files:**
- Create: `rntme-cli/packages/platform-core/src/use-cases/deploy-targets.ts`.
- Create: `rntme-cli/packages/platform-core/test/unit/use-cases/deploy-targets.test.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts`.

The use-case wraps the repo with cipher + ids + validation. Plain CRUD; the only logic worth a use-case (vs straight repo call from the route) is the encrypt-on-create / encrypt-on-rotate flow (the route shouldn't see plaintext after the use-case returns).

- [ ] **Step 1: Write failing tests** with fakes that:
  - encrypt happy path (cipher called once, repo called with ciphertext + nonce + version);
  - encrypt failure → use-case returns error before touching repo;
  - duplicate slug → repo returns `DEPLOY_TARGET_SLUG_TAKEN` → use-case propagates;
  - rotateApiToken: cipher, then repo;
  - setDefault: passthrough;
  - delete: passthrough.

- [ ] **Step 2-5: Implement**

```typescript
// rntme-cli/packages/platform-core/src/use-cases/deploy-targets.ts
import { isOk, ok, type Result, type PlatformError } from '../types/result.js';
import type { Ids } from '../ids.js';
import type { SecretCipher } from '../secret/secret-cipher.js';
import type { DeployTargetRepo } from '../repos/deploy-target-repo.js';
import type {
  CreateDeployTargetRequest,
  DeployTarget,
  RotateApiTokenRequest,
  UpdateDeployTargetRequest,
} from '../schemas/deploy-target.js';

type Deps = {
  repos: { deployTargets: DeployTargetRepo };
  cipher: SecretCipher;
  ids: Ids;
};

export async function createDeployTarget(
  deps: Deps,
  input: { orgId: string; accountId: string; tokenId: string | null; req: CreateDeployTargetRequest },
): Promise<Result<DeployTarget, PlatformError>> {
  const enc = deps.cipher.encrypt(input.req.apiToken);
  if (!isOk(enc)) return enc;
  return deps.repos.deployTargets.create({
    row: {
      id: deps.ids.uuid(),
      orgId: input.orgId,
      slug: input.req.slug,
      displayName: input.req.displayName,
      kind: input.req.kind,
      dokployUrl: input.req.dokployUrl,
      dokployProjectId: input.req.dokployProjectId ?? null,
      dokployProjectName: input.req.dokployProjectName ?? null,
      allowCreateProject: input.req.allowCreateProject,
      apiTokenCiphertext: enc.value.ciphertext,
      apiTokenNonce: enc.value.nonce,
      apiTokenKeyVersion: enc.value.keyVersion,
      eventBusConfig: input.req.eventBus,
      policyValues: input.req.policyValues,
      isDefault: input.req.isDefault,
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
}

export async function updateDeployTarget(
  deps: Deps,
  input: { orgId: string; slug: string; accountId: string; tokenId: string | null; patch: UpdateDeployTargetRequest },
): Promise<Result<DeployTarget, PlatformError>> {
  return deps.repos.deployTargets.update({
    orgId: input.orgId,
    slug: input.slug,
    patch: {
      displayName: input.patch.displayName,
      dokployUrl: input.patch.dokployUrl,
      dokployProjectId: input.patch.dokployProjectId,
      dokployProjectName: input.patch.dokployProjectName,
      allowCreateProject: input.patch.allowCreateProject,
      eventBusConfig: input.patch.eventBus,
      policyValues: input.patch.policyValues,
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
}

export async function rotateDeployTargetApiToken(
  deps: Deps,
  input: { orgId: string; slug: string; accountId: string; tokenId: string | null; req: RotateApiTokenRequest },
): Promise<Result<DeployTarget, PlatformError>> {
  const enc = deps.cipher.encrypt(input.req.apiToken);
  if (!isOk(enc)) return enc;
  return deps.repos.deployTargets.rotateApiToken({
    orgId: input.orgId,
    slug: input.slug,
    ciphertext: enc.value.ciphertext,
    nonce: enc.value.nonce,
    keyVersion: enc.value.keyVersion,
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
}

export async function setDefaultDeployTarget(deps: Pick<Deps, 'repos'>, input: { orgId: string; slug: string; accountId: string; tokenId: string | null }) {
  return deps.repos.deployTargets.setDefault({
    orgId: input.orgId, slug: input.slug,
    auditActorAccountId: input.accountId, auditActorTokenId: input.tokenId,
  });
}

export async function deleteDeployTarget(deps: Pick<Deps, 'repos'>, input: { orgId: string; slug: string; accountId: string; tokenId: string | null }) {
  return deps.repos.deployTargets.delete({
    orgId: input.orgId, slug: input.slug,
    auditActorAccountId: input.accountId, auditActorTokenId: input.tokenId,
  });
}

export async function listDeployTargets(deps: Pick<Deps, 'repos'>, input: { orgId: string }) {
  return deps.repos.deployTargets.list(input.orgId);
}

export async function getDeployTarget(deps: Pick<Deps, 'repos'>, input: { orgId: string; slug: string }) {
  return deps.repos.deployTargets.getBySlug(input.orgId, input.slug);
}
```

- [ ] **Step 6: Re-export, run tests, commit**

```bash
git add rntme-cli/packages/platform-core/src/use-cases/deploy-targets.ts \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-core/test/unit/use-cases/deploy-targets.test.ts
git commit -m "feat(platform-core): manage-deploy-target use-cases with cipher integration"
```

---

### Task D-9: Use-case — `start-deployment`

**Files:**
- Create: `rntme-cli/packages/platform-core/src/use-cases/deployments.ts`.
- Create: `rntme-cli/packages/platform-core/test/unit/use-cases/deployments.test.ts`.
- Modify: `rntme-cli/packages/platform-core/src/index.ts`.

The use-case validates deployment input and inserts the queued row. Scheduling the executor is the route's concern (the use-case is sync).

- [ ] **Step 1: Write failing tests** covering:
  - happy path (insert);
  - missing default target → `DEPLOY_REQUEST_TARGET_NOT_SPECIFIED`;
  - target slug not in org → `DEPLOY_REQUEST_TARGET_NOT_FOUND`;
  - version seq not in project → `DEPLOY_REQUEST_VERSION_NOT_FOUND`;
  - target belongs to different org → `DEPLOY_REQUEST_TARGET_NOT_FOUND`.

- [ ] **Step 2-5: Implement**

```typescript
// rntme-cli/packages/platform-core/src/use-cases/deployments.ts
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { Ids } from '../ids.js';
import type { ProjectVersionRepo } from '../repos/project-version-repo.js';
import type { DeployTargetRepo } from '../repos/deploy-target-repo.js';
import type { DeploymentRepo } from '../repos/deployment-repo.js';
import type { Deployment, DeploymentStatus, StartDeploymentRequest } from '../schemas/deployment.js';

type Deps = {
  repos: {
    projectVersions: ProjectVersionRepo;
    deployTargets: DeployTargetRepo;
    deployments: DeploymentRepo;
  };
  ids: Ids;
};

export type StartDeploymentInput = {
  orgId: string;
  projectId: string;
  accountId: string;
  tokenId: string | null;
  req: StartDeploymentRequest;
};

export async function startDeployment(
  deps: Deps,
  input: StartDeploymentInput,
): Promise<Result<Deployment, PlatformError>> {
  // 1. Resolve version.
  const version = await deps.repos.projectVersions.getBySeq(input.projectId, input.req.projectVersionSeq);
  if (!isOk(version)) return version;
  if (!version.value) return err([{ code: 'DEPLOY_REQUEST_VERSION_NOT_FOUND', message: `seq=${input.req.projectVersionSeq}` }]);

  // 2. Resolve target.
  const target = input.req.targetSlug !== undefined
    ? await deps.repos.deployTargets.getBySlug(input.orgId, input.req.targetSlug)
    : await deps.repos.deployTargets.getDefault(input.orgId);
  if (!isOk(target)) return target;
  if (!target.value) {
    return err([{
      code: input.req.targetSlug !== undefined ? 'DEPLOY_REQUEST_TARGET_NOT_FOUND' : 'DEPLOY_REQUEST_TARGET_NOT_SPECIFIED',
      message: input.req.targetSlug ?? 'no default target in org',
    }]);
  }

  // 3. Insert.
  return deps.repos.deployments.create({
    row: {
      id: deps.ids.uuid(),
      projectId: input.projectId,
      orgId: input.orgId,
      projectVersionId: version.value.id,
      targetId: target.value.id,
      configOverrides: input.req.configOverrides,
      startedByAccountId: input.accountId,
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
}

export async function listDeployments(
  deps: { repos: { deployments: DeploymentRepo } },
  input: { projectId: string; status?: DeploymentStatus[]; limit: number; cursor?: Date },
) {
  return deps.repos.deployments.listByProject(input.projectId, input);
}

export async function getDeployment(
  deps: { repos: { deployments: DeploymentRepo } },
  input: { id: string },
) {
  return deps.repos.deployments.getById(input.id);
}

export async function readDeploymentLogs(
  deps: { repos: { deployments: DeploymentRepo } },
  input: { deploymentId: string; sinceLineId: number; limit: number },
) {
  return deps.repos.deployments.readLogs({
    deploymentId: input.deploymentId,
    sinceLineId: input.sinceLineId,
    limit: input.limit,
  });
}
```

- [ ] **Step 6: Re-export, test, commit**

```bash
git add rntme-cli/packages/platform-core/src/use-cases/deployments.ts \
        rntme-cli/packages/platform-core/src/index.ts \
        rntme-cli/packages/platform-core/test/unit/use-cases/deployments.test.ts
git commit -m "feat(platform-core): startDeployment use-case + read helpers"
```

---

### Task D-10: SmokeVerifier

**Files:**
- Create: `rntme-cli/packages/platform-http/src/deploy/smoke-verifier.ts`.
- Create: `rntme-cli/packages/platform-http/test/unit/deploy/smoke-verifier.test.ts`.

Reads `applyResult.verificationHints.{healthUrl, uiUrl, publicRouteUrls}` (already populated by `deploy-dokploy.applyDokployPlan`, see `rntme-cli/packages/deploy-dokploy/src/apply.ts:212`). Performs HEAD on healthUrl, GET on uiUrl, returns a `VerificationReport`.

- [ ] **Step 1: Write failing tests**

```typescript
// rntme-cli/packages/platform-http/test/unit/deploy/smoke-verifier.test.ts
import { describe, it, expect } from 'vitest';
import { SmokeVerifier, type SmokeFetcher } from '../../../src/deploy/smoke-verifier.js';

const stubFetcher = (responses: Record<string, { status: number; body?: string; latencyMs?: number; throws?: 'timeout' | 'error' }>): SmokeFetcher => {
  return async (url, _opts) => {
    const r = responses[url];
    if (!r) throw new Error('no stub for ' + url);
    if (r.throws === 'timeout') return { status: 'timeout', latencyMs: r.latencyMs ?? 5000 };
    if (r.throws === 'error') return { status: 'error', latencyMs: r.latencyMs ?? 0 };
    return { status: r.status, latencyMs: r.latencyMs ?? 1, body: r.body ?? '' };
  };
};

describe('SmokeVerifier', () => {
  it('ok=true when edge 200 + ui 200', async () => {
    const v = new SmokeVerifier(stubFetcher({
      'https://edge.example/health': { status: 200 },
      'https://ui.example/': { status: 200, body: '<html>' },
    }));
    const r = await v.verify({
      verificationHints: { healthUrl: 'https://edge.example/health', uiUrl: 'https://ui.example/', publicRouteUrls: [] },
    } as never);
    expect(r.ok).toBe(true);
    expect(r.partialOk).toBe(false);
  });

  it('partialOk when edge 200 but ui 500', async () => {
    const v = new SmokeVerifier(stubFetcher({
      'https://edge.example/health': { status: 200 },
      'https://ui.example/': { status: 500 },
    }));
    const r = await v.verify({
      verificationHints: { healthUrl: 'https://edge.example/health', uiUrl: 'https://ui.example/', publicRouteUrls: [] },
    } as never);
    expect(r.ok).toBe(false);
    expect(r.partialOk).toBe(true);
  });

  it('not ok when edge timeout', async () => {
    const v = new SmokeVerifier(stubFetcher({
      'https://edge.example/health': { status: 200, throws: 'timeout' },
    }));
    const r = await v.verify({
      verificationHints: { healthUrl: 'https://edge.example/health', publicRouteUrls: [] },
    } as never);
    expect(r.ok).toBe(false);
    expect(r.partialOk).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify failure, then implement**

```typescript
// rntme-cli/packages/platform-http/src/deploy/smoke-verifier.ts
import type { VerificationReport } from '@rntme-cli/platform-core';

export type SmokeFetcher = (
  url: string,
  opts: { method: 'HEAD' | 'GET'; timeoutMs: number },
) => Promise<{ status: number | 'timeout' | 'error'; latencyMs: number; body?: string }>;

export class SmokeVerifier {
  constructor(private readonly fetcher: SmokeFetcher) {}

  async verify(applyResult: {
    verificationHints: { healthUrl: string; uiUrl?: string; publicRouteUrls: readonly string[] };
  }): Promise<VerificationReport> {
    const checks: VerificationReport['checks'] = [];

    const edge = await this.fetcher(applyResult.verificationHints.healthUrl, { method: 'HEAD', timeoutMs: 5000 });
    checks.push({
      name: 'edge-health', url: applyResult.verificationHints.healthUrl,
      status: edge.status, latencyMs: edge.latencyMs,
      ok: typeof edge.status === 'number' && edge.status >= 200 && edge.status < 300,
    });

    if (applyResult.verificationHints.uiUrl) {
      const ui = await this.fetcher(applyResult.verificationHints.uiUrl, { method: 'GET', timeoutMs: 10_000 });
      checks.push({
        name: 'ui', url: applyResult.verificationHints.uiUrl,
        status: ui.status, latencyMs: ui.latencyMs,
        ok: typeof ui.status === 'number' && ui.status >= 200 && ui.status < 300 && (ui.body ?? '').length > 0,
      });
    }

    // publicRouteUrls — recorded but not auto-checked in MVP.
    for (const u of applyResult.verificationHints.publicRouteUrls) {
      checks.push({ name: 'public-route', url: u, status: 0, latencyMs: 0, ok: true, note: 'not auto-checked in MVP' });
    }

    const edgeOk = checks[0]?.ok ?? false;
    const allOk = checks.every((c) => c.ok || c.note === 'not auto-checked in MVP');
    return {
      checks,
      ok: edgeOk && allOk,
      partialOk: edgeOk && !allOk,
    };
  }
}

export const defaultSmokeFetcher: SmokeFetcher = async (url, opts) => {
  const start = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const r = await fetch(url, { method: opts.method, signal: ctrl.signal });
    const body = opts.method === 'GET' ? await r.text() : undefined;
    return { status: r.status, latencyMs: Date.now() - start, ...(body !== undefined ? { body } : {}) };
  } catch (cause) {
    if ((cause as { name?: string }).name === 'AbortError') {
      return { status: 'timeout', latencyMs: Date.now() - start };
    }
    return { status: 'error', latencyMs: Date.now() - start };
  } finally {
    clearTimeout(t);
  }
};
```

- [ ] **Step 3: Run tests, commit**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/unit/deploy/smoke-verifier.test.ts
git add rntme-cli/packages/platform-http/src/deploy/smoke-verifier.ts \
        rntme-cli/packages/platform-http/test/unit/deploy/smoke-verifier.test.ts
git commit -m "feat(platform-http): SmokeVerifier — edge HEAD + UI GET"
```

---

### Task D-11: Dokploy client factory

**Files:**
- Create: `rntme-cli/packages/platform-http/src/deploy/dokploy-client-factory.ts`.
- Create: `rntme-cli/packages/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`.

Decrypts the target's apiToken once and returns a `DokployClient` (the interface from `@rntme-cli/deploy-dokploy/src/client.ts`) closing over the plaintext.

- [ ] **Step 1-5: TDD**

```typescript
// rntme-cli/packages/platform-http/src/deploy/dokploy-client-factory.ts
import type { DokployClient } from '@rntme-cli/deploy-dokploy';
import type { DeployTargetWithSecret, SecretCipher } from '@rntme-cli/platform-core';
import { isOk } from '@rntme-cli/platform-core';

export type DokployClientFactory = (target: DeployTargetWithSecret) => DokployClient;

export function createDokployClientFactory(
  cipher: SecretCipher,
  httpFetch: typeof fetch = fetch,
): DokployClientFactory {
  return (target) => {
    const tokenResult = cipher.decrypt({
      ciphertext: target.apiTokenCiphertext,
      nonce: target.apiTokenNonce,
      keyVersion: target.apiTokenKeyVersion,
    });
    if (!isOk(tokenResult)) {
      throw new Error('DEPLOY_TARGET_TOKEN_DECRYPT_FAILED: ' + tokenResult.errors[0].message);
    }
    const token = tokenResult.value;
    const baseUrl = target.dokployUrl.replace(/\/$/, '');

    // Implement the DokployClient interface in terms of fetch + token. The exact
    // method shape comes from rntme-cli/packages/deploy-dokploy/src/client.ts —
    // read it once and implement each method as an HTTP call to baseUrl.
    return {
      ensureProject: async (input) => {
        const r = await httpFetch(baseUrl + '/api/v1/projects/ensure', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': token },
          body: JSON.stringify(input),
        });
        if (!r.ok) throw new Error(`Dokploy ensureProject failed: ${r.status} ${await r.text()}`);
        return r.json() as Promise<{ projectId: string }>;
      },
      // ...other methods (listApplications, createApplication, updateApplication, getApplication, deleteApplication, etc.)
      // mirror the DokployClient interface 1-to-1.
    } as unknown as DokployClient;
  };
}
```

(The exact Dokploy HTTP API paths come from the `dokploy-mcp` patched SDK; the spec says use HTTP API, not MCP. Read `rntme-cli/packages/deploy-dokploy/src/client.ts` and the existing Dokploy memory-note `dokploy_mcp_url_gotcha.md` (`DOKPLOY_URL` must be the host without `/api`) — apply the same gotcha here. If you build paths with `/api/...`, do NOT also append `/api` again.)

Tests:
- factory decrypts and produces a working client (with mocked `httpFetch`);
- decrypt failure throws with `DEPLOY_TARGET_TOKEN_DECRYPT_FAILED`;
- factory does NOT log the plaintext token anywhere;
- the constructed client passes `x-api-key` header on each call.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-http/src/deploy/dokploy-client-factory.ts \
        rntme-cli/packages/platform-http/test/unit/deploy/dokploy-client-factory.test.ts
git commit -m "feat(platform-http): DokployClientFactory — decrypt + HTTP client closure"
```

---

### Task D-12: Build deploy-config from target + overrides

**Files:**
- Create: `rntme-cli/packages/platform-http/src/deploy/build-deploy-config.ts`.
- Create: `rntme-cli/packages/platform-http/test/unit/deploy/build-deploy-config.test.ts`.

Maps a `DeployTarget` row + `Deployment.configOverrides` to the `ProjectDeploymentConfig` accepted by `@rntme-cli/deploy-core.buildProjectDeploymentPlan`.

- [ ] **Step 1-5: TDD**

```typescript
// rntme-cli/packages/platform-http/src/deploy/build-deploy-config.ts
import type { ProjectDeploymentConfig } from '@rntme-cli/deploy-core';
import type { DeployTarget } from '@rntme-cli/platform-core';

export function buildProjectDeploymentConfig(
  target: DeployTarget,
  orgSlug: string,
  configOverrides: Record<string, unknown>,
): ProjectDeploymentConfig {
  const overrides = configOverrides as {
    integrationModuleImages?: Record<string, string>;
    policyOverrides?: Record<string, unknown>;
  };
  return {
    orgSlug,
    environment: 'default',
    mode: 'preview',
    eventBus: target.eventBus,
    integrationModuleImages: overrides.integrationModuleImages ?? {},
    policyValues: { ...target.policyValues, ...(overrides.policyOverrides ?? {}) },
  };
}
```

(Read `rntme-cli/packages/deploy-core/src/config.ts` for the exact `ProjectDeploymentConfig` shape — adjust mapping if any property is named differently.)

Tests:
- merges target.policyValues with overrides.policyOverrides (overrides win);
- forwards target.eventBus unchanged;
- mode hardcoded `preview` in MVP;
- environment hardcoded `default`.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-http/src/deploy/build-deploy-config.ts \
        rntme-cli/packages/platform-http/test/unit/deploy/build-deploy-config.test.ts
git commit -m "feat(platform-http): build-deploy-config from target + per-deploy overrides"
```

---

### Task D-13: Deploy executor

**Files:**
- Create: `rntme-cli/packages/platform-http/src/deploy/executor.ts`.
- Create: `rntme-cli/packages/platform-http/src/deploy/log-redactor.ts`.
- Create: `rntme-cli/packages/platform-http/test/unit/deploy/executor.test.ts`.

This is the orchestration core. It takes a deployment id + injected dependencies and runs the full plan/render/apply/verify cycle, updating the deployment row + log lines along the way. **No throws escape**; all errors finalize the deployment.

- [ ] **Step 1: Write the failing tests** — at minimum:

  1. happy path → status `succeeded`, applyResult set, verification ok, all step logs appended.
  2. blueprint revalidation fail → status `failed`, errorCode `DEPLOY_EXECUTOR_BLUEPRINT_REVALIDATION_FAILED`.
  3. plan fail (e.g. missing event bus) → `failed`, errorCode prefixed `DEPLOY_PLAN_*`.
  4. render fail → `failed`, prefixed `DEPLOY_RENDER_DOKPLOY_*`.
  5. apply partial-failure → `failed`, prefixed `DEPLOY_APPLY_DOKPLOY_*`, applyResult contains partial resources.
  6. smoke verify edge fail → `failed` (status code reflects the verifier choice).
  7. smoke verify ui fail only → `succeeded_with_warnings`.
  8. uncaught throw → `failed`, errorCode `DEPLOY_EXECUTOR_UNCAUGHT`, errorMessage redacted.
  9. heartbeat is touched at least once during the run.
  10. tmpdir is cleaned up even on failure.

- [ ] **Step 2-5: Implementation**

```typescript
// rntme-cli/packages/platform-http/src/deploy/executor.ts
import { rm, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadComposedBlueprint } from '@rntme/blueprint';
import { buildProjectDeploymentPlan } from '@rntme-cli/deploy-core';
import { renderDokployPlan, applyDokployPlan } from '@rntme-cli/deploy-dokploy';
import {
  isOk,
  type BlobStore,
  type CanonicalBundle,
  type DeploymentRepo,
  type DeployTargetRepo,
  type Organization,
  type ProjectVersionRepo,
} from '@rntme-cli/platform-core';
import type { Pool } from 'pg';
import type { Logger } from 'pino';
import type { DokployClientFactory } from './dokploy-client-factory.js';
import type { SmokeVerifier } from './smoke-verifier.js';
import { buildProjectDeploymentConfig } from './build-deploy-config.js';
import { redact } from './log-redactor.js';

export type ExecutorDeps = {
  pool: Pool;
  blob: BlobStore;
  /** Per-tx repo factory: opens an org-scoped tx and returns repos, runs work, commits/rolls back. */
  withOrgTx: <T>(orgId: string, fn: (tx: TxRepos) => Promise<T>) => Promise<T>;
  dokployClientFactory: DokployClientFactory;
  smoker: SmokeVerifier;
  logger: Logger;
  loadComposed?: typeof loadComposedBlueprint; // for tests
};

export type TxRepos = {
  deployments: DeploymentRepo;
  projectVersions: ProjectVersionRepo;
  deployTargets: DeployTargetRepo;
};

export async function runDeployment(deploymentId: string, orgId: string, deps: ExecutorDeps): Promise<void> {
  const log = (level: 'info' | 'warn' | 'error', step: string, message: string) =>
    deps.withOrgTx(orgId, async (r) => {
      await r.deployments.appendLog({ deploymentId, orgId, level, step, message });
    });

  // Open an outer scoped tx just to mark running + read full state.
  let bundleBlobKey: string | null = null;
  let projectVersionId: string | null = null;
  let targetId: string | null = null;
  let configOverrides: Record<string, unknown> = {};

  try {
    await deps.withOrgTx(orgId, async (r) => {
      const t = await r.deployments.transition(deploymentId, 'running', { startedAt: new Date() });
      if (!isOk(t)) throw new Error(t.errors[0].code);
      const dep = await r.deployments.getById(deploymentId);
      if (!isOk(dep) || !dep.value) throw new Error('DEPLOYMENT_NOT_FOUND');
      bundleBlobKey = (await fetchBlobKey(r.projectVersions, dep.value.projectVersionId));
      projectVersionId = dep.value.projectVersionId;
      targetId = dep.value.targetId;
      configOverrides = dep.value.configOverrides;
    });
  } catch (cause) {
    deps.logger.error({ cause, deploymentId }, 'executor failed before running');
    return;
  }

  await log('info', 'init', 'Starting deployment');

  const heartbeat = setInterval(() => {
    void deps.withOrgTx(orgId, (r) => r.deployments.touchHeartbeat(deploymentId)).catch(() => undefined);
  }, 5_000);

  let tmpDir: string | null = null;

  try {
    if (!bundleBlobKey || !projectVersionId || !targetId) throw new Error('PRECONDITION');

    // 1. Fetch + materialize bundle.
    const bundleBytesGz = await deps.blob.getRaw(bundleBlobKey);
    if (!isOk(bundleBytesGz)) {
      await finalize(deps, deploymentId, orgId, 'failed', { errorCode: 'DEPLOY_EXECUTOR_BLOB_FETCH_FAILED', errorMessage: 'unable to fetch bundle blob' });
      return;
    }
    const decompressed = gunzipSync(bundleBytesGz.value);
    const bundle: CanonicalBundle = JSON.parse(decompressed.toString('utf8'));
    tmpDir = await materializeBundle(bundle);

    // 2. Re-validate composition.
    await log('info', 'plan', 'Re-validating composed blueprint');
    const composed = (deps.loadComposed ?? loadComposedBlueprint)(tmpDir);
    if (!composed.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: 'DEPLOY_EXECUTOR_BLUEPRINT_REVALIDATION_FAILED',
        errorMessage: composed.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      });
      return;
    }

    // 3. Resolve target with secret + org.
    let target!: Awaited<ReturnType<DeployTargetRepo['getWithSecretById']>>['value'];
    let orgSlug = '';
    await deps.withOrgTx(orgId, async (r) => {
      const t = await r.deployTargets.getWithSecretById(targetId!);
      if (!isOk(t) || !t.value) throw new Error('DEPLOY_TARGET_NOT_FOUND');
      target = t.value;
      // orgSlug — fetch separately; could be added to TxRepos via organizations repo. For brevity assume passed via deps:
      orgSlug = (await getOrgSlug(deps.pool, orgId));
    });
    if (!target) throw new Error('TARGET_RESOLUTION_FAILED');

    // 4. deploy-core.plan
    const cfg = buildProjectDeploymentConfig({ ...target, apiTokenRedacted: '***' as const }, orgSlug, configOverrides);
    const plan = buildProjectDeploymentPlan(composed.value, cfg);
    if (!plan.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: plan.errors[0]?.code ?? 'DEPLOY_PLAN_UNKNOWN',
        errorMessage: plan.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      });
      return;
    }

    // 5. deploy-dokploy.render
    await log('info', 'render', 'Rendering Dokploy plan');
    const rendered = renderDokployPlan(plan.value, {
      dokployProjectId: target.dokployProjectId,
      dokployProjectName: target.dokployProjectName,
      allowCreateProject: target.allowCreateProject,
      publicBaseUrl: target.dokployUrl, // adjust to whatever deploy-dokploy expects
    });
    if (!rendered.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: rendered.errors[0]?.code ?? 'DEPLOY_RENDER_DOKPLOY_UNKNOWN',
        errorMessage: rendered.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      });
      return;
    }
    await deps.withOrgTx(orgId, (r) => r.deployments.setRenderedDigest(deploymentId, rendered.value.digest));

    // 6. apply
    await log('info', 'apply', 'Applying to Dokploy');
    const client = deps.dokployClientFactory(target);
    const applyResult = await applyDokployPlan(rendered.value, client);
    if (!applyResult.ok) {
      await finalize(deps, deploymentId, orgId, 'failed', {
        errorCode: applyResult.errors[0]?.code ?? 'DEPLOY_APPLY_DOKPLOY_UNKNOWN',
        errorMessage: applyResult.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
      });
      return;
    }
    await deps.withOrgTx(orgId, (r) => r.deployments.setApplyResult(deploymentId, applyResult.value as unknown as Record<string, unknown>));

    // 7. smoke verify
    await log('info', 'verify', 'Running smoke verification');
    const verification = await deps.smoker.verify(applyResult.value);
    const status = verification.ok ? 'succeeded'
                 : verification.partialOk ? 'succeeded_with_warnings'
                 : 'failed';
    await finalize(deps, deploymentId, orgId, status, { verificationReport: verification });
  } catch (cause) {
    await finalize(deps, deploymentId, orgId, 'failed', {
      errorCode: 'DEPLOY_EXECUTOR_UNCAUGHT',
      errorMessage: redact(String(cause)),
    });
  } finally {
    clearInterval(heartbeat);
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function materializeBundle(bundle: CanonicalBundle): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'rntme-deploy-'));
  for (const [rel, value] of Object.entries(bundle.files)) {
    const abs = join(dir, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, JSON.stringify(value));
  }
  return dir;
}

async function fetchBlobKey(repo: ProjectVersionRepo, versionId: string): Promise<string> {
  const v = await repo.getById(versionId);
  if (!isOk(v) || !v.value) throw new Error('PROJECT_VERSION_NOT_FOUND');
  return v.value.bundleBlobKey;
}

async function finalize(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  status: 'succeeded' | 'succeeded_with_warnings' | 'failed' | 'failed_orphaned',
  args: { errorCode?: string; errorMessage?: string; applyResult?: Record<string, unknown>; verificationReport?: import('@rntme-cli/platform-core').VerificationReport; warnings?: unknown[] },
): Promise<void> {
  await deps.withOrgTx(orgId, async (r) => {
    const f = await r.deployments.finalize(deploymentId, { status, ...args });
    if (!isOk(f)) deps.logger.error({ deploymentId, errors: f.errors }, 'finalize failed');
  });
}

async function getOrgSlug(pool: Pool, orgId: string): Promise<string> {
  const r = await pool.query<{ slug: string }>(`SELECT slug FROM organization WHERE id=$1 LIMIT 1`, [orgId]);
  return r.rows[0]?.slug ?? '';
}
```

```typescript
// rntme-cli/packages/platform-http/src/deploy/log-redactor.ts
const SECRET_PATTERNS: readonly RegExp[] = [
  /(api[-_]?key|password|token|secret|authorization)\s*[:=]\s*["']?([^\s"',]+)/gi,
  /Bearer\s+([A-Za-z0-9._-]+)/g,
];

export function redact(s: string): string {
  let out = s;
  for (const p of SECRET_PATTERNS) {
    out = out.replace(p, (m) => m.replace(/[^=:\s"']*$/, '***'));
  }
  return out;
}
```

The executor's `BlobStore.getRaw` shape: this plan assumes a `getRaw(key)` method. If platform-core's BlobStore only has `getJson`, this is a small extension — bump in either Track 1 (better) or here (extension task D-13a).

- [ ] **Step 6: Run tests, commit**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/unit/deploy/executor.test.ts
git add rntme-cli/packages/platform-http/src/deploy/executor.ts \
        rntme-cli/packages/platform-http/src/deploy/log-redactor.ts \
        rntme-cli/packages/platform-http/test/unit/deploy/executor.test.ts
git commit -m "feat(platform-http): deploy executor — plan → render → apply → verify"
```

---

### Task D-13a: BlobStore.getRaw expectation

`BlobStore.getRaw` was added in Track 1 Task U-16 specifically to support this executor. If for some reason it is missing — pull it forward into Track 2 by following U-16's recipe and committing it before D-13. Otherwise, this task is a no-op and the executor in D-13 can call `deps.blob.getRaw(key)` directly.

---

### Task D-14: Orphan-detection background loop

**Files:**
- Create: `rntme-cli/packages/platform-http/src/deploy/orphan-detect.ts`.
- Create: `rntme-cli/packages/platform-http/test/unit/deploy/orphan-detect.test.ts`.

- [ ] **Step 1: TDD**

```typescript
// rntme-cli/packages/platform-http/src/deploy/orphan-detect.ts
import { isOk, type DeploymentRepo, type Result, type PlatformError } from '@rntme-cli/platform-core';
import type { Pool } from 'pg';
import type { Logger } from 'pino';

export type OrphanDetectDeps = {
  pool: Pool;
  withOrgTx: <T>(orgId: string, fn: (r: { deployments: DeploymentRepo }) => Promise<T>) => Promise<T>;
  /** Read-side that does NOT require an org-scoped tx (system-level). */
  findStaleRunning: (staleAfterSeconds: number) => Promise<Result<readonly { id: string; orgId: string }[], PlatformError>>;
  logger: Logger;
};

export function startOrphanDetectLoop(deps: OrphanDetectDeps, intervalMs = 60_000): { stop: () => void } {
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const stale = await deps.findStaleRunning(60);
    if (!isOk(stale)) {
      deps.logger.warn({ errors: stale.errors }, 'orphan-detect findStaleRunning failed');
      return;
    }
    for (const { id, orgId } of stale.value) {
      await deps.withOrgTx(orgId, async (r) => {
        const f = await r.deployments.finalize(id, {
          status: 'failed_orphaned',
          errorCode: 'DEPLOY_EXECUTOR_ORPHANED',
          errorMessage: 'no heartbeat for ≥60s',
        });
        if (!isOk(f)) deps.logger.warn({ deploymentId: id, errors: f.errors }, 'orphan finalize failed');
      });
    }
  };

  // Run once on startup, then on interval.
  void tick();
  const handle = setInterval(() => { void tick(); }, intervalMs);
  return { stop: () => { stopped = true; clearInterval(handle); } };
}
```

`findStaleRunning` lives on a *system-level* DeploymentRepo seam (separate from per-tx repos in `RequestRepos`). Implementation: a `PgSystemDeploymentRepo` that opens its own connection from the pool and runs `SET LOCAL row_security = off;` (system-level scan must see all orgs) before the SELECT. Mirror the pattern in `pg-tx.ts` if such a helper already exists; if not, document that this read deliberately bypasses RLS.

- [ ] **Step 2-5: TDD as before. Test cases:**

  1. tick finds N stale rows → each is finalized with `failed_orphaned`.
  2. heartbeat fresh → no rows touched.
  3. interval calls tick repeatedly.
  4. stop() halts further ticks.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-http/src/deploy/orphan-detect.ts \
        rntme-cli/packages/platform-http/test/unit/deploy/orphan-detect.test.ts
git commit -m "feat(platform-http): orphan-detect background loop"
```

---

### Task D-15: Deploy targets HTTP routes

**Files:**
- Create: `rntme-cli/packages/platform-http/src/routes/deploy-targets.ts`.
- Create: `rntme-cli/packages/platform-http/test/integration/deploy-targets.test.ts`.
- Modify: `rntme-cli/packages/platform-http/src/app.ts` — mount.
- Modify: `rntme-cli/packages/platform-http/src/resolve-deps.ts` — add `deployTargets`.

- [ ] **Step 1: Write failing integration tests** covering:
  - `POST` 201 on valid create;
  - `POST` 409 on duplicate slug;
  - `POST` 400 when missing apiToken;
  - `GET` list redacts apiToken to `"***"`;
  - `GET /:tslug` redacts;
  - `PATCH` rejects body with `apiToken` field;
  - `PUT /:tslug/api-token` rotates;
  - `POST /:tslug/default` sets default + clears previous;
  - `DELETE` 409 when `deployment` exists with status running/queued;
  - `DELETE` 200 when no live deployments;
  - all endpoints require `deploy:target:manage` scope (mutating); `GET` only requires `project:read`.

- [ ] **Step 2-5: Implementation**

```typescript
// rntme-cli/packages/platform-http/src/routes/deploy-targets.ts
import { Hono } from 'hono';
import {
  CreateDeployTargetRequestSchema,
  UpdateDeployTargetRequestSchema,
  RotateApiTokenRequestSchema,
  createDeployTarget,
  updateDeployTarget,
  rotateDeployTargetApiToken,
  setDefaultDeployTarget,
  deleteDeployTarget,
  listDeployTargets,
  getDeployTarget,
  isOk,
} from '@rntme-cli/platform-core';
import type { SecretCipher, Ids } from '@rntme-cli/platform-core';
import { requireScope, requireOrgMatch } from '../middleware/auth.js';
import { respond } from './helpers.js';
import { resolveDeps as defaultResolveDeps, type RequestRepos } from '../resolve-deps.js';
import type { PoolClient } from 'pg';

type Deps = { cipher: SecretCipher; ids: Ids; resolveDeps?: (tx: PoolClient) => RequestRepos };

export function deployTargetRoutes(deps: Deps): Hono {
  const app = new Hono();
  const resolve = deps.resolveDeps ?? defaultResolveDeps;
  app.use('*', requireOrgMatch('orgSlug'));

  app.get('/deploy-targets', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const s = c.get('subject');
    const r = await listDeployTargets({ repos: { deployTargets: repos.deployTargets } }, { orgId: s.org.id });
    return respond(c, r, 200, 'targets');
  });

  app.post('/deploy-targets', requireScope('deploy:target:manage'), async (c) => {
    const repos = resolve(c.get('tx'));
    const body = await c.req.json().catch(() => null);
    const parsed = CreateDeployTargetRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const s = c.get('subject');
    const r = await createDeployTarget(
      { repos: { deployTargets: repos.deployTargets }, cipher: deps.cipher, ids: deps.ids },
      { orgId: s.org.id, accountId: s.account.id, tokenId: s.tokenId ?? null, req: parsed.data },
    );
    return respond(c, r, 201, 'target');
  });

  app.get('/deploy-targets/:tslug', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const tslug = c.req.param('tslug')!;
    const s = c.get('subject');
    const r = await getDeployTarget({ repos: { deployTargets: repos.deployTargets } }, { orgId: s.org.id, slug: tslug });
    if (!isOk(r)) return respond(c, r);
    if (!r.value) return c.json({ error: { code: 'DEPLOY_TARGET_NOT_FOUND', message: tslug } }, 404);
    return c.json({ target: r.value });
  });

  app.patch('/deploy-targets/:tslug', requireScope('deploy:target:manage'), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = UpdateDeployTargetRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const repos = resolve(c.get('tx'));
    const tslug = c.req.param('tslug')!;
    const s = c.get('subject');
    const r = await updateDeployTarget(
      { repos: { deployTargets: repos.deployTargets }, cipher: deps.cipher, ids: deps.ids },
      { orgId: s.org.id, slug: tslug, accountId: s.account.id, tokenId: s.tokenId ?? null, patch: parsed.data },
    );
    return respond(c, r, 200, 'target');
  });

  app.put('/deploy-targets/:tslug/api-token', requireScope('deploy:target:manage'), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RotateApiTokenRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const repos = resolve(c.get('tx'));
    const tslug = c.req.param('tslug')!;
    const s = c.get('subject');
    const r = await rotateDeployTargetApiToken(
      { repos: { deployTargets: repos.deployTargets }, cipher: deps.cipher, ids: deps.ids },
      { orgId: s.org.id, slug: tslug, accountId: s.account.id, tokenId: s.tokenId ?? null, req: parsed.data },
    );
    return respond(c, r, 200, 'target');
  });

  app.post('/deploy-targets/:tslug/default', requireScope('deploy:target:manage'), async (c) => {
    const repos = resolve(c.get('tx'));
    const tslug = c.req.param('tslug')!;
    const s = c.get('subject');
    const r = await setDefaultDeployTarget({ repos: { deployTargets: repos.deployTargets } }, {
      orgId: s.org.id, slug: tslug, accountId: s.account.id, tokenId: s.tokenId ?? null,
    });
    return respond(c, r, 200, 'target');
  });

  app.delete('/deploy-targets/:tslug', requireScope('deploy:target:manage'), async (c) => {
    const repos = resolve(c.get('tx'));
    const tslug = c.req.param('tslug')!;
    const s = c.get('subject');
    const r = await deleteDeployTarget({ repos: { deployTargets: repos.deployTargets } }, {
      orgId: s.org.id, slug: tslug, accountId: s.account.id, tokenId: s.tokenId ?? null,
    });
    if (!isOk(r)) return respond(c, r);
    return c.json({}, 200);
  });

  return app;
}
```

- [ ] **Step 6: Wire into app.ts + resolve-deps.ts**

```typescript
// app.ts (add)
authed.route('/orgs/:orgSlug', deployTargetRoutes({ cipher: deps.cipher, ids: deps.ids }));

// AppDeps gains `cipher: SecretCipher`. Constructed in bin/server.ts from PLATFORM_SECRET_ENCRYPTION_KEY env.

// resolve-deps.ts
deployTargets: new PgDeployTargetRepo(tx),
```

- [ ] **Step 7: Run tests, commit**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/integration/deploy-targets.test.ts
git add rntme-cli/packages/platform-http/src/routes/deploy-targets.ts \
        rntme-cli/packages/platform-http/src/app.ts \
        rntme-cli/packages/platform-http/src/resolve-deps.ts \
        rntme-cli/packages/platform-http/test/integration/deploy-targets.test.ts
git commit -m "feat(platform-http): deploy-target REST routes"
```

---

### Task D-16: Deployment HTTP routes

**Files:**
- Create: `rntme-cli/packages/platform-http/src/routes/deployments.ts`.
- Create: `rntme-cli/packages/platform-http/test/integration/deployments.test.ts`.
- Modify: `rntme-cli/packages/platform-http/src/app.ts` — mount.

- [ ] **Step 1: Failing tests** covering:
  - POST returns `202` with `{ id, status: 'queued', detailUrl }`.
  - POST scope check (member can deploy, no token can't).
  - GET list filters by status.
  - GET detail returns full record.
  - GET logs incremental polling: `sinceLineId` → returns lines after, with `lastLineId`.

- [ ] **Step 2-5: Implementation**

```typescript
// rntme-cli/packages/platform-http/src/routes/deployments.ts
import { Hono } from 'hono';
import {
  StartDeploymentRequestSchema,
  startDeployment,
  listDeployments,
  getDeployment,
  readDeploymentLogs,
  isOk,
} from '@rntme-cli/platform-core';
import type { Ids } from '@rntme-cli/platform-core';
import { requireScope, requireOrgMatch } from '../middleware/auth.js';
import { respond, resolveProject } from './helpers.js';
import { resolveDeps as defaultResolveDeps, type RequestRepos } from '../resolve-deps.js';
import type { PoolClient } from 'pg';
import type { ExecutorDeps } from '../deploy/executor.js';
import { runDeployment } from '../deploy/executor.js';

type Deps = {
  ids: Ids;
  executorDeps: ExecutorDeps;
  resolveDeps?: (tx: PoolClient) => RequestRepos;
};

export function deploymentRoutes(deps: Deps): Hono {
  const app = new Hono();
  const resolve = deps.resolveDeps ?? defaultResolveDeps;
  app.use('*', requireOrgMatch('orgSlug'));

  app.post('/deployments', requireScope('deploy:execute'), async (c) => {
    const repos = resolve(c.get('tx'));
    const orgSlug = c.req.param('orgSlug')!;
    const projSlug = c.req.param('projSlug')!;
    const proj = await resolveProject(repos, orgSlug, projSlug);
    if (!proj.ok) return respond(c, proj as never);
    const body = await c.req.json().catch(() => null);
    const parsed = StartDeploymentRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    const s = c.get('subject');
    const r = await startDeployment(
      { repos: { projectVersions: repos.projectVersions, deployTargets: repos.deployTargets, deployments: repos.deployments }, ids: deps.ids },
      {
        orgId: s.org.id, projectId: proj.value.project.id,
        accountId: s.account.id, tokenId: s.tokenId ?? null,
        req: parsed.data,
      },
    );
    if (!isOk(r)) return respond(c, r);
    // Schedule executor (fire-and-forget, errors caught inside).
    setImmediate(() => { void runDeployment(r.value.id, s.org.id, deps.executorDeps); });
    return c.json({
      deployment: r.value,
      detailUrl: `/${orgSlug}/projects/${projSlug}/deployments/${r.value.id}`,
    }, 202);
  });

  app.get('/deployments', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const orgSlug = c.req.param('orgSlug')!;
    const projSlug = c.req.param('projSlug')!;
    const proj = await resolveProject(repos, orgSlug, projSlug);
    if (!proj.ok) return respond(c, proj as never);
    const limit = Math.min(100, Number(c.req.query('limit') ?? 50));
    const r = await listDeployments(
      { repos: { deployments: repos.deployments } },
      { projectId: proj.value.project.id, limit },
    );
    return respond(c, r, 200, 'deployments');
  });

  app.get('/deployments/:id', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const id = c.req.param('id')!;
    const r = await getDeployment({ repos: { deployments: repos.deployments } }, { id });
    if (!isOk(r)) return respond(c, r);
    if (!r.value) return c.json({ error: { code: 'DEPLOYMENT_NOT_FOUND', message: id } }, 404);
    return c.json({ deployment: r.value });
  });

  app.get('/deployments/:id/logs', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const id = c.req.param('id')!;
    const sinceLineId = Math.max(0, Number(c.req.query('sinceLineId') ?? 0));
    const limit = Math.min(500, Number(c.req.query('limit') ?? 200));
    const dep = await getDeployment({ repos: { deployments: repos.deployments } }, { id });
    if (!isOk(dep)) return respond(c, dep);
    if (!dep.value) return c.json({ error: { code: 'DEPLOYMENT_NOT_FOUND', message: id } }, 404);
    const r = await readDeploymentLogs({ repos: { deployments: repos.deployments } }, { deploymentId: id, sinceLineId, limit });
    if (!isOk(r)) return respond(c, r);
    return c.json({
      lines: r.value.lines,
      lastLineId: r.value.lastLineId,
      isTerminal: ['succeeded', 'succeeded_with_warnings', 'failed', 'failed_orphaned'].includes(dep.value.status),
    });
  });

  return app;
}
```

- [ ] **Step 6: Mount + commit**

```typescript
// app.ts (add)
authed.route('/orgs/:orgSlug/projects/:projSlug', deploymentRoutes({ ids: deps.ids, executorDeps: buildExecutorDeps(deps) }));
```

`buildExecutorDeps` is a small factory in `app.ts` that constructs `ExecutorDeps` from `AppDeps` (pool, blob, cipher, dokployClientFactory built from cipher, smoker = new SmokeVerifier(defaultSmokeFetcher), logger, withOrgTx helper from `middleware/tx.ts`).

```bash
pnpm -F @rntme-cli/platform-http vitest run test/integration/deployments.test.ts
git add rntme-cli/packages/platform-http/src/routes/deployments.ts \
        rntme-cli/packages/platform-http/src/app.ts \
        rntme-cli/packages/platform-http/test/integration/deployments.test.ts
git commit -m "feat(platform-http): deployment REST routes + executor scheduling"
```

---

### Task D-17: Env var + bin/server wiring

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/config/env.ts` — require `PLATFORM_SECRET_ENCRYPTION_KEY`.
- Modify: `rntme-cli/packages/platform-http/src/bin/server.ts` — construct `AesGcmCipher`, `SmokeVerifier`, start orphan-detect loop, plumb `cipher` into `AppDeps`.
- Modify: `rntme-cli/packages/platform-http/src/app.ts` — `AppDeps` gains `cipher: SecretCipher`.

- [ ] **Step 1: Write failing test**

`rntme-cli/packages/platform-http/test/unit/config/env.test.ts` — assert env validation rejects when `PLATFORM_SECRET_ENCRYPTION_KEY` is missing or not 64 hex chars.

- [ ] **Step 2-5: Implement env requirement + server wiring**

env.ts:

```typescript
PLATFORM_SECRET_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, '32-byte hex'),
```

bin/server.ts (additions):

```typescript
const cipher = new AesGcmCipher({ keyHex: env.PLATFORM_SECRET_ENCRYPTION_KEY, currentKeyVersion: 1 });
const smoker = new SmokeVerifier(defaultSmokeFetcher);
const dokployClientFactory = createDokployClientFactory(cipher);
// ... build executorDeps, pass cipher into createApp(...).
const orphanLoop = startOrphanDetectLoop({ pool, withOrgTx, findStaleRunning, logger });
// Register graceful-shutdown to call orphanLoop.stop().
```

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-http/src/config/env.ts \
        rntme-cli/packages/platform-http/src/bin/server.ts \
        rntme-cli/packages/platform-http/src/app.ts \
        rntme-cli/packages/platform-http/test/unit/config/env.test.ts
git commit -m "feat(platform-http): wire SecretCipher, SmokeVerifier, orphan-detect at boot"
```

---

### Task D-18: UI — Deploy Targets pages

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/pages/deploy-targets.tsx`.
- Create: `rntme-cli/packages/platform-http/src/ui/pages/deploy-target-detail.tsx`.
- Create: `rntme-cli/packages/platform-http/src/ui/pages/deploy-target-form.tsx`.
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx` — register routes.
- Modify: `rntme-cli/packages/platform-http/src/ui/layout.tsx` — add **Deploy Targets** to the sidebar nav.
- Create: tests.

Pages do basic HTML forms (htmx for the CRUD on /:tslug/api-token rotation modal). Read existing `tokens.tsx` for the pattern — same style.

- [ ] **Step 1: Implement DeployTargetsPage (list)**

(Layout same as ProjectPage. Table columns: slug, displayName, kind, dokployUrl, isDefault badge, actions: edit/set-default/rotate-token/delete. `[+ New target]` button for `deploy:target:manage`.)

- [ ] **Step 2: Implement DeployTargetDetailPage (show + edit form)**

Form fields all the create-payload fields except `apiToken` (rotate via separate modal). Show `apiToken: ***` read-only.

- [ ] **Step 3: Implement DeployTargetFormPage (create)**

- [ ] **Step 4: Sidebar nav update**

In `layout.tsx`, the sidebar (currently has "Projects / Tokens / Audit") gains:

```tsx
<a href={`/${subject.org.slug}/deploy-targets`} class="...">Deploy Targets</a>
```

Position between "Projects" and "Tokens".

- [ ] **Step 5: Wire ui/app.tsx routes**

```typescript
// GET /:orgSlug/deploy-targets — list
// GET /:orgSlug/deploy-targets/new — create form
// GET /:orgSlug/deploy-targets/:tslug — detail
// POST /:orgSlug/deploy-targets — htmx form submit (calls /v1/...) ; or do JS form action
// POST /:orgSlug/deploy-targets/:tslug/api-token — htmx rotate modal submit
```

UI mutations go through internal handlers that re-use the same use-cases (no JS API call from the UI; the UI handler reads form-encoded body, parses, calls use-case directly). Pattern to follow: `tokens.tsx` rotation modal (existing).

- [ ] **Step 6: Tests**

UI snapshot / render tests for each page (table renders, empty state, badge for default).

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/platform-http/src/ui/pages/deploy-target*.tsx \
        rntme-cli/packages/platform-http/src/ui/app.tsx \
        rntme-cli/packages/platform-http/src/ui/layout.tsx \
        rntme-cli/packages/platform-http/test/unit/ui/pages/deploy-target*.test.tsx
git commit -m "feat(platform-http): UI — Deploy Targets list/detail/form + sidebar nav"
```

---

### Task D-19: UI — Deploy form on Project Version page + Deployments list/detail

**Files:**
- Modify: `rntme-cli/packages/platform-http/src/ui/pages/project-version.tsx` — add Deploy button + form modal.
- Create: `rntme-cli/packages/platform-http/src/ui/pages/deployments-list.tsx`.
- Create: `rntme-cli/packages/platform-http/src/ui/pages/deployment.tsx` — detail.
- Create: `rntme-cli/packages/platform-http/src/ui/fragments/deployment-status.tsx`.
- Create: `rntme-cli/packages/platform-http/src/ui/fragments/deployment-logs.tsx`.
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx` — routes + htmx fragment endpoints.

- [ ] **Step 1: Deploy form on project-version page**

Add a section:

```tsx
{hasScope(subject, 'deploy:execute') ? (
  <section class="mt-6 border-t pt-6">
    <h2 class="mb-2 text-sm font-medium text-gray-900">Deploy</h2>
    <form
      method="POST"
      action={`/${subject.org.slug}/projects/${project.slug}/deployments`}
      class="space-y-2"
    >
      <input type="hidden" name="projectVersionSeq" value={String(version.seq)} />
      <label class="block text-sm">
        Target
        <select name="targetSlug" class="mt-1 block w-full rounded border-gray-300">
          {targets.map((t) => (
            <option value={t.slug} selected={t.isDefault}>{t.displayName} ({t.slug}){t.isDefault ? ' — default' : ''}</option>
          ))}
        </select>
      </label>
      <label class="block text-sm">
        Config overrides (JSON)
        <textarea name="configOverrides" rows="6" class="mt-1 block w-full rounded border-gray-300 font-mono text-xs" placeholder='{"integrationModuleImages": {"mod-x": "registry/mod-x:v1"}}'></textarea>
      </label>
      <button type="submit" class="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">Deploy</button>
    </form>
  </section>
) : null}
```

The UI handler `POST /:orgSlug/projects/:projSlug/deployments` parses form body (`projectVersionSeq`, `targetSlug`, `configOverrides` as JSON), calls `startDeployment` use-case, schedules executor, then 303 redirect to `/${orgSlug}/projects/${projSlug}/deployments/${id}`.

If `targets` list is empty (no targets created yet) — render an empty-state explaining how to create one.

- [ ] **Step 2: Deployments list page**

Table: id (short), version seq, target slug, status badge, started at, duration, started-by. Filters: status multi-select.

- [ ] **Step 3: Deployment detail page with htmx polling**

```tsx
<div hx-get={`/_/deployments/${deployment.id}/status`} hx-trigger="load, every 2s" hx-swap="outerHTML" id="status-fragment">
  {/* server-rendered status badge initially */}
  <DeploymentStatusFragment deployment={deployment} />
</div>

<div hx-get={`/_/deployments/${deployment.id}/logs?sinceLineId=0`} hx-trigger="load, every 2s" hx-swap="beforeend" id="logs">
  {/* logs accumulate here */}
</div>
```

UI handlers:
- `GET /_/deployments/:id/status` returns just the status fragment HTML; sets `hx-trigger` to stop polling once terminal (via `hx-trigger="every 2s, none"` or by returning a wrapper without the trigger).
- `GET /_/deployments/:id/logs?sinceLineId=N` returns the new lines as `<pre>` blocks; updates `hx-vals` to bump `sinceLineId` for the next poll.

Implementation detail for stopping the polling once terminal: include in the response a swap-oob fragment that updates the polling div with `hx-trigger="none"` once `isTerminal=true` is reported.

- [ ] **Step 4: UI handler for POST /deployments form**

```typescript
// pseudo
app.post('/:orgSlug/projects/:projSlug/deployments', requireAuth, async (c) => {
  const subject = c.get('subject');
  const form = await c.req.formData();
  const seq = Number(form.get('projectVersionSeq'));
  const targetSlug = String(form.get('targetSlug') ?? '') || undefined;
  let overrides: Record<string, unknown> = {};
  try { overrides = JSON.parse(String(form.get('configOverrides') ?? '{}') || '{}'); }
  catch { return c.html(/* error toast */, 400); }
  // ... call startDeployment, schedule executor, return 303 redirect
});
```

- [ ] **Step 5: Tests** — render snapshots of new pages; integration test of the htmx status fragment endpoint.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/platform-http/src/ui/ \
        rntme-cli/packages/platform-http/test/unit/ui/
git commit -m "feat(platform-http): UI — Deploy form on version page; Deployments list/detail with htmx polling"
```

---

### Task D-20: Mock Dokploy fixture for E2E tests

**Files:**
- Create: `rntme-cli/packages/platform-http/test/fixtures/mock-dokploy.ts`.

A standalone Hono server that simulates a Dokploy HTTP API in-memory. The E2E test starts it on a random port, points the deploy target at it, and asserts the deployment succeeds.

- [ ] **Step 1: Implement**

```typescript
// rntme-cli/packages/platform-http/test/fixtures/mock-dokploy.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

export type MockDokployServer = {
  url: string;
  apiToken: string;
  state: { projects: Map<string, { id: string; name: string }>; applications: Map<string, { id: string; projectId: string; name: string; image?: string }> };
  close: () => Promise<void>;
};

export async function startMockDokploy(): Promise<MockDokployServer> {
  const apiToken = 'dkp_mock_' + Math.random().toString(16).slice(2);
  const projects = new Map<string, { id: string; name: string }>();
  const applications = new Map<string, { id: string; projectId: string; name: string; image?: string }>();
  let id = 1;
  const nextId = () => 'mock-' + (id++);

  const app = new Hono();
  app.use('*', async (c, next) => {
    if (c.req.header('x-api-key') !== apiToken) return c.json({ error: 'unauthorized' }, 401);
    return next();
  });

  app.post('/api/v1/projects/ensure', async (c) => {
    const body = await c.req.json() as { projectId?: string; projectName?: string; allowCreate?: boolean };
    if (body.projectId && projects.has(body.projectId)) {
      return c.json({ projectId: body.projectId });
    }
    if (body.projectName && body.allowCreate) {
      const newId = nextId();
      projects.set(newId, { id: newId, name: body.projectName });
      return c.json({ projectId: newId });
    }
    return c.json({ error: 'project not found and allowCreate=false' }, 404);
  });

  // Implement other endpoints used by the actual deploy-dokploy client:
  // POST /api/v1/applications, PATCH, GET, DELETE — match deploy-dokploy/src/client.ts

  // Plus health endpoints that the SmokeVerifier hits:
  app.get('/health', (c) => c.text('ok')); // edge nginx will be its own URL in real life
  // For test: smoke verifier hits the URL that ends up in applyResult.verificationHints.healthUrl,
  // which is rendered against config.publicBaseUrl. Stub that to point back at this server's port.

  const handle = serve({ fetch: app.fetch, port: 0 });
  const port = (handle.address() as { port: number }).port;
  return {
    url: `http://localhost:${port}`,
    apiToken,
    state: { projects, applications },
    close: async () => { handle.close(); },
  };
}
```

(Adjust endpoints to match `rntme-cli/packages/deploy-dokploy/src/client.ts` 1:1.)

- [ ] **Step 2: Commit**

```bash
git add rntme-cli/packages/platform-http/test/fixtures/mock-dokploy.ts
git commit -m "test(platform-http): mock Dokploy HTTP server fixture"
```

---

### Task D-21: E2E — full deploy flow

**Files:**
- Create: `rntme-cli/packages/platform-http/test/e2e/deploy-flow.e2e.test.ts`.

- [ ] **Step 1: Failing E2E**

```typescript
// rntme-cli/packages/platform-http/test/e2e/deploy-flow.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, type TestApp } from './_app.js';
import { startMockDokploy, type MockDokployServer } from '../fixtures/mock-dokploy.js';

describe('Deploy flow E2E', () => {
  let app: TestApp;
  let dokploy: MockDokployServer;

  beforeAll(async () => {
    dokploy = await startMockDokploy();
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
    await dokploy.close();
  });

  it('CLI publish → UI Deploy → succeeded', async () => {
    // 1. Seed admin + project + version (reuse U-15 setup helpers).
    const { token, orgSlug, projSlug, versionSeq } = await app.seedProjectWithVersion('shop');

    // 2. Create deploy target via API.
    const create = await app.request(`/v1/orgs/${orgSlug}/deploy-targets`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'mock-dokploy', displayName: 'Mock', kind: 'dokploy',
        dokployUrl: dokploy.url,
        dokployProjectId: 'pre-existing',
        allowCreateProject: false,
        apiToken: dokploy.apiToken,
        eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
        policyValues: { rateLimit: { default: { requestsPerMinute: 60, burst: 20 } }, bodyLimit: { default: { maxBodySize: '2m' } }, timeout: { default: { upstreamTimeoutMs: 30000 } } },
        isDefault: true,
      }),
    });
    expect(create.status).toBe(201);
    // Pre-seed mock dokploy with the target project id:
    dokploy.state.projects.set('pre-existing', { id: 'pre-existing', name: 'pre-existing' });

    // 3. POST deployment.
    const dep = await app.request(`/v1/orgs/${orgSlug}/projects/${projSlug}/deployments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ projectVersionSeq: versionSeq, configOverrides: { integrationModuleImages: {} } }),
    });
    expect(dep.status).toBe(202);
    const { deployment } = await dep.json();

    // 4. Poll logs until terminal.
    const start = Date.now();
    let terminal = false;
    while (!terminal && Date.now() - start < 30_000) {
      await new Promise((r) => setTimeout(r, 200));
      const logs = await app.request(`/v1/orgs/${orgSlug}/projects/${projSlug}/deployments/${deployment.id}/logs?sinceLineId=0`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = await logs.json();
      terminal = body.isTerminal;
    }
    expect(terminal).toBe(true);

    // 5. Read final state.
    const detail = await app.request(`/v1/orgs/${orgSlug}/projects/${projSlug}/deployments/${deployment.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const detailBody = await detail.json();
    expect(['succeeded', 'succeeded_with_warnings']).toContain(detailBody.deployment.status);
    expect(detailBody.deployment.applyResult).toBeTruthy();
  }, 60_000);
});
```

- [ ] **Step 2: Run, debug, commit**

```bash
pnpm -F @rntme-cli/platform-http vitest run test/e2e/deploy-flow.e2e.test.ts
git add rntme-cli/packages/platform-http/test/e2e/deploy-flow.e2e.test.ts
git commit -m "test(e2e): full deploy flow with mock Dokploy"
```

---

### Task D-D1: Documentation refresh (deploy track)

**Files:**
- Modify: `AGENTS.md` — package index entries for new repos / use-cases / executor; §6 how-tos: "Create a deploy target", "Trigger a deploy from the UI", "Trigger a deploy from CLI" (note: not in MVP), "Diagnose a failed deployment".
- Modify: `README.md` — project deploy flow narrative + commands.
- Modify: `CLAUDE.md` — Architecture in one paragraph: include deploy targets + executor + smoke verifier.
- Modify: `docs/architecture.md` — add the deploy section + diagram.
- Modify: per-package READMEs: `platform-core` (new repos / use-cases), `platform-storage` (new repos + cipher), `platform-http` (deploy/ subfolder, env var, orphan loop), `cli` (deploy is UI-only in MVP).
- Modify: `rntme-cli/AGENTS.md` (if exists) — same updates inside the submodule.

- [ ] **Step 1: AGENTS.md (parent)** — update §3 layering (`platform-http` now hosts the executor); §6 deploy how-to; §10 glossary entries `deploy_target`, `deployment`, `executor`, `SmokeVerifier`, `SecretCipher`.

- [ ] **Step 2: CLAUDE.md** — extend the architecture-in-one-paragraph to mention the deploy track and dependencies on `deploy-core`/`deploy-dokploy`.

- [ ] **Step 3: docs/architecture.md** — add the deploy diagram (CLI → publish → version → UI → POST /deployments → executor → deploy-core → deploy-dokploy → Dokploy → smoke verify → finalize).

- [ ] **Step 4: per-package READMEs** — add the new public APIs.

- [ ] **Step 5: Verify**

```bash
grep -rn 'deploy:execute\|deploy:target:manage\|deploy_target\|SmokeVerifier' \
  AGENTS.md CLAUDE.md docs/architecture.md rntme-cli/packages/*/README.md
```

Expected: matches present in all updated files.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md README.md CLAUDE.md docs/architecture.md \
        rntme-cli/packages/*/README.md \
        rntme-cli/AGENTS.md
git commit -m "docs: refresh for project deploy flow track"
```

---

## Spec coverage check

- §3 D4 (per-org multi-target with default) → D-1, D-6.
- §3 D5 (in-process async + orphan-detect) → D-13, D-14.
- §3 D6 (backend smoke only) → D-10.
- §3 D7 (no cancellation) → out of scope, idempotent retry implied by deploy-core/dokploy.
- §3 D8 (scopes) → D-3.
- §3 D13 (AES-256-GCM) → D-2.
- §3 D14 (event bus + policy on target; overrides on deployment) → D-4, D-1.
- §3 D15 (logs separate table) → D-1.
- §3 D16 (htmx polling) → D-19.
- §3 D17 (api token redaction; rotate endpoint) → D-4, D-6, D-15.
- §6.1 deploy_target / deployment / log_line tables → D-1.
- §6.4 repos → D-5, D-6, D-7.
- §9 deploy target endpoints → D-15.
- §10.1-10.6 deploy execution → D-9, D-10, D-11, D-12, D-13, D-14, D-16.
- §11 UI surfaces → D-18, D-19.
- §13 authorization → D-3, D-15, D-16.
- §14 error codes → introduced throughout (D-2, D-13, D-15).
- §17 documentation touches → D-D1.

---

## Closing checklist

- [ ] All tasks complete with green tests.
- [ ] `pnpm -r run typecheck`, `pnpm -r run test`, `pnpm -r run lint` all pass at repo root.
- [ ] E2E `deploy-flow.e2e.test.ts` green against mocked Dokploy.
- [ ] Manual smoke against `platform.rntme.com` Dokploy:
  - `rntme project publish` (Track 1).
  - UI: Deploy Targets → create real target.
  - UI: Project Version → Deploy → wait for `succeeded`.
  - Verify nginx edge URL returns 200; UI URL returns SPA HTML.
- [ ] PLATFORM_SECRET_ENCRYPTION_KEY documented and present in production env.
- [ ] PR opened referencing this plan + the spec + Track 1 plan.
