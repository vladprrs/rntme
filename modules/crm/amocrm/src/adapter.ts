import { Amo } from '@shevernitskiy/amo';
import type { OAuth, Options } from '@shevernitskiy/amo';
import type { JsonObject, Paginated } from './types.js';

type AmoAuth = OAuth & { client_id: string; client_secret: string; redirect_uri: string };

export interface CreateAmoCrmAdapterOptions {
  readonly subdomain: string;
  readonly auth: AmoAuth;
  readonly options?: Options;
}

export interface AmoCrmAdapter {
  getLead(id: number): Promise<JsonObject>;
  listLeads(params?: JsonObject): Promise<Paginated<JsonObject>>;
  createLead(leads: JsonObject[]): Promise<JsonObject[]>;
  updateLead(leads: JsonObject[]): Promise<JsonObject[]>;

  getContact(id: number): Promise<JsonObject>;
  listContacts(params?: JsonObject): Promise<Paginated<JsonObject>>;
  createContact(contacts: JsonObject[]): Promise<JsonObject[]>;
  updateContact(contacts: JsonObject[]): Promise<JsonObject[]>;

  getCompany(id: number): Promise<JsonObject>;
  listCompanies(params?: JsonObject): Promise<Paginated<JsonObject>>;
  createCompany(companies: JsonObject[]): Promise<JsonObject[]>;
  updateCompany(companies: JsonObject[]): Promise<JsonObject[]>;

  getTask(id: number): Promise<JsonObject>;
  listTasks(params?: JsonObject): Promise<Paginated<JsonObject>>;
  createTask(tasks: JsonObject[]): Promise<JsonObject[]>;

  getNote(entityType: string, id: number): Promise<JsonObject>;
  listNotes(entityType: string, params?: JsonObject): Promise<Paginated<JsonObject>>;
  createNote(entityType: string, notes: JsonObject[]): Promise<JsonObject[]>;

  getPipelines(): Promise<JsonObject[]>;
  getCustomFields(entityType: string): Promise<Paginated<JsonObject>>;
  getUsers(): Promise<Paginated<JsonObject>>;

  createAssociation(fromType: string, fromId: number, toType: string, toId: number): Promise<JsonObject>;
  deleteAssociation(fromType: string, fromId: number, toType: string, toId: number): Promise<void>;
}

export function createAmoCrmAdapter(options: CreateAmoCrmAdapterOptions): AmoCrmAdapter {
  const amo = new Amo(options.subdomain, options.auth, options.options);

  return {
    getLead: async (id) => asRecord(await amo.lead.getLeadById(id)),
    listLeads: async (params) => asPaginated(await amo.lead.getLeads(params)),
    createLead: async (leads) => asArray(await amo.lead.addLeads(leads as never)),
    updateLead: async (leads) => asArray(await amo.lead.updateLeads(leads as never)),

    getContact: async (id) => asRecord(await amo.contact.getContactById(id)),
    listContacts: async (params) => asPaginated(await amo.contact.getContacts(params)),
    createContact: async (contacts) => asArray(await amo.contact.addContacts(contacts as never)),
    updateContact: async (contacts) => asArray(await amo.contact.updateContacts(contacts as never)),

    getCompany: async (id) => asRecord(await amo.company.getCompanyById(id)),
    listCompanies: async (params) => asPaginated(await amo.company.getCompanies(params)),
    createCompany: async (companies) => asArray(await amo.company.addCompanies(companies as never)),
    updateCompany: async (companies) => asArray(await amo.company.updateCompanies(companies as never)),

    getTask: async (id) => asRecord(await amo.task.getTaskById(id)),
    listTasks: async (params) => asPaginated(await amo.task.getTasks(params)),
    createTask: async (tasks) => asArray(await amo.task.addTasks(tasks as never)),

    getNote: async (entityType, id) => asRecord(await amo.note.getNotesById(id, entityType as never)),
    listNotes: async (entityType, params) => asPaginated(await amo.note.getNotesByEntityType(entityType as never, params)),
    createNote: async (entityType, notes) => asArray(await amo.note.addNotes(entityType as never, notes as never)),

    getPipelines: async () => asArray(await amo.pipeline.getPipelines()),
    getCustomFields: async (entityType) => asPaginated(await amo.custom_fields.getCustomFields(entityType as never)),
    getUsers: async () => asPaginated(await amo.user.getUsers()),

    createAssociation: async (fromType, fromId, toType, toId) => {
      const result = await amo.link.addLinksByEntityId(fromId, fromType as never, [
        { to_entity_id: toId, to_entity_type: toType as never },
      ]);
      return asRecord(result);
    },
    deleteAssociation: async (fromType, fromId, toType, toId) => {
      await amo.link.deleteLinksByEntityId(fromId, fromType as never, [
        { to_entity_id: toId, to_entity_type: toType as never },
      ]);
    },
  };
}

function asRecord(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null ? (value as JsonObject) : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asPaginated<T>(value: unknown): Paginated<T> {
  const record = asRecord(value);
  const embedded = asRecord(record._embedded);
  const items = Array.isArray(embedded.items)
    ? embedded.items.filter((item): item is JsonObject => typeof item === 'object' && item !== null)
    : Array.isArray(record.data)
      ? record.data.filter((item): item is JsonObject => typeof item === 'object' && item !== null)
      : [];
  return {
    data: items as T[],
    totalCount: typeof record.totalCount === 'number' ? record.totalCount : undefined,
    total_count: typeof record.total_count === 'number' ? record.total_count : undefined,
  };
}
