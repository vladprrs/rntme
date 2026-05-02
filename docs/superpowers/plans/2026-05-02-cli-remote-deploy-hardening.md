# CLI Remote Deploy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `rntme project deploy` and `rntme project deployment <list|show|watch>` drive the existing platform deployment executor path, while hardening Auth0 edge auth, Dokploy apply, and smoke verification failures that forced direct Dokploy intervention.

**Architecture:** The CLI stays a platform HTTP client only. `platform-core` owns the required target/version deployment request contract, `platform-http` schedules every deployment through `runDeployment`, `deploy-core` owns target-neutral auth planning, and `deploy-dokploy` plus the concrete platform Dokploy client own resource apply behavior. Smoke verification runs after apply and turns broken protected API auth into a failed deployment.

**Tech Stack:** TypeScript ESM, Zod, Vitest, Hono, Hono JSX, MSW, Dokploy HTTP API, Nginx, pnpm workspaces.

---

## Scope Check

This spec crosses CLI, platform HTTP/core, blueprint composition, deploy-core, deploy-dokploy, and docs. It is still one coherent implementation because each change supports one deploy path: CLI and UI both create a platform deployment record that the same executor applies and verifies. Tasks are ordered so each commit leaves a working, testable surface.

## File Structure

- `apps/cli/src/api/types.ts` - add deployment response, log, verification, and start request schemas.
- `apps/cli/src/api/endpoints.ts` - add deployment start/list/show/log endpoints.
- `apps/cli/src/commands/harness.ts` - allow command-specific success exit codes for `deployment watch`.
- `apps/cli/src/commands/project/deploy.ts` - start deployment command.
- `apps/cli/src/commands/project/deployment-list.ts` - list project deployments.
- `apps/cli/src/commands/project/deployment-show.ts` - show one deployment.
- `apps/cli/src/commands/project/deployment-watch.ts` - poll status and incremental logs.
- `apps/cli/src/bin/cli.ts` - dispatch new commands and make `--version <seq>` usable for `project deploy`.
- `apps/cli/test/unit/commands/project/deployment.test.ts` - CLI command unit tests.
- `apps/cli/test/integration/commands.test.ts` - dispatcher and platform request integration tests.
- `packages/platform/platform-core/src/schemas/deployment.ts` - require `targetSlug`.
- `packages/platform/platform-core/src/use-cases/deployments.ts` - remove default target fallback from deployment start.
- `packages/platform/platform-core/test/unit/schemas/deployment.test.ts` - request schema tests.
- `packages/platform/platform-core/test/unit/use-cases/deployments.test.ts` - explicit target use-case tests.
- `apps/platform-http/src/routes/deployments.ts` - keep JSON deploy starts on the executor callback and retain response shape.
- `apps/platform-http/src/ui/pages/project-version.tsx` - force an explicit target selection in the UI form.
- `apps/platform-http/src/ui/app.tsx` - reject UI deploy form submissions without a target slug before calling the use-case.
- `apps/platform-http/test/e2e/deploy-flow.test.ts` - API path regression for target slug and scheduling.
- `packages/artifacts/blueprint/src/types/result.ts` - append an edge-auth composition error code.
- `packages/artifacts/blueprint/src/validate/composition.ts` - reject mounted auth middleware when the identity module lacks `capabilities.edgeAuth`.
- `packages/artifacts/blueprint/test/unit/validate-composition.test.ts` - composition failure coverage.
- `packages/artifacts/blueprint/test/smoke-notes-demo.test.ts` - notes-demo catalog smoke coverage.
- `apps/platform-http/src/deploy/executor.ts` - structured deployment log evidence and apply failure details.
- `apps/platform-http/test/unit/deploy/executor.test.ts` - executor logging and failure finalization tests.
- `packages/deploy/deploy-dokploy/src/client.ts` - optional task inspection result on the client seam.
- `packages/deploy/deploy-dokploy/src/errors.ts` - add inspect step metadata.
- `packages/deploy/deploy-dokploy/src/apply.ts` - start applications after deploy and inspect application health when supported.
- `packages/deploy/deploy-dokploy/test/unit/apply.test.ts` - lifecycle and task inspection tests.
- `apps/platform-http/src/deploy/dokploy-client-factory.ts` - concrete mount update/delete/filePath behavior and task inspection.
- `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts` - real client request body tests.
- `apps/platform-http/test/fixtures/mock-dokploy.ts` - duplicate mount cleanup and task status simulation support.
- `packages/deploy/deploy-dokploy/src/nginx.ts` - auth_request rendering contract.
- `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts` - byte-level auth rendering expectations.
- `apps/platform-http/src/deploy/smoke-verifier.ts` - health/UI/config/protected API verification.
- `apps/platform-http/test/unit/deploy/smoke-verifier.test.ts` - smoke success/failure matrix.
- `packages/deploy/deploy-dokploy/src/render.ts` - verification hints for config and notes-demo protected API paths.
- `packages/deploy/deploy-dokploy/test/unit/render.test.ts` - verification hint rendering tests.
- `apps/cli/README.md` - document deploy commands.
- `apps/platform-http/README.md` - document explicit target and protected smoke checks.
- `packages/deploy/deploy-dokploy/README.md` - document mount idempotency and task inspection.
- `packages/deploy/deploy-core/README.md` - document canonical module mapping and edge auth requirement.
- `demo/notes-blueprint/README.md` - document expected protected API 401 smoke behavior.
- `AGENTS.md` - update §6.14 to use the CLI deploy command as the canonical workflow.

---

### Task 1: CLI Deployment Commands

**Files:**
- Modify: `apps/cli/src/api/types.ts`
- Modify: `apps/cli/src/api/endpoints.ts`
- Modify: `apps/cli/src/commands/harness.ts`
- Create: `apps/cli/src/commands/project/deploy.ts`
- Create: `apps/cli/src/commands/project/deployment-list.ts`
- Create: `apps/cli/src/commands/project/deployment-show.ts`
- Create: `apps/cli/src/commands/project/deployment-watch.ts`
- Modify: `apps/cli/src/bin/cli.ts`
- Test: `apps/cli/test/unit/commands/project/deployment.test.ts`
- Test: `apps/cli/test/integration/commands.test.ts`

- [ ] **Step 1: Write failing CLI command tests**

Create `apps/cli/test/unit/commands/project/deployment.test.ts` with this content.

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runProjectDeploy } from '../../../../src/commands/project/deploy.js';
import { runProjectDeploymentList } from '../../../../src/commands/project/deployment-list.js';
import { runProjectDeploymentShow } from '../../../../src/commands/project/deployment-show.js';
import { runProjectDeploymentWatch } from '../../../../src/commands/project/deployment-watch.js';

const deployment = {
  id: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  projectVersionId: '44444444-4444-4444-8444-444444444444',
  targetId: '55555555-5555-4555-8555-555555555555',
  status: 'queued',
  configOverrides: {},
  renderedPlanDigest: null,
  applyResult: null,
  verificationReport: null,
  warnings: [],
  errorCode: null,
  errorMessage: null,
  startedByAccountId: '66666666-6666-4666-8666-666666666666',
  queuedAt: '2026-05-02T12:00:00.000Z',
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

describe('project deployment commands', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('starts a deployment with explicit version and target', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deployment }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectDeploy({ version: 4, target: 'dokploy-rnt-364' }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/orgs/acme/projects/notes-demo/deployments');
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      projectVersionSeq: 4,
      targetSlug: 'dokploy-rnt-364',
      configOverrides: {},
    });
  });

  it('lists deployments with a limit query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deployments: [deployment] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectDeploymentList({ limit: 25 }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/v1/orgs/acme/projects/notes-demo/deployments?limit=25');
  });

  it('shows one deployment by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deployment }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectDeploymentShow({ deploymentId: deployment.id }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://platform.example/v1/orgs/acme/projects/notes-demo/deployments/${deployment.id}`);
  });

  it('watches incremental logs and exits 10 for failed terminal deployments', async () => {
    const failed = {
      ...deployment,
      status: 'failed',
      errorCode: 'DEPLOY_EXECUTOR_SMOKE_FAILED',
      errorMessage: 'smoke verification failed',
      finishedAt: '2026-05-02T12:01:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ deployment: failed }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        lines: [
          {
            id: 1,
            deploymentId: deployment.id,
            orgId: deployment.orgId,
            ts: '2026-05-02T12:00:01.000Z',
            level: 'error',
            step: 'verify',
            message: 'protected-api GET /api/notes returned 500',
          },
        ],
        lastLineId: 1,
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectDeploymentWatch(
      { deploymentId: deployment.id, pollIntervalMs: 1 },
      { ...flags, json: false, quiet: true },
    );

    expect(exit).toBe(10);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      `https://platform.example/v1/orgs/acme/projects/notes-demo/deployments/${deployment.id}`,
      `https://platform.example/v1/orgs/acme/projects/notes-demo/deployments/${deployment.id}/logs?sinceLineId=0&limit=200`,
    ]);
  });
});
```

Append these tests to `apps/cli/test/integration/commands.test.ts`.

```ts
describe('project deploy commands', () => {
  it('rejects project deploy without --version', async () => {
    const r = await runCli(['--org', 'acme', '--project', 'notes-demo', 'project', 'deploy', '--target', 'preview']);

    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Usage: rntme project deploy --version <seq> --target <target>');
  });

  it('rejects project deploy without --target', async () => {
    const r = await runCli(['--org', 'acme', '--project', 'notes-demo', 'project', 'deploy', '--version', '4']);

    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Usage: rntme project deploy --version <seq> --target <target>');
  });

  it('dispatches project deploy to the platform deployments endpoint', async () => {
    server.use(
      http.post(`${BASE}/v1/orgs/acme/projects/notes-demo/deployments`, async ({ request }) => {
        expect(await request.json()).toEqual({
          projectVersionSeq: 4,
          targetSlug: 'preview',
          configOverrides: {},
        });
        return HttpResponse.json({
          deployment: {
            id: '11111111-1111-4111-8111-111111111111',
            orgId: '22222222-2222-4222-8222-222222222222',
            projectId: '33333333-3333-4333-8333-333333333333',
            projectVersionId: '44444444-4444-4444-8444-444444444444',
            targetId: '55555555-5555-4555-8555-555555555555',
            status: 'queued',
            configOverrides: {},
            renderedPlanDigest: null,
            applyResult: null,
            verificationReport: null,
            warnings: [],
            errorCode: null,
            errorMessage: null,
            startedByAccountId: '66666666-6666-4666-8666-666666666666',
            queuedAt: '2026-05-02T12:00:00.000Z',
            startedAt: null,
            finishedAt: null,
            lastHeartbeatAt: null,
          },
        }, { status: 202 });
      }),
    );

    const r = await runCli(['--org', 'acme', '--project', 'notes-demo', 'project', 'deploy', '--version', '4', '--target', 'preview']);

    expect(r.code).toBe(0);
    expect(r.stdout).toContain('11111111-1111-4111-8111-111111111111');
  });
});
```

- [ ] **Step 2: Run CLI tests and verify failure**

Run:

```bash
pnpm -F @rntme/cli test -- test/unit/commands/project/deployment.test.ts test/integration/commands.test.ts
```

Expected: FAIL because the deployment command modules and schemas are not present.

- [ ] **Step 3: Add CLI API schemas**

Append these exports to `apps/cli/src/api/types.ts`.

```ts
export const DeploymentStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'succeeded_with_warnings',
  'failed',
  'failed_orphaned',
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

export const DeploymentSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  projectId: z.string(),
  projectVersionId: z.string(),
  targetId: z.string(),
  status: DeploymentStatusSchema,
  configOverrides: z.record(z.string(), z.unknown()),
  renderedPlanDigest: z.string().nullable(),
  applyResult: z.record(z.string(), z.unknown()).nullable(),
  verificationReport: VerificationReportSchema.nullable(),
  warnings: z.array(z.unknown()),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedByAccountId: z.string(),
  queuedAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  lastHeartbeatAt: z.string().nullable(),
});
export type Deployment = z.infer<typeof DeploymentSchema>;

export const DeploymentLogLineSchema = z.object({
  id: z.number().int().nonnegative(),
  deploymentId: z.string(),
  orgId: z.string(),
  ts: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  step: z.string(),
  message: z.string(),
});
export type DeploymentLogLine = z.infer<typeof DeploymentLogLineSchema>;

export const StartDeploymentRequestSchema = z.object({
  projectVersionSeq: z.number().int().positive(),
  targetSlug: z.string().min(1),
  configOverrides: z.record(z.string(), z.unknown()).default({}),
});
export type StartDeploymentRequest = z.infer<typeof StartDeploymentRequestSchema>;

export const DeploymentResponseSchema = z.object({ deployment: DeploymentSchema });
export const DeploymentsListResponseSchema = z.object({ deployments: z.array(DeploymentSchema) });
export const DeploymentLogsResponseSchema = z.object({
  lines: z.array(DeploymentLogLineSchema),
  lastLineId: z.number().int().nonnegative(),
});
```

Update the import block in `apps/cli/src/api/endpoints.ts` to include the new schemas and request type.

```ts
import {
  ProjectResponseSchema,
  ProjectsListResponseSchema,
  ProjectVersionResponseSchema,
  ProjectVersionsListResponseSchema,
  TokenCreatedResponseSchema,
  TokensListResponseSchema,
  AuthMeResponseSchema,
  DeploymentResponseSchema,
  DeploymentsListResponseSchema,
  DeploymentLogsResponseSchema,
} from './types.js';
import type {
  CreateProjectRequest,
  CreateTokenRequest,
  StartDeploymentRequest,
} from './types.js';
```

- [ ] **Step 4: Add CLI deployment endpoints**

Add this sibling object inside the exported `endpoints` object in `apps/cli/src/api/endpoints.ts`, after `projectVersions`.

```ts
  deployments: {
    start: (c: Ctx, org: string, project: string, body: StartDeploymentRequest) =>
      apiCall({
        method: 'POST',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/deployments`,
        body,
        responseSchema: DeploymentResponseSchema,
        ...c,
      }),
    list: (c: Ctx, org: string, project: string, opts?: { limit?: number }) => {
      const qs = new URLSearchParams();
      if (opts?.limit) qs.set('limit', String(opts.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/deployments${suffix}`,
        responseSchema: DeploymentsListResponseSchema,
        ...c,
      });
    },
    show: (c: Ctx, org: string, project: string, deploymentId: string) =>
      apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/deployments/${enc(deploymentId)}`,
        responseSchema: DeploymentResponseSchema,
        ...c,
      }),
    logs: (c: Ctx, org: string, project: string, deploymentId: string, opts: { sinceLineId: number; limit: number }) => {
      const qs = new URLSearchParams();
      qs.set('sinceLineId', String(opts.sinceLineId));
      qs.set('limit', String(opts.limit));
      return apiCall({
        method: 'GET',
        path: `/v1/orgs/${enc(org)}/projects/${enc(project)}/deployments/${enc(deploymentId)}/logs?${qs.toString()}`,
        responseSchema: DeploymentLogsResponseSchema,
        ...c,
      });
    },
  },
```

- [ ] **Step 5: Allow success exit-code overrides in the harness**

In `apps/cli/src/commands/harness.ts`, replace the `opts` parameter type in `runCommand` with this type and update the success branch.

```ts
export async function runCommand<T>(
  flags: CommonFlags,
  opts: {
    requireToken?: boolean | undefined;
    requireTenancy?: boolean | undefined;
    humanRender?: ((d: T) => string) | undefined;
    successExitCode?: ((d: T) => number) | undefined;
  },
  handler: CommandHandler<T>,
): Promise<number> {
```

Replace the success branch with this block.

```ts
  if (isOk(result)) {
    if (!flags.quiet) emit(mode, result.value, null, opts.humanRender);
    return opts.successExitCode?.(result.value) ?? 0;
  }
```

- [ ] **Step 6: Add project deploy command**

Create `apps/cli/src/commands/project/deploy.ts` with this content.

```ts
import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema } from '../../api/types.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;

export type ProjectDeployArgs = {
  readonly version: number;
  readonly target: string;
};

export async function runProjectDeploy(args: ProjectDeployArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => {
        const org = flags.org ?? '';
        const project = flags.project ?? '';
        return [
          'deployment queued',
          `  id:       ${d.deployment.id}`,
          `  status:   ${d.deployment.status}`,
          `  queued:   ${d.deployment.queuedAt}`,
          `  detail:   ${deploymentDetailUrl(flags.baseUrl, org, project, d.deployment.id)}`,
        ].join('\n');
      },
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return endpoints.deployments.start(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        {
          projectVersionSeq: args.version,
          targetSlug: args.target,
          configOverrides: {},
        },
      );
    },
  );
}

function deploymentDetailUrl(baseUrl: string | undefined, org: string, project: string, deploymentId: string): string {
  const root = (baseUrl ?? 'https://platform.rntme.com').replace(/\/+$/, '').replace(/\/v1$/, '');
  return `${root}/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/deployments/${encodeURIComponent(deploymentId)}`;
}
```

- [ ] **Step 7: Add deployment list and show commands**

Create `apps/cli/src/commands/project/deployment-list.ts` with this content.

```ts
import { endpoints } from '../../api/endpoints.js';
import type { DeploymentsListResponseSchema } from '../../api/types.js';
import { renderTable } from '../../output/tables.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type DeploymentsList = z.infer<typeof DeploymentsListResponseSchema>;

export type ProjectDeploymentListArgs = {
  readonly limit?: number | undefined;
};

export async function runProjectDeploymentList(args: ProjectDeploymentListArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentsList>(
    flags,
    {
      requireToken: true,
      humanRender: (d) =>
        renderTable(
          ['ID', 'STATUS', 'VERSION', 'TARGET', 'QUEUED', 'STARTED', 'FINISHED'],
          d.deployments.map((deployment) => [
            deployment.id,
            deployment.status,
            deployment.projectVersionId,
            deployment.targetId,
            deployment.queuedAt,
            deployment.startedAt ?? '',
            deployment.finishedAt ?? '',
          ]),
          { maxWidths: [12, 23, 12, 12, 24, 24, 24] },
        ),
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return endpoints.deployments.list(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        { limit: args.limit },
      );
    },
  );
}
```

Create `apps/cli/src/commands/project/deployment-show.ts` with this content.

```ts
import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema } from '../../api/types.js';
import { err } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;

export type ProjectDeploymentShowArgs = {
  readonly deploymentId: string;
};

export async function runProjectDeploymentShow(args: ProjectDeploymentShowArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => {
        const deployment = d.deployment;
        return [
          `id:       ${deployment.id}`,
          `status:   ${deployment.status}`,
          `version:  ${deployment.projectVersionId}`,
          `target:   ${deployment.targetId}`,
          `digest:   ${deployment.renderedPlanDigest ?? ''}`,
          `error:    ${deployment.errorCode ?? ''}`,
          `message:  ${deployment.errorMessage ?? ''}`,
          `queued:   ${deployment.queuedAt}`,
          `started:  ${deployment.startedAt ?? ''}`,
          `finished: ${deployment.finishedAt ?? ''}`,
          '',
          `warnings: ${JSON.stringify(deployment.warnings)}`,
          `apply:    ${JSON.stringify(deployment.applyResult ?? {})}`,
          `verify:   ${JSON.stringify(deployment.verificationReport ?? {})}`,
        ].join('\n');
      },
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));
      return endpoints.deployments.show(
        { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token },
        org,
        project,
        args.deploymentId,
      );
    },
  );
}
```

- [ ] **Step 8: Add deployment watch command**

Create `apps/cli/src/commands/project/deployment-watch.ts` with this content.

```ts
import { endpoints } from '../../api/endpoints.js';
import type { DeploymentResponseSchema, DeploymentStatus } from '../../api/types.js';
import { err, isOk } from '../../result.js';
import { cliError } from '../../errors/codes.js';
import { runCommand, type CommonFlags } from '../harness.js';
import type { z } from 'zod';

type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;

export type ProjectDeploymentWatchArgs = {
  readonly deploymentId: string;
  readonly pollIntervalMs?: number | undefined;
};

const TERMINAL = new Set<DeploymentStatus>([
  'succeeded',
  'succeeded_with_warnings',
  'failed',
  'failed_orphaned',
]);

export async function runProjectDeploymentWatch(args: ProjectDeploymentWatchArgs, flags: CommonFlags): Promise<number> {
  return runCommand<DeploymentResponse>(
    flags,
    {
      requireToken: true,
      humanRender: (d) => `deployment ${d.deployment.id} ended with ${d.deployment.status}`,
      successExitCode: (d) => {
        if (d.deployment.status === 'succeeded') return 0;
        if (d.deployment.status === 'succeeded_with_warnings') return 1;
        return 10;
      },
    },
    async (ctx) => {
      const org = flags.org ?? ctx.resolved.org;
      const project = flags.project ?? ctx.resolved.project;
      if (!org) return err(cliError('CLI_CONFIG_MISSING', 'no org; use --org'));
      if (!project) return err(cliError('CLI_CONFIG_MISSING', 'no project; use --project'));

      const apiCtx = { baseUrl: ctx.resolved.baseUrl, token: ctx.resolved.token };
      let sinceLineId = 0;
      const pollIntervalMs = args.pollIntervalMs ?? 2_000;

      while (true) {
        const status = await endpoints.deployments.show(apiCtx, org, project, args.deploymentId);
        if (!isOk(status)) return status;

        const logs = await endpoints.deployments.logs(apiCtx, org, project, args.deploymentId, {
          sinceLineId,
          limit: 200,
        });
        if (!isOk(logs)) return logs;

        for (const line of logs.value.lines) {
          process.stdout.write(`[${line.level}] ${line.step}: ${line.message}\n`);
        }
        sinceLineId = logs.value.lastLineId;

        if (TERMINAL.has(status.value.deployment.status)) return status;
        await sleep(pollIntervalMs);
      }
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 9: Wire the CLI dispatcher**

In `apps/cli/src/bin/cli.ts`, add imports for the new command handlers.

```ts
import { runProjectDeploy } from '../commands/project/deploy.js';
import { runProjectDeploymentList } from '../commands/project/deployment-list.js';
import { runProjectDeploymentShow } from '../commands/project/deployment-show.js';
import { runProjectDeploymentWatch } from '../commands/project/deployment-watch.js';
```

At the top of `main`, before `parseArgs`, add this fast path so top-level `rntme --version` keeps working after `--version <seq>` becomes a command flag.

```ts
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v')) {
    process.stdout.write(readVersion() + '\n');
    return 0;
  }
```

Change the `version` option in the `parseArgs` options object from a boolean to a string.

```ts
        version: { type: 'string', short: 'v' },
```

Remove the old post-parse boolean version block.

```ts
  if (asBool(values['version']) === true) {
    process.stdout.write(readVersion() + '\n');
    return 0;
  }
```

Add these cases to the inner `case 'project'` switch, beside `publish` and `version`.

```ts
        case 'deploy': {
          const versionRaw = asString(values['version']);
          const target = asString(values['target']);
          if (!versionRaw || !target) {
            process.stderr.write('Usage: rntme project deploy --version <seq> --target <target>\n');
            return 1;
          }
          const version = Number.parseInt(versionRaw, 10);
          if (Number.isNaN(version) || version <= 0) {
            process.stderr.write(`Invalid version seq: ${versionRaw}\n`);
            return 1;
          }
          return runProjectDeploy({ version, target }, commonFlags);
        }
        case 'deployment': {
          const deploymentSub = positionals[2];
          if (!deploymentSub) {
            process.stderr.write('Usage: rntme project deployment <list|show|watch> ...\n');
            return 1;
          }
          switch (deploymentSub) {
            case 'list': {
              const limitRaw = asString(values['limit']);
              const deploymentListArgs: Parameters<typeof runProjectDeploymentList>[0] = {};
              if (limitRaw !== undefined) {
                const n = Number.parseInt(limitRaw, 10);
                if (!Number.isNaN(n)) deploymentListArgs.limit = n;
              }
              return runProjectDeploymentList(deploymentListArgs, commonFlags);
            }
            case 'show': {
              const deploymentId = positionals[3];
              if (!deploymentId) {
                process.stderr.write('Usage: rntme project deployment show <deployment-id>\n');
                return 1;
              }
              return runProjectDeploymentShow({ deploymentId }, commonFlags);
            }
            case 'watch': {
              const deploymentId = positionals[3];
              if (!deploymentId) {
                process.stderr.write('Usage: rntme project deployment watch <deployment-id>\n');
                return 1;
              }
              return runProjectDeploymentWatch({ deploymentId }, commonFlags);
            }
            default: {
              process.stderr.write(`Unknown project deployment subcommand: ${deploymentSub}\n`);
              process.stderr.write('Usage: rntme project deployment <list|show|watch> ...\n');
              return 2;
            }
          }
        }
```

Update the `USAGE` command list to include:

```text
  project deploy          Start a platform deployment
  project deployment list List deployments
  project deployment show Show a deployment
  project deployment watch Watch deployment logs until terminal status
```

- [ ] **Step 10: Run CLI tests and commit**

Run:

```bash
pnpm -F @rntme/cli test -- test/unit/commands/project/deployment.test.ts test/integration/commands.test.ts
pnpm -F @rntme/cli typecheck
```

Expected: both commands PASS.

Commit:

```bash
git add apps/cli/src apps/cli/test
git commit -m "feat(cli): add remote project deployment commands"
```

---

### Task 2: Explicit Deployment Target Contract

**Files:**
- Modify: `packages/platform/platform-core/src/schemas/deployment.ts`
- Modify: `packages/platform/platform-core/src/use-cases/deployments.ts`
- Modify: `packages/platform/platform-core/test/unit/schemas/deployment.test.ts`
- Modify: `packages/platform/platform-core/test/unit/use-cases/deployments.test.ts`
- Modify: `apps/platform-http/src/ui/pages/project-version.tsx`
- Modify: `apps/platform-http/src/ui/app.tsx`
- Test: `apps/platform-http/test/e2e/deploy-flow.test.ts`

- [ ] **Step 1: Write failing platform-core target tests**

In `packages/platform/platform-core/test/unit/schemas/deployment.test.ts`, replace the `accepts minimal body with projectVersionSeq` test with this test.

```ts
  it('rejects a deployment start body without targetSlug', () => {
    const parsed = StartDeploymentRequestSchema.safeParse({ projectVersionSeq: 1 });

    expect(parsed.success).toBe(false);
  });
```

In `packages/platform/platform-core/test/unit/use-cases/deployments.test.ts`, replace the `returns target-not-specified when no targetSlug and no default target exists` test with this test.

```ts
  it('does not query the default target because targetSlug is required by the API schema', async () => {
    const { deps } = setup({ defaultTarget: null });

    const result = await startDeployment(deps, input({ targetSlug: 'staging' }));

    expect(result.ok).toBe(true);
    expect(deps.repos.deployTargets.getDefault).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run platform-core tests and verify failure**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/schemas/deployment.test.ts test/unit/use-cases/deployments.test.ts
```

Expected: FAIL because `targetSlug` is optional and `startDeployment` still has default-target fallback logic.

- [ ] **Step 3: Require `targetSlug` in the shared schema**

In `packages/platform/platform-core/src/schemas/deployment.ts`, replace the `targetSlug` line in `StartDeploymentRequestSchema` with this line.

```ts
  targetSlug: z.string().trim().min(1),
```

- [ ] **Step 4: Remove default-target fallback from the deployment use-case**

In `packages/platform/platform-core/src/use-cases/deployments.ts`, replace the target lookup block with this code.

```ts
  const target = await deps.repos.deployTargets.getBySlug(input.orgId, input.req.targetSlug);
  if (!isOk(target)) return target;
  if (!target.value) {
    return err([
      {
        code: 'DEPLOY_REQUEST_TARGET_NOT_FOUND',
        message: input.req.targetSlug,
      },
    ]);
  }
```

- [ ] **Step 5: Make the UI submit an explicit target**

In `apps/platform-http/src/ui/pages/project-version.tsx`, replace the deploy form target select with this block.

```tsx
            <select name="targetSlug" required class="rounded border border-gray-300 px-2 py-1">
              {(props.deployTargets ?? []).map((target) => (
                <option value={target.slug}>{target.displayName}</option>
              ))}
            </select>
```

In `apps/platform-http/src/ui/app.tsx`, replace the `targetSlug` parsing line in the deploy form route with this block.

```ts
    const targetSlug = typeof form.targetSlug === 'string' && form.targetSlug.trim().length > 0 ? form.targetSlug.trim() : null;
    if (targetSlug === null) {
      return renderHtml(
        c,
        <ErrorPage
          status={400}
          title="Cannot start deployment"
          detail="Choose a deploy target."
          backHref={`/${s.org.slug}/projects/${projSlug}/versions/${projectVersionSeq}`}
        />,
        400,
      );
    }
```

Keep the `startDeployment` request as:

```ts
      req: { projectVersionSeq, targetSlug, configOverrides: {} },
```

- [ ] **Step 6: Lock the JSON route scheduling path**

Append this assertion after the existing queued deployment assertions in `apps/platform-http/test/e2e/deploy-flow.test.ts`.

```ts
    expect(scheduled).toContainEqual({ deploymentId: queuedJson.deployment.id, orgId: auth.orgId });
```

Add this new API failure assertion in the same e2e test before the successful deploy POST.

```ts
    const missingTarget = await env.app.request(`/v1/orgs/${orgSlug}/projects/${projectSlug}/deployments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.plain}`,
      },
      body: JSON.stringify({
        projectVersionSeq: 1,
        configOverrides: {},
      }),
    });
    expect(missingTarget.status).toBe(400);
```

- [ ] **Step 7: Run platform tests and commit**

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/schemas/deployment.test.ts test/unit/use-cases/deployments.test.ts
pnpm -F @rntme/platform-http test -- test/e2e/deploy-flow.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: targeted tests PASS.

Commit:

```bash
git add packages/platform/platform-core apps/platform-http/src/ui apps/platform-http/test/e2e/deploy-flow.test.ts
git commit -m "fix(platform): require explicit deploy targets"
```

---

### Task 3: Blueprint Edge Auth Capability Validation

**Files:**
- Modify: `packages/artifacts/blueprint/src/types/result.ts`
- Modify: `packages/artifacts/blueprint/src/validate/composition.ts`
- Modify: `packages/artifacts/blueprint/test/unit/validate-composition.test.ts`
- Modify: `packages/artifacts/blueprint/test/smoke-notes-demo.test.ts`

- [ ] **Step 1: Write failing blueprint validation tests**

Append this test inside `describe('validateBlueprintComposition', () => {` in `packages/artifacts/blueprint/test/unit/validate-composition.test.ts`.

```ts
  it('rejects mounted auth middleware when the identity module lacks edgeAuth', () => {
    const input = {
      project: {
        name: 'notes-demo',
        services: ['app', 'identity-auth0'],
        routes: { http: { '/api': 'app' } },
        middleware: {
          auth: {
            kind: 'auth',
            provider: 'auth0',
            audience: 'https://notes-demo.rntme.com/api',
            moduleSlug: 'identity-auth0',
          },
        },
        mounts: [{ target: 'http:/api', use: ['auth'] }],
      },
      services: {
        app: svc('app', 'domain', { hasBindings: true }),
        'identity-auth0': svc('identity-auth0', 'integration-module'),
      },
      catalogManifest: {
        components: [],
        operations: [],
        modulesWithBoot: ['@rntme/identity-auth0'],
        categoryToModule: { identity: '@rntme/identity-auth0' },
        publicConfig: {},
        moduleEdgeAuth: { '@rntme/identity-auth0': null },
      },
      discoveredModules: {
        '@rntme/identity-auth0': {
          manifest: moduleManifest('@rntme/identity-auth0', 'auth0'),
          packageDir: '/tmp/identity-auth0',
          projectKey: 'identity',
          publicConfig: {},
        },
      },
    };

    const r = validateBlueprintComposition(input);

    expectErrorCodes(r, ['BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING']);
    if (!r.ok) {
      expect(r.errors[0]).toMatchObject({
        path: 'project.middleware.auth -> @rntme/identity-auth0/module.json#capabilities.edgeAuth',
      });
    }
  });
```

In `packages/artifacts/blueprint/test/smoke-notes-demo.test.ts`, add this assertion after the existing `moduleEdgeAuth` assertion.

```ts
    expect(r.value.catalogManifest?.categoryToModule.identity).toBe('@rntme/identity-auth0');
```

- [ ] **Step 2: Run blueprint tests and verify failure**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/validate-composition.test.ts test/smoke-notes-demo.test.ts
```

Expected: FAIL because the new `BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING` code and validation do not exist.

- [ ] **Step 3: Append the blueprint error code**

In `packages/artifacts/blueprint/src/types/result.ts`, append this entry at the end of `ERROR_CODES`.

```ts
  BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING: 'BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING',
```

- [ ] **Step 4: Validate edgeAuth for mounted auth middleware**

In `packages/artifacts/blueprint/src/validate/composition.ts`, add this call immediately after `checkAuthModuleVendors(...)`.

```ts
  errors.push(...checkAuthModuleEdgeAuth(
    input.project,
    input.catalogManifest,
  ));
```

Add this function below `checkAuthModuleVendors`.

```ts
function checkAuthModuleEdgeAuth(
  project: ProjectBlueprint,
  catalogManifest?: CatalogManifest | null,
): BlueprintError[] {
  if (catalogManifest == null) return [];

  const errors: BlueprintError[] = [];
  for (const [middlewareName, declaration] of Object.entries(project.middleware ?? {})) {
    if (declaration.kind !== 'auth') continue;
    if (declaration.moduleSlug === undefined) continue;
    if (!authMiddlewareIsMounted(project, middlewareName)) continue;

    const canonicalModule = catalogManifest.categoryToModule.identity;
    if (canonicalModule === undefined) continue;

    const edgeAuth = catalogManifest.moduleEdgeAuth[canonicalModule];
    if (edgeAuth !== null && edgeAuth !== undefined) continue;

    errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING,
      message: `auth middleware "${middlewareName}" requires identity module "${canonicalModule}" to declare capabilities.edgeAuth`,
      path: `project.middleware.${middlewareName} -> ${canonicalModule}/module.json#capabilities.edgeAuth`,
    });
  }
  return errors;
}

function authMiddlewareIsMounted(project: ProjectBlueprint, middlewareName: string): boolean {
  return (project.mounts ?? []).some((mount) => mount.use.includes(middlewareName));
}
```

- [ ] **Step 5: Run blueprint tests and commit**

Run:

```bash
pnpm -F @rntme/blueprint test -- test/unit/validate-composition.test.ts test/smoke-notes-demo.test.ts
pnpm -F @rntme/blueprint typecheck
```

Expected: targeted tests PASS.

Commit:

```bash
git add packages/artifacts/blueprint
git commit -m "fix(blueprint): require edge auth for mounted auth middleware"
```

---

### Task 4: Executor Logging and Failure Evidence

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [ ] **Step 1: Write failing executor log tests**

Append this test inside `describe('runDeployment', () => {` in `apps/platform-http/test/unit/deploy/executor.test.ts`.

```ts
  it('logs selected version, selected target, rendered digest, and applied resources', async () => {
    const { deps, deployments } = setup();

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'init',
        message: expect.stringContaining('projectVersionId=version-1 targetId=target-1'),
      }),
    );
    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'render',
        message: 'Rendered Dokploy plan digest sha256:rendered',
      }),
    );
    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'apply',
        message: expect.stringContaining('application catalog created'),
      }),
    );
  });
```

Append this test in the same `describe`.

```ts
  it('logs partial apply failure diagnostics before finalizing failed', async () => {
    const { deps, deployments } = setup({
      applyPlan: vi.fn(async () => ({
        ok: false,
        errors: [
          {
            code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
            message: 'failed while applying resource "rntme-acme-shop-edge"',
            resource: 'rntme-acme-shop-edge',
            partialFailure: {
              createdResources: [],
              updatedResources: [],
              failedStep: {
                action: 'inspect',
                resourceName: 'rntme-acme-shop-edge',
                resourceKind: 'application',
                workloadSlug: 'edge',
              },
              retrySafe: true,
            },
          },
        ],
      })),
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        step: 'apply',
        message: expect.stringContaining('inspect application edge'),
      }),
    );
    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'failed',
      errorCode: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
      errorMessage: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE: failed while applying resource "rntme-acme-shop-edge"',
    });
  });
```

Update the `setup` helper type in the same test file to accept `applyPlan`.

```ts
    applyPlan?: ExecutorDeps['applyPlan'];
```

In the `deps` object in `setup`, replace the current `applyPlan` line with:

```ts
    applyPlan: overrides.applyPlan ?? vi.fn(async () => ok({ target: { kind: 'dokploy' as const, environmentId: 'env_default' }, deployment: { orgSlug: 'acme', projectSlug: 'shop', environment: 'default' as const, mode: 'preview' as const }, resources: [{ logicalId: 'catalog', resourceKind: 'application' as const, workloadSlug: 'catalog', kind: 'domain-service' as const, targetResourceId: 'app_1', targetResourceName: 'catalog', action: 'created' as const }], urls: { projectUrl: 'https://app.example.test', publicRoutes: [] }, renderedPlanDigest: 'sha256:rendered', warnings: [], verificationHints: { healthUrl: 'https://app.example.test/health', publicRouteUrls: [] } })) as never,
```

- [ ] **Step 2: Run executor tests and verify failure**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
```

Expected: FAIL because the executor does not log the required metadata or partial failure details.

- [ ] **Step 3: Log selected deployment context**

In `apps/platform-http/src/deploy/executor.ts`, add `projectVersionSeq` and `targetSlug` to `DeploymentContext`.

```ts
type DeploymentContext = {
  readonly projectVersionId: string;
  readonly targetId: string;
  readonly configOverrides: Record<string, unknown>;
  readonly bundleBlobKey: string;
  readonly projectVersionSeq: number;
  readonly targetSlug: string;
};
```

In `startAndResolveContext`, after fetching the version, fetch the target and return the new fields.

```ts
    const target = await repos.deployTargets.getWithSecretById(deployment.value.targetId);
    if (!isOk(target) || !target.value) throw new Error('DEPLOY_TARGET_NOT_FOUND');
    return {
      projectVersionId: deployment.value.projectVersionId,
      targetId: deployment.value.targetId,
      configOverrides: deployment.value.configOverrides,
      bundleBlobKey: version.value.bundleBlobKey,
      projectVersionSeq: version.value.seq,
      targetSlug: target.value.slug,
    };
```

Replace the initial init log in `runDeployment` with this log message after `ctx` is available.

```ts
    await appendLog(
      deps,
      deploymentId,
      orgId,
      'info',
      'init',
      `Starting deployment projectVersionSeq=${ctx.projectVersionSeq} projectVersionId=${ctx.projectVersionId} targetSlug=${ctx.targetSlug} targetId=${ctx.targetId}`,
    );
```

- [ ] **Step 4: Log render digest and apply resource actions**

After `setRenderedDigest`, add this log.

```ts
    await appendLog(deps, deploymentId, orgId, 'info', 'render', `Rendered Dokploy plan digest ${rendered.value.digest}`);
```

After `setApplyResult`, add this loop.

```ts
    for (const resource of applied.value.resources) {
      await appendLog(
        deps,
        deploymentId,
        orgId,
        'info',
        'apply',
        `${resource.resourceKind} ${resource.workloadSlug ?? resource.infrastructureKind ?? resource.logicalId} ${resource.action} target=${resource.targetResourceName}`,
      );
    }
```

- [ ] **Step 5: Log partial apply failure diagnostics**

Add this helper above `finalizeFromVerification`.

```ts
async function logApplyFailure(
  deps: ExecutorDeps,
  deploymentId: string,
  orgId: string,
  errors: readonly { readonly code?: string; readonly message?: string; readonly partialFailure?: unknown }[],
): Promise<void> {
  const first = errors[0];
  const partial = first?.partialFailure as
    | {
        readonly failedStep?: {
          readonly action?: string;
          readonly resourceKind?: string;
          readonly workloadSlug?: string;
          readonly infrastructureKind?: string;
          readonly resourceName?: string;
        };
      }
    | undefined;
  const failed = partial?.failedStep;
  const detail =
    failed === undefined
      ? errorSummary(errors)
      : `${failed.action ?? 'apply'} ${failed.resourceKind ?? 'resource'} ${failed.workloadSlug ?? failed.infrastructureKind ?? failed.resourceName ?? ''}: ${first?.message ?? ''}`;
  await appendLog(deps, deploymentId, orgId, 'error', 'apply', detail);
}
```

In the `if (!applied.ok)` branch, add the helper call before `finalize`.

```ts
      await logApplyFailure(deps, deploymentId, orgId, applied.errors);
```

- [ ] **Step 6: Run executor tests and commit**

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: targeted tests PASS.

Commit:

```bash
git add apps/platform-http/src/deploy/executor.ts apps/platform-http/test/unit/deploy/executor.test.ts
git commit -m "fix(platform): log deploy executor evidence"
```

---

### Task 5: Dokploy Apply, Mounts, and Task Health

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/client.ts`
- Modify: `packages/deploy/deploy-dokploy/src/errors.ts`
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`
- Modify: `apps/platform-http/src/deploy/dokploy-client-factory.ts`
- Modify: `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`
- Modify: `apps/platform-http/test/fixtures/mock-dokploy.ts`

- [ ] **Step 1: Write failing deploy-dokploy apply tests**

In `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`, append this test inside `describe('applyDokployPlan', () => {`.

```ts
  it('starts and inspects applications after deploy before returning success', async () => {
    const client = new FakeDokployClient();

    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(true);
    expect(client.lifecycleCalls).toEqual([
      'create:rntme-acme-commerce-catalog',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
      'start:app_1',
      'inspect:app_1',
    ]);
  });
```

Append this test in the same describe block.

```ts
  it('returns a partial failure when application task inspection reports rejected', async () => {
    const client = new FakeDokployClient([], [], { inspectStatus: 'rejected' });

    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
          partialFailure: expect.objectContaining({
            failedStep: {
              action: 'inspect',
              resourceName: 'rntme-acme-commerce-catalog',
              resourceKind: 'application',
              workloadSlug: 'catalog',
            },
          }),
        }),
      );
    }
  });
```

Extend `FakeDokployClient` in the same file with an `inspectStatus` failure option.

```ts
      readonly inspectStatus?: 'running' | 'done' | 'failed' | 'rejected' | 'unknown';
```

Add this method to the fake class.

```ts
  async inspectApplication(id: string): Promise<{ status: 'running' | 'done' | 'failed' | 'rejected' | 'unknown'; message?: string }> {
    this.lifecycleCalls.push(`inspect:${id}`);
    return {
      status: this.failures.inspectStatus ?? 'running',
      message: this.failures.inspectStatus === undefined ? undefined : `task ${this.failures.inspectStatus}`,
    };
  }
```

Update the existing lifecycle expectation in `configures and deploys created applications before returning success` to include the new start and inspect steps.

```ts
    expect(client.lifecycleCalls).toEqual([
      'create:rntme-acme-commerce-catalog',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
      'start:app_1',
      'inspect:app_1',
    ]);
```

Update the existing lifecycle expectation in `applies compose resources before application resources` so the application phase ends with start and inspect.

```ts
    expect(client.lifecycleCalls).toEqual([
      'create-compose:rntme-acme-commerce-event-bus',
      'configure-compose:compose_1:rntme-acme-commerce-event-bus',
      'deploy-compose:compose_1',
      'create:rntme-acme-commerce-catalog',
      'configure:app_1:rntme-acme-commerce-catalog',
      'deploy:app_1',
      'start:app_1',
      'inspect:app_1',
    ]);
```

- [ ] **Step 2: Write failing concrete Dokploy client mount tests**

In `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`, append this test inside `describe('createDokployClientFactory', () => {`.

```ts
  it('updates the first matching file mount and deletes duplicate mounts for the same mountPath', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: FetchInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).includes('/api/mounts.listByServiceId')) {
        return jsonResponse([
          { mountId: 'mount-1', mountPath: '/etc/nginx/nginx.conf', filePath: '/old/nginx.conf' },
          { mountId: 'mount-2', mountPath: '/etc/nginx/nginx.conf', filePath: '/stale/nginx.conf' },
        ]);
      }
      if (String(url).includes('/api/domain.byApplicationId')) return jsonResponse([]);
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await client.configureApplication('app-1', renderedEdgeResource());

    const paths = calls.map((call) => new URL(call.url).pathname);
    expect(paths).toContain('/api/mounts.update');
    expect(paths).toContain('/api/mounts.delete');
    const updateCall = calls.find((call) => new URL(call.url).pathname === '/api/mounts.update');
    expect(updateCall?.body).toMatchObject({
      mountId: 'mount-1',
      mountPath: '/etc/nginx/nginx.conf',
      filePath: '/etc/dokploy/rntme/app-1/1652e2a03ff06855-etc_nginx_nginx.conf',
      content: 'events {}',
    });
    const deleteCall = calls.find((call) => new URL(call.url).pathname === '/api/mounts.delete');
    expect(deleteCall?.body).toEqual({ mountId: 'mount-2' });
  });
```

Append this task inspection test in the same file.

```ts
  it('inspects application status after deploy/start', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/api/application.one')) {
        return jsonResponse({
          applicationId: 'app-1',
          name: 'rntme-acme-notes-edge',
          applicationStatus: 'rejected',
          lastDeploymentStatus: 'error',
          statusMessage: 'invalid mount config for type "bind": bind source path does not exist',
        });
      }
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await expect(client.inspectApplication?.('app-1')).resolves.toEqual({
      status: 'rejected',
      message: 'invalid mount config for type "bind": bind source path does not exist',
    });
  });
```

- [ ] **Step 3: Run deploy-dokploy and platform-http client tests and verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/dokploy-client-factory.test.ts
```

Expected: FAIL because start/inspect and duplicate mount cleanup are not implemented.

- [ ] **Step 4: Extend the Dokploy client seam**

In `packages/deploy/deploy-dokploy/src/client.ts`, add this type after `DokployCompose`.

```ts
export type DokployApplicationInspection = {
  readonly status: 'running' | 'done' | 'failed' | 'rejected' | 'unknown';
  readonly message?: string;
};
```

Add this optional method to `DokployClient`.

```ts
  inspectApplication?(applicationId: string): Promise<DokployApplicationInspection>;
```

In `packages/deploy/deploy-dokploy/src/errors.ts`, add `'inspect'` to `DokployPartialFailureStep['action']`.

```ts
  readonly action: 'find' | 'create' | 'update' | 'configure' | 'deploy' | 'start' | 'inspect';
```

- [ ] **Step 5: Start and inspect applications in apply**

In `packages/deploy/deploy-dokploy/src/apply.ts`, add this block after the `deployApplication` call in `runApplicationLifecycle`.

```ts
  try {
    await client.startApplication(target.targetResourceId);
  } catch (cause) {
    return partialFailure(cause, resource, applied, 'start');
  }

  if (client.inspectApplication !== undefined) {
    try {
      const inspected = await client.inspectApplication(target.targetResourceId);
      if (inspected.status === 'failed' || inspected.status === 'rejected') {
        return partialFailure(new Error(inspected.message ?? `Dokploy application status ${inspected.status}`), resource, applied, 'inspect');
      }
    } catch (cause) {
      return partialFailure(cause, resource, applied, 'inspect');
    }
  }
```

- [ ] **Step 6: Implement concrete mount cleanup and filePath convention**

In `apps/platform-http/src/deploy/dokploy-client-factory.ts`, add this import.

```ts
import { createHash } from 'node:crypto';
```

Add `statusMessage` fields to `DokployApiApplication`.

```ts
  applicationStatus?: string;
  lastDeploymentStatus?: string;
  statusMessage?: string;
```

Replace `configureFileMounts` with this implementation.

```ts
async function configureFileMounts(
  request: <T>(method: 'GET' | 'POST', path: string, body?: unknown) => Promise<T>,
  applicationId: string,
  files: Readonly<Record<string, string>> | undefined,
): Promise<void> {
  if (files === undefined) return;

  const mountsResponse = await request<unknown>('GET', '/api/mounts.listByServiceId', {
    serviceType: 'application',
    serviceId: applicationId,
  });
  const mounts = Array.isArray(mountsResponse) ? (mountsResponse as DokployApiMount[]) : [];

  for (const [path, content] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const matches = mounts.filter((mount) => mount.mountPath === path);
    const existing = matches[0];
    const body = {
      type: 'file',
      serviceType: 'application',
      serviceId: applicationId,
      mountPath: path,
      filePath: dokployFilePath(applicationId, path),
      content,
    };
    if (existing === undefined) {
      await request('POST', '/api/mounts.create', body);
    } else {
      await request('POST', '/api/mounts.update', {
        ...body,
        mountId: existing.mountId,
        applicationId,
      });
      for (const duplicate of matches.slice(1)) {
        await request('POST', '/api/mounts.delete', { mountId: duplicate.mountId });
      }
    }
  }
}

function dokployFilePath(applicationId: string, mountPath: string): string {
  const digest = createHash('sha256').update(`${applicationId}:${mountPath}`).digest('hex').slice(0, 16);
  const safeName = mountPath
    .split('/')
    .filter(Boolean)
    .join('_')
    .replace(/[^A-Za-z0-9._-]/g, '_');
  return `/etc/dokploy/rntme/${applicationId}/${digest}-${safeName || 'file'}`;
}
```

- [ ] **Step 7: Implement concrete task inspection**

In the object returned by `createDokployClientFactory`, add this method after `startApplication`.

```ts
      inspectApplication: async (applicationId: string) => {
        const app = await request<DokployApiApplication>('GET', '/api/application.one', { applicationId });
        const status = normalizeApplicationStatus(app.applicationStatus ?? app.lastDeploymentStatus);
        return {
          status,
          ...(app.statusMessage === undefined ? {} : { message: app.statusMessage }),
        };
      },
```

Add this helper near `normalizeDokployBaseUrl`.

```ts
function normalizeApplicationStatus(status: string | undefined): 'running' | 'done' | 'failed' | 'rejected' | 'unknown' {
  if (status === 'running' || status === 'done' || status === 'failed' || status === 'rejected') return status;
  if (status === 'error') return 'failed';
  return 'unknown';
}
```

- [ ] **Step 8: Update the mock Dokploy fixture**

In `apps/platform-http/test/fixtures/mock-dokploy.ts`, add this route after `mounts.update`.

```ts
  app.post('/api/mounts.delete', async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    mounts.delete(String(body.mountId ?? ''));
    return c.json({});
  });
```

In the `/api/application.deploy` route, keep the current status write and add:

```ts
    app.applicationStatus = 'running';
```

In the `/api/application.start` route, keep the current status write and ensure the route returns the app body.

```ts
    return c.json(app);
```

- [ ] **Step 9: Run apply/client tests and commit**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/dokploy-client-factory.test.ts
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/platform-http typecheck
```

Expected: targeted tests PASS.

Commit:

```bash
git add packages/deploy/deploy-dokploy apps/platform-http/src/deploy/dokploy-client-factory.ts apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts apps/platform-http/test/fixtures/mock-dokploy.ts
git commit -m "fix(deploy): harden Dokploy apply health and mounts"
```

---

### Task 6: Nginx Auth Rendering Contract

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/nginx.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts`

- [ ] **Step 1: Write the auth rendering lock test**

Append this test inside `describe('auth middleware rendering', () => {` in `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts`.

```ts
  it('renders the complete protected API auth contract in one config', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });

    expect(rendered).toContain('location = /config.json');
    expect(rendered).toContain('proxy_pass_request_body off;');
    expect(rendered).toContain('proxy_set_header   Authorization      $http_authorization;');
    expect(rendered).toContain('proxy_set_header   X-Rntme-Audience   "https://notes-demo.rntme.com/api";');
    expect(rendered).toContain('auth_request_set      $rntme_user_sub      $upstream_http_x_rntme_user_sub;');
    expect(rendered).toContain('auth_request_set      $rntme_user_audience $upstream_http_x_rntme_user_audience;');
    expect(rendered).toContain('proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;');
    expect(rendered).toContain('proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;');
    expect(rendered).toContain('default_type application/json;');
    expect(rendered).toContain(`return 401 '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}';`);
  });
```

- [ ] **Step 2: Run Nginx tests and verify failure or pass**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/nginx.test.ts
```

Expected: PASS if the current renderer already satisfies the contract, otherwise FAIL on the missing directive.

- [ ] **Step 3: Replace auth internal location rendering if the test fails**

If Step 2 fails on the internal auth location, replace `renderAuthInternalLocation` in `packages/deploy/deploy-dokploy/src/nginx.ts` with this function.

```ts
function renderAuthInternalLocation(b: AuthBlock): string {
  return [
    `    location = /_rntme_auth_${b.key} {`,
    '      internal;',
    `      proxy_pass         http://rntme_auth_${b.key}/introspect;`,
    '      proxy_pass_request_body off;',
    '      proxy_set_header   content-length     "";',
    '      proxy_set_header   Authorization      $http_authorization;',
    `      proxy_set_header   X-Rntme-Audience   "${b.audience}";`,
    '      proxy_intercept_errors on;',
    '    }',
  ].join('\n');
}
```

- [ ] **Step 4: Replace auth route rendering if the test fails**

If Step 2 fails on the protected route directives, replace the `if (m.kind === 'auth')` block in `renderLocation` with this block.

```ts
    if (m.kind === 'auth') {
      const audHash = sha256Hex8(m.audience);
      const key = `${m.moduleSlug}__${audHash}`;
      lines.push(`      # auth middleware: provider=${commentValue(m.provider)}, audience=${commentValue(m.audience)}`);
      lines.push(`      auth_request          /_rntme_auth_${key};`);
      lines.push(`      auth_request_set      $rntme_user_sub      $upstream_http_x_rntme_user_sub;`);
      lines.push(`      auth_request_set      $rntme_user_audience $upstream_http_x_rntme_user_audience;`);
      lines.push(`      error_page 401        = @rntme_auth_401_${key};`);
      lines.push(`      proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;`);
      lines.push(`      proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;`);
      lines.push(`      proxy_set_header      Authorization         $http_authorization;`);
    }
```

- [ ] **Step 5: Replace JSON 401 rendering if the test fails**

If Step 2 fails on the 401 JSON response, replace `renderAuthNamed401Location` with this function.

```ts
function renderAuthNamed401Location(b: AuthBlock): string {
  return [
    `    location @rntme_auth_401_${b.key} {`,
    '      default_type application/json;',
    `      return 401 '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}';`,
    '    }',
  ].join('\n');
}
```

- [ ] **Step 6: Run Nginx tests and commit**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/nginx.test.ts
pnpm -F @rntme/deploy-dokploy typecheck
```

Expected: targeted tests PASS.

Commit:

```bash
git add packages/deploy/deploy-dokploy/src/nginx.ts packages/deploy/deploy-dokploy/test/unit/nginx.test.ts
git commit -m "test(deploy): lock edge auth nginx rendering"
```

---

### Task 7: Smoke Verification for Protected API Routes

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/render.test.ts`
- Modify: `apps/platform-http/src/deploy/smoke-verifier.ts`
- Modify: `apps/platform-http/test/unit/deploy/smoke-verifier.test.ts`
- Modify: `apps/platform-http/test/unit/deploy/executor.test.ts`

- [ ] **Step 1: Write failing render hint test**

Append this test inside `packages/deploy/deploy-dokploy/test/unit/render.test.ts`.

```ts
  it('emits protected notes API smoke hints when an auth-protected /api route exists', () => {
    const r = renderDokployPlan(authProtectedPlan(), targetConfig());

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.urls.protectedRouteChecks).toEqual([
      { name: 'protected-api-get-notes', method: 'GET', url: 'https://commerce.example.com/api/notes' },
      { name: 'protected-api-post-notes', method: 'POST', url: 'https://commerce.example.com/api/notes' },
    ]);
  });
```

If `render.test.ts` does not already have `authProtectedPlan()` and `targetConfig()` helpers, add these complete helpers at the bottom of the file.

```ts
function targetConfig() {
  return {
    endpoint: 'https://dokploy.example.com',
    projectId: 'project_123',
    allowCreateProject: false,
    publicBaseUrl: 'https://commerce.example.com',
  };
}

function authProtectedPlan() {
  return {
    project: { orgSlug: 'acme', projectSlug: 'commerce', environment: 'default' as const, mode: 'preview' as const },
    infrastructure: { eventBus: { kind: 'kafka' as const, mode: 'external' as const, brokers: ['redpanda:9092'] } },
    workloads: [
      {
        kind: 'domain-service' as const,
        slug: 'app',
        serviceSlug: 'app',
        resourceName: 'rntme-acme-commerce-app',
        runtime: { image: 'rntme-runtime' },
        artifact: { source: 'composed-project' as const, serviceSlug: 'app' },
        runtimeFiles: { 'manifest.json': '{}' },
        publicConfigJson: '{}',
        persistence: { mode: 'ephemeral' as const },
      },
      {
        kind: 'integration-module' as const,
        slug: 'identity-auth0',
        serviceSlug: 'identity-auth0',
        resourceName: 'rntme-acme-commerce-identity-auth0',
        image: 'identity-auth0:test',
        expose: false,
        env: { AUTH0_DOMAIN: 'tenant.us.auth0.com' },
        secretRefs: {},
      },
      {
        kind: 'edge-gateway' as const,
        slug: 'edge' as const,
        resourceName: 'rntme-acme-commerce-edge',
        image: 'nginx:1.27-alpine' as const,
      },
    ],
    edge: {
      routes: [
        { id: 'http:/api', kind: 'http' as const, path: '/api', targetService: 'app', targetWorkload: 'app' },
      ],
      middleware: [
        {
          mountTarget: 'http:/api',
          name: 'auth',
          kind: 'auth' as const,
          provider: 'auth0',
          audience: 'https://commerce.example.com/api',
          moduleSlug: 'identity-auth0',
          moduleIntrospectPort: 50052,
        },
      ],
    },
    diagnostics: { warnings: [] },
  };
}
```

- [ ] **Step 2: Write failing smoke verifier tests**

Replace `apps/platform-http/test/unit/deploy/smoke-verifier.test.ts` with this content.

```ts
import { describe, expect, it } from 'vitest';
import { SmokeVerifier, type SmokeFetcher } from '../../../src/deploy/smoke-verifier.js';

const stubFetcher = (
  responses: Record<
    string,
    { status: number; body?: string; contentType?: string; latencyMs?: number; throws?: 'timeout' | 'error' }
  >,
): SmokeFetcher => {
  return async (url) => {
    const response = responses[url];
    if (!response) throw new Error(`no stub for ${url}`);
    if (response.throws === 'timeout') return { status: 'timeout', latencyMs: response.latencyMs ?? 5_000 };
    if (response.throws === 'error') return { status: 'error', latencyMs: response.latencyMs ?? 0 };
    return {
      status: response.status,
      latencyMs: response.latencyMs ?? 1,
      body: response.body ?? '',
      contentType: response.contentType ?? 'text/plain',
    };
  };
};

describe('SmokeVerifier', () => {
  it('returns ok when health, UI, config, and protected API checks pass', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/': { status: 200, body: '<html>', contentType: 'text/html' },
        'https://edge.example/config.json': { status: 200, body: '{"ok":true}', contentType: 'application/json' },
        'https://edge.example/api/notes': { status: 401, body: '{"code":"RUNTIME_AUTH_TOKEN_INVALID"}', contentType: 'application/json' },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        uiUrl: 'https://edge.example/',
        configUrl: 'https://edge.example/config.json',
        publicRouteUrls: [],
        protectedRouteChecks: [
          { name: 'protected-api-get-notes', method: 'GET', url: 'https://edge.example/api/notes' },
          { name: 'protected-api-post-notes', method: 'POST', url: 'https://edge.example/api/notes' },
        ],
      },
    });

    expect(report.ok).toBe(true);
    expect(report.partialOk).toBe(false);
    expect(report.checks.map((check) => check.name)).toEqual([
      'edge-health',
      'ui',
      'config-json',
      'protected-api-get-notes',
      'protected-api-post-notes',
    ]);
  });

  it('fails deployment when a protected API route returns runtime 500 instead of 401 JSON', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/api/notes': {
          status: 500,
          body: '{"code":"BINDINGS_RUNTIME_EXPRESSION_ERROR"}',
          contentType: 'application/json',
        },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        publicRouteUrls: [],
        protectedRouteChecks: [
          { name: 'protected-api-get-notes', method: 'GET', url: 'https://edge.example/api/notes' },
        ],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.partialOk).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        name: 'protected-api-get-notes',
        status: 500,
        ok: false,
      }),
    );
  });

  it('fails deployment when config.json is not valid JSON', async () => {
    const verifier = new SmokeVerifier(
      stubFetcher({
        'https://edge.example/health': { status: 200 },
        'https://edge.example/config.json': { status: 200, body: 'not-json', contentType: 'application/json' },
      }),
    );

    const report = await verifier.verify({
      verificationHints: {
        healthUrl: 'https://edge.example/health',
        configUrl: 'https://edge.example/config.json',
        publicRouteUrls: [],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.partialOk).toBe(false);
  });
});
```

- [ ] **Step 3: Run render and smoke tests and verify failure**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/render.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/smoke-verifier.test.ts
```

Expected: FAIL because verification hints and smoke checks do not include config/protected API checks.

- [ ] **Step 4: Add protected route URLs to rendered plan URLs**

In `packages/deploy/deploy-dokploy/src/render.ts`, add `protectedRouteChecks` to `RenderedDokployPlan['urls']`.

```ts
    readonly protectedRouteChecks: readonly { readonly name: string; readonly method: 'GET' | 'POST'; readonly url: string }[];
```

Before constructing `urls` in `renderDokployPlan`, add:

```ts
  const protectedRouteChecks = protectedSmokeChecks(plan, config.publicBaseUrl);
```

Add `protectedRouteChecks` to both `urls` object branches.

```ts
      ? { projectUrl: config.publicBaseUrl, publicRoutes: publicRoutes.map(stripRoutePath), protectedRouteChecks }
      : {
          projectUrl: config.publicBaseUrl,
          uiUrl: joinPublicUrl(config.publicBaseUrl, uiRoute.path),
          publicRoutes: publicRoutes.map(stripRoutePath),
          protectedRouteChecks,
        };
```

Update existing `RenderedDokployPlan` fixtures in `packages/deploy/deploy-dokploy/test/unit/apply.test.ts` so each `urls` object includes an empty protected check list.

```ts
  urls: {
    projectUrl: 'https://commerce.example.com',
    publicRoutes: [{ routeId: 'http:/api/catalog', url: 'https://commerce.example.com/api/catalog' }],
    protectedRouteChecks: [],
  },
```

Add this helper near `stripRoutePath`.

```ts
function protectedSmokeChecks(
  plan: ProjectDeploymentPlan,
  publicBaseUrl: string,
): readonly { readonly name: string; readonly method: 'GET' | 'POST'; readonly url: string }[] {
  const protectedApiRoute = plan.edge.routes.find((route) => {
    if (route.kind !== 'http') return false;
    if (route.path !== '/api') return false;
    return plan.edge.middleware.some((middleware) => middleware.kind === 'auth' && middleware.mountTarget === route.id);
  });
  if (protectedApiRoute === undefined) return [];
  const notesUrl = joinPublicUrl(publicBaseUrl, '/api/notes');
  return [
    { name: 'protected-api-get-notes', method: 'GET', url: notesUrl },
    { name: 'protected-api-post-notes', method: 'POST', url: notesUrl },
  ];
}
```

- [ ] **Step 5: Pass config/protected hints through apply**

In `packages/deploy/deploy-dokploy/src/apply.ts`, replace `verificationHints` with this implementation.

```ts
function verificationHints(rendered: RenderedDokployPlan): DeploymentApplyResult['verificationHints'] {
  const base = {
    healthUrl: joinUrl(rendered.urls.projectUrl, '/health'),
    configUrl: joinUrl(rendered.urls.projectUrl, '/config.json'),
    publicRouteUrls: rendered.urls.publicRoutes.map((route) => route.url),
    protectedRouteChecks: rendered.urls.protectedRouteChecks,
  };

  if (rendered.urls.uiUrl === undefined) return base;

  return {
    ...base,
    uiUrl: rendered.urls.uiUrl,
  };
}
```

Update `DeploymentApplyResult['verificationHints']` to include:

```ts
    readonly configUrl?: string;
    readonly protectedRouteChecks?: readonly { readonly name: string; readonly method: 'GET' | 'POST'; readonly url: string }[];
```

- [ ] **Step 6: Implement smoke verifier checks**

In `apps/platform-http/src/deploy/smoke-verifier.ts`, replace `SmokeFetcher`, `VerificationHints`, and `verify` with this implementation.

```ts
export type SmokeFetcher = (
  url: string,
  opts: { method: 'HEAD' | 'GET' | 'POST'; timeoutMs: number },
) => Promise<{ status: number | 'timeout' | 'error'; latencyMs: number; body?: string; contentType?: string }>;

export type VerificationHints = {
  readonly healthUrl: string;
  readonly uiUrl?: string;
  readonly configUrl?: string;
  readonly publicRouteUrls: readonly string[];
  readonly protectedRouteChecks?: readonly { readonly name: string; readonly method: 'GET' | 'POST'; readonly url: string }[];
};

export class SmokeVerifier {
  constructor(private readonly fetcher: SmokeFetcher = defaultSmokeFetcher) {}

  async verify(applyResult: { verificationHints: VerificationHints }): Promise<VerificationReport> {
    const checks: VerificationReport['checks'] = [];
    const { verificationHints } = applyResult;

    const edge = await this.fetcher(verificationHints.healthUrl, {
      method: 'HEAD',
      timeoutMs: 5_000,
    });
    checks.push({
      name: 'edge-health',
      url: verificationHints.healthUrl,
      status: edge.status,
      latencyMs: edge.latencyMs,
      ok: is2xx(edge.status),
    });

    if (verificationHints.uiUrl) {
      const ui = await this.fetcher(verificationHints.uiUrl, {
        method: 'GET',
        timeoutMs: 10_000,
      });
      checks.push({
        name: 'ui',
        url: verificationHints.uiUrl,
        status: ui.status,
        latencyMs: ui.latencyMs,
        ok: is2xx(ui.status) && isHtml(ui.contentType) && (ui.body ?? '').length > 0,
      });
    }

    if (verificationHints.configUrl) {
      const config = await this.fetcher(verificationHints.configUrl, {
        method: 'GET',
        timeoutMs: 5_000,
      });
      checks.push({
        name: 'config-json',
        url: verificationHints.configUrl,
        status: config.status,
        latencyMs: config.latencyMs,
        ok: is2xx(config.status) && isJson(config.contentType) && parsesJson(config.body ?? ''),
      });
    }

    for (const check of verificationHints.protectedRouteChecks ?? []) {
      const response = await this.fetcher(check.url, {
        method: check.method,
        timeoutMs: 5_000,
      });
      checks.push({
        name: check.name,
        url: check.url,
        status: response.status,
        latencyMs: response.latencyMs,
        ok: response.status === 401 && isJson(response.contentType),
      });
    }

    for (const url of verificationHints.publicRouteUrls) {
      checks.push({
        name: 'public-route',
        url,
        status: 0,
        latencyMs: 0,
        ok: true,
        note: 'not auto-checked in MVP',
      });
    }

    const critical = checks.filter((check) => check.note !== 'not auto-checked in MVP');
    const criticalOk = critical.length > 0 && critical.every((check) => check.ok);
    const optionalFailed = checks.some((check) => !check.ok && check.note === 'not auto-checked in MVP');
    return {
      checks,
      ok: criticalOk && !optionalFailed,
      partialOk: criticalOk && optionalFailed,
    };
  }
}
```

Replace `defaultSmokeFetcher` with this version.

```ts
export const defaultSmokeFetcher: SmokeFetcher = async (url, opts) => {
  const start = Date.now();
  const ctrl = new globalThis.AbortController();
  const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const response = await globalThis.fetch(url, { method: opts.method, signal: ctrl.signal });
    const body = opts.method === 'GET' || opts.method === 'POST' ? await response.text() : undefined;
    return {
      status: response.status,
      latencyMs: Date.now() - start,
      contentType: response.headers.get('content-type') ?? undefined,
      ...(body === undefined ? {} : { body }),
    };
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : '';
    return {
      status: name === 'AbortError' ? 'timeout' : 'error',
      latencyMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
};
```

Add these helpers after `is2xx`.

```ts
function isHtml(contentType: string | undefined): boolean {
  return contentType?.toLowerCase().includes('text/html') === true;
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.toLowerCase().includes('application/json') === true;
}

function parsesJson(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 7: Update executor tests for critical UI semantics**

In `apps/platform-http/test/unit/deploy/executor.test.ts`, replace the test named `maps smoke UI-only failures to succeeded_with_warnings` with this test.

```ts
  it('finalizes failed when a critical smoke check fails', async () => {
    const { deps, deployments } = setup({
      verificationReport: { checks: [{ name: 'ui', url: 'https://ui', status: 500, latencyMs: 1, ok: false }], ok: false, partialOk: false },
    });

    await runDeployment('deployment-1', 'org-1', deps);

    expect(deployments.finalize).toHaveBeenCalledWith('deployment-1', {
      status: 'failed',
      errorCode: 'DEPLOY_EXECUTOR_SMOKE_FAILED',
      errorMessage: 'smoke verification failed',
      verificationReport: {
        checks: [{ name: 'ui', url: 'https://ui', status: 500, latencyMs: 1, ok: false }],
        ok: false,
        partialOk: false,
      },
    });
  });
```

- [ ] **Step 8: Run smoke/render/executor tests and commit**

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/render.test.ts test/unit/apply.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/smoke-verifier.test.ts test/unit/deploy/executor.test.ts
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/platform-http typecheck
```

Expected: targeted tests PASS.

Commit:

```bash
git add packages/deploy/deploy-dokploy apps/platform-http/src/deploy/smoke-verifier.ts apps/platform-http/test/unit/deploy/smoke-verifier.test.ts apps/platform-http/test/unit/deploy/executor.test.ts
git commit -m "fix(platform): smoke test protected API auth"
```

---

### Task 8: Documentation Touch

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `apps/platform-http/README.md`
- Modify: `packages/deploy/deploy-dokploy/README.md`
- Modify: `packages/deploy/deploy-core/README.md`
- Modify: `demo/notes-blueprint/README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update CLI README commands**

In `apps/cli/README.md`, add these command rows under project commands.

```text
  project deploy          Start a remote platform deployment
  project deployment list List project deployments
  project deployment show Show deployment details
  project deployment watch Watch deployment logs until terminal status
```

Replace the deploy operations paragraph with this text.

````md
Deploy operations are server-side on the platform control plane. Start them with:

```bash
rntme project deploy --org my-org --project my-project --version 4 --target dokploy-preview
rntme project deployment watch --org my-org --project my-project <deployment-id>
```

The CLI never calls Dokploy directly and never reads deploy target secrets.
````

- [ ] **Step 2: Update platform HTTP README**

In `apps/platform-http/README.md`, add this paragraph to the Deploy runtime section.

```md
Deployment starts require an explicit `targetSlug` from both JSON API callers and the UI form. The platform records the deployment, schedules the same `runDeployment` executor used by UI-triggered deploys, and logs the selected project version, selected target, render digest, apply actions, and smoke results.
```

Add this paragraph after the smoke/evidence sentence in the same section.

```md
Smoke verification is critical for public ingress. The executor checks `/health`, the UI route when present, `/config.json` when public config is rendered, and notes-demo protected API regressions: unauthenticated `GET /api/notes` and `POST /api/notes` must return `401 application/json`.
```

- [ ] **Step 3: Update deploy-dokploy README**

In `packages/deploy/deploy-dokploy/README.md`, add this section after "Public API".

```md
## Apply hardening

Application file mounts are idempotent by `mountPath`: apply lists existing mounts, updates the first matching mount, creates missing mounts, and removes duplicate stale mounts for the same target path. Generated `filePath` values use the platform convention `/etc/dokploy/rntme/<applicationId>/<digest>-<safe-name>` so Dokploy materializes real source files for Swarm bind mounts.

Application lifecycle is `configure -> deploy -> start -> inspect` when the injected client supports inspection. A rejected or failed application task is returned as `DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE`, which causes the platform deployment to finalize as failed.
```

- [ ] **Step 4: Update deploy-core README**

In `packages/deploy/deploy-core/README.md`, add this paragraph to the Edge auth section.

```md
On the platform executor path, composed project module aliases are mapped through the catalog's canonical module manifest name before planning. For example, a project package alias `rntme_identity_auth0` with catalog category `identity -> @rntme/identity-auth0` still provides `modules["identity-auth0"].edgeAuth` to the planner. Blueprint composition rejects mounted auth middleware before deploy if the canonical module manifest lacks `capabilities.edgeAuth`.
```

- [ ] **Step 5: Update notes demo README**

In `demo/notes-blueprint/README.md`, add this bullet to the "User test after deploy" list.

```md
6. Without an `Authorization` header, `GET /api/notes` and `POST /api/notes` return `401 application/json` with `RUNTIME_AUTH_TOKEN_INVALID`; `500 BINDINGS_RUNTIME_EXPRESSION_ERROR` is a failed deployment smoke check.
```

- [ ] **Step 6: Update AGENTS deploy how-to**

In `AGENTS.md` §6.14, replace steps 2-4 with these steps.

```md
2. Publish the blueprint version with the CLI: `rntme project publish --org <org> --project <project> <folder>`.
3. Start deployment through the platform control plane: `rntme project deploy --org <org> --project <project> --version <seq> --target <target-slug>`.
4. Observe it with `rntme project deployment watch --org <org> --project <project> <deployment-id>` or inspect history with `project deployment list/show`.
5. The platform executor, not the CLI, decrypts target credentials and calls `planDeployment(...)`, `renderDokployPlan(...)`, and `applyDokployPlan(...)`.
```

- [ ] **Step 7: Run docs grep and package checks**

Run:

```bash
rg -n "CLI does not bundle deploy commands|Default target|targetSlug.*optional" apps/cli/README.md apps/platform-http/README.md packages/deploy/deploy-core/README.md packages/deploy/deploy-dokploy/README.md demo/notes-blueprint/README.md AGENTS.md
pnpm -F @rntme/cli test
pnpm -F @rntme/platform-core test
pnpm -F @rntme/platform-http test -- test/unit/deploy/smoke-verifier.test.ts test/unit/deploy/executor.test.ts test/unit/deploy/dokploy-client-factory.test.ts
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/blueprint test -- test/unit/validate-composition.test.ts test/smoke-notes-demo.test.ts
```

Expected: `rg` prints no matches; all targeted tests PASS.

Commit:

```bash
git add apps/cli/README.md apps/platform-http/README.md packages/deploy/deploy-dokploy/README.md packages/deploy/deploy-core/README.md demo/notes-blueprint/README.md AGENTS.md
git commit -m "docs: document remote deploy hardening"
```

---

### Task 9: Final Verification

**Files:**
- No source files changed in this task.

- [ ] **Step 1: Run full required checks**

Run:

```bash
pnpm -F @rntme/cli test
pnpm -F @rntme/cli typecheck
pnpm -F @rntme/platform-core test
pnpm -F @rntme/platform-core typecheck
pnpm -F @rntme/platform-http test
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/deploy-core test
pnpm -F @rntme/deploy-core typecheck
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/blueprint test
pnpm -F @rntme/blueprint typecheck
```

Expected: all commands PASS.

- [ ] **Step 2: Run red-flag scan on this implementation**

Run:

```bash
bad='TO''DO|TB''D|fill in det''ails|add app''ropriate|implement lat''er|Default target|CLI does not bundle deploy commands'
rg -n "$bad" apps/cli apps/platform-http packages/platform packages/deploy packages/artifacts/blueprint demo/notes-blueprint AGENTS.md
```

Expected: no matches from changed files.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: no unstaged implementation changes remain. Only intentional untracked scratch files are acceptable, and this plan does not create any.

---

## Self-Review

**Spec coverage:** CLI contract §5 is covered by Task 1. Platform API §6 is covered by Task 2. Executor hardening §7 is covered by Tasks 3 and 4. Dokploy apply §8 is covered by Task 5. Nginx auth §9 is covered by Task 6. Smoke verification §10 is covered by Task 7. Test plan §11 maps across Tasks 1-7 and final verification. Rollout §12 is reflected by task order. Documentation touch §13 is Task 8. Drift/reconcile §14 is intentionally outside this implementation and remains a separate spec.

**Placeholder scan:** This plan avoids blank implementation slots and gives exact file paths, commands, tests, and code blocks for changed functions or new files.

**Type consistency:** `DeploymentStatus`, `DeploymentResponseSchema`, `DeploymentLogsResponseSchema`, `protectedRouteChecks`, `configUrl`, and `inspectApplication` are named consistently across CLI, deploy-dokploy, and platform smoke verification tasks.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-cli-remote-deploy-hardening.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
