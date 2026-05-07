# @rntme/crm-bitrix24

Bitrix24 implementation of the CRM canonical contract `@rntme/contracts-crm-v1`.

The module uses the official Bitrix24 TypeScript SDK package `@bitrix24/b24jssdk` as its primary vendor integration layer. Server-side auth uses `B24Hook.fromWebhookUrl(...)` when `BITRIX24_WEBHOOK_URL` is present, or `new B24Hook({ b24Url, userId, secret })` from explicit options / `BITRIX24_URL`, `BITRIX24_USER_ID`, `BITRIX24_SECRET`.

## Supported surface

- Contacts, companies, deals, activities, and notes via Bitrix24 CRM SDK calls.
- Flat associations through Bitrix24 CRM relation fields (`COMPANY_ID`, `CONTACT_ID`, `CONTACT_IDS`).
- Pipeline/stage reads via category and status list methods.
- Read-only custom field definitions via `*.userfield.list`.
- Owners/users mapping from Bitrix24 user records for callers that need CRM-local owner refs.
- Pagination/list metadata for canonical list responses.
- Error mapping for rate limits, auth/access errors, not found, invalid request, and vendor unavailability.
- `SyncDelta` best-effort pulls from Bitrix24 date fields.
- `SYNC_FULL` async jobs as module-local paginated SDK list jobs.

Canonical CloudEvents are intentionally not claimed yet. Bitrix24 webhook transport, dedupe, and event translation require a follow-up receiver before this module can advertise event capabilities.

## Limitations

- Bitrix24 does not support native labeled CRM associations. `CreateAssociation` rejects non-empty labels with `CRM_CONSISTENCY_LABELS_NOT_SUPPORTED`.
- Bitrix24 CRM write APIs do not accept rntme idempotency keys. Use rntme-side retry/dedupe controls for replay safety.
- Bitrix24 webhooks do not provide a retry guarantee. Use `SyncDelta` / `SyncFull` to reconcile missed signals.
- `SyncDelta` is not a complete audit log; it is a best-effort pull over vendor date fields.
- Full sync job state is in-memory in this package scaffold. Production hosting should back it with durable module state.

## Example

```ts
import { createBitrix24CrmModule } from '@rntme/crm-bitrix24';

const crm = createBitrix24CrmModule({
  adapterOptions: {
    webhookUrl: process.env.BITRIX24_WEBHOOK_URL,
  },
});

const contacts = await crm.ListContacts({ email: 'buyer@example.com' });
```

## Live smoke

Set one of:

- `BITRIX24_WEBHOOK_URL`
- or `BITRIX24_URL`, `BITRIX24_USER_ID`, `BITRIX24_SECRET`

Then run the live smoke command:

```bash
pnpm -F @rntme/crm-bitrix24 run test:smoke:live
```

Without credentials the smoke test records a credential-blocked pass. With credentials it calls `ListContacts({ limit: 1 })` against the real portal through `@bitrix24/b24jssdk`.

The normal committed test suite uses mocked SDK responses and does not require network credentials. No Bitrix24 credentials were present in this agent environment, so live smoke was credential-blocked for RNT-195.

## Commands

- `pnpm -F @rntme/crm-bitrix24 run build`
- `pnpm -F @rntme/crm-bitrix24 run test`
- `pnpm -F @rntme/crm-bitrix24 run typecheck`
- `pnpm -F @rntme/crm-bitrix24 run lint`
- `pnpm -F @rntme/crm-bitrix24 run test:conformance:mock`
- `pnpm -F @rntme/crm-bitrix24 run test:smoke:live`

## Docs used

- Context7 `/bitrix24/b24jssdk`: `B24Hook.fromWebhookUrl`, `actions.v2.call.make`, `actions.v2.batchByChunk.make`, list helpers.
- Context7 `/bitrix24/b24restdocs`: CRM method names and field shapes for contacts, companies, deals, activities, timeline comments, statuses, user fields, and Bitrix24 error responses.
