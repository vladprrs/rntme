import { describe, expect, it } from 'vitest';
import { proto } from '@rntme/contracts-identity-v1';
import { mapClerkMembership, mapClerkOrganization, mapClerkSession, mapClerkUser, toMetadata } from '../src/mappers.js';

const id = proto.rntme.contracts.identity.v1;

describe('Clerk identity mappers', () => {
  it('maps a Clerk user into canonical User fields', () => {
    const user = mapClerkUser({
      id: 'user_123',
      primaryEmailAddressId: 'email_1',
      emailAddresses: [{ id: 'email_1', emailAddress: 'ada@example.com', verification: { status: 'verified' } }],
      primaryPhoneNumberId: 'phone_1',
      phoneNumbers: [{ id: 'phone_1', phoneNumber: '+15550001111', verification: { status: 'verified' } }],
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      imageUrl: 'https://img.example/ada.png',
      banned: false,
      locked: false,
      publicMetadata: { tier: 'pro' },
      privateMetadata: { crmId: 'c_1' },
      unsafeMetadata: { draft: true },
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_001_000,
      lastSignInAt: 1_700_000_002_000,
    });

    expect(user.ref?.canonical_id).toBe('user_123');
    expect(user.ref?.vendor_id).toBe('user_123');
    expect(user.email).toBe('ada@example.com');
    expect(user.email_verified).toBe(true);
    expect(user.phone_verified).toBe(true);
    expect(user.status).toBe(id.UserStatus.USER_STATUS_ACTIVE);
    expect(user.name?.display).toBe('Ada Lovelace');
    expect(user.metadata?.public?.fields?.tier?.stringValue).toBe('pro');
    expect(user.last_sign_in_at?.seconds?.toString()).toBe('1700000002');
  });

  it('maps banned Clerk users to canonical blocked status', () => {
    const user = mapClerkUser({ id: 'user_blocked', banned: true });

    expect(user.status).toBe(id.UserStatus.USER_STATUS_BLOCKED);
  });

  it('maps organizations and sessions into canonical refs and statuses', () => {
    const organization = mapClerkOrganization({
      id: 'org_123',
      name: 'Acme',
      slug: 'acme',
      imageUrl: 'https://img.example/acme.png',
      publicMetadata: { region: 'eu' },
      maxAllowedMemberships: 25,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_001_000,
    });
    const session = mapClerkSession({
      id: 'sess_123',
      userId: 'user_123',
      status: 'active',
      lastActiveOrganizationId: 'org_123',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_003_000,
      expireAt: 1_700_086_400_000,
    });

    expect(organization.ref?.canonical_id).toBe('org_123');
    expect(organization.max_members).toBe(25);
    expect(session.ref?.canonical_id).toBe('sess_123');
    expect(session.status).toBe(id.SessionStatus.SESSION_STATUS_ACTIVE);
    expect(session.token_type).toBe(id.TokenType.TOKEN_TYPE_OPAQUE_SESSION);
  });

  it('converts three-level metadata to protobuf Structs', () => {
    const metadata = toMetadata({
      publicMetadata: { plan: 'team' },
      privateMetadata: { internal: 1 },
      unsafeMetadata: { scratch: false },
    });

    expect(metadata.public?.fields?.plan?.stringValue).toBe('team');
    expect(metadata.private?.fields?.internal?.numberValue).toBe(1);
    expect(metadata.unsafe?.fields?.scratch?.boolValue).toBe(false);
  });

  it('maps snake_case Clerk organization membership webhook payloads', () => {
    const membership = mapClerkMembership({
      id: 'mem_2',
      organization_id: 'org_2',
      public_user_data: { user_id: 'user_2' },
      role: 'org:admin',
    });

    expect(membership.organization_id).toBe('org_2');
    expect(membership.user_id).toBe('user_2');
    expect(membership.ref?.canonical_id).toBe('org_2:user_2');
  });

  it('maps Clerk membership permissions', () => {
    const membership = mapClerkMembership({
      id: 'mem_3',
      organizationId: 'org_3',
      publicUserData: { userId: 'user_3' },
      role: 'org:admin',
      permissions: ['org:memberships:manage', 'org:billing:read'],
    });

    expect(membership.permissions).toEqual(['org:memberships:manage', 'org:billing:read']);
  });
});
