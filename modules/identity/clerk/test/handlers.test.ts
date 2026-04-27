import { describe, expect, it } from 'vitest';
import { proto } from '@rntme/contracts-identity-v1';
import {
  CLERK_SUPPORTED_RPCS,
  GRPC_STATUS_UNIMPLEMENTED,
  createClerkIdentityModule,
  isClerkIdentityError,
} from '../src/index.js';
import type { ClerkIdentityAdapter } from '../src/adapter.js';

const id = proto.rntme.contracts.identity.v1;

function adapter(overrides: Partial<ClerkIdentityAdapter> = {}): ClerkIdentityAdapter {
  const base = {
    getUser: async (userId: string) => ({ id: userId, emailAddresses: [] }),
    listUsers: async () => ({ data: [{ id: 'user_1', emailAddresses: [] }], totalCount: 1 }),
    createUser: async () => ({ id: 'user_new', emailAddresses: [] }),
    updateUserMetadata: async (userId: string) => ({ id: userId, emailAddresses: [] }),
    banUser: async (userId: string) => ({ id: userId, banned: true, emailAddresses: [] }),
    unbanUser: async (userId: string) => ({ id: userId, banned: false, emailAddresses: [] }),
    deleteUser: async (userId: string) => ({ id: userId, deleted: true }),
    getOrganization: async (organizationId: string) => ({ id: organizationId, name: 'Acme' }),
    listOrganizations: async () => ({ data: [{ id: 'org_1', name: 'Acme' }], totalCount: 1 }),
    createOrganization: async () => ({ id: 'org_new', name: 'Acme' }),
    createOrganizationMembership: async () => ({
      id: 'mem_1',
      publicUserData: { userId: 'user_1' },
      organization: { id: 'org_1' },
      role: 'org:member',
    }),
    updateOrganizationMembership: async () => ({
      id: 'mem_1',
      publicUserData: { userId: 'user_1' },
      organization: { id: 'org_1' },
      role: 'org:admin',
    }),
    listOrganizationMemberships: async () => ({
      data: [{ id: 'mem_1', publicUserData: { userId: 'user_1' }, organization: { id: 'org_1' }, role: 'org:member' }],
      totalCount: 1,
    }),
    createOrganizationInvitation: async () => ({
      id: 'inv_1',
      emailAddress: 'new@example.com',
      organizationId: 'org_1',
      role: 'org:member',
      status: 'pending',
    }),
    revokeOrganizationInvitation: async () => ({
      id: 'inv_1',
      emailAddress: 'new@example.com',
      organizationId: 'org_1',
      role: 'org:member',
      status: 'revoked',
    }),
    getSession: async (sessionId: string) => ({ id: sessionId, userId: 'user_1', status: 'active' }),
    listSessions: async () => ({ data: [{ id: 'sess_1', userId: 'user_1', status: 'active' }], totalCount: 1 }),
    revokeSession: async (sessionId: string) => ({ id: sessionId, userId: 'user_1', status: 'revoked' }),
    verifyToken: async () => ({ sub: 'user_1', sid: 'sess_1', org_id: 'org_1' }),
  } satisfies ClerkIdentityAdapter;

  return { ...base, ...overrides };
}

describe('Clerk identity handlers', () => {
  it('calls the adapter and maps CreateUser to a canonical user', async () => {
    const calls: unknown[] = [];
    const module = createClerkIdentityModule({
      adapter: adapter({
        createUser: async (params) => {
          calls.push(params);
          return { id: 'user_new', emailAddresses: [{ id: 'email_1', emailAddress: 'new@example.com' }] };
        },
      }),
    });

    const user = await module.CreateUser(
      id.CreateUserRequest.create({
        context: { idempotency_key: 'idem_1', correlation_id: 'corr_1' },
        email: 'new@example.com',
        name: { given: 'New', family: 'User', display: 'New User' },
        email_verified: true,
      }),
    );

    expect(calls).toEqual([
      {
        emailAddress: ['new@example.com'],
        phoneNumber: undefined,
        firstName: 'New',
        lastName: 'User',
        publicMetadata: undefined,
        privateMetadata: undefined,
        unsafeMetadata: undefined,
      },
    ]);
    expect(user.ref?.canonical_id).toBe('user_new');
    expect(user.email).toBe('new@example.com');
  });

  it('passes supported Clerk user create fields from canonical input', async () => {
    const calls: unknown[] = [];
    const module = createClerkIdentityModule({
      adapter: adapter({
        createUser: async (params) => {
          calls.push(params);
          return {
            id: 'user_phone',
            emailAddresses: [{ id: 'email_1', emailAddress: 'phone@example.com' }],
            phoneNumbers: [{ id: 'phone_1', phoneNumber: '+15555550100' }],
            primaryPhoneNumberId: 'phone_1',
          };
        },
      }),
    });

    await module.CreateUser(
      id.CreateUserRequest.create({
        email: 'phone@example.com',
        phone: '+15555550100',
        name: { given: 'Phone', family: 'User' },
      }),
    );

    expect(calls).toEqual([
      expect.objectContaining({
        emailAddress: ['phone@example.com'],
        phoneNumber: ['+15555550100'],
      }),
    ]);
  });

  it('passes canonical metadata to Clerk as plain JSON metadata', async () => {
    const calls: unknown[] = [];
    const module = createClerkIdentityModule({
      adapter: adapter({
        createOrganization: async (params) => {
          calls.push(params);
          return { id: 'org_new', name: 'Acme' };
        },
      }),
    });

    await module.CreateOrganization(
      id.CreateOrganizationRequest.create({
        context: { actor_user_id: 'user_actor' },
        name: 'Acme',
        metadata: {
          public: { fields: { plan: { stringValue: 'team' } } },
          private: { fields: { billingId: { stringValue: 'cus_1' } } },
        },
      }),
    );

    expect(calls).toEqual([
      expect.objectContaining({
        createdBy: 'user_actor',
        publicMetadata: { plan: 'team' },
        privateMetadata: { billingId: 'cus_1' },
      }),
    ]);
  });

  it('maps invitation context and expiry to supported Clerk invitation fields', async () => {
    const calls: unknown[] = [];
    const module = createClerkIdentityModule({
      adapter: adapter({
        createOrganizationInvitation: async (params) => {
          calls.push(params);
          return {
            id: 'inv_1',
            emailAddress: 'invite@example.com',
            organizationId: 'org_1',
            status: 'pending',
          };
        },
      }),
    });
    const expiresAtSeconds = Math.ceil((Date.now() + 2 * 24 * 60 * 60 * 1000) / 1000);

    await module.CreateInvitation(
      id.CreateInvitationRequest.create({
        context: { actor_user_id: 'user_actor' },
        organization_id: 'org_1',
        email: 'invite@example.com',
        expires_at: { seconds: expiresAtSeconds, nanos: 0 },
      }),
    );

    expect(calls).toEqual([
      expect.objectContaining({
        inviterUserId: 'user_actor',
        expiresInDays: expect.any(Number),
      }),
    ]);
  });

  it('applies canonical membership metadata through Clerk membership metadata updates', async () => {
    const calls: unknown[] = [];
    const module = createClerkIdentityModule({
      adapter: adapter({
        updateOrganizationMembershipMetadata: async (params) => {
          calls.push(params);
          return {
            id: 'mem_1',
            publicUserData: { userId: 'user_1' },
            organization: { id: 'org_1' },
            role: 'org:member',
          };
        },
      }),
    });

    await module.AddMembership(
      id.AddMembershipRequest.create({
        user_id: 'user_1',
        organization_id: 'org_1',
        metadata: {
          public: { fields: { team: { stringValue: 'platform' } } },
          private: { fields: { syncId: { stringValue: 'mem_ext_1' } } },
        },
      }),
    );

    expect(calls).toEqual([
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'user_1',
        publicMetadata: { team: 'platform' },
        privateMetadata: { syncId: 'mem_ext_1' },
      }),
    ]);
  });

  it('does not reset membership role when UpdateMembership only changes metadata', async () => {
    const roleUpdates: unknown[] = [];
    const metadataUpdates: unknown[] = [];
    const module = createClerkIdentityModule({
      adapter: adapter({
        updateOrganizationMembership: async (params) => {
          roleUpdates.push(params);
          return {
            id: 'mem_1',
            publicUserData: { userId: 'user_1' },
            organization: { id: 'org_1' },
            role: 'org:admin',
          };
        },
        updateOrganizationMembershipMetadata: async (params) => {
          metadataUpdates.push(params);
          return {
            id: 'mem_1',
            publicUserData: { userId: 'user_1' },
            organization: { id: 'org_1' },
            role: 'org:admin',
          };
        },
      }),
    });

    await module.UpdateMembership(
      id.UpdateMembershipRequest.create({
        canonical_id: 'org_1:user_1',
        metadata: {
          public: { fields: { team: { stringValue: 'platform' } } },
        },
      }),
    );

    expect(roleUpdates).toEqual([]);
    expect(metadataUpdates).toHaveLength(1);
  });

  it('rejects empty membership updates instead of fabricating success', async () => {
    const module = createClerkIdentityModule({ adapter: adapter() });

    await expect(module.UpdateMembership(id.UpdateMembershipRequest.create({ canonical_id: 'org_1:user_1' }))).rejects.toMatchObject({
      code: 3,
    });
  });

  it('filters canonical list statuses and reports filtered totals', async () => {
    const module = createClerkIdentityModule({
      adapter: adapter({
        listUsers: async () => ({
          data: [
            { id: 'user_active', emailAddresses: [] },
            { id: 'user_blocked', banned: true, emailAddresses: [] },
          ],
          totalCount: 2,
        }),
      }),
    });

    const result = await module.ListUsers(id.ListUsersRequest.create({ status: id.UserStatus.USER_STATUS_BLOCKED, base: { limit: 10 } }));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.ref?.canonical_id).toBe('user_blocked');
    expect(result.meta?.total_count).toBe(1);
  });

  it('preserves vendor pagination metadata for unfiltered lists', async () => {
    const module = createClerkIdentityModule({
      adapter: adapter({
        listUsers: async () => ({
          data: [{ id: 'user_1', emailAddresses: [] }],
          totalCount: 25,
        }),
      }),
    });

    const result = await module.ListUsers(id.ListUsersRequest.create({ base: { limit: 10 } }));

    expect(result.items).toHaveLength(1);
    expect(result.meta?.total_count).toBe(25);
    expect(result.meta?.has_more).toBe(true);
  });

  it('rejects already-expired invitations instead of extending expiry', async () => {
    const module = createClerkIdentityModule({ adapter: adapter() });

    await expect(
      module.CreateInvitation(
        id.CreateInvitationRequest.create({
          organization_id: 'org_1',
          email: 'expired@example.com',
          expires_at: { seconds: 1, nanos: 0 },
        }),
      ),
    ).rejects.toMatchObject({ code: 3 });
  });

  it('returns UNIMPLEMENTED for canonical RPCs not claimed by Clerk', async () => {
    const module = createClerkIdentityModule({ adapter: adapter() });

    await expect(module.GetInvitation(id.GetInvitationRequest.create({ canonical_id: 'inv_1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    expect(CLERK_SUPPORTED_RPCS).not.toContain('GetInvitation');
  });

  it('maps Clerk not found errors to canonical gRPC-style errors', async () => {
    const module = createClerkIdentityModule({
      adapter: adapter({
        getUser: async () => {
          const error = new Error('not found') as Error & { status?: number };
          error.status = 404;
          throw error;
        },
      }),
    });

    await expect(module.GetUser(id.GetUserRequest.create({ canonical_id: 'missing' }))).rejects.toMatchObject({
      code: 5,
      canonicalCode: 'IDENTITY_REFERENCES_USER_NOT_FOUND',
    });
  });

  it('narrows module errors with isClerkIdentityError', async () => {
    const module = createClerkIdentityModule({ adapter: adapter() });

    try {
      await module.ResolveIdentity(id.ResolveIdentityRequest.create({ input_value: 'ada@example.com' }));
      throw new Error('expected failure');
    } catch (error) {
      expect(isClerkIdentityError(error)).toBe(true);
    }
  });
});
