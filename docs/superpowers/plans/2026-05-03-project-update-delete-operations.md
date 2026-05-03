# Project Update/Delete Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-level update and decommission operations with shared platform operation tracking, CLI commands, basic UI actions, and Dokploy teardown.

**Architecture:** `platform-core` owns lifecycle schemas, operation use-cases, and repository seams. `platform-storage` persists project status, operation records, and operation logs. `platform-http` exposes operation routes, schedules existing deployment updates and a new delete executor, while `apps/cli` remains HTTP-only and `deploy-dokploy` owns the target-specific delete helper.

**Tech Stack:** TypeScript ESM, Zod, Hono, Hono JSX, Vitest, Postgres/Drizzle schema definitions, pg SQL repos, Dokploy HTTP API, Node 20.

---

## File Structure

- `packages/platform/platform-core/src/schemas/entities.ts` - add `ProjectStatusSchema` and `project.status`.
- `packages/platform/platform-core/src/schemas/project-operation.ts` - project operation schemas, request schemas, log schema, and response-facing types.
- `packages/platform/platform-core/src/types/result.ts` - add stable `PROJECT_OPERATION_*` error codes.
- `packages/platform/platform-core/src/repos/project-repo.ts` - add status-aware patch methods.
- `packages/platform/platform-core/src/repos/deployment-repo.ts` - add active deployment and apply-result lookup seams.
- `packages/platform/platform-core/src/repos/project-operation-repo.ts` - new operation repo interface.
- `packages/platform/platform-core/src/use-cases/projects.ts` - reject inactive projects and expose status helpers.
- `packages/platform/platform-core/src/use-cases/project-versions.ts` - reject publish for inactive projects.
- `packages/platform/platform-core/src/use-cases/deployments.ts` - reject direct deploy for inactive projects and add operation-aware deployment creation.
- `packages/platform/platform-core/src/use-cases/project-operations.ts` - start/list/show/log/finalize project update and delete operations.
- `packages/platform/platform-core/src/testing/fakes.ts` - fake project status and project operation repo support.
- `packages/platform/platform-core/src/index.ts` - export new schemas, repo, and use-case.
- `packages/platform/platform-core/test/unit/schemas/entities.test.ts` - project status schema tests.
- `packages/platform/platform-core/test/unit/schemas/project-operation.test.ts` - operation request/schema tests.
- `packages/platform/platform-core/test/unit/use-cases/project-operations.test.ts` - operation use-case tests.
- `packages/platform/platform-storage/drizzle/0007_project_operations.sql` - add `project.status`, operation tables, indexes, RLS policies.
- `packages/platform/platform-storage/src/schema/projects.ts` - Drizzle project status column.
- `packages/platform/platform-storage/src/schema/project-operation.ts` - Drizzle operation tables.
- `packages/platform/platform-storage/src/schema/index.ts` - export operation schema.
- `packages/platform/platform-storage/src/repos/pg-project-repo.ts` - map status and persist status transitions.
- `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts` - active deployment lookup and apply-result resource listing.
- `packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts` - project operation repo implementation.
- `packages/platform/platform-storage/src/index.ts` - export repo and schema.
- `packages/platform/platform-storage/test/integration/pg-project-operation-repo.test.ts` - repo integration tests.
- `packages/deploy/deploy-dokploy/src/client.ts` - extend `DokployClient` with delete methods.
- `packages/deploy/deploy-dokploy/src/delete.ts` - new idempotent delete helper.
- `packages/deploy/deploy-dokploy/src/index.ts` - export delete helper/types.
- `packages/deploy/deploy-dokploy/test/unit/delete.test.ts` - delete ordering, dedupe, missing, and failure tests.
- `apps/platform-http/src/deploy/dokploy-client-factory.ts` - real Dokploy delete API methods.
- `apps/platform-http/src/deploy/project-delete-executor.ts` - delete operation executor.
- `apps/platform-http/src/deploy/orphan-detect.ts` - include stale project operations.
- `apps/platform-http/src/routes/project-operations.ts` - REST operation routes.
- `apps/platform-http/src/app.ts` - wire operation routes, body limit, scheduler, delete executor, orphan detection.
- `apps/platform-http/src/resolve-deps.ts` - add project operation repo.
- `apps/platform-http/src/ui/app.tsx` - project operation UI routes/actions.
- `apps/platform-http/src/ui/pages/project.tsx` - status badge, latest operation panel, update/delete forms.
- `apps/platform-http/src/ui/pages/org.tsx` - project status badges and inactive list behavior.
- `apps/platform-http/src/ui/pages/project-operation.tsx` - operation detail page.
- `apps/platform-http/src/ui/fragments/project-operation-status.tsx` - polling status fragment.
- `apps/platform-http/src/ui/fragments/project-operation-logs.tsx` - polling logs fragment.
- `apps/platform-http/test/unit/routes/project-operations.test.ts` - route tests.
- `apps/platform-http/test/unit/deploy/project-delete-executor.test.ts` - delete executor tests.
- `apps/cli/src/api/types.ts` - operation API schemas.
- `apps/cli/src/api/endpoints.ts` - operation endpoints.
- `apps/cli/src/commands/project/update.ts` - update command.
- `apps/cli/src/commands/project/delete.ts` - delete command.
- `apps/cli/src/commands/project/operation-list.ts` - operation list command.
- `apps/cli/src/commands/project/operation-show.ts` - operation show command.
- `apps/cli/src/commands/project/operation-watch.ts` - operation watch command.
- `apps/cli/src/bin/cli.ts` - command parser wiring.
- `apps/cli/test/unit/commands/project/operation.test.ts` - CLI operation tests.
- `apps/cli/README.md` - document new CLI commands.
- `apps/platform-http/README.md` - document UI/API project lifecycle and CSRF routes.
- `packages/platform/platform-core/README.md` - document operation contracts.
- `packages/platform/platform-storage/README.md` - document operation tables.
- `packages/deploy/deploy-dokploy/README.md` - document delete seam.
- `AGENTS.md` - add update/decommission how-to and project lifecycle notes.

---

### Task 1: Platform-Core Project Status And Operation Schemas

**Files:**
- Modify: `packages/platform/platform-core/src/schemas/entities.ts`
- Create: `packages/platform/platform-core/src/schemas/project-operation.ts`
- Modify: `packages/platform/platform-core/src/types/result.ts`
- Modify: `packages/platform/platform-core/src/index.ts`
- Test: `packages/platform/platform-core/test/unit/schemas/entities.test.ts`
- Test: `packages/platform/platform-core/test/unit/schemas/project-operation.test.ts`
- Test: `packages/platform/platform-core/test/unit/types/result.test.ts`

- [ ] **Step 1: Add failing schema tests**

Append to `packages/platform/platform-core/test/unit/schemas/entities.test.ts`:

```ts
import { ProjectStatusSchema } from '../../../src/schemas/entities.js';

it('ProjectStatusSchema parses project lifecycle states', () => {
  expect(ProjectStatusSchema.options).toEqual([
    'active',
    'deleting',
    'delete_failed',
    'decommissioned',
  ]);
  expect(ProjectStatusSchema.safeParse('active').success).toBe(true);
  expect(ProjectStatusSchema.safeParse('deleted').success).toBe(false);
});
```

Create `packages/platform/platform-core/test/unit/schemas/project-operation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  StartProjectUpdateOperationRequestSchema,
  StartProjectDeleteOperationRequestSchema,
  ProjectOperationSchema,
  ProjectOperationLogLineSchema,
} from '../../../src/schemas/project-operation.js';

describe('project operation schemas', () => {
  it('accepts update by existing project version seq', () => {
    const r = StartProjectUpdateOperationRequestSchema.safeParse({
      projectVersionSeq: 4,
      targetSlug: 'dokploy-preview',
    });

    expect(r.success).toBe(true);
  });

  it('accepts update by uploaded canonical project bundle', () => {
    const r = StartProjectUpdateOperationRequestSchema.safeParse({
      bundle: {
        contentType: 'application/rntme-project-bundle+json',
        bytesBase64: Buffer.from('{"files":{}}').toString('base64'),
      },
    });

    expect(r.success).toBe(true);
  });

  it('rejects update requests with both version and bundle', () => {
    const r = StartProjectUpdateOperationRequestSchema.safeParse({
      projectVersionSeq: 4,
      bundle: {
        contentType: 'application/rntme-project-bundle+json',
        bytesBase64: Buffer.from('{}').toString('base64'),
      },
    });

    expect(r.success).toBe(false);
  });

  it('rejects update requests without a source', () => {
    const r = StartProjectUpdateOperationRequestSchema.safeParse({
      targetSlug: 'dokploy-preview',
    });

    expect(r.success).toBe(false);
  });

  it('requires exact delete confirmation payload shape', () => {
    expect(StartProjectDeleteOperationRequestSchema.safeParse({ confirm: 'notes-demo' }).success).toBe(true);
    expect(StartProjectDeleteOperationRequestSchema.safeParse({}).success).toBe(false);
  });

  it('parses project operation and log line rows', () => {
    const operation = ProjectOperationSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      orgId: '22222222-2222-4222-8222-222222222222',
      projectId: '33333333-3333-4333-8333-333333333333',
      kind: 'delete',
      status: 'queued',
      requestedByAccountId: '44444444-4444-4444-8444-444444444444',
      requestedByTokenId: null,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: { confirm: 'notes-demo' },
      result: null,
      errorCode: null,
      errorMessage: null,
      queuedAt: new Date('2026-05-03T12:00:00Z'),
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
    });
    expect(operation.kind).toBe('delete');

    const line = ProjectOperationLogLineSchema.parse({
      id: 1,
      operationId: operation.id,
      orgId: operation.orgId,
      ts: new Date('2026-05-03T12:00:01Z'),
      level: 'info',
      step: 'teardown',
      message: 'deleted application app_1',
    });
    expect(line.step).toBe('teardown');
  });
});
```

Append to `packages/platform/platform-core/test/unit/types/result.test.ts`:

```ts
  expect(ERROR_CODES.PROJECT_OPERATION_NOT_FOUND).toBe('PROJECT_OPERATION_NOT_FOUND');
  expect(ERROR_CODES.PROJECT_OPERATION_ACTIVE_DEPLOYMENT).toBe('PROJECT_OPERATION_ACTIVE_DEPLOYMENT');
  expect(ERROR_CODES.PROJECT_OPERATION_DEFAULT_TARGET_MISSING).toBe('PROJECT_OPERATION_DEFAULT_TARGET_MISSING');
  expect(ERROR_CODES.PROJECT_OPERATION_INVALID_STATE).toBe('PROJECT_OPERATION_INVALID_STATE');
  expect(ERROR_CODES.PROJECT_OPERATION_CONFIRMATION_MISMATCH).toBe('PROJECT_OPERATION_CONFIRMATION_MISMATCH');
  expect(ERROR_CODES.PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT).toBe('PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT');
  expect(ERROR_CODES.PROJECT_OPERATION_DELETE_TEARDOWN_FAILED).toBe('PROJECT_OPERATION_DELETE_TEARDOWN_FAILED');
```

- [ ] **Step 2: Run schema tests and verify failure**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/schemas/entities.test.ts test/unit/schemas/project-operation.test.ts test/unit/types/result.test.ts
```

Expected: FAIL because `ProjectStatusSchema`, `project-operation.js`, and the new error codes do not exist.

- [ ] **Step 3: Add project status to entity schema**

In `packages/platform/platform-core/src/schemas/entities.ts`, add this near the other entity-level schemas:

```ts
export const ProjectStatusSchema = z.enum(['active', 'deleting', 'delete_failed', 'decommissioned']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
```

Update `ProjectSchema` to include status:

```ts
export const ProjectSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  slug: SlugSchema,
  displayName: z.string().min(1).max(120),
  status: ProjectStatusSchema.default('active'),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Project = z.infer<typeof ProjectSchema>;
```

- [ ] **Step 4: Create operation schemas**

Create `packages/platform/platform-core/src/schemas/project-operation.ts`:

```ts
import { z } from 'zod';
import { SlugSchema, UuidSchema } from './primitives.js';

export const ProjectOperationKindSchema = z.enum(['update', 'delete']);
export type ProjectOperationKind = z.infer<typeof ProjectOperationKindSchema>;

export const ProjectOperationStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type ProjectOperationStatus = z.infer<typeof ProjectOperationStatusSchema>;

export const ProjectOperationSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  projectId: UuidSchema,
  kind: ProjectOperationKindSchema,
  status: ProjectOperationStatusSchema,
  requestedByAccountId: UuidSchema,
  requestedByTokenId: UuidSchema.nullable(),
  targetId: UuidSchema.nullable(),
  projectVersionId: UuidSchema.nullable(),
  deploymentId: UuidSchema.nullable(),
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  queuedAt: z.date(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  lastHeartbeatAt: z.date().nullable(),
});
export type ProjectOperation = z.infer<typeof ProjectOperationSchema>;

export const ProjectOperationLogLineSchema = z.object({
  id: z.number().int().nonnegative(),
  operationId: UuidSchema,
  orgId: UuidSchema,
  ts: z.date(),
  level: z.enum(['info', 'warn', 'error']),
  step: z.string().min(1),
  message: z.string(),
});
export type ProjectOperationLogLine = z.infer<typeof ProjectOperationLogLineSchema>;

export const ProjectOperationBundleSourceSchema = z.object({
  contentType: z.literal('application/rntme-project-bundle+json'),
  bytesBase64: z.string().min(1),
});
export type ProjectOperationBundleSource = z.infer<typeof ProjectOperationBundleSourceSchema>;

export const StartProjectUpdateOperationRequestSchema = z
  .object({
    targetSlug: SlugSchema.optional(),
    projectVersionSeq: z.number().int().positive().optional(),
    bundle: ProjectOperationBundleSourceSchema.optional(),
  })
  .refine((value) => (value.projectVersionSeq === undefined) !== (value.bundle === undefined), {
    message: 'exactly one of projectVersionSeq or bundle is required',
  });
export type StartProjectUpdateOperationRequest = z.infer<typeof StartProjectUpdateOperationRequestSchema>;

export const StartProjectDeleteOperationRequestSchema = z.object({
  confirm: SlugSchema,
});
export type StartProjectDeleteOperationRequest = z.infer<typeof StartProjectDeleteOperationRequestSchema>;

export const ListProjectOperationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
});
export type ListProjectOperationsQuery = z.infer<typeof ListProjectOperationsQuerySchema>;
```

- [ ] **Step 5: Add error codes**

In `packages/platform/platform-core/src/types/result.ts`, append these codes before `DEPLOY_TARGET_NOT_FOUND`:

```ts
  PROJECT_OPERATION_NOT_FOUND: 'PROJECT_OPERATION_NOT_FOUND',
  PROJECT_OPERATION_ACTIVE_DEPLOYMENT: 'PROJECT_OPERATION_ACTIVE_DEPLOYMENT',
  PROJECT_OPERATION_DEFAULT_TARGET_MISSING: 'PROJECT_OPERATION_DEFAULT_TARGET_MISSING',
  PROJECT_OPERATION_INVALID_STATE: 'PROJECT_OPERATION_INVALID_STATE',
  PROJECT_OPERATION_CONFIRMATION_MISMATCH: 'PROJECT_OPERATION_CONFIRMATION_MISMATCH',
  PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT: 'PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT',
  PROJECT_OPERATION_DELETE_TEARDOWN_FAILED: 'PROJECT_OPERATION_DELETE_TEARDOWN_FAILED',
```

- [ ] **Step 6: Export new schemas**

In `packages/platform/platform-core/src/index.ts`, add:

```ts
export * from './schemas/project-operation.js';
```

- [ ] **Step 7: Run tests and verify pass**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/schemas/entities.test.ts test/unit/schemas/project-operation.test.ts test/unit/types/result.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/platform/platform-core/src/schemas/entities.ts packages/platform/platform-core/src/schemas/project-operation.ts packages/platform/platform-core/src/types/result.ts packages/platform/platform-core/src/index.ts packages/platform/platform-core/test/unit/schemas/entities.test.ts packages/platform/platform-core/test/unit/schemas/project-operation.test.ts packages/platform/platform-core/test/unit/types/result.test.ts
git commit -m "feat(platform-core): add project operation schemas"
```

---

### Task 2: Repository Seams, Fake Store, And Core Use-Cases

**Files:**
- Modify: `packages/platform/platform-core/src/repos/project-repo.ts`
- Modify: `packages/platform/platform-core/src/repos/deployment-repo.ts`
- Create: `packages/platform/platform-core/src/repos/project-operation-repo.ts`
- Modify: `packages/platform/platform-core/src/use-cases/projects.ts`
- Modify: `packages/platform/platform-core/src/use-cases/project-versions.ts`
- Modify: `packages/platform/platform-core/src/use-cases/deployments.ts`
- Create: `packages/platform/platform-core/src/use-cases/project-operations.ts`
- Modify: `packages/platform/platform-core/src/testing/fakes.ts`
- Modify: `packages/platform/platform-core/src/index.ts`
- Test: `packages/platform/platform-core/test/unit/use-cases/project-operations.test.ts`

- [ ] **Step 1: Write failing operation use-case tests**

Create `packages/platform/platform-core/test/unit/use-cases/project-operations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  FakeStore,
  SeededIds,
  createProject,
  createDeployTarget,
  publishProjectVersion,
  startProjectDeleteOperation,
  startProjectUpdateOperation,
  finalizeProjectOperation,
  isOk,
  type SecretCipher,
} from '../../../src/index.js';

const cipher: SecretCipher = {
  encrypt: (plaintext) => ({
    ciphertext: Buffer.from(`cipher:${plaintext}`),
    nonce: Buffer.from('nonce'),
    keyVersion: 1,
  }),
  decrypt: (encrypted) => encrypted.ciphertext.toString('utf8').replace(/^cipher:/, ''),
};

async function setup() {
  const store = new FakeStore();
  const ids = new SeededIds([
    'project-1',
    'target-1',
    'version-1',
    'operation-1',
    'deployment-1',
    'operation-2',
  ]);
  const org = await store.seedOrg({ slug: 'acme', workosOrganizationId: 'org_1', displayName: 'Acme' });
  const account = await store.seedAccount({ workosUserId: 'user_1', displayName: 'Ada', email: 'ada@example.com' });
  const project = await createProject({ repos: { projects: store.projects }, ids }, {
    orgId: org.id,
    slug: 'notes-demo',
    displayName: 'Notes Demo',
  });
  if (!isOk(project)) throw new Error('project seed failed');
  const target = await createDeployTarget({ repos: { deployTargets: store.deployTargets }, cipher, ids }, {
    orgId: org.id,
    accountId: account.id,
    tokenId: null,
    req: {
      slug: 'dokploy-preview',
      displayName: 'Dokploy Preview',
      kind: 'dokploy',
      dokployUrl: 'https://dokploy.example.com',
      dokployProjectId: 'dokploy-project-1',
      allowCreateProject: false,
      apiToken: 'secret',
      eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
      modules: {},
      auth: {},
      policyValues: {},
      isDefault: true,
    },
  });
  if (!isOk(target)) throw new Error('target seed failed');
  const version = await publishProjectVersion(
    { repos: { projects: store.projects, projectVersions: store.projectVersions }, blob: store.blob, ids },
    {
      orgId: org.id,
      projectId: project.value.id,
      accountId: account.id,
      tokenId: null,
      bundleBytes: Buffer.from('{"files":{}}'),
      bundleDigest: 'sha256:bundle',
      summary: { projectName: 'notes-demo', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
    },
  );
  if (!isOk(version)) throw new Error('version seed failed');
  return { store, ids, org, account, project: project.value, target: target.value, version: version.value };
}

describe('project operations use-cases', () => {
  it('starts update using the default target and creates a linked deployment', async () => {
    const { store, ids, org, account, project, version } = await setup();

    const r = await startProjectUpdateOperation(
      { repos: { projects: store.projects, projectVersions: store.projectVersions, deployTargets: store.deployTargets, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        accountId: account.id,
        tokenId: null,
        req: { projectVersionSeq: version.seq },
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.operation.kind).toBe('update');
    expect(r.value.operation.deploymentId).toBe('deployment-1');
    expect(r.value.deployment?.projectVersionId).toBe(version.id);
  });

  it('rejects update when a deployment is active for the same target', async () => {
    const { store, ids, org, account, project, version } = await setup();
    await startProjectUpdateOperation(
      { repos: { projects: store.projects, projectVersions: store.projectVersions, deployTargets: store.deployTargets, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        accountId: account.id,
        tokenId: null,
        req: { projectVersionSeq: version.seq },
      },
    );

    const r = await startProjectUpdateOperation(
      { repos: { projects: store.projects, projectVersions: store.projectVersions, deployTargets: store.deployTargets, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        accountId: account.id,
        tokenId: null,
        req: { projectVersionSeq: version.seq },
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PROJECT_OPERATION_ACTIVE_DEPLOYMENT');
  });

  it('starts delete and moves the project to deleting', async () => {
    const { store, ids, org, account, project } = await setup();

    const r = await startProjectDeleteOperation(
      { repos: { projects: store.projects, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        projectSlug: project.slug,
        accountId: account.id,
        tokenId: null,
        req: { confirm: project.slug },
      },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.operation.kind).toBe('delete');
    const updated = await store.projects.findById(org.id, project.id);
    expect(isOk(updated) && updated.value?.status).toBe('deleting');
  });

  it('rejects delete confirmation mismatch', async () => {
    const { store, ids, org, account, project } = await setup();

    const r = await startProjectDeleteOperation(
      { repos: { projects: store.projects, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        projectSlug: project.slug,
        accountId: account.id,
        tokenId: null,
        req: { confirm: 'wrong-project' },
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('PROJECT_OPERATION_CONFIRMATION_MISMATCH');
  });

  it('finalizes delete success as project decommissioned', async () => {
    const { store, ids, org, account, project } = await setup();
    const queued = await startProjectDeleteOperation(
      { repos: { projects: store.projects, deployments: store.deployments, projectOperations: store.projectOperations }, ids },
      {
        orgId: org.id,
        projectId: project.id,
        projectSlug: project.slug,
        accountId: account.id,
        tokenId: null,
        req: { confirm: project.slug },
      },
    );
    if (!isOk(queued)) throw new Error('queue failed');

    const done = await finalizeProjectOperation(
      { repos: { projects: store.projects, projectOperations: store.projectOperations } },
      {
        operationId: queued.value.operation.id,
        status: 'succeeded',
        result: { deletedResources: 3 },
      },
    );

    expect(done.ok).toBe(true);
    const updated = await store.projects.findById(org.id, project.id);
    expect(isOk(updated) && updated.value?.status).toBe('decommissioned');
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/use-cases/project-operations.test.ts
```

Expected: FAIL because project operation repos/use-cases and fake deploy target/project version support are incomplete.

- [ ] **Step 3: Extend repo seams**

In `packages/platform/platform-core/src/repos/project-repo.ts`, replace the interface with:

```ts
import type { Project, ProjectStatus } from '../schemas/entities.js';
import type { Result, PlatformError } from '../types/result.js';

export interface ProjectRepo {
  create(row: { id: string; orgId: string; slug: string; displayName: string }): Promise<Result<Project, PlatformError>>;
  findBySlug(orgId: string, slug: string): Promise<Result<Project | null, PlatformError>>;
  findById(orgId: string, id: string): Promise<Result<Project | null, PlatformError>>;
  list(orgId: string, opts: { includeArchived: boolean; includeInactive?: boolean }): Promise<Result<readonly Project[], PlatformError>>;
  patch(orgId: string, id: string, patch: { displayName: string }): Promise<Result<Project, PlatformError>>;
  setStatus(orgId: string, id: string, status: ProjectStatus): Promise<Result<Project, PlatformError>>;
  archive(orgId: string, id: string): Promise<Result<Project, PlatformError>>;
}
```

In `packages/platform/platform-core/src/repos/deployment-repo.ts`, add these methods to `DeploymentRepo`:

```ts
  hasActiveForProject(projectId: string): Promise<Result<boolean, PlatformError>>;
  hasActiveForProjectTarget(projectId: string, targetId: string): Promise<Result<boolean, PlatformError>>;
  listAppliedResourcesByProject(projectId: string): Promise<Result<readonly DeploymentAppliedResources[], PlatformError>>;
```

Add this exported type near `DeploymentInsertRow`:

```ts
export type DeploymentAppliedResources = {
  readonly deploymentId: string;
  readonly targetId: string;
  readonly resources: readonly {
    readonly resourceKind: 'application' | 'compose';
    readonly targetResourceId: string;
    readonly targetResourceName: string;
  }[];
};
```

Create `packages/platform/platform-core/src/repos/project-operation-repo.ts`:

```ts
import type {
  ProjectOperation,
  ProjectOperationKind,
  ProjectOperationLogLine,
  ProjectOperationStatus,
} from '../schemas/project-operation.js';
import type { PlatformError, Result } from '../types/result.js';

export type ProjectOperationInsertRow = {
  readonly id: string;
  readonly orgId: string;
  readonly projectId: string;
  readonly kind: ProjectOperationKind;
  readonly requestedByAccountId: string;
  readonly requestedByTokenId: string | null;
  readonly targetId: string | null;
  readonly projectVersionId: string | null;
  readonly deploymentId: string | null;
  readonly input: Record<string, unknown>;
};

export type ProjectOperationFinalize = {
  readonly status: Extract<ProjectOperationStatus, 'succeeded' | 'failed'>;
  readonly result?: Record<string, unknown>;
  readonly errorCode?: string;
  readonly errorMessage?: string;
};

export interface ProjectOperationRepo {
  create(args: {
    row: ProjectOperationInsertRow;
    auditActorAccountId: string;
    auditActorTokenId: string | null;
  }): Promise<Result<ProjectOperation, PlatformError>>;

  attachDeployment(operationId: string, deploymentId: string): Promise<Result<ProjectOperation, PlatformError>>;
  getById(id: string): Promise<Result<ProjectOperation | null, PlatformError>>;
  getByDeploymentId(deploymentId: string): Promise<Result<ProjectOperation | null, PlatformError>>;

  listByProject(
    projectId: string,
    opts: { limit: number; cursor?: Date },
  ): Promise<Result<readonly ProjectOperation[], PlatformError>>;

  transition(
    id: string,
    status: 'running',
    side: { startedAt: Date },
  ): Promise<Result<void, PlatformError>>;

  finalize(id: string, args: ProjectOperationFinalize): Promise<Result<ProjectOperation, PlatformError>>;
  touchHeartbeat(id: string): Promise<Result<void, PlatformError>>;

  appendLog(args: {
    operationId: string;
    orgId: string;
    level: 'info' | 'warn' | 'error';
    step: string;
    message: string;
  }): Promise<Result<void, PlatformError>>;

  readLogs(args: {
    operationId: string;
    sinceLineId: number;
    limit: number;
  }): Promise<Result<{ lines: readonly ProjectOperationLogLine[]; lastLineId: number }, PlatformError>>;

  findStaleRunning(staleAfterSeconds: number): Promise<Result<readonly { id: string; orgId: string; projectId: string }[], PlatformError>>;
}
```

- [ ] **Step 4: Create project operation use-cases**

Create `packages/platform/platform-core/src/use-cases/project-operations.ts`:

```ts
import type { Ids } from '../ids.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { ProjectVersionRepo } from '../repos/project-version-repo.js';
import type { DeployTargetRepo } from '../repos/deploy-target-repo.js';
import type { DeploymentRepo } from '../repos/deployment-repo.js';
import type { ProjectOperationRepo } from '../repos/project-operation-repo.js';
import type { Deployment } from '../schemas/deployment.js';
import type {
  ProjectOperation,
  StartProjectDeleteOperationRequest,
  StartProjectUpdateOperationRequest,
} from '../schemas/project-operation.js';
import { err, isOk, ok, type PlatformError, type Result } from '../types/result.js';

type OperationDeps = {
  repos: {
    projects: ProjectRepo;
    projectOperations: ProjectOperationRepo;
  };
};

type UpdateDeps = {
  repos: {
    projects: ProjectRepo;
    projectVersions: ProjectVersionRepo;
    deployTargets: DeployTargetRepo;
    deployments: DeploymentRepo;
    projectOperations: ProjectOperationRepo;
  };
  ids: Ids;
};

type DeleteDeps = {
  repos: {
    projects: ProjectRepo;
    deployments: DeploymentRepo;
    projectOperations: ProjectOperationRepo;
  };
  ids: Ids;
};

type Actor = {
  orgId: string;
  projectId: string;
  accountId: string;
  tokenId: string | null;
};

export async function startProjectUpdateOperation(
  deps: UpdateDeps,
  input: Actor & { req: StartProjectUpdateOperationRequest },
): Promise<Result<{ operation: ProjectOperation; deployment: Deployment }, PlatformError>> {
  const project = await deps.repos.projects.findById(input.orgId, input.projectId);
  if (!isOk(project)) return project;
  if (!project.value) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }]);
  if (project.value.status !== 'active') {
    return err([{ code: 'PROJECT_OPERATION_INVALID_STATE', message: project.value.status }]);
  }

  const target = input.req.targetSlug === undefined
    ? await deps.repos.deployTargets.getDefault(input.orgId)
    : await deps.repos.deployTargets.getBySlug(input.orgId, input.req.targetSlug);
  if (!isOk(target)) return target;
  if (!target.value) {
    return err([
      {
        code: input.req.targetSlug === undefined ? 'PROJECT_OPERATION_DEFAULT_TARGET_MISSING' : 'DEPLOY_REQUEST_TARGET_NOT_FOUND',
        message: input.req.targetSlug ?? 'default',
      },
    ]);
  }

  const active = await deps.repos.deployments.hasActiveForProjectTarget(input.projectId, target.value.id);
  if (!isOk(active)) return active;
  if (active.value) return err([{ code: 'PROJECT_OPERATION_ACTIVE_DEPLOYMENT', message: target.value.slug }]);

  if (input.req.projectVersionSeq === undefined) {
    return err([{ code: 'PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT', message: 'bundle source must be published by route before use-case call' }]);
  }

  const version = await deps.repos.projectVersions.getBySeq(input.projectId, input.req.projectVersionSeq);
  if (!isOk(version)) return version;
  if (!version.value) {
    return err([{ code: 'DEPLOY_REQUEST_VERSION_NOT_FOUND', message: `project version seq ${input.req.projectVersionSeq} not found` }]);
  }

  const operation = await deps.repos.projectOperations.create({
    row: {
      id: deps.ids.uuid(),
      orgId: input.orgId,
      projectId: input.projectId,
      kind: 'update',
      requestedByAccountId: input.accountId,
      requestedByTokenId: input.tokenId,
      targetId: target.value.id,
      projectVersionId: version.value.id,
      deploymentId: null,
      input: { projectVersionSeq: version.value.seq, targetSlug: target.value.slug },
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
  if (!isOk(operation)) return operation;

  const deployment = await deps.repos.deployments.create({
    row: {
      id: deps.ids.uuid(),
      projectId: input.projectId,
      orgId: input.orgId,
      projectVersionId: version.value.id,
      targetId: target.value.id,
      configOverrides: {},
      startedByAccountId: input.accountId,
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
  if (!isOk(deployment)) return deployment;

  const attached = await deps.repos.projectOperations.attachDeployment(operation.value.id, deployment.value.id);
  if (!isOk(attached)) return attached;

  return ok({ operation: attached.value, deployment: deployment.value });
}

export async function startProjectDeleteOperation(
  deps: DeleteDeps,
  input: Actor & { projectSlug: string; req: StartProjectDeleteOperationRequest },
): Promise<Result<{ operation: ProjectOperation }, PlatformError>> {
  const project = await deps.repos.projects.findById(input.orgId, input.projectId);
  if (!isOk(project)) return project;
  if (!project.value) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }]);
  if (input.req.confirm !== input.projectSlug) {
    return err([{ code: 'PROJECT_OPERATION_CONFIRMATION_MISMATCH', message: input.projectSlug }]);
  }
  if (project.value.status !== 'active' && project.value.status !== 'delete_failed') {
    return err([{ code: 'PROJECT_OPERATION_INVALID_STATE', message: project.value.status }]);
  }
  const active = await deps.repos.deployments.hasActiveForProject(input.projectId);
  if (!isOk(active)) return active;
  if (active.value) return err([{ code: 'PROJECT_OPERATION_ACTIVE_DEPLOYMENT', message: input.projectSlug }]);

  const deleting = await deps.repos.projects.setStatus(input.orgId, input.projectId, 'deleting');
  if (!isOk(deleting)) return deleting;

  const operation = await deps.repos.projectOperations.create({
    row: {
      id: deps.ids.uuid(),
      orgId: input.orgId,
      projectId: input.projectId,
      kind: 'delete',
      requestedByAccountId: input.accountId,
      requestedByTokenId: input.tokenId,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: { confirm: input.req.confirm },
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
  if (!isOk(operation)) return operation;
  return ok({ operation: operation.value });
}

export async function finalizeProjectOperation(
  deps: OperationDeps,
  input: {
    operationId: string;
    status: 'succeeded' | 'failed';
    result?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  },
): Promise<Result<ProjectOperation, PlatformError>> {
  const operation = await deps.repos.projectOperations.finalize(input.operationId, {
    status: input.status,
    result: input.result,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
  });
  if (!isOk(operation)) return operation;

  if (operation.value.kind === 'delete') {
    const projectStatus = input.status === 'succeeded' ? 'decommissioned' : 'delete_failed';
    const project = await deps.repos.projects.setStatus(operation.value.orgId, operation.value.projectId, projectStatus);
    if (!isOk(project)) return project;
  }

  return operation;
}

export async function listProjectOperations(
  deps: { repos: { projectOperations: ProjectOperationRepo } },
  input: { projectId: string; limit: number; cursor?: Date },
): Promise<Result<readonly ProjectOperation[], PlatformError>> {
  return deps.repos.projectOperations.listByProject(input.projectId, input);
}

export async function getProjectOperation(
  deps: { repos: { projectOperations: ProjectOperationRepo } },
  input: { operationId: string },
): Promise<Result<ProjectOperation | null, PlatformError>> {
  return deps.repos.projectOperations.getById(input.operationId);
}

export async function readProjectOperationLogs(
  deps: { repos: { projectOperations: ProjectOperationRepo } },
  input: { operationId: string; sinceLineId: number; limit: number },
) {
  return deps.repos.projectOperations.readLogs(input);
}
```

- [ ] **Step 5: Guard inactive projects in existing use-cases**

In `packages/platform/platform-core/src/use-cases/project-versions.ts`, before duplicate digest lookup in `publishProjectVersion`, add:

```ts
  const project = await deps.repos.projects.findById(input.orgId, input.projectId);
  if (!isOk(project)) return project;
  if (!project.value) {
    return { ok: false, errors: [{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }] };
  }
  if (project.value.status !== 'active') {
    return { ok: false, errors: [{ code: 'PROJECT_OPERATION_INVALID_STATE', message: project.value.status }] };
  }
```

In `packages/platform/platform-core/src/use-cases/deployments.ts`, at the start of `startDeployment`, add a `projects: ProjectRepo` dependency to `Deps`, then add:

```ts
  const project = await deps.repos.projects.findById(input.orgId, input.projectId);
  if (!isOk(project)) return project;
  if (!project.value) {
    return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }]);
  }
  if (project.value.status !== 'active') {
    return err([{ code: 'PROJECT_OPERATION_INVALID_STATE', message: project.value.status }]);
  }
```

Update current callers in platform routes/tests to pass `projects: repos.projects`.

- [ ] **Step 6: Update FakeStore**

In `packages/platform/platform-core/src/testing/fakes.ts`:

Add imports:

```ts
import type { ProjectStatus } from '../schemas/entities.js';
import type { ProjectOperation, ProjectOperationLogLine } from '../schemas/project-operation.js';
import type { ProjectOperationRepo } from '../repos/project-operation-repo.js';
import type { Deployment, DeploymentLogLine } from '../schemas/deployment.js';
import type { DeployTarget, DeployTargetWithSecret } from '../schemas/deploy-target.js';
import type { ProjectVersion } from '../schemas/project-version.js';
```

Add store fields:

```ts
  public projectVersionsByProject = new Map<string, ProjectVersion[]>();
  public deployTargetsByOrg = new Map<string, DeployTargetWithSecret[]>();
  public deploymentsByProject = new Map<string, Deployment[]>();
  public deploymentLogsByDeployment = new Map<string, DeploymentLogLine[]>();
  public projectOperationRows = new Map<string, ProjectOperation>();
  public projectOperationLogsByOperation = new Map<string, ProjectOperationLogLine[]>();
```

When creating a project, set status:

```ts
      const p: Project = { ...r, status: 'active', archivedAt: null, createdAt: this.now(), updatedAt: this.now() };
```

Add `setStatus` to `projects`:

```ts
    setStatus: async (o, id, status: ProjectStatus) => {
      const list = this.projectsByOrg.get(o) ?? [];
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return err([notFound('PLATFORM_TENANCY_PROJECT_NOT_FOUND', id)]);
      const u = { ...list[idx]!, status, updatedAt: this.now() };
      list[idx] = u;
      this.projectsByOrg.set(o, list);
      return ok(u);
    },
```

Add these fake repo helpers inside `FakeStore`. If the class already contains
repos with these names, merge the method bodies into the existing properties.

```ts
  readonly projectVersions: ProjectVersionRepo = {
    create: async (args) => {
      const list = this.projectVersionsByProject.get(args.projectId) ?? [];
      const existing = list.find((v) => v.bundleDigest === args.row.bundleDigest);
      if (existing) return ok(existing);
      const v: ProjectVersion = {
        ...args.row,
        projectId: args.projectId,
        seq: list.length + 1,
        createdAt: this.now(),
      };
      this.projectVersionsByProject.set(args.projectId, [...list, v]);
      return ok(v);
    },
    findByDigest: async (projectId, digest) =>
      ok((this.projectVersionsByProject.get(projectId) ?? []).find((v) => v.bundleDigest === digest) ?? null),
    getBySeq: async (projectId, seq) =>
      ok((this.projectVersionsByProject.get(projectId) ?? []).find((v) => v.seq === seq) ?? null),
    getById: async (id) =>
      ok([...this.projectVersionsByProject.values()].flat().find((v) => v.id === id) ?? null),
    listByProject: async (projectId, opts) => {
      const list = [...(this.projectVersionsByProject.get(projectId) ?? [])].sort((a, b) => b.seq - a.seq);
      const filtered = opts.cursor === undefined ? list : list.filter((v) => v.seq < opts.cursor!);
      return ok(filtered.slice(0, opts.limit));
    },
  };

  readonly deployTargets: DeployTargetRepo = {
    create: async (args) => {
      const list = this.deployTargetsByOrg.get(args.row.orgId) ?? [];
      if (list.some((target) => target.slug === args.row.slug)) {
        return err([notFound('DEPLOY_TARGET_SLUG_TAKEN', args.row.slug)]);
      }
      const stored: DeployTargetWithSecret = {
        id: args.row.id,
        orgId: args.row.orgId,
        slug: args.row.slug,
        displayName: args.row.displayName,
        kind: args.row.kind,
        dokployUrl: args.row.dokployUrl,
        publicBaseUrl: args.row.publicBaseUrl,
        dokployProjectId: args.row.dokployProjectId,
        dokployProjectName: args.row.dokployProjectName,
        allowCreateProject: args.row.allowCreateProject,
        apiTokenCiphertext: args.row.apiTokenCiphertext,
        apiTokenNonce: args.row.apiTokenNonce,
        apiTokenKeyVersion: args.row.apiTokenKeyVersion,
        eventBus: args.row.eventBusConfig,
        modules: args.row.modules,
        auth: args.row.auth,
        policyValues: args.row.policyValues,
        isDefault: args.row.isDefault,
        createdAt: this.now(),
        updatedAt: this.now(),
      };
      this.deployTargetsByOrg.set(args.row.orgId, [...list.filter((target) => !stored.isDefault || !target.isDefault), stored]);
      return ok(publicTarget(stored));
    },
    update: async () => err([notFound('DEPLOY_TARGET_NOT_FOUND', 'update not implemented in fake')]),
    rotateApiToken: async () => err([notFound('DEPLOY_TARGET_NOT_FOUND', 'rotate not implemented in fake')]),
    setDefault: async (args) => {
      const list = this.deployTargetsByOrg.get(args.orgId) ?? [];
      const target = list.find((item) => item.slug === args.slug);
      if (!target) return err([notFound('DEPLOY_TARGET_NOT_FOUND', args.slug)]);
      const updated = list.map((item) => ({ ...item, isDefault: item.slug === args.slug }));
      this.deployTargetsByOrg.set(args.orgId, updated);
      return ok(publicTarget(updated.find((item) => item.slug === args.slug)!));
    },
    delete: async () => ok(undefined),
    list: async (orgId) => ok((this.deployTargetsByOrg.get(orgId) ?? []).map(publicTarget)),
    getBySlug: async (orgId, slug) => ok(publicTargetOrNull((this.deployTargetsByOrg.get(orgId) ?? []).find((target) => target.slug === slug) ?? null)),
    getDefault: async (orgId) => ok(publicTargetOrNull((this.deployTargetsByOrg.get(orgId) ?? []).find((target) => target.isDefault) ?? null)),
    getWithSecretById: async (id) =>
      ok([...this.deployTargetsByOrg.values()].flat().find((target) => target.id === id) ?? null),
  };

  readonly deployments: DeploymentRepo = {
    create: async (args) => {
      const list = this.deploymentsByProject.get(args.row.projectId) ?? [];
      const deployment: Deployment = {
        id: args.row.id,
        projectId: args.row.projectId,
        orgId: args.row.orgId,
        projectVersionId: args.row.projectVersionId,
        targetId: args.row.targetId,
        status: 'queued',
        configOverrides: args.row.configOverrides,
        renderedPlanDigest: null,
        applyResult: null,
        verificationReport: null,
        warnings: [],
        errorCode: null,
        errorMessage: null,
        startedByAccountId: args.row.startedByAccountId,
        queuedAt: this.now(),
        startedAt: null,
        finishedAt: null,
        lastHeartbeatAt: null,
      };
      this.deploymentsByProject.set(args.row.projectId, [...list, deployment]);
      return ok(deployment);
    },
    getById: async (id) => ok([...this.deploymentsByProject.values()].flat().find((d) => d.id === id) ?? null),
    listByProject: async (projectId, opts) => ok((this.deploymentsByProject.get(projectId) ?? []).slice(0, opts.limit)),
    transition: async () => ok(undefined),
    setRenderedDigest: async () => ok(undefined),
    setApplyResult: async (id, applyResult) => {
      for (const [projectId, list] of this.deploymentsByProject.entries()) {
        const idx = list.findIndex((d) => d.id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx]!, applyResult };
          this.deploymentsByProject.set(projectId, list);
        }
      }
      return ok(undefined);
    },
    finalize: async (id, args) => {
      for (const [projectId, list] of this.deploymentsByProject.entries()) {
        const idx = list.findIndex((d) => d.id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx]!, status: args.status, finishedAt: this.now(), errorCode: args.errorCode ?? null, errorMessage: args.errorMessage ?? null };
          this.deploymentsByProject.set(projectId, list);
        }
      }
      return ok(undefined);
    },
    touchHeartbeat: async () => ok(undefined),
    appendLog: async () => ok(undefined),
    readLogs: async (args) => ok({ lines: this.deploymentLogsByDeployment.get(args.deploymentId) ?? [], lastLineId: args.sinceLineId }),
    findStaleRunning: async () => ok([]),
    hasActiveForProject: async (projectId) =>
      ok((this.deploymentsByProject.get(projectId) ?? []).some((d) => d.status === 'queued' || d.status === 'running')),
    hasActiveForProjectTarget: async (projectId, targetId) =>
      ok((this.deploymentsByProject.get(projectId) ?? []).some((d) => d.targetId === targetId && (d.status === 'queued' || d.status === 'running'))),
    listAppliedResourcesByProject: async (projectId) =>
      ok((this.deploymentsByProject.get(projectId) ?? []).flatMap((d) => {
        const resources = Array.isArray(d.applyResult?.resources) ? d.applyResult.resources : [];
        const parsed = resources.filter((r): r is { resourceKind: 'application' | 'compose'; targetResourceId: string; targetResourceName: string } =>
          !!r && typeof r === 'object' &&
          ((r as { resourceKind?: unknown }).resourceKind === 'application' || (r as { resourceKind?: unknown }).resourceKind === 'compose') &&
          typeof (r as { targetResourceId?: unknown }).targetResourceId === 'string' &&
          typeof (r as { targetResourceName?: unknown }).targetResourceName === 'string',
        );
        return parsed.length === 0 ? [] : [{ deploymentId: d.id, targetId: d.targetId, resources: parsed }];
      })),
  };

  readonly projectOperations: ProjectOperationRepo = {
    create: async (args) => {
      const operation: ProjectOperation = {
        ...args.row,
        status: 'queued',
        result: null,
        errorCode: null,
        errorMessage: null,
        queuedAt: this.now(),
        startedAt: null,
        finishedAt: null,
        lastHeartbeatAt: null,
      };
      this.projectOperationRows.set(operation.id, operation);
      return ok(operation);
    },
    attachDeployment: async (operationId, deploymentId) => {
      const operation = this.projectOperationRows.get(operationId);
      if (!operation) return err([notFound('PROJECT_OPERATION_NOT_FOUND', operationId)]);
      const updated = { ...operation, deploymentId };
      this.projectOperationRows.set(operationId, updated);
      return ok(updated);
    },
    getById: async (id) => ok(this.projectOperationRows.get(id) ?? null),
    getByDeploymentId: async (deploymentId) =>
      ok([...this.projectOperationRows.values()].find((operation) => operation.deploymentId === deploymentId) ?? null),
    listByProject: async (projectId, opts) =>
      ok([...this.projectOperationRows.values()].filter((operation) => operation.projectId === projectId).slice(0, opts.limit)),
    transition: async (id, _status, side) => {
      const operation = this.projectOperationRows.get(id);
      if (!operation) return err([notFound('PROJECT_OPERATION_NOT_FOUND', id)]);
      this.projectOperationRows.set(id, { ...operation, status: 'running', startedAt: side.startedAt, lastHeartbeatAt: side.startedAt });
      return ok(undefined);
    },
    finalize: async (id, args) => {
      const operation = this.projectOperationRows.get(id);
      if (!operation) return err([notFound('PROJECT_OPERATION_NOT_FOUND', id)]);
      const updated = { ...operation, status: args.status, result: args.result ?? null, errorCode: args.errorCode ?? null, errorMessage: args.errorMessage ?? null, finishedAt: this.now() };
      this.projectOperationRows.set(id, updated);
      return ok(updated);
    },
    touchHeartbeat: async (id) => {
      const operation = this.projectOperationRows.get(id);
      if (operation) this.projectOperationRows.set(id, { ...operation, lastHeartbeatAt: this.now() });
      return ok(undefined);
    },
    appendLog: async (args) => {
      const list = this.projectOperationLogsByOperation.get(args.operationId) ?? [];
      this.projectOperationLogsByOperation.set(args.operationId, [...list, { id: list.length + 1, operationId: args.operationId, orgId: args.orgId, ts: this.now(), level: args.level, step: args.step, message: args.message }]);
      return ok(undefined);
    },
    readLogs: async (args) => {
      const lines = (this.projectOperationLogsByOperation.get(args.operationId) ?? []).filter((line) => line.id > args.sinceLineId).slice(0, args.limit);
      return ok({ lines, lastLineId: lines[lines.length - 1]?.id ?? args.sinceLineId });
    },
    findStaleRunning: async () => ok([]),
  };
```

Add these helper functions after the class:

```ts
function publicTarget(target: DeployTargetWithSecret): DeployTarget {
  const { apiTokenCiphertext: _ciphertext, apiTokenNonce: _nonce, apiTokenKeyVersion: _keyVersion, ...rest } = target;
  return { ...rest, apiTokenRedacted: '***' };
}

function publicTargetOrNull(target: DeployTargetWithSecret | null): DeployTarget | null {
  return target === null ? null : publicTarget(target);
}
```

- [ ] **Step 7: Export repo/use-case**

In `packages/platform/platform-core/src/index.ts`, add:

```ts
export * from './repos/project-operation-repo.js';
export * from './use-cases/project-operations.js';
```

- [ ] **Step 8: Run platform-core operation tests**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/use-cases/project-operations.test.ts
pnpm -F @rntme/platform-core typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/platform/platform-core/src/repos/project-repo.ts packages/platform/platform-core/src/repos/deployment-repo.ts packages/platform/platform-core/src/repos/project-operation-repo.ts packages/platform/platform-core/src/use-cases/projects.ts packages/platform/platform-core/src/use-cases/project-versions.ts packages/platform/platform-core/src/use-cases/deployments.ts packages/platform/platform-core/src/use-cases/project-operations.ts packages/platform/platform-core/src/testing/fakes.ts packages/platform/platform-core/src/index.ts packages/platform/platform-core/test/unit/use-cases/project-operations.test.ts
git commit -m "feat(platform-core): add project operation use cases"
```

---

### Task 3: Platform Storage Migration And Repos

**Files:**
- Create: `packages/platform/platform-storage/drizzle/0007_project_operations.sql`
- Modify: `packages/platform/platform-storage/src/schema/projects.ts`
- Create: `packages/platform/platform-storage/src/schema/project-operation.ts`
- Modify: `packages/platform/platform-storage/src/schema/index.ts`
- Modify: `packages/platform/platform-storage/src/repos/pg-project-repo.ts`
- Modify: `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts`
- Create: `packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts`
- Modify: `packages/platform/platform-storage/src/index.ts`
- Test: `packages/platform/platform-storage/test/integration/pg-project-operation-repo.test.ts`

- [ ] **Step 1: Write failing storage integration test**

Create `packages/platform/platform-storage/test/integration/pg-project-operation-repo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isOk } from '@rntme/platform-core';
import { PgProjectOperationRepo, PgProjectRepo, PgDeploymentRepo } from '../../src/index.js';
import { createHarness } from './harness.js';

describe('PgProjectOperationRepo', () => {
  it('creates, attaches deployment, logs, and finalizes operation rows under RLS', async () => {
    const h = await createHarness();
    const orgId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    const deploymentId = crypto.randomUUID();

    await h.pool.query(`INSERT INTO account (id, workos_user_id, display_name) VALUES ($1, 'user_op', 'Ada')`, [accountId]);
    await h.pool.query(`INSERT INTO organization (id, workos_organization_id, slug, display_name) VALUES ($1, 'org_op', 'acme-op', 'Acme')`, [orgId]);
    await h.pool.query(`INSERT INTO project (id, org_id, slug, display_name) VALUES ($1,$2,'notes-demo','Notes Demo')`, [projectId, orgId]);

    await h.withOrg(orgId, async (client) => {
      const repo = new PgProjectOperationRepo(client);
      const created = await repo.create({
        row: {
          id: operationId,
          orgId,
          projectId,
          kind: 'delete',
          requestedByAccountId: accountId,
          requestedByTokenId: null,
          targetId: null,
          projectVersionId: null,
          deploymentId: null,
          input: { confirm: 'notes-demo' },
        },
        auditActorAccountId: accountId,
        auditActorTokenId: null,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.value.status).toBe('queued');

      const attached = await repo.attachDeployment(operationId, deploymentId);
      expect(attached.ok).toBe(true);
      if (!attached.ok) return;
      expect(attached.value.deploymentId).toBe(deploymentId);

      const transitioned = await repo.transition(operationId, 'running', { startedAt: new Date('2026-05-03T12:00:00Z') });
      expect(transitioned.ok).toBe(true);

      const logged = await repo.appendLog({ operationId, orgId, level: 'info', step: 'teardown', message: 'started' });
      expect(logged.ok).toBe(true);

      const logs = await repo.readLogs({ operationId, sinceLineId: 0, limit: 10 });
      expect(logs.ok).toBe(true);
      if (logs.ok) expect(logs.value.lines[0]?.message).toBe('started');

      const finalized = await repo.finalize(operationId, { status: 'succeeded', result: { deletedResources: 1 } });
      expect(finalized.ok).toBe(true);
      if (finalized.ok) expect(finalized.value.result).toEqual({ deletedResources: 1 });
    });

    await h.close();
  });

  it('finds active deployments and applied resources by project', async () => {
    const h = await createHarness();
    const orgId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const deploymentId = crypto.randomUUID();

    await h.pool.query(`INSERT INTO account (id, workos_user_id, display_name) VALUES ($1, 'user_dep', 'Ada')`, [accountId]);
    await h.pool.query(`INSERT INTO organization (id, workos_organization_id, slug, display_name) VALUES ($1, 'org_dep', 'acme-dep', 'Acme')`, [orgId]);
    await h.pool.query(`INSERT INTO project (id, org_id, slug, display_name) VALUES ($1,$2,'notes-demo','Notes Demo')`, [projectId, orgId]);
    await h.pool.query(
      `INSERT INTO project_version (id, org_id, project_id, seq, bundle_digest, bundle_blob_key, bundle_size_bytes, summary, uploaded_by_account_id)
       VALUES ($1,$2,$3,1,'sha256:a','projects/p/versions/a.json.gz',2,'{"projectName":"notes-demo","services":[],"routes":{"ui":{},"http":{}},"middleware":{},"mounts":[]}'::jsonb,$4)`,
      [versionId, orgId, projectId, accountId],
    );
    await h.pool.query(
      `INSERT INTO deploy_target (
         id, org_id, slug, display_name, kind, dokploy_url, dokploy_project_id,
         allow_create_project, api_token_ciphertext, api_token_nonce, api_token_key_version,
         event_bus_config, modules, auth, policy_values
       ) VALUES ($1,$2,'dokploy','Dokploy','dokploy','https://dokploy.example.com','dokploy-project',false,'x'::bytea,'n'::bytea,1,'{"kind":"kafka","mode":"external","brokers":["redpanda:9092"]}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb)`,
      [targetId, orgId],
    );
    await h.pool.query(
      `INSERT INTO deployment (id, org_id, project_id, project_version_id, target_id, status, config_overrides, started_by_account_id, apply_result)
       VALUES ($1,$2,$3,$4,$5,'queued','{}'::jsonb,$6,'{"resources":[{"resourceKind":"application","targetResourceId":"app_1","targetResourceName":"rntme-acme-notes-app"}]}'::jsonb)`,
      [deploymentId, orgId, projectId, versionId, targetId, accountId],
    );

    await h.withOrg(orgId, async (client) => {
      const repo = new PgDeploymentRepo(client);
      const active = await repo.hasActiveForProjectTarget(projectId, targetId);
      expect(active).toEqual({ ok: true, value: true });

      await client.query(`UPDATE deployment SET status='failed', finished_at=now() WHERE id=$1`, [deploymentId]);
      const resources = await repo.listAppliedResourcesByProject(projectId);
      expect(resources.ok).toBe(true);
      if (resources.ok) {
        expect(resources.value).toEqual([
          {
            deploymentId,
            targetId,
            resources: [
              {
                resourceKind: 'application',
                targetResourceId: 'app_1',
                targetResourceName: 'rntme-acme-notes-app',
              },
            ],
          },
        ]);
      }
    });

    await h.close();
  });
});
```

- [ ] **Step 2: Run storage test and verify failure**

Run:

```bash
pnpm -F @rntme/platform-storage test -- test/integration/pg-project-operation-repo.test.ts
```

Expected: FAIL because migration/schema/repo do not exist.

- [ ] **Step 3: Add migration**

Create `packages/platform/platform-storage/drizzle/0007_project_operations.sql`:

```sql
CREATE TYPE "public"."project_status" AS ENUM('active', 'deleting', 'delete_failed', 'decommissioned');
--> statement-breakpoint
CREATE TYPE "public"."project_operation_kind" AS ENUM('update', 'delete');
--> statement-breakpoint
CREATE TYPE "public"."project_operation_status" AS ENUM('queued', 'running', 'succeeded', 'failed');
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "status" "project_status" DEFAULT 'active' NOT NULL;
--> statement-breakpoint
CREATE TABLE "project_operation" (
  "id" uuid PRIMARY KEY NOT NULL,
  "org_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "kind" "project_operation_kind" NOT NULL,
  "status" "project_operation_status" DEFAULT 'queued' NOT NULL,
  "requested_by_account_id" uuid NOT NULL,
  "requested_by_token_id" uuid,
  "target_id" uuid,
  "project_version_id" uuid,
  "deployment_id" uuid,
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result" jsonb,
  "error_code" text,
  "error_message" text,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "last_heartbeat_at" timestamp with time zone,
  CONSTRAINT "project_operation_terminal_finished" CHECK (
    ("status" IN ('queued', 'running') AND "finished_at" IS NULL)
    OR
    ("status" IN ('succeeded', 'failed') AND "finished_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "project_operation_log_line" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "operation_id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "ts" timestamp with time zone DEFAULT now() NOT NULL,
  "level" text NOT NULL,
  "step" text NOT NULL,
  "message" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_requested_by_account_id_account_id_fk" FOREIGN KEY ("requested_by_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_requested_by_token_id_api_token_id_fk" FOREIGN KEY ("requested_by_token_id") REFERENCES "public"."api_token"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_target_id_deploy_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."deploy_target"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_project_version_id_project_version_id_fk" FOREIGN KEY ("project_version_id") REFERENCES "public"."project_version"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation" ADD CONSTRAINT "project_operation_deployment_id_deployment_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation_log_line" ADD CONSTRAINT "project_operation_log_line_operation_id_project_operation_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."project_operation"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_operation_log_line" ADD CONSTRAINT "project_operation_log_line_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "project_operation_project_idx" ON "project_operation" USING btree ("project_id","queued_at");
--> statement-breakpoint
CREATE INDEX "project_operation_live_idx" ON "project_operation" USING btree ("status","last_heartbeat_at");
--> statement-breakpoint
CREATE INDEX "project_operation_deployment_idx" ON "project_operation" USING btree ("deployment_id");
--> statement-breakpoint
CREATE INDEX "project_operation_log_line_idx" ON "project_operation_log_line" USING btree ("operation_id","id");
--> statement-breakpoint
ALTER TABLE "project_operation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "project_operation_log_line" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "project_operation"
  USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY tenant_insert ON "project_operation"
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "project_operation_log_line"
  USING (org_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY tenant_insert ON "project_operation_log_line"
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
```

- [ ] **Step 4: Add Drizzle schema**

In `packages/platform/platform-storage/src/schema/projects.ts`, import `pgEnum`, add:

```ts
export const projectStatus = pgEnum('project_status', ['active', 'deleting', 'delete_failed', 'decommissioned']);
```

Add the column:

```ts
    status: projectStatus('status').notNull().default('active'),
```

Create `packages/platform/platform-storage/src/schema/project-operation.ts`:

```ts
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uuid, bigserial, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { account, organization } from './identity.js';
import { project } from './projects.js';
import { apiToken } from './tokens.js';
import { deployTarget } from './deploy-target.js';
import { projectVersion } from './project-version.js';
import { deployment } from './deployment.js';

export const projectOperationKind = pgEnum('project_operation_kind', ['update', 'delete']);
export const projectOperationStatus = pgEnum('project_operation_status', ['queued', 'running', 'succeeded', 'failed']);

export const projectOperation = pgTable(
  'project_operation',
  {
    id: uuid('id').primaryKey(),
    orgId: uuid('org_id').notNull().references(() => organization.id),
    projectId: uuid('project_id').notNull().references(() => project.id),
    kind: projectOperationKind('kind').notNull(),
    status: projectOperationStatus('status').notNull().default('queued'),
    requestedByAccountId: uuid('requested_by_account_id').notNull().references(() => account.id),
    requestedByTokenId: uuid('requested_by_token_id').references(() => apiToken.id),
    targetId: uuid('target_id').references(() => deployTarget.id),
    projectVersionId: uuid('project_version_id').references(() => projectVersion.id),
    deploymentId: uuid('deployment_id').references(() => deployment.id),
    input: jsonb('input').$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb('result').$type<Record<string, unknown>>(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  },
  (t) => ({
    projectIdx: index('project_operation_project_idx').on(t.projectId, t.queuedAt),
    liveIdx: index('project_operation_live_idx').on(t.status, t.lastHeartbeatAt),
    deploymentIdx: index('project_operation_deployment_idx').on(t.deploymentId),
    terminalMeansFinished: check(
      'project_operation_terminal_finished',
      sql`(${t.status} IN ('queued', 'running') AND ${t.finishedAt} IS NULL) OR (${t.status} IN ('succeeded', 'failed') AND ${t.finishedAt} IS NOT NULL)`,
    ),
  }),
);

export const projectOperationLogLine = pgTable(
  'project_operation_log_line',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    operationId: uuid('operation_id').notNull().references(() => projectOperation.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organization.id),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    level: text('level').notNull(),
    step: text('step').notNull(),
    message: text('message').notNull(),
  },
  (t) => ({
    lineIdx: index('project_operation_log_line_idx').on(t.operationId, t.id),
  }),
);
```

Remove `uniqueIndex` from the import if TypeScript reports it unused.

In `packages/platform/platform-storage/src/schema/index.ts`, add:

```ts
export * from './project-operation.js';
```

- [ ] **Step 5: Update project and deployment repos**

In `packages/platform/platform-storage/src/repos/pg-project-repo.ts`, map `status`:

```ts
    status: r.status ?? 'active',
```

Add `setStatus`:

```ts
  async setStatus(orgId: string, id: string, status: Project['status']): Promise<Result<Project, PlatformError>> {
    try {
      const rows = await this.db
        .update(project)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(project.orgId, orgId), eq(project.id, id)))
        .returning();
      if (!rows[0]) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: id }]);
      return ok(toP(rows[0]));
    } catch (cause) {
      return err([{ code: 'PLATFORM_STORAGE_DB_UNAVAILABLE', message: String(cause), cause }]);
    }
  }
```

Update `list` to hide inactive by default:

```ts
      const activeStatus = eq(project.status, 'active');
      const notArchived = isNull(project.archivedAt);
      const cond = opts.includeArchived || opts.includeInactive
        ? eq(project.orgId, orgId)
        : and(eq(project.orgId, orgId), notArchived, activeStatus);
```

In `packages/platform/platform-storage/src/repos/pg-deployment-repo.ts`, add imports for `DeploymentAppliedResources` and add:

```ts
  async hasActiveForProject(projectId: string): Promise<Result<boolean, PlatformError>> {
    try {
      const r = await this.db.query(
        `SELECT 1 FROM deployment WHERE project_id=$1 AND status IN ('queued','running') LIMIT 1`,
        [projectId],
      );
      return ok(Boolean(r.rows[0]));
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async hasActiveForProjectTarget(projectId: string, targetId: string): Promise<Result<boolean, PlatformError>> {
    try {
      const r = await this.db.query(
        `SELECT 1 FROM deployment WHERE project_id=$1 AND target_id=$2 AND status IN ('queued','running') LIMIT 1`,
        [projectId, targetId],
      );
      return ok(Boolean(r.rows[0]));
    } catch (cause) {
      return dbErr(cause);
    }
  }

  async listAppliedResourcesByProject(projectId: string): Promise<Result<readonly DeploymentAppliedResources[], PlatformError>> {
    try {
      const rows = await this.db.query(
        `SELECT id, target_id, apply_result
         FROM deployment
         WHERE project_id=$1 AND apply_result IS NOT NULL
         ORDER BY queued_at DESC, id DESC`,
        [projectId],
      );
      return ok(rows.rows.flatMap((row) => {
        const apply = row['apply_result'] as { resources?: unknown } | null;
        const resources = Array.isArray(apply?.resources) ? apply.resources : [];
        const parsed = resources
          .filter((resource): resource is Record<string, unknown> => resource !== null && typeof resource === 'object')
          .filter((resource) => resource.resourceKind === 'application' || resource.resourceKind === 'compose')
          .filter((resource) => typeof resource.targetResourceId === 'string' && typeof resource.targetResourceName === 'string')
          .map((resource) => ({
            resourceKind: resource.resourceKind as 'application' | 'compose',
            targetResourceId: resource.targetResourceId as string,
            targetResourceName: resource.targetResourceName as string,
          }));
        if (parsed.length === 0) return [];
        return [{
          deploymentId: row['id'] as string,
          targetId: row['target_id'] as string,
          resources: parsed,
        }];
      }));
    } catch (cause) {
      return dbErr(cause);
    }
  }
```

- [ ] **Step 6: Implement `PgProjectOperationRepo`**

Create `packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts` with the same helper style as `pg-deployment-repo.ts`. The public methods must map snake_case rows to `ProjectOperation`, truncate log messages at 8 KiB, audit `project.operation.queued` in `create`, audit `project.operation.finalized` in `finalize`, and use `SET LOCAL row_security = off` in `findStaleRunning`.

Use these SQL statements exactly for critical transitions:

```ts
const TRANSITION_RUNNING_SQL = `
  UPDATE project_operation
  SET status=$2, started_at=$3, last_heartbeat_at=$3
  WHERE id=$1 AND status='queued'
  RETURNING id
`;

const FINALIZE_SQL = `
  UPDATE project_operation
  SET status=$2,
      finished_at=now(),
      result=$3::jsonb,
      error_code=$4,
      error_message=$5
  WHERE id=$1 AND status IN ('queued','running')
  RETURNING *
`;
```

Use this row mapper:

```ts
function rowToOperation(r: Record<string, unknown>): ProjectOperation {
  return {
    id: r['id'] as string,
    orgId: r['org_id'] as string,
    projectId: r['project_id'] as string,
    kind: r['kind'] as ProjectOperation['kind'],
    status: r['status'] as ProjectOperation['status'],
    requestedByAccountId: r['requested_by_account_id'] as string,
    requestedByTokenId: (r['requested_by_token_id'] ?? null) as string | null,
    targetId: (r['target_id'] ?? null) as string | null,
    projectVersionId: (r['project_version_id'] ?? null) as string | null,
    deploymentId: (r['deployment_id'] ?? null) as string | null,
    input: r['input'] as Record<string, unknown>,
    result: (r['result'] ?? null) as Record<string, unknown> | null,
    errorCode: (r['error_code'] ?? null) as string | null,
    errorMessage: (r['error_message'] ?? null) as string | null,
    queuedAt: r['queued_at'] as Date,
    startedAt: (r['started_at'] ?? null) as Date | null,
    finishedAt: (r['finished_at'] ?? null) as Date | null,
    lastHeartbeatAt: (r['last_heartbeat_at'] ?? null) as Date | null,
  };
}
```

- [ ] **Step 7: Export storage repo**

In `packages/platform/platform-storage/src/index.ts`, export:

```ts
export * from './repos/pg-project-operation-repo.js';
```

- [ ] **Step 8: Run storage integration tests**

Run:

```bash
pnpm -F @rntme/platform-storage test -- test/integration/pg-project-operation-repo.test.ts
pnpm -F @rntme/platform-storage typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/platform/platform-storage/drizzle/0007_project_operations.sql packages/platform/platform-storage/src/schema/projects.ts packages/platform/platform-storage/src/schema/project-operation.ts packages/platform/platform-storage/src/schema/index.ts packages/platform/platform-storage/src/repos/pg-project-repo.ts packages/platform/platform-storage/src/repos/pg-deployment-repo.ts packages/platform/platform-storage/src/repos/pg-project-operation-repo.ts packages/platform/platform-storage/src/index.ts packages/platform/platform-storage/test/integration/pg-project-operation-repo.test.ts
git commit -m "feat(platform-storage): persist project operations"
```

---

### Task 4: Dokploy Delete Helper

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/client.ts`
- Create: `packages/deploy/deploy-dokploy/src/delete.ts`
- Modify: `packages/deploy/deploy-dokploy/src/index.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/delete.test.ts`

- [ ] **Step 1: Write failing delete helper tests**

Create `packages/deploy/deploy-dokploy/test/unit/delete.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deleteDokployResources } from '../../src/delete.js';
import type { DokployClient } from '../../src/client.js';

function client(overrides: Partial<DokployClient> = {}): DokployClient {
  const calls: string[] = [];
  return {
    ensureEnvironment: async () => ({ environmentId: 'env' }),
    findApplicationByName: async () => null,
    createApplication: async () => ({ id: 'app', name: 'app' }),
    updateApplication: async () => ({ id: 'app', name: 'app' }),
    configureApplication: async () => undefined,
    deployApplication: async () => undefined,
    startApplication: async () => undefined,
    findComposeByName: async () => null,
    createCompose: async () => ({ id: 'compose', name: 'compose' }),
    updateCompose: async () => ({ id: 'compose', name: 'compose' }),
    configureCompose: async () => undefined,
    deployCompose: async () => undefined,
    deleteApplication: async (id) => { calls.push(`app:${id}`); },
    deleteCompose: async (id) => { calls.push(`compose:${id}`); },
    ...overrides,
    __calls: calls,
  } as DokployClient & { __calls: string[] };
}

describe('deleteDokployResources', () => {
  it('deletes applications before composes and dedupes target ids', async () => {
    const c = client() as DokployClient & { __calls: string[] };
    const r = await deleteDokployResources([
      { resourceKind: 'compose', targetResourceId: 'compose_1', targetResourceName: 'event-bus' },
      { resourceKind: 'application', targetResourceId: 'app_1', targetResourceName: 'api' },
      { resourceKind: 'application', targetResourceId: 'app_1', targetResourceName: 'api duplicate' },
    ], c);

    expect(r.ok).toBe(true);
    expect(c.__calls).toEqual(['app:app_1', 'compose:compose_1']);
    if (r.ok) expect(r.value.deletedResources).toHaveLength(2);
  });

  it('treats missing resources as warning success', async () => {
    const c = client({
      deleteApplication: async () => {
        throw new Error('404 application not found');
      },
    });
    const r = await deleteDokployResources([
      { resourceKind: 'application', targetResourceId: 'app_missing', targetResourceName: 'missing' },
    ], c);

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.deletedResources).toEqual([]);
      expect(r.value.warnings[0]).toContain('missing');
    }
  });

  it('fails with sanitized cause for non-missing API errors', async () => {
    const c = client({
      deleteCompose: async () => {
        throw new Error('500 token=super-secret failed');
      },
    });
    const r = await deleteDokployResources([
      { resourceKind: 'compose', targetResourceId: 'compose_1', targetResourceName: 'event-bus' },
    ], c);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('DEPLOY_APPLY_DOKPLOY_API_ERROR');
      expect(JSON.stringify(r.errors)).not.toContain('super-secret');
    }
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/delete.test.ts
```

Expected: FAIL because `delete.ts` and `DokployClient` delete methods do not exist.

- [ ] **Step 3: Extend client seam**

In `packages/deploy/deploy-dokploy/src/client.ts`, add to `DokployClient`:

```ts
  deleteApplication(applicationId: string): Promise<void>;
  deleteCompose(composeId: string): Promise<void>;
```

- [ ] **Step 4: Implement delete helper**

Create `packages/deploy/deploy-dokploy/src/delete.ts`:

```ts
import type { DokployClient } from './client.js';
import type { DokployDeploymentError } from './errors.js';
import { err, ok, type Result } from './result.js';

export type DokployDeleteResource = {
  readonly resourceKind: 'application' | 'compose';
  readonly targetResourceId: string;
  readonly targetResourceName: string;
};

export type DokployDeleteResult = {
  readonly deletedResources: readonly DokployDeleteResource[];
  readonly warnings: readonly string[];
};

export async function deleteDokployResources(
  resources: readonly DokployDeleteResource[],
  client: DokployClient,
): Promise<Result<DokployDeleteResult, DokployDeploymentError>> {
  const deleted: DokployDeleteResource[] = [];
  const warnings: string[] = [];
  const ordered = dedupe(resources).sort((a, b) => {
    if (a.resourceKind === b.resourceKind) return a.targetResourceName.localeCompare(b.targetResourceName);
    return a.resourceKind === 'application' ? -1 : 1;
  });

  for (const resource of ordered) {
    try {
      if (resource.resourceKind === 'application') {
        await client.deleteApplication(resource.targetResourceId);
      } else {
        await client.deleteCompose(resource.targetResourceId);
      }
      deleted.push(resource);
    } catch (cause) {
      if (isMissingResource(cause)) {
        warnings.push(`${resource.resourceKind} ${resource.targetResourceName} already missing`);
        continue;
      }
      return err([
        {
          code: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
          message: `failed to delete ${resource.resourceKind} "${resource.targetResourceName}"`,
          resource: resource.targetResourceName,
          cause: sanitizeCause(cause),
        },
      ]);
    }
  }

  return ok({ deletedResources: deleted, warnings });
}

function dedupe(resources: readonly DokployDeleteResource[]): DokployDeleteResource[] {
  const seen = new Set<string>();
  const out: DokployDeleteResource[] = [];
  for (const resource of resources) {
    const key = `${resource.resourceKind}:${resource.targetResourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resource);
  }
  return out;
}

function isMissingResource(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /\b(404|not found|missing)\b/i.test(message);
}

function sanitizeCause(cause: unknown): { readonly message: string } {
  const message = cause instanceof Error ? cause.message : String(cause);
  return {
    message: message
      .replace(/\b(token|apiToken|password|secret)=([^&\s]+)/gi, '$1=[redacted]')
      .replace(/\b(Bearer\s+)[^\s]+/gi, '$1[redacted]'),
  };
}
```

- [ ] **Step 5: Export helper**

In `packages/deploy/deploy-dokploy/src/index.ts`, add:

```ts
export {
  deleteDokployResources,
  type DokployDeleteResource,
  type DokployDeleteResult,
} from './delete.js';
```

- [ ] **Step 6: Update fake clients in existing tests**

In deploy-dokploy tests that construct `DokployClient`, add no-op methods:

```ts
  async deleteApplication(_applicationId: string): Promise<void> {}
  async deleteCompose(_composeId: string): Promise<void> {}
```

- [ ] **Step 7: Run deploy-dokploy tests**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/delete.test.ts test/unit/apply.test.ts
pnpm -F @rntme/deploy-dokploy typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/client.ts packages/deploy/deploy-dokploy/src/delete.ts packages/deploy/deploy-dokploy/src/index.ts packages/deploy/deploy-dokploy/test/unit/delete.test.ts packages/deploy/deploy-dokploy/test/unit/apply.test.ts
git commit -m "feat(deploy-dokploy): add resource delete helper"
```

---

### Task 5: Platform HTTP Operation Routes And Update Scheduling

**Files:**
- Create: `apps/platform-http/src/routes/project-operations.ts`
- Modify: `apps/platform-http/src/routes/project-versions.ts`
- Modify: `apps/platform-http/src/routes/deployments.ts`
- Modify: `apps/platform-http/src/middleware/error-handler.ts`
- Modify: `apps/platform-http/src/resolve-deps.ts`
- Modify: `apps/platform-http/src/app.ts`
- Test: `apps/platform-http/test/unit/routes/project-operations.test.ts`
- Test: `apps/platform-http/test/e2e/project-version-upload.test.ts`
- Test: `apps/platform-http/test/e2e/deploy-flow.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `apps/platform-http/test/unit/routes/project-operations.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { projectOperationRoutes } from '../../../src/routes/project-operations.js';
import { Hono } from 'hono';
import { FakeStore, SeededIds, createProject, isOk } from '@rntme/platform-core';

describe('projectOperationRoutes', () => {
  it('rejects delete confirmation mismatch', async () => {
    const store = new FakeStore();
    const ids = new SeededIds(['project-1', 'operation-1']);
    const org = await store.seedOrg({ slug: 'acme', workosOrganizationId: 'org_1', displayName: 'Acme' });
    const account = await store.seedAccount({ workosUserId: 'user_1', displayName: 'Ada', email: 'ada@example.com' });
    const project = await createProject({ repos: { projects: store.projects }, ids }, { orgId: org.id, slug: 'notes-demo', displayName: 'Notes Demo' });
    if (!isOk(project)) throw new Error('seed failed');

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('subject', { org, account, role: 'admin', scopes: ['project:read', 'project:delete'], tokenId: null });
      c.set('tx', {} as never);
      await next();
    });
    app.route('/v1/orgs/:orgSlug/projects/:projSlug/operations', projectOperationRoutes({
      ids,
      resolveDeps: () => ({
        organizations: store.organizations,
        projects: store.projects,
        deployments: store.deployments,
        projectOperations: store.projectOperations,
        projectVersions: store.projectVersions,
        deployTargets: store.deployTargets,
      } as never),
    }));

    const res = await app.request('/v1/orgs/acme/projects/notes-demo/operations/delete', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'wrong' }),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('PROJECT_OPERATION_CONFIRMATION_MISMATCH');
  });

  it('queues update and schedules the linked deployment', async () => {
    const scheduleDeployment = vi.fn();
    const store = new FakeStore();
    const ids = new SeededIds(['project-1', 'target-1', 'version-1', 'operation-1', 'deployment-1']);
    const org = await store.seedOrg({ slug: 'acme', workosOrganizationId: 'org_1', displayName: 'Acme' });
    const account = await store.seedAccount({ workosUserId: 'user_1', displayName: 'Ada', email: 'ada@example.com' });

    const app = await operationApp(store, ids, org, account, scheduleDeployment);
    const res = await app.request('/v1/orgs/acme/projects/notes-demo/operations/update', {
      method: 'POST',
      body: JSON.stringify({ projectVersionSeq: 1 }),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.status).toBe(202);
    const json = await res.json() as { operation: { kind: string; deploymentId: string } };
    expect(json.operation.kind).toBe('update');
    expect(json.operation.deploymentId).toBe('deployment-1');
    expect(scheduleDeployment).toHaveBeenCalledWith('deployment-1', org.id);
  });
});
```

Add the helper in the same file. It must seed an active project, default deploy target, and project version using existing fake repos before returning the Hono app:

```ts
async function operationApp(
  store: FakeStore,
  ids: SeededIds,
  org: Awaited<ReturnType<FakeStore['seedOrg']>>,
  account: Awaited<ReturnType<FakeStore['seedAccount']>>,
  scheduleDeployment: (deploymentId: string, orgId: string) => void,
): Promise<Hono> {
  const project = await createProject({ repos: { projects: store.projects }, ids }, { orgId: org.id, slug: 'notes-demo', displayName: 'Notes Demo' });
  if (!isOk(project)) throw new Error('project seed failed');
  await store.deployTargets.create({
    row: {
      id: ids.uuid(),
      orgId: org.id,
      slug: 'dokploy-preview',
      displayName: 'Dokploy Preview',
      kind: 'dokploy',
      dokployUrl: 'https://dokploy.example.com',
      publicBaseUrl: null,
      dokployProjectId: 'dokploy-project',
      dokployProjectName: null,
      allowCreateProject: false,
      apiTokenCiphertext: Buffer.from('secret'),
      apiTokenNonce: Buffer.from('nonce'),
      apiTokenKeyVersion: 1,
      eventBusConfig: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
      modules: {},
      auth: {},
      policyValues: {},
      isDefault: true,
    },
    auditActorAccountId: account.id,
    auditActorTokenId: null,
  });
  await store.projectVersions.create({
    projectId: project.value.id,
    row: {
      id: ids.uuid(),
      orgId: org.id,
      bundleDigest: 'sha256:bundle',
      bundleBlobKey: 'projects/p/versions/bundle.json.gz',
      bundleSizeBytes: 2,
      summary: { projectName: 'notes-demo', services: [], routes: { ui: {}, http: {} }, middleware: {}, mounts: [] },
      uploadedByAccountId: account.id,
    },
    auditActorAccountId: account.id,
    auditActorTokenId: null,
  });

  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('subject', { org, account, role: 'admin', scopes: ['project:read', 'version:publish', 'deploy:execute', 'project:delete'], tokenId: null });
    c.set('tx', {} as never);
    await next();
  });
  app.route('/v1/orgs/:orgSlug/projects/:projSlug/operations', projectOperationRoutes({
    ids,
    scheduleDeployment,
    resolveDeps: () => ({
      organizations: store.organizations,
      projects: store.projects,
      deployments: store.deployments,
      projectOperations: store.projectOperations,
      projectVersions: store.projectVersions,
      deployTargets: store.deployTargets,
    } as never),
  }));
  return app;
}
```

- [ ] **Step 2: Run route test and verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/routes/project-operations.test.ts
```

Expected: FAIL because `project-operations.ts` route does not exist.

- [ ] **Step 3: Add error status mappings**

In `apps/platform-http/src/middleware/error-handler.ts`, add:

```ts
  PROJECT_OPERATION_NOT_FOUND: 404,
  PROJECT_OPERATION_ACTIVE_DEPLOYMENT: 409,
  PROJECT_OPERATION_DEFAULT_TARGET_MISSING: 409,
  PROJECT_OPERATION_INVALID_STATE: 409,
  PROJECT_OPERATION_CONFIRMATION_MISMATCH: 400,
  PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT: 400,
  PROJECT_OPERATION_DELETE_TEARDOWN_FAILED: 500,
```

- [ ] **Step 4: Wire project operation repo**

In `apps/platform-http/src/resolve-deps.ts`, import `PgProjectOperationRepo` and add `projectOperations` to `RequestRepos` and `resolveDeps`:

```ts
  projectOperations: ProjectOperationRepo;
```

```ts
    projectOperations: new PgProjectOperationRepo(tx),
```

- [ ] **Step 5: Create project operation routes**

Create `apps/platform-http/src/routes/project-operations.ts`:

```ts
import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import {
  StartProjectDeleteOperationRequestSchema,
  StartProjectUpdateOperationRequestSchema,
  getProjectOperation,
  isOk,
  listProjectOperations,
  parseCanonicalBundle,
  publishProjectVersion,
  readProjectOperationLogs,
  startProjectDeleteOperation,
  startProjectUpdateOperation,
  type BlobStore,
  type Ids,
} from '@rntme/platform-core';
import type { PoolClient } from 'pg';
import { materializeAndCompose } from '../blueprint/load.js';
import { requireOrgMatch, requireScope } from '../middleware/auth.js';
import { respond, resolveProject } from './helpers.js';
import { resolveDeps as defaultResolveDeps, type RequestRepos } from '../resolve-deps.js';

const BUNDLE_MAX_BYTES = 10 * 1024 * 1024;

type Deps = {
  readonly ids: Ids;
  readonly blob?: BlobStore;
  readonly resolveDeps?: (tx: PoolClient) => RequestRepos;
  readonly scheduleDeployment?: (deploymentId: string, orgId: string) => void;
  readonly scheduleProjectDelete?: (operationId: string, orgId: string) => void;
};

export function projectOperationRoutes(deps: Deps): Hono {
  const app = new Hono();
  const resolve = deps.resolveDeps ?? defaultResolveDeps;

  app.use('*', requireOrgMatch('orgSlug'));

  app.post('/update', requireScope('deploy:execute'), async (c) => {
    const repos = resolve(c.get('tx'));
    const project = await resolveProject(repos, c.req.param('orgSlug') ?? '', c.req.param('projSlug') ?? '');
    if (!project.ok) return respond(c, project);

    const parsed = StartProjectUpdateOperationRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    }

    const subject = c.get('subject');
    let req = parsed.data;
    if (req.bundle !== undefined) {
      if (deps.blob === undefined) {
        return c.json({ error: { code: 'PLATFORM_INTERNAL', message: 'blob store unavailable' } }, 500);
      }
      const bytes = Buffer.from(req.bundle.bytesBase64, 'base64');
      if (bytes.byteLength > BUNDLE_MAX_BYTES) {
        return c.json({ error: { code: 'PROJECT_VERSION_BUNDLE_TOO_LARGE', message: `max ${BUNDLE_MAX_BYTES} bytes` } }, 413);
      }
      const parsedBundle = parseCanonicalBundle(bytes);
      if (!isOk(parsedBundle)) return respond(c, parsedBundle);
      const composed = await materializeAndCompose(parsedBundle.value.bundle);
      if (!isOk(composed)) return respond(c, composed);
      const published = await publishProjectVersion(
        { repos: { projects: repos.projects, projectVersions: repos.projectVersions }, blob: deps.blob, ids: deps.ids },
        {
          orgId: subject.org.id,
          projectId: project.value.project.id,
          accountId: subject.account.id,
          tokenId: subject.tokenId ?? null,
          bundleBytes: bytes,
          bundleDigest: parsedBundle.value.digest,
          summary: composed.value.summary,
        },
      );
      if (!isOk(published)) return respond(c, published);
      req = { targetSlug: req.targetSlug, projectVersionSeq: published.value.seq };
    }

    const result = await startProjectUpdateOperation(
      { repos, ids: deps.ids },
      {
        orgId: subject.org.id,
        projectId: project.value.project.id,
        accountId: subject.account.id,
        tokenId: subject.tokenId ?? null,
        req,
      },
    );
    if (isOk(result)) deps.scheduleDeployment?.(result.value.deployment.id, subject.org.id);
    return respond(c, result, 202);
  });

  app.post('/delete', requireScope('project:delete'), async (c) => {
    const repos = resolve(c.get('tx'));
    const project = await resolveProject(repos, c.req.param('orgSlug') ?? '', c.req.param('projSlug') ?? '');
    if (!project.ok) return respond(c, project);
    const parsed = StartProjectDeleteOperationRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    }
    const subject = c.get('subject');
    const result = await startProjectDeleteOperation(
      { repos, ids: deps.ids },
      {
        orgId: subject.org.id,
        projectId: project.value.project.id,
        projectSlug: project.value.project.slug,
        accountId: subject.account.id,
        tokenId: subject.tokenId ?? null,
        req: parsed.data,
      },
    );
    if (isOk(result)) deps.scheduleProjectDelete?.(result.value.operation.id, subject.org.id);
    return respond(c, result, 202);
  });

  app.get('/', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const project = await resolveProject(repos, c.req.param('orgSlug') ?? '', c.req.param('projSlug') ?? '');
    if (!project.ok) return respond(c, project);
    const result = await listProjectOperations({ repos }, { projectId: project.value.project.id, limit: Number(c.req.query('limit') ?? 50) });
    return respond(c, result, 200, 'operations');
  });

  app.get('/:operationId', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const result = await getProjectOperation({ repos }, { operationId: c.req.param('operationId') });
    if (isOk(result) && result.value === null) {
      return c.json({ error: { code: 'PROJECT_OPERATION_NOT_FOUND', message: c.req.param('operationId') } }, 404);
    }
    return respond(c, result, 200, 'operation');
  });

  app.get('/:operationId/logs', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const result = await readProjectOperationLogs(
      { repos },
      {
        operationId: c.req.param('operationId'),
        sinceLineId: Number(c.req.query('sinceLineId') ?? 0),
        limit: Number(c.req.query('limit') ?? 200),
      },
    );
    return respond(c, result, 200);
  });

  return app;
}
```

- [ ] **Step 6: Update existing startDeployment callers**

In `apps/platform-http/src/routes/deployments.ts` and `apps/platform-http/src/ui/app.tsx`, update `startDeployment({ repos, ids: ... })` calls to pass a repos object that includes `projects`. Use:

```ts
startDeployment({ repos: { ...repos, projects: repos.projects }, ids: deps.ids }, ...)
```

If TypeScript already infers `repos` includes projects, pass `{ repos, ids: deps.ids }`.

- [ ] **Step 7: Mount route and update body limit**

In `apps/platform-http/src/app.ts`, import `projectOperationRoutes`, add update operation to the 10 MiB body limit regex:

```ts
const isPublish = /\/v1\/orgs\/[^/]+\/projects\/[^/]+\/versions\/?$/.test(url.pathname)
  || /\/v1\/orgs\/[^/]+\/projects\/[^/]+\/operations\/update\/?$/.test(url.pathname);
```

Mount routes before project version/deployment routes:

```ts
  authed.route(
    '/orgs/:orgSlug/projects/:projSlug/operations',
    projectOperationRoutes({ blob: deps.blob, ids: deps.ids, scheduleDeployment, scheduleProjectDelete }),
  );
```

Add this scheduler definition; Task 6 replaces the function body with the real
delete executor call:

```ts
  const scheduleProjectDelete = deps.scheduleProjectDelete ?? ((operationId: string, orgId: string) => {
    deps.logger.warn({ operationId, orgId }, 'project delete executor not wired yet');
  });
```

Add `scheduleProjectDelete?: (operationId: string, orgId: string) => void;` to `AppDeps`.

- [ ] **Step 8: Run platform-http route tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/routes/project-operations.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/platform-http/src/routes/project-operations.ts apps/platform-http/src/routes/project-versions.ts apps/platform-http/src/routes/deployments.ts apps/platform-http/src/middleware/error-handler.ts apps/platform-http/src/resolve-deps.ts apps/platform-http/src/app.ts apps/platform-http/test/unit/routes/project-operations.test.ts apps/platform-http/test/e2e/project-version-upload.test.ts apps/platform-http/test/e2e/deploy-flow.test.ts
git commit -m "feat(platform-http): add project operation routes"
```

---

### Task 6: Delete Executor And Operation Finalization

**Files:**
- Modify: `apps/platform-http/src/deploy/dokploy-client-factory.ts`
- Create: `apps/platform-http/src/deploy/project-delete-executor.ts`
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/src/deploy/orphan-detect.ts`
- Modify: `apps/platform-http/src/app.ts`
- Test: `apps/platform-http/test/unit/deploy/project-delete-executor.test.ts`
- Test: `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`
- Test: `apps/platform-http/test/unit/deploy/orphan-detect.test.ts`

- [ ] **Step 1: Write failing delete executor test**

Create `apps/platform-http/test/unit/deploy/project-delete-executor.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ok, type DeployTargetWithSecret, type ProjectOperationRepo, type DeploymentRepo, type ProjectRepo } from '@rntme/platform-core';
import { runProjectDeleteOperation } from '../../../src/deploy/project-delete-executor.js';

describe('runProjectDeleteOperation', () => {
  it('deletes applied resources grouped by target and decommissions project', async () => {
    const operations = operationRepo();
    const projects = projectRepo();
    const deployments = deploymentRepo();
    const deployTargets = {
      getWithSecretById: vi.fn(async () => ok(target('target-1'))),
    };
    const client = {
      deleteApplication: vi.fn(async () => undefined),
      deleteCompose: vi.fn(async () => undefined),
    };

    await runProjectDeleteOperation('operation-1', 'org-1', {
      withOrgTx: async (_orgId, fn) => fn({ projectOperations: operations, projects, deployments, deployTargets } as never),
      dokployClientFactory: () => client as never,
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      heartbeatMs: 1_000,
    });

    expect(client.deleteApplication).toHaveBeenCalledWith('app_1');
    expect(client.deleteCompose).toHaveBeenCalledWith('compose_1');
    expect(projects.setStatus).toHaveBeenCalledWith('org-1', 'project-1', 'decommissioned');
    expect(operations.finalize).toHaveBeenCalledWith('operation-1', expect.objectContaining({ status: 'succeeded' }));
  });
});
```

Add concrete fake helpers in the same test file:

```ts
function operationRepo(): ProjectOperationRepo {
  return {
    create: vi.fn(),
    attachDeployment: vi.fn(),
    getById: vi.fn(async () => ok({
      id: 'operation-1',
      orgId: 'org-1',
      projectId: 'project-1',
      kind: 'delete',
      status: 'queued',
      requestedByAccountId: 'account-1',
      requestedByTokenId: null,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: {},
      result: null,
      errorCode: null,
      errorMessage: null,
      queuedAt: new Date(),
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
    })),
    getByDeploymentId: vi.fn(),
    listByProject: vi.fn(),
    transition: vi.fn(async () => ok(undefined)),
    finalize: vi.fn(async (_id, args) => ok({
      id: 'operation-1',
      orgId: 'org-1',
      projectId: 'project-1',
      kind: 'delete',
      status: args.status,
      requestedByAccountId: 'account-1',
      requestedByTokenId: null,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: {},
      result: args.result ?? null,
      errorCode: args.errorCode ?? null,
      errorMessage: args.errorMessage ?? null,
      queuedAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
      lastHeartbeatAt: new Date(),
    })),
    touchHeartbeat: vi.fn(async () => ok(undefined)),
    appendLog: vi.fn(async () => ok(undefined)),
    readLogs: vi.fn(),
    findStaleRunning: vi.fn(),
  } as ProjectOperationRepo;
}

function projectRepo(): Pick<ProjectRepo, 'setStatus'> {
  return { setStatus: vi.fn(async () => ok({} as never)) };
}

function deploymentRepo(): Pick<DeploymentRepo, 'listAppliedResourcesByProject'> {
  return {
    listAppliedResourcesByProject: vi.fn(async () => ok([
      {
        deploymentId: 'deployment-1',
        targetId: 'target-1',
        resources: [
          { resourceKind: 'application', targetResourceId: 'app_1', targetResourceName: 'api' },
          { resourceKind: 'compose', targetResourceId: 'compose_1', targetResourceName: 'event-bus' },
        ],
      },
    ])),
  };
}

function target(id: string): DeployTargetWithSecret {
  return {
    id,
    orgId: 'org-1',
    slug: 'dokploy',
    displayName: 'Dokploy',
    kind: 'dokploy',
    dokployUrl: 'https://dokploy.example.com',
    publicBaseUrl: null,
    dokployProjectId: 'project-1',
    dokployProjectName: null,
    allowCreateProject: false,
    apiTokenCiphertext: Buffer.from('secret'),
    apiTokenNonce: Buffer.from('nonce'),
    apiTokenKeyVersion: 1,
    eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
    modules: {},
    auth: {},
    policyValues: {},
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

- [ ] **Step 2: Run delete executor test and verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/project-delete-executor.test.ts
```

Expected: FAIL because `project-delete-executor.ts` does not exist.

- [ ] **Step 3: Add real Dokploy delete methods**

In `apps/platform-http/src/deploy/dokploy-client-factory.ts`, add to returned client:

```ts
      deleteApplication: async (applicationId: string) => {
        await request('POST', '/api/application.delete', { applicationId });
      },
      deleteCompose: async (composeId: string) => {
        await request('POST', '/api/compose.delete', { composeId });
      },
```

Before implementing, verify endpoint names against the deployed Dokploy API. If the deployed API uses a different path, update the two strings in this step and the tests in the same commit.

- [ ] **Step 4: Implement delete executor**

Create `apps/platform-http/src/deploy/project-delete-executor.ts`:

```ts
import { clearInterval, setInterval } from 'node:timers';
import { deleteDokployResources, type DokployDeleteResource } from '@rntme/deploy-dokploy';
import { isOk, type DeployTargetRepo, type DeploymentRepo, type ProjectOperationRepo, type ProjectRepo } from '@rntme/platform-core';
import type { Logger } from 'pino';
import type { DokployClientFactory } from './dokploy-client-factory.js';

export type ProjectDeleteExecutorDeps = {
  readonly withOrgTx: <T>(orgId: string, fn: (repos: {
    projectOperations: ProjectOperationRepo;
    projects: ProjectRepo;
    deployments: DeploymentRepo;
    deployTargets: DeployTargetRepo;
  }) => Promise<T>) => Promise<T>;
  readonly dokployClientFactory: DokployClientFactory;
  readonly logger: Pick<Logger, 'error' | 'warn' | 'info'>;
  readonly heartbeatMs?: number;
};

export async function runProjectDeleteOperation(
  operationId: string,
  orgId: string,
  deps: ProjectDeleteExecutorDeps,
): Promise<void> {
  const heartbeat = setInterval(() => {
    void deps.withOrgTx(orgId, (repos) => repos.projectOperations.touchHeartbeat(operationId)).catch(() => undefined);
  }, deps.heartbeatMs ?? 5_000);

  try {
    const operation = await deps.withOrgTx(orgId, async (repos) => {
      const op = await repos.projectOperations.getById(operationId);
      if (!isOk(op) || !op.value) throw new Error('PROJECT_OPERATION_NOT_FOUND');
      const transition = await repos.projectOperations.transition(operationId, 'running', { startedAt: new Date() });
      if (!isOk(transition)) throw new Error(transition.errors[0]?.code ?? 'PROJECT_OPERATION_INVALID_STATE');
      await repos.projectOperations.appendLog({ operationId, orgId, level: 'info', step: 'init', message: `Starting project delete operation projectId=${op.value.projectId}` });
      return op.value;
    });

    const applied = await deps.withOrgTx(orgId, (repos) => repos.deployments.listAppliedResourcesByProject(operation.projectId));
    if (!isOk(applied)) throw new Error(applied.errors[0]?.message ?? 'failed to read applied resources');

    const groups = groupByTarget(applied.value);
    const deleted: DokployDeleteResource[] = [];
    const warnings: string[] = [];
    const failures: Array<{ targetId: string; message: string }> = [];

    for (const [targetId, resources] of groups) {
      const target = await deps.withOrgTx(orgId, (repos) => repos.deployTargets.getWithSecretById(targetId));
      if (!isOk(target) || !target.value) {
        failures.push({ targetId, message: 'deploy target not found' });
        continue;
      }
      await appendLog(deps, operationId, orgId, 'info', 'teardown', `Deleting ${resources.length} resources from target ${target.value.slug}`);
      const result = await deleteDokployResources(resources, deps.dokployClientFactory(target.value));
      if (!isOk(result)) {
        failures.push({ targetId, message: result.errors[0]?.message ?? 'delete failed' });
        continue;
      }
      deleted.push(...result.value.deletedResources);
      warnings.push(...result.value.warnings);
      for (const warning of result.value.warnings) {
        await appendLog(deps, operationId, orgId, 'warn', 'teardown', warning);
      }
    }

    if (failures.length > 0) {
      await deps.withOrgTx(orgId, async (repos) => {
        await repos.projectOperations.finalize(operationId, {
          status: 'failed',
          result: { deletedResources: deleted, warnings, failures },
          errorCode: 'PROJECT_OPERATION_DELETE_TEARDOWN_FAILED',
          errorMessage: failures.map((f) => `${f.targetId}: ${f.message}`).join('; '),
        });
        await repos.projects.setStatus(orgId, operation.projectId, 'delete_failed');
      });
      return;
    }

    await deps.withOrgTx(orgId, async (repos) => {
      await repos.projectOperations.finalize(operationId, {
        status: 'succeeded',
        result: { deletedResources: deleted, warnings },
      });
      await repos.projects.setStatus(orgId, operation.projectId, 'decommissioned');
    });
  } catch (cause) {
    deps.logger.error({ operationId, cause }, 'project delete executor failed');
    await deps.withOrgTx(orgId, async (repos) => {
      const op = await repos.projectOperations.getById(operationId);
      const projectId = isOk(op) && op.value ? op.value.projectId : null;
      await repos.projectOperations.finalize(operationId, {
        status: 'failed',
        errorCode: 'PROJECT_OPERATION_DELETE_TEARDOWN_FAILED',
        errorMessage: cause instanceof Error ? cause.message : String(cause),
      });
      if (projectId !== null) await repos.projects.setStatus(orgId, projectId, 'delete_failed');
    }).catch((finalizeCause) => {
      deps.logger.error({ operationId, cause: finalizeCause }, 'project delete finalize failed');
    });
  } finally {
    clearInterval(heartbeat);
  }
}

function groupByTarget(rows: readonly {
  readonly targetId: string;
  readonly resources: readonly DokployDeleteResource[];
}[]): Map<string, DokployDeleteResource[]> {
  const out = new Map<string, DokployDeleteResource[]>();
  for (const row of rows) {
    const list = out.get(row.targetId) ?? [];
    list.push(...row.resources);
    out.set(row.targetId, list);
  }
  return out;
}

async function appendLog(
  deps: ProjectDeleteExecutorDeps,
  operationId: string,
  orgId: string,
  level: 'info' | 'warn' | 'error',
  step: string,
  message: string,
): Promise<void> {
  await deps.withOrgTx(orgId, async (repos) => {
    await repos.projectOperations.appendLog({ operationId, orgId, level, step, message });
  });
}
```

- [ ] **Step 5: Finalize update operations from deployment executor**

In `apps/platform-http/src/deploy/executor.ts`, add `projectOperations` to `TxRepos`. In `finalize`, after `repos.deployments.finalize`, look up a linked operation:

```ts
    const operation = await repos.projectOperations.getByDeploymentId(deploymentId);
    if (isOk(operation) && operation.value?.kind === 'update') {
      const opStatus = status === 'succeeded' || status === 'succeeded_with_warnings' ? 'succeeded' : 'failed';
      const finalized = await repos.projectOperations.finalize(operation.value.id, {
        status: opStatus,
        result: { deploymentId, deploymentStatus: status },
        ...(opStatus === 'failed' ? { errorCode: args.errorCode ?? status, errorMessage: args.errorMessage ?? status } : {}),
      });
      if (!isOk(finalized)) deps.logger.warn({ deploymentId, errors: finalized.errors }, 'project operation finalize failed');
    }
```

- [ ] **Step 6: Wire delete scheduler**

In `apps/platform-http/src/app.ts`, import `runProjectDeleteOperation`, build `projectDeleteExecutorDeps`, and replace the scheduler body from Task 5 with:

```ts
  const projectDeleteExecutorDeps = {
    withOrgTx,
    dokployClientFactory: createDokployClientFactory(cipher),
    logger: deps.logger,
  };
  const scheduleProjectDelete = deps.scheduleProjectDelete ?? ((operationId: string, orgId: string) => {
    setImmediate(() => {
      void runProjectDeleteOperation(operationId, orgId, projectDeleteExecutorDeps).catch((cause) => {
        deps.logger.error({ operationId, cause }, 'scheduled project delete failed');
      });
    });
  });
```

- [ ] **Step 7: Extend orphan detection for project operations**

Update `apps/platform-http/src/deploy/orphan-detect.ts` dependencies to accept `projectOperations` stale finder and finalize callback. The tick must finalize stale running operations as failed and set project status `delete_failed` when kind is `delete`. Use:

```ts
const staleOperations = await deps.findStaleRunningProjectOperations(60);
```

Add `findStaleRunningProjectOperations` in `app.ts` using `new PgProjectOperationRepo(deps.pool).findStaleRunning(staleAfterSeconds)`.

- [ ] **Step 8: Run platform-http deploy tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/project-delete-executor.test.ts test/unit/deploy/dokploy-client-factory.test.ts test/unit/deploy/orphan-detect.test.ts test/unit/deploy/executor.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/platform-http/src/deploy/dokploy-client-factory.ts apps/platform-http/src/deploy/project-delete-executor.ts apps/platform-http/src/deploy/executor.ts apps/platform-http/src/deploy/orphan-detect.ts apps/platform-http/src/app.ts apps/platform-http/test/unit/deploy/project-delete-executor.test.ts apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts apps/platform-http/test/unit/deploy/orphan-detect.test.ts apps/platform-http/test/unit/deploy/executor.test.ts
git commit -m "feat(platform-http): run project delete operations"
```

---

### Task 7: CLI Project Operation Commands

**Files:**
- Modify: `apps/cli/src/api/types.ts`
- Modify: `apps/cli/src/api/endpoints.ts`
- Create: `apps/cli/src/commands/project/update.ts`
- Create: `apps/cli/src/commands/project/delete.ts`
- Create: `apps/cli/src/commands/project/operation-list.ts`
- Create: `apps/cli/src/commands/project/operation-show.ts`
- Create: `apps/cli/src/commands/project/operation-watch.ts`
- Modify: `apps/cli/src/bin/cli.ts`
- Test: `apps/cli/test/unit/commands/project/operation.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Create `apps/cli/test/unit/commands/project/operation.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest';
import { runProjectDelete } from '../../../../src/commands/project/delete.js';
import { runProjectUpdate } from '../../../../src/commands/project/update.js';
import { runProjectOperationShow } from '../../../../src/commands/project/operation-show.js';

const operation = {
  id: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  kind: 'delete',
  status: 'queued',
  requestedByAccountId: '44444444-4444-4444-8444-444444444444',
  requestedByTokenId: null,
  targetId: null,
  projectVersionId: null,
  deploymentId: null,
  input: { confirm: 'notes-demo' },
  result: null,
  errorCode: null,
  errorMessage: null,
  queuedAt: '2026-05-03T12:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  lastHeartbeatAt: null,
};

const flags = {
  org: 'acme',
  project: 'notes-demo',
  token: 'rntme_pat_test',
  baseUrl: 'https://platform.example',
  json: true,
};

describe('project operation commands', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('starts delete with confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ operation }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectDelete({ slug: 'notes-demo', confirm: 'notes-demo' }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/orgs/acme/projects/notes-demo/operations/delete');
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ confirm: 'notes-demo' });
  });

  it('refuses delete without confirm before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectDelete({ slug: 'notes-demo' }, flags);

    expect(exit).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts update by existing version', async () => {
    const update = { ...operation, kind: 'update', deploymentId: '55555555-5555-4555-8555-555555555555' };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ operation: update, deployment: { id: update.deploymentId } }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectUpdate({ version: 4, target: 'dokploy-preview' }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/orgs/acme/projects/notes-demo/operations/update');
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      projectVersionSeq: 4,
      targetSlug: 'dokploy-preview',
    });
  });

  it('shows an operation by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ operation }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectOperationShow({ operationId: operation.id }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://platform.example/v1/orgs/acme/projects/notes-demo/operations/${operation.id}`);
  });
});
```

- [ ] **Step 2: Run CLI tests and verify failure**

Run:

```bash
pnpm -F @rntme/cli test -- test/unit/commands/project/operation.test.ts
```

Expected: FAIL because operation command modules and schemas do not exist.

- [ ] **Step 3: Add API types**

In `apps/cli/src/api/types.ts`, add:

```ts
export const ProjectOperationStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type ProjectOperationStatus = z.infer<typeof ProjectOperationStatusSchema>;

export const ProjectOperationSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  projectId: z.string(),
  kind: z.enum(['update', 'delete']),
  status: ProjectOperationStatusSchema,
  requestedByAccountId: z.string(),
  requestedByTokenId: z.string().nullable(),
  targetId: z.string().nullable(),
  projectVersionId: z.string().nullable(),
  deploymentId: z.string().nullable(),
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  queuedAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  lastHeartbeatAt: z.string().nullable(),
});
export type ProjectOperation = z.infer<typeof ProjectOperationSchema>;

export const ProjectOperationLogLineSchema = z.object({
  id: z.number().int().nonnegative(),
  operationId: z.string(),
  orgId: z.string(),
  ts: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  step: z.string(),
  message: z.string(),
});

export const ProjectOperationResponseSchema = z.object({
  operation: ProjectOperationSchema,
  deployment: z.unknown().optional(),
});
export const ProjectOperationsListResponseSchema = z.object({ operations: z.array(ProjectOperationSchema) });
export const ProjectOperationLogsResponseSchema = z.object({
  lines: z.array(ProjectOperationLogLineSchema),
  lastLineId: z.number().int().nonnegative(),
});
```

- [ ] **Step 4: Add endpoints**

In `apps/cli/src/api/endpoints.ts`, import the new schemas and add:

```ts
  projectOperations: {
    update: (c: Ctx, org: string, project: string, body: Record<string, unknown>) =>
      apiCall({
        method: 'POST',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations/update`,
        body,
        responseSchema: ProjectOperationResponseSchema,
        timeoutMs: 120_000,
        ...c,
      }),
    delete: (c: Ctx, org: string, project: string, body: { confirm: string }) =>
      apiCall({
        method: 'POST',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations/delete`,
        body,
        responseSchema: ProjectOperationResponseSchema,
        ...c,
      }),
    list: (c: Ctx, org: string, project: string, opts?: { limit?: number }) => {
      const qs = new URLSearchParams();
      if (opts?.limit) qs.set('limit', String(opts.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations${suffix}`,
        responseSchema: ProjectOperationsListResponseSchema,
        ...c,
      });
    },
    show: (c: Ctx, org: string, project: string, operationId: string) =>
      apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations/${enc(operationId)}`,
        responseSchema: ProjectOperationResponseSchema,
        ...c,
      }),
    logs: (c: Ctx, org: string, project: string, operationId: string, opts: { sinceLineId: number; limit: number }) => {
      const qs = new URLSearchParams();
      qs.set('sinceLineId', String(opts.sinceLineId));
      qs.set('limit', String(opts.limit));
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/operations/${enc(operationId)}/logs?${qs.toString()}`,
        responseSchema: ProjectOperationLogsResponseSchema,
        ...c,
      });
    },
  },
```

- [ ] **Step 5: Implement commands**

Create `apps/cli/src/commands/project/delete.ts`:

```ts
import { endpoints } from '../../api/endpoints.js';
import type { ProjectOperationResponseSchema } from '../../api/types.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type OperationResponse = z.infer<typeof ProjectOperationResponseSchema>;

export type ProjectDeleteArgs = { slug: string; confirm?: string; wait?: boolean; timeoutSec?: number };

export async function runProjectDelete(args: ProjectDeleteArgs, flags: CommonFlags): Promise<number> {
  return runCommand<OperationResponse>(
    { ...flags, project: args.slug },
    {
      requireToken: true,
      humanRender: (d) => `project delete queued\n  id:     ${d.operation.id}\n  status: ${d.operation.status}`,
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (args.confirm !== args.slug) return err(cliError('CLI_USAGE', `delete requires --confirm ${args.slug}`));
      return endpoints.projectOperations.delete(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        args.slug,
        { confirm: args.confirm },
      );
    },
  );
}
```

Create `apps/cli/src/commands/project/update.ts`:

```ts
import { resolve } from 'node:path';
import { loadComposedBlueprint } from '@rntme/blueprint';
import { buildProjectBundle } from '../../bundle/build.js';
import { endpoints } from '../../api/endpoints.js';
import type { ProjectOperationResponseSchema } from '../../api/types.js';
import { err, isOk } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type OperationResponse = z.infer<typeof ProjectOperationResponseSchema>;

export type ProjectUpdateArgs = {
  readonly folder?: string;
  readonly version?: number;
  readonly target?: string;
  readonly wait?: boolean;
  readonly timeoutSec?: number;
};

export async function runProjectUpdate(args: ProjectUpdateArgs, flags: CommonFlags): Promise<number> {
  return runCommand<OperationResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => [
        'project update queued',
        `  id:         ${d.operation.id}`,
        `  status:     ${d.operation.status}`,
        `  deployment: ${d.operation.deploymentId ?? ''}`,
      ].join('\n'),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      if (args.folder !== undefined && args.version !== undefined) {
        return err(cliError('CLI_USAGE', 'cannot use folder and --version together'));
      }

      const body: Record<string, unknown> = {};
      if (args.target !== undefined) body.targetSlug = args.target;
      if (args.version !== undefined) {
        body.projectVersionSeq = args.version;
      } else {
        const folder = resolve(process.cwd(), args.folder ?? '.');
        const composed = loadComposedBlueprint(folder);
        if (!composed.ok) {
          return err(cliError('CLI_VALIDATE_LOCAL_FAILED', composed.errors.map((e) => `${e.code}: ${e.message}`).join('; ')));
        }
        const built = buildProjectBundle(folder);
        if (!isOk(built)) return built;
        body.bundle = {
          contentType: 'application/rntme-project-bundle+json',
          bytesBase64: Buffer.from(built.value.bytes).toString('base64'),
        };
      }

      return endpoints.projectOperations.update(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        body,
      );
    },
  );
}
```

Create `apps/cli/src/commands/project/operation-list.ts`:

```ts
import { endpoints } from '../../api/endpoints.js';
import type { ProjectOperationsListResponseSchema } from '../../api/types.js';
import { renderTable } from '../../output/tables.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type OperationsList = z.infer<typeof ProjectOperationsListResponseSchema>;

export type ProjectOperationListArgs = { readonly limit?: number | undefined };

export async function runProjectOperationList(args: ProjectOperationListArgs, flags: CommonFlags): Promise<number> {
  return runCommand<OperationsList>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        renderTable(
          ['ID', 'KIND', 'STATUS', 'QUEUED', 'FINISHED'],
          d.operations.map((operation) => [
            operation.id.slice(0, 8),
            operation.kind,
            operation.status,
            operation.queuedAt,
            operation.finishedAt ?? '',
          ]),
          { maxWidths: [8, 8, 12, 24, 24] },
        ),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      const opts: { limit?: number } = {};
      if (args.limit !== undefined) opts.limit = args.limit;
      return endpoints.projectOperations.list({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, project, opts);
    },
  );
}
```

Create `apps/cli/src/commands/project/operation-show.ts`:

```ts
import { endpoints } from '../../api/endpoints.js';
import type { ProjectOperationResponseSchema } from '../../api/types.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { validateUuid } from '../../util/uuid.js';
import type { z } from 'zod';

type OperationResponse = z.infer<typeof ProjectOperationResponseSchema>;

export type ProjectOperationShowArgs = { readonly operationId: string };

export async function runProjectOperationShow(args: ProjectOperationShowArgs, flags: CommonFlags): Promise<number> {
  return runCommand<OperationResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => [
        `id:       ${d.operation.id}`,
        `kind:     ${d.operation.kind}`,
        `status:   ${d.operation.status}`,
        `deploy:   ${d.operation.deploymentId ?? ''}`,
        `error:    ${d.operation.errorCode ?? ''}`,
        `message:  ${d.operation.errorMessage ?? ''}`,
        `queued:   ${d.operation.queuedAt}`,
        `started:  ${d.operation.startedAt ?? ''}`,
        `finished: ${d.operation.finishedAt ?? ''}`,
        '',
        `input:    ${JSON.stringify(d.operation.input)}`,
        `result:   ${JSON.stringify(d.operation.result ?? {})}`,
      ].join('\n'),
    },
    async (ctx) => {
      const id = validateUuid(args.operationId, 'operation-id');
      if (!id.ok) return id;
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return endpoints.projectOperations.show({ baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token }, org, project, id.value);
    },
  );
}
```

Create `apps/cli/src/commands/project/operation-watch.ts`:

```ts
import { endpoints } from '../../api/endpoints.js';
import type { ProjectOperationResponseSchema, ProjectOperationStatus } from '../../api/types.js';
import { err, isOk, type Result } from '../../result.js';
import { cliError, type CliError } from '../../errors/codes.js';
import type { ClientError } from '../../api/client.js';
import { runCommand, type CommonFlags } from '../harness.js';
import { validateUuid } from '../../util/uuid.js';
import type { z } from 'zod';

type OperationResponse = z.infer<typeof ProjectOperationResponseSchema>;

export type ProjectOperationWatchArgs = {
  readonly operationId: string;
  readonly pollIntervalMs?: number | undefined;
  readonly timeoutMs?: number | undefined;
};

const TERMINAL = new Set<ProjectOperationStatus>(['succeeded', 'failed']);

export async function watchProjectOperationUntilTerminal(opts: {
  apiCtx: { baseUrl: string; token: string | null };
  org: string;
  project: string;
  operationId: string;
  pollIntervalMs?: number | undefined;
  timeoutMs?: number | undefined;
  printLogs?: boolean | undefined;
}): Promise<Result<OperationResponse, ClientError | CliError>> {
  const { apiCtx, org, project, operationId, pollIntervalMs = 2_000, timeoutMs, printLogs = true } = opts;
  let sinceLineId = 0;
  const startTime = Date.now();

  while (true) {
    if (timeoutMs !== undefined && Date.now() - startTime > timeoutMs) {
      return err(cliError('CLI_NETWORK_TIMEOUT', `project operation watch timed out after ${timeoutMs}ms`));
    }
    const status = await endpoints.projectOperations.show(apiCtx, org, project, operationId);
    if (!isOk(status)) return status;
    const logs = await endpoints.projectOperations.logs(apiCtx, org, project, operationId, { sinceLineId, limit: 200 });
    if (!isOk(logs)) return logs;
    if (printLogs) {
      for (const line of logs.value.lines) {
        process.stdout.write(`[${line.level}] ${line.step}: ${line.message}\n`);
      }
    }
    sinceLineId = logs.value.lastLineId;
    if (TERMINAL.has(status.value.operation.status)) return status;
    await sleep(pollIntervalMs);
  }
}

export async function runProjectOperationWatch(args: ProjectOperationWatchArgs, flags: CommonFlags): Promise<number> {
  return runCommand<OperationResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => `project operation ${d.operation.id} ${d.operation.status}`,
      successExitCode: (d) => d.operation.status === 'succeeded' ? 0 : 10,
    },
    async (ctx) => {
      const id = validateUuid(args.operationId, 'operation-id');
      if (!id.ok) return id;
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return watchProjectOperationUntilTerminal({
        apiCtx: { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        operationId: id.value,
        pollIntervalMs: args.pollIntervalMs,
        timeoutMs: args.timeoutMs,
        printLogs: flags.json !== true && flags.quiet !== true,
      });
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 6: Wire parser**

In `apps/cli/src/bin/cli.ts`, import new command runners and add help entries:

```ts
registerHelp(['project', 'update'], `Usage: rntme project update [--org <slug>] [--project <slug>] [--version <seq>] [--target <target-slug>] [folder]`);
registerHelp(['project', 'delete'], `Usage: rntme project delete <slug> --confirm <slug> [--wait] [--timeout <sec>]`);
registerHelp(['project', 'operation', 'list'], `Usage: rntme project operation list --org <slug> --project <slug> [--limit <n>]`);
registerHelp(['project', 'operation', 'show'], `Usage: rntme project operation show --org <slug> --project <slug> <operation-id>`);
registerHelp(['project', 'operation', 'watch'], `Usage: rntme project operation watch --org <slug> --project <slug> <operation-id>`);
```

Add parser options:

```ts
confirm: { type: 'string' },
```

Add project subcommands `update`, `delete`, and `operation` using the same parsing style as `deploy` and `deployment`.

- [ ] **Step 7: Run CLI tests**

Run:

```bash
pnpm -F @rntme/cli test -- test/unit/commands/project/operation.test.ts
pnpm -F @rntme/cli typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/cli/src/api/types.ts apps/cli/src/api/endpoints.ts apps/cli/src/commands/project/update.ts apps/cli/src/commands/project/delete.ts apps/cli/src/commands/project/operation-list.ts apps/cli/src/commands/project/operation-show.ts apps/cli/src/commands/project/operation-watch.ts apps/cli/src/bin/cli.ts apps/cli/test/unit/commands/project/operation.test.ts
git commit -m "feat(cli): add project operation commands"
```

---

### Task 8: Platform UI Actions And Operation Pages

**Files:**
- Modify: `apps/platform-http/src/ui/pages/org.tsx`
- Modify: `apps/platform-http/src/ui/pages/project.tsx`
- Create: `apps/platform-http/src/ui/pages/project-operation.tsx`
- Create: `apps/platform-http/src/ui/fragments/project-operation-status.tsx`
- Create: `apps/platform-http/src/ui/fragments/project-operation-logs.tsx`
- Modify: `apps/platform-http/src/ui/app.tsx`
- Test: `apps/platform-http/test/unit/ui/pages.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Append to `apps/platform-http/test/unit/ui/pages.test.tsx`:

```ts
import { ProjectPage } from '../../../src/ui/pages/project.js';

it('renders project update and delete actions for active projects', () => {
  const html = renderToString(
    <ProjectPage
      subject={subject()}
      otherOrgs={[]}
      project={project({ status: 'active' })}
      versions={[version({ seq: 2 })]}
      defaultDeployTarget={{ id: 'target-1', slug: 'dokploy-preview', displayName: 'Dokploy Preview' } as never}
      latestOperation={null}
    />,
  );

  expect(html).toContain('operations/update');
  expect(html).toContain('operations/delete');
});

it('renders retry delete for delete_failed projects', () => {
  const html = renderToString(
    <ProjectPage
      subject={subject()}
      otherOrgs={[]}
      project={project({ status: 'delete_failed' })}
      versions={[version({ seq: 2 })]}
      defaultDeployTarget={{ id: 'target-1', slug: 'dokploy-preview', displayName: 'Dokploy Preview' } as never}
      latestOperation={null}
    />,
  );

  expect(html).toContain('Retry delete');
});
```

Use existing test helper conventions in that file; if `renderToString`, `subject`, `project`, or `version` helpers have different names, add local helpers with those exact shapes at the bottom of the file.

- [ ] **Step 2: Run UI test and verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/ui/pages.test.tsx
```

Expected: FAIL because `ProjectPage` does not accept operation/default target props.

- [ ] **Step 3: Update ProjectPage**

In `apps/platform-http/src/ui/pages/project.tsx`, extend props:

```ts
  defaultDeployTarget?: Pick<DeployTarget, 'id' | 'slug' | 'displayName'> | null;
  latestOperation?: ProjectOperation | null;
```

Add status and action section after the header:

```tsx
      <section class="mb-6 border-y border-gray-200 py-4">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <span class="rounded border border-gray-300 px-2 py-0.5 text-xs">{project.status}</span>
          {props.latestOperation ? (
            <a href={`/${subject.org.slug}/projects/${project.slug}/operations/${props.latestOperation.id}`} class="text-sm text-blue-700 hover:underline">
              Latest operation: {props.latestOperation.kind} {props.latestOperation.status}
            </a>
          ) : null}
        </div>
        {project.status === 'active' && versions.length > 0 && props.defaultDeployTarget ? (
          <form method="post" action={`/${subject.org.slug}/projects/${project.slug}/operations/update`} class="mb-3">
            <input type="hidden" name="projectVersionSeq" value={String(versions[0]!.seq)} />
            <button type="submit" class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
              Update
            </button>
            <span class="ml-2 text-sm text-gray-500">Latest version to {props.defaultDeployTarget.displayName}</span>
          </form>
        ) : null}
        {(project.status === 'active' || project.status === 'delete_failed') ? (
          <form method="post" action={`/${subject.org.slug}/projects/${project.slug}/operations/delete`} class="flex flex-wrap items-end gap-2">
            <label class="text-sm">
              <span class="mb-1 block font-medium text-gray-900">Confirm slug</span>
              <input name="confirm" class="rounded border border-gray-300 px-2 py-1" />
            </label>
            <button type="submit" class="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
              {project.status === 'delete_failed' ? 'Retry delete' : 'Delete'}
            </button>
          </form>
        ) : null}
      </section>
```

- [ ] **Step 4: Add operation page and fragments**

Create `apps/platform-http/src/ui/pages/project-operation.tsx` with a layout matching deployment detail. It must render operation id, kind, status, error code/message, input/result JSON, and a link to linked deployment when `operation.deploymentId` is not null.

Create `apps/platform-http/src/ui/fragments/project-operation-status.tsx`:

```tsx
import type { ProjectOperation } from '@rntme/platform-core';

export function ProjectOperationStatusFragment(props: { operation: ProjectOperation }) {
  return <span id="project-operation-status">{props.operation.status}</span>;
}
```

Create `apps/platform-http/src/ui/fragments/project-operation-logs.tsx`:

```tsx
import type { ProjectOperationLogLine } from '@rntme/platform-core';

export function ProjectOperationLogsFragment(props: {
  lines: readonly ProjectOperationLogLine[];
  lastLineId: number;
}) {
  return (
    <div id="project-operation-logs" data-last-line-id={String(props.lastLineId)}>
      {props.lines.map((line) => (
        <div class="border-b border-gray-100 py-1 text-xs" data-line-id={String(line.id)}>
          <span class="mr-2 font-mono text-gray-500">{line.ts.toISOString()}</span>
          <span class="mr-2 font-semibold">{line.level}</span>
          <span class="mr-2 text-gray-600">{line.step}</span>
          <span>{line.message}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Wire UI routes and forms**

In `apps/platform-http/src/ui/app.tsx`:

Import project operation use-cases and pages/fragments.

On project detail route, fetch:

```ts
const [versionsRes, targetsRes, operationsRes, otherRes, orgRes] = await Promise.all([
  listProjectVersions(...),
  listDeployTargets({ repos }, { orgId: s.org.id }),
  listProjectOperations({ repos }, { projectId: projLookup.value.id, limit: 1 }),
  repos.organizations.listForAccount(s.account.id),
  repos.organizations.findById(s.org.id),
]);
```

Pass `defaultDeployTarget={targetsRes.value.find((target) => target.isDefault) ?? null}` and `latestOperation={operationsRes.value[0] ?? null}` to `ProjectPage`.

Add POST `/:orgSlug/projects/:projSlug/operations/update` with same-origin guard. It parses `projectVersionSeq` from form, calls `startProjectUpdateOperation`, schedules deployment, and redirects to operation detail.

Add POST `/:orgSlug/projects/:projSlug/operations/delete` with same-origin guard. It parses `confirm`, calls `startProjectDeleteOperation`, schedules delete, and redirects to operation detail.

Add GET operation detail, status fragment, and logs fragment routes.

- [ ] **Step 6: Run UI tests**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/ui/pages.test.tsx
pnpm -F @rntme/platform-http typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/platform-http/src/ui/pages/org.tsx apps/platform-http/src/ui/pages/project.tsx apps/platform-http/src/ui/pages/project-operation.tsx apps/platform-http/src/ui/fragments/project-operation-status.tsx apps/platform-http/src/ui/fragments/project-operation-logs.tsx apps/platform-http/src/ui/app.tsx apps/platform-http/test/unit/ui/pages.test.tsx
git commit -m "feat(platform-http): add project operation UI"
```

---

### Task 9: End-To-End Verification And Documentation Touches

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `apps/platform-http/README.md`
- Modify: `packages/platform/platform-core/README.md`
- Modify: `packages/platform/platform-storage/README.md`
- Modify: `packages/deploy/deploy-dokploy/README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update CLI README**

In `apps/cli/README.md`, add commands to the command list:

```text
  project update         Publish/deploy a project update operation
  project delete         Decommission a project and tear down deploy resources
  project operation list List project operations
  project operation show Show project operation details
  project operation watch Watch project operation logs until terminal status
```

Add examples:

```bash
rntme project update --org my-org --project notes-demo --wait demo/notes-blueprint
rntme project update --org my-org --project notes-demo --version 4 --target dokploy-preview --wait
rntme project delete notes-demo --org my-org --confirm notes-demo --wait
rntme project operation watch --org my-org --project notes-demo <operation-id>
```

- [ ] **Step 2: Update platform README**

In `apps/platform-http/README.md`, add UI routes:

```text
| `POST /{orgSlug}/projects/{projSlug}/operations/update` | Deploy latest version to default target |
| `POST /{orgSlug}/projects/{projSlug}/operations/delete` | Start project decommission |
| `GET /{orgSlug}/projects/{projSlug}/operations/{operationId}` | Project operation detail |
```

Update CSRF section to include operation POST routes. Update "Not in the UI" by removing project archiving wording and stating that upload/publish blueprint remains CLI-only.

- [ ] **Step 3: Update package READMEs**

In `packages/platform/platform-core/README.md`, add a "Project operations" section:

```md
## Project operations

`platform-core` owns `ProjectOperation` schemas and use-cases for project update and delete. Update operations resolve a project version and deploy target, then create a linked deployment. Delete operations transition project status to `deleting`; the platform executor performs Dokploy teardown and finalizes the project as `decommissioned` or `delete_failed`.
```

In `packages/platform/platform-storage/README.md`, add:

```md
`project_operation` and `project_operation_log_line` store project-level update/delete status and logs under tenant RLS. Project rows keep their slug and history after delete by moving through `active -> deleting -> decommissioned` or `delete_failed`.
```

In `packages/deploy/deploy-dokploy/README.md`, add:

```md
## Delete helper

`deleteDokployResources(resources, client)` deletes rntme-managed Dokploy applications before compose resources. Missing resources are warning-only so project delete retries are idempotent. The real platform client maps the seam to Dokploy application/compose delete endpoints and performs any parent-required mount/domain cleanup inside the resource delete method.
```

- [ ] **Step 4: Update AGENTS how-to**

In `AGENTS.md` §6, add:

```md
### 6.20 Update or decommission a platform project

1. Publish and deploy in one operation with `rntme project update --org <org> --project <project> [folder] --wait`; omit `--target` to use the org default deploy target.
2. Redeploy an existing version with `rntme project update --org <org> --project <project> --version <seq> --wait`.
3. Decommission with `rntme project delete <project> --org <org> --confirm <project> --wait`.
4. Observe long-running operations with `rntme project operation watch --org <org> --project <project> <operation-id>`.
5. Delete is blocked while deployments are queued/running. A failed teardown leaves the project in `delete_failed`; retry the same delete command after fixing the target issue.
```

- [ ] **Step 5: Run package-level verification**

Run:

```bash
pnpm -F @rntme/platform-core test
pnpm -F @rntme/platform-storage test
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/platform-http test
pnpm -F @rntme/cli test
pnpm -F @rntme/platform-core typecheck
pnpm -F @rntme/platform-storage typecheck
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/cli typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 6: Run lint for touched packages**

Run:

```bash
pnpm -F @rntme/platform-core lint
pnpm -F @rntme/platform-storage lint
pnpm -F @rntme/deploy-dokploy lint
pnpm -F @rntme/platform-http lint
pnpm -F @rntme/cli lint
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit docs and final fixes**

```bash
git add apps/cli/README.md apps/platform-http/README.md packages/platform/platform-core/README.md packages/platform/platform-storage/README.md packages/deploy/deploy-dokploy/README.md AGENTS.md
git commit -m "docs: document project operations workflow"
```
