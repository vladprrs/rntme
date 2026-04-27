import { describe, expect, it } from 'vitest';
import { ContactStatus, DealStatus, StageSemantic } from '@rntme/contracts-crm-v1';
import {
  mapBitrix24Activity,
  mapBitrix24Company,
  mapBitrix24Contact,
  mapBitrix24Deal,
  mapBitrix24Field,
  mapBitrix24Owner,
  mapBitrix24Pipeline,
} from '../src/mapping.js';

describe('Bitrix24 CRM mapping', () => {
  it('maps contacts with owner/company refs, timestamps, custom fields, and raw payload', () => {
    const contact = mapBitrix24Contact({
      ID: '10',
      NAME: 'Ada',
      LAST_NAME: 'Lovelace',
      EMAIL: [{ VALUE: 'ada@example.com' }],
      PHONE: [{ VALUE: '+15551234567' }],
      COMPANY_ID: '20',
      ASSIGNED_BY_ID: '7',
      POST: 'CTO',
      DATE_CREATE: '2026-04-01T10:00:00+00:00',
      DATE_MODIFY: '2026-04-02T10:00:00+00:00',
      UF_CRM_1: 'vip',
    });

    expect(contact.ref?.canonical_id).toBe('bitrix24:contact:10');
    expect(contact.ref?.vendor_id).toBe('10');
    expect(contact.email).toBe('ada@example.com');
    expect(contact.name?.display).toBe('Ada Lovelace');
    expect(contact.company_canonical_id).toBe('bitrix24:company:20');
    expect(contact.owner_canonical_id).toBe('bitrix24:owner:7');
    expect(contact.status).toBe(ContactStatus.CONTACT_STATUS_ACTIVE);
    expect((contact.vendor_raw?.fields?.UF_CRM_1 as { stringValue?: string } | undefined)?.stringValue).toBe('vip');
  });

  it('maps companies, deals, activities, owners, fields, and pipeline stages', () => {
    const company = mapBitrix24Company({ ID: '20', TITLE: 'Acme', WEB: [{ VALUE: 'https://acme.example' }], ASSIGNED_BY_ID: '7' });
    const deal = mapBitrix24Deal({
      ID: '30',
      TITLE: 'Renewal',
      CATEGORY_ID: '2',
      STAGE_ID: 'C2:WON',
      STAGE_SEMANTIC_ID: 'S',
      OPPORTUNITY: '99.5',
      CURRENCY_ID: 'USD',
      CONTACT_ID: '10',
      COMPANY_ID: '20',
      ASSIGNED_BY_ID: '7',
    });
    const activity = mapBitrix24Activity({
      ID: '40',
      TYPE_ID: '2',
      SUBJECT: 'Call',
      COMPLETED: 'Y',
      OWNER_TYPE_ID: '2',
      OWNER_ID: '30',
      RESPONSIBLE_ID: '7',
    });
    const owner = mapBitrix24Owner({ ID: '7', EMAIL: 'owner@example.com', NAME: 'Grace', LAST_NAME: 'Hopper', ACTIVE: true });
    const field = mapBitrix24Field('contact', 'UF_CRM_1', { title: 'VIP', type: 'enumeration', isRequired: true, items: [{ VALUE: 'Yes' }] });
    const pipeline = mapBitrix24Pipeline(
      { ID: '2', NAME: 'Sales', IS_DEFAULT: 'N' },
      [{ STATUS_ID: 'C2:WON', NAME: 'Won', SORT: '20', SEMANTICS: 'S' }],
    );

    expect(company.ref?.canonical_id).toBe('bitrix24:company:20');
    expect(company.domain).toBe('acme.example');
    expect(deal.status).toBe(DealStatus.DEAL_STATUS_WON);
    expect(deal.stage_canonical_id).toBe('bitrix24:stage:2:C2:WON');
    expect(activity.linked_entities?.[0]).toMatchObject({ entity_type: 'deal', canonical_id: 'bitrix24:deal:30' });
    expect(owner.name?.display).toBe('Grace Hopper');
    expect(field.field_type).toBe(6);
    expect(field.options).toEqual(['Yes']);
    expect(pipeline.stages?.[0]?.semantic).toBe(StageSemantic.STAGE_SEMANTIC_WON);
  });
});
