# Provisioned RustFS Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dokploy preview-target provisioned RustFS object storage and wire it into `@rntme/storage-s3` without changing the module provisioner phase order.

**Architecture:** `deploy-core` plans one project-level RustFS infrastructure resource and one project bucket. `deploy-dokploy` renders a RustFS Compose resource plus a small Nginx public ingress application, then injects S3 env into storage-s3 integration-module workloads. `@rntme/storage-s3` uses an internal S3 endpoint for server operations, a public endpoint for browser presigned URLs, and an MVP startup ensure bridge for bucket/CORS/lifecycle.

**Tech Stack:** TypeScript, Zod, Vitest, Dokploy Compose/Application resources, RustFS S3-compatible API, AWS SDK S3 client/presigner, Bun server runtime.

---

## File Structure

- `packages/deploy/deploy-core/src/config.ts` - add storage config types and a pinned default RustFS image constant.
- `packages/deploy/deploy-core/src/plan.ts` - add planned object-storage infrastructure, validation, deterministic names.
- `packages/deploy/deploy-core/src/index.ts` - export storage config and planned object-storage types.
- `packages/deploy/deploy-core/test/unit/plan.test.ts` - lock storage planning and validation.
- `packages/platform/platform-core/src/schemas/deploy-target.ts` - add deploy target storage schema.
- `packages/platform/platform-core/src/repos/deploy-target-repo.ts` - add storage config to deploy target insert/update rows.
- `packages/platform/platform-core/src/use-cases/deploy-targets.ts` - persist create/update storage config.
- `packages/platform/platform-core/src/testing/fakes.ts` - preserve storage config in fake deploy target repo.
- `packages/platform/platform-core/test/unit/schemas/deploy-target.test.ts` - lock create/update storage payloads.
- `packages/platform/platform-storage/src/schema/deploy-target.ts` - add `storage_config` JSON column to Drizzle schema.
- `packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts` - persist and hydrate storage config.
- `packages/platform/platform-storage/drizzle/0011_deploy_target_storage.sql` - add storage config migration.
- `packages/platform/platform-storage/test/integration/pg-deploy-target-repo.test.ts` - lock storage config persistence.
- `apps/platform-http/src/deploy/build-deploy-config.ts` - pass deploy target storage config to deploy-core.
- `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts` - lock pass-through.
- `packages/deploy/deploy-dokploy/src/render.ts` - render RustFS Compose, public proxy application, and storage-s3 env.
- `packages/deploy/deploy-dokploy/src/apply.ts` - order object-storage compose before workloads and proxy before edge.
- `packages/deploy/deploy-dokploy/src/client.ts` - allow infrastructure proxy workload kind in rendered application types through imports from `render.ts`.
- `packages/deploy/deploy-dokploy/test/unit/render.test.ts` - lock rendered RustFS resources and env.
- `packages/deploy/deploy-dokploy/test/unit/apply.test.ts` - lock apply ordering and partial failure metadata.
- `modules/storage/s3/package.json` - add AWS SDK presigner dependency for public browser URLs.
- `modules/storage/s3/src/s3-client.ts` - add public endpoint and app origins to env resolution; support separate presign client.
- `modules/storage/s3/src/startup-ensure.ts` - new idempotent bucket/CORS/lifecycle ensure helper.
- `modules/storage/s3/src/bin/server.ts` - call startup ensure for provisioned RustFS before starting gRPC.
- `modules/storage/s3/test/unit/s3-client-env.test.ts` - lock public endpoint/app origins parsing.
- `modules/storage/s3/test/unit/startup-ensure.test.ts` - lock bucket/CORS/lifecycle ensure behavior with mock clients.
- `docs/decision-system.md` - add RustFS current-default bet.
- `docs/current/owners/packages/deploy/deploy-core.md` - document storage config and plan model.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` - document RustFS rendering and public origin.
- `docs/current/owners/modules/storage.md` - document target-level provisioned RustFS.
- `docs/current/owners/modules/storage/s3.md` - document provisioned RustFS env and startup ensure bridge.

## Task 1: Platform Deploy Target Storage Schema

**Files:**
- Modify: `packages/platform/platform-core/src/schemas/deploy-target.ts`
- Modify: `packages/platform/platform-core/test/unit/schemas/deploy-target.test.ts`

- [ ] **Step 1: Add failing schema tests**

Append these tests inside `CreateDeployTargetRequestSchema` / update schema describe block in `packages/platform/platform-core/test/unit/schemas/deploy-target.test.ts`:

```ts
  it('preserves provisioned RustFS storage config on create', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-storage',
      displayName: 'Storage Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      publicBaseUrl: 'https://notes.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      storage: {
        mode: 'provisioned',
        provider: 'rustfs',
        image: 'rustfs/rustfs:1.0.0',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.storage).toEqual({
        mode: 'provisioned',
        provider: 'rustfs',
        image: 'rustfs/rustfs:1.0.0',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      });
    }
  });

  it('defaults omitted storage config to external on create', () => {
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
    if (r.success) expect(r.data.storage).toEqual({ mode: 'external' });
  });

  it('preserves provisioned RustFS storage config on patch and allows external', () => {
    const enabled = UpdateDeployTargetRequestSchema.parse({
      storage: {
        mode: 'provisioned',
        provider: 'rustfs',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
    });
    expect(enabled.storage).toEqual({
      mode: 'provisioned',
      provider: 'rustfs',
      publicBaseUrl: 'https://storage.example.test',
      accessKeyRef: 'RUSTFS_ACCESS_KEY',
      secretKeyRef: 'RUSTFS_SECRET_KEY',
    });

    const external = UpdateDeployTargetRequestSchema.parse({ storage: { mode: 'external' } });
    expect(external.storage).toEqual({ mode: 'external' });
  });

  it('rejects invalid provisioned RustFS storage config', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-storage',
      displayName: 'Storage Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
      storage: {
        mode: 'provisioned',
        provider: 'minio',
        publicBaseUrl: 'ftp://storage.example.test',
        accessKeyRef: '',
        secretKeyRef: '',
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(false);
  });
```

- [ ] **Step 2: Run schema tests and verify failure**

Run: `pnpm -F @rntme/platform-core vitest run test/unit/schemas/deploy-target.test.ts`

Expected: FAIL with unknown key or missing `storage` assertions.

- [ ] **Step 3: Implement storage schemas**

In `packages/platform/platform-core/src/schemas/deploy-target.ts`, add these schemas after `DeployTargetWorkflowsSchema`:

```ts
const ExternalStorageConfigSchema = z
  .object({
    mode: z.literal('external'),
  })
  .strict();

const ProvisionedRustfsStorageConfigSchema = z
  .object({
    mode: z.literal('provisioned'),
    provider: z.literal('rustfs'),
    image: z.string().min(1).optional(),
    publicBaseUrl: HttpUrlSchema,
    accessKeyRef: z.string().min(1),
    secretKeyRef: z.string().min(1),
  })
  .strict();

export const DeployTargetStorageSchema = z
  .discriminatedUnion('mode', [ExternalStorageConfigSchema, ProvisionedRustfsStorageConfigSchema])
  .default({ mode: 'external' });
export type DeployTargetStorage = z.infer<typeof DeployTargetStorageSchema>;
const PatchDeployTargetStorageSchema = z
  .discriminatedUnion('mode', [ExternalStorageConfigSchema, ProvisionedRustfsStorageConfigSchema])
  .optional();
```

Add `storage: DeployTargetStorageSchema,` to `CreateDeployTargetRequestSchema` and `DeployTargetSchema`. Add `storage: PatchDeployTargetStorageSchema,` to `UpdateDeployTargetRequestSchema`.

- [ ] **Step 4: Run schema tests and verify pass**

Run: `pnpm -F @rntme/platform-core vitest run test/unit/schemas/deploy-target.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/platform/platform-core/src/schemas/deploy-target.ts packages/platform/platform-core/test/unit/schemas/deploy-target.test.ts
git commit -m "feat(platform-core): add deploy target storage config"
```

## Task 2: Platform Deploy Target Storage Persistence

**Files:**
- Modify: `packages/platform/platform-core/src/repos/deploy-target-repo.ts`
- Modify: `packages/platform/platform-core/src/use-cases/deploy-targets.ts`
- Modify: `packages/platform/platform-core/src/testing/fakes.ts`
- Modify: `packages/platform/platform-storage/src/schema/deploy-target.ts`
- Modify: `packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts`
- Create: `packages/platform/platform-storage/drizzle/0011_deploy_target_storage.sql`
- Modify: `packages/platform/platform-storage/test/integration/pg-deploy-target-repo.test.ts`

- [ ] **Step 1: Add failing persistence test**

In `packages/platform/platform-storage/test/integration/pg-deploy-target-repo.test.ts`, add this test after the existing create/read test:

```ts
  it('persists provisioned RustFS storage config', async () => {
    const targetId = randomUUID();
    const created = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgDeployTargetRepo(client);
      return repo.create({
        row: {
          ...targetRow({ id: targetId, slug: 'storage' }),
          storageConfig: {
            mode: 'provisioned',
            provider: 'rustfs',
            publicBaseUrl: 'https://storage.example.test',
            accessKeyRef: 'RUSTFS_ACCESS_KEY',
            secretKeyRef: 'RUSTFS_SECRET_KEY',
          },
        },
        auditActorAccountId: accountId,
        auditActorTokenId: null,
      });
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.storage).toEqual({
      mode: 'provisioned',
      provider: 'rustfs',
      publicBaseUrl: 'https://storage.example.test',
      accessKeyRef: 'RUSTFS_ACCESS_KEY',
      secretKeyRef: 'RUSTFS_SECRET_KEY',
    });

    const updated = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgDeployTargetRepo(client);
      return repo.update({
        orgId,
        slug: 'storage',
        patch: {
          storageConfig: {
            mode: 'provisioned',
            provider: 'rustfs',
            image: 'rustfs/rustfs:1.0.0',
            publicBaseUrl: 'https://storage-2.example.test',
            accessKeyRef: 'RUSTFS_ACCESS_KEY_2',
            secretKeyRef: 'RUSTFS_SECRET_KEY_2',
          },
        },
        auditActorAccountId: accountId,
        auditActorTokenId: null,
      });
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.storage).toEqual({
      mode: 'provisioned',
      provider: 'rustfs',
      image: 'rustfs/rustfs:1.0.0',
      publicBaseUrl: 'https://storage-2.example.test',
      accessKeyRef: 'RUSTFS_ACCESS_KEY_2',
      secretKeyRef: 'RUSTFS_SECRET_KEY_2',
    });
  });
```

- [ ] **Step 2: Run persistence test and verify failure**

Run: `pnpm -F @rntme/platform-storage vitest run test/integration/pg-deploy-target-repo.test.ts`

Expected: FAIL because deploy target rows do not have `storageConfig` and the DB lacks `storage_config`.

- [ ] **Step 3: Add storage config to repo contracts and use cases**

In `packages/platform/platform-core/src/repos/deploy-target-repo.ts`, import `DeployTargetStorage` and add:

```ts
readonly storageConfig: DeployTargetStorage;
```

to `DeployTargetInsertRow`, and:

```ts
readonly storageConfig?: DeployTargetStorage;
```

to `DeployTargetUpdateRow`.

In `packages/platform/platform-core/src/use-cases/deploy-targets.ts`, add `storageConfig: input.req.storage,` to create row and:

```ts
if (input.patch.storage !== undefined) patch.storageConfig = input.patch.storage;
```

to update patch construction.

In `packages/platform/platform-core/src/testing/fakes.ts`, add `storage: args.row.storageConfig,` to the stored target object.

In `packages/platform/platform-storage/test/integration/pg-deploy-target-repo.test.ts`, add `storageConfig: { mode: 'external' },` to the `targetRow` helper.

- [ ] **Step 4: Add Postgres schema and repo persistence**

Create `packages/platform/platform-storage/drizzle/0011_deploy_target_storage.sql`:

```sql
ALTER TABLE "deploy_target" ADD COLUMN "storage_config" jsonb DEFAULT '{"mode":"external"}'::jsonb NOT NULL;
```

In `packages/platform/platform-storage/src/schema/deploy-target.ts`, add:

```ts
storageConfig: jsonb('storage_config').$type<Record<string, unknown>>().notNull().default({ mode: 'external' }),
```

after `eventBusConfig`.

In `packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts`:

- add `storage_config` to the insert column list after `event_bus_config`;
- add one extra SQL placeholder in the `VALUES` list;
- add `args.row.storageConfig` after `args.row.eventBusConfig`;
- add `addSet(sets, values, 'storage_config', args.patch.storageConfig);` in update;
- add `storage: (r['storage_config'] ?? { mode: 'external' }) as DeployTargetStorage,` in `rowToTarget`.

- [ ] **Step 5: Run platform storage and platform core tests**

Run:

```bash
pnpm -F @rntme/platform-storage vitest run test/integration/pg-deploy-target-repo.test.ts
pnpm -F @rntme/platform-core test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/platform/platform-core/src/repos/deploy-target-repo.ts packages/platform/platform-core/src/use-cases/deploy-targets.ts packages/platform/platform-core/src/testing/fakes.ts packages/platform/platform-storage/src/schema/deploy-target.ts packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts packages/platform/platform-storage/drizzle/0011_deploy_target_storage.sql packages/platform/platform-storage/test/integration/pg-deploy-target-repo.test.ts
git commit -m "feat(platform-storage): persist deploy target storage config"
```

## Task 3: Deploy-core Object Storage Plan

**Files:**
- Modify: `packages/deploy/deploy-core/src/config.ts`
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Modify: `packages/deploy/deploy-core/src/index.ts`
- Modify: `packages/deploy/deploy-core/test/unit/plan.test.ts`

- [ ] **Step 1: Add failing plan tests**

Add these tests to `packages/deploy/deploy-core/test/unit/plan.test.ts`:

```ts
  it('defaults object storage infrastructure to none', () => {
    const r = buildProjectDeploymentPlan(project, previewConfig);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.objectStorage).toEqual({ kind: 'none' });
  });

  it('plans provisioned RustFS object storage with deterministic names', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      storage: {
        mode: 'provisioned',
        provider: 'rustfs',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.infrastructure.objectStorage).toEqual({
      kind: 's3-compatible',
      mode: 'provisioned',
      provider: 'rustfs',
      resourceName: 'rntme-acme-commerce-storage',
      internalEndpoint: 'http://rntme-acme-commerce-storage:9000',
      publicBaseUrl: 'https://storage.example.test',
      bucketName: 'rntme-acme-commerce-default-storage',
      region: 'us-east-1',
      forcePathStyle: true,
      image: 'rustfs/rustfs:1.0.0',
      credentials: {
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
      persistence: {
        mode: 'persistent',
        volumeName: 'rntme-acme-commerce-storage-data',
      },
    });
  });

  it('rejects latest as a provisioned RustFS image tag', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      storage: {
        mode: 'provisioned',
        provider: 'rustfs',
        image: 'rustfs/rustfs:latest',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_STORAGE_IMAGE_INVALID',
          path: 'storage.image',
        }),
      );
    }
  });
```

- [ ] **Step 2: Run plan tests and verify failure**

Run: `pnpm -F @rntme/deploy-core vitest run test/unit/plan.test.ts`

Expected: FAIL because storage config/plan types do not exist.

- [ ] **Step 3: Add config and plan types**

In `packages/deploy/deploy-core/src/config.ts`, add:

```ts
export const DEFAULT_RUSTFS_IMAGE = 'rustfs/rustfs:1.0.0';

export type ExternalStorageConfig = {
  readonly mode: 'external';
};

export type ProvisionedRustfsStorageConfig = {
  readonly mode: 'provisioned';
  readonly provider: 'rustfs';
  readonly image?: string;
  readonly publicBaseUrl: string;
  readonly accessKeyRef: string;
  readonly secretKeyRef: string;
};

export type StorageConfig = ExternalStorageConfig | ProvisionedRustfsStorageConfig;
```

Add `readonly storage?: StorageConfig;` to `ProjectDeploymentConfig`.

In `packages/deploy/deploy-core/src/plan.ts`, import `DEFAULT_RUSTFS_IMAGE` and `StorageConfig`, add `PlannedObjectStorage`, and add `objectStorage` to `ProjectDeploymentPlan.infrastructure`:

```ts
export type PlannedObjectStorage =
  | { readonly kind: 'none' }
  | {
      readonly kind: 's3-compatible';
      readonly mode: 'provisioned';
      readonly provider: 'rustfs';
      readonly resourceName: string;
      readonly internalEndpoint: string;
      readonly publicBaseUrl: string;
      readonly bucketName: string;
      readonly region: 'us-east-1';
      readonly forcePathStyle: true;
      readonly image: string;
      readonly credentials: {
        readonly accessKeyRef: string;
        readonly secretKeyRef: string;
      };
      readonly persistence: {
        readonly mode: 'persistent';
        readonly volumeName: string;
      };
    };
```

Add this helper near `planEventBus`:

```ts
function planObjectStorage(
  storage: StorageConfig | undefined,
  orgSlug: string,
  projectSlug: string,
  errors: DeploymentPlanError[],
): PlannedObjectStorage {
  if (storage === undefined || storage.mode === 'external') return { kind: 'none' };
  if (storage.provider !== 'rustfs') {
    errors.push({
      code: 'DEPLOY_PLAN_STORAGE_PROVIDER_UNSUPPORTED',
      message: `unsupported provisioned storage provider "${String(storage.provider)}"`,
      path: 'storage.provider',
    });
    return { kind: 'none' };
  }
  if (!isPinnedContainerImage(storage.image ?? DEFAULT_RUSTFS_IMAGE)) {
    errors.push({
      code: 'DEPLOY_PLAN_STORAGE_IMAGE_INVALID',
      message: 'provisioned RustFS image must use a non-latest tag',
      path: 'storage.image',
    });
    return { kind: 'none' };
  }
  if (storage.publicBaseUrl.trim() === '') {
    errors.push({
      code: 'DEPLOY_PLAN_STORAGE_PUBLIC_BASE_URL_MISSING',
      message: 'provisioned RustFS storage requires a publicBaseUrl',
      path: 'storage.publicBaseUrl',
    });
    return { kind: 'none' };
  }
  if (storage.accessKeyRef.trim() === '' || storage.secretKeyRef.trim() === '') {
    errors.push({
      code: 'DEPLOY_PLAN_STORAGE_CREDENTIAL_REF_MISSING',
      message: 'provisioned RustFS storage requires accessKeyRef and secretKeyRef',
      path: 'storage',
    });
    return { kind: 'none' };
  }
  const resource = resourceName(orgSlug, projectSlug, 'storage');
  return {
    kind: 's3-compatible',
    mode: 'provisioned',
    provider: 'rustfs',
    resourceName: resource,
    internalEndpoint: `http://${resource}:9000`,
    publicBaseUrl: storage.publicBaseUrl,
    bucketName: `${resourceName(orgSlug, projectSlug, 'default-storage')}`,
    region: 'us-east-1',
    forcePathStyle: true,
    image: storage.image ?? DEFAULT_RUSTFS_IMAGE,
    credentials: {
      accessKeyRef: storage.accessKeyRef,
      secretKeyRef: storage.secretKeyRef,
    },
    persistence: {
      mode: 'persistent',
      volumeName: `${resource}-data`,
    },
  };
}
```

Call it in `buildProjectDeploymentPlan` before returning:

```ts
const plannedObjectStorage = planObjectStorage(config.storage, config.orgSlug, project.name, errors);
```

Add `objectStorage: plannedObjectStorage,` to `infrastructure`.

Export new types and constant from `packages/deploy/deploy-core/src/index.ts`.

- [ ] **Step 4: Run deploy-core tests**

Run: `pnpm -F @rntme/deploy-core test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-core/src/config.ts packages/deploy/deploy-core/src/plan.ts packages/deploy/deploy-core/src/index.ts packages/deploy/deploy-core/test/unit/plan.test.ts
git commit -m "feat(deploy-core): plan provisioned rustfs storage"
```

## Task 4: Platform HTTP Pass-through

**Files:**
- Modify: `apps/platform-http/src/deploy/build-deploy-config.ts`
- Modify: `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts`

- [ ] **Step 1: Add failing pass-through test**

Add this test to `describe('buildProjectDeploymentConfig')` in `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts`:

```ts
  it('passes provisioned RustFS storage config through to deploy-core', () => {
    const config = buildProjectDeploymentConfig(
      {
        ...target(),
        storage: {
          mode: 'provisioned',
          provider: 'rustfs',
          image: 'rustfs/rustfs:1.0.0',
          publicBaseUrl: 'https://storage.example.test',
          accessKeyRef: 'RUSTFS_ACCESS_KEY',
          secretKeyRef: 'RUSTFS_SECRET_KEY',
        },
      },
      'acme',
      {},
    );

    expect(config.storage).toEqual({
      mode: 'provisioned',
      provider: 'rustfs',
      image: 'rustfs/rustfs:1.0.0',
      publicBaseUrl: 'https://storage.example.test',
      accessKeyRef: 'RUSTFS_ACCESS_KEY',
      secretKeyRef: 'RUSTFS_SECRET_KEY',
    });
  });
```

Update the `target()` fixture to include `storage: { mode: 'external' },`.

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy/build-deploy-config.test.ts`

Expected: FAIL because `buildProjectDeploymentConfig` does not pass `target.storage`.

- [ ] **Step 3: Pass storage through**

In `apps/platform-http/src/deploy/build-deploy-config.ts`, add `storage: target.storage,` to the object returned by `buildProjectDeploymentConfig`.

- [ ] **Step 4: Run test and verify pass**

Run: `pnpm -F @rntme/platform-http vitest run test/unit/deploy/build-deploy-config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/deploy/build-deploy-config.ts apps/platform-http/test/unit/deploy/build-deploy-config.test.ts
git commit -m "feat(platform-http): pass storage deploy config"
```

## Task 5: Dokploy RustFS Rendering

**Files:**
- Modify: `packages/deploy/deploy-core/src/composed-project.ts`
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`

- [ ] **Step 1: Add failing render tests**

Add an integration-module service to the test `plan.workloads` fixture in `packages/deploy/deploy-dokploy/test/unit/render.test.ts`:

```ts
    {
      kind: 'integration-module',
      slug: 'storage-s3',
      serviceSlug: 'storage-s3',
      resourceName: 'rntme-acme-commerce-storage-s3',
      image: 'ghcr.io/acme/storage-s3:test',
      expose: false,
      env: {},
      secretRefs: {},
      modulePackageName: '@rntme/storage-s3',
    },
```

Add this test:

```ts
  it('renders provisioned RustFS compose, public proxy, and storage-s3 env', () => {
    const r = renderDokployPlan(
      {
        ...plan,
        infrastructure: {
          ...plan.infrastructure,
          objectStorage: {
            kind: 's3-compatible',
            mode: 'provisioned',
            provider: 'rustfs',
            resourceName: 'rntme-acme-commerce-storage',
            internalEndpoint: 'http://rntme-acme-commerce-storage:9000',
            publicBaseUrl: 'https://storage.example.test',
            bucketName: 'rntme-acme-commerce-default-storage',
            region: 'us-east-1',
            forcePathStyle: true,
            image: 'rustfs/rustfs:1.0.0',
            credentials: {
              accessKeyRef: 'RUSTFS_ACCESS_KEY',
              secretKeyRef: 'RUSTFS_SECRET_KEY',
            },
            persistence: {
              mode: 'persistent',
              volumeName: 'rntme-acme-commerce-storage-data',
            },
          },
        },
      },
      {
        endpoint: 'https://dokploy.example.com',
        projectId: 'project_123',
        publicBaseUrl: 'https://commerce.example.com',
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resources.map((resource) => `${resource.kind}:${resource.logicalId}`)).toEqual([
      'compose:object-storage',
      'application:object-storage-public',
      'application:catalog',
      'application:storage-s3',
      'application:edge',
    ]);

    const rustfs = r.value.resources[0];
    expect(rustfs).toMatchObject({
      kind: 'compose',
      infrastructureKind: 'object-storage',
      name: 'rntme-acme-commerce-storage',
      image: 'rustfs/rustfs:1.0.0',
      labels: {
        'rntme.infrastructure': 'object-storage',
        'rntme.provider': 'rustfs',
      },
    });
    if (rustfs.kind !== 'compose') return;
    expect(rustfs.env).toEqual([
      { name: 'RUSTFS_ACCESS_KEY', value: 'RUSTFS_ACCESS_KEY', secret: true },
      { name: 'RUSTFS_SECRET_KEY', value: 'RUSTFS_SECRET_KEY', secret: true },
    ]);
    expect(rustfs.composeFile).toContain('rustfs/rustfs:1.0.0');
    expect(rustfs.composeFile).toContain('rntme-acme-commerce-storage-data');
    expect(rustfs.composeFile).toContain('dokploy-network');

    const proxy = r.value.resources.find((resource) => resource.logicalId === 'object-storage-public');
    expect(proxy).toMatchObject({
      kind: 'application',
      workloadKind: 'infrastructure-proxy',
      name: 'rntme-acme-commerce-storage-public',
      image: 'nginx:1.27-alpine',
      ingress: {
        publicBaseUrl: 'https://storage.example.test',
        containerPort: 8080,
        healthPath: '/health',
      },
    });
    expect(proxy?.files?.['/etc/nginx/nginx.conf']).toContain('proxy_pass http://rntme-acme-commerce-storage:9000');

    const storageModule = r.value.resources.find((resource) => resource.logicalId === 'storage-s3');
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_ENDPOINT',
      value: 'http://rntme-acme-commerce-storage:9000',
      secret: false,
    });
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_PUBLIC_ENDPOINT',
      value: 'https://storage.example.test',
      secret: false,
    });
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_ACCESS_KEY_ID',
      value: 'RUSTFS_ACCESS_KEY',
      secret: true,
    });
    expect(storageModule?.env).toContainEqual({
      name: 'STORAGE_S3_APP_ORIGINS',
      value: 'https://commerce.example.com',
      secret: false,
    });
  });
```

- [ ] **Step 2: Run render test and verify failure**

Run: `pnpm -F @rntme/deploy-dokploy vitest run test/unit/render.test.ts`

Expected: FAIL because render has no object-storage support.

- [ ] **Step 3: Add module identity to deploy-core workload type**

In `packages/deploy/deploy-core/src/composed-project.ts`, change `ComposedProjectModuleInfo` to:

```ts
export type ComposedProjectModuleInfo = {
  readonly packageName?: string;
  readonly edgeAuth?: EdgeAuthDescriptor | null;
};
```

In `packages/deploy/deploy-core/src/plan.ts`, add `readonly modulePackageName?: string;` to `IntegrationModuleWorkload` and set it in `buildWorkloads`:

```ts
      ...(project.modules?.[service.slug]?.packageName === undefined
        ? {}
        : { modulePackageName: project.modules[service.slug]!.packageName }),
```

In `apps/platform-http/src/deploy/executor.ts`, set module package names in `toDeployCoreInput`:

```ts
      modules[slug] = { edgeAuth, packageName: manifestName };
```

- [ ] **Step 4: Implement RustFS render helpers**

In `packages/deploy/deploy-dokploy/src/render.ts`, change `RenderedDokployComposeResource.infrastructureKind` to:

```ts
  readonly infrastructureKind: 'event-bus' | 'workflow-engine' | 'object-storage';
```

Change `RenderedDokployApplicationResource.workloadKind` to:

```ts
  readonly workloadKind: DeploymentWorkload['kind'] | 'infrastructure-proxy';
```

Add object storage to `renderInfrastructureResources`:

```ts
  const objectStorage = plan.infrastructure.objectStorage;
  if (objectStorage.kind === 's3-compatible') {
    resources.push(renderRustfsCompose(plan));
    resources.push(renderRustfsPublicProxy(plan));
  }
```

Add helpers:

```ts
function renderRustfsCompose(plan: ProjectDeploymentPlan): RenderedDokployComposeResource {
  const storage = plan.infrastructure.objectStorage;
  if (storage.kind !== 's3-compatible') throw new Error('renderRustfsCompose called without object storage');
  return {
    logicalId: 'object-storage',
    kind: 'compose',
    infrastructureKind: 'object-storage',
    name: storage.resourceName,
    image: storage.image,
    composeFile: rustfsComposeFile(storage),
    env: [
      { name: 'RUSTFS_ACCESS_KEY', value: storage.credentials.accessKeyRef, secret: true },
      { name: 'RUSTFS_SECRET_KEY', value: storage.credentials.secretKeyRef, secret: true },
    ],
    labels: {
      ...dokployLabels(plan.project.orgSlug, plan.project.projectSlug, plan.project.environment, 'object-storage'),
      'rntme.infrastructure': 'object-storage',
      'rntme.provider': storage.provider,
    },
  };
}

function rustfsComposeFile(storage: Extract<ProjectDeploymentPlan['infrastructure']['objectStorage'], { kind: 's3-compatible' }>): string {
  return [
    'services:',
    '  rustfs:',
    `    image: ${storage.image}`,
    '    command: server /data',
    '    environment:',
    '      RUSTFS_ACCESS_KEY: ${RUSTFS_ACCESS_KEY}',
    '      RUSTFS_SECRET_KEY: ${RUSTFS_SECRET_KEY}',
    '    volumes:',
    `      - ${storage.persistence.volumeName}:/data`,
    '    networks:',
    '      default:',
    '      dokploy-network:',
    '        aliases:',
    `          - ${storage.resourceName}`,
    'volumes:',
    `  ${storage.persistence.volumeName}:`,
    `    name: ${storage.persistence.volumeName}`,
    'networks:',
    '  dokploy-network:',
    '    external: true',
    '',
  ].join('\n');
}

function renderRustfsPublicProxy(plan: ProjectDeploymentPlan): RenderedDokployApplicationResource {
  const storage = plan.infrastructure.objectStorage;
  if (storage.kind !== 's3-compatible') throw new Error('renderRustfsPublicProxy called without object storage');
  return {
    logicalId: 'object-storage-public',
    kind: 'application',
    workloadKind: 'infrastructure-proxy',
    workloadSlug: 'object-storage-public',
    name: `${storage.resourceName}-public`,
    image: 'nginx:1.27-alpine',
    env: [],
    labels: {
      ...dokployLabels(plan.project.orgSlug, plan.project.projectSlug, plan.project.environment, 'object-storage-public'),
      'rntme.infrastructure': 'object-storage-public',
      'rntme.provider': storage.provider,
    },
    ports: [{ containerPort: 8080, protocol: 'http' }],
    ingress: {
      publicBaseUrl: storage.publicBaseUrl,
      containerPort: 8080,
      healthPath: '/health',
      routes: [],
    },
    files: {
      '/etc/nginx/nginx.conf': rustfsProxyNginxConfig(storage.resourceName),
    },
  };
}

function rustfsProxyNginxConfig(resourceName: string): string {
  return [
    'events {}',
    'http {',
    '  server {',
    '    listen 8080;',
    '    client_max_body_size 0;',
    '    location = /health { return 200 "ok"; }',
    '    location / {',
    `      proxy_pass http://${resourceName}:9000;`,
    '      proxy_set_header Host $host;',
    '      proxy_set_header X-Forwarded-Proto $scheme;',
    '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '      proxy_request_buffering off;',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}
```

In `renderResource` integration-module branch, append storage env when `workload.modulePackageName === '@rntme/storage-s3'`:

```ts
        ...storageS3Env(plan, workload, publicAppBaseUrl),
```

Add helper:

```ts
function storageS3Env(
  plan: ProjectDeploymentPlan,
  workload: Extract<DeploymentWorkload, { kind: 'integration-module' }>,
  publicAppBaseUrl: string,
): RenderedEnvVar[] {
  const storage = plan.infrastructure.objectStorage;
  if (storage.kind !== 's3-compatible') return [];
  if (workload.modulePackageName !== '@rntme/storage-s3') return [];
  return [
    { name: 'STORAGE_S3_ENDPOINT', value: storage.internalEndpoint, secret: false },
    { name: 'STORAGE_S3_PUBLIC_ENDPOINT', value: storage.publicBaseUrl, secret: false },
    { name: 'STORAGE_S3_BUCKET', value: storage.bucketName, secret: false },
    { name: 'STORAGE_S3_REGION', value: storage.region, secret: false },
    { name: 'STORAGE_S3_FORCE_PATH_STYLE', value: String(storage.forcePathStyle), secret: false },
    { name: 'STORAGE_S3_ACCESS_KEY_ID', value: storage.credentials.accessKeyRef, secret: true },
    { name: 'STORAGE_S3_SECRET_ACCESS_KEY', value: storage.credentials.secretKeyRef, secret: true },
    { name: 'STORAGE_S3_BACKEND', value: storage.provider, secret: false },
    { name: 'STORAGE_S3_APP_ORIGINS', value: publicAppBaseUrl, secret: false },
  ];
}
```

Since `ProjectDeploymentPlan` does not carry Dokploy `publicBaseUrl`, pass the app origin into `storageS3Env` from `renderDokployPlan` config: add a `publicAppBaseUrl` parameter to `renderWorkloadResources`, `renderResource`, and `storageS3Env`; use `config.publicBaseUrl` at the call site.

- [ ] **Step 5: Run render tests**

Run: `pnpm -F @rntme/deploy-dokploy vitest run test/unit/render.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-core/src/composed-project.ts packages/deploy/deploy-core/src/plan.ts apps/platform-http/src/deploy/executor.ts packages/deploy/deploy-dokploy/src/render.ts packages/deploy/deploy-dokploy/test/unit/render.test.ts
git commit -m "feat(deploy-dokploy): render provisioned rustfs storage"
```

## Task 6: Dokploy Apply Ordering

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`

- [ ] **Step 1: Add failing apply ordering test**

Add this test to `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`:

```ts
  it('applies object storage before storage public proxy and workloads', async () => {
    const client = new FakeDokployClient();
    const objectStorage: Extract<RenderedDokployResource, { kind: 'compose' }> = {
      logicalId: 'object-storage',
      kind: 'compose',
      infrastructureKind: 'object-storage',
      name: 'rntme-acme-commerce-storage',
      image: 'rustfs/rustfs:1.0.0',
      composeFile: 'services:\n  rustfs:\n    image: rustfs/rustfs:1.0.0\n',
      env: [],
      labels: { 'rntme.infrastructure': 'object-storage' },
    };
    const proxy = resource({
      logicalId: 'object-storage-public',
      workloadKind: 'infrastructure-proxy',
      workloadSlug: 'object-storage-public',
      name: 'rntme-acme-commerce-storage-public',
      image: 'nginx:1.27-alpine',
      env: [],
    });

    const r = await applyDokployPlan(
      {
        ...rendered,
        resources: [rendered.resources[0], proxy, objectStorage],
      },
      client,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(client.lifecycleCalls).toEqual([
      'create-compose:rntme-acme-commerce-storage',
      'configure-compose:compose_1:rntme-acme-commerce-storage',
      'deploy-compose:compose_1',
      'create:rntme-acme-commerce-catalog',
      'create:rntme-acme-commerce-storage-public',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
      'inspect:app_1',
      'configure:app_2:rntme-acme-commerce-storage-public',
      'deploy:app_2',
      'inspect:app_2',
    ]);
    expect(r.value.resources.map((resource) => resource.logicalId)).toEqual([
      'object-storage',
      'catalog',
      'object-storage-public',
    ]);
  });
```

- [ ] **Step 2: Run apply test and verify failure**

Run: `pnpm -F @rntme/deploy-dokploy vitest run test/unit/apply.test.ts`

Expected: FAIL because `resourceRank` does not know `object-storage`.

- [ ] **Step 3: Implement ordering**

In `packages/deploy/deploy-dokploy/src/apply.ts`, update `resourceRank`:

```ts
  if (resource.kind === 'compose' && resource.infrastructureKind === 'event-bus') return 0;
  if (resource.kind === 'compose' && resource.infrastructureKind === 'object-storage') return 1;
  if (resource.kind === 'compose' && resource.infrastructureKind === 'workflow-engine') return 2;
  if (resource.kind === 'application' && resource.workloadKind === 'domain-service') return 3;
  if (resource.kind === 'application' && resource.workloadKind === 'integration-module') return 3;
  if (resource.kind === 'application' && resource.workloadKind === 'infrastructure-proxy') return 4;
  if (resource.kind === 'application' && resource.workloadKind === 'bpmn-worker') return 5;
  if (resource.kind === 'application' && resource.workloadKind === 'edge-gateway') return 6;
```

In `packages/deploy/deploy-dokploy/src/render.ts`, ensure the rendered type unions include the new values:

```ts
readonly workloadKind: DeploymentWorkload['kind'] | 'infrastructure-proxy';
readonly infrastructureKind: 'event-bus' | 'workflow-engine' | 'object-storage';
```

- [ ] **Step 4: Run apply tests**

Run: `pnpm -F @rntme/deploy-dokploy vitest run test/unit/apply.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/apply.ts packages/deploy/deploy-dokploy/test/unit/apply.test.ts
git commit -m "feat(deploy-dokploy): order object storage resources"
```

## Task 7: Storage-s3 Public Endpoint Parsing and Presign

**Files:**
- Modify: `modules/storage/s3/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `modules/storage/s3/src/s3-client.ts`
- Modify: `modules/storage/s3/src/handler.ts`
- Modify: `modules/storage/s3/test/unit/s3-client-env.test.ts`
- Modify: `modules/storage/s3/test/unit/handler.test.ts`

- [ ] **Step 1: Add failing env and presign tests**

In `modules/storage/s3/test/unit/s3-client-env.test.ts`, extend the first test expected object:

```ts
      endpoint: 'http://localhost:9000',
      publicEndpoint: 'https://storage.example.test',
      appOrigins: ['https://app.example.test', 'https://admin.example.test'],
      backend: 'rustfs',
```

Also include these env values in the test input:

```ts
      STORAGE_S3_PUBLIC_ENDPOINT: 'https://storage.example.test',
      STORAGE_S3_APP_ORIGINS: 'https://app.example.test, https://admin.example.test',
      STORAGE_S3_BACKEND: 'rustfs',
```

Add this test to `modules/storage/s3/test/unit/handler.test.ts`:

```ts
  it('uses public presign URLs while keeping internal object operations', async () => {
    const calls: string[] = [];
    const s3 = {
      presign: vi.fn((key: string) => `https://storage.example.test/${key}?sig=x`),
      exists: vi.fn(async (key: string) => {
        calls.push(`exists:${key}`);
        return true;
      }),
      size: vi.fn(async (key: string) => {
        calls.push(`size:${key}`);
        return 42;
      }),
      deleteObject: vi.fn(async (key: string) => {
        calls.push(`delete:${key}`);
      }),
    };
    const handler = createHandler({
      storage: sj,
      s3,
      pendingStore: createPendingStore({
        db: new Database(':memory:') as unknown as DatabaseLike,
        now: () => 1_000_000,
      }),
      routeResolver: createRouteResolver(sj),
      bus: { async publish() {} },
      uuid: () => 'public-uuid',
      now: () => 1_000_000,
      presignTtlSec: 900,
    });

    const init = await handler.PrepareUpload({
      context: { idempotency_key: 'pub', correlation_id: 'c', actor_user_id: 'u' },
      route_id: 'img',
      entity_id: 'e',
      filename: 'x.png',
      content_type: 'image/png',
      declared_size: 100,
    });
    expect(init.presigned.url).toBe('https://storage.example.test/img/e/public-uuid?sig=x');
    await handler.CommitUpload({ context: { idempotency_key: 'commit', correlation_id: 'c' }, file_id: init.file_id });
    expect(calls).toEqual(['exists:img/e/public-uuid', 'size:img/e/public-uuid']);
  });
```

- [ ] **Step 2: Run storage unit tests and verify failure**

Run: `pnpm -F @rntme/storage-s3 vitest run test/unit/s3-client-env.test.ts test/unit/handler.test.ts`

Expected: FAIL because env parsing lacks public endpoint/app origins/backend.

- [ ] **Step 3: Add presigner dependency and update S3 client options**

In `modules/storage/s3/package.json`, add dependency:

```json
"@aws-sdk/s3-request-presigner": "^3.650.0"
```

Run: `pnpm install --lockfile-only`

Expected: `pnpm-lock.yaml` updates the `modules/storage/s3` importer with `@aws-sdk/s3-request-presigner`.

In `modules/storage/s3/src/s3-client.ts`, update `S3ClientOptions`:

```ts
export interface S3ClientOptions {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  publicEndpoint?: string;
  region?: string;
  forcePathStyle?: boolean;
  backend?: string;
  appOrigins: readonly string[];
}
```

Update `resolveS3OptionsFromEnv` return value:

```ts
      endpoint: env.STORAGE_S3_ENDPOINT,
      publicEndpoint: env.STORAGE_S3_PUBLIC_ENDPOINT,
      region: env.STORAGE_S3_REGION ?? 'us-east-1',
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
      backend: env.STORAGE_S3_BACKEND,
      appOrigins: splitCsv(env.STORAGE_S3_APP_ORIGINS),
```

Add helper:

```ts
function splitCsv(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
```

Add AWS SDK presign support in `modules/storage/s3/src/s3-client.ts`:

```ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
```

Update `createBunS3Client` so object operations still use Bun's internal endpoint, while presign uses `publicEndpoint` when set:

```ts
  const presignClient =
    opts.publicEndpoint === undefined
      ? null
      : new S3Client({
          endpoint: opts.publicEndpoint,
          region: opts.region ?? 'us-east-1',
          forcePathStyle: opts.forcePathStyle,
          credentials: {
            accessKeyId: opts.accessKeyId,
            secretAccessKey: opts.secretAccessKey,
          },
        });
```

Inside returned `presign`, use:

```ts
      if (presignClient !== null) {
        const command =
          args.method === 'PUT'
            ? new PutObjectCommand({ Bucket: opts.bucket, Key: key, ContentType: args.contentType })
            : new GetObjectCommand({ Bucket: opts.bucket, Key: key });
        return presignWithAws(presignClient, command, args.expiresIn);
      }
```

Add this helper in `s3-client.ts`:

```ts
async function presignWithAws(
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand,
  expiresIn: number,
): Promise<string> {
  return getSignedUrl(client, command, { expiresIn });
}
```

Because `S3ClientLike.presign` is synchronous today, change `S3ClientLike.presign` to return `string | Promise<string>` and update `handler.ts` `makePresign` to `await deps.s3.presign(...)`. This requires making `makePresign` async and awaiting it in `PrepareUpload` and `GetDownloadUrl`.

- [ ] **Step 4: Run storage unit tests**

Run: `pnpm -F @rntme/storage-s3 vitest run test/unit/s3-client-env.test.ts test/unit/handler.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/storage/s3/package.json pnpm-lock.yaml modules/storage/s3/src/s3-client.ts modules/storage/s3/src/handler.ts modules/storage/s3/test/unit/s3-client-env.test.ts modules/storage/s3/test/unit/handler.test.ts
git commit -m "feat(storage-s3): support public s3 presign endpoint"
```

## Task 8: Storage-s3 RustFS Startup Ensure

**Files:**
- Create: `modules/storage/s3/src/startup-ensure.ts`
- Modify: `modules/storage/s3/src/bin/server.ts`
- Create: `modules/storage/s3/test/unit/startup-ensure.test.ts`

- [ ] **Step 1: Add failing startup ensure tests**

Create `modules/storage/s3/test/unit/startup-ensure.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ensureRustfsStorage } from '../../src/startup-ensure.js';

const storage = {
  version: '1.0' as const,
  routes: {
    docs: {
      id: 'docs',
      owner: { aggregate: 'Document', association: 'files' },
      maxSize: 1_000_000,
      allowedTypes: ['application/pdf'],
      maxCount: 5,
      auth: { requireRole: null },
      lifecycle: { expirePendingMs: 60_000, retainCommittedMs: 172_800_000 },
    },
  },
};

describe('ensureRustfsStorage', () => {
  it('creates missing bucket and applies CORS and lifecycle', async () => {
    const calls: string[] = [];
    const client = {
      headBucket: vi.fn(async () => {
        calls.push('headBucket');
        const error = new Error('not found') as Error & { $metadata?: { httpStatusCode?: number } };
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }),
      createBucket: vi.fn(async () => {
        calls.push('createBucket');
      }),
      putBucketCors: vi.fn(async () => {
        calls.push('putBucketCors');
      }),
      putBucketLifecycleConfiguration: vi.fn(async () => {
        calls.push('putBucketLifecycleConfiguration');
      }),
    };

    await ensureRustfsStorage({
      client,
      bucket: 'rntme-acme-commerce-default-storage',
      appOrigins: ['https://commerce.example.test'],
      storage,
      log: () => undefined,
    });

    expect(calls).toEqual(['headBucket', 'createBucket', 'putBucketCors', 'putBucketLifecycleConfiguration']);
    expect(client.putBucketCors).toHaveBeenCalledWith({
      Bucket: 'rntme-acme-commerce-default-storage',
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['https://commerce.example.test'],
            AllowedMethods: ['PUT', 'GET', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });
  });

  it('does not fail when lifecycle is unsupported by RustFS', async () => {
    const logs: string[] = [];
    await expect(
      ensureRustfsStorage({
        client: {
          headBucket: async () => undefined,
          createBucket: async () => undefined,
          putBucketCors: async () => undefined,
          putBucketLifecycleConfiguration: async () => {
            const error = new Error('not implemented') as Error & { $metadata?: { httpStatusCode?: number } };
            error.$metadata = { httpStatusCode: 501 };
            throw error;
          },
        },
        bucket: 'b',
        appOrigins: ['https://app.example.test'],
        storage,
        log: (message) => logs.push(message),
      }),
    ).resolves.toBeUndefined();
    expect(logs.join('\n')).toContain('lifecycle unsupported');
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm -F @rntme/storage-s3 vitest run test/unit/startup-ensure.test.ts`

Expected: FAIL because `startup-ensure.ts` does not exist.

- [ ] **Step 3: Implement startup ensure helper**

Create `modules/storage/s3/src/startup-ensure.ts`:

```ts
import type { StorageJsonLike } from './route-resolver.js';

export interface StartupEnsureS3Client {
  headBucket(args: { Bucket: string }): Promise<unknown>;
  createBucket(args: { Bucket: string }): Promise<unknown>;
  putBucketCors(args: { Bucket: string; CORSConfiguration: { CORSRules: unknown[] } }): Promise<unknown>;
  putBucketLifecycleConfiguration(args: { Bucket: string; LifecycleConfiguration: { Rules: unknown[] } }): Promise<unknown>;
}

export async function ensureRustfsStorage(args: {
  client: StartupEnsureS3Client;
  bucket: string;
  appOrigins: readonly string[];
  storage: StorageJsonLike;
  log: (message: string) => void;
}): Promise<void> {
  await ensureBucket(args.client, args.bucket);
  if (args.appOrigins.length > 0) {
    await args.client.putBucketCors({
      Bucket: args.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [...args.appOrigins],
            AllowedMethods: ['PUT', 'GET', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });
  }
  const lifecycleRules = lifecycleRulesFromStorage(args.storage);
  if (lifecycleRules.length === 0) return;
  try {
    await args.client.putBucketLifecycleConfiguration({
      Bucket: args.bucket,
      LifecycleConfiguration: { Rules: lifecycleRules },
    });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 400 || status === 404 || status === 501) {
      args.log(`lifecycle unsupported by RustFS endpoint; continuing without lifecycle rules`);
      return;
    }
    throw error;
  }
}

async function ensureBucket(client: StartupEnsureS3Client, bucket: string): Promise<void> {
  try {
    await client.headBucket({ Bucket: bucket });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404 && status !== undefined) throw error;
    await client.createBucket({ Bucket: bucket });
  }
}

function lifecycleRulesFromStorage(storage: StorageJsonLike): unknown[] {
  const rules: unknown[] = [
    {
      ID: 'abort-multipart-1d',
      Status: 'Enabled',
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
      Filter: {},
    },
  ];
  for (const route of Object.values(storage.routes)) {
    if (route.lifecycle.retainCommittedMs === null) continue;
    rules.push({
      ID: `expire-${route.id}-${Math.ceil(route.lifecycle.retainCommittedMs / 86_400_000)}d`,
      Status: 'Enabled',
      Filter: { Prefix: `${route.id}/` },
      Expiration: { Days: Math.ceil(route.lifecycle.retainCommittedMs / 86_400_000) },
    });
  }
  return rules;
}
```

- [ ] **Step 4: Wire startup ensure into server**

In `modules/storage/s3/src/bin/server.ts`, import AWS SDK commands and helper:

```ts
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ensureRustfsStorage } from '../startup-ensure.js';
```

After `envResolved` and `storage` are available, before `createBunS3Client`, add:

```ts
  if (envResolved.value.backend === 'rustfs') {
    const admin = new S3Client({
      endpoint: envResolved.value.endpoint,
      region: envResolved.value.region,
      forcePathStyle: envResolved.value.forcePathStyle,
      credentials: {
        accessKeyId: envResolved.value.accessKeyId,
        secretAccessKey: envResolved.value.secretAccessKey,
      },
    });
    await ensureRustfsStorage({
      client: {
        headBucket: (args) => admin.send(new HeadBucketCommand(args)),
        createBucket: (args) => admin.send(new CreateBucketCommand(args)),
        putBucketCors: (args) => admin.send(new PutBucketCorsCommand(args as never)),
        putBucketLifecycleConfiguration: (args) =>
          admin.send(new PutBucketLifecycleConfigurationCommand(args as never)),
      },
      bucket: envResolved.value.bucket,
      appOrigins: envResolved.value.appOrigins,
      storage,
      log: (message) => process.stdout.write(`storage-s3 startup ensure: ${message}\n`),
    });
  }
```

- [ ] **Step 5: Run storage tests**

Run: `pnpm -F @rntme/storage-s3 vitest run test/unit/startup-ensure.test.ts test/unit/s3-client-env.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modules/storage/s3/src/startup-ensure.ts modules/storage/s3/src/bin/server.ts modules/storage/s3/test/unit/startup-ensure.test.ts
git commit -m "feat(storage-s3): ensure provisioned rustfs bucket on startup"
```

## Task 9: Docs

**Files:**
- Modify: `docs/decision-system.md`
- Modify: `docs/current/owners/packages/deploy/deploy-core.md`
- Modify: `docs/current/owners/packages/deploy/deploy-dokploy.md`
- Modify: `docs/current/owners/modules/storage.md`
- Modify: `docs/current/owners/modules/storage/s3.md`

- [ ] **Step 1: Update decision-system bet**

In `docs/decision-system.md`, under `### 3.2 Storage / Persistence`, add:

```md
- **RustFS as provisioned object storage (current default)** - target-local S3-compatible storage for preview Dokploy targets; external S3-compatible storage remains supported. · F8, G5 · `current-default` · spec `docs/superpowers/specs/2026-05-08-provisioned-rustfs-storage-design.md`
```

- [ ] **Step 2: Update deploy-core owner doc**

In `docs/current/owners/packages/deploy/deploy-core.md`, add a section after event bus modes:

```md
## Object storage planning

`ProjectDeploymentConfig.storage` supports:

- `{ mode: "external" }` or omitted, which leaves object storage to module provisioners and target secrets.
- `{ mode: "provisioned", provider: "rustfs", publicBaseUrl, accessKeyRef, secretKeyRef, image? }`, which plans one target-local RustFS resource per `org/project/environment`.

Provisioned RustFS plans `infrastructure.objectStorage` with a deterministic internal endpoint, public S3 origin, project bucket, `us-east-1`, path-style access, a persistent volume, and credential refs. The MVP does not add an infrastructure-before-provisioner phase; storage-s3 performs a startup ensure bridge for bucket/CORS/lifecycle.
```

- [ ] **Step 3: Update deploy-dokploy owner doc**

In `docs/current/owners/packages/deploy/deploy-dokploy.md`, add a section near provisioned infrastructure:

```md
## Provisioned RustFS object storage

When `plan.infrastructure.objectStorage.kind === "s3-compatible"` and `provider === "rustfs"`, render adds:

- a RustFS Compose resource on `dokploy-network`;
- a persistent named volume;
- secret env entries for `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY`;
- a public Nginx proxy application bound to `storage.publicBaseUrl`;
- `STORAGE_S3_*` env entries on `@rntme/storage-s3` integration-module workloads.

The public proxy preserves the browser-facing `Host` header so presigned URLs are validated against the public storage origin. File bytes do not flow through the rntme runtime or edge gateway.
```

- [ ] **Step 4: Update storage owner docs**

In `docs/current/owners/modules/storage.md`, add under Backend capability matrix:

```md
Provisioned RustFS on Dokploy is target-level infrastructure, not a module-owned provisioner side effect. It creates one RustFS instance and one bucket per project environment, then wires `@rntme/storage-s3` through S3-compatible env.
```

In `docs/current/owners/modules/storage/s3.md`, add under Invariants & gotchas:

```md
- Provisioned RustFS uses separate internal and public endpoints: server-side S3 calls use `STORAGE_S3_ENDPOINT`, browser presigned URLs use `STORAGE_S3_PUBLIC_ENDPOINT`.
- When `STORAGE_S3_BACKEND=rustfs`, server startup idempotently ensures the project bucket, CORS, and supported lifecycle rules. This is an MVP bridge until deploy can apply infrastructure before running module provisioners.
```

- [ ] **Step 5: Run doc grep checks**

Run:

```bash
rg -n "RustFS|objectStorage|STORAGE_S3_PUBLIC_ENDPOINT|startup ensure" docs/decision-system.md docs/current/owners/packages/deploy docs/current/owners/modules/storage.md docs/current/owners/modules/storage/s3.md
```

Expected: matches in all updated docs.

- [ ] **Step 6: Commit**

```bash
git add docs/decision-system.md docs/current/owners/packages/deploy/deploy-core.md docs/current/owners/packages/deploy/deploy-dokploy.md docs/current/owners/modules/storage.md docs/current/owners/modules/storage/s3.md
git commit -m "docs: document provisioned rustfs storage"
```

## Task 10: Final Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm -F @rntme/deploy-core test
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/platform-core test
pnpm -F @rntme/platform-storage test
pnpm -F @rntme/platform-http test
pnpm -F @rntme/storage-s3 test
```

Expected: all commands PASS.

- [ ] **Step 2: Run typecheck for touched packages**

Run:

```bash
pnpm -F @rntme/deploy-core typecheck
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/platform-core typecheck
pnpm -F @rntme/platform-storage typecheck
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/storage-s3 typecheck
```

Expected: all commands PASS.

- [ ] **Step 3: Run dependency cruiser**

Run: `pnpm depcruise`

Expected: PASS with no new layering violations.

- [ ] **Step 4: Inspect git status**

Run: `git status --short`

Expected: no unstaged files except intentional local artifacts. If generated build outputs appear, remove them only when they are untracked generated outputs and not user edits.

- [ ] **Step 5: Commit verification note only if fixes were needed**

If Step 1, Step 2, or Step 3 required code changes, commit those fixes with:

```bash
git add packages/deploy packages/platform apps/platform-http modules/storage/s3 docs/decision-system.md docs/current
git commit -m "fix: stabilize provisioned rustfs storage"
```

If no fixes were needed, do not create an empty commit.

## Self-review Checklist

- Spec coverage: target-level RustFS config, one project instance, one bucket, public origin, credentials, no deploy phase reorder, startup ensure bridge, docs, and tests are covered.
- Scope check: this is a single vertical feature across deploy planning/rendering/platform schema/storage module; no independent subsystem split is needed.
- Documentation touch: all required docs from the spec are represented in Task 8.
- Verification: package tests, package typechecks, and dependency cruiser are represented in Task 9.
