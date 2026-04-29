import { expect } from 'vitest';
import type { KeyLike } from 'jose';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { SessionStatus } from '@rntme/contracts-identity-v1';
import { createAuth0IdentityModule } from '../../../src/handlers.js';
import { stubAuth0Adapter } from '../../helpers/stub-auth0-adapter.js';

const issuer = 'https://tenant.example.test/';
const audience = 'https://notes-demo.example.test/api';

type Scenario = {
  readonly name: string;
  readonly run: () => Promise<void>;
};

function reasonOf(value: { vendor_raw?: unknown }): string | undefined {
  return (value.vendor_raw as { deactivation_reason?: string } | undefined)?.deactivation_reason;
}

async function setup() {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
  const kid = 'test-kid-1';
  const jwk = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  const mod = createAuth0IdentityModule(stubAuth0Adapter(), {
    auth0Issuer: issuer,
    jwksResolver: createLocalJWKSet({ keys: [jwk] }),
  });
  return { kid, privateKey, mod };
}

async function signToken(opts: {
  readonly privateKey: KeyLike;
  readonly kid: string;
  readonly subject?: string;
  readonly issuer?: string;
  readonly audience?: string;
  readonly expiresAt?: number | string;
}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: opts.kid })
    .setIssuer(opts.issuer ?? issuer)
    .setSubject(opts.subject ?? 'auth0|alice')
    .setAudience(opts.audience ?? audience)
    .setExpirationTime(opts.expiresAt ?? '1h')
    .sign(opts.privateKey);
}

export function introspectSessionMockScenarios(): ReadonlyArray<Scenario> {
  return [
    {
      name: 'valid_token',
      run: async () => {
        const ctx = await setup();
        const token = await signToken(ctx);
        const session = await ctx.mod.IntrospectSession({ token, audience });

        expect(session.status).toBe(SessionStatus.SESSION_STATUS_ACTIVE);
        expect(session.user_id).toBe('auth0|alice');
      },
    },
    {
      name: 'expired_token',
      run: async () => {
        const ctx = await setup();
        const token = await signToken({ ...ctx, expiresAt: Math.floor(Date.now() / 1000) - 60 });
        const session = await ctx.mod.IntrospectSession({ token, audience });

        expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
        expect(reasonOf(session)).toBe('TOKEN_EXPIRED');
      },
    },
    {
      name: 'wrong_issuer',
      run: async () => {
        const ctx = await setup();
        const token = await signToken({ ...ctx, issuer: 'https://other-tenant.example.test/' });
        const session = await ctx.mod.IntrospectSession({ token, audience });

        expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
        expect(reasonOf(session)).toBe('INVALID_ISSUER');
      },
    },
    {
      name: 'wrong_audience',
      run: async () => {
        const ctx = await setup();
        const token = await signToken({ ...ctx, audience: 'https://other-api.example.test/' });
        const session = await ctx.mod.IntrospectSession({ token, audience });

        expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
        expect(reasonOf(session)).toBe('INVALID_AUDIENCE');
      },
    },
    {
      name: 'bad_signature',
      run: async () => {
        const ctx = await setup();
        const { privateKey: wrongPrivateKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
        const token = await signToken({ privateKey: wrongPrivateKey, kid: ctx.kid });
        const session = await ctx.mod.IntrospectSession({ token, audience });

        expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
        expect(reasonOf(session)).toBe('INVALID_SIGNATURE');
      },
    },
    {
      name: 'malformed_token',
      run: async () => {
        const ctx = await setup();
        const session = await ctx.mod.IntrospectSession({ token: 'not.a.jwt', audience });

        expect(session.status).not.toBe(SessionStatus.SESSION_STATUS_ACTIVE);
        expect(reasonOf(session)).toBe('MALFORMED');
      },
    },
  ];
}
