import { describe, expect, it, vi } from 'vitest';
import { suite as crmConformanceSuite } from '@rntme/conformance-crm';
import { proto } from '@rntme/contracts-crm-v1';
import moduleManifest from '../module.json' with { type: 'json' };
import { BITRIX24_SUPPORTED_RPCS, createBitrix24CrmModule } from '../src/index.js';
import type { Bitrix24Adapter } from '../src/adapter.js';

const crm = proto.rntme.contracts.crm.v1;
const ALL_CANONICAL_RPCS = Object.keys(crmConformanceSuite.scenarios);

function fakeAdapter(): Bitrix24Adapter {
  return {
  call: vi.fn(async (method, params) => {
    if (method.endsWith('.get') && params?.id) {
      const entity = method.split('.')[1] ?? 'contact';
      return defaultRecord(entity, String(params.id));
    }
    const defaults: Record<string, unknown> = {
      'crm.contact.get': { ID: '1', NAME: 'Ada' },
      'crm.contact.add': 1,
      'crm.company.get': { ID: '2', TITLE: 'Acme' },
      'crm.company.add': 2,
      'crm.deal.get': { ID: '3', TITLE: 'Deal' },
      'crm.deal.add': 3,
      'crm.activity.get': { ID: '4', SUBJECT: 'Call', OWNER_TYPE_ID: '3', OWNER_ID: '3' },
      'crm.activity.add': 4,
      'crm.timeline.comment.get': { ID: '5', COMMENT: 'Note', ENTITY_TYPE: 'deal', ENTITY_ID: '3' },
      'crm.timeline.comment.add': 5,
    };
    return defaults[method] ?? true;
  }),
  list: vi.fn(async (method) => {
    const defaults: Record<string, Record<string, unknown>[]> = {
      'crm.contact.list': [{ ID: '1', NAME: 'Ada' }],
      'crm.company.list': [{ ID: '2', TITLE: 'Acme' }],
      'crm.deal.list': [{ ID: '3', TITLE: 'Deal' }],
      'crm.activity.list': [{ ID: '4', SUBJECT: 'Call', OWNER_TYPE_ID: '3', OWNER_ID: '3' }],
      'crm.timeline.comment.list': [{ ID: '5', COMMENT: 'Note', ENTITY_TYPE: 'deal', ENTITY_ID: '3' }],
      'crm.category.list': [{ ID: '0', NAME: 'Default', IS_DEFAULT: 'Y' }],
      'crm.status.list': [{ STATUS_ID: 'NEW', NAME: 'New', SORT: '10', SEMANTICS: 'P' }],
      'crm.contact.userfield.list': [{ FIELD_NAME: 'UF_CRM_1', USER_TYPE_ID: 'string', EDIT_FORM_LABEL: 'VIP' }],
    };
    return defaults[method] ?? [];
  }),
  batch: vi.fn(async () => ({})),
  };
}

function defaultRecord(entity: string, id: string): Record<string, unknown> {
  switch (entity) {
    case 'company':
      return { ID: id, TITLE: 'Acme' };
    case 'deal':
      return { ID: id, TITLE: 'Deal', CONTACT_IDS: ['1'] };
    case 'activity':
      return { ID: id, SUBJECT: 'Call', OWNER_TYPE_ID: '3', OWNER_ID: '3' };
    case 'timeline':
      return { ID: id, COMMENT: 'Note', ENTITY_TYPE: 'deal', ENTITY_ID: '3' };
    case 'contact':
    default:
      return { ID: id, NAME: 'Ada' };
  }
}

function requestFor(rpc: string): unknown {
  switch (rpc) {
    case 'GetContact':
      return crm.GetContactRequest.create({ canonical_id: 'bitrix24:contact:1' });
    case 'ListContacts':
      return crm.ListContactsRequest.create();
    case 'CreateContact':
      return crm.CreateContactRequest.create({ email: 'ada@example.com' });
    case 'UpdateContact':
      return crm.UpdateContactRequest.create({ canonical_id: 'bitrix24:contact:1', title: 'CTO' });
    case 'DeleteContact':
      return crm.DeleteContactRequest.create({ canonical_id: 'bitrix24:contact:1' });
    case 'GetCompany':
      return crm.GetCompanyRequest.create({ canonical_id: 'bitrix24:company:2' });
    case 'ListCompanies':
      return crm.ListCompaniesRequest.create();
    case 'CreateCompany':
      return crm.CreateCompanyRequest.create({ name: 'Acme' });
    case 'UpdateCompany':
      return crm.UpdateCompanyRequest.create({ canonical_id: 'bitrix24:company:2', name: 'Acme' });
    case 'DeleteCompany':
      return crm.DeleteCompanyRequest.create({ canonical_id: 'bitrix24:company:2' });
    case 'GetDeal':
      return crm.GetDealRequest.create({ canonical_id: 'bitrix24:deal:3' });
    case 'ListDeals':
      return crm.ListDealsRequest.create();
    case 'CreateDeal':
      return crm.CreateDealRequest.create({ name: 'Deal' });
    case 'UpdateDeal':
      return crm.UpdateDealRequest.create({ canonical_id: 'bitrix24:deal:3', name: 'Deal' });
    case 'DeleteDeal':
      return crm.DeleteDealRequest.create({ canonical_id: 'bitrix24:deal:3' });
    case 'GetActivity':
      return crm.GetActivityRequest.create({ canonical_id: 'bitrix24:activity:4' });
    case 'ListActivities':
      return crm.ListActivitiesRequest.create();
    case 'CreateActivity':
      return crm.CreateActivityRequest.create({ subject: 'Call', linked_entities: [{ entity_type: 'deal', canonical_id: 'bitrix24:deal:3' }] });
    case 'UpdateActivity':
      return crm.UpdateActivityRequest.create({ canonical_id: 'bitrix24:activity:4', subject: 'Call' });
    case 'DeleteActivity':
      return crm.DeleteActivityRequest.create({ canonical_id: 'bitrix24:activity:4' });
    case 'GetNote':
      return crm.GetNoteRequest.create({ canonical_id: 'bitrix24:note:5' });
    case 'ListNotes':
      return crm.ListNotesRequest.create({ parent: { entity_type: 'deal', canonical_id: 'bitrix24:deal:3' } });
    case 'CreateNote':
      return crm.CreateNoteRequest.create({ content: 'Note', parent: { entity_type: 'deal', canonical_id: 'bitrix24:deal:3' } });
    case 'DeleteNote':
      return crm.DeleteNoteRequest.create({ canonical_id: 'bitrix24:note:5' });
    case 'ListPipelines':
      return crm.ListPipelinesRequest.create({ entity_type: 'deal' });
    case 'ListCustomFieldDefinitions':
      return crm.ListCustomFieldDefinitionsRequest.create({ entity_type: 'contact' });
    case 'CreateAssociation':
      return crm.CreateAssociationRequest.create({
        from: { entity_type: 'deal', canonical_id: 'bitrix24:deal:3' },
        to: { entity_type: 'contact', canonical_id: 'bitrix24:contact:1' },
      });
    case 'DeleteAssociation':
      return crm.DeleteAssociationRequest.create({ canonical_id: 'bitrix24:assoc:deal:3:contact:1' });
    case 'ListAssociations':
      return crm.ListAssociationsRequest.create({ from: { entity_type: 'deal', canonical_id: 'bitrix24:deal:3' }, to_entity_type: 'contact' });
    case 'SyncDelta':
      return crm.SyncDeltaRequest.create({ entity_type: 'deal', limit: 10 });
    case 'SubmitJob':
      return crm.SubmitJobRequest.create({ sync_full: { entity_types: ['contact', 'company', 'deal'] } });
    case 'GetJob':
    case 'CancelJob':
      return crm.GetJobRequest.create({ canonical_id: '' });
    case 'ListJobs':
      return crm.ListJobsRequest.create();
    default:
      return {};
  }
}

describe('Bitrix24 CRM conformance wiring', () => {
  it('claims only RPCs present in the shared CRM conformance suite', () => {
    expect(moduleManifest.capabilities.rpcs).toEqual(BITRIX24_SUPPORTED_RPCS);
    for (const rpc of moduleManifest.capabilities.rpcs) {
      expect(ALL_CANONICAL_RPCS).toContain(rpc);
    }
  });

  it('can invoke every claimed canonical RPC with mocked SDK responses', async () => {
    const module = createBitrix24CrmModule({ adapter: fakeAdapter() });
    let lastJobId = '';
    for (const rpc of moduleManifest.capabilities.rpcs) {
      const handler = module[rpc as keyof typeof module] as (request: unknown) => Promise<unknown>;
      const request =
        (rpc === 'GetJob' || rpc === 'CancelJob') && lastJobId
          ? crm.GetJobRequest.create({ canonical_id: lastJobId })
          : requestFor(rpc);
      const result = await handler(request);
      if (rpc === 'SubmitJob') {
        lastJobId = (result as { ref?: { canonical_id?: string | null } }).ref?.canonical_id ?? '';
      }
      expect(result).toBeTruthy();
    }
  });
});
