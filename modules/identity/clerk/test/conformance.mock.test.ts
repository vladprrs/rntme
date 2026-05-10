import { describe, expect, it } from 'bun:test';
import { identityConformanceSuite } from '@rntme/conformance-identity';
import { proto } from '@rntme/contracts-identity-v1';
import moduleManifest from '../module.json' with { type: 'json' };
import { GRPC_STATUS_UNIMPLEMENTED, createClerkIdentityModule } from '../src/index.js';
import type { ClerkIdentityAdapter } from '../src/adapter.js';

const id = proto.rntme.contracts.identity.v1;

const ALL_CANONICAL_RPCS = Object.keys(identityConformanceSuite.scenariosByRpc);

const fakeAdapter: ClerkIdentityAdapter = {
  getUser: async (userId) => ({ id: userId, emailAddresses: [] }),
  listUsers: async () => ({ data: [], totalCount: 0 }),
  createUser: async () => ({ id: 'user_new', emailAddresses: [] }),
  updateUserMetadata: async (userId) => ({ id: userId, emailAddresses: [] }),
  banUser: async (userId) => ({ id: userId, banned: true, emailAddresses: [] }),
  unbanUser: async (userId) => ({ id: userId, banned: false, emailAddresses: [] }),
  deleteUser: async (userId) => ({ id: userId, deleted: true }),
  getOrganization: async (organizationId) => ({ id: organizationId, name: 'Acme' }),
  listOrganizations: async () => ({ data: [], totalCount: 0 }),
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
  listOrganizationMemberships: async () => ({ data: [], totalCount: 0 }),
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
  getSession: async (sessionId) => ({ id: sessionId, userId: 'user_1', status: 'active' }),
  listSessions: async () => ({ data: [], totalCount: 0 }),
  revokeSession: async (sessionId) => ({ id: sessionId, userId: 'user_1', status: 'revoked' }),
  verifyToken: async () => ({ sub: 'user_1', sid: 'sess_1' }),
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
    case 'AddMembership':
      return id.AddMembershipRequest.create({ user_id: 'user_1', organization_id: 'org_1' });
    case 'UpdateMembership':
      return id.UpdateMembershipRequest.create({ canonical_id: 'mem_1' });
    case 'ListMemberships':
      return id.ListMembershipsRequest.create({ organization_id: 'org_1' });
    case 'CreateInvitation':
      return id.CreateInvitationRequest.create({ email: 'new@example.com', organization_id: 'org_1' });
    case 'RevokeInvitation':
      return id.RevokeInvitationRequest.create({ canonical_id: 'org_1:inv_1' });
    case 'GetSession':
      return id.GetSessionRequest.create({ canonical_id: 'sess_1' });
    case 'ListSessions':
      return id.ListSessionsRequest.create({ user_id: 'user_1' });
    case 'IntrospectSession':
      return id.IntrospectSessionRequest.create({ token: 'jwt' });
    case 'RevokeSession':
      return id.RevokeSessionRequest.create({ canonical_id: 'sess_1' });
    default:
      return {};
  }
}

describe('mock identity conformance wiring', () => {
  it('claims only RPCs present in the shared conformance suite', () => {
    expect(moduleManifest.capabilities.rpcs).not.toHaveLength(0);
    expect(moduleManifest.capabilities.rpcs).toEqual(expect.arrayContaining(['GetUser', 'CreateUser', 'IntrospectSession']));

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
    const module = createClerkIdentityModule({ adapter: fakeAdapter });

    for (const rpc of ALL_CANONICAL_RPCS) {
      if (moduleManifest.capabilities.rpcs.includes(rpc)) {
        continue;
      }

      const handler = module[rpc as keyof typeof module] as (request: unknown) => Promise<unknown>;
      await expect(handler(requestFor(rpc))).rejects.toMatchObject({ code: GRPC_STATUS_UNIMPLEMENTED });
    }
  });
});
