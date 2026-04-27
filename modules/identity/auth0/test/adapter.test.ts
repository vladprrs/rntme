import { describe, expect, it, vi } from 'vitest';
import { Auth0ManagementAdapter } from '../src/adapter.js';

describe('Auth0 management adapter', () => {
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

  it('filters listed invitations by email after Auth0 returns an organization page', async () => {
    const getInvitations = vi.fn(async () => ({
      data: {
        invitations: [
          { id: 'inv_1', invitee: { email: 'ada@example.com' } },
          { id: 'inv_2', invitee: { email: 'grace@example.com' } },
        ],
      },
    }));
    const adapter = new Auth0ManagementAdapter({
      users: {},
      organizations: { getInvitations },
    } as never);

    const result = await adapter.listInvitations('org_123', { email: 'ada@example.com' });

    expect(getInvitations).toHaveBeenCalledWith(expect.objectContaining({ id: 'org_123' }));
    expect(result.items).toEqual([{ id: 'inv_1', invitee: { email: 'ada@example.com' }, organization_id: 'org_123' }]);
  });

  it('uses AUTH0 client id fallback for organization invitations', async () => {
    const createInvitation = vi.fn(async () => ({ data: { id: 'inv_123', organization_id: 'org_123' } }));
    const adapter = new Auth0ManagementAdapter(
      {
        users: {},
        organizations: { createInvitation },
      } as never,
      { clientId: 'app_123' },
    );

    await adapter.createInvitation('org_123', { invitee: { email: 'ada@example.com' } });

    expect(createInvitation).toHaveBeenCalledWith(
      { id: 'org_123' },
      expect.objectContaining({ client_id: 'app_123', send_invitation_email: true }),
    );
  });

  it('uses AUTH0_CLIENT_ID for invitations when adapter options omit invitation ids', async () => {
    const previous = process.env.AUTH0_CLIENT_ID;
    process.env.AUTH0_CLIENT_ID = 'env_app_123';
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
        expect.objectContaining({ client_id: 'env_app_123' }),
      );
    } finally {
      if (previous === undefined) {
        delete process.env.AUTH0_CLIENT_ID;
      } else {
        process.env.AUTH0_CLIENT_ID = previous;
      }
    }
  });
});
