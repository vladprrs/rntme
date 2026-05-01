import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import { Hono } from 'hono';
import type { Auth0IdentityModule } from './server.js';
import type { Session } from './types.js';

export interface IdentityAuth0HttpAppOptions {
  readonly module: Pick<Auth0IdentityModule, 'IntrospectSession'>;
}

export interface IdentityAuth0HttpServerOptions extends IdentityAuth0HttpAppOptions {
  readonly port: number;
  readonly host?: string;
}

export interface IdentityAuth0HttpServer {
  listen(): Promise<{ port: number }>;
  stop(): Promise<void>;
}

const tokenMissing = {
  code: 'IDENTITY_HTTP_TOKEN_MISSING',
  message: 'Authorization header is required',
} as const;

const audienceMissing = {
  code: 'IDENTITY_HTTP_AUDIENCE_MISSING',
  message: 'X-Rntme-Audience header is required',
} as const;

const handlerUnavailable = {
  code: 'IDENTITY_VENDOR_UNAVAILABLE',
  message: 'IntrospectSession not implemented',
} as const;

function hasBearerToken(value: string | undefined): value is string {
  return value !== undefined && /^Bearer\s+\S+$/.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function inactiveReason(session: Session): string {
  const reason = asRecord(session.vendor_raw)?.deactivation_reason;
  return typeof reason === 'string' ? reason : 'session is not active';
}

function sessionSubject(session: Session): string | null {
  const subject = session.user_id?.trim() ?? '';
  return subject.length > 0 ? subject : null;
}

export function createIdentityAuth0HttpApp(opts: IdentityAuth0HttpAppOptions): Hono {
  const app = new Hono();

  app.get('/introspect', async (c) => {
    const token = c.req.header('Authorization');
    if (!hasBearerToken(token)) {
      return c.json(tokenMissing, 401);
    }

    const audience = c.req.header('X-Rntme-Audience');
    if (audience === undefined || audience.trim().length === 0) {
      return c.json(audienceMissing, 401);
    }
    const normalizedAudience = audience.trim();

    const handler = opts.module.IntrospectSession;
    if (handler === undefined) {
      return c.json(handlerUnavailable, 500);
    }

    let session: Session;
    try {
      session = (await handler({ token, audience: normalizedAudience })) as Session;
    } catch (error) {
      return c.json(
        {
          code: 'IDENTITY_VENDOR_UNAVAILABLE',
          message: error instanceof Error ? error.message : 'introspection failed',
        },
        500,
      );
    }

    if (session.status !== SessionStatus.SESSION_STATUS_ACTIVE) {
      return c.json(
        {
          code: 'IDENTITY_CONSISTENCY_INVALID_TOKEN',
          message: inactiveReason(session),
        },
        401,
      );
    }

    const subject = sessionSubject(session);
    if (subject === null) {
      return c.json(
        {
          code: 'IDENTITY_CONSISTENCY_INVALID_TOKEN',
          message: 'session subject is missing',
        },
        401,
      );
    }

    c.header('X-Rntme-User-Sub', subject);
    c.header('X-Rntme-User-Audience', normalizedAudience);
    c.header('X-Rntme-Session-Status', 'ACTIVE');
    return c.body(null, 200);
  });

  return app;
}

export function createIdentityAuth0HttpServer(opts: IdentityAuth0HttpServerOptions): IdentityAuth0HttpServer {
  const app = createIdentityAuth0HttpApp(opts);
  let server: ServerType | null = null;

  return {
    listen(): Promise<{ port: number }> {
      if (server !== null) {
        return Promise.reject(new Error('IdentityAuth0HttpServer is already listening'));
      }
      return new Promise((resolve, reject) => {
        const nextServer = serve(
          {
            fetch: app.fetch,
            hostname: opts.host ?? '0.0.0.0',
            port: opts.port,
          },
          (info) => resolve({ port: info.port }),
        );
        server = nextServer;
        nextServer.once('error', (error) => {
          if (server === nextServer) {
            server = null;
          }
          reject(error);
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (server === null) {
          resolve();
          return;
        }
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          server = null;
          resolve();
        });
      });
    },
  };
}
