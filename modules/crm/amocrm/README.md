# @rntme/crm-amocrm

amoCRM implementation of the rntme CRM canonical contract (`@rntme/contracts-crm-v1`).

## Capabilities

This module implements the **Core** preset of the CRM canonical contract:

- Contact, Company, Deal CRUD + simple search
- Activity (Tasks) and Note create/read
- Pipeline and Stage read-only listing
- Custom field definitions listing
- Flat associations (no labels)
- Async jobs (SyncDelta, SubmitJob, etc.) — **unimplemented**

See `module.json` for the full capability manifest.

## Setup

```typescript
import { createAmoCrmAdapter, createAmoCrmModule, createAmoCrmWebhookReceiver } from '@rntme/crm-amocrm';

const adapter = createAmoCrmAdapter({
  subdomain: 'your-subdomain',
  auth: {
    access_token: 'your-access-token',
    refresh_token: 'your-refresh-token',
  },
});

const module = createAmoCrmModule({ adapter });
```

## Webhooks

amoCRM sends webhooks as `application/x-www-form-urlencoded` with bracket-notation nested keys (`leads[update][0][id]`). The receiver decodes this format and translates events into canonical CloudEvents.

```typescript
const receiver = createAmoCrmWebhookReceiver();

const events = await receiver.receive({
  payload: 'leads[update][0][id]=42&leads[update][0][name]=Acme+Q4',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
});
```

## Error mapping

| amoCRM error | Canonical code |
|---|---|
| HTTP 429 | `CRM_VENDOR_RATE_LIMITED` |
| HTTP 404 | `CRM_CONSISTENCY_ENTITY_NOT_FOUND` |
| HTTP 401/403 | `CRM_VENDOR_UNAUTHORIZED` |
| HTTP 400/422 | `CRM_STRUCTURAL_MISSING_REQUIRED_FIELD` |
| HTTP 409 | `CRM_CONSISTENCY_DUPLICATE` |
| HTTP 5xx | `CRM_VENDOR_UNAVAILABLE` |

## Known limitations

- **Labeled associations**: Not supported by amoCRM. `CreateAssociation` with a non-empty `label` returns `CRM_CONSISTENCY_LABELS_NOT_SUPPORTED`.
- **Bulk operations**: `bulk_operations.max_size: 1` — amoCRM has no native batch API.
- **Hard deletes**: Soft delete is preferred; hard delete is supported where the SDK allows it.
- **Async jobs**: `SyncDelta`, `SubmitJob`, `GetJob`, `CancelJob`, `ListJobs` return `CRM_VENDOR_UNIMPLEMENTED` in this version.
- **Activity update/delete**: amoCRM tasks API does not support update/delete through the SDK in the same way; returned as `UNIMPLEMENTED`.
- **Note delete**: Not supported by amoCRM SDK; returned as `UNIMPLEMENTED`.

## Testing

```bash
pnpm test
pnpm test:conformance:mock
pnpm run typecheck
pnpm run lint
```

## License

Private — part of the rntme monorepo.
