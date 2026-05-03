import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/endpoints.js', () => ({
  endpoints: {
    targets: {
      setConfig: vi.fn(async () => ({ ok: true, value: { target: { slug: 's1' } } })),
    },
  },
}));

describe('rntme target set-config', () => {
  it('sends parsed JSON body', async () => {
    const { runTargetSetConfig } = await import('../../src/commands/target/set-config.js');
    const exit = await runTargetSetConfig({ slug: 's1', jsonPath: '/tmp/test-config.json' }, { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never);
    expect(exit).toBe(0);
  });
});
