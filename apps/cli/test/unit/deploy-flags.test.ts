import { describe, expect, it, mock } from 'bun:test';
import { runProjectDeploy } from '../../src/commands/project/deploy.js';
import { restoreGlobals, stubGlobal } from '../helpers/globals.js';

const deployment = {
  id: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  projectVersionId: '44444444-4444-4444-8444-444444444444',
  projectVersionSeq: 4,
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
  queuedAt: '2026-05-02T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  lastHeartbeatAt: null,
};

describe('project deploy flags', () => {
  it('sends runtime-image as configOverrides.runtimeImage', async () => {
    const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return Response.json({ deployment });
    });
    stubGlobal('fetch', fetchMock);
    const exit = await runProjectDeploy(
      { version: 4, target: 't', runtimeImage: 'ghcr.io/x:tag' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(0);
    const body = JSON.parse(String(requests.at(-1)?.init?.body)) as { configOverrides: Record<string, unknown> };
    expect(body.configOverrides.runtimeImage).toBe('ghcr.io/x:tag');
    restoreGlobals();
  });

  it('with --wait, exits 10 when terminal status is failed', async () => {
    stubGlobal('fetch', mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/logs')) return Response.json({ lines: [], lastLineId: 0 });
      if (url.includes('/api/deployments/')) {
        return Response.json({ deployment: { ...deployment, status: 'failed', errorCode: 'DEPLOY_PLAN_TARGET_VAR_MISSING', errorMessage: 'missing' } });
      }
      return Response.json({ deployment });
    }));
    const exit = await runProjectDeploy(
      { version: 4, target: 't', wait: true, timeoutSec: 1 },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa', quiet: true } as never,
    );
    expect(exit).toBe(10);
    restoreGlobals();
  });
});
