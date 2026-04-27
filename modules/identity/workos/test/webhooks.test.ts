import { describe, expect, it, vi } from 'vitest';
import { InMemoryWebhookDedupeStore, createWorkOSWebhookReceiver, translateWorkOSWebhook } from '../src/webhooks.js';

describe('WorkOS webhook receiver', () => {
  it('verifies with workos-signature, translates, and dedupes claimed lifecycle events', async () => {
    const constructEvent = vi.fn(async () => ({
      id: 'evt_1',
      event: 'user.created',
      data: { id: 'user_1', email: 'ada@example.com' },
    }));
    const receiver = createWorkOSWebhookReceiver({
      signingSecret: 'whsec_test',
      constructEvent,
      dedupeStore: new InMemoryWebhookDedupeStore(),
    });
    const headers = { 'workos-signature': 'sig', 'webhook-id': 'msg_1' };

    const first = await receiver.receive({ payload: '{"id":"evt_1"}', headers });
    const second = await receiver.receive({ payload: '{"id":"evt_1"}', headers });

    expect(constructEvent).toHaveBeenCalledOnce();
    expect(constructEvent).toHaveBeenCalledWith({
      payload: { id: 'evt_1' },
      sigHeader: 'sig',
      secret: 'whsec_test',
      tolerance: undefined,
    });
    expect(first).toEqual([
      expect.objectContaining({
        id: 'evt_1',
        source: 'workos',
        type: 'rntme.identity.v1.UserCreated',
        subject: 'user_1',
      }),
    ]);
    expect(second).toEqual([]);
  });

  it('ignores directory sync and SSO events instead of claiming unsafe canonical events', () => {
    expect(translateWorkOSWebhook({ id: 'evt_dsync', event: 'dsync.user.created', data: { id: 'directory_user_1' } })).toBeUndefined();
    expect(translateWorkOSWebhook({ id: 'evt_sso', event: 'connection.activated', data: { id: 'conn_1' } })).toBeUndefined();
  });

  it('emits canonical scalar data for deletion and terminal invitation events', () => {
    const deleted = translateWorkOSWebhook({ id: 'evt_deleted', event: 'organization_membership.deleted', data: { id: 'om_1' } });
    const revoked = translateWorkOSWebhook({
      id: 'evt_inv_revoked',
      event: 'invitation.revoked',
      data: { id: 'inv_1', email: 'new@example.com', organizationId: 'org_1', state: 'revoked' },
    });

    expect(deleted?.data).toEqual(expect.objectContaining({ canonical_id: 'om_1', vendor_id: 'om_1' }));
    expect(deleted?.data).not.toHaveProperty('membership');
    expect(revoked?.type).toBe('rntme.identity.v1.InvitationRevoked');
    expect(revoked?.data).toEqual(expect.objectContaining({ invitation: expect.objectContaining({ email: 'new@example.com' }) }));
  });
});
