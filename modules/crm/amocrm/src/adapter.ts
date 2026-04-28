import { Amo, ApiError, AuthError } from '@shevernitskiy/amo';
import type { OAuth } from '@shevernitskiy/amo';
import type { AmoCrmConfig, JsonObject, Paginated } from './types.js';

export interface CreateAmoCrmAdapterOptions {
  readonly config: AmoCrmConfig;
  readonly onToken?: (token: OAuth) => void | Promise<void>;
  readonly onError?: (error: Error) => void | Promise<void>;
}

export interface AmoCrmAdapter {
  getLead(id: number): Promise<JsonObject>;
  listLeads(params?: JsonObject): Promise<Paginated<JsonObject>>;
  addLeads(leads: JsonObject[]): Promise<JsonObject[]>;
  updateLeads(leads: JsonObject[]): Promise<JsonObject[]>;

  getContact(id: number): Promise<JsonObject>;
  listContacts(params?: JsonObject): Promise<Paginated<JsonObject>>;
  addContacts(contacts: JsonObject[]): Promise<JsonObject[]>;
  updateContacts(contacts: JsonObject[]): Promise<JsonObject[]>;

  getCompany(id: number): Promise<JsonObject>;
  listCompanies(params?: JsonObject): Promise<Paginated<JsonObject>>;
  addCompanies(companies: JsonObject[]): Promise<JsonObject[]>;
  updateCompanies(companies: JsonObject[]): Promise<JsonObject[]>;

  getTask(id: number): Promise<JsonObject>;
  listTasks(params?: JsonObject): Promise<Paginated<JsonObject>>;
  addTasks(tasks: JsonObject[]): Promise<JsonObject[]>;
  updateTasks(tasks: JsonObject[]): Promise<JsonObject[]>;

  getNote(id: number, entityType: string): Promise<JsonObject>;
  listNotes(entityType: string, params?: JsonObject): Promise<Paginated<JsonObject>>;
  addNotes(entityType: string, notes: JsonObject[]): Promise<JsonObject[]>;

  listPipelines(): Promise<JsonObject[]>;
  listCustomFields(entityType: string): Promise<JsonObject[]>;
  listUsers(): Promise<JsonObject[]>;
  listLinks(entityType: string, entityId: number): Promise<JsonObject[]>;
  addLinks(entityType: string, entityId: number, links: JsonObject[]): Promise<void>;
  deleteLinks(entityType: string, entityId: number, links: JsonObject[]): Promise<void>;

  webhookHandler(): (request: Request) => Promise<Response>;
}

export function createAmoCrmAdapter(options: CreateAmoCrmAdapterOptions): AmoCrmAdapter {
  const token: OAuth = {
    token_type: options.config.auth.token_type ?? 'Bearer',
    expires_in: options.config.auth.expires_in ?? 86400,
    access_token: options.config.auth.access_token,
    refresh_token: options.config.auth.refresh_token,
    expires_at: options.config.auth.expires_at ?? Date.now() + 86400 * 1000,
  };

  const auth = {
    ...token,
    client_id: options.config.auth.client_id,
    client_secret: options.config.auth.client_secret,
    redirect_uri: options.config.auth.redirect_uri,
  };

  const client = new Amo(options.config.subdomain, auth, {
    on_token: options.onToken,
    on_error: options.onError,
  });

  return {
    getLead: async (id) => asRecord(await client.lead.getLeadById(id)),
    listLeads: async (params) => asPaginated(await client.lead.getLeads(params)),
    addLeads: async (leads) => asArray(await client.lead.addLeads(leads)),
    updateLeads: async (leads) => asArray(await client.lead.updateLeads(leads)),

    getContact: async (id) => asRecord(await client.contact.getContactById(id)),
    listContacts: async (params) => asPaginated(await client.contact.getContacts(params)),
    addContacts: async (contacts) => asArray(await client.contact.addContacts(contacts)),
    updateContacts: async (contacts) => asArray(await client.contact.updateContacts(contacts)),

    getCompany: async (id) => asRecord(await client.company.getCompanyById(id)),
    listCompanies: async (params) => asPaginated(await client.company.getCompanies(params)),
    addCompanies: async (companies) => asArray(await client.company.addCompanies(companies)),
    updateCompanies: async (companies) => asArray(await client.company.updateCompanies(companies)),

    getTask: async (id) => asRecord(await client.task.getTaskById(id)),
    listTasks: async (params) => asPaginated(await client.task.getTasks(params)),
    addTasks: async (tasks) => asArray(await client.task.addTasks(tasks)),
    updateTasks: async (tasks) => asArray(await client.task.updateTasks(tasks as unknown as Parameters<typeof client.task.updateTasks>[0])),

    getNote: async (id, entityType) => asRecord(await client.note.getNotesById(id, entityType as 'leads' | 'contacts' | 'companies')),
    listNotes: async (entityType, params) => asPaginated(await client.note.getNotesByEntityType(entityType as 'leads' | 'contacts' | 'companies', params)),
    addNotes: async (entityType, notes) => asArray(await client.note.addNotes(entityType as 'leads' | 'contacts' | 'companies', notes)),

    listPipelines: async () => asArray(await client.pipeline.getPipelines()),
    listCustomFields: async (entityType) => asArray(await client.custom_fields.getCustomFields(entityType as 'leads' | 'contacts' | 'companies')),
    listUsers: async () => asArray(await client.user.getUsers()),
    listLinks: async (entityType, entityId) => asArray(await client.link.getLinksByEntityId(entityId, entityType as 'leads' | 'contacts' | 'companies')),
    addLinks: async (entityType, entityId, links) => {
      await client.link.addLinksByEntityId(entityId, entityType as 'leads' | 'contacts' | 'companies', links);
    },
    deleteLinks: async (entityType, entityId, links) => {
      await client.link.deleteLinksByEntityId(entityId, entityType as 'leads' | 'contacts' | 'companies', links);
    },

    webhookHandler: () => client.webhookHandler(),
  };
}

export { ApiError, AuthError };

function asRecord(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null ? (value as JsonObject) : {};
}

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter((item): item is JsonObject => typeof item === 'object' && item !== null) : [];
}

function asPaginated(value: unknown): Paginated<JsonObject> {
  const record = asRecord(value);
  const embedded = asRecord(record._embedded);
  const items = Array.isArray(embedded.items)
    ? embedded.items.filter((item): item is JsonObject => typeof item === 'object' && item !== null)
    : [];
  return {
    data: items,
    totalCount: typeof record._total_items === 'number' ? record._total_items : undefined,
    total_count: typeof record._total_items === 'number' ? record._total_items : undefined,
  };
}
