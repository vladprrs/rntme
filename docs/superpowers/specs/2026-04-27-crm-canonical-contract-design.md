# CRM canonical contract v1 — design

**Status:** design
**Author:** brainstorm 2026-04-27
**Related:**
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — directory layout `packages/contracts/<category>/v<n>/`, capability-based UNION conformance, governance rule for canonical growth (≥2 vendors OR archetypal), `module.json` schema. This spec produces the third concrete category contract under that umbrella (Identity is first, AI/LLM is second).
- `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` — sibling spec by the same template; defines `_common/v1/` shared primitives that this spec reuses unchanged. This spec follows the same section pattern.
- `docs/superpowers/specs/done/2026-04-26-ai-llm-canonical-contract-design.md` — sibling spec; introduced the `AsyncJob` aggregate pattern and `oneof body` extensibility for future job types, both reused here.
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — module pattern (wrapper around vendor SDK, gRPC surface, webhook receiver, no choreography). This spec's contract is implemented by CRM wrappers, not gateways.
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` — CloudEvents 1.0 envelope; this spec defines the `data` payloads and `type` short-names for the CRM category.
- `.tmp/canonical_crm_api.agent.final.md` — vendor research across 9 CRM platforms (Bitrix24, amoCRM/Kommo, Salesforce, HubSpot, Zoho CRM, Pipedrive, plus МойСклад / 1С-CRM / RetailCRM as RU references), 1605 lines. Local-only document, not committed.
- `rntme_orchestration_only`, `project_pre_stable_stage`, `rntme_topic_no_version_suffix`, `platform_domains` memories.

**Implementation locations:**
- Canonical CRM contract — new `packages/contracts/crm/v1/` (workspace package `@rntme/contracts-crm-v1`).
- Category README + conformance suite skeleton — new `modules/crm/README.md` and `modules/crm/conformance/` (workspace package `@rntme/conformance-crm`).
- Implementation plans for this spec — `docs/superpowers/plans/crm-canonical-contract/`.

## 1. Problem

The modules-monorepo spec defined where category contracts live and how modules declare capability subsets, but explicitly deferred category content. Identity v1 landed the first concrete contract; AI/LLM v1 is in design as the second. CRM is the natural next category — it underpins approvals, ticketing, customer-ops, onboarding, internal admin / back-office workflow apps (rntme's primary wedge per `vision.md`), and has the most fragmented vendor convergence to canonicalise of any business-app category.

Without a canonical CRM contract, every vendor module — `module-crm-bitrix24`, `module-crm-amocrm`, `module-crm-hubspot`, `module-crm-salesforce`, `module-crm-zoho`, `module-crm-pipedrive` — would invent its own gRPC service shape, its own event short-names, its own approach to the Lead/Deal semantic schism, its own custom-field key model, its own webhook format normalisation. Domain blueprints would then bind to vendor-shaped contracts, defeating the categorical-abstraction goal.

The CRM landscape exhibits four cross-vendor patterns that the canonical contract must resolve:

1. **Lead/Deal Semantic Schism** — in amoCRM, the entity called "Lead" is functionally equivalent to "Deal" in Salesforce, HubSpot, Pipedrive (an opportunity with budget, pipeline, stage, owner). amoCRM's "Contact" is closer to the classical "Lead" (unqualified prospect). Direct vendor-name passthrough produces catastrophic semantic inversion.
2. **Custom Field Hash Hell** — Pipedrive uses 40-character UUID keys, Bitrix24 uses `UF_CRM_{entity}_{id}` prefixes, Salesforce uses `__c` suffix, HubSpot uses internal property names. Domain blueprints cannot bind to vendor-specific keys without losing portability.
3. **Pipeline as State Machine** — universal across all six CRMs, but with subtly different transition semantics (Bitrix24 single vs. cross-pipeline updates, Salesforce ForecastCategory linkage, HubSpot pipeline-reset on cross-pipeline move).
4. **Association as First-Class Entity** — HubSpot Associations API v4 with labeled associations (`Decision Maker`, `Billing Contact`) is the most expressive model; three of six vendors (Bitrix24, amoCRM, Pipedrive) have no native label support and need emulation.

A second, structural problem: the canonical contract must resolve cross-vendor signal-vs-noise on event delivery (Bitrix24 has zero webhook retry, amoCRM payloads are URL-encoded form data, HubSpot has 10 retries over 24h, Salesforce uses gRPC Pub/Sub instead of HTTP webhook). The contract canonicalises the resulting CloudEvents shape and a `SyncDelta` RPC for explicit pull-mode reconciliation, leaving transport quirks to the module.

## 2. Goal

Define the v1 canonical CRM contract: protobuf service, message types, status enums, event payloads, error codes, and the conformance-scenarios skeleton. Out of this spec, an LLM agent generating a vendor-specific CRM module from `module-skeleton` should know exactly which gRPC surface to implement, which capabilities to declare, which events to emit, and which conformance scenarios to pass.

**In scope:**
- New `packages/contracts/crm/v1/` package: `crm.proto` (service + entities + enums), `crm-events.proto` (21 event payloads), `error-codes.json`, README.
- Five business aggregates: `Contact`, `Company`, `Deal`, `Activity`, `Note`.
- One helper aggregate: `AsyncJob` (in v1 carrying `SYNC_FULL` only; `oneof body` extensible non-breaking).
- Two read-only helper messages: `Pipeline`, `Stage` (no events, no Command-RPCs).
- Three connector helper messages: `Owner` (CRM-local user reference, NOT `Identity.User`), `CustomFieldDefinition` (read-only, for UI-form generation), `Association` (labeled, HubSpot v4-shape).
- Lead/Deal Semantic Schism resolution via `Deal.qualification = UNQUALIFIED|QUALIFIED|DISQUALIFIED` (no separate `Prospect` aggregate).
- Russian regulatory reality (66.6% RU CRM market under Bitrix24+amoCRM, 152-FZ data-residency) addressed via generic-named first-class fields on `Company`: `tax_id`, `registration_id`, `tax_branch_id`.
- 34 canonical RPCs covering CRUD/list per business aggregate, helper queries, association management, sync, and async-job lifecycle.
- 21 canonical CloudEvents covering the lifecycle of all business aggregates plus association and async-job topics.
- Conformance-scenarios skeleton at `modules/crm/conformance/` with one scenario file per RPC.
- Capability-declaration extensions to `module.json#capabilities`: `vendors[]`, `entities[]`, `search_tiers[]`, `labeled_associations: bool`, `bulk_operations.max_size: int`, `async_job_types[]`, `webhook_format: "json"|"urlencoded"`, `webhook_retry_policy`.
- Governance reaffirmation: how CRM v1 grows.

**Explicitly out of scope:**
- `Quote` aggregate, quote lifecycle, e-signing — separate `crm-quote/v1` category. Vendor coverage is fragmented (Pipedrive and amoCRM lack native Quote).
- `Invoice` aggregate, payment tracking — separate `crm-invoice/v1` category. Native invoicing exists only in Bitrix24 and Zoho; substrate naturally belongs to billing/payments domain.
- `Product`/`LineItem`/`PriceBook` — separate `crm-product/v1` category. Salesforce three-tier pricing model is archetypal but adjacent to `crm-billing` and `inventory` categories.
- `Tag` as a managed aggregate with CRUD — strings inside aggregate `tags[]` fields suffice for v1; if cross-entity tag management surfaces, `crm-tag/v1` is a separate category.
- `RoleAssignment` as a separate aggregate (research §3.3.2). Roles ride inside `Association.label`; no separate aggregate per Q5.
- `MoveDealToStage` as a separate RPC. Stage transitions ride through `UpdateDeal{stage_canonical_id, pipeline_canonical_id?}` — same convention as SF/HubSpot/Pipedrive PATCH-style updates. The high-signal `DealStageChanged` event still fires.
- `UpdateNote` RPC. Notes are de-facto immutable across most vendors (HubSpot, amoCRM lack Update); v1.minor adds when concrete consumer surfaces.
- `search.advanced` (raw SOQL/COQL passthrough) and `search.fulltext` RPCs. v1 ships only `search.simple` via `_common.ListRequest`; advanced/fulltext are non-breaking v1.minor additions per Q3.
- `IMPORT_BULK` and `EXPORT_FILTERED` AsyncJob types. v1 carries `SYNC_FULL` only per Q8; `oneof body` accepts new variants non-breaking.
- Schema-mutating custom-field RPCs (`CreateCustomField`, `UpdateCustomField`, `DeleteCustomField`). v1 ships read-only `ListCustomFieldDefinitions` per Q4; mutation is admin-scope and vendor-immutable-rule fragmented.
- Tier-based conformance levels (Level 1/2/3 from research). v1 uses the capability-based UNION model from modules-monorepo §7.3 / Identity v1 / AI/LLM v1 per Q2.
- First vendor module skeleton + first vendor implementation (recommended: `module-crm-bitrix24` for RU P0 priority) — subsequent brainstorm.
- Multi-instance/multi-portal support (one module instance backing N tenant Bitrix24 portals) — solvable via `CommandContext.tenant_id` extension; decided in first vendor brainstorm.

## 3. Decisions matrix

| # | Question | Decision |
|---|---|---|
| Q1 | Scope of this spec | **Core+Process: 5 business aggregates** (Contact, Company, Deal, Activity, Note) + 1 helper aggregate (AsyncJob) + 2 read-only helpers (Pipeline, Stage). Lead/Deal Schism resolved via `Deal.qualification` (no `Prospect` aggregate). `Quote`/`Invoice`/`Product` deferred to separate categories. |
| Q2 | Conformance model | **Capability-based UNION** (consistent with Identity v1, AI/LLM v1, modules-monorepo §7.3). No Level 1/2/3 enforcement. Recommended capability presets ("Core / Full / Extended") live in `modules/crm/README.md` as documentation, not validated tiers. |
| Q3 | Search tier | **Only `search.simple`** via `_common.ListRequest` (filters[], sorts[], cursor) plus per-RPC scope-fields. `search.advanced` (vendor-language passthrough) and `search.fulltext` deferred to v1.minor; non-breaking when added. |
| Q4 | Custom field model | **Data-plane via `_common.Metadata` 3-tier + read-only `ListCustomFieldDefinitions` RPC** for UI form generation. No schema-mutating RPCs in v1. `FieldMapping` (logicalName ↔ vendorKey) is internal module responsibility. |
| Q5 | Associations | **Labeled associations canonical** (HubSpot v4 as reference), with `capabilities.labeled_associations: bool` capability flag. Modules without native labels declare `false`; attempts to pass `label != ""` return `CRM_CONSISTENCY_LABELS_NOT_SUPPORTED`. `Association` is a first-class aggregate with its own topic. |
| Q6 | Russian/national regulatory fields | **First-class generic-named fields on `Company`**: `tax_id` (Bitrix24 INN), `registration_id` (Bitrix24 OGRN), `tax_branch_id` (Bitrix24 KPP). Generic naming preserves vendor-neutrality; international modules leave them empty. |
| Q7 | Sync RPCs | **Both `SyncDelta` (unary RPC) and `SyncFull` (via AsyncJob aggregate).** `SyncDelta(entity_type, since, cursor)` returns CREATED/UPDATED/DELETED items with monotonic watermark. `SyncFull` rides `SubmitJob`/`GetJob`/`CancelJob`/`ListJobs`. |
| Q8 | AsyncJob types in v1 | **Only `SYNC_FULL`.** `SubmitJob.body` is a `oneof` with one variant in v1; `IMPORT_BULK`/`EXPORT_FILTERED` slot in non-breaking. Aligns with AI/LLM v1 single-variant approach (`BATCH_COMPLETION`). |
| Q9 | Naming | `crm`. Path `packages/contracts/crm/v1/`, workspace `@rntme/contracts-crm-v1`, proto package `rntme.contracts.crm.v1`, CloudEvents type `rntme.crm.v1.<EventShortName>`, Kafka topics `rntme.crm.{contact,company,deal,activity,note,association,async_job}` (7 topics, no version suffix per CLAUDE.md), error codes `CRM_<LAYER>_<KIND>`, module names `module-crm-<vendor>`. |
| Q10 | First vendor + mock-vendor | **First vendor: `module-crm-bitrix24`** (RU P0 priority — 57.5% RU market, 152-FZ data-residency requirement, official `@bitrix24/b24jssdk` v1.0.5 since 2026-03). Stress-tests the contract against the most divergent vendor quirks (HTTP 200 + error body, no webhook retry, RPC-style API, `UF_CRM_` prefixes, Smart Processes). **Mock-vendor: generic** in `@rntme/conformance-framework` (closes modules-monorepo OQ4 in favour of generic, set by Identity v1 §9.5, reaffirmed by AI/LLM v1 §12.5). `@rntme/conformance-crm` ships fixtures and assertions only. |

## 4. Layout

This spec adds two workspace packages. `_common/v1/` is reused unchanged from Identity.

```
packages/contracts/
├── _common/v1/                                  # REUSED, no changes
├── identity/v1/                                  # exists
├── ai-llm/v1/                                    # in design (sibling spec)
└── crm/v1/                                       # NEW workspace package @rntme/contracts-crm-v1
    ├── proto/
    │   ├── crm.proto                              # service CrmModule + entities + enums
    │   └── crm-events.proto                       # 21 event payloads
    ├── src/                                       # generated TS bindings
    ├── error-codes.json                            # CRM_<LAYER>_<KIND> set
    ├── package.json
    └── README.md

modules/crm/                                       # NEW (category root only — vendor dirs are subsequent brainstorms)
├── README.md                                      # category-doc, contributor entry point
└── conformance/                                   # NEW workspace package @rntme/conformance-crm
    ├── src/
    │   ├── suite.ts                                # exports CategoryConformanceSuite
    │   ├── fixtures/
    │   │   ├── contacts.ts
    │   │   ├── companies.ts
    │   │   ├── deals.ts
    │   │   ├── activities.ts
    │   │   ├── notes.ts
    │   │   ├── associations.ts
    │   │   ├── pipelines.ts                        # open/won/lost stage fixtures
    │   │   ├── custom-fields.ts
    │   │   └── webhooks/
    │   │       ├── hubspot-batch.json              # JSON
    │   │       ├── amocrm-update.urlencoded        # URL-encoded form data
    │   │       ├── bitrix24-event.json
    │   │       └── pipedrive-v2.json
    │   └── scenarios/                              # one file per canonical RPC (34 stubs in v1)
    │       ├── GetContact.scenarios.ts
    │       ├── ListContacts.scenarios.ts
    │       ├── CreateContact.scenarios.ts
    │       ├── UpdateContact.scenarios.ts
    │       ├── DeleteContact.scenarios.ts
    │       ├── GetCompany.scenarios.ts
    │       ├── …
    │       ├── CreateAssociation.scenarios.ts
    │       ├── DeleteAssociation.scenarios.ts
    │       ├── ListAssociations.scenarios.ts
    │       ├── ListPipelines.scenarios.ts
    │       ├── ListCustomFieldDefinitions.scenarios.ts
    │       ├── SyncDelta.scenarios.ts
    │       ├── SubmitJob.scenarios.ts
    │       ├── GetJob.scenarios.ts
    │       ├── CancelJob.scenarios.ts
    │       └── ListJobs.scenarios.ts
    ├── package.json
    └── README.md
```

`modules/crm/` ships in this spec without any vendor directory — only the category README and conformance package land. The first vendor (`modules/crm/bitrix24/`) is a subsequent brainstorm.

## 5. Status enums

All CRM status enums follow the rntme convention: `<TYPE>_UNSPECIFIED = 0` (proto3 zero), `<TYPE>_VENDOR_SPECIFIC = 100` (escape hatch). The 1–99 range is reserved for canonical values.

```protobuf
syntax = "proto3";
package rntme.contracts.crm.v1;

import "google/protobuf/any.proto";
import "google/protobuf/duration.proto";
import "google/protobuf/struct.proto";
import "google/protobuf/timestamp.proto";
import "rntme/contracts/common/v1/common.proto";

enum ContactStatus {
  CONTACT_STATUS_UNSPECIFIED = 0;
  CONTACT_STATUS_ACTIVE = 1;
  CONTACT_STATUS_DELETED = 2;
  CONTACT_STATUS_VENDOR_SPECIFIC = 100;
}

enum CompanyStatus {
  COMPANY_STATUS_UNSPECIFIED = 0;
  COMPANY_STATUS_ACTIVE = 1;
  COMPANY_STATUS_DELETED = 2;
  COMPANY_STATUS_VENDOR_SPECIFIC = 100;
}

enum DealStatus {
  DEAL_STATUS_UNSPECIFIED = 0;
  DEAL_STATUS_OPEN = 1;            // in-pipeline
  DEAL_STATUS_WON = 2;              // terminal success
  DEAL_STATUS_LOST = 3;             // terminal failure
  DEAL_STATUS_DELETED = 4;          // soft-deleted
  DEAL_STATUS_VENDOR_SPECIFIC = 100;
}

// Lead/Deal Schism resolution (Q1). UNQUALIFIED = what SF/HubSpot/Zoho/Pipedrive call Lead;
// QUALIFIED = what they call Deal/Opportunity. amoCRM Lead → Deal{qualification=QUALIFIED};
// amoCRM Contact → Contact{}.
enum DealQualification {
  DEAL_QUALIFICATION_UNSPECIFIED = 0;
  DEAL_QUALIFICATION_UNQUALIFIED = 1;
  DEAL_QUALIFICATION_QUALIFIED = 2;
  DEAL_QUALIFICATION_DISQUALIFIED = 3;
}

enum ActivityType {
  ACTIVITY_TYPE_UNSPECIFIED = 0;
  ACTIVITY_TYPE_CALL = 1;
  ACTIVITY_TYPE_MEETING = 2;
  ACTIVITY_TYPE_TASK = 3;
  ACTIVITY_TYPE_EMAIL = 4;
  ACTIVITY_TYPE_VENDOR_SPECIFIC = 100;
}

enum ActivityOutcome {
  ACTIVITY_OUTCOME_UNSPECIFIED = 0;
  ACTIVITY_OUTCOME_PLANNED = 1;
  ACTIVITY_OUTCOME_COMPLETED = 2;
  ACTIVITY_OUTCOME_CANCELLED = 3;
  ACTIVITY_OUTCOME_NO_ANSWER = 4;
  ACTIVITY_OUTCOME_RESCHEDULED = 5;
}

enum CustomFieldType {
  CUSTOM_FIELD_TYPE_UNSPECIFIED = 0;
  CUSTOM_FIELD_TYPE_STRING = 1;
  CUSTOM_FIELD_TYPE_NUMBER = 2;
  CUSTOM_FIELD_TYPE_DATE = 3;
  CUSTOM_FIELD_TYPE_DATETIME = 4;
  CUSTOM_FIELD_TYPE_BOOLEAN = 5;
  CUSTOM_FIELD_TYPE_ENUM = 6;
  CUSTOM_FIELD_TYPE_MULTI_SELECT = 7;
  CUSTOM_FIELD_TYPE_URL = 8;
  CUSTOM_FIELD_TYPE_MONEY = 9;
  CUSTOM_FIELD_TYPE_FILE = 10;
}

// Stage semantic mapping. Bitrix24's STAGE_SEMANTIC_ID (P/S/F) is the most explicit
// vendor encoding; SF Closed Won/Closed Lost map to WON/LOST; HubSpot pipeline closed-won
// stage maps to WON.
enum StageSemantic {
  STAGE_SEMANTIC_UNSPECIFIED = 0;
  STAGE_SEMANTIC_OPEN = 1;
  STAGE_SEMANTIC_WON = 2;
  STAGE_SEMANTIC_LOST = 3;
}

enum AssociationCategory {
  ASSOCIATION_CATEGORY_UNSPECIFIED = 0;
  ASSOCIATION_CATEGORY_RNTME_DEFINED = 1;  // canonical labels (BILLING_CONTACT, DECISION_MAKER, ...)
  ASSOCIATION_CATEGORY_USER_DEFINED = 2;   // tenant-custom
}

enum AsyncJobType {
  ASYNC_JOB_TYPE_UNSPECIFIED = 0;
  ASYNC_JOB_TYPE_SYNC_FULL = 1;
  ASYNC_JOB_TYPE_VENDOR_SPECIFIC = 100;
}

enum AsyncJobStatus {
  ASYNC_JOB_STATUS_UNSPECIFIED = 0;
  ASYNC_JOB_STATUS_QUEUED = 1;
  ASYNC_JOB_STATUS_RUNNING = 2;
  ASYNC_JOB_STATUS_COMPLETED = 3;
  ASYNC_JOB_STATUS_FAILED = 4;
  ASYNC_JOB_STATUS_CANCELLED = 5;
  ASYNC_JOB_STATUS_VENDOR_SPECIFIC = 100;
}

enum SyncDeltaOp {
  SYNC_DELTA_OP_UNSPECIFIED = 0;
  SYNC_DELTA_OP_CREATED = 1;
  SYNC_DELTA_OP_UPDATED = 2;
  SYNC_DELTA_OP_DELETED = 3;
}
```

## 6. Helper messages

Read-only helpers (`Pipeline`, `Stage`), connector helpers (`Owner`, `CustomFieldDefinition`, `Association`), and an `EntityRef` utility used as cross-aggregate reference.

```protobuf
// EntityRef — cross-aggregate reference inside the contract (used by Activity.linked_entities,
// Note.parent, Association.from/to).
message EntityRef {
  string entity_type = 1;            // "contact" | "company" | "deal" | "activity" | "note"
  string canonical_id = 2;
}

// Pipeline — read-only helper. No events, no Command-RPC; managed by the vendor.
message Pipeline {
  string canonical_id = 1;
  string vendor_id = 2;
  string name = 3;
  string entity_type = 4;            // typically "deal"; some CRMs apply pipelines to activities
  bool is_default = 5;
  repeated Stage stages = 6;          // ordered by Stage.order
  google.protobuf.Struct vendor_raw = 7;
}

message Stage {
  string canonical_id = 1;
  string vendor_id = 2;
  string pipeline_canonical_id = 3;
  string name = 4;
  int32 order = 5;
  StageSemantic semantic = 6;         // OPEN/WON/LOST
  float probability = 7;              // 0..1, weighted-forecast support
  bool is_terminal = 8;
}

// Owner — CRM-local user reference. Distinct from Identity.User aggregate; CRMs maintain
// their own user namespace (Bitrix24 employees, SF Users, HubSpot Owners). Linkage to
// Identity.User is blueprint business logic, not contract concern.
message Owner {
  string canonical_id = 1;
  string vendor_id = 2;
  string email = 3;
  rntme.contracts.common.v1.Name name = 4;
  bool is_active = 5;
}

// CustomFieldDefinition — read-only schema descriptor for UI form generation.
// Module maintains internal FieldMapping table (logicalName ↔ vendorKey), populated at
// connect time via vendor schema introspection (crm.item.fields / describeSObject /
// /properties / dealFields). Consumers never see vendor_key in data-plane.
message CustomFieldDefinition {
  string entity_type = 1;             // "contact" | "company" | "deal" | "activity" | "note"
  string logical_name = 2;            // canonical key under metadata.public.<name>
  string vendor_key = 3;              // raw vendor key (UF_CRM_*, __c, 40-char hash) — for debugging
  CustomFieldType field_type = 4;
  string label = 5;                   // human-readable
  bool is_required = 6;
  repeated string options = 7;         // for enum / multi_select
  google.protobuf.Struct vendor_raw = 8;
}

// Association — labeled M:N edge (HubSpot v4-shape). For modules without native label
// support (Bitrix24, amoCRM, Pipedrive), vendor_id is empty and canonical_id is a
// module-generated UUID; module persists association in its own state.
message Association {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  EntityRef from = 2;
  EntityRef to = 3;
  AssociationCategory category = 4;
  string label = 5;                    // "BILLING_CONTACT", "DECISION_MAKER", or custom
  google.protobuf.Struct metadata = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Struct vendor_raw = 8;
}
```

## 7. Aggregates

The five business aggregates plus the `AsyncJob` helper aggregate. Each carries `CanonicalRef`, `Metadata` 3-tier, soft-delete fields, and `vendor_raw` for unmapped vendor data.

```protobuf
message Contact {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string email = 2;
  string phone = 3;
  rntme.contracts.common.v1.Name name = 4;
  string title = 5;                         // job title

  string company_canonical_id = 6;          // primary company (single-link convenience;
                                            // M:N richer relationships go through Association)
  string owner_canonical_id = 7;
  repeated string tags = 8;                  // flat string labels

  ContactStatus status = 9;
  rntme.contracts.common.v1.Metadata metadata = 10;

  google.protobuf.Timestamp created_at = 11;
  google.protobuf.Timestamp updated_at = 12;
  google.protobuf.Timestamp deleted_at = 13;

  google.protobuf.Struct vendor_raw = 14;
}

message Company {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string name = 2;
  string domain = 3;                         // primary website domain (HubSpot dedup key)
  string industry = 4;
  int32 employee_count = 5;
  double annual_revenue = 6;
  string currency = 7;                       // ISO-4217

  // Q6 — generic-named regulatory fields. RU mapping: Bitrix24 INN/OGRN/KPP via crm.requisite.*.
  // International modules leave empty.
  string tax_id = 8;
  string registration_id = 9;
  string tax_branch_id = 10;

  string parent_company_canonical_id = 11;   // hierarchy (SF, HubSpot, Zoho support)
  string owner_canonical_id = 12;
  repeated string tags = 13;

  CompanyStatus status = 14;
  rntme.contracts.common.v1.Metadata metadata = 15;

  google.protobuf.Timestamp created_at = 16;
  google.protobuf.Timestamp updated_at = 17;
  google.protobuf.Timestamp deleted_at = 18;

  google.protobuf.Struct vendor_raw = 19;
}

message Deal {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string name = 2;                           // dealname / title
  string pipeline_canonical_id = 3;
  string stage_canonical_id = 4;

  DealStatus status = 5;                     // OPEN / WON / LOST / DELETED
  DealQualification qualification = 6;       // UNQUALIFIED / QUALIFIED / DISQUALIFIED

  double amount = 7;
  string currency = 8;                        // ISO-4217
  float probability = 9;                      // 0..1; from Stage.probability or vendor

  google.protobuf.Timestamp expected_close_date = 10;
  google.protobuf.Timestamp closed_at = 11;
  string close_reason = 12;                   // free text; especially for LOST

  string primary_contact_canonical_id = 13;
  string company_canonical_id = 14;
  string owner_canonical_id = 15;
  repeated string tags = 16;

  string source = 17;                         // lead source (utm_source-like)
  rntme.contracts.common.v1.Metadata metadata = 18;

  google.protobuf.Timestamp created_at = 19;
  google.protobuf.Timestamp updated_at = 20;
  google.protobuf.Timestamp deleted_at = 21;

  google.protobuf.Struct vendor_raw = 22;
}

message Activity {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  ActivityType type = 2;                      // CALL / MEETING / TASK / EMAIL
  string subject = 3;
  string description = 4;

  google.protobuf.Timestamp due_at = 5;
  google.protobuf.Timestamp completed_at = 6;
  google.protobuf.Duration duration = 7;       // for MEETING / CALL

  ActivityOutcome outcome = 8;
  bool is_completed = 9;                       // derived from outcome; convenience read-only

  // M:N: HubSpot/Bitrix24 attach activity to multiple entities (e.g., one meeting tied to
  // two contacts and a deal).
  repeated EntityRef linked_entities = 10;

  string owner_canonical_id = 11;
  rntme.contracts.common.v1.Metadata metadata = 12;

  google.protobuf.Timestamp created_at = 13;
  google.protobuf.Timestamp updated_at = 14;

  google.protobuf.Struct vendor_raw = 15;
}

message Note {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string content = 2;                          // plain text or HTML; mime-type rides in metadata.public.content_type
  string title = 3;                            // optional

  EntityRef parent = 4;                        // exactly one (universal across all 6 CRMs)

  string author_canonical_id = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;

  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;

  google.protobuf.Struct vendor_raw = 9;
}

// AsyncJob — helper aggregate for SyncFull (Q7=C, Q8=A). Mirrors AI/LLM v1 §8 AsyncJob.
message AsyncJob {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  AsyncJobType type = 2;
  AsyncJobStatus status = 3;
  int32 progress_percentage = 4;               // 0..100

  string result_uri = 5;                       // signed URL → JSONL of records (for SYNC_FULL)
  int64 record_count = 6;                       // total records processed
  string error_message = 7;                    // when FAILED

  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp completed_at = 9;
  google.protobuf.Timestamp expires_at = 10;    // when result_uri expires

  google.protobuf.Struct vendor_raw = 11;
}

// Payload for SubmitJob.body oneof.
message SyncFullPayload {
  repeated string entity_types = 1;             // e.g. ["contact","company","deal","activity","note"]
  google.protobuf.Timestamp since = 2;          // optional, for re-sync from a watermark
}
```

Design notes:

- **`Deal.qualification` separate from `Deal.status`** — they are orthogonal. A deal can be `qualification=UNQUALIFIED, status=OPEN` (a fresh lead in pipeline) or `qualification=QUALIFIED, status=WON` (a closed-won opportunity). amoCRM's "Lead converted to Contact" maps to `qualification UNQUALIFIED→QUALIFIED`; SF's `convertLead()` likewise.
- **`primary_contact_canonical_id` / `company_canonical_id` on Deal as convenience scalars** — the canonical M:N graph rides through `Association`. Single-link scalars cover the ~80% case (one primary contact per deal) without forcing every consumer into the association graph.
- **`Activity.linked_entities` is M:N**; `Note.parent` is exactly one. This asymmetry follows research §3.5: notes are universally single-parent across all six CRMs; activities are M:N in HubSpot/Bitrix24 and effectively M:N via parent-record-id sharing in SF/Zoho.
- **Soft-delete canonical** (`status = *_DELETED` + `deleted_at`). `Delete*Request{hard_delete: true}` is opt-in per vendor capability; vendors that only soft-delete return `CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE`.
- **`Note` has no DealStatus/ContactStatus equivalent** — notes are immutable post-creation in v1; `deleted_at` lives in `vendor_raw` if vendor supports tombstones.
- **`vendor_raw: Struct` on every aggregate**; helper messages (`Pipeline`, `Stage`, `Owner`, `EntityRef`) carry `vendor_raw` only when they wrap a vendor object directly.

## 8. `CrmModule` service

Thirty-four RPCs across queries (13: 2 per business aggregate + 3 helpers), commands (16: full CRUD per aggregate minus `UpdateNote`, plus association create/delete), sync (1), and async-job (4).

```protobuf
service CrmModule {
  // ─── Queries: Contact ────────────────────────────────────
  rpc GetContact(GetContactRequest) returns (Contact);
  rpc ListContacts(ListContactsRequest) returns (ContactList);

  // ─── Queries: Company ────────────────────────────────────
  rpc GetCompany(GetCompanyRequest) returns (Company);
  rpc ListCompanies(ListCompaniesRequest) returns (CompanyList);

  // ─── Queries: Deal ───────────────────────────────────────
  rpc GetDeal(GetDealRequest) returns (Deal);
  rpc ListDeals(ListDealsRequest) returns (DealList);

  // ─── Queries: Activity ───────────────────────────────────
  rpc GetActivity(GetActivityRequest) returns (Activity);
  rpc ListActivities(ListActivitiesRequest) returns (ActivityList);

  // ─── Queries: Note ───────────────────────────────────────
  rpc GetNote(GetNoteRequest) returns (Note);
  rpc ListNotes(ListNotesRequest) returns (NoteList);

  // ─── Queries: helpers ────────────────────────────────────
  rpc ListPipelines(ListPipelinesRequest) returns (PipelineList);
  rpc ListCustomFieldDefinitions(ListCustomFieldDefinitionsRequest) returns (CustomFieldDefinitionList);
  rpc ListAssociations(ListAssociationsRequest) returns (AssociationList);

  // ─── Commands: Contact ───────────────────────────────────
  rpc CreateContact(CreateContactRequest) returns (Contact);
  rpc UpdateContact(UpdateContactRequest) returns (Contact);
  rpc DeleteContact(DeleteContactRequest) returns (Contact);

  // ─── Commands: Company ───────────────────────────────────
  rpc CreateCompany(CreateCompanyRequest) returns (Company);
  rpc UpdateCompany(UpdateCompanyRequest) returns (Company);
  rpc DeleteCompany(DeleteCompanyRequest) returns (Company);

  // ─── Commands: Deal ──────────────────────────────────────
  // No separate MoveDealToStage RPC. Stage transitions ride through UpdateDeal{stage_canonical_id,
  // pipeline_canonical_id?}. The high-signal DealStageChanged event still fires.
  rpc CreateDeal(CreateDealRequest) returns (Deal);
  rpc UpdateDeal(UpdateDealRequest) returns (Deal);
  rpc DeleteDeal(DeleteDealRequest) returns (Deal);

  // ─── Commands: Activity ──────────────────────────────────
  rpc CreateActivity(CreateActivityRequest) returns (Activity);
  rpc UpdateActivity(UpdateActivityRequest) returns (Activity);  // includes outcome transitions
  rpc DeleteActivity(DeleteActivityRequest) returns (Activity);

  // ─── Commands: Note ──────────────────────────────────────
  // No UpdateNote in v1 — notes are de-facto immutable across most vendors.
  rpc CreateNote(CreateNoteRequest) returns (Note);
  rpc DeleteNote(DeleteNoteRequest) returns (Note);

  // ─── Commands: Association ───────────────────────────────
  rpc CreateAssociation(CreateAssociationRequest) returns (Association);
  rpc DeleteAssociation(DeleteAssociationRequest) returns (Association);

  // ─── Sync ────────────────────────────────────────────────
  rpc SyncDelta(SyncDeltaRequest) returns (SyncDeltaResponse);

  // ─── AsyncJob (SYNC_FULL only in v1) ─────────────────────
  rpc SubmitJob(SubmitJobRequest) returns (AsyncJob);
  rpc GetJob(GetJobRequest) returns (AsyncJob);
  rpc CancelJob(CancelJobRequest) returns (AsyncJob);
  rpc ListJobs(ListJobsRequest) returns (AsyncJobList);
}
```

### 8.1 Request/response conventions

- **Get*Request** → `string canonical_id = 1;`. No other fields.
- **List*Request** → `rntme.contracts.common.v1.ListRequest base = 1;` followed by domain-specific scope filters (`pipeline_canonical_id`, `stage_canonical_id`, `owner_canonical_id`, `status`, exact-match `email`/`domain`/`tax_id`, etc.).
- **\*List response** → `repeated <Entity> items = 1; rntme.contracts.common.v1.ListResponseMeta meta = 2;`.
- **Command*Request** → `rntme.contracts.common.v1.CommandContext context = 1;` first, body fields after. `idempotency_key` is required; missing it returns `CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY`.
- **Update semantics: full replacement.** No `FieldMask` in v1. If partial-update need surfaces, that is a v1.minor addition (non-breaking).
- **Delete semantics: soft by default.** `Delete*Request { CommandContext context, string canonical_id, bool hard_delete }`.

Sample request/response messages — the rest follow the same pattern:

```protobuf
message GetContactRequest { string canonical_id = 1; }

message ListContactsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string company_canonical_id = 2;     // optional scope
  string owner_canonical_id = 3;        // optional scope
  ContactStatus status = 4;             // optional
  string email = 5;                     // optional exact-match
}

message ContactList {
  repeated Contact items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message CreateContactRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string email = 2;
  string phone = 3;
  rntme.contracts.common.v1.Name name = 4;
  string title = 5;
  string company_canonical_id = 6;
  string owner_canonical_id = 7;
  repeated string tags = 8;
  rntme.contracts.common.v1.Metadata metadata = 9;
}

message UpdateContactRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string email = 3;
  string phone = 4;
  rntme.contracts.common.v1.Name name = 5;
  string title = 6;
  string company_canonical_id = 7;
  string owner_canonical_id = 8;
  repeated string tags = 9;
  ContactStatus status = 10;
  rntme.contracts.common.v1.Metadata metadata = 11;
}

message DeleteContactRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

message UpdateDealRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string name = 3;
  string pipeline_canonical_id = 4;       // populated for cross-pipeline move
  string stage_canonical_id = 5;
  DealStatus status = 6;
  DealQualification qualification = 7;
  double amount = 8;
  string currency = 9;
  google.protobuf.Timestamp expected_close_date = 10;
  string close_reason = 11;
  string primary_contact_canonical_id = 12;
  string company_canonical_id = 13;
  string owner_canonical_id = 14;
  repeated string tags = 15;
  rntme.contracts.common.v1.Metadata metadata = 16;
}

message CreateAssociationRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  EntityRef from = 2;
  EntityRef to = 3;
  AssociationCategory category = 4;
  string label = 5;                       // "" allowed for unlabeled; non-empty requires
                                          // capabilities.labeled_associations = true
  google.protobuf.Struct metadata = 6;
}

message ListAssociationsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  EntityRef from = 2;                     // anchor
  string to_entity_type = 3;              // optional filter — "deal" / "contact" / ...
  string label = 4;                        // optional filter
}

message SyncDeltaRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string entity_type = 2;                 // "contact" | "company" | "deal" | "activity" | "note"
  google.protobuf.Timestamp since = 3;
  string cursor = 4;                       // continuation
  int32 limit = 5;                         // default 100, max 500
}

message SyncDeltaResponse {
  repeated SyncDeltaItem items = 1;
  string next_cursor = 2;
  google.protobuf.Timestamp watermark = 3; // monotonic; safe to pass back as next `since`
}

message SyncDeltaItem {
  string canonical_id = 1;
  SyncDeltaOp op = 2;                     // CREATED / UPDATED / DELETED
  google.protobuf.Any entity = 3;          // Contact / Company / Deal / Activity / Note
                                           // None for DELETED
  google.protobuf.Timestamp changed_at = 4;
}

message SubmitJobRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  oneof body {
    SyncFullPayload sync_full = 2;
    // future: ImportBulkPayload, ExportFilteredPayload — non-breaking
  }
  google.protobuf.Duration ttl = 3;
}

message ListJobsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  AsyncJobType type = 2;                   // optional filter
  AsyncJobStatus status = 3;               // optional filter
}
```

### 8.2 Conventions and invariants

- **Idempotency required on every Command.** Missing `context.idempotency_key` returns `CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY`. Modules implement an internal dedup-store with **at least 24h TTL**, since most CRM vendors lack native idempotency for create/update endpoints (Bitrix24, amoCRM, Pipedrive, Zoho), and replays would create duplicate records.
- **`pipeline_canonical_id` on `UpdateDeal` is conditionally required** — if `stage_canonical_id` belongs to a different pipeline than the current one, `pipeline_canonical_id` MUST be set. Bitrix24 specifically rejects cross-pipeline `crm.deal.update`; the canonical request promotes this to a structural invariant via `crm.item.update` semantics.
- **Tag membership is canonical strings.** `tags[]` arrays carry plain strings; vendor-specific tag-id is hidden behind module-side mapping. No separate `Tag` aggregate in v1.
- **Currency code is ISO-4217.** Three-letter uppercase. Mismatch yields `CRM_STRUCTURAL_INVALID_CURRENCY`.
- **`Owner` lookups** — `*_owner_canonical_id` fields refer to canonical_id of an `Owner`. `Owner` has no Get/List RPCs in v1; modules either populate Owner inside aggregate `vendor_raw` or expose ownership through a separate read pattern. Promotion of Owner to a queryable aggregate is a v1.minor candidate per OQ-CRMV1-3.
- **Webhook normalisation is module-internal.** Whether the upstream sends JSON (HubSpot, Pipedrive, Bitrix24, Zoho) or URL-encoded form data (amoCRM) is module-side concern; the contract surfaces only normalised CloudEvents.
- **`SyncDelta` is non-streaming in v1.** Unary RPC with cursor; consumer polls. Streaming variant (`SyncDeltaStream`) is a non-breaking v1.minor addition when concrete throughput needs surface.
- **`SyncFull` (via `SubmitJob{sync_full}`) is the canonical initial-load mechanism.** `result_uri` returns a signed URL to a JSONL file containing all entities of the requested types. Module-managed storage; `expires_at` controls retention.
- **Cancel is best-effort.** `CancelJob` returns the current job state; if already terminal, returns the current state — not an error.
- **List ordering.** Items sorted `created_at DESC` by default; `base.sorts[]` overrides. Cursor-based pagination preferred over offset.

## 9. CloudEvents

### 9.1 Conventions

- **Topics (7):** `rntme.crm.contact`, `rntme.crm.company`, `rntme.crm.deal`, `rntme.crm.activity`, `rntme.crm.note`, `rntme.crm.association`, `rntme.crm.async_job`. No `.v1` suffix per CLAUDE.md.
- **CloudEvents `type`:** `rntme.crm.v1.<EventShortName>`.
- **`source`:** module name (e.g. `module-crm-bitrix24`); the contract does not mandate a value.
- **`subject`:** canonical_id of the aggregate.
- **`data`:** protobuf-serialised payload from `crm-events.proto`.
- **Kafka partition key:** canonical_id (ensures all events for one aggregate land in order).

### 9.2 Event matrix (21 events)

| # | EventShortName | Topic | Trigger |
|---|---|---|---|
| **Contact (3)** | | | |
| 1 | `ContactCreated` | contact | `CreateContact` succeeded or vendor webhook for upstream creation |
| 2 | `ContactUpdated` | contact | `UpdateContact` succeeded or vendor webhook (any field changed) |
| 3 | `ContactDeleted` | contact | `DeleteContact` (soft or hard) |
| **Company (3)** | | | |
| 4 | `CompanyCreated` | company | |
| 5 | `CompanyUpdated` | company | |
| 6 | `CompanyDeleted` | company | |
| **Deal (4)** | | | |
| 7 | `DealCreated` | deal | |
| 8 | `DealUpdated` | deal | Any field change **except** `stage_canonical_id` and terminal `status` transitions (those have dedicated events) |
| 9 | `DealStageChanged` | deal | `stage_canonical_id` changed (incl. cross-pipeline). Dedicated event due to forecast/analytics weight |
| 10 | `DealClosed` | deal | `status` → `WON` or `LOST` (terminal) |
| **Activity (3)** | | | |
| 11 | `ActivityCreated` | activity | |
| 12 | `ActivityUpdated` | activity | Includes `outcome` transitions (no separate `ActivityCompleted`) |
| 13 | `ActivityDeleted` | activity | |
| **Note (2)** | | | |
| 14 | `NoteCreated` | note | |
| 15 | `NoteDeleted` | note | |
| **Association (2)** | | | |
| 16 | `AssociationCreated` | association | |
| 17 | `AssociationDeleted` | association | |
| **AsyncJob (4)** | | | |
| 18 | `AsyncJobSubmitted` | async_job | `SubmitJob` accepted |
| 19 | `AsyncJobStatusChanged` | async_job | Intermediate transitions (QUEUED→RUNNING) |
| 20 | `AsyncJobCompleted` | async_job | Terminal success |
| 21 | `AsyncJobFailed` | async_job | Terminal failure (incl. cancellation, expiration) |

### 9.3 Payload structures

```protobuf
syntax = "proto3";
package rntme.contracts.crm.v1;

import "google/protobuf/timestamp.proto";
import "rntme/contracts/crm/v1/crm.proto";

// ── Contact ──────────────────────────────────────────────
message ContactCreated {
  Contact contact = 1;
  string trigger = 2;                    // "command" | "webhook" | "sync_full" | "sync_delta"
}

message ContactUpdated {
  Contact contact = 1;
  repeated string changed_fields = 2;
  Contact previous = 3;
  string trigger = 4;
}

message ContactDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
  string trigger = 5;
}

// ── Company ──────────────────────────────────────────────
message CompanyCreated { Company company = 1; string trigger = 2; }
message CompanyUpdated { Company company = 1; repeated string changed_fields = 2; Company previous = 3; string trigger = 4; }
message CompanyDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
  string trigger = 5;
}

// ── Deal ─────────────────────────────────────────────────
message DealCreated { Deal deal = 1; string trigger = 2; }

message DealUpdated {
  Deal deal = 1;
  repeated string changed_fields = 2;     // excludes "stage_canonical_id" and terminal status
  Deal previous = 3;
  string trigger = 4;
}

message DealStageChanged {
  Deal deal = 1;
  string from_stage_canonical_id = 2;
  string to_stage_canonical_id = 3;
  string from_pipeline_canonical_id = 4;  // populated only on cross-pipeline move
  string to_pipeline_canonical_id = 5;
  string actor_canonical_id = 6;          // CommandContext.actor_user_id at command time
  google.protobuf.Timestamp occurred_at = 7;
  string trigger = 8;
}

message DealClosed {
  Deal deal = 1;
  DealStatus terminal_status = 2;         // WON or LOST
  string close_reason = 3;
  google.protobuf.Timestamp closed_at = 4;
  string trigger = 5;
}

// ── Activity ─────────────────────────────────────────────
message ActivityCreated { Activity activity = 1; string trigger = 2; }
message ActivityUpdated { Activity activity = 1; repeated string changed_fields = 2; Activity previous = 3; string trigger = 4; }
message ActivityDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  google.protobuf.Timestamp deleted_at = 3;
  string trigger = 4;
}

// ── Note ─────────────────────────────────────────────────
message NoteCreated { Note note = 1; string trigger = 2; }
message NoteDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  google.protobuf.Timestamp deleted_at = 3;
  string trigger = 4;
}

// ── Association ──────────────────────────────────────────
message AssociationCreated { Association association = 1; string trigger = 2; }
message AssociationDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  EntityRef from = 3;
  EntityRef to = 4;
  string label = 5;
  google.protobuf.Timestamp deleted_at = 6;
  string trigger = 7;
}

// ── AsyncJob ─────────────────────────────────────────────
message AsyncJobSubmitted { AsyncJob job = 1; AsyncJobType type = 2; }

message AsyncJobStatusChanged {
  string canonical_id = 1;
  AsyncJobType type = 2;
  AsyncJobStatus previous_status = 3;
  AsyncJobStatus new_status = 4;
  int32 progress_percentage = 5;
  google.protobuf.Timestamp transitioned_at = 6;
}

message AsyncJobCompleted { AsyncJob job = 1; }

message AsyncJobFailed {
  AsyncJob job = 1;
  string error_code = 2;
  string error_message = 3;
}
```

What was dropped vs the reference research:

| Research | Decision | Reason |
|---|---|---|
| `Lead.created` / `Lead.qualified` / `Lead.converted` events | dropped | No `Prospect` aggregate; lead lifecycle rides through `Deal{qualification}` transitions inside `DealUpdated` |
| `Owner.changed` event | folded | `*Updated.changed_fields=["owner_canonical_id"]` |
| `Stage.history` event stream | dropped | Derive consumer-side from `DealStageChanged` events through QSM projection |
| `Webhook.received` (raw vendor envelope) | dropped | Module-level concern, not contract |
| `Activity.completed` separate event | folded | `ActivityUpdated{changed_fields=["outcome","is_completed"]}` |
| `AsyncJob.cancelled` separate event | folded | `AsyncJobFailed` covers terminal-failure and terminal-cancellation; `cancellation_reason` rides in `error_message` for cancellations. AI/LLM v1 split these; CRM folds because cancellation here is rare and operator-only |
| `BulkImport.row_failed` per-row events | dropped | `IMPORT_BULK` not in v1; row-level failures will land in `AsyncJob.error_details` when v1.minor adds it |

### 9.4 Capability declaration in `module.json`

Example: `module-crm-bitrix24`.

```json
{
  "name": "module-crm-bitrix24",
  "category": "crm",
  "contract_version": "v1",
  "capabilities": {
    "vendors": ["bitrix24"],
    "entities": ["contact", "company", "deal", "activity", "note"],
    "rpcs": [
      "GetContact", "ListContacts", "CreateContact", "UpdateContact", "DeleteContact",
      "GetCompany", "ListCompanies", "CreateCompany", "UpdateCompany", "DeleteCompany",
      "GetDeal", "ListDeals", "CreateDeal", "UpdateDeal", "DeleteDeal",
      "GetActivity", "ListActivities", "CreateActivity", "UpdateActivity", "DeleteActivity",
      "GetNote", "ListNotes", "CreateNote", "DeleteNote",
      "ListPipelines", "ListCustomFieldDefinitions", "ListAssociations",
      "CreateAssociation", "DeleteAssociation",
      "SyncDelta",
      "SubmitJob", "GetJob", "CancelJob", "ListJobs"
    ],
    "events": [
      "ContactCreated", "ContactUpdated", "ContactDeleted",
      "CompanyCreated", "CompanyUpdated", "CompanyDeleted",
      "DealCreated", "DealUpdated", "DealStageChanged", "DealClosed",
      "ActivityCreated", "ActivityUpdated", "ActivityDeleted",
      "NoteCreated", "NoteDeleted",
      "AssociationCreated", "AssociationDeleted",
      "AsyncJobSubmitted", "AsyncJobStatusChanged", "AsyncJobCompleted", "AsyncJobFailed"
    ],
    "search_tiers": ["simple"],
    "labeled_associations": false,
    "bulk_operations": { "max_size": 50 },
    "async_job_types": ["SYNC_FULL"],
    "webhook_format": "json",
    "webhook_retry_policy": "none"
  }
}
```

Compare: `module-crm-hubspot` (labeled associations native, JSON webhooks with 10 retries):

```json
{
  "capabilities": {
    "vendors": ["hubspot"],
    "labeled_associations": true,
    "bulk_operations": { "max_size": 100 },
    "search_tiers": ["simple"],
    "webhook_format": "json",
    "webhook_retry_policy": "exponential_24h_10retries"
  }
}
```

Compare: `module-crm-amocrm` (URL-encoded webhooks, no native batch):

```json
{
  "capabilities": {
    "vendors": ["amocrm", "kommo"],
    "labeled_associations": false,
    "bulk_operations": { "max_size": 1 },
    "search_tiers": ["simple"],
    "webhook_format": "urlencoded",
    "webhook_retry_policy": "undocumented"
  }
}
```

## 10. Error codes

Per CLAUDE.md `<PKG>_<LAYER>_<KIND>` → `CRM_<LAYER>_<KIND>`.

```json
{
  "structural": [
    "CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY",
    "CRM_STRUCTURAL_MISSING_REQUIRED_FIELD",
    "CRM_STRUCTURAL_INVALID_EMAIL",
    "CRM_STRUCTURAL_INVALID_PHONE",
    "CRM_STRUCTURAL_INVALID_CURRENCY",
    "CRM_STRUCTURAL_INVALID_TAX_ID",
    "CRM_STRUCTURAL_INVALID_ENTITY_TYPE"
  ],
  "references": [
    "CRM_REFERENCES_CONTACT_NOT_FOUND",
    "CRM_REFERENCES_COMPANY_NOT_FOUND",
    "CRM_REFERENCES_DEAL_NOT_FOUND",
    "CRM_REFERENCES_ACTIVITY_NOT_FOUND",
    "CRM_REFERENCES_NOTE_NOT_FOUND",
    "CRM_REFERENCES_ASSOCIATION_NOT_FOUND",
    "CRM_REFERENCES_PIPELINE_NOT_FOUND",
    "CRM_REFERENCES_STAGE_NOT_FOUND",
    "CRM_REFERENCES_OWNER_NOT_FOUND",
    "CRM_REFERENCES_ASYNC_JOB_NOT_FOUND"
  ],
  "consistency": [
    "CRM_CONSISTENCY_DUPLICATE_EMAIL",
    "CRM_CONSISTENCY_DUPLICATE_DOMAIN",
    "CRM_CONSISTENCY_STAGE_NOT_IN_PIPELINE",
    "CRM_CONSISTENCY_DEAL_ALREADY_CLOSED",
    "CRM_CONSISTENCY_LABELS_NOT_SUPPORTED",
    "CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE",
    "CRM_CONSISTENCY_UNSUPPORTED_ASYNC_JOB_TYPE",
    "CRM_CONSISTENCY_OPTIMISTIC_LOCK_CONFLICT",
    "CRM_CONSISTENCY_PARENT_ENTITY_TYPE_MISMATCH",
    "CRM_CONSISTENCY_BATCH_TOO_LARGE"
  ],
  "vendor": [
    "CRM_VENDOR_RATE_LIMITED",
    "CRM_VENDOR_DAILY_QUOTA_EXCEEDED",
    "CRM_VENDOR_UNAVAILABLE",
    "CRM_VENDOR_UNAUTHORIZED",
    "CRM_VENDOR_INVALID_REQUEST"
  ]
}
```

gRPC status mapping (modules implement this in their adapter, not in the contract package):

| Layer | gRPC `Code` | Notes |
|---|---|---|
| `structural` | `INVALID_ARGUMENT` | request shape problem |
| `references` | `NOT_FOUND` | canonical_id does not resolve |
| `consistency` | `FAILED_PRECONDITION` | state-machine violation, vendor-capability mismatch |
| `vendor.RATE_LIMITED` | `RESOURCE_EXHAUSTED` | with retry-info trailer |
| `vendor.DAILY_QUOTA_EXCEEDED` | `RESOURCE_EXHAUSTED` | retry-info trailer with hours-scale interval (vs. seconds for RATE_LIMITED) |
| `vendor.UNAVAILABLE` | `UNAVAILABLE` | upstream timeout / 5xx |
| `vendor.UNAUTHORIZED` | `PERMISSION_DENIED` | upstream rejected module credentials (incl. amoCRM IP-block after repeated abuse) |
| `vendor.INVALID_REQUEST` | `INVALID_ARGUMENT` | upstream reported a 4xx the module did not catch structurally first |

Design notes:

- **`CRM_VENDOR_RATE_LIMITED` normalises Bitrix24's HTTP 200 + `{"error":"QUERY_LIMIT_EXCEEDED"}` body** alongside the standard HTTP 429 from other vendors. Adapter parses response body before status code for Bitrix24. This is the most-cited research vendor-quirk (`canonical_crm_api §5.3.3`).
- **`CRM_VENDOR_DAILY_QUOTA_EXCEEDED`** is split from `RATE_LIMITED` because retry policy is fundamentally different: rate-limit retries are seconds-scale; quota retries are useless until reset (Salesforce daily limits, Zoho credit exhaustion, Bitrix24 daily portal cap).
- **`CRM_CONSISTENCY_DUPLICATE_EMAIL`** — HubSpot dedups contacts by email automatically; vendors that do not (Pipedrive, Bitrix24) can opt-in to validate locally before upstream call. `Create*Request{duplicate_check: "skip"|"update"|"error"}` is **not** in v1 — defaults to vendor's native behaviour. v1.minor adds the param when first blueprint requires deterministic dedup semantics.
- **`CRM_CONSISTENCY_STAGE_NOT_IN_PIPELINE`** — `UpdateDeal{stage_canonical_id, pipeline_canonical_id?}` where the stage does not belong to the (current or specified) pipeline. SF/HubSpot/Pipedrive do not validate this server-side, so the canonical contract enforces it inside the module before the upstream call.
- **`CRM_CONSISTENCY_LABELS_NOT_SUPPORTED`** — `CreateAssociation{label != ""}` against a module declaring `labeled_associations: false`. Returned before any upstream call.
- **`CRM_CONSISTENCY_PARENT_ENTITY_TYPE_MISMATCH`** — `CreateNote{parent.entity_type}` against an entity_type the vendor cannot attach notes to (e.g., Bitrix24 timeline-comment scope is leads/deals/contacts/companies — no notes on activities).
- **`CRM_CONSISTENCY_OPTIMISTIC_LOCK_CONFLICT`** — for SF and modules supporting `If-Match` / ETag. v1 does not introduce request-side `if_match` parameter; SF-module supplies it from `metadata.private.last_known_etag` if present. Promotion to first-class request param is v1.minor.
- **`CRM_CONSISTENCY_BATCH_TOO_LARGE`** — `SyncFullPayload.entity_types` exceeding vendor processing capacity (Bitrix24 batch cap × portal record count). Caught structurally before submitting the upstream batch.
- **`CRM_CONSISTENCY_DEAL_ALREADY_CLOSED`** — re-opening a deal in `WON` / `LOST` is supported by some vendors (HubSpot allows; SF requires reverting StageName) but not others (Bitrix24 archives terminal deals). Modules that cannot re-open return this code rather than vendor-leaked errors.

## 11. Conformance suite

### 11.1 Layout and authorship

`modules/crm/conformance/` is a workspace package `@rntme/conformance-crm`. Per modules-monorepo §7.1 it consumes the shared `@rntme/conformance-framework` (runner, invariants, reporter, generic mock-vendor — established by Identity v1 §9.5, reaffirmed by AI/LLM v1 §12.5) and supplies CRM-specific scenarios and fixtures. rntme-team writes both layers; modules-monorepo §7.2 mandates that any PR changing `packages/contracts/crm/v1/` lands matching scenario changes in `modules/crm/conformance/scenarios/` in the same PR.

### 11.2 Per-RPC scenarios

One file per canonical RPC. Thirty-four files for v1. Each file exports an array of `Scenario` from `@rntme/conformance-framework`. A scenario consists of:

1. **Pre-condition seed** — what entities must exist at the vendor before the scenario runs. Generic mock-vendor receives this seed; live mode pre-creates via the vendor's own API.
2. **Capability gating** — `requires: { labeled_associations: true }` etc. — scenarios skip on modules that don't declare the capability. Single-entry capability gates and multi-entry conjunctions both supported.
3. **Action** — a single canonical RPC call, OR for multi-step flows (Deal stage transition, SyncDelta watermark, AsyncJob lifecycle) a `steps[]` array of multiple RPCs with cross-step substitution (`$1.canonical_id`).
4. **Assertions**, in this order:
   - response shape matches canonical proto;
   - replay with the same `idempotency_key` returns the same logical result without duplicate event emission;
   - negative branches return the expected error code from `error-codes.json`;
   - for command RPCs, the expected CloudEvent `type` is published on the matching topic within a 5-second (or longer for SyncFull) window;
   - for stateful flows (Deal stage transition, AsyncJob lifecycle), expected event sequence emitted in order.

### 11.3 Anti-conformance

Per modules-monorepo §7.3, the runner unconditionally checks that any RPC not declared in `module.json#capabilities.rpcs[]` returns gRPC `UNIMPLEMENTED`. Random domain errors fail anti-conformance. This is the only structural enforcement; capability-claim coverage itself is left to the blueprint validator (modules-monorepo §6.2).

### 11.4 Capability-coverage report

Per modules-monorepo §7.4, the runner emits a report shaped like:

```
crm / bitrix24             (claims 34 / 34 canonical RPCs)
  GetContact                                   ✓
  ListContacts                                 ✓
  CreateContact                                ✓
  …
  CreateAssociation                            ✓ (label rejected: labels not supported)
  capabilities.entities                        [contact, company, deal, activity, note]   (5 / 5)
  capabilities.search_tiers                    [simple]                                    (1 / 1 in v1)
  capabilities.labeled_associations            false
  capabilities.bulk_operations.max_size        50
  capabilities.async_job_types                 [SYNC_FULL]                                 (1 / 1 in v1)
  capabilities.webhook_format                  json
  capabilities.webhook_retry_policy            none

crm / amocrm               (claims 33 / 34 canonical RPCs)
  …
  CreateAssociation                            ✓ (label rejected: labels not supported)
  ListCustomFieldDefinitions                   unsupported (declared, paid "Super Fields" tier-only)
  capabilities.bulk_operations.max_size        1
  capabilities.webhook_format                  urlencoded
```

This is the artefact a domain-blueprint author or LLM agent reads when picking a vendor for the CRM category.

### 11.5 Mock-vendor

Generic mock-vendor lives in `@rntme/conformance-framework` (closes modules-monorepo OQ4 in favour of generic, set by Identity v1 §9.5, reaffirmed by AI/LLM v1 §12.5). CRM-specific behaviour is supplied via fixtures and deterministic stub responses:

- `CreateDeal` returns a fixed Deal with stable `canonical_id` and `stage_canonical_id` from the seeded pipeline; conformance checks shape and event emission, not content.
- Pipeline transitions: mock validates that `stage_canonical_id` belongs to the active pipeline; cross-pipeline move validates `pipeline_canonical_id` agreement.
- Webhook fixtures (HubSpot JSON, amoCRM URL-encoded, Bitrix24 JSON, Pipedrive v2 JSON) are **input data** to the module's `event-transformer`; the assertion is that the resulting CloudEvent matches the canonical event shape.
- Vendor-quirk normalisation test (Bitrix24): mock-response delivering HTTP 200 + body `{"error":"QUERY_LIMIT_EXCEEDED"}` — assertion is that adapter returns `CRM_VENDOR_RATE_LIMITED` (gRPC `RESOURCE_EXHAUSTED`).

Live-conformance (real Bitrix24/HubSpot/Salesforce) is a separate runner mode requiring API keys in a secret store. v1 conformance-skeleton fixes only mock mode; live mode is the responsibility of each vendor implementation plan.

### 11.6 What is CRM-specific in the template vs Identity / AI/LLM

- **Webhook fixture diversity.** Identity wrappers receive vendor webhooks too, but the contract does not differentiate format. CRM has the only documented non-JSON case (amoCRM URL-encoded), so conformance ships parsable fixtures of both shapes.
- **Multi-step pipeline scenarios.** `CreateDeal → UpdateDeal{stage=next}` → expected `DealStageChanged` event; analogous to AI/LLM ThreadRun multi-step but applies to almost half of CRM RPCs.
- **`SyncDelta` semantic test.** Three records created with known timestamps, `SyncDelta(since=t1)` expected to return correct subset and monotonic `watermark`. No equivalent in Identity / AI/LLM.
- **Capability gating breadth.** Identity / AI/LLM gate scenarios on a small set of capabilities (input_modalities, thread, async_job_types). CRM gates on `labeled_associations`, `bulk_operations.max_size`, `webhook_format`, `webhook_retry_policy`, `async_job_types`, `entities[]` — a richer matrix because vendor variation is wider.

## 12. Governance

Per modules-monorepo §6.3, additions to `crm/v1` minor versions require either:

- **(a)** at least two real or planned vendor modules supporting a semantically equivalent operation, **or**
- **(b)** maintainer review confirming an *archetypal* operation for the category.

Archetypal evidence for v1 inclusions:

| Surface | Vendor evidence |
|---|---|
| `Contact` / `Company` / `Deal` / `Activity` / `Note` aggregates | All six researched CRMs |
| `DealQualification UNQUALIFIED/QUALIFIED` | SF Lead+Opportunity, Zoho Lead+Deal, HubSpot lifecyclestage, Bitrix24 Lead+Deal, Pipedrive Lead+Deal, amoCRM Contact+Lead (inverted) |
| `Pipeline` / `Stage` (read-only) | All six |
| `StageSemantic OPEN/WON/LOST` | Bitrix24 P/S/F (explicit), SF Closed Won/Closed Lost, HubSpot pipeline-closed, Pipedrive deal_status open/won/lost, Zoho stages |
| Generic regulatory fields (`tax_id`, `registration_id`, `tax_branch_id`) | Bitrix24 INN/OGRN/KPP via `crm.requisite.*`, RU domestic CRMs (МойСклад, RetailCRM, 1С-CRM); international vendors leave empty (acceptable) |
| Labeled associations | HubSpot Associations API v4 (de-facto reference), SF junction-objects + Role, Zoho Contact Roles |
| `SyncDelta` semantic | SF `/sobjects/{type}/updated` + `/deleted`, HubSpot Search by `hs_lastmodifieddate`, Bitrix24 `event.offline.get` + timestamp filter, Pipedrive `update_time DESC` cursor, Zoho `modified_since` |
| `AsyncJob SYNC_FULL` | SF Bulk API 2.0 (150M records), HubSpot CRM Export API, Zoho Bulk Read API, Pipedrive sequential-pagination as fallback |
| Vendor-prefixed module addressing (`module-crm-<vendor>`) | Identity v1 / AI/LLM v1 convention |

What is **not** in v1 and **does not** automatically enter v1.x with one vendor:

- `Quote`, `Invoice`, `Product`/`LineItem` aggregates — separate `crm-quote/v1`, `crm-invoice/v1`, `crm-product/v1` categories.
- `Tag` as a managed aggregate — separate `crm-tag/v1` if cross-entity tag CRUD surfaces.
- `RoleAssignment` as a separate aggregate — roles ride inside `Association.label`.
- `MoveDealToStage` as a separate RPC — folded into `UpdateDeal`; the high-signal `DealStageChanged` event covers analytics needs.
- `UpdateNote` RPC — added to v1.minor with ≥2 vendor support (currently SF + Bitrix24).
- `search.advanced` (vendor-language passthrough) and `search.fulltext` — added to v1.minor when first blueprint requires.
- `IMPORT_BULK` and `EXPORT_FILTERED` AsyncJob types — added to v1.minor with ≥2 vendor per type and concrete blueprint demand.
- Schema-mutating custom-field RPCs (`CreateCustomField`, …) — added to v1.minor when admin-flow blueprint surfaces. Vendor immutable-rule fragmentation (SF cannot change type, HubSpot cannot change name, Pipedrive cannot change field_type) is significant.
- Streaming `SyncDelta` (`SyncDeltaStream`) — non-breaking minor when throughput needs surface.
- Multi-instance support (one module backing multiple Bitrix24 portals) — an extension to `CommandContext`, not a contract change. Decision deferred to first vendor brainstorm (OQ-CRMV1-4).

Breaking changes to existing v1 RPCs, signature changes, or removals require a new major (`crm/v2/`). Two majors coexist; modules pin one.

## 13. Dependencies and merge order

`crm/v1` depends on:

- `packages/contracts/_common/v1/` — already exists from Identity v1 plan 1. Reused as-is, no changes.
- `@rntme/conformance-framework` — already exists from Identity plans + AI/LLM plans extension.
- `module-manifest-validator` — needs extension for new capability fields (`vendors[]`, `entities[]`, `search_tiers[]`, `labeled_associations: bool`, `bulk_operations.max_size: int`, `async_job_types[]`, `webhook_format: enum`, `webhook_retry_policy`). Backward-compatible: new fields are optional, identity / ai-llm modules unaffected.

Merge order:

1. **`packages/contracts/crm/v1/`** — proto (`crm.proto` + `crm-events.proto`), ts-bindings, `error-codes.json`, README. Standalone; passes `tsc`/`lint`/`test` independently. No vendor SDK touches.
2. **`module-manifest-validator` schema extension** — new capability fields validated for `category=crm`. Backward-compatible.
3. **`modules/crm/README.md`** — category README per modules-monorepo §5.1 contributor entry-point convention. Includes documented "Core / Full / Extended" capability presets (per Q2 — documentation only, not validated tiers).
4. **`modules/crm/conformance/`** — package skeleton: `suite.ts`, fixtures (including binary webhook fixtures: `amocrm-update.urlencoded`, `bitrix24-event.json`, `hubspot-batch.json`, `pipedrive-v2.json`), 34 scenario stubs (one per canonical RPC). Each stub fails with `not_implemented` until framework gains CRM-specific assertions; preserves the "scenario-per-RPC" invariant from modules-monorepo §7.2.
5. **Documentation-touch task** (per CLAUDE.md "every plan must include a documentation-touch task"):
   - `AGENTS.md` §3 (layering): add `packages/contracts/crm/v1/`, `modules/crm/conformance/` to the layer map.
   - `AGENTS.md` §10 (glossary): entries for **canonical CRM contract**, **Lead/Deal Schism resolution**, **labeled association capability**, **SyncDelta watermark**, **CRM helper aggregate (AsyncJob)**, **Custom Field FieldMapping**.
   - `README.md` packages-table: list the two new workspace packages.
   - Per-package READMEs follow the standard template (File map / Quick start / API / Invariants & gotchas / Out of scope / Where to look first / Specs).

## 14. Decomposition into implementation plans

This spec decomposes into **2 implementation plans** in `docs/superpowers/plans/crm-canonical-contract/`:

| # | Plan | Covers | Depends on |
|---|---|---|---|
| 1 | `01-crm-contracts.md` | Create `packages/contracts/crm/v1/`: `crm.proto`, `crm-events.proto`, ts-bindings, `error-codes.json`, README. Extend `module-manifest-validator` for new capability fields. Documentation-touch (AGENTS.md §3 / §10, README packages-table). | Identity plan 1 (for `_common/v1/`) |
| 2 | `02-crm-conformance-skeleton.md` | Create `modules/crm/README.md`; create `modules/crm/conformance/` workspace package; 34 scenario stubs (one per canonical RPC); fixtures stubs (text, content-blocks, tools, threads, webhook fixtures incl. URL-encoded amoCRM); suite.ts wired against `@rntme/conformance-framework`; documentation-touch for new module-tree. | Plan 1 + Identity plan 2 (for conformance-framework) |

The first vendor module (`module-crm-bitrix24`, recommended per Q10) and the CRM module skeleton are NOT covered by these plans.

## 15. Testing model

- **Unit tests for `crm/v1/`:** ts-proto round-trip for each entity (Contact, Company, Deal, Activity, Note, AsyncJob, Pipeline, Stage, Owner, CustomFieldDefinition, Association, EntityRef, SyncFullPayload, SyncDeltaItem); each enum value including `*_VENDOR_SPECIFIC = 100`; each event payload (21 events).
- **Drift test (proto ↔ scenarios):** RPC short-names in `service CrmModule` must match scenario filenames in `modules/crm/conformance/scenarios/`. Mismatch is a test failure.
- **Drift test (events ↔ proto):** event short-names in conformance fixtures (`module.json#capabilities.events[]` examples) must match message names in `crm-events.proto`.
- **Lint test for `error-codes.json`:** every code matches `CRM_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z_]+`. No other prefixes accepted.
- **Conformance scenario stubs:** each of the 34 scenario files compiles and exports a non-empty `Scenario[]` (even if every scenario currently throws `not_implemented`). Preserves the structural invariant from modules-monorepo §7.2.
- **Multi-step scenario validator:** scenarios with `steps[]` (Deal stage transition lifecycle, SyncDelta watermark progression, AsyncJob submit→complete) verify substitution-expression correctness (`$1.canonical_id`) at compile time via TypeScript helper.
- **Webhook fixture sanity test:** `amocrm-update.urlencoded` parses as URL-encoded form data; `*.json` fixtures parse as JSON. Each ≤ 50KB, kept in git.
- **Module manifest validator unit tests:** new capability fields validated with positive and negative cases; backward compat for `category=identity` / `category=ai-llm` does not break (new fields are optional until `category=crm`).
- **No vendor SDK touches.** No `@bitrix24/b24jssdk`/`jsforce`/`@hubspot/api-client` import in `packages/contracts/crm/v1/` or `modules/crm/conformance/`. The first vendor SDK integration lands with the first vendor module brainstorm, not here.

## 16. Out of scope / future brainstorms

In priority order:

1. **First vendor module + skeleton: `module-crm-bitrix24`** — RU P0 priority. Validates contract against the most divergent vendor (HTTP 200 + error body, no webhook retry, RPC-style API, `UF_CRM_*` prefixes, Smart Processes, `crm.requisite.*` for tax fields, batch.execute 50-cmd limit). Depends on this spec.
2. **`module-crm-amocrm`** — second RU priority (66.6% combined market with Bitrix24). Validates Lead/Deal Schism resolution end-to-end, URL-encoded webhook parser, refresh-token rotation atomicity, no-native-batch sequential queue. Depends on (1) for shared module-skeleton.
3. **`module-crm-hubspot`** — international P1. Validates labeled associations canonical end-to-end, properties-based metadata model, JSON webhook with HMAC v3 verification, batch 100. Reference for international modules.
4. **`module-crm-salesforce`** — enterprise P1. Validates SOQL→`search.simple` translation, Composite API for atomic multi-aggregate creation, Bulk API 2.0 for `SYNC_FULL`, Pub/Sub gRPC streaming as the most divergent webhook transport.
5. **v1.minor: `search.advanced`** — adds raw-vendor-language passthrough RPC + `capabilities.search_tiers: ["advanced"]` declaration. Triggered by first blueprint requiring SOQL/COQL aggregations.
6. **v1.minor: `IMPORT_BULK` and `EXPORT_FILTERED` AsyncJob types** — adds `ImportBulkPayload`, `ExportFilteredPayload` variants to `SubmitJob.body` oneof. Triggered by ≥2 vendor support per type.
7. **v1.minor: schema-mutating custom-field RPCs** — `CreateCustomField`, `UpdateCustomField`, `DeleteCustomField`. Triggered by admin-flow blueprint.
8. **v1.minor: `MoveDealToStage` as separate RPC** — only if `UpdateDeal` proves insufficient (cross-pipeline atomicity edge cases).
9. **`crm-quote/v1`** — separate category. Vendor coverage: SF, Zoho, Bitrix24, HubSpot.
10. **`crm-product/v1`** — separate category. Three-tier pricing model (Salesforce Product2/PricebookEntry/OpportunityLineItem).
11. **`crm-invoice/v1`** — separate category. Vendor coverage: Bitrix24, Zoho. May overlap with future `payments/v1`.
12. **`crm-tag/v1`** — separate category if cross-entity tag CRUD becomes a blueprint demand.

## 17. Open questions

Non-blocking for plans 1–2; must be closed before the first vendor module lands.

- **OQ-CRMV1-1.** Codegen pipeline. Inherit Identity plan 1 decision (`protobufjs-cli` static-module generation, commit generated JS/DTS artifacts). Confirm in plan 1.
- **OQ-CRMV1-2.** Module-side `FieldMapping` storage: in-process LRU (lost on restart, must rebuild via vendor schema introspection on each cold-start), Redis sidecar, or persistent in module's `state-manager.ts`. Decision in Bitrix24 brainstorm; the contract only mandates that `ListCustomFieldDefinitions` returns a consistent set across calls.
- **OQ-CRMV1-3.** `Owner` lookup strategy: by email, by vendor_id, or canonical_id assigned by the module on first encounter. Tied to FieldMapping persistence model. Promotion of `Owner` to a queryable aggregate (with `GetOwner` / `ListOwners` RPCs) is a v1.minor candidate when blueprint demand surfaces.
- **OQ-CRMV1-4.** Multi-instance/multi-portal support (one module backing N tenant Bitrix24 portals): `tenant_id` already in `_common.CommandContext` covers logical tenant routing; physical `vendor_subdomain`/`vendor_instance_url` may need explicit context field or per-tenant module config. Decision in Bitrix24 brainstorm; not a v1 contract change.
- **OQ-CRMV1-5.** Dedup semantics for `Create*` RPCs: should v1.minor add `duplicate_check: "skip"|"update"|"error"` to `Create*Request`, or keep vendor-native behaviour? Native HubSpot dedup (silent update) versus Pipedrive (no dedup, will create duplicate) leak through to consumers today. Tracked for v1.minor.

## 18. References

- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — directory layout, capability-based UNION conformance model, governance rule, `module.json` schema, conformance framework split.
- `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` — sibling spec by the same template; defines `_common/v1/` shared primitives reused unchanged here.
- `docs/superpowers/specs/done/2026-04-26-ai-llm-canonical-contract-design.md` — sibling spec; introduced the `AsyncJob` aggregate pattern and `oneof body` extensibility for future job types, both reused here.
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — module pattern (wrapper, no choreography), gRPC surface, webhook receiver, P-1/P-2/P-3 primitives.
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` — CloudEvents 1.0 envelope and `type` namespacing convention.
- `CLAUDE.md` — error-code format, single-writer event log, Result<T> rule, branded `Validated*` types, doc-touch obligation, "topic names carry no version suffix".
- `AGENTS.md` — repository layout (§3), how-to recipes (§6), glossary (§10) — all need updates per plan 1.
- `.tmp/canonical_crm_api.agent.final.md` — vendor research across 9 CRM platforms (1605 lines) used as input. Not committed; consulted for entity convergence, Lead/Deal Schism analysis, custom-field hash fragmentation, webhook payload diversity, rate-limit model archaeology, conformance-tier rationale. Notable deviations from research recorded: scope reduced to 5 business aggregates (vs 13), conformance unified under capability-based UNION (vs Level 1/2/3), `Prospect` folded into `Deal.qualification` (vs separate aggregate), `Quote`/`Invoice`/`Product` deferred to separate categories (vs in-CRM-v1).
- `MEMORY.md / rntme_orchestration_only` — cross-service async via Zeebe only; choreography forbidden.
- `MEMORY.md / project_pre_stable_stage` — pre-revenue; backward-compat shims dropped; renames/removals free.
- `MEMORY.md / rntme_topic_no_version_suffix` — Kafka topic without `.v1`.
- `MEMORY.md / platform_domains` — RU regulatory context (152-FZ data-residency drives Bitrix24/amoCRM RU P0 prioritisation).
