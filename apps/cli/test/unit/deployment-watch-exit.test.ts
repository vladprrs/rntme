import { describe, expect, it, vi } from 'vitest';
import { runProjectDeploymentWatch } from '../../src/commands/project/deployment-watch.js';

const mockShow = vi.fn();
const mockLogs = vi.fn();

vi.mock('../../src/api/endpoints.js', () => ({
  endpoints: {
    deployments: {
      show: (...args: unknown[]) => mockShow(...args),
      logs: (...args: unknown[]) => mockLogs(...args),
    },
  },
}));

describe('deployment watch summary + exit codes', () => {
  it('prints errorCode and exits 10 on failed', async () => {
    mockShow.mockResolvedValue({
      ok: true,
      value: {
        deployment: {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'failed',
          errorCode: 'DEPLOY_PLAN_TARGET_VAR_MISSING',
          errorMessage: 'var missing',
          queuedAt: '2026-05-02T00:00:00Z',
        },
      },
    });
    mockLogs.mockResolvedValue({ ok: true, value: { lines: [], lastLineId: 0 } });

    const exit = await runProjectDeploymentWatch(
      { deploymentId: '11111111-1111-4111-8111-111111111111' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(10);
  });

  it('exits 0 on succeeded', async () => {
    mockShow.mockResolvedValue({
      ok: true,
      value: {
        deployment: {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'succeeded',
          queuedAt: '2026-05-02T00:00:00Z',
        },
      },
    });
    mockLogs.mockResolvedValue({ ok: true, value: { lines: [], lastLineId: 0 } });

    const exit = await runProjectDeploymentWatch(
      { deploymentId: '11111111-1111-4111-8111-111111111111' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(0);
  });

  it('exits 1 on succeeded_with_warnings', async () => {
    mockShow.mockResolvedValue({
      ok: true,
      value: {
        deployment: {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'succeeded_with_warnings',
          queuedAt: '2026-05-02T00:00:00Z',
        },
      },
    });
    mockLogs.mockResolvedValue({ ok: true, value: { lines: [], lastLineId: 0 } });

    const exit = await runProjectDeploymentWatch(
      { deploymentId: '11111111-1111-4111-8111-111111111111' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(1);
  });
});
