import { describe, expect, it, mock } from 'bun:test';
import { restoreGlobals, stubGlobal } from '../../helpers/globals.js';

describe('rntme token create', () => {
  it('omits expiresAt when unset and expands deploy preset scopes', async () => {
    const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return Response.json({
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
      });
    });
    stubGlobal('fetch', fetchMock);
    const { runTokenCreate } = await import('../../../src/commands/token/create.js');
    const exit = await runTokenCreate(
      { name: 'deploy-bot', scopes: [], preset: 'deploy' },
      { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never,
    );

    expect(exit).toBe(0);
    const body = JSON.parse(String(requests[0]?.init?.body));
    expect(body).toEqual({ name: 'deploy-bot', scopes: ['project:read', 'version:publish', 'deploy:execute'] });
    restoreGlobals();
  });
});
