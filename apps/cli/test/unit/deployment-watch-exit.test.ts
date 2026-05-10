import { describe, expect, it, mock } from 'bun:test';
import { runProjectDeploymentWatch } from '../../src/commands/project/deployment-watch.js';
import { restoreGlobals, stubGlobal } from '../helpers/globals.js';

function stubDeployment(status: string, extra: Record<string, unknown> = {}) {
  stubGlobal('fetch', mock(async (input: RequestInfo | URL) => {
    if (String(input).includes('/logs')) return Response.json({ lines: [], lastLineId: 0 });
    return Response.json({
      deployment: {
        id: '11111111-1111-4111-8111-111111111111',
        orgId: '22222222-2222-4222-8222-222222222222',
        projectId: '33333333-3333-4333-8333-333333333333',
        projectVersionId: '44444444-4444-4444-8444-444444444444',
        projectVersionSeq: 4,
        targetId: '55555555-5555-4555-8555-555555555555',
        targetSlug: 'dokploy-demos',
        status,
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
        ...extra,
      },
    });
  }));
}

describe('deployment watch summary + exit codes', () => {
  it('prints errorCode and exits 10 on failed', async () => {
    stubDeployment('failed', {
      errorCode: 'DEPLOY_PLAN_TARGET_VAR_MISSING',
      errorMessage: 'var missing',
    });

    const exit = await runProjectDeploymentWatch(
      { deploymentId: '11111111-1111-4111-8111-111111111111' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(10);
    restoreGlobals();
  });

  it('exits 0 on succeeded', async () => {
    stubDeployment('succeeded');

    const exit = await runProjectDeploymentWatch(
      { deploymentId: '11111111-1111-4111-8111-111111111111' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(0);
    restoreGlobals();
  });

  it('exits 1 on succeeded_with_warnings', async () => {
    stubDeployment('succeeded_with_warnings');

    const exit = await runProjectDeploymentWatch(
      { deploymentId: '11111111-1111-4111-8111-111111111111' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(1);
    restoreGlobals();
  });
});
