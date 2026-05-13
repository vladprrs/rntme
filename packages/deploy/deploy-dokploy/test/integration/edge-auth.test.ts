import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { GenericContainer } from 'testcontainers';
import { renderNginxConfig } from '../../src/nginx.js';
import { HOST_GATEWAY_HOSTNAME, startNginxHost } from './edge-auth-fixtures/nginx-host.js';

const dockerAvailable = await hasTestcontainersRuntime();

describe.skipIf(!dockerAvailable)('edge auth integration', () => {
  let baseUrl: string;
  let stop: () => Promise<void> = async () => undefined;

  beforeAll(async () => {
    const sidecar = await startRejectingIntrospectionServer();
    const config = renderNginxConfig(
      {
        routes: [{ id: 'http:/api', path: '/api', kind: 'http', targetService: 'app', targetWorkload: 'app' }],
        middleware: [
          {
            kind: 'auth',
            mountTarget: 'http:/api',
            name: 'auth',
            providers: [
              {
                index: 0,
                provider: 'auth0',
                audience: 'https://x/',
                moduleSlug: 'identity-auth0',
                introspectPath: '/introspect',
                introspectPort: sidecar.port,
              },
            ],
          },
        ],
      },
      {
        app: `http://${HOST_GATEWAY_HOSTNAME}:65535`,
        // Container reaches the host's introspect sidecar via host-gateway alias.
        'identity-auth0': `http://${HOST_GATEWAY_HOSTNAME}:${sidecar.port}`,
      },
    );
    const host = await startNginxHost({ nginxConfig: config });
    baseUrl = host.baseUrl;
    stop = async () => {
      await sidecar.stop();
      await host.stop();
    };
  }, 60_000);

  afterAll(async () => {
    if (stop) await stop();
  });

  for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const) {
    it(`${method} /api/notes with Bearer fake.token.here is rejected by named fallback`, async () => {
      const r = await globalThis.fetch(`${baseUrl}/api/notes`, {
        method,
        headers: { Authorization: 'Bearer fake.token.here' },
      });
      expect(r.status).toBe(401);
      expect(r.headers.get('content-type')).toContain('application/json');
      const body = await r.json();
      expect(body).toEqual({ code: 'RUNTIME_AUTH_TOKEN_INVALID', message: 'authentication required' });
      expect(body).not.toHaveProperty('reason');
    });
  }

  it('GET /_rntme_auth_anything returns 404, not SPA HTML', async () => {
    const r = await globalThis.fetch(`${baseUrl}/_rntme_auth_xyz`);
    expect(r.status).toBe(404);
  });

  it('GET /api/notes without Authorization is rejected by named fallback', async () => {
    const r = await globalThis.fetch(`${baseUrl}/api/notes`);
    expect(r.status).toBe(401);
    const body = await r.json();
    expect(body).toEqual({ code: 'RUNTIME_AUTH_TOKEN_INVALID', message: 'authentication required' });
    expect(body).not.toHaveProperty('reason');
  });
});

describe.skipIf(!dockerAvailable)('edge auth provider chain', () => {
  let baseUrl: string;
  let stop: () => Promise<void> = async () => undefined;

  beforeAll(async () => {
    const rejecting = await startRejectingIntrospectionServer();
    const accepting = await startAcceptingIntrospectionServer();
    const echoApp = await startEchoAppServer();

    const config = renderNginxConfig(
      {
        routes: [
          {
            id: 'http:/api/projects',
            path: '/api/projects',
            kind: 'http',
            targetService: 'projects',
            targetWorkload: 'projects',
          },
        ],
        middleware: [
          {
            kind: 'auth',
            mountTarget: 'http:/api/projects',
            name: 'auth',
            providers: [
              {
                index: 0,
                provider: 'platform-tokens',
                moduleSlug: 'tokens',
                introspectPath: '/introspect',
                introspectPort: rejecting.port,
              },
              {
                index: 1,
                provider: 'auth0',
                audience: 'https://platform.rntme.com/api',
                moduleSlug: 'identity-auth0',
                introspectPath: '/introspect',
                introspectPort: accepting.port,
              },
            ],
          },
        ],
      },
      {
        projects: `http://${HOST_GATEWAY_HOSTNAME}:${echoApp.port}`,
        tokens: `http://${HOST_GATEWAY_HOSTNAME}:${rejecting.port}`,
        'identity-auth0': `http://${HOST_GATEWAY_HOSTNAME}:${accepting.port}`,
      },
    );
    const host = await startNginxHost({ nginxConfig: config });
    baseUrl = host.baseUrl;
    stop = async () => {
      await rejecting.stop();
      await accepting.stop();
      await echoApp.stop();
      await host.stop();
    };
  }, 60_000);

  afterAll(async () => {
    if (stop) await stop();
  });

  it('falls through provider 0 (401) to provider 1 (200) and forwards X-Rntme headers', async () => {
    const r = await globalThis.fetch(`${baseUrl}/api/projects`, {
      headers: { Authorization: 'Bearer auth0.token.here' },
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      userSub: 'acct_1',
      audience: 'urn:rntme:platform-tokens',
      sessionStatus: 'ACTIVE',
    });
  });
});

function listenForTest(server: Server): Promise<{ port: number; stop: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      server.off('error', reject);
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('failed to bind test server'));
        return;
      }
      resolve({
        port: addr.port,
        stop: () =>
          new Promise((res, rej) => {
            server.close((error) => {
              if (error) rej(error);
              else res();
            });
          }),
      });
    });
  });
}

async function startRejectingIntrospectionServer(): Promise<{ port: number; stop: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === '/introspect' || req.url === '/api/tokens/introspect') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'IDENTITY_CONSISTENCY_INVALID_TOKEN', message: 'MALFORMED' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return listenForTest(server);
}

async function startAcceptingIntrospectionServer(): Promise<{ port: number; stop: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === '/introspect' || req.url === '/api/tokens/introspect') {
      res.writeHead(200, {
        'X-Rntme-User-Sub': 'acct_1',
        'X-Rntme-User-Audience': 'urn:rntme:platform-tokens',
        'X-Rntme-Session-Status': 'ACTIVE',
      });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return listenForTest(server);
}

async function startEchoAppServer(): Promise<{ port: number; stop: () => Promise<void> }> {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        userSub: req.headers['x-rntme-user-sub'],
        audience: req.headers['x-rntme-user-audience'],
        sessionStatus: req.headers['x-rntme-session-status'],
      }),
    );
  });
  return listenForTest(server);
}

async function hasTestcontainersRuntime(): Promise<boolean> {
  if (process.env['SKIP_TESTCONTAINERS'] === '1') return false;
  try {
    const container = await new GenericContainer('nginx:1.27-alpine').start();
    await container.stop();
    return true;
  } catch {
    return false;
  }
}
