import { proto } from '@rntme/contracts-identity-v1';
import type {
  CanonicalRef,
  Invitation,
  InvitationStatus,
  JsonObject,
  ListResponseMeta,
  Metadata,
  Organization,
  OrganizationMembership,
  Paginated,
  Session,
  SessionStatus,
  User,
  UserStatus,
} from './types.js';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

const MODULE_NAME = '@rntme/identity-clerk';
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

export function mapClerkUser(raw: JsonObject): User {
  const userId = readString(raw, 'id');
  const primaryEmail = primaryItem(raw, 'emailAddresses', 'email_addresses', 'primaryEmailAddressId', 'primary_email_address_id');
  const primaryPhone = primaryItem(raw, 'phoneNumbers', 'phone_numbers', 'primaryPhoneNumberId', 'primary_phone_number_id');
  const deleted = readBoolean(raw, 'deleted') || Boolean(readNumber(raw, 'deletedAt') ?? readNumber(raw, 'deleted_at'));

  return id.User.create({
    ref: canonicalRef(userId),
    email: readString(primaryEmail, 'emailAddress') || readString(primaryEmail, 'email_address'),
    email_verified: verificationIsVerified(primaryEmail),
    name: common.Name.create({
      given: readString(raw, 'firstName') || readString(raw, 'first_name'),
      family: readString(raw, 'lastName') || readString(raw, 'last_name'),
      display: readString(raw, 'fullName') || readString(raw, 'full_name'),
    }),
    phone: readString(primaryPhone, 'phoneNumber') || readString(primaryPhone, 'phone_number'),
    phone_verified: verificationIsVerified(primaryPhone),
    avatar_url: readString(raw, 'imageUrl') || readString(raw, 'image_url'),
    status: mapUserStatus(raw, deleted),
    metadata: toMetadata(raw),
    created_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updatedAt') ?? readDateLike(raw, 'updated_at')) ?? null,
    last_sign_in_at: toTimestamp(readDateLike(raw, 'lastSignInAt') ?? readDateLike(raw, 'last_sign_in_at')) ?? null,
    deleted_at: toTimestamp(readDateLike(raw, 'deletedAt') ?? readDateLike(raw, 'deleted_at')) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapClerkOrganization(raw: JsonObject): Organization {
  const organizationId = readString(raw, 'id');
  const deleted = readBoolean(raw, 'deleted');

  return id.Organization.create({
    ref: canonicalRef(organizationId),
    name: readString(raw, 'name'),
    slug: readString(raw, 'slug'),
    logo_url: readString(raw, 'imageUrl') || readString(raw, 'image_url'),
    status: deleted ? id.OrgStatus.ORG_STATUS_DELETED : id.OrgStatus.ORG_STATUS_ACTIVE,
    metadata: toMetadata(raw),
    max_members: readNumber(raw, 'maxAllowedMemberships') ?? readNumber(raw, 'max_allowed_memberships') ?? 0,
    created_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updatedAt') ?? readDateLike(raw, 'updated_at')) ?? null,
    deleted_at: toTimestamp(readDateLike(raw, 'deletedAt') ?? readDateLike(raw, 'deleted_at')) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapClerkMembership(raw: JsonObject): OrganizationMembership {
  const organizationId =
    readString(raw, 'organizationId') || readString(raw, 'organization_id') || readString(readRecord(raw, 'organization'), 'id');
  const userId =
    readString(raw, 'userId') ||
    readString(raw, 'user_id') ||
    readString(readRecord(raw, 'publicUserData'), 'userId') ||
    readString(readRecord(raw, 'public_user_data'), 'user_id');
  const role = readString(raw, 'role');
  const membershipId = readString(raw, 'id') || membershipCanonicalId(organizationId, userId);

  return id.OrganizationMembership.create({
    ref: canonicalRef(membershipCanonicalId(organizationId, userId), membershipId),
    user_id: userId,
    organization_id: organizationId,
    roles: role ? [role] : [],
    permissions: readStringArray(raw, 'permissions'),
    status: id.MembershipStatus.MEMBERSHIP_STATUS_ACTIVE,
    metadata: toMetadata(raw),
    created_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updatedAt') ?? readDateLike(raw, 'updated_at')) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapClerkInvitation(raw: JsonObject, fallbackOrganizationId = ''): Invitation {
  const organizationId = readString(raw, 'organizationId') || readString(raw, 'organization_id') || fallbackOrganizationId;
  const invitationId = readString(raw, 'id');
  const role = readString(raw, 'role');

  return id.Invitation.create({
    ref: canonicalRef(invitationCanonicalId(organizationId, invitationId), invitationId),
    email: readString(raw, 'emailAddress') || readString(raw, 'email_address'),
    organization_id: organizationId,
    inviter_user_id: readString(raw, 'inviterUserId') || readString(raw, 'inviter_user_id'),
    roles: role ? [role] : [],
    metadata: toMetadata(raw),
    status: mapInvitationStatus(readString(raw, 'status')),
    expires_at: toTimestamp(readDateLike(raw, 'expiresAt') ?? readDateLike(raw, 'expires_at')) ?? null,
    accepted_at: toTimestamp(readDateLike(raw, 'acceptedAt') ?? readDateLike(raw, 'accepted_at')) ?? null,
    revoked_at: toTimestamp(readDateLike(raw, 'revokedAt') ?? readDateLike(raw, 'revoked_at')) ?? null,
    created_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapClerkSession(raw: JsonObject): Session {
  const sessionId = readString(raw, 'id');

  return id.Session.create({
    ref: canonicalRef(sessionId),
    session_id: sessionId,
    user_id: readString(raw, 'userId') || readString(raw, 'user_id'),
    organization_id: readString(raw, 'lastActiveOrganizationId') || readString(raw, 'last_active_organization_id'),
    token_type: id.TokenType.TOKEN_TYPE_OPAQUE_SESSION,
    status: mapSessionStatus(readString(raw, 'status')),
    ip_address: readString(raw, 'lastActiveAtIpAddress') || readString(raw, 'last_active_at_ip_address'),
    user_agent: readString(raw, 'userAgent') || readString(raw, 'user_agent'),
    started_at: toTimestamp(readDateLike(raw, 'createdAt') ?? readDateLike(raw, 'created_at')) ?? null,
    last_active_at: toTimestamp(readDateLike(raw, 'updatedAt') ?? readDateLike(raw, 'lastActiveAt') ?? readDateLike(raw, 'last_active_at')) ?? null,
    expires_at: toTimestamp(readDateLike(raw, 'expireAt') ?? readDateLike(raw, 'expire_at') ?? readDateLike(raw, 'exp')) ?? null,
    revoked_at: toTimestamp(readDateLike(raw, 'revokeAt') ?? readDateLike(raw, 'revoked_at')) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapVerifiedTokenToSession(payload: JsonObject): Session {
  const sessionId = readString(payload, 'sid');
  const expiresAtSeconds = readNumber(payload, 'exp');

  return id.Session.create({
    ref: canonicalRef(sessionId),
    session_id: sessionId,
    user_id: readString(payload, 'sub'),
    organization_id: readString(payload, 'org_id') || readString(payload, 'orgId'),
    token_type: id.TokenType.TOKEN_TYPE_JWT_ACCESS,
    status: id.SessionStatus.SESSION_STATUS_ACTIVE,
    expires_at: expiresAtSeconds === undefined ? null : (toTimestamp(expiresAtSeconds * 1000) ?? null),
    vendor_raw: toStruct(payload),
  });
}

export function mapListMeta<T>(response: Paginated<T>, limit = 0, offset = 0): ListResponseMeta {
  const totalCount = response.totalCount ?? response.total_count ?? 0;
  const items = response.data ?? [];

  return common.ListResponseMeta.create({
    limit,
    total_count: totalCount,
    has_more: limit > 0 ? totalCount > offset + items.length : false,
  });
}

export function toMetadata(raw: JsonObject): Metadata {
  return common.Metadata.create({
    public: toStruct(readRecord(raw, 'publicMetadata') ?? readRecord(raw, 'public_metadata')),
    private: toStruct(readRecord(raw, 'privateMetadata') ?? readRecord(raw, 'private_metadata')),
    unsafe: toStruct(readRecord(raw, 'unsafeMetadata') ?? readRecord(raw, 'unsafe_metadata')),
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

export function structToJson(struct: proto.google.protobuf.IStruct | null | undefined): JsonObject | undefined {
  if (!struct?.fields) {
    return undefined;
  }

  const output: JsonObject = {};
  for (const [key, value] of Object.entries(struct.fields)) {
    output[key] = valueToJson(value);
  }
  return output;
}

export function membershipCanonicalId(organizationId: string, userId: string): string {
  return `${organizationId}:${userId}`;
}

export function invitationCanonicalId(organizationId: string, invitationId: string): string {
  return `${organizationId}:${invitationId}`;
}

export function splitCompositeCanonicalId(canonicalId: string): { first: string; second: string } | undefined {
  const separator = canonicalId.indexOf(':');
  if (separator <= 0 || separator === canonicalId.length - 1) {
    return undefined;
  }
  return { first: canonicalId.slice(0, separator), second: canonicalId.slice(separator + 1) };
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
    return value.listValue.values.map(valueToJson);
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

function mapUserStatus(raw: JsonObject, deleted: boolean): UserStatus {
  if (deleted) {
    return id.UserStatus.USER_STATUS_DELETED;
  }
  if (readBoolean(raw, 'banned') || readBoolean(raw, 'locked')) {
    return id.UserStatus.USER_STATUS_BLOCKED;
  }
  return id.UserStatus.USER_STATUS_ACTIVE;
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

function mapSessionStatus(status: string): SessionStatus {
  switch (status) {
    case 'ended':
      return id.SessionStatus.SESSION_STATUS_ENDED;
    case 'revoked':
      return id.SessionStatus.SESSION_STATUS_REVOKED;
    case 'expired':
      return id.SessionStatus.SESSION_STATUS_EXPIRED;
    default:
      return id.SessionStatus.SESSION_STATUS_ACTIVE;
  }
}

function verificationIsVerified(value: JsonObject | undefined): boolean {
  const verification = readRecord(value, 'verification');
  return readString(verification, 'status') === 'verified';
}

function primaryItem(raw: JsonObject, camelKey: string, snakeKey: string, camelPrimaryKey: string, snakePrimaryKey: string): JsonObject | undefined {
  const items = readArray(raw, camelKey) ?? readArray(raw, snakeKey) ?? [];
  const primaryId = readString(raw, camelPrimaryKey) || readString(raw, snakePrimaryKey);
  const found = items.find((item) => readString(item, 'id') === primaryId);
  return found ?? items[0];
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

function readNumber(raw: JsonObject | undefined, key: string): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw[key];
  return typeof value === 'number' ? value : undefined;
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

function readArray(raw: JsonObject, key: string): JsonObject[] | undefined {
  const value = raw[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter(isRecord);
}

function readStringArray(raw: JsonObject, key: string): string[] {
  const value = raw[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
