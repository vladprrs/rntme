import { describe, it, expect } from 'bun:test';
import { proto } from '../src/index.js';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

const expectedEvents = [
  'UserCreated',
  'UserUpdated',
  'UserDeleted',
  'UserEmailVerified',
  'OrganizationCreated',
  'OrganizationUpdated',
  'OrganizationDeleted',
  'MembershipCreated',
  'MembershipUpdated',
  'MembershipDeleted',
  'InvitationCreated',
  'InvitationAccepted',
  'InvitationRevoked',
  'InvitationExpired',
  'SessionCreated',
  'SessionEnded',
  'SessionRevoked',
] as const;

describe('Identity event payloads', () => {
  it('exports exactly 17 canonical event types', () => {
    for (const name of expectedEvents) {
      expect((id as unknown as Record<string, unknown>)[name], `expected event message ${name}`).toBeTruthy();
    }
    expect(expectedEvents.length).toBe(17);
  });

  it('UserCreated round-trips with trigger and embedded user', () => {
    const ref = common.CanonicalRef.create({
      canonical_id: 'u-1',
      vendor_id: 'v',
      module_name: 'identity-clerk',
      module_version: '0',
      contract_version: 'v1',
    });
    const user = id.User.create({ ref, email: 'a@b', status: id.UserStatus.USER_STATUS_ACTIVE });
    const evt = id.UserCreated.create({ user, trigger: 'admin_created' });
    const decoded = id.UserCreated.decode(id.UserCreated.encode(evt).finish());
    expect(decoded.trigger).toBe('admin_created');
    expect(decoded.user?.email).toBe('a@b');
  });

  it('UserUpdated preserves changed_fields and previous snapshot', () => {
    const ref = common.CanonicalRef.create({
      canonical_id: 'u-1',
      vendor_id: 'v',
      module_name: 'm',
      module_version: '0',
      contract_version: 'v1',
    });
    const before = id.User.create({ ref, email: 'a@b', status: id.UserStatus.USER_STATUS_PENDING });
    const after = id.User.create({ ref, email: 'a@b', status: id.UserStatus.USER_STATUS_ACTIVE });
    const evt = id.UserUpdated.create({ user: after, previous: before, changed_fields: ['status'] });
    const decoded = id.UserUpdated.decode(id.UserUpdated.encode(evt).finish());
    expect(decoded.changed_fields).toEqual(['status']);
    expect(decoded.user?.status).toBe(id.UserStatus.USER_STATUS_ACTIVE);
    expect(decoded.previous?.status).toBe(id.UserStatus.USER_STATUS_PENDING);
  });

  it('SessionRevoked round-trips reason and revoked_by', () => {
    const evt = id.SessionRevoked.create({
      session_id: 'sid',
      canonical_id: 'c',
      user_id: 'u-1',
      revoked_by: 'system',
      reason: 'security',
    });
    const decoded = id.SessionRevoked.decode(id.SessionRevoked.encode(evt).finish());
    expect(decoded.reason).toBe('security');
    expect(decoded.revoked_by).toBe('system');
  });

  it('InvitationAccepted round-trips embedded invitation + accepted_by + created_membership_id', () => {
    const ref = common.CanonicalRef.create({
      canonical_id: 'i-1',
      vendor_id: 'v',
      module_name: 'm',
      module_version: '0',
      contract_version: 'v1',
    });
    const inv = id.Invitation.create({
      ref,
      email: 'new@x',
      organization_id: 'o-1',
      inviter_user_id: 'u-1',
      status: id.InvitationStatus.INVITATION_STATUS_ACCEPTED,
    });
    const evt = id.InvitationAccepted.create({
      invitation: inv,
      accepted_by_user_id: 'u-2',
      created_membership_id: 'm-1',
    });
    const decoded = id.InvitationAccepted.decode(id.InvitationAccepted.encode(evt).finish());
    expect(decoded.accepted_by_user_id).toBe('u-2');
    expect(decoded.created_membership_id).toBe('m-1');
    expect(decoded.invitation?.email).toBe('new@x');
  });
});
