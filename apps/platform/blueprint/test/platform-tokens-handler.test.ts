import { describe, it, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { ApiTokenProvider } from '@rntme/platform-core';
import { FakeStore } from '@rntme/platform-core/testing';
import { introspectTokenHandler } from '../services/tokens/handlers/introspect-token.js';

async function setup() {
  const store = new FakeStore();
  const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u', email: null, displayName: 'U' });
  await store.membershipMirror.upsert({ orgId: org.id, accountId: acct.id, role: 'member' });
  const plain = 'rntme_pat_' + 'a'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await store.tokensRepo.create({
    id: 'tid-1',
    orgId: org.id,
    accountId: acct.id,
    name: 'cli',
    tokenHash: hash,
    prefix: plain.slice(0, 12),
    scopes: ['project:read'],
    expiresAt: null,
  });
  const provider = new ApiTokenProvider({
    tokens: store.tokensRepo,
    organizations: store.organizations,
    accounts: store.accountsRepo,
    memberships: store.membershipMirror,
  });
  return { provider, plain };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (err) {
    return err;
  }
}

describe('introspectTokenHandler', () => {
  it('returns a typed PLATFORM_AUTH_* error when invoked with the runtime-native call shape', async () => {
    const thrown = await captureError(
      introspectTokenHandler(
        { bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` },
        { correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null } } as never,
      ),
    );

    expect(thrown).toBeInstanceOf(Error);
    if (thrown instanceof Error) {
      expect((thrown as Error & { code?: string }).code).toBe('PLATFORM_AUTH_INVALID');
      expect(thrown.message).toBe('invalid token');
    }
  });

  it('returns active status for a valid PAT', async () => {
    const { provider, plain } = await setup();
    const out = await introspectTokenHandler(
      { provider },
      { bearerToken: `Bearer ${plain}` },
    );
    expect(out.status).toBe('active');
    if (out.status === 'active') {
      expect(out.subject.account.id).toBeDefined();
      expect(out.subject.tokenId).toBe('tid-1');
    }
  });

  it('throws PLATFORM_AUTH_* with typed code for an unknown PAT', async () => {
    const { provider } = await setup();
    let thrown: unknown = null;
    try {
      await introspectTokenHandler(
        { provider },
        { bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` },
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    if (thrown instanceof Error) {
      const code = (thrown as Error & { code?: string }).code;
      expect(typeof code).toBe('string');
      expect(code?.startsWith('PLATFORM_AUTH_')).toBe(true);
      expect(code).toBe('PLATFORM_AUTH_INVALID');
    }
  });
});
