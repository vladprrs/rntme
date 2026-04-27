export const WORKOS_SUPPORTED_RPCS = [
  'GetUser',
  'ListUsers',
  'CreateUser',
  'UpdateUser',
  'DeleteUser',
  'GetOrganization',
  'ListOrganizations',
  'CreateOrganization',
  'UpdateOrganization',
  'DeleteOrganization',
  'ListMemberships',
  'AddMembership',
  'UpdateMembership',
  'RemoveMembership',
  'ListInvitations',
  'CreateInvitation',
  'RevokeInvitation',
] as const;

export const WORKOS_UNSUPPORTED_RPCS = [
  'GetMembership',
  'GetInvitation',
  'GetSession',
  'ListSessions',
  'ResolveIdentity',
  'IntrospectSession',
  'RevokeSession',
] as const;

export const WORKOS_SUPPORTED_EVENTS = [
  'rntme.identity.v1.UserCreated',
  'rntme.identity.v1.UserUpdated',
  'rntme.identity.v1.UserDeleted',
  'rntme.identity.v1.OrganizationCreated',
  'rntme.identity.v1.OrganizationUpdated',
  'rntme.identity.v1.OrganizationDeleted',
  'rntme.identity.v1.MembershipCreated',
  'rntme.identity.v1.MembershipUpdated',
  'rntme.identity.v1.MembershipDeleted',
  'rntme.identity.v1.InvitationCreated',
  'rntme.identity.v1.InvitationRevoked',
] as const;

export type SupportedWorkOSRpc = (typeof WORKOS_SUPPORTED_RPCS)[number];
