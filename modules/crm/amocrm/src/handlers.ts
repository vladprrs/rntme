import type { AmoCrmAdapter } from './adapter.js';
import type { IdempotencyStore, JsonObject } from './types.js';
import { AmoCrmError, unimplemented, invalidArgument } from './errors.js';
import {
  mapContact, mapCompany, mapDeal, mapActivity, mapNote,
  mapPipeline, mapCustomFieldDefinition, mapAssociation,
  parseCanonicalId,
} from './mappers.js';

export interface CreateAmoCrmModuleOptions {
  readonly adapter: AmoCrmAdapter;
  readonly idempotencyStore: IdempotencyStore;
}

export interface AmoCrmModule {
  getContact(params: { canonicalId: string }): Promise<unknown>;
  listContacts(params: { base?: unknown }): Promise<unknown>;
  createContact(params: { context?: unknown; email?: string; phone?: string; name?: unknown; title?: string; companyCanonicalId?: string; ownerCanonicalId?: string; tags?: string[]; metadata?: unknown }): Promise<unknown>;
  updateContact(params: { context?: unknown; canonicalId: string; email?: string; phone?: string; name?: unknown; title?: string; companyCanonicalId?: string; ownerCanonicalId?: string; tags?: string[]; status?: number; metadata?: unknown }): Promise<unknown>;
  deleteContact(params: { context?: unknown; canonicalId: string; hardDelete?: boolean }): Promise<unknown>;

  getCompany(params: { canonicalId: string }): Promise<unknown>;
  listCompanies(params: { base?: unknown }): Promise<unknown>;
  createCompany(params: { context?: unknown; name?: string; domain?: string; industry?: string; employeeCount?: number; annualRevenue?: number; currency?: string; taxId?: string; registrationId?: string; taxBranchId?: string; parentCompanyCanonicalId?: string; ownerCanonicalId?: string; tags?: string[]; metadata?: unknown }): Promise<unknown>;
  updateCompany(params: { context?: unknown; canonicalId: string; name?: string; domain?: string; industry?: string; employeeCount?: number; annualRevenue?: number; currency?: string; taxId?: string; registrationId?: string; taxBranchId?: string; parentCompanyCanonicalId?: string; ownerCanonicalId?: string; tags?: string[]; status?: number; metadata?: unknown }): Promise<unknown>;
  deleteCompany(params: { context?: unknown; canonicalId: string; hardDelete?: boolean }): Promise<unknown>;

  getDeal(params: { canonicalId: string }): Promise<unknown>;
  listDeals(params: { base?: unknown; pipelineCanonicalId?: string; stageCanonicalId?: string; ownerCanonicalId?: string; status?: number }): Promise<unknown>;
  createDeal(params: { context?: unknown; name?: string; pipelineCanonicalId?: string; stageCanonicalId?: string; status?: number; qualification?: number; amount?: number; currency?: string; probability?: number; expectedCloseDate?: unknown; closeReason?: string; primaryContactCanonicalId?: string; companyCanonicalId?: string; ownerCanonicalId?: string; tags?: string[]; metadata?: unknown }): Promise<unknown>;
  updateDeal(params: { context?: unknown; canonicalId: string; name?: string; pipelineCanonicalId?: string; stageCanonicalId?: string; status?: number; qualification?: number; amount?: number; currency?: string; expectedCloseDate?: unknown; closeReason?: string; primaryContactCanonicalId?: string; companyCanonicalId?: string; ownerCanonicalId?: string; tags?: string[]; metadata?: unknown }): Promise<unknown>;
  deleteDeal(params: { context?: unknown; canonicalId: string; hardDelete?: boolean }): Promise<unknown>;

  getActivity(params: { canonicalId: string }): Promise<unknown>;
  listActivities(params: { base?: unknown; entityType?: string; entityCanonicalId?: string; ownerCanonicalId?: string; status?: number }): Promise<unknown>;
  createActivity(params: { context?: unknown; type?: number; subject?: string; description?: string; dueAt?: unknown; completedAt?: unknown; duration?: unknown; outcome?: number; linkedEntities?: unknown[]; ownerCanonicalId?: string; metadata?: unknown }): Promise<unknown>;
  updateActivity(params: { context?: unknown; canonicalId: string; type?: number; subject?: string; description?: string; dueAt?: unknown; completedAt?: unknown; duration?: unknown; outcome?: number; isCompleted?: boolean; linkedEntities?: unknown[]; ownerCanonicalId?: string; metadata?: unknown }): Promise<unknown>;
  deleteActivity(params: { context?: unknown; canonicalId: string }): Promise<unknown>;

  getNote(params: { canonicalId: string }): Promise<unknown>;
  listNotes(params: { base?: unknown; parentCanonicalId?: string; authorCanonicalId?: string }): Promise<unknown>;
  createNote(params: { context?: unknown; content?: string; title?: string; parent?: unknown; authorCanonicalId?: string; metadata?: unknown }): Promise<unknown>;
  deleteNote(params: { context?: unknown; canonicalId: string }): Promise<unknown>;

  listPipelines(): Promise<unknown>;
  listCustomFieldDefinitions(params: { entityType?: string }): Promise<unknown>;
  listAssociations(params: { base?: unknown; from?: unknown; toEntityType?: string; label?: string }): Promise<unknown>;
  createAssociation(params: { context?: unknown; from?: unknown; to?: unknown; category?: number; label?: string; metadata?: unknown }): Promise<unknown>;
  deleteAssociation(params: { context?: unknown; canonicalId: string }): Promise<unknown>;

  syncDelta(params: { context?: unknown; entityType?: string; since?: unknown; cursor?: string; limit?: number }): Promise<unknown>;

  submitJob(params: { context?: unknown; body?: unknown; ttl?: unknown }): Promise<unknown>;
  getJob(params: { canonicalId: string }): Promise<unknown>;
  cancelJob(params: { context?: unknown; canonicalId: string }): Promise<unknown>;
  listJobs(params: { base?: unknown; type?: number; status?: number }): Promise<unknown>;
}

export function createAmoCrmModule(options: CreateAmoCrmModuleOptions): AmoCrmModule {
  const { adapter, idempotencyStore } = options;

  async function checkIdempotency(context: unknown): Promise<void> {
    const ctx = context as Record<string, unknown> | undefined;
    const key = ctx?.idempotencyKey as string | undefined;
    if (!key) {
      throw invalidArgument('idempotency_key is required');
    }
    const seen = await idempotencyStore.get(key);
    if (seen) {
      throw new AmoCrmError('Duplicate idempotency key', 6, 'CRM_CONSISTENCY_DUPLICATE');
    }
    await idempotencyStore.set(key, 24 * 60 * 60 * 1000);
  }

  return {
    getContact: async (params) => {
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const raw = await adapter.getContact(Number(vendorId));
      return mapContact(raw);
    },

    listContacts: async (params) => {
      const base = (params.base ?? {}) as Record<string, unknown>;
      const page = Number(base.page ?? 1);
      const limit = Number(base.limit ?? 25);
      const result = await adapter.listContacts({ page, limit });
      return {
        items: result.data.map(mapContact),
        meta: { totalCount: result.totalCount, nextCursor: '' },
      };
    },

    createContact: async (params) => {
      await checkIdempotency(params.context);
      const payload: JsonObject = {};
      const givenName = (params.name as Record<string, string> | undefined)?.givenName ?? '';
      const familyName = (params.name as Record<string, string> | undefined)?.familyName ?? '';
      payload.name = `${givenName} ${familyName}`.trim();
      payload.first_name = givenName;
      payload.last_name = familyName;
      if (params.ownerCanonicalId) {
        payload.responsible_user_id = Number(parseCanonicalId(params.ownerCanonicalId).vendorId);
      }
      payload.custom_fields_values = buildCustomFieldsValues({ EMAIL: params.email, PHONE: params.phone, POSITION: params.title });
      const [created] = await adapter.addContacts([payload]);
      return mapContact(created);
    },

    updateContact: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const payload: JsonObject = { id: Number(vendorId) };
      if (params.name) {
        const givenName = (params.name as Record<string, string>).givenName ?? '';
        const familyName = (params.name as Record<string, string>).familyName ?? '';
        payload.name = `${givenName} ${familyName}`.trim();
        payload.first_name = givenName;
        payload.last_name = familyName;
      }
      if (params.ownerCanonicalId) {
        payload.responsible_user_id = Number(parseCanonicalId(params.ownerCanonicalId).vendorId);
      }
      payload.custom_fields_values = buildCustomFieldsValues({ EMAIL: params.email, PHONE: params.phone, POSITION: params.title });
      const [updated] = await adapter.updateContacts([payload]);
      return mapContact(updated);
    },

    deleteContact: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      return { canonicalId: params.canonicalId, vendorId, status: 2 };
    },

    getCompany: async (params) => {
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const raw = await adapter.getCompany(Number(vendorId));
      return mapCompany(raw);
    },

    listCompanies: async (params) => {
      const base = (params.base ?? {}) as Record<string, unknown>;
      const page = Number(base.page ?? 1);
      const limit = Number(base.limit ?? 25);
      const result = await adapter.listCompanies({ page, limit });
      return {
        items: result.data.map(mapCompany),
        meta: { totalCount: result.totalCount, nextCursor: '' },
      };
    },

    createCompany: async (params) => {
      await checkIdempotency(params.context);
      const payload: JsonObject = {};
      if (params.name !== undefined) payload.name = params.name;
      if (params.ownerCanonicalId) {
        payload.responsible_user_id = Number(parseCanonicalId(params.ownerCanonicalId).vendorId);
      }
      payload.custom_fields_values = buildCustomFieldsValues({
        WEBSITE: params.domain,
        INN: params.taxId,
        OGRN: params.registrationId,
        KPP: params.taxBranchId,
      });
      const [created] = await adapter.addCompanies([payload]);
      return mapCompany(created);
    },

    updateCompany: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const payload: JsonObject = { id: Number(vendorId) };
      if (params.name !== undefined) payload.name = params.name;
      if (params.ownerCanonicalId) {
        payload.responsible_user_id = Number(parseCanonicalId(params.ownerCanonicalId).vendorId);
      }
      payload.custom_fields_values = buildCustomFieldsValues({
        WEBSITE: params.domain,
        INN: params.taxId,
        OGRN: params.registrationId,
        KPP: params.taxBranchId,
      });
      const [updated] = await adapter.updateCompanies([payload]);
      return mapCompany(updated);
    },

    deleteCompany: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      return { canonicalId: params.canonicalId, vendorId, status: 2 };
    },

    getDeal: async (params) => {
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const raw = await adapter.getLead(Number(vendorId));
      return mapDeal(raw);
    },

    listDeals: async (params) => {
      const base = (params.base ?? {}) as Record<string, unknown>;
      const page = Number(base.page ?? 1);
      const limit = Number(base.limit ?? 25);
      const filter: JsonObject = {};
      if (params.pipelineCanonicalId) {
        filter.pipeline_id = Number(parseCanonicalId(params.pipelineCanonicalId).vendorId);
      }
      if (params.stageCanonicalId) {
        filter.status = Number(parseCanonicalId(params.stageCanonicalId).vendorId);
      }
      const result = await adapter.listLeads({ page, limit, filter: Object.keys(filter).length > 0 ? filter : undefined });
      return {
        items: result.data.map(mapDeal),
        meta: { totalCount: result.totalCount, nextCursor: '' },
      };
    },

    createDeal: async (params) => {
      await checkIdempotency(params.context);
      const payload: JsonObject = {};
      if (params.name !== undefined) payload.name = params.name;
      if (params.amount !== undefined) payload.price = params.amount;
      if (params.pipelineCanonicalId) {
        payload.pipeline_id = Number(parseCanonicalId(params.pipelineCanonicalId).vendorId);
      }
      if (params.stageCanonicalId) {
        payload.status_id = Number(parseCanonicalId(params.stageCanonicalId).vendorId);
      }
      if (params.ownerCanonicalId) {
        payload.responsible_user_id = Number(parseCanonicalId(params.ownerCanonicalId).vendorId);
      }
      const [created] = await adapter.addLeads([payload]);
      return mapDeal(created);
    },

    updateDeal: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const payload: JsonObject = { id: Number(vendorId) };
      if (params.name !== undefined) payload.name = params.name;
      if (params.amount !== undefined) payload.price = params.amount;
      if (params.pipelineCanonicalId) {
        payload.pipeline_id = Number(parseCanonicalId(params.pipelineCanonicalId).vendorId);
      }
      if (params.stageCanonicalId) {
        payload.status_id = Number(parseCanonicalId(params.stageCanonicalId).vendorId);
      }
      if (params.ownerCanonicalId) {
        payload.responsible_user_id = Number(parseCanonicalId(params.ownerCanonicalId).vendorId);
      }
      const [updated] = await adapter.updateLeads([payload]);
      return mapDeal(updated);
    },

    deleteDeal: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      return { canonicalId: params.canonicalId, vendorId, status: 4 };
    },

    getActivity: async (params) => {
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const raw = await adapter.getTask(Number(vendorId));
      return mapActivity(raw);
    },

    listActivities: async (params) => {
      const base = (params.base ?? {}) as Record<string, unknown>;
      const page = Number(base.page ?? 1);
      const limit = Number(base.limit ?? 25);
      const result = await adapter.listTasks({ page, limit });
      return {
        items: result.data.map(mapActivity),
        meta: { totalCount: result.totalCount, nextCursor: '' },
      };
    },

    createActivity: async (params) => {
      await checkIdempotency(params.context);
      const linked = (params.linkedEntities ?? []) as Array<{ entityType: string; canonicalId: string }>;
      const primary = linked[0];
      const payload: JsonObject = {};
      if (params.subject !== undefined) payload.text = params.subject;
      if (params.dueAt) {
        payload.complete_till = Math.floor(Number(params.dueAt) / 1000);
      }
      if (params.ownerCanonicalId) {
        payload.responsible_user_id = Number(parseCanonicalId(params.ownerCanonicalId).vendorId);
      }
      if (primary) {
        payload.entity_id = Number(parseCanonicalId(primary.canonicalId).vendorId);
        payload.entity_type = `${primary.entityType}s`;
      } else {
        payload.entity_type = 'leads';
      }
      const [created] = await adapter.addTasks([payload]);
      return mapActivity(created);
    },

    updateActivity: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const payload: JsonObject = { id: Number(vendorId) };
      if (params.subject !== undefined) payload.text = params.subject;
      if (params.dueAt) {
        payload.complete_till = Math.floor(Number(params.dueAt) / 1000);
      }
      if (params.ownerCanonicalId) {
        payload.responsible_user_id = Number(parseCanonicalId(params.ownerCanonicalId).vendorId);
      }
      if (params.isCompleted !== undefined) payload.is_completed = params.isCompleted;
      const [updated] = await adapter.updateTasks([payload]);
      return mapActivity(updated);
    },

    deleteActivity: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      return { canonicalId: params.canonicalId, vendorId, status: 2 };
    },

    getNote: async (params) => {
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const raw = await adapter.getNote(Number(vendorId), 'leads');
      return mapNote(raw);
    },

    listNotes: async (params) => {
      const base = (params.base ?? {}) as Record<string, unknown>;
      const page = Number(base.page ?? 1);
      const limit = Number(base.limit ?? 25);
      const entityType = 'leads';
      const result = await adapter.listNotes(entityType, { page, limit });
      return {
        items: result.data.map((n) => mapNote(n, entityType)),
        meta: { totalCount: result.totalCount, nextCursor: '' },
      };
    },

    createNote: async (params) => {
      await checkIdempotency(params.context);
      const parent = params.parent as { entityType: string; canonicalId: string } | undefined;
      const entityType = parent ? `${parent.entityType}s` : 'leads';
      const payload: JsonObject = {};
      if (parent) {
        payload.entity_id = Number(parseCanonicalId(parent.canonicalId).vendorId);
      }
      payload.note_type = 'common';
      payload.params = { text: params.content ?? '' };
      const [created] = await adapter.addNotes(entityType, [payload]);
      return mapNote(created, parent?.entityType, parent ? Number(parseCanonicalId(parent.canonicalId).vendorId) : undefined);
    },

    deleteNote: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      return { canonicalId: params.canonicalId, vendorId, status: 2 };
    },

    listPipelines: async () => {
      const raw = await adapter.listPipelines();
      return {
        items: raw.map(mapPipeline),
        meta: { totalCount: raw.length, nextCursor: '' },
      };
    },

    listCustomFieldDefinitions: async (params) => {
      const entityType = params.entityType ?? 'contacts';
      const raw = await adapter.listCustomFields(entityType);
      return {
        items: raw.map((f) => mapCustomFieldDefinition(f, entityType)),
        meta: { totalCount: raw.length, nextCursor: '' },
      };
    },

    listAssociations: async (params) => {
      const from = params.from as { entityType: string; canonicalId: string } | undefined;
      if (!from) {
        throw invalidArgument('from is required for ListAssociations');
      }
      const entityType = `${from.entityType}s`;
      const entityId = Number(parseCanonicalId(from.canonicalId).vendorId);
      const raw = await adapter.listLinks(entityType, entityId);
      return {
        items: raw.map(mapAssociation),
        meta: { totalCount: raw.length, nextCursor: '' },
      };
    },

    createAssociation: async (params) => {
      await checkIdempotency(params.context);
      const from = params.from as { entityType: string; canonicalId: string } | undefined;
      const to = params.to as { entityType: string; canonicalId: string } | undefined;
      if (!from || !to) {
        throw invalidArgument('from and to are required for CreateAssociation');
      }
      const fromEntityType = `${from.entityType}s`;
      const fromId = Number(parseCanonicalId(from.canonicalId).vendorId);
      const payload: JsonObject = {
        to_entity_id: Number(parseCanonicalId(to.canonicalId).vendorId),
        to_entity_type: `${to.entityType}s`,
      };
      await adapter.addLinks(fromEntityType, fromId, [payload]);
      return mapAssociation({
        from: from.entityType,
        to: to.entityType,
        from_id: parseCanonicalId(from.canonicalId).vendorId,
        to_id: parseCanonicalId(to.canonicalId).vendorId,
      });
    },

    deleteAssociation: async (params) => {
      await checkIdempotency(params.context);
      const { vendorId } = parseCanonicalId(params.canonicalId);
      const parts = vendorId.split(':');
      if (parts.length >= 4) {
        const fromType = parts[0];
        const fromId = parts[1];
        const toType = parts[2];
        const toId = parts[3];
        await adapter.deleteLinks(`${fromType}s`, Number(fromId), [{
          to_entity_id: Number(toId),
          to_entity_type: `${toType}s`,
        }]);
      }
      return { canonicalId: params.canonicalId, vendorId };
    },

    syncDelta: async () => {
      throw unimplemented('SyncDelta');
    },

    submitJob: async () => {
      throw unimplemented('SubmitJob');
    },

    getJob: async () => {
      throw unimplemented('GetJob');
    },

    cancelJob: async () => {
      throw unimplemented('CancelJob');
    },

    listJobs: async () => {
      throw unimplemented('ListJobs');
    },
  };
}

function buildCustomFieldsValues(fields: Record<string, string | undefined>): JsonObject[] {
  const result: JsonObject[] = [];
  for (const [code, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      result.push({
        field_code: code,
        values: [{ value }],
      });
    }
  }
  return result;
}
