import { describe, expect, it, mock } from 'bun:test';
import { InMemoryWebhookDedupeStore, createClerkWebhookReceiver, translateClerkWebhook } from '../src/webhooks.js';

describe('Clerk webhook receiver', () => {
  it('verifies, translates, and dedupes claimed Clerk lifecycle events', async () => {
    const verify = mock(async () => ({
      id: 'evt_1',
      type: 'user.created',
      data: {
        id: 'user_1',
        email_addresses: [{ id: 'email_1', email_address: 'ada@example.com' }],
        primary_email_address_id: 'email_1',
      },
    }));
    const receiver = createClerkWebhookReceiver({
      signingSecret: 'whsec_test',
      verify,
      dedupeStore: new InMemoryWebhookDedupeStore(),
    });
    const headers = {
      'svix-id': 'msg_1',
      'svix-timestamp': '1700000000',
      'svix-signature': 'sig',
    };

    const first = await receiver.receive({ payload: '{}', headers });
    const second = await receiver.receive({ payload: '{}', headers });

    expect(verify).toHaveBeenCalledTimes(1);
    expect(first).toEqual([
      expect.objectContaining({
        id: 'evt_1',
        source: 'clerk',
        type: 'rntme.identity.v1.UserCreated',
        subject: 'user_1',
      }),
    ]);
    expect(second).toEqual([]);
  });

  it('dedupes repeated Svix delivery ids before verification even when event ids differ', async () => {
    let verifyCalls = 0;
    const verify = mock(async () => {
      verifyCalls += 1;
      return verifyCalls === 1
        ? { id: 'evt_first', type: 'user.created', data: { id: 'user_1' } }
        : { id: 'evt_second', type: 'user.created', data: { id: 'user_1' } };
    });
    const receiver = createClerkWebhookReceiver({
      signingSecret: 'whsec_test',
      verify,
      dedupeStore: new InMemoryWebhookDedupeStore(),
    });
    const delivery = {
      payload: '{}',
      headers: {
        'svix-id': 'msg_same',
        'svix-timestamp': '1700000000',
        'svix-signature': 'sig',
      },
    };

    const first = await receiver.receive(delivery);
    const second = await receiver.receive(delivery);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
  });

  it('ignores unclaimed Clerk events', async () => {
    const receiver = createClerkWebhookReceiver({
      signingSecret: 'whsec_test',
      verify: async () => ({ id: 'evt_unknown', type: 'actor_token.created', data: { id: 'tok_1' } }),
      dedupeStore: new InMemoryWebhookDedupeStore(),
    });

    await expect(receiver.receive({ payload: '{}', headers: { 'svix-id': 'msg_unknown' } })).resolves.toEqual([]);
  });

  it('uses the official Clerk webhook verifier by default and rejects invalid signatures', async () => {
    const receiver = createClerkWebhookReceiver({
      signingSecret: 'whsec_test',
      dedupeStore: new InMemoryWebhookDedupeStore(),
    });

    await expect(
      receiver.receive({
        payload: '{}',
        headers: {
          'svix-id': 'msg_invalid',
          'svix-timestamp': '1700000000',
          'svix-signature': 'v1,invalid',
        },
      }),
    ).rejects.toThrow();
  });

  it('uses the Svix delivery id as CloudEvent id when Clerk event id is absent', async () => {
    const receiver = createClerkWebhookReceiver({
      signingSecret: 'whsec_test',
      verify: async () => ({
        type: 'user.updated',
        data: { id: 'user_1' },
      }),
      dedupeStore: new InMemoryWebhookDedupeStore(),
    });

    const events = await receiver.receive({ payload: '{}', headers: { 'svix-id': 'msg_unique' } });

    expect(events[0]?.id).toBe('msg_unique');
  });

  it('emits canonical scalar data for deletion and terminal session events', () => {
    const membershipDeleted = translateClerkWebhook({
      id: 'evt_membership_deleted',
      type: 'organizationMembership.deleted',
      data: {
        id: 'mem_1',
        organization_id: 'org_1',
        public_user_data: { user_id: 'user_1' },
      },
    });
    const sessionRevoked = translateClerkWebhook({
      id: 'evt_session_revoked',
      type: 'session.revoked',
      data: {
        id: 'sess_1',
        user_id: 'user_1',
      },
    });

    expect(membershipDeleted?.data).toEqual(
      expect.objectContaining({
        canonical_id: 'org_1:user_1',
        user_id: 'user_1',
        organization_id: 'org_1',
      }),
    );
    expect(membershipDeleted?.data).not.toHaveProperty('membership');
    expect(sessionRevoked?.data).toEqual(
      expect.objectContaining({
        session_id: 'sess_1',
        canonical_id: 'sess_1',
        user_id: 'user_1',
      }),
    );
    expect(sessionRevoked?.data).not.toHaveProperty('session');
  });
});
