import { proto } from '@rntme/contracts-crm-v1';
import {
  mapAmoCompany,
  mapAmoContact,
  mapAmoLead,
  mapAmoNote,
  mapAmoTask,
} from './mappers.js';
import type { CloudEvent, JsonObject, WebhookDedupeStore as DedupeStore } from './types.js';

export type WebhookDedupeStore = DedupeStore;

const crm = proto.rntme.contracts.crm.v1;

export class InMemoryWebhookDedupeStore implements WebhookDedupeStore {
  private readonly seenIds = new Set<string>();

  public seen(id: string): boolean {
    return this.seenIds.has(id);
  }

  public markSeen(id: string): void {
    this.seenIds.add(id);
  }
}

export interface ReceiveWebhookRequest {
  readonly payload: string;
  readonly headers: HeadersInit | Record<string, string | undefined>;
}

export interface CreateAmoCrmWebhookReceiverOptions {
  readonly dedupeStore?: WebhookDedupeStore;
}

export interface AmoCrmWebhookReceiver {
  receive(request: ReceiveWebhookRequest): Promise<CloudEvent[]>;
}

export function createAmoCrmWebhookReceiver(options: CreateAmoCrmWebhookReceiverOptions = {}): AmoCrmWebhookReceiver {
  const dedupeStore = options.dedupeStore ?? new InMemoryWebhookDedupeStore();

  return {
    receive: async (request) => {
      const decoded = decodeUrlEncodedPayload(request.payload);
      const events = translateAmoCrmWebhook(decoded);
      const result: CloudEvent[] = [];

      for (const event of events) {
        if (await dedupeStore.seen(event.id)) {
          continue;
        }
        await dedupeStore.markSeen(event.id);
        result.push(event);
      }

      return result;
    },
  };
}

export function decodeUrlEncodedPayload(payload: string): JsonObject {
  const decoded: JsonObject = {};
  // eslint-disable-next-line no-undef
  const params = new URLSearchParams(payload);

  for (const [key, value] of params.entries()) {
    setNestedValue(decoded, key, value);
  }

  return decoded;
}

export function translateAmoCrmWebhook(payload: JsonObject): CloudEvent[] {
  const account = readRecord(payload, 'account');
  const subdomain = readString(account, 'subdomain');
  const events: CloudEvent[] = [];

  for (const entityType of ['leads', 'contacts', 'companies', 'tasks', 'notes']) {
    const entityGroup = readRecord(payload, entityType);
    if (!entityGroup) {
      continue;
    }

    for (const [action, items] of Object.entries(entityGroup)) {
      if (!Array.isArray(items)) {
        continue;
      }
      for (const item of items.filter(isRecord)) {
        const event = buildCloudEvent(entityType, action, item, subdomain);
        if (event) {
          events.push(event);
        }
      }
    }
  }

  return events;
}

function buildCloudEvent(entityType: string, action: string, item: JsonObject, subdomain: string): CloudEvent | undefined {
  const id = readNumber(item, 'id') ?? 0;
  const eventId = `${entityType}:${action}:${id}:${Date.now()}`;
  const time = new Date().toISOString();
  const source = subdomain || 'amocrm';

  switch (entityType) {
    case 'contacts': {
      const contact = mapAmoContact(item);
      switch (action) {
        case 'add':
          return cloudEvent(eventId, 'rntme.crm.v1.ContactCreated', item, String(id), { contact }, time, source);
        case 'update':
          return cloudEvent(eventId, 'rntme.crm.v1.ContactUpdated', item, String(id), { contact }, time, source);
        case 'delete':
          return cloudEvent(eventId, 'rntme.crm.v1.ContactDeleted', item, String(id), { canonical_id: String(id), vendor_id: String(id) }, time, source);
      }
      break;
    }
    case 'companies': {
      const company = mapAmoCompany(item);
      switch (action) {
        case 'add':
          return cloudEvent(eventId, 'rntme.crm.v1.CompanyCreated', item, String(id), { company }, time, source);
        case 'update':
          return cloudEvent(eventId, 'rntme.crm.v1.CompanyUpdated', item, String(id), { company }, time, source);
        case 'delete':
          return cloudEvent(eventId, 'rntme.crm.v1.CompanyDeleted', item, String(id), { canonical_id: String(id), vendor_id: String(id) }, time, source);
      }
      break;
    }
    case 'leads': {
      const deal = mapAmoLead(item);
      switch (action) {
        case 'add':
          return cloudEvent(eventId, 'rntme.crm.v1.DealCreated', item, String(id), { deal }, time, source);
        case 'update': {
          const statusId = readNumber(item, 'status_id');
          const oldStatusId = readNumber(item, 'old_status_id');
          if (statusId && oldStatusId && statusId !== oldStatusId) {
            return cloudEvent(eventId, 'rntme.crm.v1.DealStageChanged', item, String(id), { deal, old_stage_id: String(oldStatusId), new_stage_id: String(statusId) }, time, source);
          }
          if (deal.status === crm.DealStatus.DEAL_STATUS_WON || deal.status === crm.DealStatus.DEAL_STATUS_LOST) {
            return cloudEvent(eventId, 'rntme.crm.v1.DealClosed', item, String(id), { deal }, time, source);
          }
          return cloudEvent(eventId, 'rntme.crm.v1.DealUpdated', item, String(id), { deal }, time, source);
        }
        case 'delete':
          return cloudEvent(eventId, 'rntme.crm.v1.DealClosed', item, String(id), { deal: { ...deal, status: crm.DealStatus.DEAL_STATUS_DELETED } }, time, source);
      }
      break;
    }
    case 'tasks': {
      const activity = mapAmoTask(item);
      switch (action) {
        case 'add':
          return cloudEvent(eventId, 'rntme.crm.v1.ActivityCreated', item, String(id), { activity }, time, source);
        case 'update':
          return cloudEvent(eventId, 'rntme.crm.v1.ActivityUpdated', item, String(id), { activity }, time, source);
        case 'delete':
          return cloudEvent(eventId, 'rntme.crm.v1.ActivityDeleted', item, String(id), { canonical_id: String(id), vendor_id: String(id) }, time, source);
      }
      break;
    }
    case 'notes': {
      const note = mapAmoNote(item);
      switch (action) {
        case 'add':
          return cloudEvent(eventId, 'rntme.crm.v1.NoteCreated', item, String(id), { note }, time, source);
        case 'delete':
          return cloudEvent(eventId, 'rntme.crm.v1.NoteDeleted', item, String(id), { canonical_id: String(id), vendor_id: String(id) }, time, source);
      }
      break;
    }
  }

  return undefined;
}

function cloudEvent(
  id: string,
  type: string,
  rawData: JsonObject,
  subject: string,
  data: unknown,
  time: string,
  source: string,
): CloudEvent {
  return {
    specversion: '1.0',
    id,
    source,
    type,
    subject,
    time,
    datacontenttype: 'application/json',
    data: { ...asObject(data), vendor_raw: rawData },
  };
}

function setNestedValue(target: JsonObject, key: string, value: string): void {
  const bracketPattern = /\[([^\]]*)\]/g;
  const match = bracketPattern.exec(key);

  if (!match) {
    target[key] = value;
    return;
  }

  const baseKey = key.slice(0, match.index);
  const indices: string[] = [];
  let m: RegExpExecArray | null = match;
  while (m) {
    if (m[1] !== undefined) {
      indices.push(m[1]);
    }
    m = bracketPattern.exec(key);
  }

  let current: unknown = target;
  const path = [baseKey, ...indices];

  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (segment === undefined) {
      continue;
    }
    const parent = current as JsonObject;
    const nextSegment = path[i + 1];
    const isArrayIndex = nextSegment !== undefined && /^\d+$/.test(nextSegment);

    if (parent[segment] === undefined) {
      parent[segment] = isArrayIndex ? [] : {};
    }
    current = parent[segment];
  }

  const lastSegment = path[path.length - 1];
  if (lastSegment !== undefined) {
    (current as JsonObject)[lastSegment] = value;
  }
}

function readString(raw: JsonObject | undefined, key: string): string {
  if (!raw) {
    return '';
  }
  const value = raw[key];
  return typeof value === 'string' ? value : '';
}

function readNumber(raw: JsonObject | undefined, key: string): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw[key];
  return typeof value === 'number' ? value : undefined;
}

function readRecord(raw: JsonObject | undefined, key: string): JsonObject | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw[key];
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonObject) : {};
}
