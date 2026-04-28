# @rntme/crm-amocrm

amoCRM implementation of the rntme CRM canonical contract (`@rntme/contracts-crm-v1`).

## SDK

Uses `@shevernitskiy/amo` as the primary vendor integration layer.

## Capabilities

| Capability | Value |
|---|---|
| Vendors | `amocrm`, `kommo` |
| Entities | `contact`, `company`, `deal`, `activity`, `note` |
| Search tiers | `simple` |
| Labeled associations | `false` |
| Bulk operations max | `1` (no native batch) |
| Async job types | `SYNC_FULL` |
| Webhook format | `urlencoded` |
| Webhook retry | `undocumented` |

## Entity mappings

| amoCRM | Canonical |
|---|---|
| Contact | Contact |
| Company | Company |
| Lead | Deal (qualification=QUALIFIED) |
| Task | Activity (type=TASK) |
| Note | Note |
| Pipeline | Pipeline |
| Status | Stage |
| User | Owner |

## Auth

Requires OAuth2 credentials:

```typescript
import { createAmoCrmAdapter } from '@rntme/crm-amocrm';

const adapter = createAmoCrmAdapter({
  config: {
    subdomain: 'mycompany.amocrm.ru',
    auth: {
      client_id: '...',
      client_secret: '...',
      redirect_uri: 'https://app.example.com/callback',
      access_token: '...',
      refresh_token: '...',
    },
  },
  onToken: (token) => {
    // persist refreshed token
  },
});
```

## Known limitations

- No native labeled associations; links are unlabeled.
- No native batch API; bulk operations execute sequentially (max_size=1).
- `SyncDelta`, `SubmitJob`, `GetJob`, `CancelJob`, `ListJobs` are declared but not yet implemented.
- Notes are entity-scoped in amoCRM; `DeleteNote` assumes `leads` scope.
- Custom field values map to `metadata.public` by `field_code`.

## Tests

```bash
pnpm -F @rntme/crm-amocrm run build
pnpm -F @rntme/crm-amocrm run test
pnpm -F @rntme/crm-amocrm run typecheck
pnpm -F @rntme/crm-amocrm run lint
```
