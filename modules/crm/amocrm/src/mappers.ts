import { proto } from '@rntme/contracts-crm-v1';
import type {
  Activity,
  Association,
  Company,
  Contact,
  CustomFieldDefinition,
  CustomFieldType,
  Deal,
  DealStatus,
  EntityRef,
  JsonObject,
  ListResponseMeta,
  Metadata,
  Note,
  Owner,
  Paginated,
  Pipeline,
  Stage,
  StageSemantic,
} from './types.js';

const crm = proto.rntme.contracts.crm.v1;
const common = proto.rntme.contracts.common.v1;
const protobuf = proto.google.protobuf;

const MODULE_NAME = '@rntme/crm-amocrm';
const MODULE_VERSION = '0.0.0';
const CONTRACT_VERSION = 'v1';

export function canonicalRef(canonicalId: string, vendorId = canonicalId): ReturnType<typeof common.CanonicalRef.create> {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: MODULE_NAME,
    module_version: MODULE_VERSION,
    contract_version: CONTRACT_VERSION,
  });
}

export function mapAmoContact(raw: JsonObject): Contact {
  const id = readNumber(raw, 'id') ?? 0;
  const name = readString(raw, 'name');
  const firstName = readString(raw, 'first_name');
  const lastName = readString(raw, 'last_name');
  const responsibleUserId = readNumber(raw, 'responsible_user_id') ?? 0;
  const companyId = readCompanyIdFromLinks(raw);

  return crm.Contact.create({
    ref: canonicalRef(String(id), String(id)),
    email: readCustomFieldValue(raw, 'EMAIL') ?? '',
    phone: readCustomFieldValue(raw, 'PHONE') ?? '',
    name: common.Name.create({
      given: firstName || name.split(' ')[0] || '',
      family: lastName || name.split(' ').slice(1).join(' ') || '',
      display: name,
    }),
    title: readCustomFieldValue(raw, 'POSITION') ?? '',
    company_canonical_id: companyId ? String(companyId) : '',
    owner_canonical_id: responsibleUserId ? String(responsibleUserId) : '',
    tags: readTags(raw),
    status: readBoolean(raw, 'is_deleted') ? crm.ContactStatus.CONTACT_STATUS_DELETED : crm.ContactStatus.CONTACT_STATUS_ACTIVE,
    metadata: toMetadata(raw),
    created_at: toTimestamp(readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updated_at')) ?? null,
    deleted_at: readBoolean(raw, 'is_deleted') ? (toTimestamp(readDateLike(raw, 'updated_at')) ?? null) : null,
    vendor_raw: toStruct(raw),
  });
}

export function mapAmoCompany(raw: JsonObject): Company {
  const id = readNumber(raw, 'id') ?? 0;
  const responsibleUserId = readNumber(raw, 'responsible_user_id') ?? 0;

  return crm.Company.create({
    ref: canonicalRef(String(id), String(id)),
    name: readString(raw, 'name'),
    domain: readCustomFieldValue(raw, 'WEB') ?? '',
    industry: readCustomFieldValue(raw, 'INDUSTRY') ?? '',
    employee_count: Number(readCustomFieldValue(raw, 'EMPLOYEES')) || 0,
    annual_revenue: Number(readCustomFieldValue(raw, 'ANNUAL_REVENUE')) || 0,
    currency: '',
    tax_id: readCustomFieldValue(raw, 'TAX_ID') ?? '',
    registration_id: '',
    tax_branch_id: '',
    parent_company_canonical_id: '',
    owner_canonical_id: responsibleUserId ? String(responsibleUserId) : '',
    tags: readTags(raw),
    status: readBoolean(raw, 'is_deleted') ? crm.CompanyStatus.COMPANY_STATUS_DELETED : crm.CompanyStatus.COMPANY_STATUS_ACTIVE,
    metadata: toMetadata(raw),
    created_at: toTimestamp(readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updated_at')) ?? null,
    deleted_at: readBoolean(raw, 'is_deleted') ? (toTimestamp(readDateLike(raw, 'updated_at')) ?? null) : null,
    vendor_raw: toStruct(raw),
  });
}

export function mapAmoLead(raw: JsonObject): Deal {
  const id = readNumber(raw, 'id') ?? 0;
  const pipelineId = readNumber(raw, 'pipeline_id') ?? 0;
  const statusId = readNumber(raw, 'status_id') ?? 0;
  const responsibleUserId = readNumber(raw, 'responsible_user_id') ?? 0;
  const price = readNumber(raw, 'price') ?? 0;
  const isDeleted = readBoolean(raw, 'is_deleted');
  const closedAt = readDateLike(raw, 'closed_at');
  const lossReasonId = readNumber(raw, 'loss_reason_id');

  return crm.Deal.create({
    ref: canonicalRef(String(id), String(id)),
    name: readString(raw, 'name'),
    pipeline_canonical_id: pipelineId ? String(pipelineId) : '',
    stage_canonical_id: statusId ? String(statusId) : '',
    status: deriveDealStatus(raw, isDeleted),
    qualification: crm.DealQualification.DEAL_QUALIFICATION_QUALIFIED,
    amount: price,
    currency: readString(raw, 'currency') || 'RUB',
    probability: 0,
    expected_close_date: toTimestamp(readDateLike(raw, 'closest_task_at')) ?? null,
    closed_at: toTimestamp(closedAt) ?? null,
    close_reason: lossReasonId ? String(lossReasonId) : '',
    primary_contact_canonical_id: readContactIdFromLinks(raw) ?? '',
    company_canonical_id: readCompanyIdFromLinks(raw) ? String(readCompanyIdFromLinks(raw)) : '',
    owner_canonical_id: responsibleUserId ? String(responsibleUserId) : '',
    tags: readTags(raw),
    source: readCustomFieldValue(raw, 'SOURCE') ?? '',
    metadata: toMetadata(raw),
    created_at: toTimestamp(readDateLike(raw, 'created_at')) ?? null,
    updated_at: toTimestamp(readDateLike(raw, 'updated_at')) ?? null,
    deleted_at: isDeleted ? (toTimestamp(readDateLike(raw, 'updated_at')) ?? null) : null,
    vendor_raw: toStruct(raw),
  });
}

export function mapAmoTask(raw: JsonObject): Activity {
  const id = readNumber(raw, 'id') ?? 0;
  const responsibleUserId = readNumber(raw, 'responsible_user_id') ?? 0;
  const entityId = readNumber(raw, 'entity_id') ?? 0;
  const entityType = readString(raw, 'entity_type');
  const isCompleted = readBoolean(raw, 'is_completed');
  const completeTill = readDateLike(raw, 'complete_till');
  const createdAt = readDateLike(raw, 'created_at');
  const updatedAt = readDateLike(raw, 'updated_at');

  return crm.Activity.create({
    ref: canonicalRef(String(id), String(id)),
    type: crm.ActivityType.ACTIVITY_TYPE_TASK,
    subject: readString(raw, 'text'),
    description: readString(raw, 'text'),
    due_at: toTimestamp(completeTill) ?? null,
    completed_at: isCompleted ? (toTimestamp(updatedAt) ?? null) : null,
    duration: null,
    outcome: isCompleted ? crm.ActivityOutcome.ACTIVITY_OUTCOME_COMPLETED : crm.ActivityOutcome.ACTIVITY_OUTCOME_PLANNED,
    is_completed: isCompleted,
    linked_entities: entityId && entityType ? [entityRef(entityType, String(entityId))] : [],
    owner_canonical_id: responsibleUserId ? String(responsibleUserId) : '',
    metadata: toMetadata(raw),
    created_at: toTimestamp(createdAt) ?? null,
    updated_at: toTimestamp(updatedAt) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapAmoNote(raw: JsonObject): Note {
  const id = readNumber(raw, 'id') ?? 0;
  const entityId = readNumber(raw, 'entity_id') ?? 0;
  const entityType = readString(raw, 'entity_type');
  const responsibleUserId = readNumber(raw, 'responsible_user_id') ?? 0;
  const createdAt = readDateLike(raw, 'created_at');
  const updatedAt = readDateLike(raw, 'updated_at');

  return crm.Note.create({
    ref: canonicalRef(String(id), String(id)),
    content: readString(raw, 'text') || readNoteContent(raw),
    title: readString(raw, 'text')?.slice(0, 100) || '',
    parent: entityId && entityType ? entityRef(entityType, String(entityId)) : null,
    author_canonical_id: responsibleUserId ? String(responsibleUserId) : '',
    metadata: toMetadata(raw),
    created_at: toTimestamp(createdAt) ?? null,
    updated_at: toTimestamp(updatedAt) ?? null,
    vendor_raw: toStruct(raw),
  });
}

export function mapAmoPipeline(raw: JsonObject): Pipeline {
  const id = readNumber(raw, 'id') ?? 0;
  const statuses = readArray(raw, 'statuses');

  return crm.Pipeline.create({
    canonical_id: String(id),
    vendor_id: String(id),
    name: readString(raw, 'name'),
    entity_type: 'deal',
    is_default: readBoolean(raw, 'is_main') || readBoolean(raw, 'is_default'),
    stages: statuses.map(mapAmoStatus),
    vendor_raw: toStruct(raw),
  });
}

export function mapAmoStatus(raw: JsonObject): Stage {
  const id = readNumber(raw, 'id') ?? 0;
  const pipelineId = readNumber(raw, 'pipeline_id') ?? 0;
  const type = readString(raw, 'type');

  return crm.Stage.create({
    canonical_id: String(id),
    vendor_id: String(id),
    pipeline_canonical_id: pipelineId ? String(pipelineId) : '',
    name: readString(raw, 'name'),
    order: readNumber(raw, 'sort') ?? 0,
    semantic: mapStageSemantic(readString(raw, 'color'), type),
    probability: 0,
    is_terminal: type === 'closed' || type === 'won' || type === 'lost',
  });
}

export function mapAmoCustomField(raw: JsonObject, entityType: string): CustomFieldDefinition {
  const id = readNumber(raw, 'id') ?? 0;

  return crm.CustomFieldDefinition.create({
    entity_type: entityType,
    logical_name: readString(raw, 'name'),
    vendor_key: String(id),
    field_type: mapCustomFieldType(readString(raw, 'type')),
    label: readString(raw, 'name'),
    is_required: readBoolean(raw, 'is_required'),
    options: readArray(raw, 'enums').map((e) => readString(e, 'value')),
    vendor_raw: toStruct(raw),
  });
}

export function mapAmoOwner(raw: JsonObject): Owner {
  const id = readNumber(raw, 'id') ?? 0;

  return crm.Owner.create({
    canonical_id: String(id),
    vendor_id: String(id),
    email: readString(raw, 'email') || readString(raw, 'login'),
    name: common.Name.create({
      given: readString(raw, 'name')?.split(' ')[0] || '',
      family: readString(raw, 'name')?.split(' ').slice(1).join(' ') || '',
      display: readString(raw, 'name'),
    }),
    is_active: !readBoolean(raw, 'is_deleted') && !readBoolean(raw, 'is_disabled'),
  });
}

export function mapAmoAssociation(raw: JsonObject): Association {
  const fromId = readNumber(raw, 'from_id') ?? 0;
  const toId = readNumber(raw, 'to_id') ?? 0;
  const fromType = readString(raw, 'from_type') || 'contact';
  const toType = readString(raw, 'to_type') || 'company';
  const id = `${fromType}:${fromId}:${toType}:${toId}`;

  return crm.Association.create({
    ref: canonicalRef(id, id),
    from: entityRef(fromType, String(fromId)),
    to: entityRef(toType, String(toId)),
    category: crm.AssociationCategory.ASSOCIATION_CATEGORY_RNTME_DEFINED,
    label: '',
    metadata: toStruct({}),
    created_at: toTimestamp(readDateLike(raw, 'created_at')) ?? null,
    vendor_raw: toStruct(raw),
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
    public: toStruct(customFieldsToMetadata(raw)),
    private: toStruct({}),
    unsafe: toStruct({}),
  });
}

export function toStruct(value: unknown): ReturnType<typeof protobuf.Struct.create> {
  if (!isRecord(value)) {
    return protobuf.Struct.create({ fields: {} });
  }

  const fields: Record<string, ReturnType<typeof protobuf.Value.create>> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    fields[key] = toValue(fieldValue);
  }

  return protobuf.Struct.create({ fields });
}

export function structToJson(struct: { fields?: Record<string, unknown> | null } | null | undefined): JsonObject | undefined {
  if (!struct?.fields) {
    return undefined;
  }

  const output: JsonObject = {};
  for (const [key, value] of Object.entries(struct.fields)) {
    output[key] = valueToJson(value as Parameters<typeof valueToJson>[0]);
  }
  return output;
}

export function entityRef(entityType: string, canonicalId: string): EntityRef {
  return crm.EntityRef.create({
    entity_type: entityType,
    canonical_id: canonicalId,
  });
}

function toValue(value: unknown): ReturnType<typeof protobuf.Value.create> {
  if (value === null || value === undefined) {
    return protobuf.Value.create({ nullValue: protobuf.NullValue.NULL_VALUE });
  }
  if (typeof value === 'string') {
    return protobuf.Value.create({ stringValue: value });
  }
  if (typeof value === 'number') {
    return protobuf.Value.create({ numberValue: value });
  }
  if (typeof value === 'boolean') {
    return protobuf.Value.create({ boolValue: value });
  }
  if (Array.isArray(value)) {
    return protobuf.Value.create({
      listValue: protobuf.ListValue.create({ values: value.map((item) => toValue(item)) }),
    });
  }
  if (isRecord(value)) {
    return protobuf.Value.create({ structValue: toStruct(value) });
  }
  return protobuf.Value.create({ stringValue: String(value) });
}

function valueToJson(value: { stringValue?: string | null | undefined; numberValue?: number | null | undefined; boolValue?: boolean | null | undefined; structValue?: unknown | null | undefined; listValue?: { values?: unknown[] | null | undefined } | null | undefined }): unknown {
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
    return structToJson(value.structValue as ReturnType<typeof protobuf.Struct.create>) ?? {};
  }
  if (value.listValue?.values) {
    return value.listValue.values.map((v) => valueToJson(v as never));
  }
  return null;
}

function toTimestamp(value: number | string | Date | undefined): { seconds: number; nanos: number } | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const millis = value instanceof Date ? value.getTime() : timestampLikeToMillis(value);
  if (!Number.isFinite(millis)) {
    return undefined;
  }
  const seconds = Math.trunc(millis / 1000);
  return {
    seconds,
    nanos: Math.trunc((millis - seconds * 1000) * 1_000_000),
  };
}

function timestampLikeToMillis(value: number | string): number {
  if (typeof value === 'number') {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }
  return Date.parse(value);
}

function customFieldsToMetadata(raw: JsonObject): JsonObject {
  const metadata: JsonObject = {};
  for (const field of readArray(raw, 'custom_fields_values')) {
    const key =
      readString(field, 'field_code') ||
      numberOrString(field, 'field_id') ||
      numberOrString(field, 'id') ||
      readString(field, 'field_name') ||
      readString(field, 'name');
    if (!key) {
      continue;
    }

    const values = readArray(field, 'values')
      .map((value) => readUnknownFieldValue(value))
      .filter((value) => value !== undefined);
    if (values.length === 1) {
      metadata[key] = values[0];
    } else if (values.length > 1) {
      metadata[key] = values;
    }
  }
  return metadata;
}

function readUnknownFieldValue(raw: JsonObject): unknown {
  for (const key of ['value', 'enum', 'enum_id']) {
    const value = raw[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function deriveDealStatus(raw: JsonObject, isDeleted: boolean): DealStatus {
  if (isDeleted) {
    return crm.DealStatus.DEAL_STATUS_DELETED;
  }
  const statusType = readString(raw, 'status_type');
  if (statusType === 'won') {
    return crm.DealStatus.DEAL_STATUS_WON;
  }
  if (statusType === 'lost') {
    return crm.DealStatus.DEAL_STATUS_LOST;
  }
  return crm.DealStatus.DEAL_STATUS_OPEN;
}

function mapStageSemantic(color: string, type?: string | null): StageSemantic {
  if (type === 'won' || color.includes('00ff00') || color.includes('green')) {
    return crm.StageSemantic.STAGE_SEMANTIC_WON;
  }
  if (type === 'lost' || color.includes('ff0000') || color.includes('red')) {
    return crm.StageSemantic.STAGE_SEMANTIC_LOST;
  }
  return crm.StageSemantic.STAGE_SEMANTIC_OPEN;
}

function mapCustomFieldType(type: string): CustomFieldType {
  switch (type) {
    case 'text':
    case 'textarea':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_STRING;
    case 'numeric':
    case 'monetary':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_NUMBER;
    case 'date':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_DATE;
    case 'date_time':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_DATETIME;
    case 'checkbox':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_BOOLEAN;
    case 'select':
    case 'radio_button':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_ENUM;
    case 'multiselect':
    case 'multitext':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_MULTI_SELECT;
    case 'url':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_URL;
    case 'file':
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_FILE;
    default:
      return crm.CustomFieldType.CUSTOM_FIELD_TYPE_STRING;
  }
}

function readCustomFieldValue(raw: JsonObject, fieldCode: string): string | undefined {
  const fields = readArray(raw, 'custom_fields_values');
  const field = fields.find((f) => readString(f, 'field_code') === fieldCode || readString(f, 'field_name') === fieldCode);
  if (!field) {
    return undefined;
  }
  const values = readArray(field, 'values');
  return readString(values[0], 'value') || readString(values[0], 'enum') || undefined;
}

function readCompanyIdFromLinks(raw: JsonObject): number | undefined {
  const companyId = readNumber(raw, 'company_id');
  if (companyId) {
    return companyId;
  }
  const embedded = readRecord(raw, '_embedded') ?? {};
  const companies = readArray(embedded, 'companies');
  if (companies.length > 0) {
    return readNumber(companies[0], 'id');
  }
  return undefined;
}

function readContactIdFromLinks(raw: JsonObject): string | undefined {
  const embedded = readRecord(raw, '_embedded') ?? {};
  const contacts = readArray(embedded, 'contacts');
  if (contacts.length > 0) {
    return String(readNumber(contacts[0], 'id') ?? '');
  }
  return undefined;
}

function readNoteContent(raw: JsonObject): string {
  const params = readRecord(raw, 'params') ?? {};
  return readString(params, 'text') || readString(params, 'note') || '';
}

function readTags(raw: JsonObject): string[] {
  const embedded = readRecord(raw, '_embedded') ?? {};
  const tags = readArray(embedded, 'tags');
  return tags.map((tag) => readString(tag, 'name'));
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
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
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
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function numberOrString(raw: JsonObject, key: string): string {
  const value = raw[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
