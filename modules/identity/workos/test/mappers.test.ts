import { describe, expect, it } from 'bun:test';
import { proto } from '@rntme/contracts-identity-v1';
import { mapWorkOSInvitation, mapWorkOSMembership, mapWorkOSOrganization, mapWorkOSUser, toMetadata } from '../src/mappers.js';

const id = proto.rntme.contracts.identity.v1;

describe('WorkOS identity mappers', () => {
  it('maps a WorkOS user into canonical User fields', () => {
    const user = mapWorkOSUser({
      id: 'user_123',
      email: 'ada@example.com',
      emailVerified: true,
      firstName: 'Ada',
      lastName: 'Lovelace',
      profilePictureUrl: 'https://img.example/ada.png',
      metadata: { tier: 'pro' },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });

    expect(user.ref?.canonical_id).toBe('user_123');
    expect(user.ref?.module_name).toBe('@rntme/identity-workos');
    expect(user.email).toBe('ada@example.com');
    expect(user.email_verified).toBe(true);
    expect(user.name?.given).toBe('Ada');
    expect(user.name?.display).toBe('Ada Lovelace');
    expect(user.status).toBe(id.UserStatus.USER_STATUS_ACTIVE);
    expect(user.metadata?.public?.fields?.tier?.stringValue).toBe('pro');
    expect(user.created_at?.seconds?.toString()).toBe('1704067200');
  });

  it('maps WorkOS organizations, memberships, and invitations into canonical refs and statuses', () => {
    const organization = mapWorkOSOrganization({
      id: 'org_123',
      name: 'Acme',
      domains: [{ domain: 'acme.example' }],
      metadata: { plan: 'team' },
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    const membership = mapWorkOSMembership({
      id: 'om_123',
      userId: 'user_123',
      organizationId: 'org_123',
      role: { slug: 'admin' },
      status: 'active',
    });
    const invitation = mapWorkOSInvitation({
      id: 'inv_123',
      email: 'new@example.com',
      organizationId: 'org_123',
      roleSlug: 'member',
      state: 'pending',
    });

    expect(organization.ref?.canonical_id).toBe('org_123');
    expect(organization.slug).toBe('acme.example');
    expect(membership.ref?.canonical_id).toBe('om_123');
    expect(membership.roles).toEqual(['admin']);
    expect(membership.status).toBe(id.MembershipStatus.MEMBERSHIP_STATUS_ACTIVE);
    expect(invitation.ref?.canonical_id).toBe('inv_123');
    expect(invitation.roles).toEqual(['member']);
    expect(invitation.status).toBe(id.InvitationStatus.INVITATION_STATUS_PENDING);
  });

  it('converts WorkOS metadata to the canonical public metadata level', () => {
    const metadata = toMetadata({ metadata: { account: 'acct_1', seats: 5 } });

    expect(metadata.public?.fields?.account?.stringValue).toBe('acct_1');
    expect(metadata.public?.fields?.seats?.numberValue).toBe(5);
    expect(metadata.private?.fields).toEqual({});
  });
});
