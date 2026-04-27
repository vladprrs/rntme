export const CLERK_SUPPORTED_RPCS = [
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
  'GetSession',
  'ListSessions',
  'IntrospectSession',
  'RevokeSession',
] as const;

export const CLERK_UNSUPPORTED_RPCS = ['GetMembership', 'GetInvitation', 'ResolveIdentity'] as const;

export const CLERK_SUPPORTED_EVENTS = [
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
  'rntme.identity.v1.InvitationAccepted',
  'rntme.identity.v1.InvitationRevoked',
  'rntme.identity.v1.SessionCreated',
  'rntme.identity.v1.SessionEnded',
  'rntme.identity.v1.SessionRevoked',
] as const;

export type SupportedClerkRpc = (typeof CLERK_SUPPORTED_RPCS)[number];
