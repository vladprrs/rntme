import { describe, expect, it } from 'bun:test';
import { provision } from '../../../src/stages/provision.js';
import type { ComposedProjectInput } from '@rntme/deploy-core';

describe('stages.provision', () => {
  it('returns empty result when blueprint has no provisioner-bearing modules', async () => {
    const composed = { name: 'demo', services: [], modules: {}, varsManifest: {} } as unknown as ComposedProjectInput;
    const out = await provision({
      ctx: {
        orgSlug: 'org',
        target: { kind: 'dokploy', slug: 'preview', config: {}, modules: [], storage: [], workflows: undefined, auth: {} } as never,
        resolvedTargetSecrets: { apiToken: '', extras: {} },
        configOverrides: {},
      },
      composed,
      bundleDir: '/tmp/empty',
      priorProvisionOutputs: {},
    });

    expect(out.provisioned.size).toBe(0);
    expect(out.publicByModule).toEqual({});
    expect(out.secretByModule).toEqual({});
  });
});
