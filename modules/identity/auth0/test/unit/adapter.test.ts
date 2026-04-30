import { describe, expect, it, vi } from 'vitest';
import { Auth0ManagementAdapter, createAuth0Adapter, createManagementClient } from '../../src/adapter.js';

describe('Auth0 management adapter', () => {
  it('does not require Management API credentials until a Management-backed RPC is used', async () => {
    const previous = {
      domain: process.env.AUTH0_DOMAIN,
      token: process.env.AUTH0_MANAGEMENT_TOKEN,
      managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
      managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
    };
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_MANAGEMENT_TOKEN;
    delete process.env.AUTH0_MANAGEMENT_CLIENT_ID;
    delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;

    try {
      const adapter = createAuth0Adapter({ domain: 'tenant.example.test' });

      await expect(adapter.listUsers({ limit: 1 })).rejects.toMatchObject({
        identityCode: 'IDENTITY_CONFIG_MGMT_NOT_CONFIGURED',
      });
    } finally {
      if (previous.domain === undefined) delete process.env.AUTH0_DOMAIN;
      else process.env.AUTH0_DOMAIN = previous.domain;
      if (previous.token === undefined) delete process.env.AUTH0_MANAGEMENT_TOKEN;
      else process.env.AUTH0_MANAGEMENT_TOKEN = previous.token;
      if (previous.managementClientId === undefined) delete process.env.AUTH0_MANAGEMENT_CLIENT_ID;
      else process.env.AUTH0_MANAGEMENT_CLIENT_ID = previous.managementClientId;
      if (previous.managementClientSecret === undefined) delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
      else process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = previous.managementClientSecret;
      if (previous.clientId === undefined) delete process.env.AUTH0_CLIENT_ID;
      else process.env.AUTH0_CLIENT_ID = previous.clientId;
      if (previous.clientSecret === undefined) delete process.env.AUTH0_CLIENT_SECRET;
      else process.env.AUTH0_CLIENT_SECRET = previous.clientSecret;
    }
  });

  it('accepts the shared Auth0 Management client env names', () => {
    const previous = {
      domain: process.env.AUTH0_DOMAIN,
      token: process.env.AUTH0_MANAGEMENT_TOKEN,
      managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
      managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
    };
    process.env.AUTH0_DOMAIN = 'tenant.example.test';
    delete process.env.AUTH0_MANAGEMENT_TOKEN;
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = 'management-client-id';
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = 'management-client-secret';
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;

    try {
      expect(createManagementClient()).toBeDefined();
    } finally {
      if (previous.domain === undefined) delete process.env.AUTH0_DOMAIN;
      else process.env.AUTH0_DOMAIN = previous.domain;
      if (previous.token === undefined) delete process.env.AUTH0_MANAGEMENT_TOKEN;
      else process.env.AUTH0_MANAGEMENT_TOKEN = previous.token;
      if (previous.managementClientId === undefined) delete process.env.AUTH0_MANAGEMENT_CLIENT_ID;
      else process.env.AUTH0_MANAGEMENT_CLIENT_ID = previous.managementClientId;
      if (previous.managementClientSecret === undefined) delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
      else process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = previous.managementClientSecret;
      if (previous.clientId === undefined) delete process.env.AUTH0_CLIENT_ID;
      else process.env.AUTH0_CLIENT_ID = previous.clientId;
      if (previous.clientSecret === undefined) delete process.env.AUTH0_CLIENT_SECRET;
      else process.env.AUTH0_CLIENT_SECRET = previous.clientSecret;
    }
  });

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
