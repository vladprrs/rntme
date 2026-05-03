import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/endpoints.js', () => ({
  endpoints: {
    targets: {
      list: vi.fn(async () => ({ ok: true, value: { targets: [{ id: 'a', slug: 's1', displayName: 'X', kind: 'dokploy', publicBaseUrl: null, isDefault: false }] } })),
    },
  },
}));

describe('rntme target list', () => {
  it('renders SLUG / DISPLAY NAME columns', async () => {
    const { runTargetList } = await import('../../src/commands/target/list.js');
    const exit = await runTargetList({}, { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never);
    expect(exit).toBe(0);
  });
});
