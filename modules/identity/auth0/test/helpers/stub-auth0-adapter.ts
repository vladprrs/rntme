import { mock } from 'bun:test';
import type { Auth0Adapter } from '../../src/adapter.js';

/** Shared Auth0 Management adapter stub for identity-auth0 handler tests. */
export function stubAuth0Adapter(overrides: Partial<Auth0Adapter> = {}): Auth0Adapter {
  return {
    getUser: mock(async () => ({ user_id: 'auth0|u1', email: 'ada@example.com' })),
    listUsers: mock(async () => ({ items: [{ user_id: 'auth0|u1', email: 'ada@example.com' }], total: 1, hasMore: false })),
    createUser: mock(async () => ({ user_id: 'auth0|new', email: 'new@example.com' })),
    updateUser: mock(async () => ({ user_id: 'auth0|u1', email: 'updated@example.com' })),
    deleteUser: mock(async (id) => ({ user_id: id, email: 'deleted@example.com', blocked: true })),
    getOrganization: mock(async () => ({ id: 'org_123', name: 'acme' })),
    listOrganizations: mock(async () => ({ items: [], total: 0, hasMore: false })),
    createOrganization: mock(async () => ({ id: 'org_new', name: 'new-org' })),
    updateOrganization: mock(async () => ({ id: 'org_123', name: 'updated-org' })),
    deleteOrganization: mock(async (id) => ({ id, name: 'deleted-org' })),
    listMemberships: mock(async () => ({ items: [], total: 0, hasMore: false })),
    addMembership: mock(async () => ({ organization_id: 'org_123', user_id: 'auth0|u1', roles: ['rol_admin'] })),
    removeMembership: mock(async () => ({ organization_id: 'org_123', user_id: 'auth0|u1', roles: [] })),
    createInvitation: mock(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' } })),
    listInvitations: mock(async () => ({ items: [], total: 0, hasMore: false })),
    getInvitation: mock(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' } })),
    revokeInvitation: mock(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' }, revoked: true })),
    ...overrides,
  };
}
