import { proto } from '@rntme/contracts-identity-v1';
import type { WorkOSIdentityAdapter } from './adapter.js';
import { WORKOS_SUPPORTED_RPCS, WORKOS_UNSUPPORTED_RPCS } from './capabilities.js';
import { invalidArgument, mapWorkOSError, unimplemented } from './errors.js';
import {
  mapListMeta,
  mapWorkOSInvitation,
  mapWorkOSMembership,
  mapWorkOSOrganization,
  mapWorkOSUser,
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
  Invitation,
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
  UpdateMembershipRequest,
  UpdateOrganizationRequest,
  UpdateUserRequest,
  User,
} from './types.js';

const id = proto.rntme.contracts.identity.v1;

type Handler<Request, Response> = (request: Request) => Promise<Response>;

export type WorkOSIdentityModule = {
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
  IntrospectSession: Handler<proto.rntme.contracts.identity.v1.IIntrospectSessionRequest, Session>;
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

export interface CreateWorkOSIdentityModuleOptions {
  readonly adapter: WorkOSIdentityAdapter;
}

export function createWorkOSIdentityModule(options: CreateWorkOSIdentityModuleOptions): WorkOSIdentityModule {
  const { adapter } = options;

  return {
    GetUser: async (request) => withErrorMap(() => adapter.getUser(request.canonical_id ?? '').then(mapWorkOSUser), 'IDENTITY_REFERENCES_USER_NOT_FOUND'),
    ListUsers: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 0;
        const response = await adapter.listUsers({
          limit: limit || undefined,
          after: request.base?.cursor || undefined,
          email: request.email || undefined,
          organizationId: request.organization_id || undefined,
        });
        const users = (response.data ?? []).map(mapWorkOSUser).filter((user) => !request.status || user.status === request.status);
        return id.UserList.create({
          items: users,
          meta: mapListMeta(listMetaSource(response, users, Boolean(request.status)), limit),
        });
      }, 'IDENTITY_REFERENCES_USER_NOT_FOUND'),
    GetOrganization: async (request) =>
      withErrorMap(() => adapter.getOrganization(request.canonical_id ?? '').then(mapWorkOSOrganization), 'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND'),
    ListOrganizations: async (request) =>
      withErrorMap(async () => {
        const limit = request.base?.limit ?? 0;
        const response = await adapter.listOrganizations({
          limit: limit || undefined,
          after: request.base?.cursor || undefined,
          domains: request.slug ? [request.slug] : undefined,
        });
        const organizations = (response.data ?? [])
          .map(mapWorkOSOrganization)
          .filter((organization) => !request.status || organization.status === request.status);
        return id.OrganizationList.create({
          items: organizations,
          meta: mapListMeta(listMetaSource(response, organizations, Boolean(request.status)), limit),
        });
      }, 'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND'),
    GetMembership: unsupported('GetMembership'),
    ListMemberships: async (request) =>
      withErrorMap(async () => {
        if (!request.organization_id && !request.user_id) {
          throw invalidArgument('ListMemberships requires organization_id or user_id for WorkOS');
        }
        const limit = request.base?.limit ?? 0;
        const response = await adapter.listOrganizationMemberships({
          organizationId: request.organization_id || undefined,
          userId: request.user_id || undefined,
          statuses: canonicalMembershipStatusToWorkOS(request.status),
          limit: limit || undefined,
          after: request.base?.cursor || undefined,
        });
        const memberships = (response.data ?? []).map(mapWorkOSMembership);
        return id.OrganizationMembershipList.create({
          items: memberships,
          meta: mapListMeta(response, limit),
        });
      }, 'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND'),
    GetInvitation: unsupported('GetInvitation'),
    ListInvitations: async (request) =>
      withErrorMap(async () => {
        if (!request.organization_id) {
          throw invalidArgument('ListInvitations requires organization_id for WorkOS');
        }
        const limit = request.base?.limit ?? 0;
        const response = await adapter.listInvitations({
          organizationId: request.organization_id,
          email: request.email || undefined,
          limit: limit || undefined,
          after: request.base?.cursor || undefined,
        });
        const invitations = (response.data ?? [])
          .map(mapWorkOSInvitation)
          .filter((invitation) => !request.status || invitation.status === request.status);
        return id.InvitationList.create({
          items: invitations,
          meta: mapListMeta(listMetaSource(response, invitations, Boolean(request.status)), limit),
        });
      }, 'IDENTITY_REFERENCES_INVITATION_NOT_FOUND'),
    GetSession: unsupported('GetSession'),
    ListSessions: unsupported('ListSessions'),
    ResolveIdentity: unsupported('ResolveIdentity'),
    IntrospectSession: unsupported('IntrospectSession'),
    CreateUser: async (request) =>
      withErrorMap(
        () =>
          adapter
            .createUser({
              email: request.email ?? '',
              firstName: request.name?.given || undefined,
              lastName: request.name?.family || undefined,
              emailVerified: request.email_verified || undefined,
              metadata: structToJson(request.metadata?.public),
            })
            .then(mapWorkOSUser),
        'IDENTITY_REFERENCES_USER_NOT_FOUND',
      ),
    UpdateUser: async (request) =>
      withErrorMap(
        () =>
          adapter
            .updateUser({
              userId: request.canonical_id ?? '',
              firstName: request.name?.given || undefined,
              lastName: request.name?.family || undefined,
              metadata: structToJson(request.metadata?.public),
            })
            .then(mapWorkOSUser),
        'IDENTITY_REFERENCES_USER_NOT_FOUND',
      ),
    DeleteUser: async (request) =>
      withErrorMap(async () => {
        requireHardDelete(request.hard_delete, 'DeleteUser');
        return mapWorkOSUser({ ...(await adapter.deleteUser(request.canonical_id ?? '')), deleted: true });
      }, 'IDENTITY_REFERENCES_USER_NOT_FOUND'),
    CreateOrganization: async (request) =>
      withErrorMap(
        () =>
          adapter
            .createOrganization(
              {
                name: request.name ?? '',
                domainData: request.slug ? [{ domain: request.slug }] : undefined,
                externalId: request.context?.tenant_id || undefined,
                metadata: structToJson(request.metadata?.public),
              },
              requestOptions(request.context?.idempotency_key),
            )
            .then(mapWorkOSOrganization),
        'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND',
      ),
    UpdateOrganization: async (request) =>
      withErrorMap(
        () =>
          adapter
            .updateOrganization({
              organization: request.canonical_id ?? '',
              name: request.name || undefined,
              domainData: request.slug ? [{ domain: request.slug }] : undefined,
              metadata: structToJson(request.metadata?.public),
            })
            .then(mapWorkOSOrganization),
        'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND',
      ),
    DeleteOrganization: async (request) =>
      withErrorMap(async () => {
        requireHardDelete(request.hard_delete, 'DeleteOrganization');
        return mapWorkOSOrganization({ ...(await adapter.deleteOrganization(request.canonical_id ?? '')), deleted: true });
      }, 'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND'),
    CreateInvitation: async (request) =>
      withErrorMap(
        async () => {
          if (!request.organization_id) {
            throw invalidArgument('CreateInvitation requires organization_id for WorkOS');
          }
          if ((request.roles?.length ?? 0) > 1) {
            throw invalidArgument('CreateInvitation supports at most one role for WorkOS');
          }
          return mapWorkOSInvitation(
            await adapter.sendInvitation({
              organizationId: request.organization_id,
              email: request.email ?? '',
              roleSlug: request.roles?.[0] || undefined,
              expiresInDays: timestampToExpiresInDays(request.expires_at),
              inviterUserId: request.context?.actor_user_id || undefined,
            }),
          );
        },
        'IDENTITY_REFERENCES_INVITATION_NOT_FOUND',
      ),
    RevokeInvitation: async (request) =>
      withErrorMap(() => adapter.revokeInvitation(request.canonical_id ?? '').then(mapWorkOSInvitation), 'IDENTITY_REFERENCES_INVITATION_NOT_FOUND'),
    AddMembership: async (request) =>
      withErrorMap(
        () =>
          adapter
            .createOrganizationMembership({
              organizationId: request.organization_id ?? '',
              userId: request.user_id ?? '',
              ...membershipRoleParams(request.roles),
            })
            .then(mapWorkOSMembership),
        'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND',
      ),
    UpdateMembership: async (request) =>
      withErrorMap(async () => {
        if (!request.roles?.length) {
          throw invalidArgument('UpdateMembership requires roles for WorkOS');
        }
        return mapWorkOSMembership(
          await adapter.updateOrganizationMembership(request.canonical_id ?? '', {
            ...membershipRoleParams(request.roles),
          }),
        );
      }, 'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND'),
    RemoveMembership: async (request) =>
      withErrorMap(async () => {
        if (!adapter.getOrganizationMembership) {
          throw unimplemented('RemoveMembership');
        }
        const membership = await adapter.getOrganizationMembership(request.canonical_id ?? '');
        await adapter.deleteOrganizationMembership(request.canonical_id ?? '');
        return mapWorkOSMembership({ ...membership, status: 'inactive' });
      }, 'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND'),
    RevokeSession: unsupported('RevokeSession'),
  };
}

export { WORKOS_SUPPORTED_RPCS, WORKOS_UNSUPPORTED_RPCS };

function unsupported<Request, Response>(rpc: string): Handler<Request, Response> {
  return async () => {
    throw unimplemented(rpc);
  };
}

async function withErrorMap<T>(operation: () => Promise<T>, notFoundCode: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapWorkOSError(error, notFoundCode);
  }
}

function canonicalMembershipStatusToWorkOS(status: proto.rntme.contracts.identity.v1.MembershipStatus | null | undefined): string[] | undefined {
  switch (status) {
    case id.MembershipStatus.MEMBERSHIP_STATUS_ACTIVE:
      return ['active'];
    case id.MembershipStatus.MEMBERSHIP_STATUS_PENDING:
      return ['pending'];
    case id.MembershipStatus.MEMBERSHIP_STATUS_REVOKED:
      return ['inactive'];
    case id.MembershipStatus.MEMBERSHIP_STATUS_SUSPENDED:
      throw invalidArgument('ListMemberships cannot safely map suspended status to WorkOS');
    default:
      return undefined;
  }
}

function requireHardDelete(hardDelete: boolean | null | undefined, rpc: string): void {
  if (hardDelete !== true) {
    throw invalidArgument(`${rpc} requires hard_delete=true because WorkOS only supports hard delete`);
  }
}

function membershipRoleParams(roles: readonly string[] | null | undefined): { roleSlug?: string; roleSlugs?: string[] } {
  if (!roles?.length) {
    return {};
  }
  if (roles.length === 1) {
    const roleSlug = roles[0];
    return roleSlug ? { roleSlug } : {};
  }
  return { roleSlugs: [...roles] };
}

function listMetaSource<T>(
  response: { data?: unknown[]; totalCount?: number | undefined; total_count?: number | undefined },
  filteredItems: T[],
  filtered: boolean,
) {
  return filtered ? { data: filteredItems, totalCount: filteredItems.length } : response;
}

function requestOptions(idempotencyKey: string | null | undefined): { idempotencyKey: string } | undefined {
  return idempotencyKey ? { idempotencyKey } : undefined;
}

function timestampToExpiresInDays(timestamp: proto.google.protobuf.ITimestamp | null | undefined): number | undefined {
  const seconds = timestampSeconds(timestamp);
  if (seconds === undefined) {
    return undefined;
  }
  const millisUntilExpiry = seconds * 1000 - Date.now();
  if (millisUntilExpiry <= 0) {
    throw invalidArgument('CreateInvitation expires_at must be in the future for WorkOS');
  }
  return Math.max(1, Math.ceil(millisUntilExpiry / (24 * 60 * 60 * 1000)));
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
