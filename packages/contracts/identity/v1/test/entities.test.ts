import { describe, it, expect } from 'vitest';
import { proto } from '../src/index.js';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

function refFor(canonicalId: string, vendorId: string) {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'identity-clerk',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

describe('User', () => {
  it('round-trips ref + email + status + soft-delete fields', () => {
    const user = id.User.create({
      ref: refFor('u-1', 'user_2abc'),
      email: 'ada@example.com',
      email_verified: true,
      name: common.Name.create({ given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' }),
      status: id.UserStatus.USER_STATUS_ACTIVE,
    });
    const buf = id.User.encode(user).finish();
    const decoded = id.User.decode(buf);
    expect(decoded.email).toBe('ada@example.com');
    expect(decoded.email_verified).toBe(true);
    expect(decoded.status).toBe(id.UserStatus.USER_STATUS_ACTIVE);
    expect(decoded.ref?.canonical_id).toBe('u-1');
  });

  it('preserves USER_STATUS_VENDOR_SPECIFIC sentinel', () => {
    const u = id.User.create({ ref: refFor('u-2', 'v'), email: 'x@x', status: id.UserStatus.USER_STATUS_VENDOR_SPECIFIC });
    const decoded = id.User.decode(id.User.encode(u).finish());
    expect(decoded.status).toBe(100);
  });
});

describe('Organization', () => {
  it('round-trips slug and max_members', () => {
    const org = id.Organization.create({
      ref: refFor('o-1', 'org_a'),
      name: 'Acme',
      slug: 'acme',
      max_members: 50,
      status: id.OrgStatus.ORG_STATUS_ACTIVE,
    });
    const decoded = id.Organization.decode(id.Organization.encode(org).finish());
    expect(decoded.slug).toBe('acme');
    expect(decoded.max_members).toBe(50);
  });
});

describe('OrganizationMembership', () => {
  it('preserves repeated roles array', () => {
    const m = id.OrganizationMembership.create({
      ref: refFor('m-1', 'mem_a'),
      user_id: 'u-1',
      organization_id: 'o-1',
      roles: ['admin', 'billing'],
      status: id.MembershipStatus.MEMBERSHIP_STATUS_ACTIVE,
    });
    const decoded = id.OrganizationMembership.decode(id.OrganizationMembership.encode(m).finish());
    expect(decoded.roles).toEqual(['admin', 'billing']);
    expect(decoded.user_id).toBe('u-1');
  });
});

describe('Invitation', () => {
  it('round-trips email/inviter/roles', () => {
    const inv = id.Invitation.create({
      ref: refFor('i-1', 'inv_a'),
      email: 'new@example.com',
      organization_id: 'o-1',
      inviter_user_id: 'u-1',
      roles: ['member'],
      status: id.InvitationStatus.INVITATION_STATUS_PENDING,
    });
    const decoded = id.Invitation.decode(id.Invitation.encode(inv).finish());
    expect(decoded.email).toBe('new@example.com');
    expect(decoded.roles).toEqual(['member']);
    expect(decoded.status).toBe(id.InvitationStatus.INVITATION_STATUS_PENDING);
  });
});

describe('Session', () => {
  it('round-trips token_type, verified_factors, status', () => {
    const s = id.Session.create({
      ref: refFor('s-1', 'sess_a'),
      session_id: 'sid_1',
      user_id: 'u-1',
      token_type: id.TokenType.TOKEN_TYPE_JWT_ACCESS,
      verified_factors: ['totp', 'webauthn'],
      status: id.SessionStatus.SESSION_STATUS_ACTIVE,
    });
    const decoded = id.Session.decode(id.Session.encode(s).finish());
    expect(decoded.token_type).toBe(id.TokenType.TOKEN_TYPE_JWT_ACCESS);
    expect(decoded.verified_factors).toEqual(['totp', 'webauthn']);
  });
});

describe('IdentityResolution', () => {
  it('round-trips the user oneof branch', () => {
    const res = id.IdentityResolution.create({
      user: id.User.create({ ref: refFor('u-1', 'v'), email: 'a@b' }),
      exists: true,
      canonical_id: 'u-1',
      input_type: id.ResolutionInputType.RESOLUTION_INPUT_TYPE_EMAIL,
      input_value: 'a@b',
    });
    const decoded = id.IdentityResolution.decode(id.IdentityResolution.encode(res).finish());
    expect(decoded.exists).toBe(true);
    expect(decoded.canonical_id).toBe('u-1');
    expect(decoded.identity).toBe('user');
  });
});
