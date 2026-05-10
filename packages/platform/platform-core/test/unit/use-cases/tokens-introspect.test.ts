import { describe, it, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { isOk } from '../../../src/types/result.js';
import { introspectToken } from '../../../src/use-cases/tokens.js';
import { FakeStore } from '../../../src/testing/fakes.js';

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
    scopes: ['project:read', 'project:write', 'version:publish'],
    expiresAt: null,
  });
  return { store, plain, org, acct };
}

describe('introspectToken', () => {
  it('returns AuthSubject for a valid bearer token', async () => {
    const { store, plain, org, acct } = await setup();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: store.tokensRepo,
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: store.membershipMirror,
        },
      },
      input: { bearerToken: plain },
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.role).toBe('member');
      expect(r.value.account.id).toBe(acct.id);
      expect(r.value.org.id).toBe(org.id);
      expect(r.value.tokenId).toBe('tid-1');
      expect(r.value.scopes).toEqual(['project:read', 'project:write', 'version:publish']);
    }
  });
});

describe('introspectToken — error branches', () => {
  it('returns PLATFORM_AUTH_MISSING when bearer is absent', async () => {
    const store = new FakeStore();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: store.tokensRepo,
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: store.membershipMirror,
        },
      },
      input: { bearerToken: '' },
    });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_MISSING');
  });

  it('returns PLATFORM_AUTH_INVALID when prefix is unknown', async () => {
    const store = new FakeStore();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: store.tokensRepo,
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: store.membershipMirror,
        },
      },
      input: { bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` },
    });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_INVALID');
  });

  it('returns PLATFORM_AUTH_INVALID on mismatched hash', async () => {
    const { store, plain } = await setup();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: {
            ...store.tokensRepo,
            findByPrefix: async () =>
              ({
                ok: true,
                value: {
                  id: 'tid-1',
                  orgId: 'org-1',
                  accountId: 'acc-1',
                  name: 'x',
                  tokenHash: new Uint8Array(32),
                  prefix: plain.slice(0, 12),
                  scopes: [],
                  lastUsedAt: null,
                  expiresAt: null,
                  revokedAt: null,
                  createdAt: new Date(),
                },
              }) as never,
          },
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: store.membershipMirror,
        },
      },
      input: { bearerToken: `Bearer ${plain}` },
    });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_INVALID');
  });

  it('returns PLATFORM_AUTH_INVALID when account is not a member of the org', async () => {
    const { store, plain } = await setup();
    const r = await introspectToken({
      deps: {
        repos: {
          tokens: store.tokensRepo,
          organizations: store.organizations,
          accounts: store.accountsRepo,
          memberships: { find: async () => ({ ok: true, value: null }) } as never,
        },
      },
      input: { bearerToken: `Bearer ${plain}` },
    });
    expect(isOk(r)).toBe(false);
    if (!isOk(r)) expect(r.errors[0]!.code).toBe('PLATFORM_AUTH_INVALID');
  });
});
