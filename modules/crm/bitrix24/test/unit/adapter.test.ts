import { describe, expect, it } from 'vitest';
import { createBitrix24SdkAdapter } from '../../src/adapter.js';

describe('Bitrix24 SDK adapter', () => {
  it('calls Bitrix24 SDK v2 call.make and unwraps result data', async () => {
    const calls: unknown[] = [];
    const adapter = createBitrix24SdkAdapter({
      client: {
        actions: {
          v2: {
            call: {
              make: async (input: unknown) => {
                calls.push(input);
                return {
                  isSuccess: true,
                  getData: () => ({ result: { ID: '42', NAME: 'Ada' } }),
                };
              },
            },
          },
        },
      },
    });

    await expect(adapter.call('crm.contact.get', { id: 42 }, 'req-1')).resolves.toEqual({ ID: '42', NAME: 'Ada' });
    expect(calls).toEqual([{ method: 'crm.contact.get', params: { id: 42 }, requestId: 'req-1' }]);
  });

  it('maps SDK unsuccessful responses to canonical Bitrix24 errors', async () => {
    const adapter = createBitrix24SdkAdapter({
      client: {
        actions: {
          v2: {
            call: {
              make: async () => ({
                isSuccess: false,
                getErrorMessages: () => ['QUERY_LIMIT_EXCEEDED'],
              }),
            },
          },
        },
      },
    });

    await expect(adapter.call('crm.contact.list', {})).rejects.toMatchObject({
      code: 8,
      crmCode: 'CRM_VENDOR_RATE_LIMITED',
    });
  });
});
