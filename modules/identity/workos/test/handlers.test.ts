import { describe, expect, it } from 'vitest';
import { proto } from '@rntme/contracts-identity-v1';
import { GRPC_STATUS_UNIMPLEMENTED, createWorkOSIdentityModule } from '../src/index.js';
import { GRPC_STATUS_INVALID_ARGUMENT } from '../src/errors.js';
import type { WorkOSIdentityAdapter } from '../src/adapter.js';

const id = proto.rntme.contracts.identity.v1;

function adapter(overrides: Partial<WorkOSIdentityAdapter> = {}): WorkOSIdentityAdapter {
  const base = {
    getUser: async (userId: string) => ({ id: userId, email: 'ada@example.com' }),
    listUsers: async () => ({ data: [{ id: 'user_1', email: 'ada@example.com' }], totalCount: 1 }),
    createUser: async () => ({ id: 'user_new', email: 'new@example.com' }),
    updateUser: async (params: { userId: string }) => ({ id: params.userId, email: 'updated@example.com' }),
    deleteUser: async (userId: string) => ({ id: userId, deleted: true }),
    getOrganization: async (organizationId: string) => ({ id: organizationId, name: 'Acme' }),
    listOrganizations: async () => ({ data: [{ id: 'org_1', name: 'Acme' }], totalCount: 1 }),
    createOrganization: async () => ({ id: 'org_new', name: 'Acme' }),
    updateOrganization: async (params: { organization: string }) => ({ id: params.organization, name: 'Acme Updated' }),
    deleteOrganization: async (organizationId: string) => ({ id: organizationId, deleted: true }),
    getOrganizationMembership: async (membershipId: string) => ({
      id: membershipId,
      userId: 'user_1',
      organizationId: 'org_1',
      roleSlug: 'member',
      status: 'active',
    }),
    listOrganizationMemberships: async () => ({ data: [], totalCount: 0 }),
    createOrganizationMembership: async () => ({ id: 'om_1', userId: 'user_1', organizationId: 'org_1', roleSlug: 'member' }),
    updateOrganizationMembership: async (membershipId: string) => ({ id: membershipId, userId: 'user_1', organizationId: 'org_1', roleSlug: 'admin' }),
    deleteOrganizationMembership: async (membershipId: string) => ({ id: membershipId, userId: 'user_1', organizationId: 'org_1', status: 'inactive' }),
    sendInvitation: async () => ({ id: 'inv_1', email: 'new@example.com', organizationId: 'org_1', state: 'pending' }),
    listInvitations: async () => ({ data: [], totalCount: 0 }),
    revokeInvitation: async (invitationId: string) => ({ id: invitationId, email: 'new@example.com', organizationId: 'org_1', state: 'revoked' }),
  } satisfies WorkOSIdentityAdapter;

  return { ...base, ...overrides };
}

describe('WorkOS identity handlers', () => {
  it('maps CreateUser fields to the official SDK adapter shape', async () => {
    const calls: unknown[] = [];
    const module = createWorkOSIdentityModule({
      adapter: adapter({
        createUser: async (params) => {
          calls.push(params);
          return { id: 'user_new', email: params.email, firstName: params.firstName, lastName: params.lastName, emailVerified: params.emailVerified };
        },
      }),
    });

    const user = await module.CreateUser(
      id.CreateUserRequest.create({
        context: { correlation_id: 'corr_1' },
        email: 'new@example.com',
        name: { given: 'New', family: 'User' },
        email_verified: true,
        metadata: { public: { fields: { plan: { stringValue: 'team' } } } },
      }),
    );

    expect(calls).toEqual([
      {
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        emailVerified: true,
        metadata: { plan: 'team' },
      },
    ]);
    expect(user.ref?.canonical_id).toBe('user_new');
    expect(user.email).toBe('new@example.com');
  });

  it('passes WorkOS organization creation idempotency options from CommandContext', async () => {
    const calls: unknown[] = [];
    const module = createWorkOSIdentityModule({
      adapter: adapter({
        createOrganization: async (params, options) => {
          calls.push({ params, options });
          return { id: 'org_new', name: params.name, metadata: params.metadata };
        },
      }),
    });

    await module.CreateOrganization(
      id.CreateOrganizationRequest.create({
        context: { idempotency_key: 'idem_1', correlation_id: 'corr_1' },
        name: 'Acme',
        metadata: { public: { fields: { plan: { stringValue: 'team' } } } },
      }),
    );

    expect(calls).toEqual([
      {
        params: { name: 'Acme', domainData: undefined, externalId: undefined, metadata: { plan: 'team' } },
        options: { idempotencyKey: 'idem_1' },
      },
    ]);
  });

  it('omits WorkOS organization creation request options when CommandContext has no idempotency key', async () => {
    const calls: unknown[] = [];
    const module = createWorkOSIdentityModule({
      adapter: adapter({
        createOrganization: async (params, options) => {
          calls.push({ params, options });
          return { id: 'org_new', name: params.name };
        },
      }),
    });

    await module.CreateOrganization(
      id.CreateOrganizationRequest.create({
        context: { correlation_id: 'corr_1' },
        name: 'Acme',
      }),
    );

    expect(calls).toEqual([
      {
        params: { name: 'Acme', domainData: undefined, externalId: undefined, metadata: undefined },
        options: undefined,
      },
    ]);
  });

  it('rejects WorkOS user and organization deletes unless hard_delete is explicitly true', async () => {
    const calls: string[] = [];
    const module = createWorkOSIdentityModule({
      adapter: adapter({
        deleteUser: async (userId) => {
          calls.push(`user:${userId}`);
          return { id: userId, deleted: true };
        },
        deleteOrganization: async (organizationId) => {
          calls.push(`organization:${organizationId}`);
          return { id: organizationId, deleted: true };
        },
      }),
    });

    await expect(module.DeleteUser(id.DeleteUserRequest.create({ canonical_id: 'user_1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_INVALID_ARGUMENT,
      canonicalCode: 'IDENTITY_VENDOR_INVALID_REQUEST',
    });
    await expect(module.DeleteOrganization(id.DeleteOrganizationRequest.create({ canonical_id: 'org_1', hard_delete: false }))).rejects.toMatchObject({
      code: GRPC_STATUS_INVALID_ARGUMENT,
      canonicalCode: 'IDENTITY_VENDOR_INVALID_REQUEST',
    });

    const deletedUser = await module.DeleteUser(id.DeleteUserRequest.create({ canonical_id: 'user_1', hard_delete: true }));
    const deletedOrganization = await module.DeleteOrganization(id.DeleteOrganizationRequest.create({ canonical_id: 'org_1', hard_delete: true }));

    expect(calls).toEqual(['user:user_1', 'organization:org_1']);
    expect(deletedUser.status).toBe(id.UserStatus.USER_STATUS_DELETED);
    expect(deletedOrganization.status).toBe(id.OrgStatus.ORG_STATUS_DELETED);
  });

  it('maps membership create, update, and remove using safe WorkOS membership ids', async () => {
    const calls: unknown[] = [];
    const module = createWorkOSIdentityModule({
      adapter: adapter({
        createOrganizationMembership: async (params) => {
          calls.push(['create', params]);
          return { id: 'om_new', userId: params.userId, organizationId: params.organizationId, roleSlug: params.roleSlug };
        },
        updateOrganizationMembership: async (membershipId, params) => {
          calls.push(['update', membershipId, params]);
          return { id: membershipId, userId: 'user_1', organizationId: 'org_1', roleSlug: params.roleSlug };
        },
        getOrganizationMembership: async (membershipId) => {
          calls.push(['get', membershipId]);
          return { id: membershipId, userId: 'user_1', organizationId: 'org_1', roleSlug: 'member', status: 'active' };
        },
        deleteOrganizationMembership: async (membershipId) => {
          calls.push(['delete', membershipId]);
          return { id: membershipId, status: 'inactive' };
        },
      }),
    });

    const created = await module.AddMembership(id.AddMembershipRequest.create({ user_id: 'user_1', organization_id: 'org_1', roles: ['admin'] }));
    const updated = await module.UpdateMembership(id.UpdateMembershipRequest.create({ canonical_id: 'om_new', roles: ['member'] }));
    const removed = await module.RemoveMembership(id.RemoveMembershipRequest.create({ canonical_id: 'om_new' }));

    expect(calls).toEqual([
      ['create', { userId: 'user_1', organizationId: 'org_1', roleSlug: 'admin' }],
      ['update', 'om_new', { roleSlug: 'member' }],
      ['get', 'om_new'],
      ['delete', 'om_new'],
    ]);
    expect(created.ref?.canonical_id).toBe('om_new');
    expect(updated.roles).toEqual(['member']);
    expect(removed.user_id).toBe('user_1');
    expect(removed.organization_id).toBe('org_1');
    expect(removed.status).toBe(id.MembershipStatus.MEMBERSHIP_STATUS_REVOKED);
  });

  it('maps multiple membership roles to WorkOS roleSlugs and omits role fields when creating without roles', async () => {
    const calls: unknown[] = [];
    const module = createWorkOSIdentityModule({
      adapter: adapter({
        createOrganizationMembership: async (params) => {
          calls.push(['create', params]);
          return { id: 'om_new', userId: params.userId, organizationId: params.organizationId, roleSlugs: params.roleSlugs, roleSlug: params.roleSlug };
        },
        updateOrganizationMembership: async (membershipId, params) => {
          calls.push(['update', membershipId, params]);
          return { id: membershipId, userId: 'user_1', organizationId: 'org_1', roleSlugs: params.roleSlugs, roleSlug: params.roleSlug };
        },
      }),
    });

    await module.AddMembership(id.AddMembershipRequest.create({ user_id: 'user_1', organization_id: 'org_1' }));
    const createdWithMany = await module.AddMembership(
      id.AddMembershipRequest.create({ user_id: 'user_2', organization_id: 'org_1', roles: ['admin', 'billing'] }),
    );
    const updatedWithMany = await module.UpdateMembership(id.UpdateMembershipRequest.create({ canonical_id: 'om_new', roles: ['member', 'auditor'] }));

    expect(calls).toEqual([
      ['create', { userId: 'user_1', organizationId: 'org_1' }],
      ['create', { userId: 'user_2', organizationId: 'org_1', roleSlugs: ['admin', 'billing'] }],
      ['update', 'om_new', { roleSlugs: ['member', 'auditor'] }],
    ]);
    expect(createdWithMany.roles).toEqual(['admin', 'billing']);
    expect(updatedWithMany.roles).toEqual(['member', 'auditor']);
  });

  it('requires getOrganizationMembership before removing a WorkOS membership', async () => {
    const calls: string[] = [];
    const unsupportedAdapter = adapter({
      deleteOrganizationMembership: async (membershipId) => {
        calls.push(membershipId);
        return { id: membershipId, status: 'inactive' };
      },
    });
    delete unsupportedAdapter.getOrganizationMembership;
    const module = createWorkOSIdentityModule({ adapter: unsupportedAdapter });

    await expect(module.RemoveMembership(id.RemoveMembershipRequest.create({ canonical_id: 'om_1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    expect(calls).toEqual([]);
  });

  it('rejects suspended membership filters because WorkOS inactive includes revoked memberships', async () => {
    const calls: unknown[] = [];
    const module = createWorkOSIdentityModule({
      adapter: adapter({
        listOrganizationMemberships: async (params) => {
          calls.push(params);
          return { data: [], totalCount: 0 };
        },
      }),
    });

    await expect(
      module.ListMemberships(
        id.ListMembershipsRequest.create({ organization_id: 'org_1', status: id.MembershipStatus.MEMBERSHIP_STATUS_SUSPENDED }),
      ),
    ).rejects.toMatchObject({
      code: GRPC_STATUS_INVALID_ARGUMENT,
      canonicalCode: 'IDENTITY_VENDOR_INVALID_REQUEST',
    });
    expect(calls).toEqual([]);
  });

  it('requires organization_id for organization-scoped WorkOS invitation list and create', async () => {
    const module = createWorkOSIdentityModule({ adapter: adapter() });

    await expect(module.ListInvitations(id.ListInvitationsRequest.create())).rejects.toMatchObject({
      code: 3,
      canonicalCode: 'IDENTITY_VENDOR_INVALID_REQUEST',
    });
    await expect(module.CreateInvitation(id.CreateInvitationRequest.create({ email: 'new@example.com' }))).rejects.toMatchObject({
      code: 3,
      canonicalCode: 'IDENTITY_VENDOR_INVALID_REQUEST',
    });
  });

  it('rejects invitation creation with multiple roles because WorkOS invitations accept one roleSlug', async () => {
    const calls: unknown[] = [];
    const module = createWorkOSIdentityModule({
      adapter: adapter({
        sendInvitation: async (params) => {
          calls.push(params);
          return { id: 'inv_1', email: params.email, organizationId: params.organizationId, roleSlug: params.roleSlug, state: 'pending' };
        },
      }),
    });

    await expect(
      module.CreateInvitation(
        id.CreateInvitationRequest.create({ email: 'new@example.com', organization_id: 'org_1', roles: ['admin', 'billing'] }),
      ),
    ).rejects.toMatchObject({
      code: GRPC_STATUS_INVALID_ARGUMENT,
      canonicalCode: 'IDENTITY_VENDOR_INVALID_REQUEST',
    });

    const invitation = await module.CreateInvitation(
      id.CreateInvitationRequest.create({ email: 'new@example.com', organization_id: 'org_1', roles: ['admin'] }),
    );

    expect(calls).toEqual([
      {
        organizationId: 'org_1',
        email: 'new@example.com',
        roleSlug: 'admin',
        expiresInDays: undefined,
        inviterUserId: undefined,
      },
    ]);
    expect(invitation.roles).toEqual(['admin']);
  });

  it('leaves session RPCs unsupported because WorkOS SDK does not expose canonical-safe equivalents', async () => {
    const module = createWorkOSIdentityModule({ adapter: adapter() });

    await expect(module.IntrospectSession(id.IntrospectSessionRequest.create({ token: 'session' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.RevokeSession(id.RevokeSessionRequest.create({ canonical_id: 'sess_1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
  });
});
