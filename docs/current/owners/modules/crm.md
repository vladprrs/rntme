# CRM category — module contributor entry point

This directory hosts vendor implementations of the CRM canonical contract `@rntme/contracts-crm-v1`. Each vendor lives at `modules/crm/<vendor>/` and ships:

- A handler implementation against the `CrmModule` gRPC service.
- An idempotency dedup-store (Redis / in-memory / Postgres — chosen by the vendor module; ≥24h TTL). Required because most CRM vendors do not provide native idempotency on create/update endpoints, so replays would create duplicate records.
- A webhook receiver that verifies signatures (HubSpot HMAC-SHA256 v3, Zoho `X-Zoho-Signature`), parses the vendor format (JSON for most; URL-encoded form data for amoCRM), dedupes, and emits canonical CloudEvents.
- A `module.json` manifest declaring `capabilities[]` (vendors, entities, rpcs, events, search_tiers, labeled_associations, bulk_operations.max_size, async_job_types, webhook_format, webhook_retry_policy).
- Conformance scenarios passing under both mock-vendor and live-sandbox modes.

The shared conformance suite lives at `modules/crm/conformance/` and is consumed by every vendor module via `pnpm test:conformance:mock` and `pnpm test:conformance:live` (when the framework lands).

## Vendors landed here

| Vendor | Package | Notes |
|---|---|---|
| Bitrix24 | `@rntme/crm-bitrix24` (`modules/crm/bitrix24`) | Uses `@bitrix24/b24jssdk`; supports the CRM v1 canonical surface with documented partial behavior for labeled associations, idempotency, webhook retry, and best-effort sync. |

## Recommended capability presets (documentation-only — NOT validated tiers)

These presets are reading aids for module authors and blueprint authors. Conformance enforces only the capability-based UNION model from modules-monorepo §7.3 — no Level 1/2/3 gates.

| Preset | Implies |
| --- | --- |
| **Core** (typical for `module-crm-amocrm`, `module-crm-pipedrive` baseline) | Contact + Company + Deal CRUD + simple search + flat associations + read-only Pipeline |
| **Full** (typical for `module-crm-hubspot`, `module-crm-bitrix24`, `module-crm-zoho`) | Core + Activity + Note + labeled associations + custom field definitions + webhook signature verification |
| **Extended** (typical for `module-crm-salesforce`, `module-crm-zoho-enterprise`) | Full + SyncFull through AsyncJob + cross-pipeline UpdateDeal + Optimistic Lock |

## Capability decision tree (for module authors)

When you scaffold a new CRM vendor module, fill out `module.json#capabilities[]` based on what the vendor supports natively:

| Capability | Decision |
| --- | --- |
| `vendors[]` | Single SaaS module: 1 entry. Multi-CRM gateway: list every upstream you route to. |
| `entities[]` | Subset of `["contact", "company", "deal", "activity", "note"]`. All five vendors covered support all five entities; this field exists for future custom-entity-only modules. |
| `rpcs[]` | Subset of the 34 canonical RPCs. Unclaimed RPCs return `UNIMPLEMENTED` (anti-conformance enforces this). |
| `events[]` | Subset of the 21 canonical events. Only emit events you actually publish. |
| `search_tiers[]` | v1 ships only `["simple"]`. Modules may declare `["simple"]`; `advanced`/`fulltext` are v1.minor extensions. |
| `labeled_associations` | `true` only if vendor has native typed-edge support (HubSpot Associations API v4, SF junction-objects with Role, Zoho Contact Roles). `false` for Bitrix24, amoCRM, Pipedrive — they emulate by storing label in own state. |
| `bulk_operations.max_size` | Vendor batch cap: Bitrix24=50 (`batch.execute`), HubSpot=100 (`/batch/{action}`), Salesforce=200 (composite/sobjects) or 150_000_000 (Bulk API 2.0 jobs), Zoho=100 sync / 25000 bulk write, Pipedrive=1 (no native batch — module sequentially calls). |
| `async_job_types[]` | v1 ships only `["SYNC_FULL"]`. Vendors with Bulk API (SF Bulk 2.0, HubSpot CRM Export, Zoho Bulk Read) populate this; Pipedrive sequential-paginates and may declare `[]`. |
| `webhook_format` | `"json"` for HubSpot / Bitrix24 / Pipedrive / Zoho. `"urlencoded"` for amoCRM (unique). Salesforce uses `"grpc"` (CDC Pub/Sub) — but v1 of the contract treats Pub/Sub as out-of-band signal and only labels HTTP webhook formats here. |
| `webhook_retry_policy` | `"none"` for Bitrix24 (no retries — pulls via `event.offline.get` instead). `"exponential_24h_10retries"` for HubSpot. `"exponential_3retries_<intervals>"` for Pipedrive (3, 30, 150s). `"exponential_3retries"` for Zoho. `"undocumented"` for amoCRM. |

## Specs

- `docs/history/specs/historical/2026-04-27-crm-canonical-contract-design.md` — canonical contract design.
- `docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md` — module pattern, capability UNION conformance.

## Where to look first

- `modules/crm/conformance/src/scenarios/` — full list of scenarios per RPC (one file per canonical RPC, 34 total).
- `packages/contracts/crm/v1/proto/crm.proto` — the contract you implement.
- `packages/contracts/crm/v1/error-codes.json` — error codes you map vendor errors to. Pay attention to `CRM_VENDOR_RATE_LIMITED` — it normalises Bitrix24's HTTP 200 + body `{"error":"QUERY_LIMIT_EXCEEDED"}` quirk into the same canonical signal as HTTP 429 from other vendors.
