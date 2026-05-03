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
