import { proto } from '@rntme/contracts-identity-v1';
import type {
  CanonicalRef,
  Invitation,
  InvitationStatus,
  JsonObject,
  ListResponseMeta,
  MembershipStatus,
  Metadata,
  Organization,
  OrganizationMembership,
  Paginated,
  User,
} from './types.js';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

const MODULE_NAME = '@rntme/identity-workos';
const MODULE_VERSION = '0.0.0';
const CONTRACT_VERSION = 'v1';

export function canonicalRef(canonicalId: string, vendorId = canonicalId): CanonicalRef {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: MODULE_NAME,
    module_version: MODULE_VERSION,
    contract_version: CONTRACT_VERSION,
  });
}

export function mapWorkOSUser(raw: JsonObject): User {
  const userId = readString(raw, 'id');
  const firstName = readString(raw, 'firstName') || readString(raw, 'first_name');
  const lastName = readString(raw, 'lastName') || readString(raw, 'last_name');
  const deleted = readBoolean(raw, 'deleted');

  return id.User.create({
    ref: canonicalRef(userId),
    email: readString(raw, 'email'),
    email_verified: readBoolean(raw, 'emailVerified') || readBoolean(raw, 'email_verified'),
    name: common.Name.create({
      given: firstName,
      family: lastName,
      display: [firstName, lastName].filter(Boolean).join(' '),
    }),
    avatar_url: readString(raw, 'profilePictureUrl') || readString(raw, 'profile_picture_url'),
    status: deleted ? id.UserStatus.USER_STATUS_DELETED : id.UserStatus.USER_STATUS_ACTIVE,
    metadata: toMetadata(raw),
    created_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updatedAt') ?? readDateLike(raw, 'updated_at')) ?? null,
    last_sign_in_at: toTimestamp(readDateLike(raw, 'lastSignInAt') ?? readDateLike(raw, 'last_sign_in_at')) ?? null,
    deleted_at: deleted ? (toTimestamp(Date.now()) ?? null) : null,
    vendor_raw: toStruct(raw),
  });
}

export function mapWorkOSOrganization(raw: JsonObject): Organization {
  const organizationId = readString(raw, 'id');
  const deleted = readBoolean(raw, 'deleted');

  return id.Organization.create({
    ref: canonicalRef(organizationId),
    name: readString(raw, 'name'),
    slug: firstDomain(raw),
    status: deleted ? id.OrgStatus.ORG_STATUS_DELETED : id.OrgStatus.ORG_STATUS_ACTIVE,
    metadata: toMetadata(raw),
    created_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updatedAt') ?? readDateLike(raw, 'updated_at')) ?? null,
    deleted_at: deleted ? (toTimestamp(Date.now()) ?? null) : null,
    vendor_raw: toStruct(raw),
  });
}

export function mapWorkOSMembership(raw: JsonObject): OrganizationMembership {
  const membershipId = readString(raw, 'id');
  const roles = roleSlugs(raw);

  return id.OrganizationMembership.create({
    ref: canonicalRef(membershipId),
    user_id: readString(raw, 'userId') || readString(raw, 'user_id'),
    organization_id: readString(raw, 'organizationId') || readString(raw, 'organization_id'),
    roles,
    status: mapMembershipStatus(readString(raw, 'status')),
    metadata: common.Metadata.create({
      public: toStruct(readRecord(raw, 'customAttributes') ?? readRecord(raw, 'custom_attributes')),
      private: toStruct({ directoryManaged: readBoolean(raw, 'directoryManaged') || readBoolean(raw, 'directory_managed') }),
      unsafe: toStruct(undefined),
    }),
    created_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updatedAt') ?? readDateLike(raw, 'updated_at')) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapWorkOSInvitation(raw: JsonObject): Invitation {
  const invitationId = readString(raw, 'id');
  const role = readString(raw, 'roleSlug') || readString(raw, 'role_slug');

  return id.Invitation.create({
    ref: canonicalRef(invitationId),
    email: readString(raw, 'email'),
    organization_id: readString(raw, 'organizationId') || readString(raw, 'organization_id'),
    inviter_user_id: readString(raw, 'inviterUserId') || readString(raw, 'inviter_user_id'),
    roles: role ? [role] : [],
    metadata: toMetadata(raw),
    status: mapInvitationStatus(readString(raw, 'state') || readString(raw, 'status')),
    expires_at: toTimestamp(readDateLike(raw, 'expiresAt') ?? readDateLike(raw, 'expires_at')) ?? null,
    accepted_at: toTimestamp(readDateLike(raw, 'acceptedAt') ?? readDateLike(raw, 'accepted_at')) ?? null,
    revoked_at: toTimestamp(readDateLike(raw, 'revokedAt') ?? readDateLike(raw, 'revoked_at')) ?? null,
    created_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapListMeta<T>(response: Paginated<T>, limit = 0): ListResponseMeta {
  const totalCount = response.totalCount ?? response.total_count ?? 0;
  const cursor = response.listMetadata ?? response.list_metadata;

  return common.ListResponseMeta.create({
    limit,
    next_cursor: cursor?.after ?? '',
    prev_cursor: cursor?.before ?? '',
    total_count: totalCount,
    has_more: Boolean(cursor?.after),
  });
}

export function toMetadata(raw: JsonObject): Metadata {
  return common.Metadata.create({
    public: toStruct(readRecord(raw, 'metadata')),
    private: toStruct(undefined),
    unsafe: toStruct(undefined),
  });
}

export function toStruct(value: unknown): proto.google.protobuf.IStruct {
  if (!isRecord(value)) {
    return proto.google.protobuf.Struct.create({ fields: {} });
  }

  const fields: Record<string, proto.google.protobuf.IValue> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    fields[key] = toValue(fieldValue);
  }

  return proto.google.protobuf.Struct.create({ fields });
}

export function structToJson(struct: proto.google.protobuf.IStruct | null | undefined): Record<string, string> | undefined {
  if (!struct?.fields) {
    return undefined;
  }

  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(struct.fields)) {
    const json = valueToJson(value);
    if (json !== null && json !== undefined) {
      output[key] = String(json);
    }
  }
  return output;
}

function toValue(value: unknown): proto.google.protobuf.IValue {
  if (value === null || value === undefined) {
    return proto.google.protobuf.Value.create({ nullValue: proto.google.protobuf.NullValue.NULL_VALUE });
  }
  if (typeof value === 'string') {
    return proto.google.protobuf.Value.create({ stringValue: value });
  }
  if (typeof value === 'number') {
    return proto.google.protobuf.Value.create({ numberValue: value });
  }
  if (typeof value === 'boolean') {
    return proto.google.protobuf.Value.create({ boolValue: value });
  }
  if (Array.isArray(value)) {
    return proto.google.protobuf.Value.create({
      listValue: proto.google.protobuf.ListValue.create({ values: value.map((item) => toValue(item)) }),
    });
  }
  if (isRecord(value)) {
    return proto.google.protobuf.Value.create({ structValue: toStruct(value) });
  }
  return proto.google.protobuf.Value.create({ stringValue: String(value) });
}

function valueToJson(value: proto.google.protobuf.IValue): unknown {
  if (value.stringValue !== undefined && value.stringValue !== null) {
    return value.stringValue;
  }
  if (value.numberValue !== undefined && value.numberValue !== null) {
    return value.numberValue;
  }
  if (value.boolValue !== undefined && value.boolValue !== null) {
    return value.boolValue;
  }
  if (value.structValue) {
    return structToJson(value.structValue) ?? {};
  }
  if (value.listValue?.values) {
    return value.listValue.values.map(valueToJson).join(',');
  }
  return null;
}

function toTimestamp(value: number | string | Date | undefined): proto.google.protobuf.ITimestamp | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const millis = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(millis)) {
    return undefined;
  }
  return {
    seconds: Math.trunc(millis / 1000),
    nanos: (millis % 1000) * 1_000_000,
  };
}

function mapMembershipStatus(status: string): MembershipStatus {
  switch (status) {
    case 'inactive':
      return id.MembershipStatus.MEMBERSHIP_STATUS_REVOKED;
    case 'pending':
      return id.MembershipStatus.MEMBERSHIP_STATUS_PENDING;
    case 'active':
    default:
      return id.MembershipStatus.MEMBERSHIP_STATUS_ACTIVE;
  }
}

function mapInvitationStatus(status: string): InvitationStatus {
  switch (status) {
    case 'accepted':
      return id.InvitationStatus.INVITATION_STATUS_ACCEPTED;
    case 'revoked':
      return id.InvitationStatus.INVITATION_STATUS_REVOKED;
    case 'expired':
      return id.InvitationStatus.INVITATION_STATUS_EXPIRED;
    default:
      return id.InvitationStatus.INVITATION_STATUS_PENDING;
  }
}

function firstDomain(raw: JsonObject): string {
  const domains = readArray(raw, 'domains') ?? [];
  const first = domains[0];
  return readString(first, 'domain');
}

function roleSlugs(raw: JsonObject): string[] {
  const explicit = readStringArray(raw, 'roleSlugs').concat(readStringArray(raw, 'role_slugs'));
  const role = readString(raw, 'roleSlug') || readString(raw, 'role_slug') || readString(readRecord(raw, 'role'), 'slug');
  const roles = readArray(raw, 'roles').map((item) => readString(item, 'slug')).filter(Boolean);
  return [...explicit, ...(role ? [role] : []), ...roles];
}

function readDateLike(raw: JsonObject, key: string): number | string | Date | undefined {
  const value = raw[key];
  return typeof value === 'number' || typeof value === 'string' || value instanceof Date ? value : undefined;
}

function readString(raw: JsonObject | undefined, key: string): string {
  if (!raw) {
    return '';
  }
  const value = raw[key];
  return typeof value === 'string' ? value : '';
}

function readBoolean(raw: JsonObject | undefined, key: string): boolean {
  if (!raw) {
    return false;
  }
  const value = raw[key];
  return typeof value === 'boolean' ? value : false;
}

function readRecord(raw: JsonObject | undefined, key: string): JsonObject | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw[key];
  return isRecord(value) ? value : undefined;
}

function readArray(raw: JsonObject, key: string): JsonObject[] {
  const value = raw[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readStringArray(raw: JsonObject, key: string): string[] {
  const value = raw[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
