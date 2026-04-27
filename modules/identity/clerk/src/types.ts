import type { Rntme } from '@rntme/contracts-identity-v1';

export type CanonicalRef = Rntme.contracts.common.v1.ICanonicalRef;
export type ListResponseMeta = Rntme.contracts.common.v1.IListResponseMeta;
export type Metadata = Rntme.contracts.common.v1.IMetadata;

export type User = Rntme.contracts.identity.v1.User;
export type Organization = Rntme.contracts.identity.v1.Organization;
export type OrganizationMembership = Rntme.contracts.identity.v1.OrganizationMembership;
export type Invitation = Rntme.contracts.identity.v1.Invitation;
export type Session = Rntme.contracts.identity.v1.Session;
export type IdentityResolution = Rntme.contracts.identity.v1.IdentityResolution;
export type UserStatus = Rntme.contracts.identity.v1.UserStatus;
export type InvitationStatus = Rntme.contracts.identity.v1.InvitationStatus;
export type SessionStatus = Rntme.contracts.identity.v1.SessionStatus;

export type GetUserRequest = Rntme.contracts.identity.v1.IGetUserRequest;
export type ListUsersRequest = Rntme.contracts.identity.v1.IListUsersRequest;
export type GetOrganizationRequest = Rntme.contracts.identity.v1.IGetOrganizationRequest;
export type ListOrganizationsRequest = Rntme.contracts.identity.v1.IListOrganizationsRequest;
export type GetMembershipRequest = Rntme.contracts.identity.v1.IGetMembershipRequest;
export type ListMembershipsRequest = Rntme.contracts.identity.v1.IListMembershipsRequest;
export type GetInvitationRequest = Rntme.contracts.identity.v1.IGetInvitationRequest;
export type ListInvitationsRequest = Rntme.contracts.identity.v1.IListInvitationsRequest;
export type GetSessionRequest = Rntme.contracts.identity.v1.IGetSessionRequest;
export type ListSessionsRequest = Rntme.contracts.identity.v1.IListSessionsRequest;
export type ResolveIdentityRequest = Rntme.contracts.identity.v1.IResolveIdentityRequest;
export type IntrospectSessionRequest = Rntme.contracts.identity.v1.IIntrospectSessionRequest;
export type CreateUserRequest = Rntme.contracts.identity.v1.ICreateUserRequest;
export type UpdateUserRequest = Rntme.contracts.identity.v1.IUpdateUserRequest;
export type DeleteUserRequest = Rntme.contracts.identity.v1.IDeleteUserRequest;
export type CreateOrganizationRequest = Rntme.contracts.identity.v1.ICreateOrganizationRequest;
export type UpdateOrganizationRequest = Rntme.contracts.identity.v1.IUpdateOrganizationRequest;
export type DeleteOrganizationRequest = Rntme.contracts.identity.v1.IDeleteOrganizationRequest;
export type CreateInvitationRequest = Rntme.contracts.identity.v1.ICreateInvitationRequest;
export type RevokeInvitationRequest = Rntme.contracts.identity.v1.IRevokeInvitationRequest;
export type AddMembershipRequest = Rntme.contracts.identity.v1.IAddMembershipRequest;
export type UpdateMembershipRequest = Rntme.contracts.identity.v1.IUpdateMembershipRequest;
export type RemoveMembershipRequest = Rntme.contracts.identity.v1.IRemoveMembershipRequest;
export type RevokeSessionRequest = Rntme.contracts.identity.v1.IRevokeSessionRequest;

export type JsonObject = Record<string, unknown>;

export interface Paginated<T> {
  data?: T[];
  totalCount?: number | undefined;
  total_count?: number | undefined;
}

export interface CloudEvent<TData = unknown> {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  subject?: string;
  time: string;
  datacontenttype: 'application/json';
  data: TData;
}

export interface ModuleContext {
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
  readonly actorUserId?: string;
  readonly tenantId?: string;
}

export interface ClerkWebhookEvent {
  id?: string;
  type: string;
  data: JsonObject;
  event_attributes?: JsonObject;
}
