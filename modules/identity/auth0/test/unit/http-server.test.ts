import { createServer } from 'node:net';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import { describe, expect, it } from 'vitest';
import { createIdentityAuth0HttpApp, createIdentityAuth0HttpServer } from '../../src/http-server.js';

const audience = 'https://demo.example.com/api';

function activeSession() {
  return {
    session_id: 'auth0|alice@1700000000',
    user_id: 'auth0|alice',
    status: SessionStatus.SESSION_STATUS_ACTIVE,
    issued_at: '2026-05-01T00:00:00.000Z',
    expires_at: '2026-05-01T01:00:00.000Z',
    audience,
    token_type: 1,
    public: {},
    private: {},
    unsafe: {},
    vendor_raw: {},
  };
}

function inactiveSession() {
  return {
    ...activeSession(),
    status: SessionStatus.SESSION_STATUS_EXPIRED,
    vendor_raw: { deactivation_reason: 'TOKEN_EXPIRED' },
  };
}

async function getAvailablePort(): Promise<number> {
  const probe = createServer();
  return new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address !== null && typeof address === 'object') {
          resolve(address.port);
          return;
        }
        reject(new Error('failed to allocate test port'));
      });
    });
  });
}

describe('createIdentityAuth0HttpApp', () => {
  it('returns 401 IDENTITY_HTTP_TOKEN_MISSING when Authorization header is absent', async () => {
    const app = createIdentityAuth0HttpApp({
      module: { IntrospectSession: async () => activeSession() },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      code: 'IDENTITY_HTTP_TOKEN_MISSING',
      message: 'Authorization header is required',
    });
  });

  it('returns 401 IDENTITY_HTTP_TOKEN_MISSING when Authorization is malformed', async () => {
    const app = createIdentityAuth0HttpApp({
      module: { IntrospectSession: async () => activeSession() },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Token abc', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('IDENTITY_HTTP_TOKEN_MISSING');
  });

  it('returns 401 IDENTITY_HTTP_AUDIENCE_MISSING when X-Rntme-Audience header is absent', async () => {
    const app = createIdentityAuth0HttpApp({
      module: { IntrospectSession: async () => activeSession() },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-x' },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('IDENTITY_HTTP_AUDIENCE_MISSING');
  });

  it('returns 500 IDENTITY_VENDOR_UNAVAILABLE when IntrospectSession handler is absent', async () => {
    const app = createIdentityAuth0HttpApp({ module: {} });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-x', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      code: 'IDENTITY_VENDOR_UNAVAILABLE',
      message: 'IntrospectSession not implemented',
    });
  });

  it('returns 200 with X-Rntme-* headers on active session', async () => {
    let received: { token: string; audience: string } | null = null;
    const app = createIdentityAuth0HttpApp({
      module: {
        IntrospectSession: async (req) => {
          received = req as { token: string; audience: string };
          return activeSession();
        },
      },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-x', 'X-Rntme-Audience': `  ${audience}  ` },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
    expect(res.headers.get('X-Rntme-User-Sub')).toBe('auth0|alice');
    expect(res.headers.get('X-Rntme-User-Audience')).toBe(audience);
    expect(res.headers.get('X-Rntme-Session-Status')).toBe('ACTIVE');
    expect(received).toEqual({ token: 'Bearer token-x', audience });
  });

  it('fails closed when active session subject is missing', async () => {
    const app = createIdentityAuth0HttpApp({
      module: {
        IntrospectSession: async () => ({
          ...activeSession(),
          user_id: '',
        }),
      },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer token-x', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      code: 'IDENTITY_CONSISTENCY_INVALID_TOKEN',
      message: 'session subject is missing',
    });
  });

  it('returns 401 with IDENTITY_CONSISTENCY_INVALID_TOKEN on inactive session', async () => {
    const app = createIdentityAuth0HttpApp({
      module: { IntrospectSession: async () => inactiveSession() },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer expired', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      code: 'IDENTITY_CONSISTENCY_INVALID_TOKEN',
      message: 'TOKEN_EXPIRED',
    });
  });

  it('returns 500 with IDENTITY_VENDOR_UNAVAILABLE when handler throws', async () => {
    const app = createIdentityAuth0HttpApp({
      module: {
        IntrospectSession: async () => {
          throw new Error('boom');
        },
      },
    });
    const res = await app.request('/introspect', {
      method: 'GET',
      headers: { Authorization: 'Bearer x', 'X-Rntme-Audience': audience },
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      code: 'IDENTITY_VENDOR_UNAVAILABLE',
      message: 'boom',
    });
  });

  it('serves introspection over a real HTTP server on an assigned port', async () => {
    const server = createIdentityAuth0HttpServer({
      module: { IntrospectSession: async () => activeSession() },
      port: 0,
      host: '127.0.0.1',
    });
    const { port } = await server.listen();

    try {
      expect(port).toBeGreaterThan(0);
      const res = await globalThis.fetch(`http://127.0.0.1:${port}/introspect`, {
        method: 'GET',
        headers: { Authorization: 'Bearer token-x', 'X-Rntme-Audience': audience },
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('');
      expect(res.headers.get('X-Rntme-User-Sub')).toBe('auth0|alice');
      expect(res.headers.get('X-Rntme-User-Audience')).toBe(audience);
      expect(res.headers.get('X-Rntme-Session-Status')).toBe('ACTIVE');
    } finally {
      await server.stop();
    }
  });

  it('rejects a second listen call instead of replacing the active server', async () => {
    const server = createIdentityAuth0HttpServer({
      module: { IntrospectSession: async () => activeSession() },
      port: await getAvailablePort(),
      host: '127.0.0.1',
    });
    await server.listen();

    try {
      await expect(server.listen()).rejects.toThrow('IdentityAuth0HttpServer is already listening');
    } finally {
      await server.stop().catch(() => undefined);
    }
  });
});
