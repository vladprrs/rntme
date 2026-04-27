import { createClerkClient, verifyToken } from '@clerk/backend';
import type { ClerkOptions } from '@clerk/backend';
import type { JsonObject, Paginated } from './types.js';

export interface CreateClerkAdapterOptions {
  readonly secretKey: string;
  readonly publishableKey?: string;
  readonly authorizedParties?: string[];
}

export interface ClerkIdentityAdapter {
  getUser(userId: string): Promise<JsonObject>;
  listUsers(params?: JsonObject): Promise<Paginated<JsonObject>>;
  createUser(params: JsonObject): Promise<JsonObject>;
  updateUser?(userId: string, params: JsonObject): Promise<JsonObject>;
  updateUserMetadata(userId: string, params: JsonObject): Promise<JsonObject>;
  banUser(userId: string): Promise<JsonObject>;
  unbanUser(userId: string): Promise<JsonObject>;
  deleteUser(userId: string): Promise<JsonObject>;
  getOrganization(organizationId: string): Promise<JsonObject>;
  listOrganizations(params?: JsonObject): Promise<Paginated<JsonObject>>;
  createOrganization(params: JsonObject): Promise<JsonObject>;
  updateOrganization?(organizationId: string, params: JsonObject): Promise<JsonObject>;
  deleteOrganization?(organizationId: string): Promise<JsonObject>;
  createOrganizationMembership(params: JsonObject): Promise<JsonObject>;
  updateOrganizationMembership(params: JsonObject): Promise<JsonObject>;
  updateOrganizationMembershipMetadata?(params: JsonObject): Promise<JsonObject>;
  deleteOrganizationMembership?(params: JsonObject): Promise<JsonObject>;
  listOrganizationMemberships(params: JsonObject): Promise<Paginated<JsonObject>>;
  createOrganizationInvitation(params: JsonObject): Promise<JsonObject>;
  listOrganizationInvitations?(params: JsonObject): Promise<Paginated<JsonObject>>;
  getOrganizationInvitation?(params: JsonObject): Promise<JsonObject>;
  revokeOrganizationInvitation(params: JsonObject): Promise<JsonObject>;
  getSession(sessionId: string): Promise<JsonObject>;
  listSessions(params?: JsonObject): Promise<Paginated<JsonObject>>;
  revokeSession(sessionId: string): Promise<JsonObject>;
  verifyToken(token: string): Promise<JsonObject>;
}

export function createClerkAdapter(options: CreateClerkAdapterOptions): ClerkIdentityAdapter {
  const clerkOptions: ClerkOptions = { secretKey: options.secretKey };
  if (options.publishableKey) {
    clerkOptions.publishableKey = options.publishableKey;
  }
  const client = createClerkClient(clerkOptions);

  return {
    getUser: async (userId) => asRecord(await client.users.getUser(userId)),
    listUsers: async (params) => asPaginated(await client.users.getUserList(params)),
    createUser: async (params) => asRecord(await client.users.createUser(params)),
    updateUser: async (userId, params) => asRecord(await client.users.updateUser(userId, params)),
    updateUserMetadata: async (userId, params) => asRecord(await client.users.updateUserMetadata(userId, params)),
    banUser: async (userId) => asRecord(await client.users.banUser(userId)),
    unbanUser: async (userId) => asRecord(await client.users.unbanUser(userId)),
    deleteUser: async (userId) => asRecord(await client.users.deleteUser(userId)),
    getOrganization: async (organizationId) => asRecord(await client.organizations.getOrganization({ organizationId })),
    listOrganizations: async (params) => asPaginated(await client.organizations.getOrganizationList(params)),
    createOrganization: async (params) =>
      asRecord(await client.organizations.createOrganization(params as Parameters<typeof client.organizations.createOrganization>[0])),
    updateOrganization: async (organizationId, params) =>
      asRecord(await client.organizations.updateOrganization(organizationId, params as Parameters<typeof client.organizations.updateOrganization>[1])),
    deleteOrganization: async (organizationId) => asRecord(await client.organizations.deleteOrganization(organizationId)),
    createOrganizationMembership: async (params) =>
      asRecord(await client.organizations.createOrganizationMembership(params as Parameters<typeof client.organizations.createOrganizationMembership>[0])),
    updateOrganizationMembership: async (params) =>
      asRecord(await client.organizations.updateOrganizationMembership(params as Parameters<typeof client.organizations.updateOrganizationMembership>[0])),
    updateOrganizationMembershipMetadata: async (params) =>
      asRecord(
        await client.organizations.updateOrganizationMembershipMetadata(
          params as Parameters<typeof client.organizations.updateOrganizationMembershipMetadata>[0],
        ),
      ),
    deleteOrganizationMembership: async (params) =>
      asRecord(await client.organizations.deleteOrganizationMembership(params as Parameters<typeof client.organizations.deleteOrganizationMembership>[0])),
    listOrganizationMemberships: async (params) =>
      asPaginated(await client.organizations.getOrganizationMembershipList(params as Parameters<typeof client.organizations.getOrganizationMembershipList>[0])),
    createOrganizationInvitation: async (params) =>
      asRecord(await client.organizations.createOrganizationInvitation(params as Parameters<typeof client.organizations.createOrganizationInvitation>[0])),
    listOrganizationInvitations: async (params) =>
      asPaginated(await client.organizations.getOrganizationInvitationList(params as Parameters<typeof client.organizations.getOrganizationInvitationList>[0])),
    getOrganizationInvitation: async (params) =>
      asRecord(await client.organizations.getOrganizationInvitation(params as Parameters<typeof client.organizations.getOrganizationInvitation>[0])),
    revokeOrganizationInvitation: async (params) =>
      asRecord(await client.organizations.revokeOrganizationInvitation(params as Parameters<typeof client.organizations.revokeOrganizationInvitation>[0])),
    getSession: async (sessionId) => asRecord(await client.sessions.getSession(sessionId)),
    listSessions: async (params) => asPaginated(await client.sessions.getSessionList(params)),
    revokeSession: async (sessionId) => asRecord(await client.sessions.revokeSession(sessionId)),
    verifyToken: async (token) =>
      asRecord(
        await verifyToken(token, {
          secretKey: options.secretKey,
          authorizedParties: options.authorizedParties,
        }),
      ),
  };
}

function asRecord(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null ? (value as JsonObject) : {};
}

function asPaginated(value: unknown): Paginated<JsonObject> {
  const record = asRecord(value);
  const data = Array.isArray(record.data) ? record.data.filter((item): item is JsonObject => typeof item === 'object' && item !== null) : [];
  return {
    data,
    totalCount: typeof record.totalCount === 'number' ? record.totalCount : undefined,
    total_count: typeof record.total_count === 'number' ? record.total_count : undefined,
  };
}
