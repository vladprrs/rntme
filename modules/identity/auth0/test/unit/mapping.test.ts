import { describe, expect, it } from 'vitest';
import {
  InvitationStatus,
  MembershipStatus,
  OrgStatus,
  ResolutionInputType,
  UserStatus,
} from '@rntme/contracts-identity-v1';
import {
  mapAuth0Invitation,
  mapAuth0Membership,
  mapAuth0Organization,
  mapAuth0User,
  metadataToAuth0,
  parseCompositeId,
  toIdentityResolution,
} from '../../src/mapping.js';
import { GrpcStatus } from '../../src/errors.js';

describe('Auth0 canonical mapping', () => {
  it('maps user identity, status, timestamps, and split metadata', () => {
    const user = mapAuth0User({
      user_id: 'auth0|u1',
      email: 'ada@example.com',
      email_verified: true,
      given_name: 'Ada',
      family_name: 'Lovelace',
      name: 'Ada Lovelace',
      phone_number: '+15551234567',
      phone_verified: false,
      picture: 'https://example.test/a.png',
      blocked: true,
      created_at: '2026-01-02T03:04:05.000Z',
      updated_at: '2026-01-03T03:04:05.000Z',
      last_login: '2026-01-04T03:04:05.000Z',
      user_metadata: { tier: 'public' },
      app_metadata: { crmId: 'private' },
    });

    expect(user.ref?.canonical_id).toBe('auth0|u1');
    expect(user.ref?.module_name).toBe('@rntme/identity-auth0');
    expect(user.email).toBe('ada@example.com');
    expect(user.status).toBe(UserStatus.USER_STATUS_BLOCKED);
    expect(user.metadata?.public?.fields?.tier?.stringValue).toBe('public');
    expect(user.metadata?.private?.fields?.crmId?.stringValue).toBe('private');
    expect(user.created_at?.seconds?.toString()).toBe('1767323045');
  });

  it('maps organizations, memberships, invitations, and resolution', () => {
    const organization = mapAuth0Organization({
      id: 'org_123',
      name: 'acme',
      display_name: 'Acme Inc',
      branding: { logo_url: 'https://example.test/logo.png' },
      metadata: { max_members: '25', color: 'blue' },
    });
    const membership = mapAuth0Membership({
      organization_id: 'org_123',
      user_id: 'auth0|u1',
      roles: ['rol_admin'],
    });
    const invitation = mapAuth0Invitation({
      id: 'inv_123',
      organization_id: 'org_123',
      invitee: { email: 'ada@example.com' },
      inviter: { user_id: 'auth0|owner' },
      roles: ['rol_admin'],
      expires_at: '2099-02-01T00:00:00.000Z',
    });
    const resolution = toIdentityResolution(organization, 'organization', ResolutionInputType.RESOLUTION_INPUT_TYPE_VENDOR_ID, 'org_123');

    expect(organization.ref?.canonical_id).toBe('org_123');
    expect(organization.status).toBe(OrgStatus.ORG_STATUS_ACTIVE);
    expect(organization.max_members).toBe(25);
    expect(membership.ref?.canonical_id).toBe('org_123:auth0|u1');
    expect(membership.status).toBe(MembershipStatus.MEMBERSHIP_STATUS_ACTIVE);
    expect(invitation.status).toBe(InvitationStatus.INVITATION_STATUS_PENDING);
    expect(resolution.exists).toBe(true);
    expect(resolution.canonical_id).toBe('org_123');
  });

  it('maps accepted and expired invitation statuses', () => {
    expect(
      mapAuth0Invitation({
        id: 'inv_accepted',
        organization_id: 'org_123',
        invitee: { email: 'ada@example.com' },
        accepted_at: '2026-01-01T00:00:00.000Z',
      }).status,
    ).toBe(InvitationStatus.INVITATION_STATUS_ACCEPTED);

    expect(
      mapAuth0Invitation({
        id: 'inv_expired',
        organization_id: 'org_123',
        invitee: { email: 'ada@example.com' },
        expires_at: '2000-01-01T00:00:00.000Z',
      }).status,
    ).toBe(InvitationStatus.INVITATION_STATUS_EXPIRED);
  });

  it('converts canonical metadata to Auth0 user_metadata and app_metadata', () => {
    const metadata = metadataToAuth0({
      public: { fields: { theme: { stringValue: 'dark' } } },
      private: { fields: { plan: { stringValue: 'team' } } },
    });

    expect(metadata).toEqual({
      user_metadata: { theme: 'dark' },
      app_metadata: { plan: 'team' },
    });
  });

  it('maps deleted user and organization sentinels honestly', () => {
    expect(mapAuth0User({ user_id: 'auth0|u1', deleted: true, deleted_at: '2026-01-02T03:04:05.000Z' })).toMatchObject({
      status: UserStatus.USER_STATUS_DELETED,
      deleted_at: { seconds: 1767323045, nanos: 0 },
    });
    expect(mapAuth0Organization({ id: 'org_123', deleted: true, deleted_at: '2026-01-02T03:04:05.000Z' })).toMatchObject({
      status: OrgStatus.ORG_STATUS_DELETED,
      deleted_at: { seconds: 1767323045, nanos: 0 },
    });
  });

  it('preserves Date metadata and non-finite numbers as string values', () => {
    const user = mapAuth0User({
      user_id: 'auth0|u1',
      user_metadata: {
        visited_at: new Date('2026-01-02T03:04:05.000Z'),
        score: Number.POSITIVE_INFINITY,
      },
    });

    expect(user.metadata?.public?.fields?.visited_at?.stringValue).toBe('2026-01-02T03:04:05.000Z');
    expect(user.metadata?.public?.fields?.score?.stringValue).toBe('Infinity');
  });

  it('rejects malformed composite ids before they reach Auth0', () => {
    expect(() => parseCompositeId('org_123:inv_123')).not.toThrow();
    expect(() => parseCompositeId('org_123:')).toThrow(expect.objectContaining({ code: GrpcStatus.INVALID_ARGUMENT }));
    expect(() => parseCompositeId(':inv_123')).toThrow(expect.objectContaining({ code: GrpcStatus.INVALID_ARGUMENT }));
  });
});
