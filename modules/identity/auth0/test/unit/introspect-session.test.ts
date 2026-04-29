import { describe, expect, it } from 'vitest';
import type { JWTVerifyGetKey } from 'jose';
import { generateKeyPair, SignJWT } from 'jose';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import { createAuth0IdentityModule } from '../../src/handlers.js';
import { stubAuth0Adapter } from '../helpers/stub-auth0-adapter.js';

const issuer = 'https://tenant.example.test/';
const audience = 'https://notes-demo.example.test/api';

async function signAccessToken(subject: string) {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
  const kid = 'test-kid-1';
  const jwksResolver: JWTVerifyGetKey = async (header) => {
    if (header.kid === kid) return publicKey;
    throw new Error('unknown kid');
  };
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(issuer)
    .setSubject(subject)
    .setAudience(audience)
    .setExpirationTime('1h')
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
});
