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
  projectVersionSeq: '4',
  targetId: '55555555-5555-4555-8555-555555555555',
  targetSlug: 'dokploy-demos',
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
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://platform.example/api/deployments');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('/v1/');
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      organizationId: 'acme',
      projectId: 'notes-demo',
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
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://platform.example/api/deployments?organizationId=acme&projectId=notes-demo&limit=25',
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('/v1/');
  });

  it('shows one deployment by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deployment }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const exit = await runProjectDeploymentShow({ deploymentId: deployment.id }, flags);

    expect(exit).toBe(0);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://platform.example/api/deployments/${deployment.id}`);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('/v1/');
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
      `https://platform.example/api/deployments/${deployment.id}`,
      `https://platform.example/api/deployments/${deployment.id}/logs?sinceLineId=0&limit=200`,
    ]);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('/v1/');
    }
  });

  it('does not stream plain-text log lines when --json is set', async () => {
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
        lines: [{
          id: 1,
          deploymentId: deployment.id,
          orgId: deployment.orgId,
          ts: '2026-05-02T12:00:01.000Z',
          level: 'error',
          step: 'verify',
          message: 'protected-api GET /api/notes returned 500',
        }],
        lastLineId: 1,
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const exit = await runProjectDeploymentWatch(
      { deploymentId: deployment.id, pollIntervalMs: 1 },
      { ...flags, json: true },
    );

    expect(exit).toBe(10);
    const writes = writeSpy.mock.calls.map((call) => String(call[0]));
    expect(writes.some((line) => line.includes('protected-api GET /api/notes'))).toBe(false);
  });
});
