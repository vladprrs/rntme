import { describe, it, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { ApiTokenProvider, isOk } from '@rntme/platform-core';
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

describe('introspectTokenHandler', () => {
  it('returns active status for a valid PAT', async () => {
    const { provider, plain } = await setup();
    const out = await introspectTokenHandler(
      { provider },
      { bearerToken: `Bearer ${plain}` },
    );
    expect(out.status).toBe('active');
    if (out.status === 'active') {
      expect(out.subject.tokenId).toBe('tid-1');
    }
  });

  it('returns inactive status for an unknown PAT', async () => {
    const { provider } = await setup();
    const out = await introspectTokenHandler(
      { provider },
      { bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` },
    );
    expect(out.status).toBe('inactive');
    if (out.status === 'inactive') {
      expect(out.code).toBe('PLATFORM_AUTH_INVALID');
    }
  });
});
