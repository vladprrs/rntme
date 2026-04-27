import type { Rntme } from '@rntme/contracts-identity-v1';

export type CanonicalRef = Rntme.contracts.common.v1.ICanonicalRef;
export type Metadata = Rntme.contracts.common.v1.IMetadata;
export type ListRequest = Rntme.contracts.common.v1.IListRequest;
export type ListResponseMeta = Rntme.contracts.common.v1.IListResponseMeta;

export type User = Rntme.contracts.identity.v1.IUser;
export type Organization = Rntme.contracts.identity.v1.IOrganization;
export type OrganizationMembership = Rntme.contracts.identity.v1.IOrganizationMembership;
export type Invitation = Rntme.contracts.identity.v1.IInvitation;
export type Session = Rntme.contracts.identity.v1.ISession;
export type IdentityResolution = Rntme.contracts.identity.v1.IIdentityResolution;
export type UserList = Rntme.contracts.identity.v1.IUserList;
export type OrganizationList = Rntme.contracts.identity.v1.IOrganizationList;
export type OrganizationMembershipList = Rntme.contracts.identity.v1.IOrganizationMembershipList;
export type InvitationList = Rntme.contracts.identity.v1.IInvitationList;
export type SessionList = Rntme.contracts.identity.v1.ISessionList;

export type UserCreated = Rntme.contracts.identity.v1.IUserCreated;
export type UserUpdated = Rntme.contracts.identity.v1.IUserUpdated;
export type UserDeleted = Rntme.contracts.identity.v1.IUserDeleted;
export type UserEmailVerified = Rntme.contracts.identity.v1.IUserEmailVerified;
export type OrganizationCreated = Rntme.contracts.identity.v1.IOrganizationCreated;
export type MembershipCreated = Rntme.contracts.identity.v1.IMembershipCreated;
export type MembershipDeleted = Rntme.contracts.identity.v1.IMembershipDeleted;
export type InvitationCreated = Rntme.contracts.identity.v1.IInvitationCreated;
export type InvitationAccepted = Rntme.contracts.identity.v1.IInvitationAccepted;
export type InvitationRevoked = Rntme.contracts.identity.v1.IInvitationRevoked;

export type GetUserRequest = Rntme.contracts.identity.v1.IGetUserRequest;
export type ListUsersRequest = Rntme.contracts.identity.v1.IListUsersRequest;
export type CreateUserRequest = Rntme.contracts.identity.v1.ICreateUserRequest;
export type UpdateUserRequest = Rntme.contracts.identity.v1.IUpdateUserRequest;
export type DeleteUserRequest = Rntme.contracts.identity.v1.IDeleteUserRequest;
export type ResolveIdentityRequest = Rntme.contracts.identity.v1.IResolveIdentityRequest;
export type GetOrganizationRequest = Rntme.contracts.identity.v1.IGetOrganizationRequest;
export type ListOrganizationsRequest = Rntme.contracts.identity.v1.IListOrganizationsRequest;
export type CreateOrganizationRequest = Rntme.contracts.identity.v1.ICreateOrganizationRequest;
export type UpdateOrganizationRequest = Rntme.contracts.identity.v1.IUpdateOrganizationRequest;
export type DeleteOrganizationRequest = Rntme.contracts.identity.v1.IDeleteOrganizationRequest;
export type GetMembershipRequest = Rntme.contracts.identity.v1.IGetMembershipRequest;
export type ListMembershipsRequest = Rntme.contracts.identity.v1.IListMembershipsRequest;
export type AddMembershipRequest = Rntme.contracts.identity.v1.IAddMembershipRequest;
export type UpdateMembershipRequest = Rntme.contracts.identity.v1.IUpdateMembershipRequest;
export type RemoveMembershipRequest = Rntme.contracts.identity.v1.IRemoveMembershipRequest;
export type CreateInvitationRequest = Rntme.contracts.identity.v1.ICreateInvitationRequest;
export type ListInvitationsRequest = Rntme.contracts.identity.v1.IListInvitationsRequest;
export type GetInvitationRequest = Rntme.contracts.identity.v1.IGetInvitationRequest;
export type RevokeInvitationRequest = Rntme.contracts.identity.v1.IRevokeInvitationRequest;
export type GetSessionRequest = Rntme.contracts.identity.v1.IGetSessionRequest;
export type ListSessionsRequest = Rntme.contracts.identity.v1.IListSessionsRequest;
export type IntrospectSessionRequest = Rntme.contracts.identity.v1.IIntrospectSessionRequest;
export type RevokeSessionRequest = Rntme.contracts.identity.v1.IRevokeSessionRequest;

export type ResolutionInputTypeValue = Rntme.contracts.identity.v1.ResolutionInputType;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface Auth0User extends Record<string, unknown> {
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  phone_number?: string;
  phone_verified?: boolean;
  picture?: string;
  blocked?: boolean;
  created_at?: string | Record<string, unknown>;
  updated_at?: string | Record<string, unknown>;
  last_login?: string | Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface Auth0Organization extends Record<string, unknown> {
  id?: string;
  name?: string;
  display_name?: string;
  branding?: {
    logo_url?: string;
    colors?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface Auth0Membership extends Record<string, unknown> {
  id?: string;
  organization_id?: string;
  user_id?: string;
  roles?: Array<string | { id?: string; name?: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface Auth0Invitation extends Record<string, unknown> {
  id?: string;
  organization_id?: string;
  invitee?: { email?: string };
  inviter?: { user_id?: string; name?: string };
  roles?: string[];
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  created_at?: string;
  expires_at?: string;
  accepted_at?: string;
  revoked_at?: string;
  revoked?: boolean;
}

export interface ListResult<T> {
  readonly items: readonly T[];
  readonly total?: number;
  readonly hasMore?: boolean;
  readonly nextCursor?: string;
}

export interface ListParams {
  readonly limit?: number;
  readonly cursor?: string;
  readonly offset?: number;
  readonly email?: string;
  readonly status?: number;
  readonly organizationId?: string;
  readonly slug?: string;
}
