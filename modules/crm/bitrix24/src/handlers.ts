import {
  ActivityOutcome,
  AsyncJobStatus,
  AsyncJobType,
  CompanyStatus,
  ContactStatus,
  DealStatus,
  SyncDeltaOp,
  proto,
} from '@rntme/contracts-crm-v1';
import { createBitrix24Adapter } from './adapter.js';
import type { Bitrix24Adapter, CreateBitrix24AdapterOptions } from './adapter.js';
import {
  association,
  bitrixEntityMethod,
  canonicalId,
  mapBitrix24Activity,
  mapBitrix24Company,
  mapBitrix24Contact,
  mapBitrix24Deal,
  mapBitrix24Field,
  mapBitrix24Note,
  mapBitrix24Pipeline,
  mapListMeta,
  ownerTypeIdFor,
  stageIdFromCanonical,
  timestamp,
  vendorIdFromCanonical,
} from './mapping.js';
import { invalidRequest, labelsNotSupported, mapBitrix24Error, notFound } from './errors.js';
import type {
  Activity,
  AsyncJob,
  Association,
  Bitrix24Record,
  Company,
  Contact,
  CreateActivityRequest,
  CreateAssociationRequest,
  CreateCompanyRequest,
  CreateContactRequest,
  CreateDealRequest,
  CreateNoteRequest,
  CustomFieldDefinition,
  Deal,
  DeleteActivityRequest,
  DeleteAssociationRequest,
  DeleteCompanyRequest,
  DeleteContactRequest,
  DeleteDealRequest,
  DeleteNoteRequest,
  EntityRef,
  GetActivityRequest,
  GetCompanyRequest,
  GetContactRequest,
  GetDealRequest,
  GetJobRequest,
  GetNoteRequest,
  ListActivitiesRequest,
  ListAssociationsRequest,
  ListCompaniesRequest,
  ListContactsRequest,
  ListCustomFieldDefinitionsRequest,
  ListDealsRequest,
  ListJobsRequest,
  ListNotesRequest,
  ListPipelinesRequest,
  Pipeline,
  SubmitJobRequest,
  SyncDeltaRequest,
  UpdateActivityRequest,
  UpdateCompanyRequest,
  UpdateContactRequest,
  UpdateDealRequest,
} from './types.js';

type ListResult<T> = { items: T[]; meta: ReturnType<typeof mapListMeta> };
type SyncDeltaItem = { canonical_id: string; op: number; entity?: { type_url: string; value: Uint8Array }; changed_at?: ReturnType<typeof timestamp> };

const crm = proto.rntme.contracts.crm.v1;

export interface Bitrix24CrmModule {
  GetContact(request: GetContactRequest): Promise<Contact>;
  ListContacts(request: ListContactsRequest): Promise<ListResult<Contact>>;
  CreateContact(request: CreateContactRequest): Promise<Contact>;
  UpdateContact(request: UpdateContactRequest): Promise<Contact>;
  DeleteContact(request: DeleteContactRequest): Promise<Contact>;
  GetCompany(request: GetCompanyRequest): Promise<Company>;
  ListCompanies(request: ListCompaniesRequest): Promise<ListResult<Company>>;
  CreateCompany(request: CreateCompanyRequest): Promise<Company>;
  UpdateCompany(request: UpdateCompanyRequest): Promise<Company>;
  DeleteCompany(request: DeleteCompanyRequest): Promise<Company>;
  GetDeal(request: GetDealRequest): Promise<Deal>;
  ListDeals(request: ListDealsRequest): Promise<ListResult<Deal>>;
  CreateDeal(request: CreateDealRequest): Promise<Deal>;
  UpdateDeal(request: UpdateDealRequest): Promise<Deal>;
  DeleteDeal(request: DeleteDealRequest): Promise<Deal>;
  GetActivity(request: GetActivityRequest): Promise<Activity>;
  ListActivities(request: ListActivitiesRequest): Promise<ListResult<Activity>>;
  CreateActivity(request: CreateActivityRequest): Promise<Activity>;
  UpdateActivity(request: UpdateActivityRequest): Promise<Activity>;
  DeleteActivity(request: DeleteActivityRequest): Promise<Activity>;
  GetNote(request: GetNoteRequest): Promise<ReturnType<typeof mapBitrix24Note>>;
  ListNotes(request: ListNotesRequest): Promise<ListResult<ReturnType<typeof mapBitrix24Note>>>;
  CreateNote(request: CreateNoteRequest): Promise<ReturnType<typeof mapBitrix24Note>>;
  DeleteNote(request: DeleteNoteRequest): Promise<ReturnType<typeof mapBitrix24Note>>;
  ListPipelines(request: ListPipelinesRequest): Promise<ListResult<Pipeline>>;
  ListCustomFieldDefinitions(request: ListCustomFieldDefinitionsRequest): Promise<ListResult<CustomFieldDefinition>>;
  CreateAssociation(request: CreateAssociationRequest): Promise<Association>;
  DeleteAssociation(request: DeleteAssociationRequest): Promise<Association>;
  ListAssociations(request: ListAssociationsRequest): Promise<ListResult<Association>>;
  SyncDelta(request: SyncDeltaRequest): Promise<{ items: SyncDeltaItem[]; next_cursor: string; watermark?: ReturnType<typeof timestamp> }>;
  SubmitJob(request: SubmitJobRequest): Promise<AsyncJob>;
  GetJob(request: GetJobRequest): Promise<AsyncJob>;
  CancelJob(request: { canonical_id?: string | null }): Promise<AsyncJob>;
  ListJobs(request: ListJobsRequest): Promise<ListResult<AsyncJob>>;
}

export interface CreateBitrix24CrmModuleOptions {
  readonly adapter?: Bitrix24Adapter;
  readonly adapterOptions?: CreateBitrix24AdapterOptions;
  readonly now?: () => Date;
}

export function createBitrix24CrmModule(options: CreateBitrix24CrmModuleOptions = {}): Bitrix24CrmModule {
  const adapter = options.adapter ?? createBitrix24Adapter(options.adapterOptions);
  const jobs = new Map<string, AsyncJob>();
  const now = options.now ?? (() => new Date());

  function requestId(context?: { idempotency_key?: string | null; correlation_id?: string | null } | null): string | undefined {
    return context?.idempotency_key ?? context?.correlation_id ?? undefined;
  }

  async function fetchContact(id: string): Promise<Contact> {
    return mapBitrix24Contact(asRecord(await adapter.call('crm.contact.get', { id: vendorIdFromCanonical(id) }, undefined, 'CRM_REFERENCES_CONTACT_NOT_FOUND')));
  }

  async function fetchCompany(id: string): Promise<Company> {
    return mapBitrix24Company(asRecord(await adapter.call('crm.company.get', { id: vendorIdFromCanonical(id) }, undefined, 'CRM_REFERENCES_COMPANY_NOT_FOUND')));
  }

  async function fetchDeal(id: string): Promise<Deal> {
    return mapBitrix24Deal(asRecord(await adapter.call('crm.deal.get', { id: vendorIdFromCanonical(id) }, undefined, 'CRM_REFERENCES_DEAL_NOT_FOUND')));
  }

  async function fetchActivity(id: string): Promise<Activity> {
    return mapBitrix24Activity(asRecord(await adapter.call('crm.activity.get', { id: vendorIdFromCanonical(id) }, undefined, 'CRM_REFERENCES_ACTIVITY_NOT_FOUND')));
  }

  async function fetchNote(id: string): Promise<ReturnType<typeof mapBitrix24Note>> {
    return mapBitrix24Note(asRecord(await adapter.call('crm.timeline.comment.get', { id: vendorIdFromCanonical(id) }, undefined, 'CRM_REFERENCES_NOTE_NOT_FOUND')));
  }

  return {
    GetContact: async (request) => fetchContact(request.canonical_id ?? ''),
    ListContacts: async (request) => list(request.base, await adapter.list('crm.contact.list', listParams(request.base, contactFilter(request))), mapBitrix24Contact),
    CreateContact: async (request) => {
      const id = await adapter.call('crm.contact.add', { fields: contactFields(request) }, requestId(request.context));
      return fetchContact(String(id));
    },
    UpdateContact: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.contact.update', { id, fields: contactFields(request) }, requestId(request.context), 'CRM_REFERENCES_CONTACT_NOT_FOUND');
      return fetchContact(id);
    },
    DeleteContact: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.contact.delete', { id }, requestId(request.context), 'CRM_REFERENCES_CONTACT_NOT_FOUND');
      return { ref: ref('contact', id), status: ContactStatus.CONTACT_STATUS_DELETED, deleted_at: timestamp(now()) };
    },

    GetCompany: async (request) => fetchCompany(request.canonical_id ?? ''),
    ListCompanies: async (request) => list(request.base, await adapter.list('crm.company.list', listParams(request.base, companyFilter(request))), mapBitrix24Company),
    CreateCompany: async (request) => {
      const id = await adapter.call('crm.company.add', { fields: companyFields(request) }, requestId(request.context));
      return fetchCompany(String(id));
    },
    UpdateCompany: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.company.update', { id, fields: companyFields(request) }, requestId(request.context), 'CRM_REFERENCES_COMPANY_NOT_FOUND');
      return fetchCompany(id);
    },
    DeleteCompany: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.company.delete', { id }, requestId(request.context), 'CRM_REFERENCES_COMPANY_NOT_FOUND');
      return { ref: ref('company', id), status: CompanyStatus.COMPANY_STATUS_DELETED, deleted_at: timestamp(now()) };
    },

    GetDeal: async (request) => fetchDeal(request.canonical_id ?? ''),
    ListDeals: async (request) => list(request.base, await adapter.list('crm.deal.list', listParams(request.base, dealFilter(request))), mapBitrix24Deal),
    CreateDeal: async (request) => {
      const id = await adapter.call('crm.deal.add', { fields: dealFields(request) }, requestId(request.context));
      return fetchDeal(String(id));
    },
    UpdateDeal: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.deal.update', { id, fields: dealFields(request) }, requestId(request.context), 'CRM_REFERENCES_DEAL_NOT_FOUND');
      return fetchDeal(id);
    },
    DeleteDeal: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.deal.delete', { id }, requestId(request.context), 'CRM_REFERENCES_DEAL_NOT_FOUND');
      return { ref: ref('deal', id), status: DealStatus.DEAL_STATUS_DELETED, deleted_at: timestamp(now()) };
    },

    GetActivity: async (request) => fetchActivity(request.canonical_id ?? ''),
    ListActivities: async (request) => list(request.base, await adapter.list('crm.activity.list', listParams(request.base, activityFilter(request))), mapBitrix24Activity),
    CreateActivity: async (request) => {
      const id = await adapter.call('crm.activity.add', { fields: activityFields(request) }, requestId(request.context));
      return fetchActivity(String(id));
    },
    UpdateActivity: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.activity.update', { id, fields: activityFields(request) }, requestId(request.context), 'CRM_REFERENCES_ACTIVITY_NOT_FOUND');
      return fetchActivity(id);
    },
    DeleteActivity: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.activity.delete', { id }, requestId(request.context), 'CRM_REFERENCES_ACTIVITY_NOT_FOUND');
      return { ref: ref('activity', id), outcome: ActivityOutcome.ACTIVITY_OUTCOME_CANCELLED, is_completed: true };
    },

    GetNote: async (request) => fetchNote(request.canonical_id ?? ''),
    ListNotes: async (request) =>
      list(request.base, await adapter.list('crm.timeline.comment.list', listParams(request.base, noteFilter(request))), mapBitrix24Note),
    CreateNote: async (request) => {
      const parent = request.parent;
      if (!parent?.entity_type || !parent.canonical_id) throw invalidRequest('CreateNote requires parent entity');
      const id = await adapter.call(
        'crm.timeline.comment.add',
        {
          fields: {
            ENTITY_TYPE: parent.entity_type,
            ENTITY_ID: vendorIdFromCanonical(parent.canonical_id),
            COMMENT: request.content ?? '',
            AUTHOR_ID: vendorIdFromCanonical(request.author_canonical_id),
          },
        },
        requestId(request.context),
      );
      return fetchNote(String(id));
    },
    DeleteNote: async (request) => {
      const id = vendorIdFromCanonical(request.canonical_id);
      await adapter.call('crm.timeline.comment.delete', { id }, requestId(request.context), 'CRM_REFERENCES_NOTE_NOT_FOUND');
      return {
        ref: ref('note', id),
        content: '',
        title: '',
        parent: undefined,
        author_canonical_id: '',
        created_at: undefined,
        updated_at: timestamp(now()),
        vendor_raw: { fields: { deleted: { boolValue: true } } },
      };
    },

    ListPipelines: async (request) => {
      const categories = await adapter.list('crm.category.list', listParams(request.base, { entityTypeId: 2 }));
      const categoryItems = categories.length ? categories : [{ ID: '0', NAME: 'Default', IS_DEFAULT: 'Y' }];
      const pipelines = await Promise.all(
        categoryItems.map(async (category) => {
          const categoryId = String(category.ID ?? '0');
          const stages = await adapter.list('crm.status.list', { filter: { ENTITY_ID: categoryId === '0' ? 'DEAL_STAGE' : `DEAL_STAGE_${categoryId}` } });
          return mapBitrix24Pipeline(category, stages);
        }),
      );
      return list(request.base, pipelines, (item) => item);
    },
    ListCustomFieldDefinitions: async (request) => {
      const entityType = request.entity_type || 'contact';
      const method = `${bitrixEntityMethod(entityType)}.userfield.list`;
      const fields = await adapter.list(method, listParams(request.base, {}));
      return list(request.base, fields.map((field) => normalizeField(field)), (field) =>
        mapBitrix24Field(entityType, String(field.FIELD_NAME ?? field.ID ?? field.XML_ID ?? ''), field),
      );
    },
    CreateAssociation: async (request) => {
      if (request.label) throw labelsNotSupported();
      await applyAssociation(adapter, request.from, request.to, requestId(request.context));
      return association(request.from, request.to);
    },
    DeleteAssociation: async (request) => {
      const parsed = parseAssociationId(request.canonical_id ?? '');
      if (!parsed) throw notFound('CRM_REFERENCES_ASSOCIATION_NOT_FOUND');
      await removeAssociation(adapter, parsed.from, parsed.to, requestId(request.context));
      return association(parsed.from, parsed.to);
    },
    ListAssociations: async (request) => {
      if (request.label) throw labelsNotSupported();
      const from = request.from;
      if (!from?.entity_type || !from.canonical_id) return list(request.base, [], (item) => item);
      const entity = asRecord(
        await adapter.call(`${bitrixEntityMethod(from.entity_type)}.get`, { id: vendorIdFromCanonical(from.canonical_id) }, undefined, referenceCode(from.entity_type)),
      );
      return list(request.base, associationsFromEntity(from, entity, request.to_entity_type), (item) => item);
    },

    SyncDelta: async (request) => {
      const entityType = (request.entity_type || 'deal').toLowerCase();
      const method = `${bitrixEntityMethod(entityType)}.list`;
      const rows = (await adapter.list(method, {
        filter: request.since ? { '>=DATE_MODIFY': isoFromTimestamp(request.since) } : {},
        start: request.cursor ? Number(request.cursor) : 0,
        order: { DATE_MODIFY: 'ASC' },
      })) ?? [];
      const limited = rows.slice(0, request.limit && request.limit > 0 ? request.limit : rows.length);
      const mapper = mapperFor(entityType);
      return {
        items: limited.map((row) => {
          const entity = mapper(row);
          return {
            canonical_id: entity.ref?.canonical_id ?? '',
            op: SyncDeltaOp.SYNC_DELTA_OP_UPDATED,
            entity: packSyncDeltaEntity(entityType, entity),
            changed_at: timestamp(row.DATE_MODIFY ?? row.UPDATED ?? row.LAST_UPDATED),
          };
        }),
        next_cursor: limited.length < rows.length ? String((Number(request.cursor) || 0) + limited.length) : '',
        watermark: timestamp(now()),
      };
    },
    SubmitJob: async (request) => {
      if (!request.sync_full) throw invalidRequest('Bitrix24 only supports SYNC_FULL async jobs in CRM v1', 'CRM_CONSISTENCY_UNSUPPORTED_ASYNC_JOB_TYPE');
      const id = `sync_full_${Date.now()}_${jobs.size + 1}`;
      const job: AsyncJob = {
        ref: ref('async_job', id),
        type: AsyncJobType.ASYNC_JOB_TYPE_SYNC_FULL,
        status: AsyncJobStatus.ASYNC_JOB_STATUS_RUNNING,
        progress_percentage: 0,
        created_at: timestamp(now()),
      };
      jobs.set(id, job);
      try {
        let recordCount = 0;
        const entityTypes = request.sync_full.entity_types?.length ? request.sync_full.entity_types : ['contact', 'company', 'deal'];
        for (const entityType of entityTypes) {
          recordCount += (await adapter.list(`${bitrixEntityMethod(entityType)}.list`, {})).length;
        }
        const completed = {
          ...job,
          status: AsyncJobStatus.ASYNC_JOB_STATUS_COMPLETED,
          progress_percentage: 100,
          record_count: recordCount,
          completed_at: timestamp(now()),
        };
        jobs.set(id, completed);
        return completed;
      } catch (error) {
        const failed = { ...job, status: AsyncJobStatus.ASYNC_JOB_STATUS_FAILED, error_message: mapBitrix24Error(error).message, completed_at: timestamp(now()) };
        jobs.set(id, failed);
        return failed;
      }
    },
    GetJob: async (request) => getJob(jobs, request.canonical_id),
    CancelJob: async (request) => {
      const job = getJob(jobs, request.canonical_id);
      const cancelled = { ...job, status: AsyncJobStatus.ASYNC_JOB_STATUS_CANCELLED, completed_at: timestamp(now()) };
      jobs.set(vendorIdFromCanonical(job.ref?.canonical_id), cancelled);
      return cancelled;
    },
    ListJobs: async (request) => {
      const items = [...jobs.values()].filter((job) => {
        const requestedType = Number(request.type ?? 0);
        const requestedStatus = Number(request.status ?? 0);
        const typeMatches = requestedType === 0 || job.type === request.type;
        const statusMatches = requestedStatus === 0 || job.status === request.status;
        return typeMatches && statusMatches;
      });
      return list(request.base, items, (item) => item);
    },
  };
}

function list<T, U>(base: { limit?: number | null; offset?: number | null } | null | undefined, rows: T[], mapper: (row: T) => U): ListResult<U> {
  const items = rows.map(mapper);
  return { items, meta: mapListMeta(base, items.length) };
}

function listParams(base: { limit?: number | null; offset?: number | null; cursor?: string | null; filters?: unknown[] | null; sorts?: unknown[] | null } | null | undefined, filter: Bitrix24Record): Bitrix24Record {
  return omitEmpty({
    filter: { ...filter, ...bitrixFilters(base?.filters) },
    order: bitrixSorts(base?.sorts),
    start: base?.cursor ? Number(base.cursor) : base?.offset,
    limit: base?.limit,
  });
}

function contactFields(request: CreateContactRequest | UpdateContactRequest): Bitrix24Record {
  return omitEmpty({
    NAME: request.name?.given,
    LAST_NAME: request.name?.family,
    POST: request.title,
    COMPANY_ID: vendorIdFromCanonical(request.company_canonical_id),
    ASSIGNED_BY_ID: vendorIdFromCanonical(request.owner_canonical_id),
    EMAIL: request.email ? [{ VALUE: request.email, VALUE_TYPE: 'WORK' }] : undefined,
    PHONE: request.phone ? [{ VALUE: request.phone, VALUE_TYPE: 'WORK' }] : undefined,
  });
}

function companyFields(request: CreateCompanyRequest | UpdateCompanyRequest): Bitrix24Record {
  return omitEmpty({
    TITLE: request.name,
    WEB: request.domain ? [{ VALUE: request.domain, VALUE_TYPE: 'WORK' }] : undefined,
    INDUSTRY: request.industry,
    EMPLOYEES: request.employee_count,
    REVENUE: request.annual_revenue,
    CURRENCY_ID: request.currency,
    RQ_INN: request.tax_id,
    RQ_OGRN: request.registration_id,
    RQ_KPP: request.tax_branch_id,
    PARENT_ID: vendorIdFromCanonical(request.parent_company_canonical_id),
    ASSIGNED_BY_ID: vendorIdFromCanonical(request.owner_canonical_id),
  });
}

function dealFields(request: CreateDealRequest | UpdateDealRequest): Bitrix24Record {
  return omitEmpty({
    TITLE: request.name,
    CATEGORY_ID: vendorIdFromCanonical(request.pipeline_canonical_id),
    STAGE_ID: stageIdFromCanonical(request.stage_canonical_id),
    OPPORTUNITY: request.amount,
    CURRENCY_ID: request.currency,
    CLOSEDATE: isoFromTimestamp(request.expected_close_date),
    CONTACT_ID: vendorIdFromCanonical(request.primary_contact_canonical_id),
    COMPANY_ID: vendorIdFromCanonical(request.company_canonical_id),
    ASSIGNED_BY_ID: vendorIdFromCanonical(request.owner_canonical_id),
    SOURCE_ID: 'source' in request ? request.source : undefined,
  });
}

function activityFields(request: CreateActivityRequest | UpdateActivityRequest): Bitrix24Record {
  const linked = request.linked_entities?.[0];
  return omitEmpty({
    TYPE_ID: 'type' in request ? request.type : undefined,
    SUBJECT: request.subject,
    DESCRIPTION: request.description,
    DEADLINE: isoFromTimestamp(request.due_at),
    END_TIME: 'completed_at' in request ? isoFromTimestamp(request.completed_at) : undefined,
    DURATION: request.duration?.seconds,
    OWNER_TYPE_ID: ownerTypeIdFor(linked?.entity_type),
    OWNER_ID: vendorIdFromCanonical(linked?.canonical_id),
    RESPONSIBLE_ID: vendorIdFromCanonical(request.owner_canonical_id),
    COMPLETED: 'outcome' in request && request.outcome === ActivityOutcome.ACTIVITY_OUTCOME_COMPLETED ? 'Y' : undefined,
  });
}

function contactFilter(request: ListContactsRequest): Bitrix24Record {
  return omitEmpty({ COMPANY_ID: vendorIdFromCanonical(request.company_canonical_id), ASSIGNED_BY_ID: vendorIdFromCanonical(request.owner_canonical_id), EMAIL: request.email });
}

function companyFilter(request: ListCompaniesRequest): Bitrix24Record {
  return omitEmpty({ ASSIGNED_BY_ID: vendorIdFromCanonical(request.owner_canonical_id), WEB: request.domain, RQ_INN: request.tax_id });
}

function dealFilter(request: ListDealsRequest): Bitrix24Record {
  return omitEmpty({
    CATEGORY_ID: vendorIdFromCanonical(request.pipeline_canonical_id),
    STAGE_ID: stageIdFromCanonical(request.stage_canonical_id),
    COMPANY_ID: vendorIdFromCanonical(request.company_canonical_id),
    ASSIGNED_BY_ID: vendorIdFromCanonical(request.owner_canonical_id),
  });
}

function activityFilter(request: ListActivitiesRequest): Bitrix24Record {
  return omitEmpty({
    OWNER_TYPE_ID: ownerTypeIdFor(request.linked_to?.entity_type),
    OWNER_ID: vendorIdFromCanonical(request.linked_to?.canonical_id),
    RESPONSIBLE_ID: vendorIdFromCanonical(request.owner_canonical_id),
    TYPE_ID: request.type,
    COMPLETED: request.is_completed ? 'Y' : undefined,
  });
}

function noteFilter(request: ListNotesRequest): Bitrix24Record {
  return omitEmpty({
    ENTITY_TYPE: request.parent?.entity_type,
    ENTITY_ID: vendorIdFromCanonical(request.parent?.canonical_id),
    AUTHOR_ID: vendorIdFromCanonical(request.author_canonical_id),
  });
}

function normalizeField(field: Bitrix24Record): Bitrix24Record {
  return { ...field, FIELD_NAME: field.FIELD_NAME ?? field.ID ?? field.XML_ID };
}

async function applyAssociation(adapter: Bitrix24Adapter, from?: EntityRef | null, to?: EntityRef | null, requestId?: string): Promise<void> {
  if (!from?.entity_type || !from.canonical_id || !to?.entity_type || !to.canonical_id) throw invalidRequest('Association requires from and to references');
  const field = associationField(to.entity_type);
  const fromType = from.entity_type;
  const fromId = vendorIdFromCanonical(from.canonical_id);
  const fields: Bitrix24Record = { [field]: associationValue(to) };
  if (to.entity_type === 'contact') {
    const entity = await getAssociationSource(adapter, from, requestId);
    fields[field] = mergeUnique(contactAssociationIds(entity), vendorIdFromCanonical(to.canonical_id));
  }
  await adapter.call(
    `${bitrixEntityMethod(fromType)}.update`,
    { id: fromId, fields },
    requestId,
    referenceCode(fromType),
  );
}

async function removeAssociation(adapter: Bitrix24Adapter, from: EntityRef, to: EntityRef, requestId?: string): Promise<void> {
  const toType = to.entity_type ?? '';
  const fromType = from.entity_type ?? '';
  const field = associationField(toType);
  const entity = await getAssociationSource(adapter, from, requestId);
  const toId = vendorIdFromCanonical(to.canonical_id);
  const fields: Bitrix24Record =
    toType === 'contact'
      ? { [field]: contactAssociationIds(entity).filter((id) => id !== toId) }
      : String(entity[field] ?? '') === toId
        ? { [field]: '' }
        : {};
  if (Object.keys(fields).length === 0) return;
  await adapter.call(
    `${bitrixEntityMethod(fromType)}.update`,
    { id: vendorIdFromCanonical(from.canonical_id), fields },
    requestId,
    referenceCode(fromType),
  );
}

async function getAssociationSource(adapter: Bitrix24Adapter, from: EntityRef, requestId?: string): Promise<Bitrix24Record> {
  const fromType = from.entity_type ?? '';
  return asRecord(
    await adapter.call(`${bitrixEntityMethod(fromType)}.get`, { id: vendorIdFromCanonical(from.canonical_id) }, requestId, referenceCode(fromType)),
  );
}

function contactAssociationIds(entity: Bitrix24Record): string[] {
  const values = Array.isArray(entity.CONTACT_IDS) ? entity.CONTACT_IDS : entity.CONTACT_ID ? [entity.CONTACT_ID] : [];
  return values.map((value) => String(value)).filter(Boolean);
}

function mergeUnique(values: string[], next: string): string[] {
  return [...new Set([...values, next].filter(Boolean))];
}

function associationsFromEntity(from: EntityRef, entity: Bitrix24Record, toEntityType?: string | null): Association[] {
  const items: Association[] = [];
  if ((!toEntityType || toEntityType === 'company') && entity.COMPANY_ID) {
    items.push(association(from, { entity_type: 'company', canonical_id: canonicalId('company', entity.COMPANY_ID) }));
  }
  if ((!toEntityType || toEntityType === 'contact') && entity.CONTACT_ID) {
    items.push(association(from, { entity_type: 'contact', canonical_id: canonicalId('contact', entity.CONTACT_ID) }));
  }
  if ((!toEntityType || toEntityType === 'contact') && Array.isArray(entity.CONTACT_IDS)) {
    for (const id of entity.CONTACT_IDS) items.push(association(from, { entity_type: 'contact', canonical_id: canonicalId('contact', id) }));
  }
  return items;
}

function associationField(entityType: string): string {
  if (entityType === 'company') return 'COMPANY_ID';
  if (entityType === 'contact') return 'CONTACT_IDS';
  throw invalidRequest(`Bitrix24 association target ${entityType} is not supported`);
}

function associationValue(to: EntityRef): string | string[] {
  const id = vendorIdFromCanonical(to.canonical_id);
  return to.entity_type === 'contact' ? [id] : id;
}

function parseAssociationId(canonicalIdValue: string): { from: EntityRef; to: EntityRef } | null {
  const id = vendorIdFromCanonical(canonicalIdValue);
  const [fromType, fromId, toType, toId] = id.split(':');
  if (!fromType || !fromId || !toType || !toId) return null;
  return { from: { entity_type: fromType, canonical_id: canonicalId(fromType, fromId) }, to: { entity_type: toType, canonical_id: canonicalId(toType, toId) } };
}

function bitrixFilters(filters: unknown[] | null | undefined): Bitrix24Record {
  if (!Array.isArray(filters)) return {};
  const result: Bitrix24Record = {};
  for (const filter of filters) {
    if (!filter || typeof filter !== 'object') continue;
    const item = filter as { field?: string | null; operator?: number | null; value?: string | null; values?: string[] | null };
    if (!item.field) continue;
    const key = filterOperatorPrefix(item.operator) + item.field;
    result[key] = item.values?.length ? item.values : item.value;
  }
  return result;
}

function bitrixSorts(sorts: unknown[] | null | undefined): Bitrix24Record | undefined {
  if (!Array.isArray(sorts) || sorts.length === 0) return undefined;
  return Object.fromEntries(
    sorts
      .filter((sort): sort is { field: string; direction?: number | null } => Boolean(sort && typeof sort === 'object' && (sort as { field?: unknown }).field))
      .map((sort) => [sort.field, sort.direction === 2 ? 'DESC' : 'ASC']),
  );
}

function filterOperatorPrefix(operator: number | null | undefined): string {
  switch (operator) {
    case 2:
      return '!';
    case 3:
      return '>';
    case 4:
      return '>=';
    case 5:
      return '<';
    case 6:
      return '<=';
    case 9:
      return '%';
    case 10:
      return '=%';
    default:
      return '';
  }
}

function mapperFor(entityType: string): (row: Bitrix24Record) => { ref?: { canonical_id?: string | null } } {
  switch (entityType) {
    case 'contact':
      return mapBitrix24Contact;
    case 'company':
      return mapBitrix24Company;
    case 'activity':
      return mapBitrix24Activity;
    case 'note':
      return mapBitrix24Note;
    case 'deal':
    default:
      return mapBitrix24Deal;
  }
}

function packSyncDeltaEntity(entityType: string, entity: unknown): { type_url: string; value: Uint8Array } {
  switch (entityType) {
    case 'contact':
      return { type_url: crm.Contact.getTypeUrl(), value: crm.Contact.encode(entity as Contact).finish() };
    case 'company':
      return { type_url: crm.Company.getTypeUrl(), value: crm.Company.encode(entity as Company).finish() };
    case 'activity':
      return { type_url: crm.Activity.getTypeUrl(), value: crm.Activity.encode(entity as Activity).finish() };
    case 'note':
      return { type_url: crm.Note.getTypeUrl(), value: crm.Note.encode(entity as ReturnType<typeof mapBitrix24Note>).finish() };
    case 'deal':
    default:
      return { type_url: crm.Deal.getTypeUrl(), value: crm.Deal.encode(entity as Deal).finish() };
  }
}

function getJob(jobs: Map<string, AsyncJob>, canonicalIdValue?: string | null): AsyncJob {
  const job = jobs.get(vendorIdFromCanonical(canonicalIdValue));
  if (!job) throw notFound('CRM_REFERENCES_ASYNC_JOB_NOT_FOUND');
  return job;
}

function ref(entityType: string, vendorId: string) {
  return {
    canonical_id: canonicalId(entityType, vendorId),
    vendor_id: vendorId,
    module_name: '@rntme/crm-bitrix24',
    module_version: '0.0.0',
    contract_version: 'crm/v1',
  };
}

function referenceCode(entityType: string): string {
  switch (entityType) {
    case 'company':
      return 'CRM_REFERENCES_COMPANY_NOT_FOUND';
    case 'deal':
      return 'CRM_REFERENCES_DEAL_NOT_FOUND';
    case 'activity':
      return 'CRM_REFERENCES_ACTIVITY_NOT_FOUND';
    case 'note':
      return 'CRM_REFERENCES_NOTE_NOT_FOUND';
    case 'contact':
    default:
      return 'CRM_REFERENCES_CONTACT_NOT_FOUND';
  }
}

function omitEmpty(input: Bitrix24Record): Bitrix24Record {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)));
}

function asRecord(value: unknown): Bitrix24Record {
  return typeof value === 'object' && value !== null ? (value as Bitrix24Record) : {};
}

function isoFromTimestamp(value: { seconds?: number | { toNumber(): number } | null; nanos?: number | null } | null | undefined): string | undefined {
  if (!value?.seconds) return undefined;
  const seconds = typeof value.seconds === 'number' ? value.seconds : value.seconds.toNumber();
  return new Date(seconds * 1000 + Math.floor((value.nanos ?? 0) / 1_000_000)).toISOString();
}
