import { describe, expect, it, mock, setSystemTime } from 'bun:test';
import moduleManifest from '../module.json' with { type: 'json' };
import { WORKOS_SUPPORTED_EVENTS } from '../src/capabilities.js';
import { InMemoryWebhookDedupeStore, createWorkOSWebhookReceiver, translateWorkOSWebhook } from '../src/webhooks.js';
import type { WorkOSWebhookEvent } from '../src/types.js';

describe('WorkOS webhook receiver', () => {
  it('verifies with workos-signature, translates, and dedupes claimed lifecycle events', async () => {
    const constructEvent = mock(async () => ({
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

    expect(constructEvent).toHaveBeenCalledTimes(1);
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
        data: expect.not.objectContaining({ vendor_raw: expect.anything() }),
      }),
    ]);
    expect(first[0]?.data).toEqual(expect.objectContaining({ user: expect.objectContaining({ vendor_raw: expect.anything() }) }));
    expect(second).toEqual([]);
  });

  it('ignores directory sync and SSO events instead of claiming unsafe canonical events', () => {
    expect(translateWorkOSWebhook({ id: 'evt_dsync', event: 'dsync.user.created', data: { id: 'directory_user_1' } })).toBeUndefined();
    expect(translateWorkOSWebhook({ id: 'evt_sso', event: 'connection.activated', data: { id: 'conn_1' } })).toBeUndefined();
    expect(translateWorkOSWebhook({ id: 'evt_inv_accepted', event: 'invitation.accepted', data: { id: 'inv_1' } })).toBeUndefined();
  });

  it('does not claim InvitationAccepted because WorkOS does not provide canonical created_membership_id', () => {
    expect(moduleManifest.capabilities.events).not.toContain('rntme.identity.v1.InvitationAccepted');
    expect(WORKOS_SUPPORTED_EVENTS).not.toContain('rntme.identity.v1.InvitationAccepted');
  });

  it('emits deletion timestamps from event creation time or current time fallback', () => {
    setSystemTime(new Date('2024-01-02T00:00:00.000Z'));
    try {
      const userDeleted = translateWorkOSWebhook({
        id: 'evt_user_deleted',
        event: 'user.deleted',
        createdAt: '2024-01-01T00:00:00.000Z',
        data: { id: 'user_1' },
      } as WorkOSWebhookEvent);
      const organizationDeleted = translateWorkOSWebhook({
        id: 'evt_org_deleted',
        event: 'organization.deleted',
        created_at: '2024-01-01T00:00:00.000Z',
        data: { id: 'org_1' },
      } as WorkOSWebhookEvent);
      const membershipDeleted = translateWorkOSWebhook({
        id: 'evt_membership_deleted',
        event: 'organization_membership.deleted',
        data: { id: 'om_1', userId: 'user_1', organizationId: 'org_1' },
      });

      expect(userDeleted?.data).toEqual(
        expect.objectContaining({ canonical_id: 'user_1', vendor_id: 'user_1', hard_delete: true, deleted_at: { seconds: 1704067200, nanos: 0 } }),
      );
      expect(organizationDeleted?.data).toEqual(
        expect.objectContaining({ canonical_id: 'org_1', vendor_id: 'org_1', hard_delete: true, deleted_at: { seconds: 1704067200, nanos: 0 } }),
      );
      expect(membershipDeleted?.data).toEqual(
        expect.objectContaining({
          canonical_id: 'om_1',
          user_id: 'user_1',
          organization_id: 'org_1',
          deleted_at: { seconds: 1704153600, nanos: 0 },
        }),
      );
      expect(userDeleted?.data).not.toHaveProperty('vendor_raw');
      expect(organizationDeleted?.data).not.toHaveProperty('vendor_raw');
      expect(membershipDeleted?.data).not.toHaveProperty('vendor_raw');
      expect(membershipDeleted?.data).not.toHaveProperty('vendor_id');
    } finally {
      setSystemTime();
    }
  });

  it('emits canonical scalar data for terminal invitation revoke events', () => {
    const revoked = translateWorkOSWebhook({
      id: 'evt_inv_revoked',
      event: 'invitation.revoked',
      data: { id: 'inv_2', email: 'revoked@example.com', organizationId: 'org_1', state: 'revoked', revokedAt: '2024-01-03T00:00:00.000Z' },
    });

    expect(revoked?.type).toBe('rntme.identity.v1.InvitationRevoked');
    expect(revoked?.data).toEqual(
      expect.objectContaining({
        invitation: expect.objectContaining({ email: 'revoked@example.com' }),
        revoked_at: { seconds: 1704240000, nanos: 0 },
      }),
    );
    expect(revoked?.data).not.toHaveProperty('vendor_raw');
  });
});
