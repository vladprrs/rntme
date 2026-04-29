import { describe, expect, it } from 'vitest';
import type { JWTVerifyGetKey, KeyLike } from 'jose';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import { createAuth0IdentityModule } from '../../src/handlers.js';
import { stubAuth0Adapter } from '../helpers/stub-auth0-adapter.js';

const issuer = 'https://tenant.example.test/';
const audience = 'https://notes-demo.example.test/api';

function reasonOf(session: { vendor_raw?: unknown }): string | undefined {
  return (session.vendor_raw as { deactivation_reason?: string } | undefined)?.deactivation_reason;
}

async function setupKeys() {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
  const kid = 'test-kid-1';
  const jwk = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  const jwksResolver = createLocalJWKSet({ keys: [jwk] });
  return { kid, privateKey, jwksResolver };
}

async function signAccessToken(subject: string, opts: { aud?: string; iss?: string; exp?: number; privateKey?: KeyLike; kid?: string } = {}) {
  const { kid, privateKey, jwksResolver } = opts.privateKey && opts.kid
    ? { kid: opts.kid, privateKey: opts.privateKey, jwksResolver: undefined }
    : await setupKeys();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(opts.iss ?? issuer)
    .setSubject(subject)
    .setAudience(opts.aud ?? audience)
    .setExpirationTime(opts.exp ?? '1h')
    .sign(privateKey);
  return { token, jwksResolver };
}

describe('IntrospectSession', () => {
  it('returns ACTIVE Session when JWT verifies against local JWKS', async () => {
    const { token, jwksResolver } = await signAccessToken('auth0|alice');

    const mod = createAuth0IdentityModule(stubAuth0Adapter(), {
      auth0Issuer: issuer,
      jwksResolver,
    });

    const session = await mod.IntrospectSession({ token, audience });

    expect(session.user_id).toBe('auth0|alice');
    expect(session.status).toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(session.session_id?.length ?? 0).toBeGreaterThan(0);
  });

  it('returns TOKEN_EXPIRED for an expired token without throwing', async () => {
    const { privateKey, kid, jwksResolver } = await setupKeys();
    const { token } = await signAccessToken('auth0|alice', {
      privateKey,
      kid,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const mod = createAuth0IdentityModule(stubAuth0Adapter(), { auth0Issuer: issuer, jwksResolver });

    const session = await mod.IntrospectSession({ token, audience });

    expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(reasonOf(session)).toBe('TOKEN_EXPIRED');
  });

  it('returns INVALID_ISSUER for issuer mismatch without throwing', async () => {
    const { privateKey, kid, jwksResolver } = await setupKeys();
    const { token } = await signAccessToken('auth0|alice', {
      privateKey,
      kid,
      iss: 'https://other-tenant.example.test/',
    });
    const mod = createAuth0IdentityModule(stubAuth0Adapter(), { auth0Issuer: issuer, jwksResolver });

    const session = await mod.IntrospectSession({ token, audience });

    expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(reasonOf(session)).toBe('INVALID_ISSUER');
  });

  it('returns INVALID_AUDIENCE for audience mismatch without throwing', async () => {
    const { privateKey, kid, jwksResolver } = await setupKeys();
    const { token } = await signAccessToken('auth0|alice', {
      privateKey,
      kid,
      aud: 'https://other-api.example.test/',
    });
    const mod = createAuth0IdentityModule(stubAuth0Adapter(), { auth0Issuer: issuer, jwksResolver });

    const session = await mod.IntrospectSession({ token, audience });

    expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(reasonOf(session)).toBe('INVALID_AUDIENCE');
  });

  it('returns INVALID_SIGNATURE for signature mismatch without throwing', async () => {
    const { kid, jwksResolver } = await setupKeys();
    const { privateKey: wrongPrivateKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
    const { token } = await signAccessToken('auth0|alice', { privateKey: wrongPrivateKey, kid });
    const mod = createAuth0IdentityModule(stubAuth0Adapter(), { auth0Issuer: issuer, jwksResolver });

    const session = await mod.IntrospectSession({ token, audience });

    expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(reasonOf(session)).toBe('INVALID_SIGNATURE');
  });

  it('returns MALFORMED for malformed or missing token inputs without throwing', async () => {
    const { jwksResolver } = await setupKeys();
    const mod = createAuth0IdentityModule(stubAuth0Adapter(), { auth0Issuer: issuer, jwksResolver });

    const malformed = await mod.IntrospectSession({ token: 'not.a.jwt', audience });
    const missing = await mod.IntrospectSession({ token: '', audience });

    expect(malformed.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(reasonOf(malformed)).toBe('MALFORMED');
    expect(missing.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(reasonOf(missing)).toBe('MALFORMED');
  });

  it('returns UNKNOWN for unexpected verification failures without throwing', async () => {
    const { token } = await signAccessToken('auth0|alice');
    const jwksResolver: JWTVerifyGetKey = async () => {
      throw new Error('resolver unavailable');
    };
    const mod = createAuth0IdentityModule(stubAuth0Adapter(), { auth0Issuer: issuer, jwksResolver });

    const session = await mod.IntrospectSession({ token, audience });

    expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
    expect(reasonOf(session)).toBe('UNKNOWN');
  });
});
