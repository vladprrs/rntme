import { proto } from '@rntme/contracts-identity-v1';
import type { ClerkIdentityAdapter } from './adapter.js';
import { CLERK_SUPPORTED_RPCS, CLERK_UNSUPPORTED_RPCS } from './capabilities.js';
import { invalidArgument, mapClerkError, unimplemented } from './errors.js';
import {
  mapClerkInvitation,
  mapClerkMembership,
  mapClerkOrganization,
  mapClerkSession,
  mapClerkUser,
  mapListMeta,
  mapVerifiedTokenToSession,
  splitCompositeCanonicalId,
  structToJson,
} from './mappers.js';
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
  InvitationStatus,
  JsonObject,
  ListInvitationsRequest,
  ListMembershipsRequest,
  ListOrganizationsRequest,
  ListSessionsRequest,
  ListUsersRequest,
  Organization,
  OrganizationMembership,
  RemoveMembershipRequest,
  ResolveIdentityRequest,
  RevokeInvitationRequest,
  RevokeSessionRequest,
  Session,
  SessionStatus,
  UpdateMembershipRequest,
  UpdateOrganizationRequest,
  UpdateUserRequest,
  User,
} from './types.js';

const id = proto.rntme.contracts.identity.v1;

type Handler<Request, Response> = (request: Request) => Promise<Response>;

export type ClerkIdentityModule = {
  GetUser: Handler<GetUserRequest, User>;
  ListUsers: Handler<ListUsersRequest, ReturnType<typeof id.UserList.create>>;
  GetOrganization: Handler<GetOrganizationRequest, Organization>;
  ListOrganizations: Handler<ListOrganizationsRequest, ReturnType<typeof id.OrganizationList.create>>;
  GetMembership: Handler<GetMembershipRequest, OrganizationMembership>;
  ListMemberships: Handler<ListMembershipsRequest, ReturnType<typeof id.OrganizationMembershipList.create>>;
  GetInvitation: Handler<GetInvitationRequest, Invitation>;
  ListInvitations: Handler<ListInvitationsRequest, ReturnType<typeof id.InvitationList.create>>;
  GetSession: Handler<GetSessionRequest, Session>;
  ListSessions: Handler<ListSessionsRequest, ReturnType<typeof id.SessionList.create>>;
  ResolveIdentity: Handler<ResolveIdentityRequest, IdentityResolution>;
  IntrospectSession: Handler<IntrospectSessionRequest, Session>;
  CreateUser: Handler<CreateUserRequest, User>;
  UpdateUser: Handler<UpdateUserRequest, User>;
  DeleteUser: Handler<DeleteUserRequest, User>;
  CreateOrganization: Handler<CreateOrganizationRequest, Organization>;
  UpdateOrganization: Handler<UpdateOrganizationRequest, Organization>;
  DeleteOrganization: Handler<DeleteOrganizationRequest, Organization>;
  CreateInvitation: Handler<CreateInvitationRequest, Invitation>;
  RevokeInvitation: Handler<RevokeInvitationRequest, Invitation>;
  AddMembership: Handler<AddMembershipRequest, OrganizationMembership>;
  UpdateMembership: Handler<UpdateMembershipRequest, OrganizationMembership>;
  RemoveMembership: Handler<RemoveMembershipRequest, OrganizationMembership>;
  RevokeSession: Handler<RevokeSessionRequest, Session>;
};

export interface CreateClerkIdentityModuleOptions {
  readonly adapter: ClerkIdentityAdapter;
}

export function createClerkIdentityModule(options: CreateClerkIdentityModuleOptions): ClerkIdentityModule {
  const { adapter } = options;

  return {
    GetUser: async (request) => withErrorMap(() => adapter.getUser(request.canonical_id ?? '').then(mapClerkUser), 'IDENTITY_REFERENCES_USER_NOT_FOUND'),
    ListUsers: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 0;
        const response = await adapter.listUsers({
          limit: limit || undefined,
          offset: request.base?.offset || undefined,
          emailAddress: request.email ? [request.email] : undefined,
          organizationId: request.organization_id ? [request.organization_id] : undefined,
        });
        const users = (response.data ?? []).map(mapClerkUser).filter((user) => !request.status || user.status === request.status);
        return id.UserList.create({
          items: users,
          meta: mapListMeta(listMetaSource(response, users, Boolean(request.status)), limit, request.base?.offset ?? 0),
        });
      }, 'IDENTITY_REFERENCES_USER_NOT_FOUND'),
    GetOrganization: async (request) =>
      withErrorMap(() => adapter.getOrganization(request.canonical_id ?? '').then(mapClerkOrganization), 'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND'),
    ListOrganizations: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 0;
        const response = await adapter.listOrganizations({
          limit: limit || undefined,
          offset: request.base?.offset || undefined,
          query: request.slug || undefined,
        });
        const organizations = (response.data ?? []).map(mapClerkOrganization).filter((organization) => !request.status || organization.status === request.status);
        return id.OrganizationList.create({
          items: organizations,
          meta: mapListMeta(listMetaSource(response, organizations, Boolean(request.status)), limit, request.base?.offset ?? 0),
        });
      }, 'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND'),
    GetMembership: unsupported('GetMembership'),
    ListMemberships: async (request) =>
      withErrorMap(async () => {
        if (!request.organization_id) {
          throw invalidArgument('ListMemberships requires organization_id for Clerk');
        }
        const limit = request.base?.limit ?? 0;
        const response = await adapter.listOrganizationMemberships({
          organizationId: request.organization_id,
          userId: request.user_id ? [request.user_id] : undefined,
          limit: limit || undefined,
          offset: request.base?.offset || undefined,
        });
        const memberships = (response.data ?? []).map(mapClerkMembership).filter((membership) => !request.status || membership.status === request.status);
        return id.OrganizationMembershipList.create({
          items: memberships,
          meta: mapListMeta(listMetaSource(response, memberships, Boolean(request.status)), limit, request.base?.offset ?? 0),
        });
      }, 'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND'),
    GetInvitation: unsupported('GetInvitation'),
    ListInvitations: async (request) =>
      withErrorMap(async () => {
        if (!request.organization_id) {
          throw invalidArgument('ListInvitations requires organization_id for Clerk');
        }
        const listInvitations = requireAdapterMethod(adapter.listOrganizationInvitations, 'ListInvitations');
        const limit = request.base?.limit ?? 0;
        const response = await listInvitations({
          organizationId: request.organization_id,
          status: request.status ? [canonicalInvitationStatusToClerk(request.status)] : undefined,
          limit: limit || undefined,
          offset: request.base?.offset || undefined,
        });
        const filtered = request.email
          ? (response.data ?? []).filter((item) => readString(item, 'emailAddress') === request.email || readString(item, 'email_address') === request.email)
          : (response.data ?? []);
        return id.InvitationList.create({
          items: filtered.map((item) => mapClerkInvitation(item, request.organization_id ?? '')),
          meta: mapListMeta(listMetaSource(response, filtered, Boolean(request.email)), limit, request.base?.offset ?? 0),
        });
      }, 'IDENTITY_REFERENCES_INVITATION_NOT_FOUND'),
    GetSession: async (request) =>
      withErrorMap(() => adapter.getSession(request.canonical_id ?? '').then(mapClerkSession), 'IDENTITY_REFERENCES_SESSION_NOT_FOUND'),
    ListSessions: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 0;
        const response = await adapter.listSessions({
          userId: request.user_id || undefined,
          status: canonicalSessionStatusToClerk(request.status),
          limit: limit || undefined,
          offset: request.base?.offset || undefined,
        });
        const filtered = request.organization_id
          ? (response.data ?? []).filter(
              (item) =>
                readString(item, 'lastActiveOrganizationId') === request.organization_id ||
                readString(item, 'last_active_organization_id') === request.organization_id,
            )
          : (response.data ?? []);
        return id.SessionList.create({
          items: filtered.map(mapClerkSession),
          meta: mapListMeta(listMetaSource(response, filtered, Boolean(request.organization_id)), limit, request.base?.offset ?? 0),
        });
      }, 'IDENTITY_REFERENCES_SESSION_NOT_FOUND'),
    ResolveIdentity: unsupported('ResolveIdentity'),
    IntrospectSession: async (request) =>
      withErrorMap(() => adapter.verifyToken(request.token ?? '').then(mapVerifiedTokenToSession), 'IDENTITY_REFERENCES_SESSION_NOT_FOUND'),
    CreateUser: async (request) =>
      withErrorMap(
        () =>
          adapter
            .createUser({
              emailAddress: request.email ? [request.email] : [],
              phoneNumber: request.phone ? [request.phone] : undefined,
              firstName: request.name?.given || undefined,
              lastName: request.name?.family || undefined,
              publicMetadata: structToJson(request.metadata?.public),
              privateMetadata: structToJson(request.metadata?.private),
              unsafeMetadata: structToJson(request.metadata?.unsafe),
            })
            .then(mapClerkUser),
        'IDENTITY_REFERENCES_USER_NOT_FOUND',
      ),
    UpdateUser: async (request) =>
      withErrorMap(async () => {
        const updateUser = adapter.updateUser;
        const params = {
          firstName: request.name?.given || undefined,
          lastName: request.name?.family || undefined,
          publicMetadata: structToJson(request.metadata?.public),
          privateMetadata: structToJson(request.metadata?.private),
          unsafeMetadata: structToJson(request.metadata?.unsafe),
        };
        const updated = updateUser
          ? await updateUser(request.canonical_id ?? '', params)
          : await adapter.updateUserMetadata(request.canonical_id ?? '', {
              publicMetadata: structToJson(request.metadata?.public),
              privateMetadata: structToJson(request.metadata?.private),
              unsafeMetadata: structToJson(request.metadata?.unsafe),
            });
        return mapClerkUser(updated);
      }, 'IDENTITY_REFERENCES_USER_NOT_FOUND'),
    DeleteUser: async (request) =>
      withErrorMap(() => adapter.deleteUser(request.canonical_id ?? '').then((user) => mapClerkUser({ ...user, deleted: true })), 'IDENTITY_REFERENCES_USER_NOT_FOUND'),
    CreateOrganization: async (request) =>
      withErrorMap(
        () =>
          adapter
            .createOrganization({
              name: request.name ?? '',
              slug: request.slug || undefined,
              createdBy: request.context?.actor_user_id || undefined,
              maxAllowedMemberships: request.max_members || undefined,
              publicMetadata: structToJson(request.metadata?.public),
              privateMetadata: structToJson(request.metadata?.private),
            })
            .then(mapClerkOrganization),
        'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND',
      ),
    UpdateOrganization: async (request) =>
      withErrorMap(async () => {
        const updateOrganization = requireAdapterMethod(adapter.updateOrganization, 'UpdateOrganization');
        return mapClerkOrganization(
          await updateOrganization(request.canonical_id ?? '', {
            name: request.name || undefined,
            slug: request.slug || undefined,
            maxAllowedMemberships: request.max_members || undefined,
            publicMetadata: structToJson(request.metadata?.public),
            privateMetadata: structToJson(request.metadata?.private),
          }),
        );
      }, 'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND'),
    DeleteOrganization: async (request) =>
      withErrorMap(async () => {
        const deleteOrganization = requireAdapterMethod(adapter.deleteOrganization, 'DeleteOrganization');
        return mapClerkOrganization({ ...(await deleteOrganization(request.canonical_id ?? '')), deleted: true });
      }, 'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND'),
    CreateInvitation: async (request) =>
      withErrorMap(
        () =>
          adapter
            .createOrganizationInvitation({
              organizationId: request.organization_id ?? '',
              emailAddress: request.email ?? '',
              role: (request.roles ?? [])[0] ?? 'org:member',
              expiresInDays: timestampToExpiresInDays(request.expires_at),
              inviterUserId: request.context?.actor_user_id || undefined,
              privateMetadata: structToJson(request.metadata?.private),
              publicMetadata: structToJson(request.metadata?.public),
            })
            .then((invitation) => mapClerkInvitation(invitation, request.organization_id ?? '')),
        'IDENTITY_REFERENCES_INVITATION_NOT_FOUND',
      ),
    RevokeInvitation: async (request) =>
      withErrorMap(async () => {
        const parsed = splitCompositeCanonicalId(request.canonical_id ?? '');
        if (!parsed) {
          throw invalidArgument('RevokeInvitation requires canonical_id in organizationId:invitationId form for Clerk');
        }
        return mapClerkInvitation(
          await adapter.revokeOrganizationInvitation({
            organizationId: parsed.first,
            invitationId: parsed.second,
            requestingUserId: request.context?.actor_user_id || undefined,
          }),
          parsed.first,
        );
      }, 'IDENTITY_REFERENCES_INVITATION_NOT_FOUND'),
    AddMembership: async (request) =>
      withErrorMap(async () => {
        const membership = await adapter.createOrganizationMembership({
          organizationId: request.organization_id ?? '',
          userId: request.user_id ?? '',
          role: (request.roles ?? [])[0] ?? 'org:member',
        });
        return mapClerkMembership(await applyMembershipMetadata(adapter, request.organization_id ?? '', request.user_id ?? '', request.metadata, membership));
      }, 'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND'),
    UpdateMembership: async (request) =>
      withErrorMap(async () => {
        const parsed = splitCompositeCanonicalId(request.canonical_id ?? '');
        if (!parsed) {
          throw invalidArgument('UpdateMembership requires canonical_id in organizationId:userId form for Clerk');
        }
        const hasRoleUpdate = Boolean(request.roles?.length);
        if (!hasRoleUpdate && !hasWritableMetadata(request.metadata)) {
          throw invalidArgument('UpdateMembership requires roles or metadata for Clerk');
        }
        const membership = hasRoleUpdate
          ? await adapter.updateOrganizationMembership({
              organizationId: parsed.first,
              userId: parsed.second,
              role: request.roles?.[0] ?? 'org:member',
            })
          : {
              organizationId: parsed.first,
              userId: parsed.second,
            };
        return mapClerkMembership(await applyMembershipMetadata(adapter, parsed.first, parsed.second, request.metadata, membership));
      }, 'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND'),
    RemoveMembership: async (request) =>
      withErrorMap(async () => {
        const deleteMembership = requireAdapterMethod(adapter.deleteOrganizationMembership, 'RemoveMembership');
        const parsed = splitCompositeCanonicalId(request.canonical_id ?? '');
        if (!parsed) {
          throw invalidArgument('RemoveMembership requires canonical_id in organizationId:userId form for Clerk');
        }
        return mapClerkMembership(await deleteMembership({ organizationId: parsed.first, userId: parsed.second }));
      }, 'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND'),
    RevokeSession: async (request) =>
      withErrorMap(() => adapter.revokeSession(request.canonical_id ?? '').then(mapClerkSession), 'IDENTITY_REFERENCES_SESSION_NOT_FOUND'),
  };
}

export { CLERK_SUPPORTED_RPCS, CLERK_UNSUPPORTED_RPCS };

function unsupported<Request, Response>(rpc: string): Handler<Request, Response> {
  return async () => {
    throw unimplemented(rpc);
  };
}

async function withErrorMap<T>(operation: () => Promise<T>, notFoundCode: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapClerkError(error, notFoundCode);
  }
}

function requireAdapterMethod<T extends (...args: never[]) => Promise<unknown>>(method: T | undefined, rpc: string): T {
  if (!method) {
    throw unimplemented(rpc);
  }
  return method;
}

function canonicalInvitationStatusToClerk(status: InvitationStatus | null | undefined): string | undefined {
  switch (status) {
    case id.InvitationStatus.INVITATION_STATUS_PENDING:
      return 'pending';
    case id.InvitationStatus.INVITATION_STATUS_ACCEPTED:
      return 'accepted';
    case id.InvitationStatus.INVITATION_STATUS_REVOKED:
      return 'revoked';
    default:
      return undefined;
  }
}

function canonicalSessionStatusToClerk(status: SessionStatus | null | undefined): string | undefined {
  switch (status) {
    case id.SessionStatus.SESSION_STATUS_ACTIVE:
      return 'active';
    case id.SessionStatus.SESSION_STATUS_ENDED:
      return 'ended';
    case id.SessionStatus.SESSION_STATUS_REVOKED:
      return 'revoked';
    default:
      return undefined;
  }
}

function readString(raw: JsonObject, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value : '';
}

function listMetaSource<T>(
  response: { data?: unknown[]; totalCount?: number | undefined; total_count?: number | undefined },
  filteredItems: T[],
  filtered: boolean,
) {
  return filtered ? { data: filteredItems, totalCount: filteredItems.length } : response;
}

async function applyMembershipMetadata(
  adapter: ClerkIdentityAdapter,
  organizationId: string,
  userId: string,
  metadata: proto.rntme.contracts.common.v1.IMetadata | null | undefined,
  fallback: JsonObject,
): Promise<JsonObject> {
  if (!metadata || (!metadata.public && !metadata.private)) {
    return fallback;
  }
  const updateMetadata = requireAdapterMethod(adapter.updateOrganizationMembershipMetadata, 'UpdateMembership');
  return updateMetadata({
    organizationId,
    userId,
    publicMetadata: structToJson(metadata.public),
    privateMetadata: structToJson(metadata.private),
  });
}

function timestampToExpiresInDays(timestamp: proto.google.protobuf.ITimestamp | null | undefined): number | undefined {
  const seconds = timestampSeconds(timestamp);
  if (seconds === undefined) {
    return undefined;
  }
  const millisUntilExpiry = seconds * 1000 - Date.now();
  if (millisUntilExpiry <= 0) {
    throw invalidArgument('CreateInvitation expires_at must be in the future for Clerk');
  }
  return Math.max(1, Math.ceil(millisUntilExpiry / (24 * 60 * 60 * 1000)));
}

function hasWritableMetadata(metadata: proto.rntme.contracts.common.v1.IMetadata | null | undefined): boolean {
  return Boolean(metadata?.public || metadata?.private);
}

function timestampSeconds(timestamp: proto.google.protobuf.ITimestamp | null | undefined): number | undefined {
  const seconds = timestamp?.seconds;
  if (typeof seconds === 'number') {
    return seconds;
  }
  if (typeof seconds === 'string') {
    const parsed = Number(seconds);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (seconds && typeof seconds === 'object' && 'toNumber' in seconds && typeof seconds.toNumber === 'function') {
    return seconds.toNumber();
  }
  return undefined;
}
