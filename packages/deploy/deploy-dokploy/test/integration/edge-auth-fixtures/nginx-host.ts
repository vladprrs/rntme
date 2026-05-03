import { createServer } from 'node:http';

export type NginxSubstitute = {
  baseUrl: string;
  stop: () => Promise<void>;
};

const CANONICAL_401_BODY = JSON.stringify({
  code: 'RUNTIME_AUTH_TOKEN_INVALID',
  message: 'authentication required',
});

/**
 * Parse the rendered nginx config to discover auth-related values.
 */
function parseAuthConfig(config: string): {
  protectedPath: string;
  introspectUrl: string;
  audience: string;
} {
  // Find the protected location (the one with auth_request)
  const locationMatch = config.match(/location\s+(\S+)\s*\{[^}]*auth_request/s);
  const protectedPath = locationMatch?.[1] ?? '/api';

  // Find the introspect upstream URL from the internal location
  const upstreamMatch = config.match(/proxy_pass\s+([^;]+)\/introspect;/);
  const introspectUrl = upstreamMatch?.[1]?.trim() ?? '';

  // Find the audience header
  const audienceMatch = config.match(/X-Rntme-Audience\s+"([^"]+)";/);
  const audience = audienceMatch?.[1] ?? '';

  return { protectedPath, introspectUrl, audience };
}

export async function startNginxOrSubstitute(config: string): Promise<NginxSubstitute> {
  const { protectedPath, introspectUrl, audience } = parseAuthConfig(config);

  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';

    // Explicit 404 for internal auth paths
    if (url.startsWith('/_rntme_auth_')) {
      res.writeHead(404);
      res.end();
      return;
    }

    // Check if this is a protected path
    if (!url.startsWith(protectedPath)) {
      res.writeHead(200);
      res.end('ok');
      return;
    }

    // Mimic auth_request: forward Authorization and X-Rntme-Audience to introspect
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(CANONICAL_401_BODY);
      return;
    }

    try {
      const introspectRes = await globalThis.fetch(`${introspectUrl}/introspect`, {
        headers: {
          Authorization: authHeader,
          'X-Rntme-Audience': audience,
        },
      });

      if (introspectRes.status === 401) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(CANONICAL_401_BODY);
        return;
      }

      if (!introspectRes.ok) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(CANONICAL_401_BODY);
        return;
      }

      // Auth passed - proxy to upstream (we don't have a real upstream, return 200)
      res.writeHead(200);
      res.end('ok');
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(CANONICAL_401_BODY);
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        stop: () =>
          new Promise((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
