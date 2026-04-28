import { describe, it, expect } from 'vitest';
import {
  mapContact, mapCompany, mapDeal, mapActivity, mapNote,
  mapPipeline, mapOwner, mapCustomFieldDefinition, mapAssociation,
  canonicalRef, parseCanonicalId,
} from '../../src/mappers.js';

describe('mappers', () => {
  describe('canonicalRef', () => {
    it('builds canonical id from vendor id', () => {
      expect(canonicalRef('contact', 42)).toBe('amocrm:contact:42');
    });
  });

  describe('parseCanonicalId', () => {
    it('parses canonical id into parts', () => {
      const parsed = parseCanonicalId('amocrm:contact:42');
      expect(parsed.entityType).toBe('contact');
      expect(parsed.vendorId).toBe('42');
    });
  });

  describe('mapContact', () => {
    it('maps amoCRM contact to canonical', () => {
      const raw = {
        id: 42,
        name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe',
        responsible_user_id: 99,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T12:00:00Z',
        custom_fields_values: [
          { field_code: 'EMAIL', values: [{ value: 'john@example.com' }] },
          { field_code: 'PHONE', values: [{ value: '+79990000000' }] },
        ],
        _embedded: {
          tags: [{ name: 'vip' }],
        },
      };

      const contact = mapContact(raw);
      expect(contact.ref.canonicalId).toBe('amocrm:contact:42');
      expect(contact.ref.vendorId).toBe('42');
      expect(contact.name.givenName).toBe('John');
      expect(contact.name.familyName).toBe('Doe');
      expect(contact.email).toBe('john@example.com');
      expect(contact.phone).toBe('+79990000000');
      expect(contact.tags).toContain('vip');
      expect(contact.ownerCanonicalId).toBe('amocrm:owner:99');
    });
  });

  describe('mapCompany', () => {
    it('maps amoCRM company to canonical', () => {
      const raw = {
        id: 7,
        name: 'Acme Inc',
        responsible_user_id: 5,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        custom_fields_values: [
          { field_code: 'INN', values: [{ value: '7707083893' }] },
          { field_code: 'OGRN', values: [{ value: '1027700132195' }] },
          { field_code: 'KPP', values: [{ value: '773601001' }] },
        ],
      };

      const company = mapCompany(raw);
      expect(company.ref.canonicalId).toBe('amocrm:company:7');
      expect(company.name).toBe('Acme Inc');
      expect(company.taxId).toBe('7707083893');
      expect(company.registrationId).toBe('1027700132195');
      expect(company.taxBranchId).toBe('773601001');
    });
  });

  describe('mapDeal', () => {
    it('maps amoCRM lead to canonical deal', () => {
      const raw = {
        id: 101,
        name: 'Big Deal',
        price: 50000,
        pipeline_id: 3,
        status_id: 143,
        responsible_user_id: 8,
        created_at: '2024-01-10T09:00:00Z',
        updated_at: '2024-01-11T10:00:00Z',
        currency: 'RUB',
      };

      const deal = mapDeal(raw);
      expect(deal.ref.canonicalId).toBe('amocrm:deal:101');
      expect(deal.name).toBe('Big Deal');
      expect(deal.amount).toBe(50000);
      expect(deal.pipelineCanonicalId).toBe('amocrm:pipeline:3');
      expect(deal.stageCanonicalId).toBe('amocrm:stage:143');
      expect(deal.status).toBe(3);
    });
  });

  describe('mapActivity', () => {
    it('maps amoCRM task to canonical activity', () => {
      const raw = {
        id: 55,
        text: 'Follow up call',
        entity_type: 'leads',
        entity_id: 101,
        responsible_user_id: 3,
        complete_till: '2024-02-01T15:00:00Z',
        is_completed: false,
        created_at: '2024-01-20T10:00:00Z',
        updated_at: '2024-01-20T10:00:00Z',
      };

      const activity = mapActivity(raw);
      expect(activity.ref.canonicalId).toBe('amocrm:activity:55');
      expect(activity.subject).toBe('Follow up call');
      expect(activity.isCompleted).toBe(false);
      expect(activity.outcome).toBe(1);
    });
  });

  describe('mapNote', () => {
    it('maps amoCRM note to canonical', () => {
      const raw = {
        id: 12,
        text: 'Important note',
        entity_type: 'leads',
        entity_id: 101,
        created_by: 3,
        created_at: '2024-01-20T10:00:00Z',
        updated_at: '2024-01-20T10:00:00Z',
      };

      const note = mapNote(raw);
      expect(note.ref.canonicalId).toBe('amocrm:note:12');
      expect(note.content).toBe('Important note');
      expect(note.parent?.entityType).toBe('lead');
    });
  });

  describe('mapPipeline', () => {
    it('maps amoCRM pipeline to canonical', () => {
      const raw = {
        id: 1,
        name: 'Sales Pipeline',
        is_main: true,
        _embedded: {
          statuses: [
            { id: 10, name: 'New', sort: 1, type: 0 },
            { id: 11, name: 'Won', sort: 2, type: 1 },
          ],
        },
      };

      const pipeline = mapPipeline(raw);
      expect(pipeline.canonicalId).toBe('amocrm:pipeline:1');
      expect(pipeline.name).toBe('Sales Pipeline');
      expect(pipeline.isDefault).toBe(true);
      expect(pipeline.stages).toHaveLength(2);
      expect(pipeline.stages[0].name).toBe('New');
      expect(pipeline.stages[1].semantic).toBe(2);
    });
  });

  describe('mapOwner', () => {
    it('maps amoCRM user to canonical owner', () => {
      const raw = { id: 5, name: 'Ivan Petrov' };
      const owner = mapOwner(raw);
      expect(owner.canonicalId).toBe('amocrm:owner:5');
      expect(owner.name.givenName).toBe('Ivan Petrov');
    });
  });

  describe('mapCustomFieldDefinition', () => {
    it('maps amoCRM custom field to canonical', () => {
      const raw = {
        id: 123,
        name: 'Region',
        type: 1,
        code: 'REGION',
      };
      const field = mapCustomFieldDefinition(raw, 'contacts');
      expect(field.entityType).toBe('contacts');
      expect(field.logicalName).toBe('REGION');
      expect(field.vendorKey).toBe('123');
    });
  });

  describe('mapAssociation', () => {
    it('maps amoCRM link to canonical association', () => {
      const raw = {
        from: 'contact',
        to: 'deal',
        from_id: 42,
        to_id: 101,
      };
      const assoc = mapAssociation(raw);
      expect(assoc.from.canonicalId).toBe('amocrm:contact:42');
      expect(assoc.to.canonicalId).toBe('amocrm:deal:101');
      expect(assoc.label).toBe('');
    });
  });
});
