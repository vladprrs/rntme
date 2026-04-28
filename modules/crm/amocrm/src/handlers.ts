import { proto } from '@rntme/contracts-crm-v1';
import type { AmoCrmAdapter } from './adapter.js';
import { AMOCRM_SUPPORTED_RPCS } from './capabilities.js';
import { invalidArgument, mapAmoCrmError, unimplemented } from './errors.js';
import {
  mapAmoCompany,
  mapAmoContact,
  mapAmoCustomField,
  mapAmoLead,
  mapAmoNote,
  mapAmoPipeline,
  mapAmoTask,
  mapListMeta,
} from './mappers.js';
import type {
  Activity,
  Association,
  CancelJobRequest,
  Company,
  Contact,
  CreateActivityRequest,
  CreateAssociationRequest,
  CreateCompanyRequest,
  CreateContactRequest,
  CreateDealRequest,
  CreateNoteRequest,
  Deal,
  DeleteActivityRequest,
  DeleteAssociationRequest,
  DeleteCompanyRequest,
  DeleteContactRequest,
  DeleteDealRequest,
  DeleteNoteRequest,
  GetActivityRequest,
  GetCompanyRequest,
  GetContactRequest,
  GetDealRequest,
  GetJobRequest,
  GetNoteRequest,
  JsonObject,
  ListActivitiesRequest,
  ListAssociationsRequest,
  ListCompaniesRequest,
  ListContactsRequest,
  ListCustomFieldDefinitionsRequest,
  ListDealsRequest,
  ListJobsRequest,
  ListNotesRequest,
  ListPipelinesRequest,
  Note,
  SubmitJobRequest,
  SyncDeltaRequest,
  UpdateActivityRequest,
  UpdateCompanyRequest,
  UpdateContactRequest,
  UpdateDealRequest,
} from './types.js';

const crm = proto.rntme.contracts.crm.v1;

type Handler<Request, Response> = (request: Request) => Promise<Response>;

export type AmoCrmModule = {
  GetContact: Handler<GetContactRequest, Contact>;
  ListContacts: Handler<ListContactsRequest, ReturnType<typeof crm.ContactList.create>>;
  CreateContact: Handler<CreateContactRequest, Contact>;
  UpdateContact: Handler<UpdateContactRequest, Contact>;
  DeleteContact: Handler<DeleteContactRequest, Contact>;
  GetCompany: Handler<GetCompanyRequest, Company>;
  ListCompanies: Handler<ListCompaniesRequest, ReturnType<typeof crm.CompanyList.create>>;
  CreateCompany: Handler<CreateCompanyRequest, Company>;
  UpdateCompany: Handler<UpdateCompanyRequest, Company>;
  DeleteCompany: Handler<DeleteCompanyRequest, Company>;
  GetDeal: Handler<GetDealRequest, Deal>;
  ListDeals: Handler<ListDealsRequest, ReturnType<typeof crm.DealList.create>>;
  CreateDeal: Handler<CreateDealRequest, Deal>;
  UpdateDeal: Handler<UpdateDealRequest, Deal>;
  DeleteDeal: Handler<DeleteDealRequest, Deal>;
  GetActivity: Handler<GetActivityRequest, Activity>;
  ListActivities: Handler<ListActivitiesRequest, ReturnType<typeof crm.ActivityList.create>>;
  CreateActivity: Handler<CreateActivityRequest, Activity>;
  UpdateActivity: Handler<UpdateActivityRequest, Activity>;
  DeleteActivity: Handler<DeleteActivityRequest, Activity>;
  GetNote: Handler<GetNoteRequest, Note>;
  ListNotes: Handler<ListNotesRequest, ReturnType<typeof crm.NoteList.create>>;
  CreateNote: Handler<CreateNoteRequest, Note>;
  DeleteNote: Handler<DeleteNoteRequest, Note>;
  ListPipelines: Handler<ListPipelinesRequest, ReturnType<typeof crm.PipelineList.create>>;
  ListCustomFieldDefinitions: Handler<ListCustomFieldDefinitionsRequest, ReturnType<typeof crm.CustomFieldDefinitionList.create>>;
  CreateAssociation: Handler<CreateAssociationRequest, Association>;
  DeleteAssociation: Handler<DeleteAssociationRequest, Association>;
  ListAssociations: Handler<ListAssociationsRequest, ReturnType<typeof crm.AssociationList.create>>;
  SyncDelta: Handler<SyncDeltaRequest, ReturnType<typeof crm.SyncDeltaResponse.create>>;
  SubmitJob: Handler<SubmitJobRequest, ReturnType<typeof crm.AsyncJob.create>>;
  GetJob: Handler<GetJobRequest, ReturnType<typeof crm.AsyncJob.create>>;
  CancelJob: Handler<CancelJobRequest, ReturnType<typeof crm.AsyncJob.create>>;
  ListJobs: Handler<ListJobsRequest, ReturnType<typeof crm.AsyncJobList.create>>;
};

export interface CreateAmoCrmModuleOptions {
  readonly adapter: AmoCrmAdapter;
}

export function createAmoCrmModule(options: CreateAmoCrmModuleOptions): AmoCrmModule {
  const { adapter } = options;

  return {
    GetContact: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('GetContact requires a numeric canonical_id');
        }
        return mapAmoContact(await adapter.getContact(id));
      }, 'CRM_REFERENCES_CONTACT_NOT_FOUND'),

    ListContacts: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 25;
        const page = Math.floor((request.base?.offset ?? 0) / Math.max(limit, 1)) + 1;
        const params: JsonObject = {
          page,
          limit,
          with: ['leads', 'customers', 'catalog_elements'],
        };
        if (request.email) {
          params.query = request.email;
        }
        const response = await adapter.listContacts(params);
        const contacts = (response.data ?? []).map(mapAmoContact);
        const filtered = request.company_canonical_id
          ? contacts.filter((c) => c.company_canonical_id === request.company_canonical_id)
          : contacts;
        return crm.ContactList.create({
          items: filtered,
          meta: mapListMeta(
            filtered.length !== contacts.length ? { data: filtered as unknown as JsonObject[], totalCount: filtered.length } : response,
            limit,
            request.base?.offset ?? 0,
          ),
        });
      }, 'CRM_REFERENCES_CONTACT_NOT_FOUND'),

    CreateContact: async (request) =>
      withErrorMap(async () => {
        if (!request.context?.idempotency_key) {
          throw invalidArgument('CreateContact requires idempotency_key');
        }
        const payload: JsonObject = {
          name: request.name?.display || `${request.name?.given || ''} ${request.name?.family || ''}`.trim(),
          responsible_user_id: request.owner_canonical_id ? Number(request.owner_canonical_id) : undefined,
          custom_fields_values: buildCustomFields([
            { code: 'EMAIL', value: request.email },
            { code: 'PHONE', value: request.phone },
            { code: 'POSITION', value: request.title },
          ]),
        };
        const created = await adapter.createContact([payload]);
        return mapAmoContact(created[0] ?? {});
      }, 'CRM_REFERENCES_CONTACT_NOT_FOUND'),

    UpdateContact: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('UpdateContact requires a numeric canonical_id');
        }
        const payload: JsonObject = { id };
        if (request.name?.display) {
          payload.name = request.name.display;
        }
        if (request.owner_canonical_id) {
          payload.responsible_user_id = Number(request.owner_canonical_id);
        }
        payload.custom_fields_values = buildCustomFields([
          { code: 'EMAIL', value: request.email },
          { code: 'PHONE', value: request.phone },
          { code: 'POSITION', value: request.title },
        ]);
        const updated = await adapter.updateContact([payload]);
        return mapAmoContact(updated[0] ?? {});
      }, 'CRM_REFERENCES_CONTACT_NOT_FOUND'),

    DeleteContact: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('DeleteContact requires a numeric canonical_id');
        }
        const payload: JsonObject = { id, is_deleted: true };
        const updated = await adapter.updateContact([payload]);
        return mapAmoContact(updated[0] ?? {});
      }, 'CRM_REFERENCES_CONTACT_NOT_FOUND'),

    GetCompany: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('GetCompany requires a numeric canonical_id');
        }
        return mapAmoCompany(await adapter.getCompany(id));
      }, 'CRM_REFERENCES_COMPANY_NOT_FOUND'),

    ListCompanies: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 25;
        const page = Math.floor((request.base?.offset ?? 0) / Math.max(limit, 1)) + 1;
        const params: JsonObject = { page, limit };
        if (request.domain) {
          params.query = request.domain;
        }
        const response = await adapter.listCompanies(params);
        const companies = (response.data ?? []).map(mapAmoCompany);
        return crm.CompanyList.create({
          items: companies,
          meta: mapListMeta(response, limit, request.base?.offset ?? 0),
        });
      }, 'CRM_REFERENCES_COMPANY_NOT_FOUND'),

    CreateCompany: async (request) =>
      withErrorMap(async () => {
        if (!request.context?.idempotency_key) {
          throw invalidArgument('CreateCompany requires idempotency_key');
        }
        const payload: JsonObject = {
          name: request.name,
          responsible_user_id: request.owner_canonical_id ? Number(request.owner_canonical_id) : undefined,
          custom_fields_values: buildCustomFields([
            { code: 'WEB', value: request.domain },
            { code: 'INDUSTRY', value: request.industry },
          ]),
        };
        const created = await adapter.createCompany([payload]);
        return mapAmoCompany(created[0] ?? {});
      }, 'CRM_REFERENCES_COMPANY_NOT_FOUND'),

    UpdateCompany: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('UpdateCompany requires a numeric canonical_id');
        }
        const payload: JsonObject = { id };
        if (request.name) {
          payload.name = request.name;
        }
        if (request.owner_canonical_id) {
          payload.responsible_user_id = Number(request.owner_canonical_id);
        }
        payload.custom_fields_values = buildCustomFields([
          { code: 'WEB', value: request.domain },
          { code: 'INDUSTRY', value: request.industry },
        ]);
        const updated = await adapter.updateCompany([payload]);
        return mapAmoCompany(updated[0] ?? {});
      }, 'CRM_REFERENCES_COMPANY_NOT_FOUND'),

    DeleteCompany: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('DeleteCompany requires a numeric canonical_id');
        }
        const payload: JsonObject = { id, is_deleted: true };
        const updated = await adapter.updateCompany([payload]);
        return mapAmoCompany(updated[0] ?? {});
      }, 'CRM_REFERENCES_COMPANY_NOT_FOUND'),

    GetDeal: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('GetDeal requires a numeric canonical_id');
        }
        return mapAmoLead(await adapter.getLead(id));
      }, 'CRM_REFERENCES_DEAL_NOT_FOUND'),

    ListDeals: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 25;
        const page = Math.floor((request.base?.offset ?? 0) / Math.max(limit, 1)) + 1;
        const params: JsonObject = {
          page,
          limit,
          with: ['contacts', 'loss_reason'],
        };
        if (request.pipeline_canonical_id) {
          params.filter = { pipeline_id: [Number(request.pipeline_canonical_id)] };
        }
        if (request.stage_canonical_id) {
          params.filter = { ...(params.filter as JsonObject), status_id: [Number(request.stage_canonical_id)] };
        }
        const response = await adapter.listLeads(params);
        const deals = (response.data ?? []).map(mapAmoLead);
        return crm.DealList.create({
          items: deals,
          meta: mapListMeta(response, limit, request.base?.offset ?? 0),
        });
      }, 'CRM_REFERENCES_DEAL_NOT_FOUND'),

    CreateDeal: async (request) =>
      withErrorMap(async () => {
        if (!request.context?.idempotency_key) {
          throw invalidArgument('CreateDeal requires idempotency_key');
        }
        const payload: JsonObject = {
          name: request.name,
          price: request.amount ?? 0,
          pipeline_id: request.pipeline_canonical_id ? Number(request.pipeline_canonical_id) : undefined,
          status_id: request.stage_canonical_id ? Number(request.stage_canonical_id) : undefined,
          responsible_user_id: request.owner_canonical_id ? Number(request.owner_canonical_id) : undefined,
        };
        if (request.primary_contact_canonical_id) {
          payload.contacts = [{ id: Number(request.primary_contact_canonical_id) }];
        }
        const created = await adapter.createLead([payload]);
        return mapAmoLead(created[0] ?? {});
      }, 'CRM_REFERENCES_DEAL_NOT_FOUND'),

    UpdateDeal: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('UpdateDeal requires a numeric canonical_id');
        }
        const payload: JsonObject = { id };
        if (request.name) {
          payload.name = request.name;
        }
        if (request.amount !== undefined) {
          payload.price = request.amount;
        }
        if (request.pipeline_canonical_id) {
          payload.pipeline_id = Number(request.pipeline_canonical_id);
        }
        if (request.stage_canonical_id) {
          payload.status_id = Number(request.stage_canonical_id);
        }
        if (request.owner_canonical_id) {
          payload.responsible_user_id = Number(request.owner_canonical_id);
        }
        const updated = await adapter.updateLead([payload]);
        return mapAmoLead(updated[0] ?? {});
      }, 'CRM_REFERENCES_DEAL_NOT_FOUND'),

    DeleteDeal: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('DeleteDeal requires a numeric canonical_id');
        }
        const payload: JsonObject = { id, is_deleted: true };
        const updated = await adapter.updateLead([payload]);
        return mapAmoLead(updated[0] ?? {});
      }, 'CRM_REFERENCES_DEAL_NOT_FOUND'),

    GetActivity: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('GetActivity requires a numeric canonical_id');
        }
        return mapAmoTask(await adapter.getTask(id));
      }, 'CRM_REFERENCES_ACTIVITY_NOT_FOUND'),

    ListActivities: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 25;
        const page = Math.floor((request.base?.offset ?? 0) / Math.max(limit, 1)) + 1;
        const params: JsonObject = { page, limit };
        if (request.linked_to?.entity_type && request.linked_to.canonical_id) {
          params.filter = {
            entity_type: request.linked_to.entity_type,
            entity_id: [Number(request.linked_to.canonical_id)],
          };
        }
        const response = await adapter.listTasks(params);
        const activities = (response.data ?? []).map(mapAmoTask);
        return crm.ActivityList.create({
          items: activities,
          meta: mapListMeta(response, limit, request.base?.offset ?? 0),
        });
      }, 'CRM_REFERENCES_ACTIVITY_NOT_FOUND'),

    CreateActivity: async (request) =>
      withErrorMap(async () => {
        if (!request.context?.idempotency_key) {
          throw invalidArgument('CreateActivity requires idempotency_key');
        }
        const linked = request.linked_entities?.[0];
        const payload: JsonObject = {
          text: request.subject || request.description || '',
          responsible_user_id: request.owner_canonical_id ? Number(request.owner_canonical_id) : undefined,
          complete_till: request.due_at ? Math.floor(timestampToSeconds(request.due_at) ?? Date.now() / 1000) : undefined,
          entity_id: linked ? Number(linked.canonical_id) : undefined,
          entity_type: linked ? linked.entity_type : undefined,
        };
        const created = await adapter.createTask([payload]);
        return mapAmoTask(created[0] ?? {});
      }, 'CRM_REFERENCES_ACTIVITY_NOT_FOUND'),

    UpdateActivity: unsupported('UpdateActivity'),

    DeleteActivity: unsupported('DeleteActivity'),

    GetNote: async (request) =>
      withErrorMap(async () => {
        const id = Number(request.canonical_id);
        if (!id) {
          throw invalidArgument('GetNote requires a numeric canonical_id');
        }
        return mapAmoNote(await adapter.getNote('leads', id));
      }, 'CRM_REFERENCES_NOTE_NOT_FOUND'),

    ListNotes: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 25;
        const page = Math.floor((request.base?.offset ?? 0) / Math.max(limit, 1)) + 1;
        const entityType = request.parent?.entity_type || 'leads';
        const params: JsonObject = { page, limit };
        const response = await adapter.listNotes(entityType, params);
        const notes = (response.data ?? []).map(mapAmoNote);
        const filtered = request.parent?.canonical_id
          ? notes.filter((n) => n.parent?.canonical_id === request.parent?.canonical_id)
          : notes;
        return crm.NoteList.create({
          items: filtered,
          meta: mapListMeta(
            filtered.length !== notes.length ? { data: filtered as unknown as JsonObject[], totalCount: filtered.length } : response,
            limit,
            request.base?.offset ?? 0,
          ),
        });
      }, 'CRM_REFERENCES_NOTE_NOT_FOUND'),

    CreateNote: async (request) =>
      withErrorMap(async () => {
        if (!request.context?.idempotency_key) {
          throw invalidArgument('CreateNote requires idempotency_key');
        }
        const entityType = request.parent?.entity_type || 'leads';
        const payload: JsonObject = {
          entity_id: request.parent ? Number(request.parent.canonical_id) : undefined,
          note_type: 'common',
          params: { text: request.content },
        };
        const created = await adapter.createNote(entityType, [payload]);
        return mapAmoNote(created[0] ?? {});
      }, 'CRM_REFERENCES_NOTE_NOT_FOUND'),

    DeleteNote: unsupported('DeleteNote'),

    ListPipelines: async (request) =>
      withErrorMap(async () => {
        const pipelines = await adapter.getPipelines();
        const mapped = pipelines.map(mapAmoPipeline);
        const filtered = request.entity_type ? mapped.filter((p) => p.entity_type === request.entity_type) : mapped;
        return crm.PipelineList.create({
          items: filtered,
          meta: mapListMeta(
            filtered.length !== mapped.length ? { data: filtered, totalCount: filtered.length } : { data: mapped, totalCount: mapped.length },
            request.base?.limit ?? 0,
            request.base?.offset ?? 0,
          ),
        });
      }, 'CRM_REFERENCES_PIPELINE_NOT_FOUND'),

    ListCustomFieldDefinitions: async (request) =>
      withErrorMap(async () => {
        const entityType = request.entity_type || 'contacts';
        const response = await adapter.getCustomFields(entityType);
        const fields = (response.data ?? []).map((f) => mapAmoCustomField(f, entityType));
        return crm.CustomFieldDefinitionList.create({
          items: fields,
          meta: mapListMeta(response, request.base?.limit ?? 0, request.base?.offset ?? 0),
        });
      }, 'CRM_REFERENCES_CONTACT_NOT_FOUND'),

    CreateAssociation: async (request) =>
      withErrorMap(async () => {
        if (request.label) {
          throw invalidArgument('amoCRM does not support labeled associations');
        }
        const fromType = request.from?.entity_type || '';
        const fromId = Number(request.from?.canonical_id);
        const toType = request.to?.entity_type || '';
        const toId = Number(request.to?.canonical_id);
        if (!fromId || !toId) {
          throw invalidArgument('CreateAssociation requires valid from and to entity refs');
        }
        await adapter.createAssociation(fromType, fromId, toType, toId);
        return crm.Association.create({
          ref: { canonical_id: `${fromType}:${fromId}:${toType}:${toId}`, vendor_id: `${fromType}:${fromId}:${toType}:${toId}` },
          from: request.from ?? null,
          to: request.to ?? null,
          category: request.category ?? null,
          label: '',
          metadata: request.metadata ?? null,
        });
      }, 'CRM_CONSISTENCY_LABELS_NOT_SUPPORTED'),

    DeleteAssociation: async (request) =>
      withErrorMap(async () => {
        const canonicalId = request.canonical_id ?? '';
        const parts = canonicalId.split(':');
        if (parts.length !== 4) {
          throw invalidArgument('DeleteAssociation requires canonical_id in format fromType:fromId:toType:toId');
        }
        const [fromType, fromIdStr, toType, toIdStr] = parts as [string, string, string, string];
        await adapter.deleteAssociation(fromType, Number(fromIdStr), toType, Number(toIdStr));
        return crm.Association.create({
          ref: { canonical_id: request.canonical_id || '', vendor_id: request.canonical_id || '' },
        });
      }, 'CRM_REFERENCES_ASSOCIATION_NOT_FOUND'),

    ListAssociations: unsupported('ListAssociations'),

    SyncDelta: unsupported('SyncDelta'),

    SubmitJob: unsupported('SubmitJob'),

    GetJob: unsupported('GetJob'),

    CancelJob: unsupported('CancelJob'),

    ListJobs: unsupported('ListJobs'),
  };
}

export { AMOCRM_SUPPORTED_RPCS };

function unsupported<Request, Response>(rpc: string): Handler<Request, Response> {
  return async () => {
    throw unimplemented(rpc);
  };
}

async function withErrorMap<T>(operation: () => Promise<T>, notFoundCode: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapAmoCrmError(error, notFoundCode);
  }
}

function buildCustomFields(entries: { code: string; value: string | null | undefined }[]): JsonObject[] {
  return entries
    .filter((e) => e.value)
    .map((e) => ({
      field_code: e.code,
      values: [{ value: e.value }],
    }));
}

function timestampToSeconds(timestamp: proto.google.protobuf.ITimestamp | null | undefined): number | undefined {
  if (!timestamp) {
    return undefined;
  }
  const seconds = timestamp.seconds;
  if (typeof seconds === 'number') {
    return seconds;
  }
  if (typeof seconds === 'string') {
    const parsed = Number(seconds);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (seconds && typeof seconds === 'object' && 'toNumber' in seconds && typeof seconds.toNumber === 'function') {
    return seconds.toNumber();
  }
  return undefined;
}
