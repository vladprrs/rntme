export const BITRIX24_SUPPORTED_RPCS = [
  'GetContact',
  'ListContacts',
  'CreateContact',
  'UpdateContact',
  'DeleteContact',
  'GetCompany',
  'ListCompanies',
  'CreateCompany',
  'UpdateCompany',
  'DeleteCompany',
  'GetDeal',
  'ListDeals',
  'CreateDeal',
  'UpdateDeal',
  'DeleteDeal',
  'GetActivity',
  'ListActivities',
  'CreateActivity',
  'UpdateActivity',
  'DeleteActivity',
  'GetNote',
  'ListNotes',
  'CreateNote',
  'DeleteNote',
  'ListPipelines',
  'ListCustomFieldDefinitions',
  'CreateAssociation',
  'DeleteAssociation',
  'ListAssociations',
  'SyncDelta',
  'SubmitJob',
  'GetJob',
  'CancelJob',
  'ListJobs',
] as const;

export type Bitrix24SupportedRpc = (typeof BITRIX24_SUPPORTED_RPCS)[number];

export const BITRIX24_UNSUPPORTED_RPCS = [] as const;

export const BITRIX24_SUPPORTED_EVENTS = [] as const;

export const BITRIX24_LIMITATIONS = [
  'Bitrix24 does not support native labeled CRM associations; non-empty canonical labels are rejected.',
  'Bitrix24 CRM writes do not accept rntme idempotency keys; callers must use rntme-side retry and dedupe controls.',
  'Bitrix24 webhooks have no retry guarantee; use SyncDelta or SyncFull for reconciliation.',
  'SyncDelta is best-effort over Bitrix24 date fields.',
  'Full sync runs as a module-local async job over paginated SDK list calls.',
  'Canonical CloudEvents are not claimed yet; webhook transport and event translation require a follow-up receiver.',
] as const;
