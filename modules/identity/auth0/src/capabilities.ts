export const CLAIMED_RPCS = [
  'GetUser',
  'ListUsers',
  'CreateUser',
  'UpdateUser',
  'DeleteUser',
  'ResolveIdentity',
  'GetOrganization',
  'ListOrganizations',
  'CreateOrganization',
  'UpdateOrganization',
  'DeleteOrganization',
  'ListMemberships',
  'AddMembership',
  'RemoveMembership',
  'CreateInvitation',
  'ListInvitations',
  'GetInvitation',
  'RevokeInvitation',
] as const;

export const SESSION_RPCS = ['GetSession', 'ListSessions', 'IntrospectSession', 'RevokeSession'] as const;

export const CLAIMED_EVENTS = [
  'UserCreated',
  'UserDeleted',
  'UserEmailVerified',
  'OrganizationCreated',
  'MembershipCreated',
  'MembershipDeleted',
  'InvitationCreated',
  'InvitationAccepted',
  'InvitationRevoked',
] as const;
