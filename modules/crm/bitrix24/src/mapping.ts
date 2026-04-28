import {
  ActivityOutcome,
  ActivityType,
  AssociationCategory,
  CompanyStatus,
  ContactStatus,
  CustomFieldType,
  DealQualification,
  DealStatus,
  StageSemantic,
} from '@rntme/contracts-crm-v1';
import type { Association, Bitrix24Record, CustomFieldDefinition, EntityRef, JsonValue, Pipeline } from './types.js';

const MODULE_NAME = '@rntme/crm-bitrix24';
const CONTRACT_VERSION = 'crm/v1';

export function canonicalId(entityType: string, vendorId: unknown, pipelineId?: unknown): string {
  const id = String(vendorId ?? '');
  return pipelineId === undefined ? `bitrix24:${entityType}:${id}` : `bitrix24:${entityType}:${String(pipelineId)}:${id}`;
}

export function vendorIdFromCanonical(canonicalIdValue: string | null | undefined): string {
  const value = String(canonicalIdValue ?? '');
  const parts = value.split(':');
  if (parts[0] === 'bitrix24' && parts.length >= 3) {
    return parts.slice(2).join(':');
  }
  return parts.pop() ?? '';
}

export function stageIdFromCanonical(canonicalIdValue: string | null | undefined): string {
  const payload = vendorIdFromCanonical(canonicalIdValue);
  const separator = payload.indexOf(':');
  return separator >= 0 ? payload.slice(separator + 1) : payload;
}

export function entityFromOwnerTypeId(ownerTypeId: unknown): string {
  switch (String(ownerTypeId ?? '').toUpperCase()) {
    case '1':
    case 'LEAD':
      return 'deal';
    case '2':
    case 'DEAL':
      return 'deal';
    case '3':
    case 'CONTACT':
      return 'contact';
    case '4':
    case 'COMPANY':
      return 'company';
    default:
      return 'deal';
  }
}

export function ownerTypeIdFor(entityType: string | null | undefined): number {
  switch ((entityType ?? '').toLowerCase()) {
    case 'deal':
      return 2;
    case 'contact':
      return 3;
    case 'company':
      return 4;
    default:
      return 2;
  }
}

export function mapBitrix24Contact(input: Bitrix24Record) {
  const id = readString(input, 'ID');
  const given = readString(input, 'NAME');
  const family = readString(input, 'LAST_NAME');
  return {
    ref: ref('contact', id),
    email: multiValue(input.EMAIL),
    phone: multiValue(input.PHONE),
    name: {
      given,
      family,
      display: [given, family].filter(Boolean).join(' ') || readString(input, 'FULL_NAME'),
    },
    title: readString(input, 'POST'),
    company_canonical_id: input.COMPANY_ID ? canonicalId('company', input.COMPANY_ID) : '',
    owner_canonical_id: input.ASSIGNED_BY_ID ? canonicalId('owner', input.ASSIGNED_BY_ID) : '',
    tags: readTags(input),
    status: ContactStatus.CONTACT_STATUS_ACTIVE,
    created_at: timestamp(input.DATE_CREATE),
    updated_at: timestamp(input.DATE_MODIFY),
    vendor_raw: struct(input),
  };
}

export function mapBitrix24Company(input: Bitrix24Record) {
  const id = readString(input, 'ID');
  return {
    ref: ref('company', id),
    name: readString(input, 'TITLE'),
    domain: domainFrom(multiValue(input.WEB) || readString(input, 'WEB')),
    industry: readString(input, 'INDUSTRY'),
    employee_count: readNumber(input, 'EMPLOYEES'),
    annual_revenue: readNumber(input, 'REVENUE'),
    currency: readString(input, 'CURRENCY_ID'),
    tax_id: readString(input, 'RQ_INN'),
    registration_id: readString(input, 'RQ_OGRN'),
    tax_branch_id: readString(input, 'RQ_KPP'),
    parent_company_canonical_id: input.PARENT_ID ? canonicalId('company', input.PARENT_ID) : '',
    owner_canonical_id: input.ASSIGNED_BY_ID ? canonicalId('owner', input.ASSIGNED_BY_ID) : '',
    tags: readTags(input),
    status: CompanyStatus.COMPANY_STATUS_ACTIVE,
    created_at: timestamp(input.DATE_CREATE),
    updated_at: timestamp(input.DATE_MODIFY),
    vendor_raw: struct(input),
  };
}

export function mapBitrix24Deal(input: Bitrix24Record) {
  const id = readString(input, 'ID');
  const pipelineId = readString(input, 'CATEGORY_ID') || '0';
  const stageId = readString(input, 'STAGE_ID');
  const status = dealStatus(input);
  return {
    ref: ref('deal', id),
    name: readString(input, 'TITLE'),
    pipeline_canonical_id: canonicalId('pipeline', pipelineId),
    stage_canonical_id: stageId ? canonicalId('stage', stageId, pipelineId) : '',
    status,
    qualification: DealQualification.DEAL_QUALIFICATION_QUALIFIED,
    amount: readNumber(input, 'OPPORTUNITY'),
    currency: readString(input, 'CURRENCY_ID'),
    probability: readNumber(input, 'PROBABILITY'),
    expected_close_date: timestamp(input.CLOSEDATE),
    closed_at: status === DealStatus.DEAL_STATUS_WON || status === DealStatus.DEAL_STATUS_LOST ? timestamp(input.CLOSEDATE) : undefined,
    primary_contact_canonical_id: input.CONTACT_ID ? canonicalId('contact', input.CONTACT_ID) : '',
    company_canonical_id: input.COMPANY_ID ? canonicalId('company', input.COMPANY_ID) : '',
    owner_canonical_id: input.ASSIGNED_BY_ID ? canonicalId('owner', input.ASSIGNED_BY_ID) : '',
    tags: readTags(input),
    source: readString(input, 'SOURCE_ID'),
    created_at: timestamp(input.DATE_CREATE),
    updated_at: timestamp(input.DATE_MODIFY),
    vendor_raw: struct(input),
  };
}

export function mapBitrix24Activity(input: Bitrix24Record) {
  const id = readString(input, 'ID');
  const entityType = entityFromOwnerTypeId(input.OWNER_TYPE_ID);
  return {
    ref: ref('activity', id),
    type: activityType(input.TYPE_ID),
    subject: readString(input, 'SUBJECT'),
    description: readString(input, 'DESCRIPTION'),
    due_at: timestamp(input.DEADLINE ?? input.START_TIME),
    completed_at: String(input.COMPLETED ?? '').toUpperCase() === 'Y' ? timestamp(input.LAST_UPDATED ?? input.END_TIME) : undefined,
    duration: input.DURATION ? { seconds: readNumber(input, 'DURATION') } : undefined,
    outcome: String(input.COMPLETED ?? '').toUpperCase() === 'Y' ? ActivityOutcome.ACTIVITY_OUTCOME_COMPLETED : ActivityOutcome.ACTIVITY_OUTCOME_PLANNED,
    is_completed: String(input.COMPLETED ?? '').toUpperCase() === 'Y',
    linked_entities: input.OWNER_ID ? [{ entity_type: entityType, canonical_id: canonicalId(entityType, input.OWNER_ID) }] : [],
    owner_canonical_id: input.RESPONSIBLE_ID ? canonicalId('owner', input.RESPONSIBLE_ID) : '',
    created_at: timestamp(input.CREATED),
    updated_at: timestamp(input.LAST_UPDATED),
    vendor_raw: struct(input),
  };
}

export function mapBitrix24Note(input: Bitrix24Record) {
  const id = readString(input, 'ID');
  const parentType = String(input.ENTITY_TYPE ?? input.ENTITY_TYPE_ID ?? 'deal').toLowerCase();
  return {
    ref: ref('note', id),
    content: readString(input, 'COMMENT'),
    title: readString(input, 'TITLE'),
    parent: input.ENTITY_ID ? { entity_type: parentType, canonical_id: canonicalId(parentType, input.ENTITY_ID) } : undefined,
    author_canonical_id: input.AUTHOR_ID ? canonicalId('owner', input.AUTHOR_ID) : '',
    created_at: timestamp(input.CREATED ?? input.DATE_CREATE),
    updated_at: timestamp(input.UPDATED ?? input.DATE_MODIFY),
    vendor_raw: struct(input),
  };
}

export function mapBitrix24Owner(input: Bitrix24Record) {
  const id = readString(input, 'ID');
  const given = readString(input, 'NAME');
  const family = readString(input, 'LAST_NAME');
  return {
    canonical_id: canonicalId('owner', id),
    vendor_id: id,
    email: readString(input, 'EMAIL'),
    name: { given, family, display: [given, family].filter(Boolean).join(' ') },
    is_active: input.ACTIVE === true || String(input.ACTIVE ?? '').toUpperCase() === 'Y',
  };
}

export function mapBitrix24Pipeline(category: Bitrix24Record, stages: Bitrix24Record[]): Pipeline {
  const id = readStringAny(category, 'ID', 'id') || '0';
  return {
    canonical_id: canonicalId('pipeline', id),
    vendor_id: id,
    name: readStringAny(category, 'NAME', 'name') || 'Default',
    entity_type: 'deal',
    is_default: id === '0' || readBooleanAny(category, 'IS_DEFAULT', 'isDefault'),
    stages: stages.map((stage, index) => mapStage(stage, id, index)),
    vendor_raw: struct(category),
  };
}

export function mapBitrix24Field(entityType: string, key: string, field: Bitrix24Record): CustomFieldDefinition {
  return {
    entity_type: entityType,
    logical_name: key.toLowerCase(),
    vendor_key: key,
    field_type: customFieldType(field.USER_TYPE_ID ?? field.type),
    label: readString(field, 'EDIT_FORM_LABEL') || readString(field, 'title') || key,
    is_required: field.MANDATORY === 'Y' || field.isRequired === true,
    options: Array.isArray(field.LIST)
      ? field.LIST.map((item) => (isRecord(item) ? readString(item, 'VALUE') : String(item))).filter(Boolean)
      : Array.isArray(field.items)
        ? field.items.map((item) => (isRecord(item) ? readString(item, 'VALUE') : String(item))).filter(Boolean)
        : [],
    vendor_raw: struct(field),
  };
}

export function association(from: EntityRef | null | undefined, to: EntityRef | null | undefined): Association {
  const fromType = from?.entity_type ?? '';
  const fromId = vendorIdFromCanonical(from?.canonical_id);
  const toType = to?.entity_type ?? '';
  const toId = vendorIdFromCanonical(to?.canonical_id);
  return {
    ref: ref('assoc', `${fromType}:${fromId}:${toType}:${toId}`),
    from: from ?? {},
    to: to ?? {},
    category: AssociationCategory.ASSOCIATION_CATEGORY_RNTME_DEFINED,
    label: '',
  };
}

export function mapListMeta(base?: { limit?: number | null; offset?: number | null; cursor?: string | null } | null, count = 0) {
  const limit = base?.limit ?? count;
  const offset = base?.cursor ? Number(base.cursor) : (base?.offset ?? 0);
  const hasMore = limit > 0 && count === limit;
  return {
    limit,
    offset,
    total_count: offset + count,
    has_more: hasMore,
    next_cursor: hasMore ? String(offset + count) : '',
    prev_cursor: offset > 0 ? String(Math.max(0, offset - limit)) : '',
  };
}

export function bitrixEntityMethod(entityType: string | null | undefined): string {
  switch ((entityType ?? '').toLowerCase()) {
    case 'company':
      return 'crm.company';
    case 'deal':
      return 'crm.deal';
    case 'activity':
      return 'crm.activity';
    case 'note':
      return 'crm.timeline.comment';
    case 'contact':
    default:
      return 'crm.contact';
  }
}

export function ref(entityType: string, vendorId: string) {
  return {
    canonical_id: canonicalId(entityType, vendorId),
    vendor_id: vendorId,
    module_name: MODULE_NAME,
    module_version: '0.0.0',
    contract_version: CONTRACT_VERSION,
  };
}

export function struct(input: Bitrix24Record) {
  const fields: Record<string, ReturnType<typeof valueToProto>> = {};
  for (const [key, value] of Object.entries(input)) {
    fields[key] = valueToProto(value);
  }
  return { fields };
}

export function timestamp(input: unknown) {
  if (!input) return undefined;
  const millis = input instanceof Date ? input.getTime() : Date.parse(String(input));
  if (Number.isNaN(millis)) return undefined;
  return { seconds: Math.floor(millis / 1000), nanos: (millis % 1000) * 1_000_000 };
}

function mapStage(stage: Bitrix24Record, pipelineId: string, index: number) {
  const id = readString(stage, 'STATUS_ID');
  const semantic = semanticOf(stage.SEMANTICS ?? stage.STAGE_SEMANTIC_ID ?? (isRecord(stage.EXTRA) ? stage.EXTRA.SEMANTICS : undefined));
  return {
    canonical_id: canonicalId('stage', id, pipelineId),
    vendor_id: id,
    pipeline_canonical_id: canonicalId('pipeline', pipelineId),
    name: readString(stage, 'NAME'),
    order: readNumber(stage, 'SORT') || index,
    semantic,
    probability: semantic === StageSemantic.STAGE_SEMANTIC_WON ? 1 : semantic === StageSemantic.STAGE_SEMANTIC_LOST ? 0 : 0,
    is_terminal: semantic === StageSemantic.STAGE_SEMANTIC_WON || semantic === StageSemantic.STAGE_SEMANTIC_LOST,
  };
}

function dealStatus(input: Bitrix24Record) {
  const semantic = String(input.STAGE_SEMANTIC_ID ?? input.SEMANTIC_ID ?? '').toUpperCase();
  if (semantic === 'S') return DealStatus.DEAL_STATUS_WON;
  if (semantic === 'F') return DealStatus.DEAL_STATUS_LOST;
  return DealStatus.DEAL_STATUS_OPEN;
}

function semanticOf(value: unknown) {
  switch (String(value ?? '').toUpperCase()) {
    case 'S':
      return StageSemantic.STAGE_SEMANTIC_WON;
    case 'F':
      return StageSemantic.STAGE_SEMANTIC_LOST;
    case 'P':
      return StageSemantic.STAGE_SEMANTIC_OPEN;
    default:
      return StageSemantic.STAGE_SEMANTIC_UNSPECIFIED;
  }
}

function activityType(value: unknown) {
  switch (String(value ?? '')) {
    case '1':
      return ActivityType.ACTIVITY_TYPE_MEETING;
    case '2':
      return ActivityType.ACTIVITY_TYPE_CALL;
    case '3':
      return ActivityType.ACTIVITY_TYPE_TASK;
    case '4':
      return ActivityType.ACTIVITY_TYPE_EMAIL;
    default:
      return ActivityType.ACTIVITY_TYPE_VENDOR_SPECIFIC;
  }
}

function customFieldType(value: unknown) {
  switch (String(value ?? '').toLowerCase()) {
    case 'integer':
    case 'double':
      return CustomFieldType.CUSTOM_FIELD_TYPE_NUMBER;
    case 'date':
      return CustomFieldType.CUSTOM_FIELD_TYPE_DATE;
    case 'datetime':
      return CustomFieldType.CUSTOM_FIELD_TYPE_DATETIME;
    case 'boolean':
      return CustomFieldType.CUSTOM_FIELD_TYPE_BOOLEAN;
    case 'enumeration':
      return CustomFieldType.CUSTOM_FIELD_TYPE_ENUM;
    case 'url':
      return CustomFieldType.CUSTOM_FIELD_TYPE_URL;
    case 'money':
      return CustomFieldType.CUSTOM_FIELD_TYPE_MONEY;
    case 'file':
      return CustomFieldType.CUSTOM_FIELD_TYPE_FILE;
    default:
      return CustomFieldType.CUSTOM_FIELD_TYPE_STRING;
  }
}

function multiValue(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value.find(isRecord);
    return first ? readString(first, 'VALUE') : '';
  }
  return typeof value === 'string' ? value : '';
}

function readTags(input: Bitrix24Record): string[] {
  return Array.isArray(input.TAGS) ? input.TAGS.map(String) : [];
}

function domainFrom(value: string): string {
  if (!value) return '';
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname;
  } catch {
    return value;
  }
}

function readString(input: Bitrix24Record, key: string): string {
  const value = input[key];
  return value === undefined || value === null ? '' : String(value);
}

function readStringAny(input: Bitrix24Record, ...keys: string[]): string {
  for (const key of keys) {
    const value = readString(input, key);
    if (value) return value;
  }
  return '';
}

function readBooleanAny(input: Bitrix24Record, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = input[key];
    if (value === true) return true;
    if (String(value ?? '').toUpperCase() === 'Y') return true;
  }
  return false;
}

function readNumber(input: Bitrix24Record, key: string): number {
  const value = Number(input[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function valueToProto(value: unknown): { [key: string]: unknown } {
  if (value === null || value === undefined) return { nullValue: 0 };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { numberValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (Array.isArray(value)) return { listValue: { values: value.map(valueToProto) } };
  if (isRecord(value)) return { structValue: struct(value) };
  return { stringValue: String(value as JsonValue) };
}

function isRecord(value: unknown): value is Bitrix24Record {
  return typeof value === 'object' && value !== null;
}
