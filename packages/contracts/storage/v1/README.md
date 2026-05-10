# `@rntme/contracts-storage-v1` - Canonical Storage contract v1

The protobuf shapes, generated TypeScript bindings, and `STORAGE_<LAYER>_<KIND>` error codes for the storage category. Every vendor module (`@rntme/storage-s3`, future `@rntme/storage-azure-blob`, ...) implements this contract.

## File map

```text
packages/contracts/storage/v1/
├── proto/
│   ├── storage.proto          # StorageModule service + messages
│   └── storage-events.proto   # File* CloudEvent payloads
├── scripts/gen.mjs            # pbjs/pbts codegen
├── src/
│   ├── proto.gen.{js,d.ts}    # generated bindings (do not edit)
│   ├── error-codes.ts         # ErrorCode union, isErrorCode, layerOf
│   └── index.ts               # public surface
├── test/                      # drift pins
├── error-codes.json           # single source for STORAGE_* codes
└── README.md
```

## Quick start

```typescript
import { proto, isErrorCode } from '@rntme/contracts-storage-v1';

const { PrepareUploadRequest } = proto.rntme.contracts.storage.v1;

const req = PrepareUploadRequest.create({
  context: { idempotency_key: 'upload_01J', correlation_id: 'corr_01' },
  route_id: 'ticket-attachments',
  entity_id: 'ticket_123',
  filename: 'screenshot.png',
  content_type: 'image/png',
  declared_size: 1024 * 64,
});
const bytes = PrepareUploadRequest.encode(req).finish();

if (isErrorCode(maybeCode)) {
  // The code is one of STORAGE_<LAYER>_<KIND>.
}
```

## API

### Service surface - 7 RPCs

`PrepareUpload`, `CommitUpload`, `AbortUpload`, `GetFile`, `ListFiles`, `GetDownloadUrl`, `DeleteFile`. See `proto/storage.proto`.

### Events - 6 CloudEvent payloads

`FileUploadInitiated`, `FileUploadCommitted`, `FileUploadAborted`, `FileOrphaned`, `FileDeleted`, `FileLifecycleSwept`. Topic name follows `rntme.<svc>.file` (no version suffix; per repo non-obvious conventions).

### Error code layers

`structural`, `references`, `consistency`, `auth`, `vendor`, `provisioner`. Total: 28 codes.

## Invariants & gotchas

- `PrepareUpload` is idempotent on `(route_id, entity_id, context.idempotency_key)` for 24h. Repeats return the same `file_id` and a freshly issued presigned URL (presign URLs are short-lived; the keyed record persists, the externally-issued artifact regenerates).
- `CommitUpload`, `AbortUpload`, `DeleteFile` are idempotent on `file_id`.
- A module that lists `PrepareUpload` MUST also implement `CommitUpload` (presign-without-commit is forbidden; the File aggregate would never advance past PENDING).
- All status enums follow the rntme convention: `<TYPE>_UNSPECIFIED = 0`, `<TYPE>_VENDOR_SPECIFIC = 100`.

## Out of scope (this package)

- Vendor implementations - see `modules/storage/<vendor>/`.
- Per-service authoring (`storage.json`) - see `@rntme/blueprint`.
- Conformance scenarios - see `modules/storage/conformance/`.

## Where to look first

- Adding a new RPC -> `proto/storage.proto` + regenerate via `bun run proto:gen`, then update `test/service-shape.test.ts`.
- Adding a new error code -> `error-codes.json`, then update the count assertion in `test/error-codes.test.ts`.
- Wiring a vendor -> read `modules/storage/s3/` for the canonical implementation pattern.

## Specs

- `docs/history/specs/active-rationale/2026-05-06-storage-s3-module-design.md` - design.
- `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md` - pattern this contract mirrors.
- `docs/history/specs/historical/2026-04-17-cloudevents-envelope-design.md` - envelope shape used by all six events.
