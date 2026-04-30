import { ManagementClient } from 'auth0';
import type {
  Auth0Invitation,
  Auth0Membership,
  Auth0Organization,
  Auth0User,
  ListParams,
  ListResult,
} from './types.js';
import { failedPrecondition, managementNotConfigured } from './errors.js';

type ApiResponse<T> = { data: T };
type Auth0List<T> = T[] | { users?: T[]; organizations?: T[]; invitations?: T[]; members?: T[]; total?: number; length?: number; next?: string };
type Manager = Record<string, (...args: never[]) => Promise<ApiResponse<unknown>>>;
type ManagementClientFactory = () => ManagementClient;

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
    ...(params.limit !== undefined ? { per_page: params.limit } : {}),
    ...(params.offset !== undefined ? { page: Math.floor(params.offset / (params.limit || 50)) } : {}),
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
  private client: ManagementClient | null;
  private readonly clientFactory: ManagementClientFactory | null;
  private readonly eagerUsers: Manager | null;
  private readonly eagerOrganizations: Manager | null;
  private readonly connection?: string;
  private readonly invitationClientId?: string;

  constructor(client: ManagementClient | ManagementClientFactory, options: Auth0ManagementOptions = {}) {
    if (typeof client === 'function') {
      this.client = null;
      this.clientFactory = client;
      this.eagerUsers = null;
      this.eagerOrganizations = null;
    } else {
      this.client = client;
      this.clientFactory = null;
      this.eagerUsers = asManager(client.users);
      this.eagerOrganizations = asManager(client.organizations);
    }
    this.connection = options.connection;
    this.invitationClientId = options.invitationClientId ?? process.env.AUTH0_INVITATION_CLIENT_ID;
  }

  private get managementClient(): ManagementClient {
    if (this.client) return this.client;
    if (!this.clientFactory) throw managementNotConfigured();
    this.client = this.clientFactory();
    return this.client;
  }

  private get users(): Manager {
    return this.eagerUsers ?? asManager(this.managementClient.users);
  }

  private get organizations(): Manager {
    return this.eagerOrganizations ?? asManager(this.managementClient.organizations);
  }

  async getUser(id: string): Promise<Auth0User> {
    return responseData<Auth0User>(await this.users.get({ id } as never));
  }

  async listUsers(params: ListParams): Promise<ListResult<Auth0User>> {
    const data = responseData<Auth0List<Auth0User>>(await this.users.getAll({ ...offsetParams(params), ...userQuery(params) } as never));
    return listData(data, 'users');
  }

  async createUser(body: Record<string, unknown>): Promise<Auth0User> {
    return responseData<Auth0User>(await this.users.create({ ...(this.connection !== undefined ? { connection: this.connection } : {}), ...body } as never));
  }

  async updateUser(id: string, body: Record<string, unknown>): Promise<Auth0User> {
    return responseData<Auth0User>(await this.users.update({ id } as never, body as never));
  }

  async deleteUser(id: string): Promise<Auth0User> {
    await this.users.delete({ id } as never);
    return { user_id: id, deleted: true, deleted_at: new Date().toISOString() };
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
    return { id, deleted: true, deleted_at: new Date().toISOString() };
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

  async removeMembership(organizationId: string, userId: string): Promise<Auth0Membership> {
    await this.organizations.deleteMembers({ id: organizationId } as never, { members: [userId] } as never);
    return { organization_id: organizationId, user_id: userId, roles: [] };
  }

  async createInvitation(organizationId: string, body: Record<string, unknown>): Promise<Auth0Invitation> {
    const clientId = this.invitationClientId ?? (typeof body.client_id === 'string' ? body.client_id : undefined);
    if (!clientId) {
      throw failedPrecondition('AUTH0_INVITATION_CLIENT_ID is required to create Auth0 organization invitations');
    }
    return responseData<Auth0Invitation>(
      await this.organizations.createInvitation(
        { id: organizationId } as never,
        { ...body, client_id: clientId, send_invitation_email: true } as never,
      ),
    );
  }

  async listInvitations(organizationId: string, params: ListParams): Promise<ListResult<Auth0Invitation>> {
    if (params.email) {
      const pageSize = params.limit ?? 50;
      let pageOffset = 0;
      const items: Auth0Invitation[] = [];

      for (;;) {
        const data = responseData<Auth0List<Auth0Invitation>>(
          await this.organizations.getInvitations({ id: organizationId, ...offsetParams({ ...params, limit: pageSize, offset: pageOffset }) } as never),
        );
        const page = listData(data, 'invitations').items.map((invitation) => ({ ...invitation, organization_id: organizationId }));
        items.push(...page.filter((invitation) => invitation.invitee?.email === params.email));
        if (page.length < pageSize) break;
        pageOffset += pageSize;
      }

      const resultOffset = params.offset ?? 0;
      const limitedItems = params.limit === undefined ? items.slice(resultOffset) : items.slice(resultOffset, resultOffset + params.limit);
      return { items: limitedItems, total: items.length, hasMore: resultOffset + limitedItems.length < items.length };
    }

    const data = responseData<Auth0List<Auth0Invitation>>(await this.organizations.getInvitations({ id: organizationId, ...offsetParams(params) } as never));
    const listed = listData(data, 'invitations');
    const items = listed.items
      .map((invitation) => ({ ...invitation, organization_id: organizationId }))
    return {
      ...listed,
      items,
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
  const clientId = options.clientId ?? process.env.AUTH0_MANAGEMENT_CLIENT_ID ?? process.env.AUTH0_CLIENT_ID;
  const clientSecret = options.clientSecret ?? process.env.AUTH0_MANAGEMENT_CLIENT_SECRET ?? process.env.AUTH0_CLIENT_SECRET;

  if (!domain) throw managementNotConfigured('AUTH0_DOMAIN is required for Auth0 Mgmt API calls');
  if (token) return new ManagementClient({ domain, token });
  if (clientId && clientSecret) return new ManagementClient({ domain, clientId, clientSecret });
  throw managementNotConfigured('AUTH0_MANAGEMENT_TOKEN or AUTH0_MANAGEMENT_CLIENT_ID/AUTH0_MANAGEMENT_CLIENT_SECRET is required for Auth0 Mgmt API calls');
}

export function createAuth0Adapter(options: Auth0ManagementOptions = {}): Auth0Adapter {
  return new Auth0ManagementAdapter(() => createManagementClient(options), {
    ...options,
    connection: options.connection ?? process.env.AUTH0_CONNECTION,
    invitationClientId: options.invitationClientId ?? process.env.AUTH0_INVITATION_CLIENT_ID,
  });
}
