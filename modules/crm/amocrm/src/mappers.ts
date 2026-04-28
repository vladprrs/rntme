import type { JsonObject } from './types.js';

function timestampFromIso(iso?: string) {
  const ts = iso ? new Date(iso).getTime() : Date.now();
  return {
    seconds: BigInt(Math.floor(ts / 1000)),
    nanos: (ts % 1000) * 1_000_000,
  };
}

export function canonicalRef(entityType: string, vendorId: number | string): string {
  return `amocrm:${entityType}:${vendorId}`;
}

export function parseCanonicalId(canonicalId: string): { entityType: string; vendorId: string } {
  const parts = canonicalId.split(':');
  return {
    entityType: parts[1] ?? '',
    vendorId: parts[2] ?? '',
  };
}

export function mapContact(raw: JsonObject) {
  const id = Number(raw.id ?? 0);
  return {
    ref: {
      canonicalId: canonicalRef('contact', id),
      vendorId: String(id),
    },
    email: extractCustomField(raw, 'EMAIL') ?? '',
    phone: extractCustomField(raw, 'PHONE') ?? '',
    name: {
      givenName: String(raw.first_name ?? raw.name ?? ''),
      familyName: String(raw.last_name ?? ''),
    },
    title: String(raw.position ?? ''),
    companyCanonicalId: raw.company ? canonicalRef('company', Number((raw.company as JsonObject).id ?? 0)) : '',
    ownerCanonicalId: raw.responsible_user_id ? canonicalRef('owner', Number(raw.responsible_user_id)) : '',
    tags: extractTags(raw),
    status: 1,
    metadata: buildMetadata(raw),
    createdAt: timestampFromIso(String(raw.created_at ?? '')),
    updatedAt: timestampFromIso(String(raw.updated_at ?? '')),
    deletedAt: undefined,
    vendorRaw: raw as Record<string, unknown>,
  };
}

export function mapCompany(raw: JsonObject) {
  const id = Number(raw.id ?? 0);
  return {
    ref: {
      canonicalId: canonicalRef('company', id),
      vendorId: String(id),
    },
    name: String(raw.name ?? ''),
    domain: extractCustomField(raw, 'WEBSITE') ?? '',
    industry: '',
    employeeCount: 0,
    annualRevenue: 0,
    currency: '',
    taxId: extractCustomField(raw, 'INN') ?? '',
    registrationId: extractCustomField(raw, 'OGRN') ?? '',
    taxBranchId: extractCustomField(raw, 'KPP') ?? '',
    parentCompanyCanonicalId: '',
    ownerCanonicalId: raw.responsible_user_id ? canonicalRef('owner', Number(raw.responsible_user_id)) : '',
    tags: extractTags(raw),
    status: 1,
    metadata: buildMetadata(raw),
    createdAt: timestampFromIso(String(raw.created_at ?? '')),
    updatedAt: timestampFromIso(String(raw.updated_at ?? '')),
    deletedAt: undefined,
    vendorRaw: raw as Record<string, unknown>,
  };
}

export function mapDeal(raw: JsonObject) {
  const id = Number(raw.id ?? 0);
  const statusId = Number(raw.status_id ?? 0);
  const pipelineId = Number(raw.pipeline_id ?? 0);
  const isClosed = statusId === 142 || statusId === 143;
  const isWon = statusId === 142;

  return {
    ref: {
      canonicalId: canonicalRef('deal', id),
      vendorId: String(id),
    },
    name: String(raw.name ?? ''),
    pipelineCanonicalId: pipelineId ? canonicalRef('pipeline', pipelineId) : '',
    stageCanonicalId: statusId ? canonicalRef('stage', statusId) : '',
    status: isClosed ? (isWon ? 2 : 3) : 1,
    qualification: 2,
    amount: Number(raw.price ?? 0),
    currency: String(raw.currency ?? 'RUB'),
    probability: 0,
    expectedCloseDate: undefined,
    closedAt: isClosed ? timestampFromIso(String(raw.closed_at ?? '')) : undefined,
    closeReason: String(raw.loss_reason_name ?? ''),
    primaryContactCanonicalId: (raw.contacts as JsonObject)?.id ? canonicalRef('contact', Number(((raw.contacts as JsonObject).id ?? 0))) : '',
    companyCanonicalId: raw.company ? canonicalRef('company', Number((raw.company as JsonObject).id ?? 0)) : '',
    ownerCanonicalId: raw.responsible_user_id ? canonicalRef('owner', Number(raw.responsible_user_id)) : '',
    tags: extractTags(raw),
    source: '',
    metadata: buildMetadata(raw),
    createdAt: timestampFromIso(String(raw.created_at ?? '')),
    updatedAt: timestampFromIso(String(raw.updated_at ?? '')),
    deletedAt: undefined,
    vendorRaw: raw as Record<string, unknown>,
  };
}

export function mapActivity(raw: JsonObject) {
  const id = Number(raw.id ?? 0);
  const entityType = String(raw.entity_type ?? 'leads');
  const entityId = Number(raw.entity_id ?? 0);

  return {
    ref: {
      canonicalId: canonicalRef('activity', id),
      vendorId: String(id),
    },
    type: 3,
    subject: String(raw.text ?? ''),
    description: '',
    dueAt: timestampFromIso(String(raw.complete_till ?? '')),
    completedAt: raw.is_completed ? timestampFromIso(String(raw.updated_at ?? '')) : undefined,
    duration: undefined,
    outcome: raw.is_completed ? 2 : 1,
    isCompleted: Boolean(raw.is_completed),
    linkedEntities: entityId ? [{ entityType: entityType.replace(/s$/, ''), canonicalId: canonicalRef(entityType.replace(/s$/, ''), entityId) }] : [],
    ownerCanonicalId: raw.responsible_user_id ? canonicalRef('owner', Number(raw.responsible_user_id)) : '',
    metadata: buildMetadata(raw),
    createdAt: timestampFromIso(String(raw.created_at ?? '')),
    updatedAt: timestampFromIso(String(raw.updated_at ?? '')),
    vendorRaw: raw as Record<string, unknown>,
  };
}

export function mapNote(raw: JsonObject, entityType?: string, entityId?: number) {
  const id = Number(raw.id ?? 0);
  const parentEntityType = entityType ?? String(raw.entity_type ?? 'leads').replace(/s$/, '');
  const parentEntityId = entityId ?? Number(raw.entity_id ?? 0);

  return {
    ref: {
      canonicalId: canonicalRef('note', id),
      vendorId: String(id),
    },
    content: String(raw.text ?? (raw.params as JsonObject)?.text ?? ''),
    title: String(raw.note_type ?? ''),
    parent: parentEntityId ? { entityType: parentEntityType, canonicalId: canonicalRef(parentEntityType, parentEntityId) } : undefined,
    authorCanonicalId: raw.created_by ? canonicalRef('owner', Number(raw.created_by)) : '',
    metadata: buildMetadata(raw),
    createdAt: timestampFromIso(String(raw.created_at ?? '')),
    updatedAt: timestampFromIso(String(raw.updated_at ?? '')),
    vendorRaw: raw as Record<string, unknown>,
  };
}

export function mapPipeline(raw: JsonObject) {
  const id = Number(raw.id ?? 0);
  const embedded = raw._embedded as JsonObject | undefined;
  const statuses = embedded?.statuses as JsonObject[] | undefined;

  return {
    canonicalId: canonicalRef('pipeline', id),
    vendorId: String(id),
    name: String(raw.name ?? ''),
    entityType: 'deal',
    isDefault: Boolean(raw.is_main),
    stages: Array.isArray(statuses)
      ? statuses.map((s) => mapStage(s, id))
      : [],
    vendorRaw: raw as Record<string, unknown>,
  };
}

export function mapStage(raw: JsonObject, pipelineId?: number) {
  const id = Number(raw.id ?? 0);
  const semantic = Number(raw.type ?? 0);
  return {
    canonicalId: canonicalRef('stage', id),
    vendorId: String(id),
    pipelineCanonicalId: pipelineId ? canonicalRef('pipeline', pipelineId) : '',
    name: String(raw.name ?? ''),
    order: Number(raw.sort ?? 0),
    semantic: semantic === 1 ? 2 : semantic === 2 ? 3 : 1,
    probability: Number(raw.probability ?? 0) / 100,
    isTerminal: semantic === 1 || semantic === 2,
  };
}

export function mapOwner(raw: JsonObject) {
  const id = Number(raw.id ?? 0);
  return {
    canonicalId: canonicalRef('owner', id),
    vendorId: String(id),
    email: '',
    name: {
      givenName: String(raw.name ?? ''),
      familyName: '',
    },
    isActive: true,
  };
}

export function mapCustomFieldDefinition(raw: JsonObject, entityType: string) {
  return {
    entityType,
    logicalName: String(raw.code ?? raw.name ?? ''),
    vendorKey: String(raw.id ?? ''),
    fieldType: mapCustomFieldType(Number(raw.type ?? 0)),
    label: String(raw.name ?? ''),
    isRequired: false,
    options: Array.isArray(raw.enums) ? raw.enums.map((e) => String((e as JsonObject).value ?? '')) : [],
    vendorRaw: raw as Record<string, unknown>,
  };
}

export function mapAssociation(raw: JsonObject) {
  const fromType = String(raw.from ?? 'contact');
  const toType = String(raw.to ?? 'deal');
  const fromId = Number(raw.from_id ?? 0);
  const toId = Number(raw.to_id ?? 0);

  return {
    ref: {
      canonicalId: canonicalRef('association', `${fromType}:${fromId}:${toType}:${toId}`),
      vendorId: '',
    },
    from: { entityType: fromType, canonicalId: canonicalRef(fromType, fromId) },
    to: { entityType: toType, canonicalId: canonicalRef(toType, toId) },
    category: 1,
    label: '',
    metadata: {},
    createdAt: timestampFromIso(),
    vendorRaw: raw as Record<string, unknown>,
  };
}

function extractCustomField(raw: JsonObject, fieldCode: string): string | undefined {
  const values = raw.custom_fields_values as JsonObject[] | undefined;
  if (!Array.isArray(values)) return undefined;
  const field = values.find((f) => f.field_code === fieldCode || f.field_name === fieldCode);
  if (!field) return undefined;
  const vals = field.values as JsonObject[] | undefined;
  if (!Array.isArray(vals) || vals.length === 0) return undefined;
  return String(vals[0].value ?? '');
}

function extractTags(raw: JsonObject): string[] {
  const embedded = raw._embedded as JsonObject | undefined;
  const tags = embedded?.tags as JsonObject[] | undefined;
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => String(t.name ?? '')).filter(Boolean);
}

function buildMetadata(raw: JsonObject) {
  const customFields: Record<string, unknown> = {};
  const values = raw.custom_fields_values as JsonObject[] | undefined;
  if (Array.isArray(values)) {
    for (const field of values) {
      const code = String(field.field_code ?? field.field_name ?? '');
      if (code) {
        const vals = field.values as JsonObject[] | undefined;
        customFields[code] = Array.isArray(vals) && vals.length > 0
          ? vals.length === 1 ? vals[0].value : vals.map((v) => v.value)
          : undefined;
      }
    }
  }

  return {
    public: customFields,
    private: {},
    protected: {},
  };
}

function mapCustomFieldType(vendorType: number): number {
  switch (vendorType) {
    case 1: return 1;
    case 2: return 6;
    case 3: return 9;
    case 4: return 2;
    case 6: return 5;
    case 8: return 8;
    case 9: return 3;
    case 10: return 4;
    case 13: return 7;
    default: return 0;
  }
}
