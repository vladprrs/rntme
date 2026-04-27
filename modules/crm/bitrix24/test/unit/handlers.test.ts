import { describe, expect, it } from 'vitest';
import { proto } from '@rntme/contracts-crm-v1';
import { createBitrix24CrmModule } from '../../src/handlers.js';
import { GrpcStatus } from '../../src/errors.js';
import type { Bitrix24Adapter } from '../../src/adapter.js';

const crm = proto.rntme.contracts.crm.v1;

function adapter(overrides: Partial<Bitrix24Adapter> = {}): Bitrix24Adapter {
  const base: Bitrix24Adapter = {
    call: async () => ({}),
    list: async () => [],
    batch: async () => ({}),
  };
  return { ...base, ...overrides };
}

describe('Bitrix24 CRM handlers', () => {
  it('creates contacts through crm.contact.add and maps the fetched result to canonical Contact', async () => {
    const calls: unknown[] = [];
    const module = createBitrix24CrmModule({
      adapter: adapter({
        call: async (method: string, params?: Record<string, unknown>) => {
          calls.push({ method, params });
          if (method === 'crm.contact.add') return 123;
          if (method === 'crm.contact.get') {
            return {
              ID: '123',
              NAME: 'Ada',
              LAST_NAME: 'Lovelace',
              POST: 'Founder',
              COMPANY_ID: '7',
              ASSIGNED_BY_ID: '9',
              EMAIL: [{ VALUE: 'ada@example.com' }],
              PHONE: [{ VALUE: '+15550100' }],
              DATE_CREATE: '2026-04-27T10:00:00+00:00',
            };
          }
          return {};
        },
      }),
    });

    const contact = await module.CreateContact(
      crm.CreateContactRequest.create({
        email: 'ada@example.com',
        phone: '+15550100',
        name: { given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' },
        title: 'Founder',
        company_canonical_id: '7',
        owner_canonical_id: '9',
      }),
    );

    expect(calls[0]).toEqual({
      method: 'crm.contact.add',
      params: {
        fields: {
          NAME: 'Ada',
          LAST_NAME: 'Lovelace',
          POST: 'Founder',
          COMPANY_ID: '7',
          ASSIGNED_BY_ID: '9',
          EMAIL: [{ VALUE: 'ada@example.com', VALUE_TYPE: 'WORK' }],
          PHONE: [{ VALUE: '+15550100', VALUE_TYPE: 'WORK' }],
        },
      },
    });
    expect(contact.ref?.canonical_id).toBe('bitrix24:contact:123');
    expect(contact.email).toBe('ada@example.com');
    expect(contact.name?.display).toBe('Ada Lovelace');
  });

  it('preserves Bitrix24 stage ids containing colons when creating deals', async () => {
    const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const module = createBitrix24CrmModule({
      adapter: adapter({
        call: async (method: string, params?: Record<string, unknown>) => {
          calls.push({ method, params });
          if (method === 'crm.deal.add') return 77;
          return { ID: '77', TITLE: 'Stage-safe deal', CATEGORY_ID: '2', STAGE_ID: 'C2:WON' };
        },
      }),
    });

    await module.CreateDeal(
      crm.CreateDealRequest.create({
        name: 'Stage-safe deal',
        pipeline_canonical_id: 'bitrix24:pipeline:2',
        stage_canonical_id: 'bitrix24:stage:2:C2:WON',
      }),
    );

    expect(calls[0]).toEqual({
      method: 'crm.deal.add',
      params: { fields: expect.objectContaining({ TITLE: 'Stage-safe deal', CATEGORY_ID: '2', STAGE_ID: 'C2:WON' }) },
    });
  });

  it('maps Bitrix24 deals, pipeline, stage, owner, amount, company and contact fields', async () => {
    const module = createBitrix24CrmModule({
      adapter: adapter({
        call: async () => ({
          ID: '55',
          TITLE: 'Enterprise rollout',
          CATEGORY_ID: '2',
          STAGE_ID: 'C2:WON',
          STAGE_SEMANTIC_ID: 'S',
          OPPORTUNITY: '12500.50',
          CURRENCY_ID: 'USD',
          COMPANY_ID: '7',
          CONTACT_ID: '123',
          ASSIGNED_BY_ID: '9',
          CLOSED: 'Y',
          CLOSEDATE: '2026-05-01T00:00:00+00:00',
        }),
      }),
    });

    const deal = await module.GetDeal(crm.GetDealRequest.create({ canonical_id: '55' }));

    expect(deal.ref?.canonical_id).toBe('bitrix24:deal:55');
    expect(deal.name).toBe('Enterprise rollout');
    expect(deal.pipeline_canonical_id).toBe('bitrix24:pipeline:2');
    expect(deal.stage_canonical_id).toBe('bitrix24:stage:2:C2:WON');
    expect(deal.status).toBe(crm.DealStatus.DEAL_STATUS_WON);
    expect(deal.amount).toBe(12500.5);
    expect(deal.company_canonical_id).toBe('bitrix24:company:7');
    expect(deal.primary_contact_canonical_id).toBe('bitrix24:contact:123');
    expect(deal.owner_canonical_id).toBe('bitrix24:owner:9');
  });

  it('rejects labeled associations because Bitrix24 has no native label support', async () => {
    const module = createBitrix24CrmModule({ adapter: adapter() });

    await expect(
      module.CreateAssociation(
        crm.CreateAssociationRequest.create({
          from: { entity_type: 'deal', canonical_id: '55' },
          to: { entity_type: 'contact', canonical_id: '123' },
          label: 'Decision Maker',
        }),
      ),
    ).rejects.toMatchObject({
      code: GrpcStatus.FAILED_PRECONDITION,
      crmCode: 'CRM_CONSISTENCY_LABELS_NOT_SUPPORTED',
    });
  });

  it('round-trips flat association ids through create, list, and delete', async () => {
    const calls: unknown[] = [];
    const module = createBitrix24CrmModule({
      adapter: adapter({
        call: async (method: string, params?: Record<string, unknown>) => {
          calls.push({ method, params });
          if (method === 'crm.deal.get') return { ID: '55', CONTACT_IDS: ['111', '123'] };
          return true;
        },
      }),
    });

    const created = await module.CreateAssociation(
      crm.CreateAssociationRequest.create({
        from: { entity_type: 'deal', canonical_id: 'bitrix24:deal:55' },
        to: { entity_type: 'contact', canonical_id: 'bitrix24:contact:123' },
      }),
    );
    const listed = await module.ListAssociations(
      crm.ListAssociationsRequest.create({
        from: { entity_type: 'deal', canonical_id: 'bitrix24:deal:55' },
        to_entity_type: 'contact',
      }),
    );
    await module.DeleteAssociation(crm.DeleteAssociationRequest.create({ canonical_id: created.ref?.canonical_id }));

    expect(created.ref?.canonical_id).toBe('bitrix24:assoc:deal:55:contact:123');
    expect(listed.items.map((item) => item.ref?.canonical_id)).toContain('bitrix24:assoc:deal:55:contact:123');
    expect(calls).toContainEqual({
      method: 'crm.deal.update',
      params: { id: '55', fields: { CONTACT_IDS: ['111', '123'] } },
    });
    expect(calls).toContainEqual({
      method: 'crm.deal.update',
      params: { id: '55', fields: { CONTACT_IDS: ['111'] } },
    });
  });

  it('uses Bitrix24 owner type ids and preserves stage ids in filters', async () => {
    const calls: unknown[] = [];
    const lists: unknown[] = [];
    const module = createBitrix24CrmModule({
      adapter: adapter({
        call: async (method: string, params?: Record<string, unknown>) => {
          calls.push({ method, params });
          if (method === 'crm.activity.add') return 88;
          return { ID: '88', SUBJECT: 'Call', OWNER_TYPE_ID: '2', OWNER_ID: '55' };
        },
        list: async (method: string, params?: Record<string, unknown>) => {
          lists.push({ method, params });
          return [];
        },
      }),
    });

    await module.CreateActivity(
      crm.CreateActivityRequest.create({
        subject: 'Call',
        linked_entities: [{ entity_type: 'deal', canonical_id: 'bitrix24:deal:55' }],
      }),
    );
    await module.ListDeals(
      crm.ListDealsRequest.create({
        stage_canonical_id: 'bitrix24:stage:2:C2:WON',
      }),
    );

    expect(calls[0]).toEqual({
      method: 'crm.activity.add',
      params: { fields: expect.objectContaining({ OWNER_TYPE_ID: 2, OWNER_ID: '55' }) },
    });
    expect(lists[0]).toEqual({
      method: 'crm.deal.list',
      params: { filter: { STAGE_ID: 'C2:WON' } },
    });
  });

  it('wraps SyncDelta entities in protobuf Any payloads', async () => {
    const module = createBitrix24CrmModule({
      adapter: adapter({
        list: async () => [{ ID: '55', TITLE: 'Enterprise', DATE_MODIFY: '2026-04-27T10:00:00+00:00' }],
      }),
    });

    const result = await module.SyncDelta(crm.SyncDeltaRequest.create({ entity_type: 'deal', limit: 1 }));

    expect(result.items[0]?.entity?.type_url).toBe('type.googleapis.com/rntme.contracts.crm.v1.Deal');
    const decoded = crm.Deal.decode(result.items[0]?.entity?.value ?? new Uint8Array());
    expect(decoded.ref?.canonical_id).toBe('bitrix24:deal:55');
  });

  it('passes cursor, filters, and sorts to Bitrix24 list calls and returns next_cursor metadata', async () => {
    const lists: unknown[] = [];
    const module = createBitrix24CrmModule({
      adapter: adapter({
        list: async (method: string, params?: Record<string, unknown>) => {
          lists.push({ method, params });
          return [
            { ID: '1', NAME: 'Ada' },
            { ID: '2', NAME: 'Grace' },
          ];
        },
      }),
    });

    const result = await module.ListContacts(
      crm.ListContactsRequest.create({
        base: {
          limit: 2,
          cursor: '10',
          filters: [{ field: 'NAME', operator: 10, value: 'A' }],
          sorts: [{ field: 'DATE_MODIFY', direction: 2 }],
        },
      }),
    );

    expect(lists[0]).toEqual({
      method: 'crm.contact.list',
      params: {
        filter: { '=%NAME': 'A' },
        order: { DATE_MODIFY: 'DESC' },
        start: 10,
        limit: 2,
      },
    });
    expect(result.meta.next_cursor).toBe('12');
    expect(result.meta.has_more).toBe(true);
  });

  it('runs module-local SYNC_FULL async jobs and records counts from paginated SDK lists', async () => {
    const module = createBitrix24CrmModule({
      adapter: adapter({
        list: async (method: string) => {
          if (method === 'crm.contact.list') return [{ ID: '1' }, { ID: '2' }];
          if (method === 'crm.company.list') return [{ ID: '7' }];
          return [];
        },
      }),
    });

    const job = await module.SubmitJob(
      crm.SubmitJobRequest.create({
        sync_full: { entity_types: ['contact', 'company'] },
      }),
    );
    const fetched = await module.GetJob(crm.GetJobRequest.create({ canonical_id: job.ref?.canonical_id }));

    expect(fetched.status).toBe(crm.AsyncJobStatus.ASYNC_JOB_STATUS_COMPLETED);
    expect(fetched.progress_percentage).toBe(100);
    expect(fetched.record_count).toBe(3);
  });
});
