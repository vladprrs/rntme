import { describe, expect, it, vi } from 'vitest';
import { proto } from '@rntme/contracts-crm-v1';
import { createBitrix24CrmModule } from '../src/handlers.js';
import type { Bitrix24Adapter } from '../src/adapter.js';

const crm = proto.rntme.contracts.crm.v1;

function adapter(fixtures: Record<string, unknown>): Bitrix24Adapter {
  return {
    call: vi.fn(async (method: string, params?: Record<string, unknown>) => {
      const value = fixtures[method];
      if (method.endsWith('.get') && params?.id) return { ...((value as Record<string, unknown>) ?? {}), ID: String(params.id) };
      return value;
    }),
    list: vi.fn(async (method: string) => (fixtures[method] as Record<string, unknown>[] | undefined) ?? []),
    batch: vi.fn(async () => ({})),
  };
}

describe('Bitrix24 CRM handlers', () => {
  it('covers contact/company/deal/activity CRUD and list flows through SDK methods', async () => {
    const fake = adapter({
      'crm.contact.get': { ID: '10', NAME: 'Ada', EMAIL: [{ VALUE: 'ada@example.com' }] },
      'crm.contact.list': [{ ID: '10', NAME: 'Ada' }],
      'crm.contact.add': 11,
      'crm.contact.update': true,
      'crm.contact.delete': true,
      'crm.company.get': { ID: '20', TITLE: 'Acme' },
      'crm.company.list': [{ ID: '20', TITLE: 'Acme' }],
      'crm.company.add': 21,
      'crm.company.update': true,
      'crm.company.delete': true,
      'crm.deal.get': { ID: '30', TITLE: 'Renewal' },
      'crm.deal.list': [{ ID: '30', TITLE: 'Renewal' }],
      'crm.deal.add': 31,
      'crm.deal.update': true,
      'crm.deal.delete': true,
      'crm.activity.get': { ID: '40', SUBJECT: 'Call', OWNER_TYPE_ID: '3', OWNER_ID: '30' },
      'crm.activity.list': [{ ID: '40', SUBJECT: 'Call', OWNER_TYPE_ID: '3', OWNER_ID: '30' }],
      'crm.activity.add': 41,
      'crm.activity.update': true,
      'crm.activity.delete': true,
    });
    const module = createBitrix24CrmModule({ adapter: fake });

    expect((await module.GetContact(crm.GetContactRequest.create({ canonical_id: 'bitrix24:contact:10' }))).ref?.vendor_id).toBe('10');
    expect((await module.ListContacts(crm.ListContactsRequest.create({ base: { limit: 10 } }))).items).toHaveLength(1);
    expect((await module.CreateContact(crm.CreateContactRequest.create({ email: 'new@example.com' }))).ref?.vendor_id).toBe('11');
    expect((await module.UpdateContact(crm.UpdateContactRequest.create({ canonical_id: 'bitrix24:contact:10', title: 'CEO' }))).ref?.vendor_id).toBe('10');
    expect((await module.DeleteContact(crm.DeleteContactRequest.create({ canonical_id: 'bitrix24:contact:10' }))).status).toBe(2);
    expect((await module.GetCompany(crm.GetCompanyRequest.create({ canonical_id: 'bitrix24:company:20' }))).ref?.vendor_id).toBe('20');
    expect((await module.CreateDeal(crm.CreateDealRequest.create({ name: 'New' }))).ref?.vendor_id).toBe('31');
    expect((await module.GetActivity(crm.GetActivityRequest.create({ canonical_id: 'bitrix24:activity:40' }))).ref?.vendor_id).toBe('40');
  });

  it('rejects labeled associations but implements reconciliation RPCs', async () => {
    const fake = adapter({});
    const module = createBitrix24CrmModule({ adapter: fake });

    await expect(module.CreateAssociation(crm.CreateAssociationRequest.create({
      from: { entity_type: 'deal', canonical_id: 'bitrix24:deal:30' },
      to: { entity_type: 'contact', canonical_id: 'bitrix24:contact:10' },
      label: 'decision maker',
    }))).rejects.toMatchObject({ canonicalCode: 'CRM_CONSISTENCY_LABELS_NOT_SUPPORTED' });
    await expect(module.SyncDelta(crm.SyncDeltaRequest.create({ entity_type: 'deal', limit: 1 }))).resolves.toMatchObject({ items: [] });
  });
});
