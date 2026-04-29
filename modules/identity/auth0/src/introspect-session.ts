import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { SessionStatus, TokenType } from '@rntme/contracts-identity-v1';
import type { IntrospectSessionRequest } from './types.js';
import type { Session } from './types.js';
import { IdentityModuleError, GrpcStatus, invalidArgument } from './errors.js';

export type IntrospectJwtDeps = {
  readonly issuerUrl: string | URL;
  /** Production default: `createRemoteJWKSet(new URL('.well-known/jwks.json', issuerUrl))`. Tests pass a local resolver. */
  readonly jwksResolver?: JWTVerifyGetKey;
};

function normalizeIssuer(domainOrUrl: string): URL {
  const t = domainOrUrl.trim();
  if (/^https?:\/\//i.test(t)) return new URL(t.endsWith('/') ? t : `${t}/`);
  return new URL(`https://${t.replace(/\/$/, '')}/`);
}

export function resolveAuth0IssuerFromEnv(): string | null {
  const explicit = process.env.AUTH0_ISSUER?.trim();
  if (explicit) return normalizeIssuer(explicit).href;
  const domain = process.env.AUTH0_DOMAIN?.trim();
  if (!domain) return null;
  return normalizeIssuer(domain).href;
}

export async function introspectJwtToSession(request: IntrospectSessionRequest, deps: IntrospectJwtDeps): Promise<Session> {
  const token = request.token?.trim();
  if (!token) throw invalidArgument('IntrospectSession requires token');

  const audience = request.audience?.trim();
  if (!audience) throw invalidArgument('IntrospectSession requires audience');

  const issuer = typeof deps.issuerUrl === 'string' ? deps.issuerUrl : deps.issuerUrl.href;
  const jwkGet =
    deps.jwksResolver ?? createRemoteJWKSet(new URL('.well-known/jwks.json', issuer.endsWith('/') ? issuer : `${issuer}/`));

  try {
    const { payload } = await jwtVerify(token, jwkGet, {
      issuer,
      audience,
      clockTolerance: 30,
    });

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) {
      throw new IdentityModuleError(
        'JWT missing sub',
        GrpcStatus.UNAUTHENTICATED,
        'IDENTITY_VENDOR_AUTHENTICATION_FAILED',
      );
    }

    const expSec = typeof payload.exp === 'number' ? payload.exp : undefined;
    const expires_at =
      expSec !== undefined
        ? {
            seconds: Math.floor(expSec),
            nanos: 0,
          }
        : undefined;

    return {
      session_id: typeof payload.jti === 'string' && payload.jti.length > 0 ? payload.jti : `jwt:${sub}`,
      user_id: sub,
      status: SessionStatus.SESSION_STATUS_ACTIVE,
      token_type: TokenType.TOKEN_TYPE_JWT_ACCESS,
      expires_at,
    };
  } catch (e) {
    if (e instanceof IdentityModuleError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new IdentityModuleError(
      msg,
      GrpcStatus.UNAUTHENTICATED,
      'IDENTITY_VENDOR_AUTHENTICATION_FAILED',
      e,
    );
  }
}
