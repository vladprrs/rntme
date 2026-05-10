import { describe, expect, it } from 'bun:test';
import { createFakeDeployAdapter } from '../../src/deploy-adapter/fake.js';

describe('internal deploy adapter seam', () => {
  it('returns sanitized execution evidence without secret values', async () => {
    const adapter = createFakeDeployAdapter({
      result: {
        status: 'succeeded',
        targetProvider: 'dokploy',
        renderedDigest: 'sha256:test',
        logs: [{ level: 'info', stage: 'apply', message: 'applied successfully' }],
        evidence: { health: 'passed' },
      },
    });

    const result = await adapter.run({
      deploymentId: 'dep_1',
      organizationId: 'org_1',
      projectVersionId: 'ver_1',
      targetId: 'target_1',
      bundleObjectKey: 'bundles/ver_1.json',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value)).not.toContain('secret');
    if (result.value.status !== 'succeeded') return;
    expect(result.value.renderedDigest).toBe('sha256:test');
  });
});
