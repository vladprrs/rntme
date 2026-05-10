import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'bun:test';
import { createAmoCrmWebhookReceiver } from '../../src/webhooks.js';

const stagePayload = [
  'account[subdomain]=test-account',
  'leads[update][0][id]=25399013',
  'leads[update][0][name]=Lead+title',
  'leads[update][0][old_status_id]=7039101',
  'leads[update][0][status_id]=142',
].join('&');

describe('amoCRM webhook receiver', () => {
  it('parses numeric URL-encoded fields and dedupes repeated deliveries', async () => {
    const receiver = createAmoCrmWebhookReceiver();

    const first = await receiver.receive({ payload: stagePayload, headers: {} });
    const second = await receiver.receive({ payload: stagePayload, headers: {} });

    expect(first).toHaveLength(1);
    expect(first[0]?.id).toBe('leads:update:25399013');
    expect(first[0]?.subject).toBe('25399013');
    expect(first[0]?.type).toBe('rntme.crm.v1.DealStageChanged');
    expect(first[0]?.data).toMatchObject({
      old_stage_id: '7039101',
      new_stage_id: '142',
    });
    expect(second).toHaveLength(0);
  });

  it('rejects invalid signatures when a webhook secret is configured', async () => {
    const receiver = createAmoCrmWebhookReceiver({ webhookSecret: 'secret' });

    await expect(
      receiver.receive({
        payload: stagePayload,
        headers: { 'x-signature': 'invalid' },
      }),
    ).rejects.toThrow('Invalid amoCRM webhook signature');
  });

  it('accepts valid X-Signature HMAC-SHA1 signatures when a webhook secret is configured', async () => {
    const signature = createHmac('sha1', 'secret').update(stagePayload).digest('hex');
    const receiver = createAmoCrmWebhookReceiver({ webhookSecret: 'secret' });

    const events = await receiver.receive({
      payload: stagePayload,
      headers: { 'x-signature': signature },
    });

    expect(events).toHaveLength(1);
  });
});
