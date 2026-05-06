import { describe, expect, it, vi } from 'vitest';

const createMock = vi.fn(async () => ({
  ok: true,
  value: {
    token: {
      id: 'tok_1',
      orgId: 'org_1',
      accountId: 'acct_1',
      name: 'deploy-bot',
      prefix: 'rntme_pat_abc',
      scopes: ['project:read', 'version:publish', 'deploy:execute'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: '2026-05-06T00:00:00.000Z',
    },
    plaintext: 'rntme_pat_secret',
  },
}));

vi.mock('../../../src/api/endpoints.js', () => ({
  endpoints: {
    tokens: {
      create: createMock,
    },
  },
}));

describe('rntme token create', () => {
  it('omits expiresAt when unset and expands deploy preset scopes', async () => {
    const { runTokenCreate } = await import('../../../src/commands/token/create.js');
    const exit = await runTokenCreate(
      { name: 'deploy-bot', scopes: [], preset: 'deploy' },
      { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );

    expect(exit).toBe(0);
    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      'o',
      {
        name: 'deploy-bot',
        scopes: ['project:read', 'version:publish', 'deploy:execute'],
      },
    );
  });
});
