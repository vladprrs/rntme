export const scenarioAssertions = {
  GetContact:
    'GetContact happy path: return canonical Contact for an existing canonical_id with metadata.public logical custom-field names only. Negative: unknown canonical_id returns CRM_REFERENCES_CONTACT_NOT_FOUND.',
  ListContacts:
    'ListContacts happy path: default created_at DESC ordering, company/status/email filters, cursor pagination, and limit/has_more correctness. Negative: invalid email filter returns CRM_STRUCTURAL_INVALID_EMAIL.',
  CreateContact:
    'CreateContact happy path: create Contact with canonical_id/vendor_id timestamps, ContactCreated event, idempotency replay, logical custom fields, and primary company link. Negative: missing idempotency key, invalid email/phone, duplicate email consistency, missing company reference, and vendor rate limit mapping.',
  UpdateContact:
    'UpdateContact happy path: full replacement, ContactUpdated changed_fields, idempotency replay, and ACTIVE to DELETED transition emitting ContactDeleted. Negative: unknown contact and optimistic-lock conflict.',
  DeleteContact:
    'DeleteContact happy path: soft delete with status=DELETED/deleted_at, hard delete when supported, and idempotency replay without duplicate events. Negative: unknown contact and unsupported hard delete consistency.',
  GetCompany:
    'GetCompany happy path: return canonical Company including RU regulatory fields when present and empty international fields otherwise. Negative: unknown canonical_id returns CRM_REFERENCES_COMPANY_NOT_FOUND.',
  ListCompanies:
    'ListCompanies happy path: default ordering, domain filter, RU tax_id filter, and cursor pagination. Negative: invalid tax_id format returns CRM_STRUCTURAL_INVALID_TAX_ID.',
  CreateCompany:
    'CreateCompany happy path: international and RU company creation, CompanyCreated event, idempotency replay, regulatory field round-trip, and parent-company hierarchy. Negative: missing idempotency key, invalid currency/tax_id, and duplicate-domain consistency.',
  UpdateCompany:
    'UpdateCompany happy path: full replacement, CompanyUpdated changed_fields, regulatory field update path, and idempotency replay. Negative: unknown company returns CRM_REFERENCES_COMPANY_NOT_FOUND.',
  DeleteCompany:
    'DeleteCompany happy path: soft delete, hard delete when supported, CompanyDeleted event, and idempotency replay. Negative: unknown company and unsupported hard delete consistency.',
  GetDeal:
    'GetDeal happy path: return canonical Deal with orthogonal status/qualification and valid primary contact reference. Negative: unknown canonical_id returns CRM_REFERENCES_DEAL_NOT_FOUND.',
  ListDeals:
    'ListDeals happy path: pipeline/stage, qualification, status, company filters, and cursor pagination including Lead/Deal Schism coverage. Negative: standard filter validation failures.',
  CreateDeal:
    'CreateDeal happy path: create UNQUALIFIED lead and QUALIFIED deal, DealCreated event, idempotency replay, primary contact/company links, and stage within pipeline. Negative: missing idempotency/pipeline/stage, stage not in pipeline, unknown pipeline/stage/contact, and vendor rate limit mapping.',
  UpdateDeal:
    'UpdateDeal happy path: in-pipeline stage transition, cross-pipeline transition, lead-to-deal qualification, close-won terminal flow, DealStageChanged/DealUpdated/DealClosed events, and idempotency replay. Negative: foreign stage without pipeline, already-closed reopen, unknown deal, optimistic-lock conflict, and Bitrix24 QUERY_LIMIT_EXCEEDED rate-limit mapping.',
  DeleteDeal:
    'DeleteDeal happy path: soft delete as DealUpdated status/deleted_at, hard delete when supported, and no ContactDeleted event. Negative: unknown deal and unsupported hard delete consistency.',
  GetActivity:
    'GetActivity happy path: return Activity with M:N linked_entities populated and outcome/is_completed consistency. Negative: unknown canonical_id returns CRM_REFERENCES_ACTIVITY_NOT_FOUND.',
  ListActivities:
    'ListActivities happy path: linked_to, type, is_completed, owner filters, and cursor pagination. Negative: invalid linked_to.entity_type returns CRM_STRUCTURAL_INVALID_ENTITY_TYPE.',
  CreateActivity:
    'CreateActivity happy path: TASK/MEETING/CALL/EMAIL fixtures, multi-linked M:N activities, duration round-trip, ActivityCreated event, and idempotency replay. Negative: missing idempotency key/type/subject and unknown linked entity references.',
  UpdateActivity:
    'UpdateActivity happy path: outcome transition to completed, completed_at/is_completed derivation, linked_entities add/remove, ActivityUpdated event, and idempotency replay. Negative: unknown activity reference.',
  DeleteActivity:
    'DeleteActivity happy path: terminal activity response, ActivityDeleted event, and hard delete when supported. Negative: unknown activity and unsupported hard delete consistency.',
  GetNote:
    'GetNote happy path: return immutable Note with exactly one parent reference and content metadata preserved. Negative: unknown canonical_id returns CRM_REFERENCES_NOTE_NOT_FOUND.',
  ListNotes:
    'ListNotes happy path: parent entity filter, created_at ordering, content type metadata preservation, and cursor pagination. Negative: invalid parent entity type returns CRM_STRUCTURAL_INVALID_ENTITY_TYPE.',
  CreateNote:
    'CreateNote happy path: create notes for Deal/Contact/Company/Activity parents, preserve HTML/plain-text metadata, NoteCreated event, and idempotency replay. Negative: missing idempotency key/content/parent and unknown parent references.',
  DeleteNote:
    'DeleteNote happy path: delete immutable note and publish NoteDeleted event with idempotency replay. Negative: unknown note reference.',
  ListPipelines:
    'ListPipelines happy path: return deterministic Pipeline/Stage read models including open/won/lost semantics, default pipeline, stage order, terminal flags, and cross-pipeline fixture data. Negative: invalid entity_type filter.',
  ListCustomFieldDefinitions:
    'ListCustomFieldDefinitions happy path: return logical_name to vendor_key mappings for contacts, companies, and deals with enum/number field metadata. Negative: invalid entity_type and unsupported paid-tier/vendor capability cases.',
  ListAssociations:
    'ListAssociations happy path: list flat and labeled associations by from/to entity, preserve category/label where supported, and support pagination. Negative: invalid entity types and unknown entity references.',
  CreateAssociation:
    'CreateAssociation happy path: create unlabeled association for all modules and labeled/user-defined associations when labeled_associations=true, publishing AssociationCreated. Negative: labels not supported, unknown entities, and duplicate association consistency.',
  DeleteAssociation:
    'DeleteAssociation happy path: delete association and publish AssociationDeleted with idempotency replay. Negative: unknown association and label mismatch/reference errors.',
  SyncDelta:
    'SyncDelta happy path: return created/updated/deleted items since watermark, stable cursor pagination, monotonic next watermark, and empty entity body for deletes. Negative: invalid entity_type, malformed cursor, and since in the future.',
  SubmitJob:
    'SubmitJob happy path: submit SYNC_FULL async job, AsyncJobCreated event, idempotency replay, and vendor bulk/export mapping where supported. Negative: missing idempotency key, unsupported async_job_types, empty body, and vendor rate limit mapping.',
  GetJob:
    'GetJob happy path: retrieve AsyncJob lifecycle state and progress/error metadata. Negative: unknown job returns CRM_REFERENCES_JOB_NOT_FOUND.',
  CancelJob:
    'CancelJob happy path: cancel QUEUED/RUNNING SYNC_FULL jobs, emit AsyncJobCancelled, and replay idempotently. Negative: unknown job and already terminal job consistency.',
  ListJobs:
    'ListJobs happy path: filter by job type/status, created_at ordering, cursor pagination, and include terminal AsyncJob states. Negative: invalid status/type filters and malformed cursor.',
} as const satisfies Record<string, string>;

export type ScenarioRpcName = keyof typeof scenarioAssertions;

export function assertionsFor(rpcName: string): string {
  return scenarioAssertions[rpcName as ScenarioRpcName] ?? `No CRM conformance assertion description registered for ${rpcName}.`;
}
