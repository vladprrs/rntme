import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { SessionStatus, TokenType } from '@rntme/contracts-identity-v1';
import type { IntrospectSessionRequest } from './types.js';
import type { Session } from './types.js';

type DeactivationReason =
  | 'TOKEN_EXPIRED'
  | 'INVALID_SIGNATURE'
  | 'INVALID_ISSUER'
  | 'INVALID_AUDIENCE'
  | 'MALFORMED'
  | 'UNKNOWN';

const PUBLIC_CLAIMS = [
  'sub',
  'email',
  'email_verified',
  'name',
  'given_name',
  'family_name',
  'picture',
  'locale',
  'iat',
  'exp',
  'iss',
  'aud',
  'azp',
] as const;

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
  if (!token) return inactiveSession('MALFORMED');

  const audience = request.audience?.trim();
  if (!audience) return inactiveSession('MALFORMED');

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
      return inactiveSession('MALFORMED');
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
      vendor_raw: { claims: pickPublicClaims(payload) } as never,
    };
  } catch (e) {
    return inactiveSession(classifyIntrospectError(e));
  }
}

function inactiveSession(reason: DeactivationReason): Session {
  return {
    session_id: '',
    user_id: '',
    status: reason === 'TOKEN_EXPIRED' ? SessionStatus.SESSION_STATUS_EXPIRED : SessionStatus.SESSION_STATUS_UNSPECIFIED,
    token_type: TokenType.TOKEN_TYPE_JWT_ACCESS,
    vendor_raw: { deactivation_reason: reason } as never,
  };
}

function classifyIntrospectError(error: unknown): DeactivationReason {
  if (error instanceof joseErrors.JWTExpired) return 'TOKEN_EXPIRED';
  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    if (error.claim === 'iss') return 'INVALID_ISSUER';
    if (error.claim === 'aud') return 'INVALID_AUDIENCE';
    return 'MALFORMED';
  }
  if (error instanceof joseErrors.JWSSignatureVerificationFailed) return 'INVALID_SIGNATURE';
  if (error instanceof joseErrors.JWKSNoMatchingKey) return 'INVALID_SIGNATURE';
  if (error instanceof joseErrors.JWSInvalid || error instanceof joseErrors.JWTInvalid) return 'MALFORMED';
  return 'UNKNOWN';
}

function pickPublicClaims(payload: JWTPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const claim of PUBLIC_CLAIMS) {
    if (claim in payload) out[claim] = payload[claim];
  }
  return out;
}
