import { describe, expect, it, vi } from 'vitest';
import { Auth0ManagementAdapter } from '../../src/adapter.js';

describe('Auth0 management adapter', () => {
  it('uses Auth0 offset pagination parameters without mixing pagination styles', async () => {
    const getAll = vi.fn(async () => ({ data: { users: [] } }));
    const adapter = new Auth0ManagementAdapter({
      users: { getAll },
      organizations: {},
    } as never);

    await adapter.listUsers({ limit: 25, offset: 50, cursor: 'ignored-for-offset-pagination' });

    expect(getAll).toHaveBeenCalledWith({
      include_totals: true,
      per_page: 25,
      page: 2,
    });
  });

  it('omits undefined createUser connection while preserving caller-provided connection', async () => {
    const create = vi.fn(async () => ({ data: { user_id: 'auth0|u1' } }));
    const adapter = new Auth0ManagementAdapter({
      users: { create },
      organizations: {},
    } as never);

    await adapter.createUser({ email: 'ada@example.com' });
    await adapter.createUser({ email: 'grace@example.com', connection: 'Username-Password-Authentication' });

    expect(create).toHaveBeenNthCalledWith(1, { email: 'ada@example.com' });
    expect(create).toHaveBeenNthCalledWith(2, { email: 'grace@example.com', connection: 'Username-Password-Authentication' });
  });

  it('uses Auth0 getByName for slug-filtered organization lists', async () => {
    const getAll = vi.fn(async () => ({ data: { organizations: [{ id: 'org_other', name: 'other' }] } }));
    const getByName = vi.fn(async () => ({ data: { id: 'org_123', name: 'acme' } }));
    const adapter = new Auth0ManagementAdapter({
      users: {},
      organizations: { getAll, getByName },
    } as never);

    const result = await adapter.listOrganizations({ slug: 'acme', limit: 10 });

    expect(getByName).toHaveBeenCalledWith({ name: 'acme' });
    expect(getAll).not.toHaveBeenCalled();
    expect(result).toMatchObject({ items: [{ id: 'org_123', name: 'acme' }], total: 1, hasMore: false });
  });

  it('exhausts invitation pages before returning an email-filtered result', async () => {
    const getInvitations = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          start: 0,
          limit: 1,
          invitations: [
            { id: 'inv_1', invitee: { email: 'grace@example.com' } },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          start: 1,
          limit: 1,
          invitations: [
            { id: 'inv_3', invitee: { email: 'ada@example.com' } },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          start: 2,
          limit: 1,
          invitations: [
            { id: 'inv_4', invitee: { email: 'ada@example.com' } },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          start: 3,
          limit: 1,
          invitations: [],
        },
      });
    const adapter = new Auth0ManagementAdapter({
      users: {},
      organizations: { getInvitations },
    } as never);

    const result = await adapter.listInvitations('org_123', { email: 'ada@example.com', limit: 1 });

    expect(getInvitations).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'org_123', page: 0, per_page: 1 }));
    expect(getInvitations).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'org_123', page: 1, per_page: 1 }));
    expect(result).toEqual({
      items: [{ id: 'inv_3', invitee: { email: 'ada@example.com' }, organization_id: 'org_123' }],
      total: 2,
      hasMore: true,
    });
  });

  it('uses only the dedicated invitation client id for organization invitations', async () => {
    const createInvitation = vi.fn(async () => ({ data: { id: 'inv_123', organization_id: 'org_123' } }));
    const adapter = new Auth0ManagementAdapter(
      {
        users: {},
        organizations: { createInvitation },
      } as never,
      { clientId: 'm2m_123', invitationClientId: 'login_app_123' },
    );

    await adapter.createInvitation('org_123', { invitee: { email: 'ada@example.com' } });

    expect(createInvitation).toHaveBeenCalledWith(
      { id: 'org_123' },
      expect.objectContaining({ client_id: 'login_app_123', send_invitation_email: true }),
    );
  });

  it('uses AUTH0_INVITATION_CLIENT_ID for invitations when adapter options omit invitation ids', async () => {
    const previous = process.env.AUTH0_INVITATION_CLIENT_ID;
    process.env.AUTH0_INVITATION_CLIENT_ID = 'env_login_app_123';
    try {
      const createInvitation = vi.fn(async () => ({ data: { id: 'inv_123', organization_id: 'org_123' } }));
      const adapter = new Auth0ManagementAdapter(
        {
          users: {},
          organizations: { createInvitation },
        } as never,
      );

      await adapter.createInvitation('org_123', { invitee: { email: 'ada@example.com' } });

      expect(createInvitation).toHaveBeenCalledWith(
        { id: 'org_123' },
        expect.objectContaining({ client_id: 'env_login_app_123' }),
      );
    } finally {
      if (previous === undefined) {
        delete process.env.AUTH0_INVITATION_CLIENT_ID;
      } else {
        process.env.AUTH0_INVITATION_CLIENT_ID = previous;
      }
    }
  });

  it('returns deleted sentinels for delete operations', async () => {
    const deleteUser = vi.fn(async () => ({ data: undefined }));
    const deleteOrganization = vi.fn(async () => ({ data: undefined }));
    const adapter = new Auth0ManagementAdapter({
      users: { delete: deleteUser },
      organizations: { delete: deleteOrganization },
    } as never);

    expect(await adapter.deleteUser('auth0|u1')).toMatchObject({ user_id: 'auth0|u1', deleted: true });
    expect(await adapter.deleteOrganization('org_123')).toMatchObject({ id: 'org_123', deleted: true });
  });
});
