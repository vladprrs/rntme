import { describe, expect, it, mock } from 'bun:test';
import { buildPlainTokenDokployClient } from '../../../src/deploy-engine/dokploy-client.js';

describe('buildPlainTokenDokployClient', () => {
  it('issues GET requests with the x-api-key header set to the plaintext token', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const fetchMock = mock(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers) });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const client = buildPlainTokenDokployClient('plaintext-tok', 'https://dokploy.example.com', fetchMock as never);
    await client.ensureEnvironment({ mode: 'use-existing', projectId: 'p1' } as never, 'production').catch(() => undefined);
    expect(calls[0]?.headers.get('x-api-key')).toBe('plaintext-tok');
    expect(calls[0]?.url).toContain('/api/project.all');
  });
});
