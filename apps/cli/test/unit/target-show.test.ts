import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/endpoints.js', () => ({
  endpoints: {
    targets: {
      show: vi.fn(async () => ({ ok: true, value: { target: { id: 'a', slug: 's1', displayName: 'X', kind: 'dokploy', publicBaseUrl: null, isDefault: false, auth: {}, modules: {}, eventBus: {} } } })),
    },
  },
}));

describe('rntme target show', () => {
  it('renders target fields', async () => {
    const { runTargetShow } = await import('../../src/commands/target/show.js');
    const exit = await runTargetShow({ slug: 's1' }, { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never);
    expect(exit).toBe(0);
  });
});
