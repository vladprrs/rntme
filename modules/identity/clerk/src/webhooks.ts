import { verifyWebhook as clerkVerifyWebhook } from '@clerk/backend/webhooks';
import type { VerifyWebhookOptions } from '@clerk/backend/webhooks';
import { mapClerkInvitation, mapClerkMembership, mapClerkOrganization, mapClerkSession, mapClerkUser } from './mappers.js';
import type { ClerkWebhookEvent, CloudEvent, JsonObject } from './types.js';

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

export type VerifyClerkWebhook = (request: Request, options: VerifyWebhookOptions) => Promise<ClerkWebhookEvent>;

export interface CreateClerkWebhookReceiverOptions {
  readonly signingSecret: string;
  readonly dedupeStore?: WebhookDedupeStore;
  readonly verify?: VerifyClerkWebhook;
}

export interface ClerkWebhookReceiver {
  receive(request: ReceiveWebhookRequest): Promise<CloudEvent[]>;
}

export function createClerkWebhookReceiver(options: CreateClerkWebhookReceiverOptions): ClerkWebhookReceiver {
  const dedupeStore = options.dedupeStore ?? new InMemoryWebhookDedupeStore();
  const verify = options.verify ?? defaultVerify;

  return {
    receive: async (request) => {
      const dedupeId = headerValue(request.headers, 'svix-id') || headerValue(request.headers, 'webhook-id');
      if (dedupeId && (await dedupeStore.seen(dedupeId))) {
        return [];
      }

      const verified = await verify(new Request('https://rntme.local/clerk/webhook', { method: 'POST', headers: toHeaders(request.headers), body: request.payload }), {
        signingSecret: options.signingSecret,
      });
      const eventId = dedupeId || verified.id || `${verified.type}:${eventSubject(verified)}`;
      if (await dedupeStore.seen(eventId)) {
        return [];
      }
      await dedupeStore.markSeen(eventId);

      const translated = translateClerkWebhook(verified, verified.id ? undefined : eventId);
      return translated ? [translated] : [];
    },
  };
}

export function translateClerkWebhook(event: ClerkWebhookEvent, fallbackEventId?: string): CloudEvent | undefined {
  const id = event.id || fallbackEventId || `${event.type}:${eventSubject(event)}`;
  const time = new Date().toISOString();

  switch (event.type) {
    case 'user.created':
      return cloudEvent(id, 'rntme.identity.v1.UserCreated', event.data, eventSubject(event), { user: mapClerkUser(event.data), trigger: 'webhook' }, time);
    case 'user.updated':
      return cloudEvent(id, 'rntme.identity.v1.UserUpdated', event.data, eventSubject(event), { user: mapClerkUser(event.data) }, time);
    case 'user.deleted':
      return cloudEvent(
        id,
        'rntme.identity.v1.UserDeleted',
        event.data,
        eventSubject(event),
        { canonical_id: eventSubject(event), vendor_id: eventSubject(event), hard_delete: true },
        time,
      );
    case 'organization.created':
      return cloudEvent(id, 'rntme.identity.v1.OrganizationCreated', event.data, eventSubject(event), { organization: mapClerkOrganization(event.data) }, time);
    case 'organization.updated':
      return cloudEvent(id, 'rntme.identity.v1.OrganizationUpdated', event.data, eventSubject(event), { organization: mapClerkOrganization(event.data) }, time);
    case 'organization.deleted':
      return cloudEvent(
        id,
        'rntme.identity.v1.OrganizationDeleted',
        event.data,
        eventSubject(event),
        { canonical_id: eventSubject(event), vendor_id: eventSubject(event), hard_delete: true },
        time,
      );
    case 'organizationMembership.created':
      return cloudEvent(id, 'rntme.identity.v1.MembershipCreated', event.data, eventSubject(event), { membership: mapClerkMembership(event.data), trigger: 'webhook' }, time);
    case 'organizationMembership.updated':
      return cloudEvent(id, 'rntme.identity.v1.MembershipUpdated', event.data, eventSubject(event), { membership: mapClerkMembership(event.data) }, time);
    case 'organizationMembership.deleted':
      return cloudEvent(id, 'rntme.identity.v1.MembershipDeleted', event.data, eventSubject(event), membershipDeletedData(event.data), time);
    case 'organizationInvitation.created':
      return cloudEvent(id, 'rntme.identity.v1.InvitationCreated', event.data, eventSubject(event), { invitation: mapClerkInvitation(event.data), trigger: 'webhook' }, time);
    case 'organizationInvitation.accepted':
      return cloudEvent(id, 'rntme.identity.v1.InvitationAccepted', event.data, eventSubject(event), { invitation: mapClerkInvitation(event.data) }, time);
    case 'organizationInvitation.revoked':
      return cloudEvent(id, 'rntme.identity.v1.InvitationRevoked', event.data, eventSubject(event), { invitation: mapClerkInvitation(event.data) }, time);
    case 'session.created':
      return cloudEvent(id, 'rntme.identity.v1.SessionCreated', event.data, eventSubject(event), { session: mapClerkSession(event.data), trigger: 'webhook' }, time);
    case 'session.ended':
    case 'session.removed':
      return cloudEvent(id, 'rntme.identity.v1.SessionEnded', event.data, eventSubject(event), sessionEndedData(event.data, event.type), time);
    case 'session.revoked':
      return cloudEvent(id, 'rntme.identity.v1.SessionRevoked', event.data, eventSubject(event), sessionRevokedData(event.data), time);
    default:
      return undefined;
  }
}

async function defaultVerify(request: Request, options: VerifyWebhookOptions): Promise<ClerkWebhookEvent> {
  return (await clerkVerifyWebhook(request, options)) as unknown as ClerkWebhookEvent;
}

function cloudEvent(id: string, type: string, rawData: JsonObject, subject: string, data: unknown, time: string): CloudEvent {
  return {
    specversion: '1.0',
    id,
    source: 'clerk',
    type,
    subject,
    time,
    datacontenttype: 'application/json',
    data: { ...asObject(data), vendor_raw: rawData },
  };
}

function eventSubject(event: ClerkWebhookEvent): string {
  const id = event.data.id;
  return typeof id === 'string' ? id : '';
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

function membershipDeletedData(raw: JsonObject): JsonObject {
  const membership = mapClerkMembership(raw);
  return {
    canonical_id: membership.ref?.canonical_id ?? '',
    user_id: membership.user_id,
    organization_id: membership.organization_id,
  };
}

function sessionEndedData(raw: JsonObject, trigger: string): JsonObject {
  const session = mapClerkSession(raw);
  return {
    session_id: session.session_id,
    canonical_id: session.ref?.canonical_id ?? session.session_id,
    user_id: session.user_id,
    trigger,
  };
}

function sessionRevokedData(raw: JsonObject): JsonObject {
  const session = mapClerkSession(raw);
  return {
    session_id: session.session_id,
    canonical_id: session.ref?.canonical_id ?? session.session_id,
    user_id: session.user_id,
  };
}
