import { ResolutionInputType } from '@rntme/contracts-identity-v1';
import type { Auth0Adapter } from './adapter.js';
import { invalidArgument, mapAuth0Error, unimplemented } from './errors.js';
import {
  mapAuth0Invitation,
  mapAuth0Membership,
  mapAuth0Organization,
  mapAuth0User,
  metadataToAuth0,
  parseCompositeId,
  toIdentityResolution,
} from './mapping.js';
import type {
  AddMembershipRequest,
  CreateInvitationRequest,
  CreateOrganizationRequest,
  CreateUserRequest,
  DeleteOrganizationRequest,
  DeleteUserRequest,
  GetInvitationRequest,
  GetMembershipRequest,
  GetOrganizationRequest,
  GetSessionRequest,
  GetUserRequest,
  IdentityResolution,
  IntrospectSessionRequest,
  Invitation,
  InvitationList,
  ListInvitationsRequest,
  ListMembershipsRequest,
  ListOrganizationsRequest,
  ListRequest,
  ListResponseMeta,
  ListSessionsRequest,
  ListUsersRequest,
  ListParams,
  Organization,
  OrganizationList,
  OrganizationMembership,
  OrganizationMembershipList,
  RemoveMembershipRequest,
  ResolveIdentityRequest,
  RevokeInvitationRequest,
  RevokeSessionRequest,
  Session,
  SessionList,
  UpdateMembershipRequest,
  UpdateOrganizationRequest,
  UpdateUserRequest,
  User,
  UserList,
} from './types.js';

export interface HandlerOptions {
  readonly defaultConnection?: string;
  readonly invitationClientId?: string;
}

function baseParams(base?: ListRequest | null): ListParams {
  return {
    limit: base?.limit || undefined,
    cursor: base?.cursor || undefined,
    offset: base?.offset || undefined,
  };
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function userBody(request: CreateUserRequest | UpdateUserRequest): Record<string, unknown> {
  return {
    ...('email' in request && request.email ? { email: request.email } : {}),
    ...(request.name?.given ? { given_name: request.name.given } : {}),
    ...(request.name?.family ? { family_name: request.name.family } : {}),
    ...(request.name?.display ? { name: request.name.display } : {}),
    ...(request.phone ? { phone_number: request.phone } : {}),
    ...(request.avatar_url ? { picture: request.avatar_url } : {}),
    ...('email_verified' in request ? { email_verified: request.email_verified ?? false } : {}),
    ...metadataToAuth0(request.metadata),
  };
}

function organizationBody(request: CreateOrganizationRequest | UpdateOrganizationRequest): Record<string, unknown> {
  const metadata = metadataToAuth0(request.metadata).user_metadata ?? {};
  const organizationMetadata = {
    ...metadata,
    ...(request.description ? { description: request.description } : {}),
    ...(request.max_members ? { max_members: request.max_members } : {}),
  };
  return {
    ...(request.slug || request.name ? { name: request.slug || slugFromName(request.name ?? '') } : {}),
    ...(request.name ? { display_name: request.name } : {}),
    ...(request.logo_url ? { branding: { logo_url: request.logo_url } } : {}),
    ...(Object.keys(organizationMetadata).length ? { metadata: organizationMetadata } : {}),
  };
}

function listMeta(base: ListRequest | null | undefined, total?: number, hasMore?: boolean, nextCursor?: string): ListResponseMeta {
  return {
    limit: base?.limit ?? 0,
    total_count: total ?? 0,
    has_more: hasMore ?? false,
    next_cursor: nextCursor ?? '',
  };
}

async function invoke<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapAuth0Error(error);
  }
}

export function createAuth0IdentityModule(adapter: Auth0Adapter, options: HandlerOptions = {}) {
  return {
    GetUser: (request: GetUserRequest): Promise<User> =>
      invoke(async () => mapAuth0User(await adapter.getUser(request.canonical_id ?? ''))),

    ListUsers: (request: ListUsersRequest): Promise<UserList> =>
      invoke(async () => {
        const result = await adapter.listUsers({
          ...baseParams(request.base),
          email: request.email || undefined,
          status: request.status ?? undefined,
          organizationId: request.organization_id || undefined,
        });
        return {
          items: result.items.map(mapAuth0User),
          meta: listMeta(request.base, result.total, result.hasMore, result.nextCursor),
        };
      }),

    CreateUser: (request: CreateUserRequest): Promise<User> =>
      invoke(async () => mapAuth0User(await adapter.createUser(userBody(request)))),

    UpdateUser: (request: UpdateUserRequest): Promise<User> =>
      invoke(async () => mapAuth0User(await adapter.updateUser(request.canonical_id ?? '', userBody(request)))),

    DeleteUser: (request: DeleteUserRequest): Promise<User> =>
      invoke(async () => mapAuth0User(await adapter.deleteUser(request.canonical_id ?? ''))),

    ResolveIdentity: (request: ResolveIdentityRequest): Promise<IdentityResolution> =>
      invoke(async () => {
        const inputType = request.input_type ?? ResolutionInputType.RESOLUTION_INPUT_TYPE_UNSPECIFIED;
        const inputValue = request.input_value ?? '';
        if (inputType === ResolutionInputType.RESOLUTION_INPUT_TYPE_VENDOR_ID || inputType === ResolutionInputType.RESOLUTION_INPUT_TYPE_SSO_SUBJECT) {
          return toIdentityResolution(mapAuth0User(await adapter.getUser(inputValue)), inputType, inputValue);
        }
        if (inputType === ResolutionInputType.RESOLUTION_INPUT_TYPE_EMAIL) {
          const result = await adapter.listUsers({ email: inputValue, limit: 1 });
          return toIdentityResolution(result.items[0] ? mapAuth0User(result.items[0]) : null, inputType, inputValue);
        }
        throw invalidArgument(`ResolveIdentity does not support input type ${inputType}`);
      }),

    GetOrganization: (request: GetOrganizationRequest): Promise<Organization> =>
      invoke(async () => mapAuth0Organization(await adapter.getOrganization(request.canonical_id ?? ''))),

    ListOrganizations: (request: ListOrganizationsRequest): Promise<OrganizationList> =>
      invoke(async () => {
        const result = await adapter.listOrganizations({
          ...baseParams(request.base),
          slug: request.slug || undefined,
          status: request.status ?? undefined,
        });
        return {
          items: result.items.map(mapAuth0Organization),
          meta: listMeta(request.base, result.total, result.hasMore, result.nextCursor),
        };
      }),

    CreateOrganization: (request: CreateOrganizationRequest): Promise<Organization> =>
      invoke(async () => mapAuth0Organization(await adapter.createOrganization(organizationBody(request)))),

    UpdateOrganization: (request: UpdateOrganizationRequest): Promise<Organization> =>
      invoke(async () => mapAuth0Organization(await adapter.updateOrganization(request.canonical_id ?? '', organizationBody(request)))),

    DeleteOrganization: (request: DeleteOrganizationRequest): Promise<Organization> =>
      invoke(async () => mapAuth0Organization(await adapter.deleteOrganization(request.canonical_id ?? ''))),

    GetMembership: (_request: GetMembershipRequest): Promise<OrganizationMembership> => Promise.reject(unimplemented('GetMembership')),

    ListMemberships: (request: ListMembershipsRequest): Promise<OrganizationMembershipList> =>
      invoke(async () => {
        if (!request.organization_id) throw invalidArgument('ListMemberships requires organization_id for Auth0');
        const result = await adapter.listMemberships(request.organization_id, baseParams(request.base));
        return {
          items: result.items.map(mapAuth0Membership),
          meta: listMeta(request.base, result.total, result.hasMore, result.nextCursor),
        };
      }),

    AddMembership: (request: AddMembershipRequest): Promise<OrganizationMembership> =>
      invoke(async () => mapAuth0Membership(await adapter.addMembership(request.organization_id ?? '', request.user_id ?? '', request.roles ?? []))),

    UpdateMembership: (_request: UpdateMembershipRequest): Promise<OrganizationMembership> => Promise.reject(unimplemented('UpdateMembership')),

    RemoveMembership: (request: RemoveMembershipRequest): Promise<OrganizationMembership> =>
      invoke(async () => {
        const ids = parseCompositeId(request.canonical_id ?? '');
        return mapAuth0Membership(await adapter.removeMembership(ids.organizationId, ids.resourceId));
      }),

    CreateInvitation: (request: CreateInvitationRequest): Promise<Invitation> =>
      invoke(async () =>
        mapAuth0Invitation(
          await adapter.createInvitation(request.organization_id ?? '', {
            inviter: { name: request.context?.actor_user_id ?? 'rntme' },
            invitee: { email: request.email ?? '' },
            roles: request.roles ?? [],
            ...(options.invitationClientId ? { client_id: options.invitationClientId } : {}),
            ...metadataToAuth0(request.metadata),
          }),
        ),
      ),

    ListInvitations: (request: ListInvitationsRequest): Promise<InvitationList> =>
      invoke(async () => {
        if (!request.organization_id) throw invalidArgument('ListInvitations requires organization_id for Auth0');
        const result = await adapter.listInvitations(request.organization_id, { ...baseParams(request.base), email: request.email || undefined });
        return {
          items: result.items.map(mapAuth0Invitation),
          meta: listMeta(request.base, result.total, result.hasMore, result.nextCursor),
        };
      }),

    GetInvitation: (request: GetInvitationRequest): Promise<Invitation> =>
      invoke(async () => {
        const ids = parseCompositeId(request.canonical_id ?? '');
        return mapAuth0Invitation(await adapter.getInvitation(ids.organizationId, ids.resourceId));
      }),

    RevokeInvitation: (request: RevokeInvitationRequest): Promise<Invitation> =>
      invoke(async () => {
        const ids = parseCompositeId(request.canonical_id ?? '');
        return mapAuth0Invitation(await adapter.revokeInvitation(ids.organizationId, ids.resourceId));
      }),

    GetSession: (_request: GetSessionRequest): Promise<Session> => Promise.reject(unimplemented('GetSession')),
    ListSessions: (_request: ListSessionsRequest): Promise<SessionList> => Promise.reject(unimplemented('ListSessions')),
    IntrospectSession: (_request: IntrospectSessionRequest): Promise<Session> => Promise.reject(unimplemented('IntrospectSession')),
    RevokeSession: (_request: RevokeSessionRequest): Promise<Session> => Promise.reject(unimplemented('RevokeSession')),
  };
}
