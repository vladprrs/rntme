/**
 * Canonical Identity v1 capability universe. Vendor modules declare subsets of
 * these values in module.json#capabilities; conformance reports use the same
 * lists for skip/report labelling and drift guards.
 */

export const IDENTITY_CANONICAL_RPCS = [
  'AddMembership',
  'CreateInvitation',
  'CreateOrganization',
  'CreateUser',
  'DeleteOrganization',
  'DeleteUser',
  'GetInvitation',
  'GetMembership',
  'GetOrganization',
  'GetSession',
  'GetUser',
  'IntrospectSession',
  'ListInvitations',
  'ListMemberships',
  'ListOrganizations',
  'ListSessions',
  'ListUsers',
  'RemoveMembership',
  'ResolveIdentity',
  'RevokeInvitation',
  'RevokeSession',
  'UpdateMembership',
  'UpdateOrganization',
  'UpdateUser',
] as const;

export const IDENTITY_CANONICAL_EVENTS = [
  'UserCreated',
  'UserUpdated',
  'UserDeleted',
  'UserEmailVerified',
  'OrganizationCreated',
  'OrganizationUpdated',
  'OrganizationDeleted',
  'MembershipCreated',
  'MembershipUpdated',
  'MembershipDeleted',
  'InvitationCreated',
  'InvitationAccepted',
  'InvitationRevoked',
  'InvitationExpired',
  'SessionCreated',
  'SessionEnded',
  'SessionRevoked',
] as const;

export const IDENTITY_CAPABILITY_FIELDS = [
  'vendors',
  'rpcs',
  'events',
  'entities',
  'session',
  'organization',
  'membership',
  'invitation',
  'webhook_events',
] as const;

export const IDENTITY_ERROR_CODE_LAYERS = ['structural', 'references', 'consistency', 'vendor'] as const;
export const IDENTITY_ENTITY_TYPES = ['user', 'organization', 'membership', 'invitation', 'session'] as const;

type CanonicalRpc = (typeof IDENTITY_CANONICAL_RPCS)[number];
type CanonicalEvent = (typeof IDENTITY_CANONICAL_EVENTS)[number];

export const IDENTITY_SCENARIO_COVERAGE = {
  errorCodes: [
    { code: 'IDENTITY_STRUCTURAL_MISSING_IDEMPOTENCY_KEY', rpc: 'CreateUser' },
    { code: 'IDENTITY_STRUCTURAL_INVALID_EMAIL', rpc: 'CreateUser' },
    { code: 'IDENTITY_REFERENCES_USER_NOT_FOUND', rpc: 'GetUser' },
    { code: 'IDENTITY_REFERENCES_ORGANIZATION_NOT_FOUND', rpc: 'GetOrganization' },
    { code: 'IDENTITY_REFERENCES_MEMBERSHIP_NOT_FOUND', rpc: 'GetMembership' },
    { code: 'IDENTITY_REFERENCES_INVITATION_NOT_FOUND', rpc: 'GetInvitation' },
    { code: 'IDENTITY_REFERENCES_SESSION_NOT_FOUND', rpc: 'GetSession' },
    { code: 'IDENTITY_CONSISTENCY_DUPLICATE_EMAIL', rpc: 'CreateUser' },
    { code: 'IDENTITY_CONSISTENCY_INVITATION_ALREADY_ACCEPTED', rpc: 'CreateInvitation' },
    { code: 'IDENTITY_CONSISTENCY_INVITATION_EXPIRED', rpc: 'CreateInvitation' },
    { code: 'IDENTITY_CONSISTENCY_UNSUPPORTED_MULTIROLE', rpc: 'AddMembership' },
    { code: 'IDENTITY_CONSISTENCY_UNSUPPORTED_HARD_DELETE', rpc: 'DeleteUser' },
    { code: 'IDENTITY_CONSISTENCY_INVALID_TOKEN', rpc: 'IntrospectSession' },
    { code: 'IDENTITY_CONSISTENCY_SESSION_REVOKED', rpc: 'IntrospectSession' },
    { code: 'IDENTITY_VENDOR_RATE_LIMITED', rpc: 'ListUsers' },
    { code: 'IDENTITY_VENDOR_UNAVAILABLE', rpc: 'ListUsers' },
    { code: 'IDENTITY_VENDOR_UNAUTHORIZED', rpc: 'ListUsers' },
    { code: 'IDENTITY_VENDOR_INVALID_REQUEST', rpc: 'ListUsers' },
    { code: 'IDENTITY_HTTP_TOKEN_MISSING', rpc: 'IntrospectSession' },
    { code: 'IDENTITY_HTTP_AUDIENCE_MISSING', rpc: 'IntrospectSession' },
  ],
  events: [
    { event: 'UserCreated', rpc: 'CreateUser' },
    { event: 'UserUpdated', rpc: 'UpdateUser' },
    { event: 'UserDeleted', rpc: 'DeleteUser' },
    { event: 'UserEmailVerified', rpc: 'UpdateUser' },
    { event: 'OrganizationCreated', rpc: 'CreateOrganization' },
    { event: 'OrganizationUpdated', rpc: 'UpdateOrganization' },
    { event: 'OrganizationDeleted', rpc: 'DeleteOrganization' },
    { event: 'MembershipCreated', rpc: 'AddMembership' },
    { event: 'MembershipUpdated', rpc: 'UpdateMembership' },
    { event: 'MembershipDeleted', rpc: 'RemoveMembership' },
    { event: 'InvitationCreated', rpc: 'CreateInvitation' },
    { event: 'InvitationAccepted', rpc: 'CreateInvitation' },
    { event: 'InvitationRevoked', rpc: 'RevokeInvitation' },
    { event: 'InvitationExpired', rpc: 'CreateInvitation' },
    { event: 'SessionCreated', rpc: 'IntrospectSession' },
    { event: 'SessionEnded', rpc: 'IntrospectSession' },
    { event: 'SessionRevoked', rpc: 'RevokeSession' },
  ],
} as const satisfies {
  readonly errorCodes: readonly { readonly code: string; readonly rpc: CanonicalRpc }[];
  readonly events: readonly { readonly event: CanonicalEvent; readonly rpc: CanonicalRpc }[];
};
