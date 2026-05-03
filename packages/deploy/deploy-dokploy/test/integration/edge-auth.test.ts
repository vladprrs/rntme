import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { renderNginxConfig } from '../../src/nginx.js';
import { startNginxOrSubstitute } from './edge-auth-fixtures/nginx-host.js';

describe('edge auth integration', () => {
  let baseUrl: string;
  let stop: () => Promise<void> = async () => undefined;

  beforeAll(async () => {
    const sidecar = await startRejectingIntrospectionServer();
    const config = renderNginxConfig(
      {
        routes: [{ id: 'http:/api', path: '/api', targetService: 'app', targetWorkload: 'app' }],
        middleware: [
          {
            kind: 'auth',
            mountTarget: 'http:/api',
            name: 'auth',
            provider: 'auth0',
            audience: 'https://x/',
            moduleSlug: 'identity-auth0',
            moduleIntrospectPort: sidecar.port,
          },
        ],
      },
      { app: 'http://127.0.0.1:65535', 'identity-auth0': `http://127.0.0.1:${sidecar.port}` },
    );
    const host = await startNginxOrSubstitute(config);
    baseUrl = host.baseUrl;
    stop = async () => {
      await sidecar.stop();
      await host.stop();
    };
  });

  afterAll(async () => {
    await stop();
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

async function startRejectingIntrospectionServer(): Promise<{ port: number; stop: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === '/introspect') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'IDENTITY_CONSISTENCY_INVALID_TOKEN', message: 'MALFORMED' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('failed to bind introspection server'));
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
