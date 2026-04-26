import { describe, it, expect } from 'vitest';
import { proto } from '../src/index.js';

const expectedRpcs = [
  'GetUser',
  'ListUsers',
  'GetOrganization',
  'ListOrganizations',
  'GetMembership',
  'ListMemberships',
  'GetInvitation',
  'ListInvitations',
  'GetSession',
  'ListSessions',
  'ResolveIdentity',
  'IntrospectSession',
  'CreateUser',
  'UpdateUser',
  'DeleteUser',
  'CreateOrganization',
  'UpdateOrganization',
  'DeleteOrganization',
  'CreateInvitation',
  'RevokeInvitation',
  'AddMembership',
  'UpdateMembership',
  'RemoveMembership',
  'RevokeSession',
] as const;

function rpcNamesFromPrototype(): Set<string> {
  const Cons = proto.rntme.contracts.identity.v1.IdentityModule;
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(Cons.prototype)) {
    if (key === 'constructor') continue;
    const fn = (Cons.prototype as unknown as Record<string, unknown>)[key];
    if (typeof fn !== 'function') continue;
    const n = (fn as { name?: string }).name;
    if (n && /^[A-Z][a-zA-Z0-9]*$/.test(n)) names.add(n);
  }
  return names;
}

describe('IdentityModule service shape', () => {
  it('declares exactly 24 RPCs', () => {
    const methodNames = rpcNamesFromPrototype();
    expect(methodNames.size).toBe(24);
  });

  it('contains every expected RPC name', () => {
    const methodNames = rpcNamesFromPrototype();
    for (const rpc of expectedRpcs) {
      expect(methodNames.has(rpc), `expected RPC ${rpc} declared in IdentityModule`).toBe(true);
    }
  });

  it('does NOT contain RPCs deferred to vendor extensions per spec §3 / Q3', () => {
    const methodNames = rpcNamesFromPrototype();
    for (const rpc of ['Impersonate', 'AssignRole', 'RevokeRole', 'CreateSession']) {
      expect(methodNames.has(rpc), `${rpc} must NOT appear in IdentityModule v1`).toBe(false);
    }
  });
});
