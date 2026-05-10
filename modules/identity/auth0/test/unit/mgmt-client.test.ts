import { describe, expect, it, mock } from 'bun:test';
import { createMgmtClient } from '../../src/mgmt-client.js';

describe('Auth0 mgmt-client', () => {
  it('fetches an access token before the first call', async () => {
    const fetcher = mock(async (url: string) => {
      if (url.endsWith('/oauth/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    });
    const c = createMgmtClient({ tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b', fetch: fetcher as unknown as typeof globalThis.fetch });
    await c.findClientByName('foo');
    expect(fetcher.mock.calls.some((c) => String(c[0]).endsWith('/oauth/token'))).toBe(true);
  });

  it('returns 404 from delete as success', async () => {
    const fetcher = mock(async (url: string) => {
      if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      return new Response('', { status: 404 });
    });
    const c = createMgmtClient({ tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b', fetch: fetcher as unknown as typeof globalThis.fetch });
    const r = await c.deleteClient('cid');
    expect(r.ok).toBe(true);
  });

  it('retries 429 up to 3 times then fails', async () => {
    let calls = 0;
    const fetcher = mock(async (url: string) => {
      if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      calls++;
      return new Response('rate limited', { status: 429 });
    });
    const c = createMgmtClient({ tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b', fetch: fetcher as unknown as typeof globalThis.fetch, retryDelayMs: 1 });
    const r = await c.findClientByName('foo');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('AUTH0_RATE_LIMITED');
    expect(calls).toBe(3);
  });

  it('maps 401 from token endpoint to AUTH0_UNAUTHORIZED', async () => {
    const fetcher = mock(async () => new Response('{"error":"invalid_client"}', { status: 401 }));
    const c = createMgmtClient({ tenantDomain: 'x.us.auth0.com', mgmtClientId: 'a', mgmtClientSecret: 'b', fetch: fetcher as unknown as typeof globalThis.fetch });
    const r = await c.findClientByName('foo');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('AUTH0_UNAUTHORIZED');
  });
});
