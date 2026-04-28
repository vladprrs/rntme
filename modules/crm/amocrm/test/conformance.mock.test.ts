import { describe, expect, it } from 'vitest';
import { suite as crmConformanceSuite } from '@rntme/conformance-crm';
import { proto } from '@rntme/contracts-crm-v1';
import moduleManifest from '../module.json' with { type: 'json' };
import { GRPC_STATUS_UNIMPLEMENTED, createAmoCrmModule } from '../src/index.js';
import type { AmoCrmAdapter } from '../src/adapter.js';

const crm = proto.rntme.contracts.crm.v1;

const ALL_CANONICAL_RPCS = Object.keys(crmConformanceSuite.scenarios);

const fakeAdapter: AmoCrmAdapter = {
  getContact: async (id) => ({ id, name: 'Alice', created_at: Math.floor(Date.now() / 1000) }),
  listContacts: async () => ({ data: [{ id: 123, name: 'Alice' }], totalCount: 1 }),
  createContact: async () => [{ id: 124, name: 'Bob', created_at: Math.floor(Date.now() / 1000) }],
  updateContact: async () => [{ id: 123, name: 'Alice Updated', updated_at: Math.floor(Date.now() / 1000) }],

  getCompany: async (id) => ({ id, name: 'Acme', created_at: Math.floor(Date.now() / 1000) }),
  listCompanies: async () => ({ data: [{ id: 456, name: 'Acme' }], totalCount: 1 }),
  createCompany: async () => [{ id: 457, name: 'Globex', created_at: Math.floor(Date.now() / 1000) }],
  updateCompany: async () => [{ id: 456, name: 'Acme Updated', updated_at: Math.floor(Date.now() / 1000) }],

  getLead: async (id) => ({ id, name: 'Deal 1', created_at: Math.floor(Date.now() / 1000) }),
  listLeads: async () => ({ data: [{ id: 789, name: 'Deal 1' }], totalCount: 1 }),
  createLead: async () => [{ id: 790, name: 'Deal 2', created_at: Math.floor(Date.now() / 1000) }],
  updateLead: async () => [{ id: 789, name: 'Deal 1 Updated', updated_at: Math.floor(Date.now() / 1000) }],

  getTask: async (id) => ({ id, text: 'Task 1', created_at: Math.floor(Date.now() / 1000) }),
  listTasks: async () => ({ data: [{ id: 100, text: 'Task 1' }], totalCount: 1 }),
  createTask: async () => [{ id: 101, text: 'Task 2', created_at: Math.floor(Date.now() / 1000) }],

  getNote: async () => ({ id: 200, text: 'Note 1', created_at: Math.floor(Date.now() / 1000) }),
  listNotes: async () => ({ data: [{ id: 200, text: 'Note 1' }], totalCount: 1 }),
  createNote: async () => [{ id: 201, text: 'Note 2', created_at: Math.floor(Date.now() / 1000) }],

  getPipelines: async () => [{ id: 1, name: 'Pipeline 1', statuses: [], is_main: true }],
  getCustomFields: async () => ({ data: [{ id: 1, name: 'Field 1', type: 'text' }], totalCount: 1 }),
  getUsers: async () => ({ data: [{ id: 99, name: 'User 1' }], totalCount: 1 }),

  createAssociation: async () => ({}),
  deleteAssociation: async () => undefined,
};

function requestFor(rpc: string): unknown {
  switch (rpc) {
    case 'GetContact':
      return crm.GetContactRequest.create({ canonical_id: '123' });
    case 'ListContacts':
      return crm.ListContactsRequest.create();
    case 'CreateContact':
      return crm.CreateContactRequest.create({ context: { idempotency_key: 'idem_1' }, email: 'new@example.com' });
    case 'UpdateContact':
      return crm.UpdateContactRequest.create({ canonical_id: '123' });
    case 'DeleteContact':
      return crm.DeleteContactRequest.create({ canonical_id: '123' });
    case 'GetCompany':
      return crm.GetCompanyRequest.create({ canonical_id: '456' });
    case 'ListCompanies':
      return crm.ListCompaniesRequest.create();
    case 'CreateCompany':
      return crm.CreateCompanyRequest.create({ context: { idempotency_key: 'idem_1' }, name: 'Acme' });
    case 'UpdateCompany':
      return crm.UpdateCompanyRequest.create({ canonical_id: '456' });
    case 'DeleteCompany':
      return crm.DeleteCompanyRequest.create({ canonical_id: '456' });
    case 'GetDeal':
      return crm.GetDealRequest.create({ canonical_id: '789' });
    case 'ListDeals':
      return crm.ListDealsRequest.create();
    case 'CreateDeal':
      return crm.CreateDealRequest.create({ context: { idempotency_key: 'idem_1' }, name: 'New Deal' });
    case 'UpdateDeal':
      return crm.UpdateDealRequest.create({ canonical_id: '789' });
    case 'DeleteDeal':
      return crm.DeleteDealRequest.create({ canonical_id: '789' });
    case 'GetActivity':
      return crm.GetActivityRequest.create({ canonical_id: '100' });
    case 'ListActivities':
      return crm.ListActivitiesRequest.create();
    case 'CreateActivity':
      return crm.CreateActivityRequest.create({ context: { idempotency_key: 'idem_1' }, subject: 'Task' });
    case 'UpdateActivity':
      return crm.UpdateActivityRequest.create({ canonical_id: '100' });
    case 'DeleteActivity':
      return crm.DeleteActivityRequest.create({ canonical_id: '100' });
    case 'GetNote':
      return crm.GetNoteRequest.create({ canonical_id: '200' });
    case 'ListNotes':
      return crm.ListNotesRequest.create();
    case 'CreateNote':
      return crm.CreateNoteRequest.create({ context: { idempotency_key: 'idem_1' }, content: 'Note' });
    case 'DeleteNote':
      return crm.DeleteNoteRequest.create({ canonical_id: '200' });
    case 'ListPipelines':
      return crm.ListPipelinesRequest.create();
    case 'ListCustomFieldDefinitions':
      return crm.ListCustomFieldDefinitionsRequest.create({ entity_type: 'contacts' });
    case 'CreateAssociation':
      return crm.CreateAssociationRequest.create({
        from: { entity_type: 'contact', canonical_id: '123' },
        to: { entity_type: 'company', canonical_id: '456' },
      });
    case 'DeleteAssociation':
      return crm.DeleteAssociationRequest.create({ canonical_id: 'contact:123:company:456' });
    case 'ListAssociations':
      return crm.ListAssociationsRequest.create();
    case 'SyncDelta':
      return crm.SyncDeltaRequest.create({ entity_type: 'contact' });
    case 'SubmitJob':
      return crm.SubmitJobRequest.create({ context: { idempotency_key: 'idem_1' } });
    case 'GetJob':
      return crm.GetJobRequest.create({ canonical_id: 'job_1' });
    case 'CancelJob':
      return crm.CancelJobRequest.create({ canonical_id: 'job_1' });
    case 'ListJobs':
      return crm.ListJobsRequest.create();
    default:
      return {};
  }
}

describe('mock CRM conformance wiring', () => {
  it('claims only RPCs present in the shared conformance suite', () => {
    expect(moduleManifest.capabilities.rpcs).not.toHaveLength(0);
    expect(moduleManifest.capabilities.rpcs).toEqual(expect.arrayContaining(['GetContact', 'CreateContact', 'ListPipelines']));

    for (const rpc of moduleManifest.capabilities.rpcs) {
      expect(ALL_CANONICAL_RPCS).toContain(rpc);
    }
  });

  it('declares only fully-qualified emitted CloudEvent types and no async jobs', () => {
    expect(moduleManifest.capabilities.events).toEqual([
      'rntme.crm.v1.ContactCreated',
      'rntme.crm.v1.ContactUpdated',
      'rntme.crm.v1.ContactDeleted',
      'rntme.crm.v1.CompanyCreated',
      'rntme.crm.v1.CompanyUpdated',
      'rntme.crm.v1.CompanyDeleted',
      'rntme.crm.v1.DealCreated',
      'rntme.crm.v1.DealUpdated',
      'rntme.crm.v1.DealStageChanged',
      'rntme.crm.v1.DealClosed',
      'rntme.crm.v1.ActivityCreated',
      'rntme.crm.v1.ActivityUpdated',
      'rntme.crm.v1.ActivityDeleted',
      'rntme.crm.v1.NoteCreated',
      'rntme.crm.v1.NoteDeleted',
    ]);
    expect(moduleManifest.capabilities.async_job_types).toEqual([]);
  });

  it('returns UNIMPLEMENTED for every unsupported canonical RPC', async () => {
    const module = createAmoCrmModule({ adapter: fakeAdapter });

    for (const rpc of ALL_CANONICAL_RPCS) {
      if (moduleManifest.capabilities.rpcs.includes(rpc)) {
        continue;
      }

      const handler = module[rpc as keyof typeof module] as (request: unknown) => Promise<unknown>;
      await expect(handler(requestFor(rpc))).rejects.toMatchObject({ code: GRPC_STATUS_UNIMPLEMENTED });
    }
  });

  it('can execute every claimed RPC without throwing', async () => {
    const module = createAmoCrmModule({ adapter: fakeAdapter });

    for (const rpc of moduleManifest.capabilities.rpcs) {
      const handler = module[rpc as keyof typeof module] as (request: unknown) => Promise<unknown>;
      const result = await handler(requestFor(rpc));
      expect(result).toBeDefined();
    }
  });
});
