# Storage category

Module contributor entry point for implementations of the Storage canonical contract `@rntme/contracts-storage-v1`.

## Vendor module shape

Each vendor lives at `modules/storage/<vendor>/` and ships:

- A handler implementation against the `StorageModule` gRPC service (7 RPCs).
- A pending/idempotency store. SQLite is recommended; the project storage target is SQLite/Turso.
- A conditional provisioner: `auto` reconciles bucket, CORS, lifecycle, and scoped IAM credentials when admin credentials are supplied; `manual` validates an existing bucket with pre-supplied scoped credentials.
- React UI components (`<UploadDropzone/>`, `<FileList/>`, `<FilePreview/>`) bound to `storage.json` route declarations.
- A `module.json` manifest declaring capabilities such as `vendors`, `s3_compatible_backends`, `rpcs`, `events`, `max_object_size_bytes`, and `supports_multipart`.
- Conformance scenarios passing under mock-vendor and live-sandbox modes when the runner lands.

The shared conformance UNION lives at `modules/storage/conformance/`.

## Vendors

- `s3` - `modules/storage/s3/`. Single module covering AWS S3, Cloudflare R2, MinIO, rustfs, DigitalOcean Spaces, Backblaze B2, Tigris, and other S3-compatible backends through env mapping.

## Capability decision tree

| Capability | Decision |
|---|---|
| `vendors[]` | Always one element: the routing prefix. For S3-compatible storage this is `["s3"]`; backend-specific details are surfaced via `s3_compatible_backends[]`. |
| `s3_compatible_backends[]` | Optional, S3-only. Enumerates concrete backends tested by the module, such as `["aws-s3", "cloudflare-r2", "minio"]`. |
| `rpcs[]` | Subset of the 7 canonical RPCs. v1 modules should implement all 7. |
| `events[]` | Subset of the 6 canonical events. Only emit events the module actually publishes. |
| `max_object_size_bytes` | Backend's single-PUT limit. AWS S3 is 5 GB; multipart raises this in a future module version. |
| `presign_ttl_default_sec` | Default TTL for presigned URLs. Recommended value is 900 seconds. |
| `supports_multipart` | `true` only when the module wires multipart upload support. v1 is `false`. |

## Backend capability matrix

| Backend | Bucket create | CORS | Lifecycle | IAM scoped creds | Notes |
|---|---|---|---|---|---|
| AWS S3 | yes | yes | yes | yes | full auto support |
| Cloudflare R2 | yes | yes | yes | no | no IAM user step; supply scoped account token |
| MinIO | yes | yes | yes | yes | full auto support |
| rustfs | best-effort | best-effort | best-effort | n/a | use `manual` unless admin API is verified |
| DigitalOcean Spaces, Backblaze B2, Tigris | yes | yes | varies | varies | default to `manual` if unsure |

Provisioned RustFS on Dokploy is target-level infrastructure, not a
module-owned provisioner side effect. It creates one RustFS instance and one
bucket per project environment, then wires `@rntme/storage-s3` through
S3-compatible env.

## Where to look first

- `modules/storage/conformance/src/scenarios/` - scenario inventory per canonical RPC.
- `packages/contracts/storage/v1/proto/storage.proto` - contract implemented by vendors.
- `packages/contracts/storage/v1/error-codes.json` - runtime error codes vendors map to.

## Specs

- `docs/history/specs/active-rationale/2026-05-06-storage-s3-module-design.md` - design.
- `docs/history/specs/historical/2026-04-26-modules-monorepo-structure-design.md` - module pattern and UNION conformance.
