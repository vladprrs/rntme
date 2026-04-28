import { describe, expect, it } from 'vitest';
import { createBitrix24CrmModule } from '../src/handlers.js';

const hasWebhook = Boolean(process.env.BITRIX24_WEBHOOK_URL);
const hasSecretAuth = Boolean(process.env.BITRIX24_URL && process.env.BITRIX24_USER_ID && process.env.BITRIX24_SECRET);
const hasCredentials = hasWebhook || hasSecretAuth;

describe('Bitrix24 live smoke', () => {
  it('lists contacts against a real Bitrix24 portal when credentials are present', async () => {
    if (!hasCredentials) {
      expect(hasCredentials, 'Set BITRIX24_WEBHOOK_URL or BITRIX24_URL/BITRIX24_USER_ID/BITRIX24_SECRET to run live smoke').toBe(false);
      return;
    }

    const crm = createBitrix24CrmModule();
    const result = await crm.ListContacts({ base: { limit: 1 } });
    expect(Array.isArray(result.items)).toBe(true);
  });
});
