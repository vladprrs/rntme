# @rntme/contracts-crm-v1

Canonical CRM contract v1: `service CrmModule`, Contact, Company, Deal, Activity, Note, AsyncJob, helper/read models, twenty-one CloudEvents payloads, and `CRM_<LAYER>_<KIND>` error codes.

## Layout

- `proto/crm.proto` - enums, helper/read models, aggregates, RPCs, request/response messages.
- `proto/crm-events.proto` - event payloads compiled through the `crm-events` import chain.
- `scripts/gen.mjs` - Identity-style `proto-deps/` symlink staging, `pbjs`, `pbts`, and ESM import patch.
- `src/proto.gen.{js,d.ts}` - generated and committed.
- `src/error-codes.ts` - typed view of `error-codes.json`.
- `src/index.ts` - `proto`, error codes, and direct exports for common CRM types.
- `test/` - entity/helper/event round trips, service shape drift, error-code drift.

## Usage

```ts
import { Deal, DealStatus, proto, errorCodes } from '@rntme/contracts-crm-v1';

const deal = Deal.create({
  name: 'Enterprise rollout',
  status: DealStatus.DEAL_STATUS_OPEN,
});
const buf = Deal.encode(deal).finish();

const crm = proto.rntme.contracts.crm.v1;
const request = crm.ListDealsRequest.create({ owner_canonical_id: 'owner-1' });
console.log(buf.length, request.owner_canonical_id, errorCodes.vendor);
```

## Commands

- `pnpm run proto:gen`
- `pnpm run build`
- `pnpm run test`
- `pnpm run lint`
- `pnpm run typecheck`

## Invariants

- `Deal.qualification` resolves the Lead/Deal naming split; no separate Lead aggregate exists in v1.
- `Association` is a first-class labeled edge. Modules without native label support reject non-empty labels with `CRM_CONSISTENCY_LABELS_NOT_SUPPORTED`.
- `SyncDelta` is unary and cursor-based. Full sync uses `SubmitJob` with `SyncFullPayload`.
- `Owner` is a CRM-local user reference, separate from Identity `User`.
- Custom fields are data-plane metadata plus read-only `CustomFieldDefinition`; schema mutation is out of scope.

## Spec

`docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md`
