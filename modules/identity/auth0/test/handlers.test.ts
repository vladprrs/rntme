import { describe, expect, it, vi } from 'vitest';
import { ResolutionInputType } from '@rntme/contracts-identity-v1';
import { createAuth0IdentityModule } from '../src/handlers.js';
import { GrpcStatus } from '../src/errors.js';
import type { Auth0Adapter } from '../src/adapter.js';

function adapter(overrides: Partial<Auth0Adapter> = {}): Auth0Adapter {
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
    updateMembership: vi.fn(async () => ({ organization_id: 'org_123', user_id: 'auth0|u1', roles: ['rol_member'] })),
    removeMembership: vi.fn(async () => ({ organization_id: 'org_123', user_id: 'auth0|u1', roles: [] })),
    createInvitation: vi.fn(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' } })),
    listInvitations: vi.fn(async () => ({ items: [], total: 0, hasMore: false })),
    getInvitation: vi.fn(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' } })),
    revokeInvitation: vi.fn(async () => ({ id: 'inv_123', organization_id: 'org_123', invitee: { email: 'ada@example.com' }, revoked: true })),
    ...overrides,
  };
}

describe('Auth0 identity handlers', () => {
  it('delegates supported user RPCs through the adapter and maps responses', async () => {
    const fake = adapter();
    const module = createAuth0IdentityModule(fake);

    const created = await module.CreateUser({ email: 'new@example.com', email_verified: true });
    const listed = await module.ListUsers({ base: { limit: 10 }, email: 'ada@example.com' });
    const resolved = await module.ResolveIdentity({
      input_type: ResolutionInputType.RESOLUTION_INPUT_TYPE_EMAIL,
      input_value: 'ada@example.com',
    });

    expect(fake.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }));
    expect(fake.listUsers).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, email: 'ada@example.com' }));
    expect(created.ref?.canonical_id).toBe('auth0|new');
    expect(listed.meta?.limit).toBe(10);
    expect(resolved.exists).toBe(true);
  });

  it('implements safe organization, membership, and invitation RPCs', async () => {
    const fake = adapter();
    const module = createAuth0IdentityModule(fake);

    await module.CreateOrganization({ name: 'Acme Inc', slug: 'acme', max_members: 25 });
    await module.AddMembership({ organization_id: 'org_123', user_id: 'auth0|u1', roles: ['rol_admin'] });
    await module.CreateInvitation({ organization_id: 'org_123', email: 'ada@example.com', roles: ['rol_admin'] });
    await module.GetInvitation({ canonical_id: 'org_123:inv_123' });

    expect(fake.createOrganization).toHaveBeenCalledWith(expect.objectContaining({ name: 'acme', display_name: 'Acme Inc' }));
    expect(fake.addMembership).toHaveBeenCalledWith('org_123', 'auth0|u1', ['rol_admin']);
    expect(fake.createInvitation).toHaveBeenCalledWith('org_123', expect.objectContaining({ invitee: { email: 'ada@example.com' } }));
    expect(fake.getInvitation).toHaveBeenCalledWith('org_123', 'inv_123');
    expect(fake.createInvitation).not.toHaveBeenCalledWith('org_123', expect.objectContaining({ client_id: undefined }));
  });

  it('does not wipe Auth0 organization metadata on partial updates', async () => {
    const fake = adapter();
    const module = createAuth0IdentityModule(fake);

    await module.UpdateOrganization({ canonical_id: 'org_123', name: 'Renamed Inc' });

    expect(fake.updateOrganization).toHaveBeenCalledWith(
      'org_123',
      expect.not.objectContaining({ metadata: {} }),
    );
  });

  it('returns gRPC-style UNIMPLEMENTED for unclaimed membership/session RPCs', async () => {
    const module = createAuth0IdentityModule(adapter());

    await expect(module.GetMembership({ canonical_id: 'org_123:auth0|u1' })).rejects.toMatchObject({
      code: GrpcStatus.UNIMPLEMENTED,
    });
    await expect(module.UpdateMembership({ canonical_id: 'org_123:auth0|u1', roles: ['rol_member'] })).rejects.toMatchObject({
      code: GrpcStatus.UNIMPLEMENTED,
    });
    await expect(module.GetSession({ canonical_id: 'sess_1' })).rejects.toMatchObject({
      code: GrpcStatus.UNIMPLEMENTED,
    });
    await expect(module.ListSessions({})).rejects.toMatchObject({
      code: GrpcStatus.UNIMPLEMENTED,
    });
    await expect(module.IntrospectSession({ token: 'token' })).rejects.toMatchObject({
      code: GrpcStatus.UNIMPLEMENTED,
    });
    await expect(module.RevokeSession({ canonical_id: 'sess_1' })).rejects.toMatchObject({
      code: GrpcStatus.UNIMPLEMENTED,
    });
  });
});
