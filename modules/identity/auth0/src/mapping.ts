import {
  InvitationStatus,
  MembershipStatus,
  OrgStatus,
  UserStatus,
} from '@rntme/contracts-identity-v1';
import type {
  Auth0Invitation,
  Auth0Membership,
  Auth0Organization,
  Auth0User,
  CanonicalRef,
  IdentityResolution,
  Invitation,
  JsonValue,
  Metadata,
  Organization,
  OrganizationMembership,
  ResolutionInputTypeValue,
  User,
} from './types.js';
import { invalidArgument } from './errors.js';
import { timestamp } from './time.js';

const MODULE_NAME = '@rntme/identity-auth0';
const MODULE_VERSION = '0.0.0';
const CONTRACT_VERSION = 'identity/v1';

type Struct = NonNullable<Metadata['public']>;
type Value = NonNullable<Struct['fields']>[string];

export function canonicalRef(vendorId: string): CanonicalRef {
  return {
    canonical_id: vendorId,
    vendor_id: vendorId,
    module_name: MODULE_NAME,
    module_version: MODULE_VERSION,
    contract_version: CONTRACT_VERSION,
  };
}

function jsonValue(value: unknown): Value {
  if (value === null) return { nullValue: 0 };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isFinite(value) ? { numberValue: value } : { stringValue: String(value) };
  if (typeof value === 'boolean') return { boolValue: value };
  if (value instanceof Date) return { stringValue: value.toISOString() };
  if (Array.isArray(value)) return { listValue: { values: value.map(jsonValue) } };
  if (typeof value === 'object') return { structValue: toStruct(value as Record<string, unknown>) };
  return { stringValue: String(value) };
}

function toStruct(record?: Record<string, unknown>): Struct | undefined {
  if (!record || Object.keys(record).length === 0) return undefined;
  return {
    fields: Object.fromEntries(Object.entries(record).map(([key, value]) => [key, jsonValue(value)])),
  };
}

function fromValue(value: Value | null | undefined): JsonValue {
  if (!value) return null;
  if ('stringValue' in value && value.stringValue != null) return value.stringValue;
  if ('numberValue' in value && value.numberValue != null) return value.numberValue;
  if ('boolValue' in value && value.boolValue != null) return value.boolValue;
  if ('listValue' in value && value.listValue?.values) return value.listValue.values.map(fromValue);
  if ('structValue' in value && value.structValue?.fields) return fromStruct(value.structValue);
  return null;
}

function fromStruct(struct: Struct | null | undefined): Record<string, JsonValue> {
  if (!struct?.fields) return {};
  return Object.fromEntries(Object.entries(struct.fields).map(([key, value]) => [key, fromValue(value)]));
}

export function metadataToAuth0(metadata?: Metadata | null): {
  user_metadata?: Record<string, JsonValue>;
  app_metadata?: Record<string, JsonValue>;
} {
  const userMetadata = fromStruct(metadata?.public);
  const appMetadata = fromStruct(metadata?.private);
  return {
    ...(Object.keys(userMetadata).length ? { user_metadata: userMetadata } : {}),
    ...(Object.keys(appMetadata).length ? { app_metadata: appMetadata } : {}),
  };
}

function auth0Metadata(publicRecord?: Record<string, unknown>, privateRecord?: Record<string, unknown>): Metadata | undefined {
  const publicStruct = toStruct(publicRecord);
  const privateStruct = toStruct(privateRecord);
  if (!publicStruct && !privateStruct) return undefined;
  return {
    public: publicStruct,
    private: privateStruct,
  };
}

function vendorRaw(record: Record<string, unknown>): Struct {
  return toStruct(record) ?? { fields: {} };
}

export function mapAuth0User(user: Auth0User): User {
  const id = user.user_id ?? '';
  return {
    ref: canonicalRef(id),
    email: user.email ?? '',
    email_verified: user.email_verified ?? false,
    name: {
      given: user.given_name ?? '',
      family: user.family_name ?? '',
      display: user.name ?? '',
    },
    phone: user.phone_number ?? '',
    phone_verified: user.phone_verified ?? false,
    avatar_url: user.picture ?? '',
    status: user.deleted ? UserStatus.USER_STATUS_DELETED : user.blocked ? UserStatus.USER_STATUS_BLOCKED : UserStatus.USER_STATUS_ACTIVE,
    metadata: auth0Metadata(user.user_metadata, user.app_metadata),
    created_at: timestamp(user.created_at),
    updated_at: timestamp(user.updated_at),
    last_sign_in_at: timestamp(user.last_login),
    deleted_at: timestamp(user.deleted_at),
    vendor_raw: vendorRaw(user),
  };
}

export function mapAuth0Organization(organization: Auth0Organization): Organization {
  const id = organization.id ?? '';
  const metadata = organization.metadata ?? {};
  const rawMaxMembers = metadata.max_members;
  const maxMembers =
    typeof rawMaxMembers === 'number'
      ? rawMaxMembers
      : typeof rawMaxMembers === 'string'
        ? Number.parseInt(rawMaxMembers, 10) || 0
        : 0;
  return {
    ref: canonicalRef(id),
    name: organization.display_name ?? organization.name ?? '',
    slug: organization.name ?? '',
    logo_url: organization.branding?.logo_url ?? '',
    description: typeof metadata.description === 'string' ? metadata.description : '',
    status: organization.deleted ? OrgStatus.ORG_STATUS_DELETED : OrgStatus.ORG_STATUS_ACTIVE,
    metadata: auth0Metadata(metadata),
    max_members: maxMembers,
    created_at: timestamp(organization.created_at),
    updated_at: timestamp(organization.updated_at),
    deleted_at: timestamp(organization.deleted_at),
    vendor_raw: vendorRaw(organization),
  };
}

function roleId(role: string | { id?: string; name?: string }): string {
  return typeof role === 'string' ? role : role.id ?? role.name ?? '';
}

export function membershipId(organizationId: string, userId: string): string {
  return `${organizationId}:${userId}`;
}

export function parseCompositeId(canonicalId: string): { organizationId: string; resourceId: string } {
  const separator = canonicalId.indexOf(':');
  if (separator < 1 || separator === canonicalId.length - 1) {
    throw invalidArgument(`Expected canonical id in <organization_id>:<resource_id> form, got ${canonicalId || '<empty>'}`);
  }
  return {
    organizationId: canonicalId.slice(0, separator),
    resourceId: canonicalId.slice(separator + 1),
  };
}

export function mapAuth0Membership(membership: Auth0Membership): OrganizationMembership {
  const organizationId = membership.organization_id ?? '';
  const userId = membership.user_id ?? '';
  return {
    ref: canonicalRef(membership.id ?? membershipId(organizationId, userId)),
    user_id: userId,
    organization_id: organizationId,
    roles: (membership.roles ?? []).map(roleId).filter(Boolean),
    permissions: [],
    status: MembershipStatus.MEMBERSHIP_STATUS_ACTIVE,
    created_at: timestamp(membership.created_at),
    updated_at: timestamp(membership.updated_at),
    vendor_raw: vendorRaw(membership),
  };
}

export function invitationId(organizationId: string, id: string): string {
  return `${organizationId}:${id}`;
}

export function mapAuth0Invitation(invitation: Auth0Invitation): Invitation {
  const organizationId = invitation.organization_id ?? '';
  const id = invitation.id ?? '';
  const expiresAtMillis = typeof invitation.expires_at === 'string' ? Date.parse(invitation.expires_at) : Number.NaN;
  const status = invitation.revoked
    ? InvitationStatus.INVITATION_STATUS_REVOKED
    : invitation.accepted_at
      ? InvitationStatus.INVITATION_STATUS_ACCEPTED
      : !Number.isNaN(expiresAtMillis) && expiresAtMillis < Date.now()
        ? InvitationStatus.INVITATION_STATUS_EXPIRED
        : InvitationStatus.INVITATION_STATUS_PENDING;
  return {
    ref: canonicalRef(invitationId(organizationId, id)),
    email: invitation.invitee?.email ?? '',
    organization_id: organizationId,
    inviter_user_id: invitation.inviter?.user_id ?? '',
    roles: invitation.roles ?? [],
    metadata: auth0Metadata(invitation.user_metadata, invitation.app_metadata),
    status,
    expires_at: timestamp(invitation.expires_at),
    accepted_at: timestamp(invitation.accepted_at),
    revoked_at: timestamp(invitation.revoked_at),
    created_at: timestamp(invitation.created_at),
    vendor_raw: vendorRaw(invitation),
  };
}

export function toIdentityResolution(
  entity: User | Organization | null,
  kind: 'user' | 'organization',
  inputType: ResolutionInputTypeValue,
  inputValue: string,
): IdentityResolution {
  if (!entity) {
    return {
      exists: false,
      canonical_id: '',
      input_type: inputType,
      input_value: inputValue,
      resolved_at: timestamp(new Date().toISOString()),
    };
  }

  const canonicalId = entity.ref?.canonical_id ?? '';
  return {
    exists: true,
    canonical_id: canonicalId,
    input_type: inputType,
    input_value: inputValue,
    resolved_at: timestamp(new Date().toISOString()),
    ...(kind === 'user' ? { user: entity as User } : { organization: entity as Organization }),
  };
}
