import { ManagementClient } from 'auth0';
import type {
  Auth0Invitation,
  Auth0Membership,
  Auth0Organization,
  Auth0User,
  ListParams,
  ListResult,
} from './types.js';

type ApiResponse<T> = { data: T };
type Auth0List<T> = T[] | { users?: T[]; organizations?: T[]; invitations?: T[]; members?: T[]; total?: number; length?: number; next?: string };
type Manager = Record<string, (...args: never[]) => Promise<ApiResponse<unknown>>>;

export interface Auth0Adapter {
  getUser(id: string): Promise<Auth0User>;
  listUsers(params: ListParams): Promise<ListResult<Auth0User>>;
  createUser(body: Record<string, unknown>): Promise<Auth0User>;
  updateUser(id: string, body: Record<string, unknown>): Promise<Auth0User>;
  deleteUser(id: string): Promise<Auth0User>;
  getOrganization(id: string): Promise<Auth0Organization>;
  listOrganizations(params: ListParams): Promise<ListResult<Auth0Organization>>;
  createOrganization(body: Record<string, unknown>): Promise<Auth0Organization>;
  updateOrganization(id: string, body: Record<string, unknown>): Promise<Auth0Organization>;
  deleteOrganization(id: string): Promise<Auth0Organization>;
  listMemberships(organizationId: string, params: ListParams): Promise<ListResult<Auth0Membership>>;
  addMembership(organizationId: string, userId: string, roles: readonly string[]): Promise<Auth0Membership>;
  updateMembership(organizationId: string, userId: string, roles: readonly string[]): Promise<Auth0Membership>;
  removeMembership(organizationId: string, userId: string): Promise<Auth0Membership>;
  createInvitation(organizationId: string, body: Record<string, unknown>): Promise<Auth0Invitation>;
  listInvitations(organizationId: string, params: ListParams): Promise<ListResult<Auth0Invitation>>;
  getInvitation(organizationId: string, invitationId: string): Promise<Auth0Invitation>;
  revokeInvitation(organizationId: string, invitationId: string): Promise<Auth0Invitation>;
}

export interface Auth0ManagementOptions {
  readonly domain?: string;
  readonly token?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly connection?: string;
  readonly invitationClientId?: string;
}

function responseData<T>(response: ApiResponse<unknown>): T {
  return response.data as T;
}

function listData<T>(data: Auth0List<T>, key: 'users' | 'organizations' | 'invitations' | 'members'): ListResult<T> {
  if (Array.isArray(data)) return { items: data };
  return {
    items: data[key] ?? [],
    total: data.total,
    hasMore: Boolean(data.next),
    nextCursor: data.next,
  };
}

function offsetParams(params: ListParams): Record<string, unknown> {
  return {
    include_totals: true,
    ...(params.limit ? { per_page: params.limit, limit: params.limit, take: params.limit } : {}),
    ...(params.offset ? { page: Math.floor(params.offset / (params.limit || 50)), offset: params.offset } : {}),
    ...(params.cursor ? { from: params.cursor } : {}),
  };
}

function userQuery(params: ListParams): Record<string, unknown> {
  if (!params.email) return {};
  return {
    q: `email:"${params.email.replaceAll('"', '\\"')}"`,
    search_engine: 'v3',
  };
}

function asManager(value: unknown): Manager {
  return value as Manager;
}

export class Auth0ManagementAdapter implements Auth0Adapter {
  private readonly users: Manager;
  private readonly organizations: Manager;
  private readonly connection?: string;
  private readonly invitationClientId?: string;

  constructor(client: ManagementClient, options: Auth0ManagementOptions = {}) {
    this.users = asManager(client.users);
    this.organizations = asManager(client.organizations);
    this.connection = options.connection;
    this.invitationClientId = options.invitationClientId ?? options.clientId ?? process.env.AUTH0_CLIENT_ID;
  }

  async getUser(id: string): Promise<Auth0User> {
    return responseData<Auth0User>(await this.users.get({ id } as never));
  }

  async listUsers(params: ListParams): Promise<ListResult<Auth0User>> {
    const data = responseData<Auth0List<Auth0User>>(await this.users.getAll({ ...offsetParams(params), ...userQuery(params) } as never));
    return listData(data, 'users');
  }

  async createUser(body: Record<string, unknown>): Promise<Auth0User> {
    return responseData<Auth0User>(await this.users.create({ connection: this.connection, ...body } as never));
  }

  async updateUser(id: string, body: Record<string, unknown>): Promise<Auth0User> {
    return responseData<Auth0User>(await this.users.update({ id } as never, body as never));
  }

  async deleteUser(id: string): Promise<Auth0User> {
    await this.users.delete({ id } as never);
    return { user_id: id, blocked: true };
  }

  async getOrganization(id: string): Promise<Auth0Organization> {
    return responseData<Auth0Organization>(await this.organizations.get({ id } as never));
  }

  async listOrganizations(params: ListParams): Promise<ListResult<Auth0Organization>> {
    if (params.slug) {
      const organization = responseData<Auth0Organization>(await this.organizations.getByName({ name: params.slug } as never));
      return { items: [organization], total: 1, hasMore: false };
    }
    const data = responseData<Auth0List<Auth0Organization>>(await this.organizations.getAll(offsetParams(params) as never));
    return listData(data, 'organizations');
  }

  async createOrganization(body: Record<string, unknown>): Promise<Auth0Organization> {
    return responseData<Auth0Organization>(await this.organizations.create(body as never));
  }

  async updateOrganization(id: string, body: Record<string, unknown>): Promise<Auth0Organization> {
    return responseData<Auth0Organization>(await this.organizations.update({ id } as never, body as never));
  }

  async deleteOrganization(id: string): Promise<Auth0Organization> {
    await this.organizations.delete({ id } as never);
    return { id };
  }

  async listMemberships(organizationId: string, params: ListParams): Promise<ListResult<Auth0Membership>> {
    const data = responseData<Auth0List<Auth0Membership>>(await this.organizations.getMembers({
      id: organizationId,
      fields: 'user_id,email,name,picture,roles',
      include_fields: true,
      ...offsetParams(params),
    } as never));
    return {
      ...listData(data, 'members'),
      items: listData(data, 'members').items.map((member) => ({ ...member, organization_id: organizationId })),
    };
  }

  async addMembership(organizationId: string, userId: string, roles: readonly string[]): Promise<Auth0Membership> {
    await this.organizations.addMembers({ id: organizationId } as never, { members: [userId] } as never);
    if (roles.length) {
      await this.organizations.addMemberRoles({ id: organizationId, user_id: userId } as never, { roles: [...roles] } as never);
    }
    return { organization_id: organizationId, user_id: userId, roles: [...roles] };
  }

  async updateMembership(organizationId: string, userId: string, roles: readonly string[]): Promise<Auth0Membership> {
    await this.organizations.addMemberRoles({ id: organizationId, user_id: userId } as never, { roles: [...roles] } as never);
    return { organization_id: organizationId, user_id: userId, roles: [...roles] };
  }

  async removeMembership(organizationId: string, userId: string): Promise<Auth0Membership> {
    await this.organizations.deleteMembers({ id: organizationId } as never, { members: [userId] } as never);
    return { organization_id: organizationId, user_id: userId, roles: [] };
  }

  async createInvitation(organizationId: string, body: Record<string, unknown>): Promise<Auth0Invitation> {
    return responseData<Auth0Invitation>(
      await this.organizations.createInvitation(
        { id: organizationId } as never,
        { ...(this.invitationClientId ? { client_id: this.invitationClientId } : {}), send_invitation_email: true, ...body } as never,
      ),
    );
  }

  async listInvitations(organizationId: string, params: ListParams): Promise<ListResult<Auth0Invitation>> {
    const data = responseData<Auth0List<Auth0Invitation>>(await this.organizations.getInvitations({ id: organizationId, ...offsetParams(params) } as never));
    const listed = listData(data, 'invitations');
    const items = listed.items
      .map((invitation) => ({ ...invitation, organization_id: organizationId }))
      .filter((invitation) => !params.email || invitation.invitee?.email === params.email);
    return {
      ...listed,
      items,
      total: params.email ? items.length : listed.total,
    };
  }

  async getInvitation(organizationId: string, invitationId: string): Promise<Auth0Invitation> {
    const invitation = responseData<Auth0Invitation>(await this.organizations.getInvitation({ id: organizationId, invitation_id: invitationId } as never));
    return { ...invitation, organization_id: organizationId };
  }

  async revokeInvitation(organizationId: string, invitationId: string): Promise<Auth0Invitation> {
    await this.organizations.deleteInvitation({ id: organizationId, invitation_id: invitationId } as never);
    return { id: invitationId, organization_id: organizationId, revoked: true };
  }
}

export function createManagementClient(options: Auth0ManagementOptions = {}): ManagementClient {
  const domain = options.domain ?? process.env.AUTH0_DOMAIN;
  const token = options.token ?? process.env.AUTH0_MANAGEMENT_TOKEN;
  const clientId = options.clientId ?? process.env.AUTH0_CLIENT_ID;
  const clientSecret = options.clientSecret ?? process.env.AUTH0_CLIENT_SECRET;

  if (!domain) throw new Error('AUTH0_DOMAIN is required');
  if (token) return new ManagementClient({ domain, token });
  if (clientId && clientSecret) return new ManagementClient({ domain, clientId, clientSecret });
  throw new Error('AUTH0_MANAGEMENT_TOKEN or AUTH0_CLIENT_ID/AUTH0_CLIENT_SECRET is required');
}

export function createAuth0Adapter(options: Auth0ManagementOptions = {}): Auth0Adapter {
  return new Auth0ManagementAdapter(createManagementClient(options), {
    ...options,
    connection: options.connection ?? process.env.AUTH0_CONNECTION,
    invitationClientId: options.invitationClientId ?? process.env.AUTH0_INVITATION_CLIENT_ID,
  });
}
