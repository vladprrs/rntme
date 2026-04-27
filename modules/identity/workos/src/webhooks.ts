import { WorkOS } from '@workos-inc/node';
import { mapWorkOSInvitation, mapWorkOSMembership, mapWorkOSOrganization, mapWorkOSUser } from './mappers.js';
import type { CloudEvent, JsonObject, WorkOSWebhookEvent } from './types.js';

export interface WebhookDedupeStore {
  seen(id: string): boolean | Promise<boolean>;
  markSeen(id: string): void | Promise<void>;
}

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

export type ConstructWorkOSWebhookEvent = (request: {
  payload: Record<string, unknown>;
  sigHeader: string;
  secret: string;
  tolerance?: number;
}) => Promise<WorkOSWebhookEvent>;

export interface CreateWorkOSWebhookReceiverOptions {
  readonly signingSecret: string;
  readonly apiKey?: string;
  readonly tolerance?: number;
  readonly dedupeStore?: WebhookDedupeStore;
  readonly constructEvent?: ConstructWorkOSWebhookEvent;
}

export interface WorkOSWebhookReceiver {
  receive(request: ReceiveWebhookRequest): Promise<CloudEvent[]>;
}

export function createWorkOSWebhookReceiver(options: CreateWorkOSWebhookReceiverOptions): WorkOSWebhookReceiver {
  const dedupeStore = options.dedupeStore ?? new InMemoryWebhookDedupeStore();
  const constructEvent = options.constructEvent ?? defaultConstructEvent(options.apiKey ?? 'sk_test_placeholder');

  return {
    receive: async (request) => {
      const deliveryId = headerValue(request.headers, 'webhook-id') || headerValue(request.headers, 'workos-event-id');
      if (deliveryId && (await dedupeStore.seen(deliveryId))) {
        return [];
      }

      const constructRequest: {
        payload: Record<string, unknown>;
        sigHeader: string;
        secret: string;
        tolerance?: number;
      } = {
        payload: JSON.parse(request.payload) as Record<string, unknown>,
        sigHeader: headerValue(request.headers, 'workos-signature'),
        secret: options.signingSecret,
      };
      if (options.tolerance !== undefined) {
        constructRequest.tolerance = options.tolerance;
      }
      const verified = await constructEvent(constructRequest);
      const eventType = eventName(verified);
      const eventId = verified.id || deliveryId || `${eventType}:${eventSubject(verified)}`;
      if (await dedupeStore.seen(eventId)) {
        return [];
      }
      if (deliveryId) {
        await dedupeStore.markSeen(deliveryId);
      }
      await dedupeStore.markSeen(eventId);

      const translated = translateWorkOSWebhook({ ...verified, id: eventId });
      return translated ? [translated] : [];
    },
  };
}

export function translateWorkOSWebhook(event: WorkOSWebhookEvent): CloudEvent | undefined {
  const eventType = eventName(event);
  const id = event.id || `${eventType}:${eventSubject(event)}`;
  const subject = eventSubject(event);
  const time = new Date().toISOString();

  switch (eventType) {
    case 'user.created':
      return cloudEvent(id, 'rntme.identity.v1.UserCreated', event.data, subject, { user: mapWorkOSUser(event.data), trigger: 'webhook' }, time);
    case 'user.updated':
      return cloudEvent(id, 'rntme.identity.v1.UserUpdated', event.data, subject, { user: mapWorkOSUser(event.data) }, time);
    case 'user.deleted':
      return cloudEvent(id, 'rntme.identity.v1.UserDeleted', event.data, subject, deletedData(event.data), time);
    case 'organization.created':
      return cloudEvent(id, 'rntme.identity.v1.OrganizationCreated', event.data, subject, { organization: mapWorkOSOrganization(event.data) }, time);
    case 'organization.updated':
      return cloudEvent(id, 'rntme.identity.v1.OrganizationUpdated', event.data, subject, { organization: mapWorkOSOrganization(event.data) }, time);
    case 'organization.deleted':
      return cloudEvent(id, 'rntme.identity.v1.OrganizationDeleted', event.data, subject, deletedData(event.data), time);
    case 'organization_membership.created':
      return cloudEvent(
        id,
        'rntme.identity.v1.MembershipCreated',
        event.data,
        subject,
        { membership: mapWorkOSMembership(event.data), trigger: 'webhook' },
        time,
      );
    case 'organization_membership.updated':
      return cloudEvent(id, 'rntme.identity.v1.MembershipUpdated', event.data, subject, { membership: mapWorkOSMembership(event.data) }, time);
    case 'organization_membership.deleted':
      return cloudEvent(id, 'rntme.identity.v1.MembershipDeleted', event.data, subject, membershipDeletedData(event.data), time);
    case 'invitation.created':
      return cloudEvent(
        id,
        'rntme.identity.v1.InvitationCreated',
        event.data,
        subject,
        { invitation: mapWorkOSInvitation(event.data), trigger: 'webhook' },
        time,
      );
    case 'invitation.accepted':
      return cloudEvent(id, 'rntme.identity.v1.InvitationAccepted', event.data, subject, { invitation: mapWorkOSInvitation(event.data) }, time);
    case 'invitation.revoked':
      return cloudEvent(id, 'rntme.identity.v1.InvitationRevoked', event.data, subject, { invitation: mapWorkOSInvitation(event.data) }, time);
    default:
      return undefined;
  }
}

function defaultConstructEvent(apiKey: string): ConstructWorkOSWebhookEvent {
  const workos = new WorkOS(apiKey);
  return async (request) => workos.webhooks.constructEvent(request) as Promise<WorkOSWebhookEvent>;
}

function cloudEvent(id: string, type: string, rawData: JsonObject, subject: string, data: unknown, time: string): CloudEvent {
  return {
    specversion: '1.0',
    id,
    source: 'workos',
    type,
    subject,
    time,
    datacontenttype: 'application/json',
    data: { ...asObject(data), vendor_raw: rawData },
  };
}

function eventName(event: WorkOSWebhookEvent): string {
  return event.event || event.type || '';
}

function eventSubject(event: WorkOSWebhookEvent): string {
  return readString(event.data, 'id');
}

function toHeaders(headers: HeadersInit | Record<string, string | undefined>): Headers {
  const out = new Headers();
  if (headers instanceof Headers) {
    headers.forEach((value, key) => out.set(key, value));
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      out.set(key, value);
    }
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      out.set(key, value);
    }
  }
  return out;
}

function headerValue(headers: HeadersInit | Record<string, string | undefined>, key: string): string {
  return toHeaders(headers).get(key) ?? '';
}

function asObject(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonObject) : {};
}

function deletedData(raw: JsonObject): JsonObject {
  const canonicalId = readString(raw, 'id');
  return {
    canonical_id: canonicalId,
    vendor_id: canonicalId,
    hard_delete: true,
  };
}

function membershipDeletedData(raw: JsonObject): JsonObject {
  const canonicalId = readString(raw, 'id');
  return {
    canonical_id: canonicalId,
    vendor_id: canonicalId,
    user_id: readString(raw, 'userId') || readString(raw, 'user_id'),
    organization_id: readString(raw, 'organizationId') || readString(raw, 'organization_id'),
  };
}

function readString(raw: JsonObject, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value : '';
}
