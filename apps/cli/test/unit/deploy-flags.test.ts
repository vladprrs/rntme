import { describe, expect, it, vi } from 'vitest';
import { runProjectDeploy } from '../../src/commands/project/deploy.js';

vi.mock('../../src/api/endpoints.js', () => ({
  endpoints: {
    deployments: {
      start: vi.fn(async () => ({ ok: true, value: { deployment: { id: '11111111-1111-4111-8111-111111111111', status: 'queued', queuedAt: '2026-05-02T00:00:00Z' } } })),
      show: vi.fn(async () => ({ ok: true, value: { deployment: { id: '11111111-1111-4111-8111-111111111111', status: 'failed', errorCode: 'DEPLOY_PLAN_TARGET_VAR_MISSING', errorMessage: 'missing', queuedAt: '2026-05-02T00:00:00Z' } } })),
      logs: vi.fn(async () => ({ ok: true, value: { lines: [], lastLineId: 0 } })),
    },
  },
}));

describe('project deploy flags', () => {
  it('sends runtime-image as configOverrides.runtimeImage', async () => {
    const exit = await runProjectDeploy(
      { version: 4, target: 't', runtimeImage: 'ghcr.io/x:tag' },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );
    expect(exit).toBe(0);
    const start = (await import('../../src/api/endpoints.js')).endpoints.deployments.start as unknown as { mock: { calls: unknown[][] } };
    const body = start.mock.calls.at(-1)?.[3] as { configOverrides: Record<string, unknown> };
    expect(body.configOverrides.runtimeImage).toBe('ghcr.io/x:tag');
  });

  it('with --wait, exits 10 when terminal status is failed', async () => {
    const exit = await runProjectDeploy(
      { version: 4, target: 't', wait: true, timeoutSec: 1 },
      { org: 'o', project: 'p', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa', quiet: true } as never,
    );
    expect(exit).toBe(10);
  });
});
