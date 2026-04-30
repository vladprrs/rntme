import { vi } from 'vitest';
import type { Auth0Adapter } from '../../src/adapter.js';

/** Shared Auth0 Management adapter stub for identity-auth0 handler tests. */
export function stubAuth0Adapter(overrides: Partial<Auth0Adapter> = {}): Auth0Adapter {
  return {
    getUser: vi.fn(async () => ({ user_id: 'auth0|u1', email: 'ada@example.com' })),
    listUsers: vi.fn(async () => ({ items: [{ user_id: 'auth0|u1', email: 'ada@example.com' }], total: 1, hasMore: false })),
    createUser: vi.fn(async () => ({ user_id: 'auth0|new', email: 'new@example.com' })),
    updateUser: vi.fn(async () => ({ user_id: 'auth0|u1', email: 'updated@example.com' })),
    deleteUser: vi.fn(async (id) => ({ user_id: id, email: 'deleted@example.com', blocked: true })),
    getOrganization: vi.fn(async () => ({ id: 'org_123', name: 'acme' })),
    listOrganizations: vi.fn(async () => ({ items: [], total: 0, hasMore: false })),
    createOrganization: vi.fn(async () => ({ id: 'org_new', name: 'new-org' })),
    updateOrganization: vi.fn(async () => ({ id: 'org_123', name: 'updated-org' })),
    deleteOrganization: vi.fn(async (id) => ({ id, name: 'deleted-org' })),
    listMemberships: vi.fn(async () => ({ items: [], total: 0, hasMore: false })),
    addMembership: vi.fn(async () => ({ organization_id: 'org_123', user_id: 'auth0|u1', roles: ['rol_admin'] })),
    removeMembership: vi.fn(async () => ({ organization_id: 'org_123', user_id: 'auth0|u1', roles: [] })),
    createInvitation: vi.fn(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' } })),
    listInvitations: vi.fn(async () => ({ items: [], total: 0, hasMore: false })),
    getInvitation: vi.fn(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' } })),
    revokeInvitation: vi.fn(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' }, revoked: true })),
    ...overrides,
  };
}
