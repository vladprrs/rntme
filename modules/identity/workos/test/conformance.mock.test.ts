import { describe, expect, it } from 'vitest';
import { identityConformanceSuite } from '@rntme/conformance-identity';
import { proto } from '@rntme/contracts-identity-v1';
import moduleManifest from '../module.json' with { type: 'json' };
import { GRPC_STATUS_UNIMPLEMENTED, createWorkOSIdentityModule } from '../src/index.js';
import type { WorkOSIdentityAdapter } from '../src/adapter.js';

const id = proto.rntme.contracts.identity.v1;

const ALL_CANONICAL_RPCS = Object.keys(identityConformanceSuite.scenariosByRpc);

const fakeAdapter: WorkOSIdentityAdapter = {
  getUser: async (userId) => ({ id: userId, email: 'ada@example.com' }),
  listUsers: async () => ({ data: [], totalCount: 0 }),
  createUser: async () => ({ id: 'user_new', email: 'new@example.com' }),
  updateUser: async (params) => ({ id: params.userId, email: 'updated@example.com' }),
  deleteUser: async (userId) => ({ id: userId, deleted: true }),
  getOrganization: async (organizationId) => ({ id: organizationId, name: 'Acme' }),
  listOrganizations: async () => ({ data: [], totalCount: 0 }),
  createOrganization: async () => ({ id: 'org_new', name: 'Acme' }),
  updateOrganization: async (params) => ({ id: params.organization, name: 'Acme Updated' }),
  deleteOrganization: async (organizationId) => ({ id: organizationId, deleted: true }),
  listOrganizationMemberships: async () => ({ data: [], totalCount: 0 }),
  createOrganizationMembership: async () => ({ id: 'om_1', userId: 'user_1', organizationId: 'org_1', roleSlug: 'member' }),
  updateOrganizationMembership: async (membershipId) => ({ id: membershipId, userId: 'user_1', organizationId: 'org_1', roleSlug: 'admin' }),
  deleteOrganizationMembership: async (membershipId) => ({ id: membershipId, userId: 'user_1', organizationId: 'org_1', status: 'inactive' }),
  sendInvitation: async () => ({ id: 'inv_1', email: 'new@example.com', organizationId: 'org_1', state: 'pending' }),
  listInvitations: async () => ({ data: [], totalCount: 0 }),
  revokeInvitation: async (invitationId) => ({ id: invitationId, email: 'new@example.com', organizationId: 'org_1', state: 'revoked' }),
};

function requestFor(rpc: string): unknown {
  switch (rpc) {
    case 'GetUser':
      return id.GetUserRequest.create({ canonical_id: 'user_1' });
    case 'ListUsers':
      return id.ListUsersRequest.create();
    case 'CreateUser':
      return id.CreateUserRequest.create({ email: 'new@example.com' });
    case 'UpdateUser':
      return id.UpdateUserRequest.create({ canonical_id: 'user_1' });
    case 'DeleteUser':
      return id.DeleteUserRequest.create({ canonical_id: 'user_1' });
    case 'GetOrganization':
      return id.GetOrganizationRequest.create({ canonical_id: 'org_1' });
    case 'ListOrganizations':
      return id.ListOrganizationsRequest.create();
    case 'CreateOrganization':
      return id.CreateOrganizationRequest.create({ name: 'Acme' });
    case 'UpdateOrganization':
      return id.UpdateOrganizationRequest.create({ canonical_id: 'org_1', name: 'Acme Updated' });
    case 'DeleteOrganization':
      return id.DeleteOrganizationRequest.create({ canonical_id: 'org_1' });
    case 'AddMembership':
      return id.AddMembershipRequest.create({ user_id: 'user_1', organization_id: 'org_1' });
    case 'UpdateMembership':
      return id.UpdateMembershipRequest.create({ canonical_id: 'om_1', roles: ['admin'] });
    case 'RemoveMembership':
      return id.RemoveMembershipRequest.create({ canonical_id: 'om_1' });
    case 'ListMemberships':
      return id.ListMembershipsRequest.create({ organization_id: 'org_1' });
    case 'CreateInvitation':
      return id.CreateInvitationRequest.create({ email: 'new@example.com', organization_id: 'org_1' });
    case 'ListInvitations':
      return id.ListInvitationsRequest.create({ organization_id: 'org_1' });
    case 'RevokeInvitation':
      return id.RevokeInvitationRequest.create({ canonical_id: 'inv_1' });
    default:
      return {};
  }
}

describe('mock identity conformance wiring', () => {
  it('claims only RPCs present in the shared conformance suite', () => {
    expect(moduleManifest.capabilities.rpcs).not.toHaveLength(0);
    expect(moduleManifest.capabilities.rpcs).toEqual(expect.arrayContaining(['GetUser', 'CreateUser', 'ListInvitations']));
    expect(moduleManifest.capabilities.rpcs).not.toContain('IntrospectSession');
    expect(moduleManifest.capabilities.rpcs).not.toContain('RevokeSession');

    for (const rpc of moduleManifest.capabilities.rpcs) {
      expect(ALL_CANONICAL_RPCS).toContain(rpc);
    }
  });

  it('filters shared conformance scenarios by claimed module capabilities', async () => {
    const context = { idempotencyKey: 'mock_idem_1', correlationId: 'mock_corr_1' };
    const claimedScenarios = Object.entries(identityConformanceSuite.scenariosByRpc).flatMap(([rpc, scenarios]) =>
      moduleManifest.capabilities.rpcs.includes(rpc) ? [...scenarios] : [],
    );

    for (const scenario of claimedScenarios) {
      await scenario.seed?.();
      const result = await scenario.action(context);
      for (const assertion of scenario.assertions) {
        await assertion(result, context);
      }
    }

    expect(claimedScenarios).toHaveLength(0);
  });

  it('returns UNIMPLEMENTED for every unsupported canonical RPC', async () => {
    const module = createWorkOSIdentityModule({ adapter: fakeAdapter });

    for (const rpc of ALL_CANONICAL_RPCS) {
      if (moduleManifest.capabilities.rpcs.includes(rpc)) {
        continue;
      }

      const handler = module[rpc as keyof typeof module] as (request: unknown) => Promise<unknown>;
      await expect(handler(requestFor(rpc))).rejects.toMatchObject({ code: GRPC_STATUS_UNIMPLEMENTED });
    }
  });
});
