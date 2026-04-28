import { WorkOS } from '@workos-inc/node';
import type { JsonObject, Paginated } from './types.js';

export interface CreateWorkOSAdapterOptions {
  readonly apiKey: string;
  readonly clientId?: string;
}

export interface WorkOSRequestOptions {
  readonly idempotencyKey?: string;
}

export interface WorkOSIdentityAdapter {
  getUser(userId: string): Promise<JsonObject>;
  listUsers(params?: JsonObject): Promise<Paginated<JsonObject>>;
  createUser(params: JsonObject): Promise<JsonObject>;
  updateUser(params: JsonObject): Promise<JsonObject>;
  deleteUser(userId: string): Promise<JsonObject>;
  getOrganization(organizationId: string): Promise<JsonObject>;
  listOrganizations(params?: JsonObject): Promise<Paginated<JsonObject>>;
  createOrganization(params: JsonObject, options?: WorkOSRequestOptions): Promise<JsonObject>;
  updateOrganization(params: JsonObject): Promise<JsonObject>;
  deleteOrganization(organizationId: string): Promise<JsonObject>;
  getOrganizationMembership?(membershipId: string): Promise<JsonObject>;
  listOrganizationMemberships(params: JsonObject): Promise<Paginated<JsonObject>>;
  createOrganizationMembership(params: JsonObject): Promise<JsonObject>;
  updateOrganizationMembership(membershipId: string, params: JsonObject): Promise<JsonObject>;
  deleteOrganizationMembership(membershipId: string): Promise<JsonObject>;
  getInvitation?(invitationId: string): Promise<JsonObject>;
  sendInvitation(params: JsonObject): Promise<JsonObject>;
  listInvitations(params: JsonObject): Promise<Paginated<JsonObject>>;
  revokeInvitation(invitationId: string): Promise<JsonObject>;
}

export function createWorkOSAdapter(options: CreateWorkOSAdapterOptions): WorkOSIdentityAdapter {
  const workos = new WorkOS(options.apiKey, options.clientId ? { clientId: options.clientId } : undefined);

  return {
    getUser: async (userId) => asRecord(await workos.userManagement.getUser(userId)),
    listUsers: async (params) => asPaginated(await workos.userManagement.listUsers(asSdkParams<Parameters<typeof workos.userManagement.listUsers>[0]>(params))),
    createUser: async (params) => asRecord(await workos.userManagement.createUser(asSdkParams<Parameters<typeof workos.userManagement.createUser>[0]>(params))),
    updateUser: async (params) => asRecord(await workos.userManagement.updateUser(asSdkParams<Parameters<typeof workos.userManagement.updateUser>[0]>(params))),
    deleteUser: async (userId) => {
      await workos.userManagement.deleteUser(userId);
      return { id: userId, deleted: true };
    },
    getOrganization: async (organizationId) => asRecord(await workos.organizations.getOrganization(organizationId)),
    listOrganizations: async (params) =>
      asPaginated(await workos.organizations.listOrganizations(asSdkParams<Parameters<typeof workos.organizations.listOrganizations>[0]>(params))),
    createOrganization: async (params, requestOptions) =>
      asRecord(
        await workos.organizations.createOrganization(
          asSdkParams<Parameters<typeof workos.organizations.createOrganization>[0]>(params),
          requestOptions as unknown as Parameters<typeof workos.organizations.createOrganization>[1],
        ),
      ),
    updateOrganization: async (params) =>
      asRecord(await workos.organizations.updateOrganization(asSdkParams<Parameters<typeof workos.organizations.updateOrganization>[0]>(params))),
    deleteOrganization: async (organizationId) => {
      await workos.organizations.deleteOrganization(organizationId);
      return { id: organizationId, deleted: true };
    },
    getOrganizationMembership: async (membershipId) => asRecord(await workos.userManagement.getOrganizationMembership(membershipId)),
    listOrganizationMemberships: async (params) =>
      asPaginated(
        await workos.userManagement.listOrganizationMemberships(asSdkParams<Parameters<typeof workos.userManagement.listOrganizationMemberships>[0]>(params)),
      ),
    createOrganizationMembership: async (params) =>
      asRecord(
        await workos.userManagement.createOrganizationMembership(
          asSdkParams<Parameters<typeof workos.userManagement.createOrganizationMembership>[0]>(params),
        ),
      ),
    updateOrganizationMembership: async (membershipId, params) =>
      asRecord(
        await workos.userManagement.updateOrganizationMembership(
          membershipId,
          asSdkParams<Parameters<typeof workos.userManagement.updateOrganizationMembership>[1]>(params),
        ),
      ),
    deleteOrganizationMembership: async (membershipId) => {
      await workos.userManagement.deleteOrganizationMembership(membershipId);
      return { id: membershipId, status: 'inactive' };
    },
    getInvitation: async (invitationId) => asRecord(await workos.userManagement.getInvitation(invitationId)),
    sendInvitation: async (params) => asRecord(await workos.userManagement.sendInvitation(asSdkParams<Parameters<typeof workos.userManagement.sendInvitation>[0]>(params))),
    listInvitations: async (params) =>
      asPaginated(await workos.userManagement.listInvitations(asSdkParams<Parameters<typeof workos.userManagement.listInvitations>[0]>(params))),
    revokeInvitation: async (invitationId) => asRecord(await workos.userManagement.revokeInvitation(invitationId)),
  };
}

function asSdkParams<T>(params: JsonObject | undefined): T {
  return params as unknown as T;
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
    listMetadata: asListMetadata(record.listMetadata),
    list_metadata: asListMetadata(record.list_metadata),
  };
}

function asListMetadata(value: unknown): { before?: string | null; after?: string | null } | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const metadata: { before?: string | null; after?: string | null } = {};
  if (typeof record.before === 'string' || record.before === null) {
    metadata.before = record.before;
  }
  if (typeof record.after === 'string' || record.after === null) {
    metadata.after = record.after;
  }
  return metadata;
}
