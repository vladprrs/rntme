import { describe, expect, it } from 'vitest';
import { proto } from '@rntme/contracts-crm-v1';
import {
  canonicalRef,
  mapAmoCompany,
  mapAmoContact,
  mapAmoCustomField,
  mapAmoLead,
  mapAmoNote,
  mapAmoOwner,
  mapAmoPipeline,
  mapAmoStatus,
  mapAmoTask,
  structToJson,
  toStruct,
} from '../../src/mappers.js';

const crm = proto.rntme.contracts.crm.v1;

describe('amoCRM mappers', () => {
  it('maps a contact', () => {
    const raw = {
      id: 123,
      name: 'Alice Smith',
      first_name: 'Alice',
      last_name: 'Smith',
      responsible_user_id: 99,
      created_at: 1609459200,
      updated_at: 1609459200,
      custom_fields_values: [
        { field_code: 'EMAIL', values: [{ value: 'alice@example.com' }] },
        { field_code: 'PHONE', values: [{ value: '+14155551212' }] },
        { field_code: 'POSITION', values: [{ value: 'VP Engineering' }] },
      ],
      _embedded: {
        tags: [{ name: 'vip' }, { name: 'q4-target' }],
        companies: [{ id: 456 }],
      },
    };

    const contact = mapAmoContact(raw);
    expect(contact.ref?.canonical_id).toBe('123');
    expect(contact.email).toBe('alice@example.com');
    expect(contact.phone).toBe('+14155551212');
    expect(contact.name?.given).toBe('Alice');
    expect(contact.name?.family).toBe('Smith');
    expect(contact.title).toBe('VP Engineering');
    expect(contact.company_canonical_id).toBe('456');
    expect(contact.owner_canonical_id).toBe('99');
    expect(contact.tags).toEqual(['vip', 'q4-target']);
    expect(contact.status).toBe(crm.ContactStatus.CONTACT_STATUS_ACTIVE);
    expect(contact.created_at?.seconds).toBe(1609459200);
    expect(structToJson(contact.metadata?.public)).toMatchObject({
      EMAIL: 'alice@example.com',
      PHONE: '+14155551212',
      POSITION: 'VP Engineering',
    });
  });

  it('preserves id-keyed custom field values in public metadata', () => {
    const contact = mapAmoContact({
      id: 123,
      name: 'Alice Smith',
      custom_fields_values: [
        { field_id: 575809, values: [{ value: 'Sales' }] },
      ],
    });

    expect(structToJson(contact.metadata?.public)).toMatchObject({ '575809': 'Sales' });
  });

  it('maps a deleted contact', () => {
    const raw = { id: 123, name: 'Alice', is_deleted: true, updated_at: 1609459200 };
    const contact = mapAmoContact(raw);
    expect(contact.status).toBe(crm.ContactStatus.CONTACT_STATUS_DELETED);
    expect(contact.deleted_at).not.toBeNull();
  });

  it('maps a company', () => {
    const raw = {
      id: 456,
      name: 'Acme Inc',
      responsible_user_id: 99,
      created_at: 1609459200,
      custom_fields_values: [
        { field_code: 'WEB', values: [{ value: 'acme.example' }] },
        { field_code: 'INDUSTRY', values: [{ value: 'Software' }] },
      ],
    };

    const company = mapAmoCompany(raw);
    expect(company.ref?.canonical_id).toBe('456');
    expect(company.name).toBe('Acme Inc');
    expect(company.domain).toBe('acme.example');
    expect(company.industry).toBe('Software');
    expect(company.owner_canonical_id).toBe('99');
  });

  it('maps a lead/deal', () => {
    const raw = {
      id: 789,
      name: 'Acme Q4',
      price: 50000,
      pipeline_id: 100,
      status_id: 200,
      responsible_user_id: 99,
      created_at: 1609459200,
      _embedded: {
        contacts: [{ id: 123 }],
      },
    };

    const deal = mapAmoLead(raw);
    expect(deal.ref?.canonical_id).toBe('789');
    expect(deal.name).toBe('Acme Q4');
    expect(deal.amount).toBe(50000);
    expect(deal.pipeline_canonical_id).toBe('100');
    expect(deal.stage_canonical_id).toBe('200');
    expect(deal.qualification).toBe(crm.DealQualification.DEAL_QUALIFICATION_QUALIFIED);
    expect(deal.status).toBe(crm.DealStatus.DEAL_STATUS_OPEN);
    expect(deal.primary_contact_canonical_id).toBe('123');
  });

  it('maps a closed won deal', () => {
    const raw = { id: 789, name: 'Won Deal', status_type: 'won', closed_at: 1609459200 };
    const deal = mapAmoLead(raw);
    expect(deal.status).toBe(crm.DealStatus.DEAL_STATUS_WON);
    expect(deal.closed_at).not.toBeNull();
  });

  it('maps a task/activity', () => {
    const raw = {
      id: 100,
      text: 'Follow up',
      entity_id: 789,
      entity_type: 'leads',
      responsible_user_id: 99,
      is_completed: true,
      complete_till: 1609459200,
      created_at: 1609459200,
      updated_at: 1609459200,
    };

    const activity = mapAmoTask(raw);
    expect(activity.ref?.canonical_id).toBe('100');
    expect(activity.type).toBe(crm.ActivityType.ACTIVITY_TYPE_TASK);
    expect(activity.subject).toBe('Follow up');
    expect(activity.is_completed).toBe(true);
    expect(activity.outcome).toBe(crm.ActivityOutcome.ACTIVITY_OUTCOME_COMPLETED);
    expect(activity.linked_entities?.[0]?.canonical_id).toBe('789');
  });

  it('maps a note', () => {
    const raw = {
      id: 200,
      text: 'Call notes',
      entity_id: 789,
      entity_type: 'leads',
      responsible_user_id: 99,
      created_at: 1609459200,
    };

    const note = mapAmoNote(raw);
    expect(note.ref?.canonical_id).toBe('200');
    expect(note.content).toBe('Call notes');
    expect(note.parent?.canonical_id).toBe('789');
  });

  it('maps a pipeline', () => {
    const raw = {
      id: 100,
      name: 'Sales Pipeline',
      is_main: true,
      statuses: [
        { id: 10, name: 'New', sort: 1, color: '#99ccff', type: 'pending' },
        { id: 20, name: 'Won', sort: 2, color: '#ccffcc', type: 'won' },
      ],
    };

    const pipeline = mapAmoPipeline(raw);
    expect(pipeline.canonical_id).toBe('100');
    expect(pipeline.name).toBe('Sales Pipeline');
    expect(pipeline.is_default).toBe(true);
    expect(pipeline.stages).toHaveLength(2);
    expect(pipeline.stages?.[0]?.name).toBe('New');
    expect(pipeline.stages?.[1]?.name).toBe('Won');
  });

  it('maps a stage', () => {
    const raw = { id: 20, name: 'Won', sort: 2, pipeline_id: 100, color: '#ccffcc', type: 'won' };
    const stage = mapAmoStatus(raw);
    expect(stage.canonical_id).toBe('20');
    expect(stage.semantic).toBe(crm.StageSemantic.STAGE_SEMANTIC_WON);
    expect(stage.is_terminal).toBe(true);
  });

  it('maps a custom field definition', () => {
    const raw = { id: 300, name: 'Industry', type: 'select', is_required: true, enums: [{ value: 'Tech' }, { value: 'Finance' }] };
    const field = mapAmoCustomField(raw, 'companies');
    expect(field.entity_type).toBe('companies');
    expect(field.logical_name).toBe('Industry');
    expect(field.vendor_key).toBe('300');
    expect(field.field_type).toBe(crm.CustomFieldType.CUSTOM_FIELD_TYPE_ENUM);
    expect(field.options).toEqual(['Tech', 'Finance']);
  });

  it('maps an owner/user', () => {
    const raw = { id: 99, name: 'John Doe', email: 'john@example.com', is_active: true };
    const owner = mapAmoOwner(raw);
    expect(owner.canonical_id).toBe('99');
    expect(owner.email).toBe('john@example.com');
    expect(owner.name?.display).toBe('John Doe');
    expect(owner.is_active).toBe(true);
  });

  it('builds canonical ref', () => {
    const ref = canonicalRef('123', '456');
    expect(ref.canonical_id).toBe('123');
    expect(ref.vendor_id).toBe('456');
  });

  it('converts to struct', () => {
    const struct = toStruct({ foo: 'bar', num: 42 });
    expect(struct.fields?.foo?.stringValue).toBe('bar');
    expect(struct.fields?.num?.numberValue).toBe(42);
  });
});
