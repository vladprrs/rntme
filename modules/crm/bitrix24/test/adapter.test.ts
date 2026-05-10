import { describe, expect, it, mock } from 'bun:test';
import { createBitrix24Adapter } from '../src/adapter.js';

describe('Bitrix24 SDK adapter', () => {
  it('uses B24Hook actions.v2.call.make for single CRM calls', async () => {
    const make = mock(async () => ({
      isSuccess: true,
      getData: () => ({ result: { ID: '42', NAME: 'Ada' } }),
    }));
    const adapter = createBitrix24Adapter({
      hook: { actions: { v2: { call: { make } } } },
    });

    const result = await adapter.call('crm.contact.get', { id: '42' }, 'contact-42');

    expect(make).toHaveBeenCalledWith({
      method: 'crm.contact.get',
      params: { id: '42' },
      requestId: 'contact-42',
    });
    expect(result).toEqual({ ID: '42', NAME: 'Ada' });
  });

  it('uses B24Hook batchByChunk for batch calls', async () => {
    const make = mock(async () => ({
      isSuccess: true,
      getData: () => ({ result: { one: 1 } }),
    }));
    const adapter = createBitrix24Adapter({
      hook: { actions: { v2: { batchByChunk: { make } } } },
    });

    await adapter.batch([
      ['crm.contact.get', { id: '1' }],
      ['crm.company.get', { id: '2' }],
    ]);

    expect(make).toHaveBeenCalledWith({
      calls: [
        ['crm.contact.get', { id: '1' }],
        ['crm.company.get', { id: '2' }],
      ],
    });
  });

  it('uses a single call.make request for explicitly paginated list calls', async () => {
    const make = mock(async () => ({
      isSuccess: true,
      getData: () => ({ result: [{ ID: '1' }] }),
    }));
    const fetchListMethod = mock(async function* () {
      yield [{ ID: 'should-not-be-used' }];
    });
    const adapter = createBitrix24Adapter({
      hook: { actions: { v2: { call: { make } } }, fetchListMethod },
    });

    const result = await adapter.list('crm.contact.list', { start: 10, limit: 2 }, 'page-10');

    expect(make).toHaveBeenCalledWith({
      method: 'crm.contact.list',
      params: { start: 10, limit: 2 },
      requestId: 'page-10',
    });
    expect(fetchListMethod).not.toHaveBeenCalled();
    expect(result).toEqual([{ ID: '1' }]);
  });

  it('unwraps Bitrix24 crm.category.list categories payloads', async () => {
    const make = mock(async () => ({
      isSuccess: true,
      getData: () => ({ result: { categories: [{ id: 2, name: 'Enterprise' }] } }),
    }));
    const adapter = createBitrix24Adapter({
      hook: { actions: { v2: { call: { make } } } },
    });

    const result = await adapter.list('crm.category.list', { entityTypeId: 2, start: 0 });

    expect(result).toEqual([{ id: 2, name: 'Enterprise' }]);
  });

  it('maps unsuccessful SDK responses into canonical CRM errors', async () => {
    const adapter = createBitrix24Adapter({
      hook: {
        actions: {
          v2: {
            call: {
              make: mock(async () => ({
                isSuccess: false,
                getErrorMessages: () => ['QUERY_LIMIT_EXCEEDED'],
                getData: () => ({ error: 'QUERY_LIMIT_EXCEEDED' }),
              })),
            },
          },
        },
      },
    });

    await expect(adapter.call('crm.contact.get', { id: '42' })).rejects.toMatchObject({
      code: 8,
      canonicalCode: 'CRM_VENDOR_RATE_LIMITED',
    });
  });
});
