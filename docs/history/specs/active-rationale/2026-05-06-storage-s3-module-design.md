> Status: active-rationale.
> Date: 2026-05-06.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Storage category + S3 vendor module — design

**Status:** design
**Author:** brainstorm 2026-05-06
**Related:**
- `docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md` — canonical contract pattern this spec mirrors (category-shaped contract package + first vendor module).
- `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md` — second worked example of a category contract; storage follows the same shape.
- `docs/history/specs/historical/2026-05-06-ai-llm-openrouter-module-design.md` — first vendor module against `ai-llm/v1`; the run/Dockerfile/idempotency pattern this module reuses, with bun substituted for node.
- `modules/ai-llm/openrouter/README.md` line 75 — explicitly anticipates this brainstorm: *"URL-based file inputs will become useful when an S3-style file storage module lands (separate brainstorm)."*
- `rntme_provisioner_resolver_gap` memory — open issue with provisioner resolution from `platform-http`; this module's provisioner entry must work within whatever resolution scheme exists when implementation lands.
- `project_pre_stable_stage` memory — pre-revenue, no users; no backwards-compat shims.

**Implementation locations:**
- New canonical contract — `packages/contracts/storage/v1/` (workspace package `@rntme/contracts-storage-v1`).
- New category root — `modules/storage/` (`README.md` + `conformance/` workspace package).
- New vendor module — `modules/storage/s3/` (workspace package `@rntme/storage-s3`).
- New per-service artifact validator — extension to `@rntme/blueprint` for `services/<svc>/storage.json`.
- New event topic — `rntme.<svc>.file` (where `<svc>` is the service hosting the storage module).
- Implementation plan for this spec — `docs/history/plans/historical/storage-s3-module/` (created by writing-plans after this spec is approved).

## 1. Problem

`@rntme/blueprint` validated project blueprints have no native way to attach files to PDM aggregates. A workflow app that wants user-supplied attachments (tickets with screenshots, candidate records with CVs, contract requests with PDFs) cannot express "this entity has files" without either:
1. Inventing an out-of-band image-host integration in the UI artifact (manual XHR to a third-party uploader, then inlining a URL into a string field), or
2. Storing file bytes inline in events as base64, which makes events unbounded in size and breaks the single-writer event log's small-event assumption.

This is the gap that `modules/ai-llm/openrouter/README.md` flagged: PDF/image inputs to LLMs work fine inline today, but as soon as files exceed a few MB or need to live longer than a single event payload, blueprints have nowhere to put them.

A vendor-neutral file storage module also unblocks three concrete demo scenarios queued behind it: ticket attachments in the planned helpdesk demo, document storage for the cv-extract demo (currently inline-base64), and signed contract storage for any approval-flow demo.

## 2. Goal

Land a working S3-compatible file storage module sufficient to power workflow-app attachments end-to-end, plus the canonical category contract and per-service artifact that future storage vendors slot into. The module ships with type-safe React UI components that let blueprint authors write a single declaration and get a working drag-and-drop upload component bound to a PDM aggregate.

**In scope:**

- New canonical contract `@rntme/contracts-storage-v1` with proto definitions for the `StorageModule` service, six events, and the `STORAGE_*` error code namespace.
- New per-service artifact `services/<svc>/storage.json` declaring upload routes, owner-binding to PDM aggregates, validation rules (size/mime/count), and auth requirements.
- New `@rntme/blueprint` validator for `storage.json` with the four standard layers (parse → structural → references → consistency), including cross-artifact validation against PDM aggregates.
- New vendor module `modules/storage/s3/` (`@rntme/storage-s3`) implementing `StorageModule.PrepareUpload`, `CommitUpload`, `ListFiles`, `GetDownloadUrl`, `DeleteFile`. Two RPCs (`AbortUpload`, `GetFile`) round out the surface.
- Server runtime built on **bun** (first bun module in the repository), using `Bun.s3` for presigning + S3 operations and `bun:sqlite` for the idempotency / pending-upload store.
- Conditional provisioner (mode `auto` | `manual`) running on **node** in the `platform-http` deploy executor context, using `@aws-sdk/client-s3` and `@aws-sdk/client-iam` to reconcile bucket existence, CORS rules, lifecycle policies, and scoped IAM credentials when admin credentials are supplied.
- Client-side UI components shipped as `module.json#client.components`: `<UploadDropzone routeId entityId/>`, `<FileList routeId entityId/>`, `<FilePreview fileId/>`. Built on `@uppy/react` + `@uppy/aws-s3` with thin typed wrappers tied to `storage.json` route ids.
- Operations registry entries `storage.upload`, `storage.list`, `storage.delete`, `storage.getDownloadUrl` callable from any UI component via `useOperation('storage.<name>')`.
- File aggregate with event-sourced lifecycle: `FileUploadInitiated` → `FileUploadCommitted` → `FileDeleted`, plus `FileOrphaned` for stale-pending cleanup.
- Conformance UNION generator (`modules/storage/conformance/`) following the AI/LLM and Identity precedents; no scenario implementations yet (runner does not exist for any category).
- Documentation touches per CLAUDE.md §11 — see §13.

**Explicitly out of scope:**

- Resumable / chunked uploads via tus protocol — Uppy's `@uppy/aws-s3-multipart` plugin handles browser-side multipart against S3 directly; tus protocol via `@uppy/tus` is a v2 backlog item.
- Auto-join of files into QSM projections — explicitly rejected in brainstorm round 3 (option A "two-call"); UI components do their own `storage.list` call. Graph IR compiler is not touched.
- Server-side file processing (image resize, thumbnails, virus scan, OCR) — modular extensions for future vendor sub-modules; out of scope for v1.
- Server-side proxying of file bytes — explicitly rejected; uploads go direct-to-S3 via presigned URLs, downloads go direct-from-S3 via presigned URLs.
- Cross-region replication, multi-bucket sharding, hot/cold tier policies — single-bucket, single-region per service in v1.
- Per-user storage quotas — backlog (`STORAGE_VENDOR_QUOTA_EXCEEDED` is reserved in error codes for future use).
- Audio / video streaming with byte-range requests — Uppy/AWS S3 native byte-range download works; no special server support.
- Webhook-based commit (S3 bucket notifications → our endpoint) — backlog; v1 uses explicit `CommitUpload` from the client after upload completes.
- Content-addressed deduplication (sha256-keyed object storage) — backlog; v1 uses uuid-keyed object storage. The sha256 is computed and stored as metadata for future dedup but doesn't drive object-key generation.
- File versioning at the storage layer — single object per `fileId`; PDM-level versioning of the *referencing* aggregate is unaffected.
- Other vendor modules (e.g. `storage-azure-blob`, `storage-gcs`) — out of scope; the contract supports them but no implementation lands.

## 3. Approach

We chose **C+** out of the three approaches discussed in the brainstorm round 2: storage as a self-contained grain of the blueprint with explicit declarative owner-binding to PDM, but without intruding on PDM's schema. The "+" denotes three additions that close the perceived gaps in the unmodified C approach:

1. **Per-service `storage.json` artifact** with route declarations carrying `owner.aggregate` cross-references to PDM. PDM remains untouched; storage validates its references against PDM during the references-layer validation pass.
2. **Operations Registry entries** (`storage.upload` etc.) so UI components call storage RPCs through the same canonical mechanism as any other command/query, not via ad-hoc fetch calls to a presigned-URL endpoint.
3. **Type-safe routeId binding** in client-side components: `<UploadDropzone routeId="ticket-attachments" .../>` is compile-time validated against the route declarations in `storage.json` during UI artifact validation. A typo in `routeId` is caught before deploy.

This keeps PDM as the single source of truth for the domain model while letting storage live as a first-class authoring surface alongside workflows, QSM, and Graph IR. The pattern mirrors how `workflows.json` references PDM aggregates without modifying them.

The brainstorm explicitly chose **two-call** (option A in round 3) for QSM integration: a UI flow that needs both a ticket and its files makes two operation calls — `getTicket(id)` plus `storage.list({ routeId, entityId: id })`. The Graph IR compiler is not touched, the QSM projection compiler is not touched, no virtual fields are introduced. The `<FileList routeId entityId/>` component encapsulates the second call so it doesn't show up in blueprint authoring.

The brainstorm explicitly chose **one module per category** for storage (option in round 4-style decision): `@rntme/storage-s3` covers AWS S3, Cloudflare R2, MinIO, rustfs, DigitalOcean Spaces, Backblaze B2, Tigris, and any other S3-compatible backend through env mapping (`endpoint`, `region`, `accessKeyId`, `secretAccessKey`, `bucket`, `forcePathStyle`). This differs from `identity/`, where Auth0/Clerk/WorkOS are separate modules because their APIs differ; S3-compatible APIs are uniform.

The brainstorm explicitly chose **conditional provisioner** (option C in round 4): when admin credentials are supplied, the provisioner reconciles bucket + CORS + lifecycle + scoped IAM; when scoped credentials with a pre-existing bucket are supplied, the provisioner validates and emits no changes. Both paths return the same env vars to the runtime.

The brainstorm explicitly chose **Uppy** (option X2 in round 5b) for client UI: the server is hand-written on `Bun.s3`, the UI is `@uppy/react` + `@uppy/aws-s3` wrapped in our typed components. Uppy's "BYO presign" architecture (a `getUploadParameters` callback to any endpoint) maps cleanly to our Operations Registry pattern; their type system is not coupled to ours.

The brainstorm explicitly chose **bun** as the server runtime (round 6): `Bun.s3` is native, zero AWS-SDK dependency tree on the hot path, native `bun:sqlite` for the idempotency store. The provisioner entry stays on **node** (running in `platform-http`'s node process) and uses `@aws-sdk/client-s3` + `@aws-sdk/client-iam` for bucket administration APIs that `Bun.s3` doesn't cover. Bun's `node:http2` stabilization means `@grpc/grpc-js` works in bun, so the gRPC transport stays consistent with the rest of the repository (option T1 in round 6).

## 4. Architecture overview

### 4.1 Three new packages

```
packages/contracts/storage/v1/         @rntme/contracts-storage-v1
├── proto/
│   ├── storage.proto                  StorageModule service + messages
│   └── storage-events.proto           File* CloudEvent payloads
├── src/
│   ├── error-codes.ts                 STORAGE_* matrix
│   ├── proto.gen.ts                   generated bindings
│   └── index.ts
└── error-codes.json                   single source for codes

modules/storage/                       category root
├── README.md                          category overview, vendor decision tree
└── conformance/                       UNION generator (workspace pkg)

modules/storage/s3/                    @rntme/storage-s3
├── module.json                        manifest with capabilities/client/provisioner
├── Dockerfile                         FROM oven/bun:1-alpine
├── package.json                       type:module, engines.bun >=1.2
├── tsconfig.json                      server runtime build (bun target)
├── tsconfig.provisioner.json          provisioner build (node target)
├── tsconfig.client.json               client build (browser target)
├── src/
│   ├── bin/server.ts                  bun entry — gRPC listen
│   ├── server.ts                      gRPC server factory
│   ├── handler.ts                     RPCs implementation (uses Bun.s3)
│   ├── s3-client.ts                   Bun.S3Client wrapper, env-mapped
│   ├── route-resolver.ts              reads storage.json, validates rules
│   ├── pending-store.ts               bun:sqlite — pending uploads, idempotency
│   ├── error-mapper.ts                S3 errors → STORAGE_VENDOR_*
│   ├── errors.ts                      module-local error type
│   ├── client/
│   │   ├── index.ts                   client.entry — boots browser side
│   │   ├── upload-dropzone.tsx        <UploadDropzone routeId entityId/>
│   │   ├── file-list.tsx              <FileList routeId entityId/>
│   │   ├── file-preview.tsx           <FilePreview fileId/>
│   │   └── operations.ts              registers storage.upload/list/delete/getDownloadUrl
│   └── provisioner/
│       └── entry.ts                   node entry — uses @aws-sdk
└── test/
    ├── unit/
    ├── integration/                   against local rustfs container
    └── conformance-fixtures/

# Per-service artifact (not a new package; lives under each service's blueprint dir)
demo/<some>-blueprint/services/<svc>/storage.json
```

### 4.2 Two runtimes in one module

The storage module uniquely splits into **two execution contexts** that ship in the same workspace package:

| Surface | Runtime | Container | Build target | Dependencies |
|---|---|---|---|---|
| `dist/bin/server.js` | bun | `oven/bun:1-alpine` (target server) | bun ESM | `Bun.s3` (built-in), `bun:sqlite` (built-in), `@grpc/grpc-js`, `@rntme/contracts-storage-v1`, `@rntme/contracts-common-v1` |
| `dist/provisioner.entry.js` | node | n/a (loaded by `platform-http` deploy executor process) | node ESM | `@aws-sdk/client-s3`, `@aws-sdk/client-iam`, `@rntme/contracts-provisioner-v1` |
| `dist/client/index.js` | browser | n/a (loaded by UI Runtime SPA) | browser ESM | `@uppy/core`, `@uppy/react`, `@uppy/aws-s3`, `@rntme/contracts-client-runtime-v1` |

Three separate `tsconfig.*.json` files drive the three builds. Shared code (`errors.ts`, route-rule types) is compiled into all three; runtime-specific code (`Bun.s3` calls, `@aws-sdk` calls, React components) is compiled into only the relevant build.

This is **not** two packages. It is one package with three entry points, like how identity-auth0 already ships a server entry plus a client entry. We add a third entry (provisioner) that's also present in identity-auth0 but with bun for the server.

### 4.3 Data flow — happy-path upload

```
User drags PDF onto <UploadDropzone routeId="ticket-attachments" entityId={ticket.id}/>
                                  │
                                  ▼
       Uppy invokes our getUploadParameters callback
                                  │
                                  ▼
       useOperation('storage.upload') → command bus → bindings-grpc
                                  │
                                  ▼
       StorageModule.PrepareUpload(routeId, entityId, filename, mime, size)
                  ├─ route-resolver checks storage.json rules (size/mime/count)
                  ├─ pending-store.insert(fileId, routeId, entityId, sha256?, sizeMax)
                  ├─ Bun.s3.presign(`<routeId>/<entityId>/<fileId>`, { method:'PUT', expiresIn:900 })
                  ├─ event store: append FileUploadInitiated CloudEvent
                  └─ return { fileId, presignedUrl, expiresAt, headers }
                                  │
                                  ▼
       Uppy PUTs file bytes directly to S3 endpoint with presigned URL
                                  │
                                  ▼
       Uppy invokes our onUploadSuccess callback
                                  │
                                  ▼
       useOperation('storage.commit') → StorageModule.CommitUpload(fileId)
                  ├─ Bun.s3.file(key).exists() — HEAD verify
                  ├─ Bun.s3.file(key).size — capture actual bytes
                  ├─ pending-store.markCommitted(fileId, sha256, sizeBytes)
                  ├─ event store: append FileUploadCommitted CloudEvent
                  └─ return { fileId, key, sizeBytes, sha256 }
                                  │
                                  ▼
       <FileList/> re-fetches via useOperation('storage.list') and displays new file
```

### 4.4 Layering / dependency-cruiser

Storage modules import from `@rntme/contracts-storage-v1`, `@rntme/contracts-module-v1`, `@rntme/contracts-provisioner-v1` (provisioner only), `@rntme/contracts-client-runtime-v1` (client only), `@rntme/contracts-common-v1`. Storage modules do NOT import `@rntme/runtime`, `@rntme/blueprint`, `@rntme/pdm`, `@rntme/qsm`, or any other concrete implementation. This matches the identity / ai-llm vendor profiles already encoded in `.dependency-cruiser.cjs`; no new rule needed, but the storage category gets the same layering profile applied.

The `@rntme/blueprint` extension that validates `storage.json` is allowed to reference `@rntme/pdm` (already does for workflow validation), so the cross-artifact owner-binding check fits within existing layering.

## 5. Canonical contract `@rntme/contracts-storage-v1`

### 5.1 Service surface

`StorageModule` service (gRPC) with seven RPCs:

| RPC | Purpose | Idempotency |
|---|---|---|
| `PrepareUpload` | Validate route rules, allocate `fileId`, return presigned PUT URL. Emits `FileUploadInitiated`. | Idempotent on `(routeId, entityId, idempotencyKey)`. Returns same `fileId`+presign within 24h window. |
| `CommitUpload` | HEAD-verify object on S3, finalize. Emits `FileUploadCommitted`. | Idempotent on `fileId`. Already-committed: returns the existing record. |
| `AbortUpload` | Mark pending upload as aborted, delete S3 object if present. Emits `FileUploadAborted`. | Idempotent on `fileId`. |
| `GetFile` | Read file metadata for a single committed file. | Pure read. |
| `ListFiles` | Read all committed files for `(routeId, entityId)` ordered by `committedAt DESC`. | Pure read. |
| `GetDownloadUrl` | Issue presigned GET URL with TTL. | Pure read; presign generation is local. |
| `DeleteFile` | Delete committed file. Emits `FileDeleted`. | Idempotent on `fileId`. |

All RPCs accept the standard `RequestContext` (correlation_id, principal, idempotency_key) defined in `@rntme/contracts-common-v1`. All RPCs return `Result<T>` shape via gRPC status + payload (success: 0/OK, error: non-zero with `error_code` field set to a `STORAGE_*` constant).

### 5.2 Events

CloudEvents 1.0 envelope on topic `rntme.<svc>.file`. Six event types:

| eventType | Trigger | Payload |
|---|---|---|
| `FileUploadInitiated` | `PrepareUpload` succeeds | `{ fileId, routeId, entityId, ownerPrincipalId, contentType, declaredSize, expiresAt }` |
| `FileUploadCommitted` | `CommitUpload` succeeds | `{ fileId, key, sha256, sizeBytes, committedAt }` |
| `FileUploadAborted` | `AbortUpload` succeeds, or auto-aborted on timeout | `{ fileId, reason: 'client_abort' \| 'timeout' \| 'route_disabled' }` |
| `FileOrphaned` | Owning entity deleted before/after commit; detected by orphan-scanner job | `{ fileId, reason: 'owner_deleted' }` |
| `FileDeleted` | `DeleteFile` succeeds | `{ fileId, deletedBy, deletedAt }` |
| `FileLifecycleSwept` | Periodic sweeper deleted S3 objects past retention | `{ count, beforeAt }` (aggregate event, fileIds in `vendor_raw`) |

No version suffix on the topic; breaking event-shape changes will introduce a new `eventType` (per CLAUDE.md non-obvious conventions).

### 5.3 Error code namespace

Codes follow `STORAGE_<LAYER>_<KIND>` format. Defined in `error-codes.json` and re-exported from `error-codes.ts`:

**STRUCTURAL** (request shape problems):
- `STORAGE_STRUCTURAL_ROUTE_ID_MISSING`
- `STORAGE_STRUCTURAL_ENTITY_ID_MISSING`
- `STORAGE_STRUCTURAL_FILE_ID_MISSING`
- `STORAGE_STRUCTURAL_INVALID_FILE_ID_FORMAT`

**REFERENCES** (referenced entities don't exist):
- `STORAGE_REFERENCES_ROUTE_NOT_FOUND` — `routeId` not in `storage.json`
- `STORAGE_REFERENCES_FILE_NOT_FOUND` — `fileId` not in pending-store nor committed
- `STORAGE_REFERENCES_ENTITY_NOT_FOUND` — owner-binding lookup miss (deferred policy: emit warn-only in v1; route-resolver does NOT call back into PDM at request time, only at validation time)

**CONSISTENCY** (rule violations from `storage.json`):
- `STORAGE_CONSISTENCY_FILE_TOO_LARGE`
- `STORAGE_CONSISTENCY_MIME_NOT_ALLOWED`
- `STORAGE_CONSISTENCY_MAX_COUNT_EXCEEDED`
- `STORAGE_CONSISTENCY_FILE_ALREADY_COMMITTED`
- `STORAGE_CONSISTENCY_UPLOAD_EXPIRED`

**AUTH** (authorization failures from `route.auth`):
- `STORAGE_AUTH_NOT_AUTHENTICATED`
- `STORAGE_AUTH_ROLE_REQUIRED`
- `STORAGE_AUTH_OWNER_MISMATCH` — principal doesn't match owner of pending upload

**VENDOR** (S3-side failures):
- `STORAGE_VENDOR_PRESIGN_FAILED`
- `STORAGE_VENDOR_OBJECT_NOT_FOUND` — HEAD returned 404 during commit
- `STORAGE_VENDOR_NETWORK_ERROR`
- `STORAGE_VENDOR_AUTH_DENIED` — S3 returned 401/403 (credentials issue)
- `STORAGE_VENDOR_BUCKET_NOT_FOUND`
- `STORAGE_VENDOR_QUOTA_EXCEEDED` — S3 returned 507 or backend-specific quota error
- `STORAGE_VENDOR_RATE_LIMITED` — 429

**PROVISIONER** (deploy-time, not RPC):
- `STORAGE_PROVISIONER_BUCKET_CREATE_FAILED`
- `STORAGE_PROVISIONER_CORS_APPLY_FAILED`
- `STORAGE_PROVISIONER_LIFECYCLE_APPLY_FAILED`
- `STORAGE_PROVISIONER_IAM_USER_CREATE_FAILED`
- `STORAGE_PROVISIONER_VALIDATION_FAILED` — manual mode: pre-existing bucket missing or unreachable
- `STORAGE_PROVISIONER_BACKEND_UNSUPPORTED` — admin mode requested for backend without admin API support (e.g. R2 IAM)

## 6. Per-service artifact `storage.json`

### 6.1 Schema

```jsonc
{
  "version": "1.0",
  "routes": {
    "ticket-attachments": {
      "owner": {
        "aggregate": "ticket",                  // PDM aggregate name (cross-ref)
        "association": "attachments"            // unique association name
      },
      "maxSize": "10MB",                        // human-friendly; also accepts bytes
      "allowedTypes": ["image/*", "application/pdf"],
      "maxCount": 5,                            // null = unlimited
      "auth": {
        "requireRole": ["member", "admin"]      // null = any authenticated principal
      },
      "lifecycle": {
        "expirePending": "24h",                 // pending uploads not committed within → FileUploadAborted
        "retainCommitted": null                 // null = keep forever; "30d"/"1y" supported
      }
    },
    "candidate-cv": {
      "owner": { "aggregate": "candidate", "association": "cv" },
      "maxSize": "20MB",
      "allowedTypes": ["application/pdf"],
      "maxCount": 1,
      "auth": { "requireRole": ["recruiter"] },
      "lifecycle": { "expirePending": "1h", "retainCommitted": null }
    }
  }
}
```

### 6.2 Validation layers

`@rntme/blueprint` extends with a `validateStorageJson(svcDir, pdm)` function that runs the four standard layers fail-fast:

**Parse layer** — JSON.parse + schema sanity (every required key present, types correct). Errors: `STORAGE_PARSE_*`.

**Structural layer** — duration strings parse as durations, byte-size strings parse as bytes, mime-type globs are well-formed, route-id keys match `^[a-z][a-z0-9-]*$`. Errors: `STORAGE_STRUCTURAL_*`.

**References layer** — for every `routes[*].owner.aggregate`, the named aggregate exists in `pdm.json#aggregates[]`. For every `routes[*].auth.requireRole[*]`, the role exists in the project's role catalog (if one is declared at project level; otherwise warn-only). Errors: `STORAGE_REFERENCES_*`.

**Consistency layer** — `(owner.aggregate, owner.association)` is unique within the file (no two routes claim the same association on the same aggregate). `lifecycle.expirePending` ≥ 1 minute and ≤ 7 days. `maxSize` ≤ 5GB (S3 single PUT limit; multipart raises this in v2). `maxCount` ≥ 1 if not null. Errors: `STORAGE_CONSISTENCY_*`.

Validators are layered and fail-fast per CLAUDE.md non-obvious conventions; bypassing a layer loses downstream error codes.

The validator returns `Result<ValidatedStorageJson>` with a branded type that only this validator can construct. Storage module's runtime accepts `ValidatedStorageJson` from blueprint at boot; it does NOT re-parse `storage.json` itself.

### 6.3 Owner-binding semantics

The `owner` field is **declarative metadata about the route**, not a structural extension of the PDM aggregate. PDM does not learn about it. Three things use the binding:

1. **Validator cross-check** — `aggregate` name exists in PDM (references layer).
2. **Client-side typed components** — `<UploadDropzone routeId="ticket-attachments" entityId={ticket.id}/>`. The UI artifact validator confirms `entityId`'s type matches the binding's `aggregate`'s id type. This catches typos at compile time.
3. **Orphan-scanner** — periodic job (deploy-level scheduled task, separate from this module's hot path) reads PDM's deletion log and emits `FileOrphaned` for files whose `entityId` no longer exists in the bound aggregate.

The orphan-scanner is a **deferred component**: declared in this spec, scheduled for v1.1 (sub-spec). v1 ships with files-can-outlive-entities; the cleanup story is sweeper-via-lifecycle-policy on the bucket.

## 7. Vendor module `@rntme/storage-s3`

### 7.1 `module.json`

```jsonc
{
  "name": "@rntme/storage-s3",
  "version": "0.0.0",
  "category": "storage",
  "vendor": "s3",
  "contract": "storage/v1",
  "capabilities": {
    "vendors": ["s3"],
    "s3_compatible_backends": [
      "aws-s3", "cloudflare-r2", "minio", "rustfs",
      "digitalocean-spaces", "backblaze-b2", "tigris"
    ],
    "rpcs": [
      "PrepareUpload", "CommitUpload", "AbortUpload",
      "GetFile", "ListFiles", "GetDownloadUrl", "DeleteFile"
    ],
    "events": [
      "FileUploadInitiated", "FileUploadCommitted", "FileUploadAborted",
      "FileOrphaned", "FileDeleted", "FileLifecycleSwept"
    ],
    "max_object_size_bytes": 5368709120,
    "presign_ttl_default_sec": 900,
    "supports_multipart": false
  },
  "limitations": [
    "Single PUT only in v1; multipart upload via @uppy/aws-s3-multipart deferred to v1.1.",
    "Cross-region replication not configured; deploy chooses one region per service.",
    "Per-user quotas not enforced; STORAGE_VENDOR_QUOTA_EXCEEDED is reserved for future use.",
    "Auto-cleanup of orphaned files (entity deleted) is sweeper-via-bucket-lifecycle in v1; explicit orphan-scanner is v1.1.",
    "Provisioner admin mode: bucket-create + CORS apply work on AWS S3, R2, MinIO. IAM scoped-credential creation works on AWS S3, MinIO; R2 returns STORAGE_PROVISIONER_BACKEND_UNSUPPORTED for IAM step (use scoped account-level token instead). rustfs admin support is best-effort and may require manual mode."
  ],
  "client": {
    "entry": "./dist/client/index.js",
    "contract": "storage",
    "boot": false,
    "config": {
      "schema": {
        "uppyLocale": { "type": "string" },
        "downloadUrlTtlSec": { "type": "number" }
      }
    },
    "components": [
      { "type": "UploadDropzone", "props": { "routeId": { "type": "string", "required": true }, "entityId": { "type": "string", "required": true } } },
      { "type": "FileList",       "props": { "routeId": { "type": "string", "required": true }, "entityId": { "type": "string", "required": true } } },
      { "type": "FilePreview",    "props": { "fileId":  { "type": "string", "required": true } } }
    ],
    "operations": [
      { "name": "upload",         "params": { "routeId": "string", "entityId": "string", "file": "File" } },
      { "name": "list",           "params": { "routeId": "string", "entityId": "string" } },
      { "name": "delete",         "params": { "fileId": "string" } },
      { "name": "getDownloadUrl", "params": { "fileId": "string", "ttlSec": "number?" } }
    ]
  },
  "provisioner": {
    "entry": "./dist/provisioner.entry.js",
    "produces": [
      { "name": "scopedCredentials", "kind": "single", "secret": true },
      { "name": "bucketName",        "kind": "single", "secret": false },
      { "name": "endpoint",          "kind": "single", "secret": false }
    ],
    "requires": [
      { "name": "s3Admin", "schema": "s3-admin-v1", "optional": true }
    ],
    "timeoutMs": 120000
  }
}
```

### 7.2 Server runtime — `Bun.s3` flow

`handler.ts` implements each RPC against `Bun.S3Client(envMappedOptions)`. Notes per RPC:

- **PrepareUpload**: validates route rules from `ValidatedStorageJson`; generates `fileId` (uuid v7 for time-ordering); object key is `${routeId}/${entityId}/${fileId}`; presigns PUT with `expiresIn = min(900, route.lifecycle.expirePending)`. Inserts into pending-store with TTL = `route.lifecycle.expirePending`. Emits `FileUploadInitiated` to event store via the standard `EventBus` plugin seam.

- **CommitUpload**: looks up `fileId` in pending-store. If not found → `STORAGE_REFERENCES_FILE_NOT_FOUND`. If already committed → returns existing record (idempotent). If pending: `Bun.s3.file(key).exists()` to verify, `Bun.s3.file(key).size` to capture bytes. Updates pending-store row to committed state. Emits `FileUploadCommitted`.

- **AbortUpload**: marks pending row as aborted, attempts `Bun.s3.file(key).delete()` (best-effort; ignore 404). Emits `FileUploadAborted`.

- **ListFiles**: `pending-store.queryCommitted(routeId, entityId, limit=100, orderBy=committedAt DESC)`. Pure DB read.

- **GetFile**: single-row lookup by `fileId`.

- **GetDownloadUrl**: `Bun.s3.presign(key, { method:'GET', expiresIn: ttlSec ?? 900 })`. No DB write.

- **DeleteFile**: `pending-store.findCommitted(fileId)`, `Bun.s3.file(key).delete()`, mark deleted. Emits `FileDeleted`.

### 7.3 Pending store schema (`bun:sqlite`)

Single SQLite table; `bun:sqlite` is built-in to bun, no dependency. Mounted at `/data/storage.sqlite` via `VOLUME /data` in Dockerfile (same pattern as openrouter's idempotency store).

```sql
CREATE TABLE files (
  file_id          TEXT PRIMARY KEY,           -- uuid v7
  route_id         TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  owner_principal  TEXT NOT NULL,              -- for STORAGE_AUTH_OWNER_MISMATCH
  state            TEXT NOT NULL,              -- 'pending' | 'committed' | 'aborted' | 'deleted'
  content_type     TEXT NOT NULL,
  declared_size    INTEGER,
  actual_size      INTEGER,
  sha256           TEXT,
  object_key       TEXT NOT NULL,
  initiated_at     INTEGER NOT NULL,           -- unix ms
  expires_at       INTEGER NOT NULL,           -- pending-state TTL
  committed_at     INTEGER,
  deleted_at       INTEGER,
  idempotency_key  TEXT,                       -- for PrepareUpload dedup
  vendor_raw_json  TEXT
);
CREATE INDEX idx_files_route_entity ON files (route_id, entity_id, state, committed_at DESC);
CREATE INDEX idx_files_pending_expiry ON files (state, expires_at) WHERE state = 'pending';
CREATE UNIQUE INDEX idx_files_idem ON files (route_id, entity_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
```

Periodic sweeper (cron-style, in-process, every 60s) finds pending rows past `expires_at` and aborts them.

### 7.4 Provisioner — conditional flow (mode `auto` | `manual`)

Provisioner entry receives `ProvisionerContext` from `@rntme/contracts-provisioner-v1` with module config (resolved from `project.json#modules.storage.publicConfig`) and any `requires[]` credentials.

**Mode resolution**:
- If `s3Admin` requirement is satisfied (admin credentials supplied via target secret) → mode `auto`.
- Else if scoped credentials are pre-supplied via `target.storage.s3.{accessKeyId,secretAccessKey,bucket,endpoint,region}` → mode `manual`.
- Else → fail with `STORAGE_PROVISIONER_VALIDATION_FAILED` — no credentials at all.

**Auto mode flow**:
1. `HeadBucket(bucketName)` — check existence. If 404, `CreateBucket(bucketName, region)`.
2. `PutBucketCors` with rules derived from `target.appOrigin` (project-level config): `AllowedOrigins: [appOrigin]`, `AllowedMethods: [PUT, GET, DELETE, HEAD]`, `AllowedHeaders: [*]`, `MaxAgeSeconds: 3600`.
3. `PutBucketLifecycleConfiguration` with two rules: (a) abort multipart uploads after 1 day; (b) for each route in `storage.json` with `lifecycle.retainCommitted` set, expire prefix `<routeId>/` at that age.
4. **IAM scoped credentials**: `CreateUser(name=rntme-<projectSlug>-<env>-storage)` → `PutUserPolicy(name, policy=scoped-bucket-rw)` → `CreateAccessKey(user)` → return `{accessKeyId, secretAccessKey}` as `produces.scopedCredentials`. If backend doesn't support IAM (R2): emit `STORAGE_PROVISIONER_BACKEND_UNSUPPORTED` warning, fall through to passing the admin credentials as scoped credentials (caller is expected to provide a bucket-scoped account-level token instead of admin token in this case).

**Manual mode flow**:
1. `HeadBucket(bucketName)` with scoped credentials. 404/403 → `STORAGE_PROVISIONER_VALIDATION_FAILED` with detail.
2. Smoke-write a test object (`__rntme_smoke__/${ts}`), HEAD it, delete it. Failure → `STORAGE_PROVISIONER_VALIDATION_FAILED`.
3. Pass scoped credentials through to runtime as `produces.scopedCredentials`.

**Outputs**: in both modes the provisioner returns `produces.scopedCredentials` (encrypted at rest in deploy_target), `produces.bucketName`, `produces.endpoint`. The render phase maps these to runtime env vars `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_S3_BUCKET`, `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_FORCE_PATH_STYLE`.

Per `rntme_blueprint_vars_vs_provisioner` memory: provisioner outputs land in the env at render time (after provision phase), so blueprints can reference `provision.scopedCredentials.accessKeyId` only inside service-level env mappings, not in vars resolved at plan time.

## 8. Client-side UI

### 8.1 Component contracts

`<UploadDropzone routeId entityId/>` — full-width drag-drop zone with file picker fallback. Internally builds a per-mount Uppy instance with `@uppy/aws-s3` plugin configured to call our `getUploadParameters` callback. Renders `@uppy/dashboard` UI with localized strings, progress bars, retry buttons.

`<FileList routeId entityId/>` — calls `useOperation('storage.list')` on mount and entity-id change. Renders a list of `<FilePreview/>` plus delete buttons gated on auth.

`<FilePreview fileId/>` — calls `useOperation('storage.getDownloadUrl')` on mount. Renders an inline image for `image/*`, an `<embed>` for `application/pdf`, a download link for everything else.

### 8.2 RouteId type-safety

`storage.json` is parsed at blueprint compile time. The blueprint emits a typed registry into `dist/blueprint.types.d.ts`:

```ts
export type StorageRouteId = 'ticket-attachments' | 'candidate-cv';
export interface StorageRoute<R extends StorageRouteId> {
  ownerAggregate: R extends 'ticket-attachments' ? 'ticket'
                : R extends 'candidate-cv' ? 'candidate'
                : never;
  // ...
}
```

The UI artifact compiler imports this type when validating component props. `<UploadDropzone routeId="tickt-attachments"/>` (typo) fails the UI artifact validation pass with `UI_REFERENCES_UNKNOWN_STORAGE_ROUTE`. This is the pushduck-equivalent end-to-end type safety, except the source of truth is the JSON artifact instead of a TS router.

### 8.3 Operations Registry entries

`client/operations.ts` registers four operations on module boot via `ModuleBootContext.registerOperation()` (per `@rntme/contracts-client-runtime-v1`). Entries automatically participate in the standard transport chain (Bearer token middleware from identity modules, idempotency cache from runtime, etc.).

## 9. File aggregate lifecycle

The File aggregate lives in the **storage service** (the service hosting the storage module — the same one whose `storage.json` is being processed). It is a **regular aggregate** in the rntme sense: event-sourced, single-writer, optimistic concurrency on `(file_id, version)`.

State machine:

```
                    [PrepareUpload]
                          │
                          ▼
                       PENDING ──────[expires_at reached]──→ ABORTED
                          │                                     │
              [CommitUpload OK]              [AbortUpload]      │
                          │                       │             │
                          ▼                       ▼             ▼
                      COMMITTED ──────────→ ABORTED  (event: FileUploadAborted)
                          │
                  [DeleteFile]                  [owner deleted]
                          │                          │
                          ▼                          ▼
                      DELETED                    ORPHANED
                  (event: FileDeleted)      (event: FileOrphaned, v1.1)
```

Optimistic concurrency: `CommitUpload` and `DeleteFile` use `version` as expected-version on the event-store append. Conflicting concurrent `CommitUpload` calls for the same `fileId` resolve cleanly (the second sees state=committed and returns the same record idempotently).

## 10. Two-call QSM integration

UI flows that need both an entity and its files make two operation calls. The pattern is encapsulated in `<FileList/>`:

```tsx
function TicketView({ ticketId }) {
  const { data: ticket } = useQuery('getTicket', { id: ticketId });
  return (
    <>
      <TicketBody ticket={ticket}/>
      <UploadDropzone routeId="ticket-attachments" entityId={ticketId}/>
      <FileList routeId="ticket-attachments" entityId={ticketId}/>
    </>
  );
}
```

The blueprint author writes this once. The two-call pattern is invisible to the author. Graph IR compiler is not touched. QSM projection compiler is not touched. PDM is not touched.

Performance characteristic: getTicket and storage.list run in parallel from the browser. Two HTTP round-trips, neither blocks the other. Acceptable for v1 attachment workflows; if it becomes a bottleneck later, opt-in include in QSM projections (option C from brainstorm round 3) is a non-breaking add.

## 11. Idempotency

Two distinct idempotency surfaces:

**PrepareUpload** is idempotent on `(routeId, entityId, idempotencyKey)` where `idempotencyKey` comes from the standard `RequestContext`. Repeat call within 24h returns the same `fileId` and re-issues a fresh presigned URL (presign URLs are short-lived; we don't cache them). This is the openrouter pattern adapted: the keyed record persists, the externally-issued artifact (presign URL) regenerates.

**CommitUpload, AbortUpload, DeleteFile** are idempotent on `fileId` alone. Repeat calls return the same final state without side effects.

Idempotency window: 24h (matches openrouter; configurable via `STORAGE_S3_IDEMPOTENCY_TTL_HOURS` env, default 24).

## 12. Testing strategy

| Test type | Location | Run on | Coverage |
|---|---|---|---|
| Unit | `test/unit/` | `bun test` (or vitest on bun) | route-resolver rule evaluation; pending-store CRUD; error-mapper S3-error-code → STORAGE_VENDOR_*; route-id regex; mime-glob match. |
| Integration | `test/integration/` | bun + docker rustfs container | full handler roundtrip against a real S3-compatible backend; tests cover happy path + each STORAGE_* error code. |
| Provisioner | `test/integration/provisioner/` | node | auto-mode against MinIO (full IAM support); manual-mode against a pre-provisioned MinIO bucket; backend-unsupported path against a mock R2-shaped client. |
| Conformance | `modules/storage/conformance/` | n/a (skeleton) | UNION generator emits `storage-conformance.json`; scenario implementations deferred to when category runner exists. |
| Contract drift-pin | `packages/contracts/storage/v1/test/` | vitest | service-shape (every RPC signature stable); error-codes-shape (every code matches `STORAGE_<LAYER>_<KIND>`); module manifest schema. |
| Validator | `packages/blueprint/test/storage-json/` | vitest | each layer fail-fast; cross-artifact owner-binding; positive + negative fixtures per error code. |

Module integration tests start a local rustfs container via `testcontainers`. CI runs all four test types per PR.

## 13. Documentation footprint (CLAUDE.md §11 mandate)

This PR's code changes intersect with documentation in the following places. Per CLAUDE.md "Every plan must include a documentation-touch task," the implementation plan landed by writing-plans MUST include doc updates as same-PR tasks:

| File | Change |
|---|---|
| `README.md` (packages table + dep graph + MVP scope) | Add `@rntme/contracts-storage-v1`, `@rntme/storage-s3` rows. Add storage-category line in MVP scope. Update mermaid dep graph. |
| `AGENTS.md` §3 layering | Add storage to vendor-modules tier (same rules as identity / ai-llm). |
| `AGENTS.md` §6.16 (or similar add-a-category-contract section) | Storage is a worked example; add a brief "storage canonical contract" reference. |
| `AGENTS.md` §10 glossary | New terms: "upload route", "owner-binding", "presigned URL", "pending file", "committed file", "orphaned file", "scoped IAM credentials", "rntme-storage UNION". |
| `CLAUDE.md` "Architecture in one paragraph" | Mention storage category and S3 vendor module in the package-list paragraph. |
| `docs/architecture.md` | Storage service in dependency tree; data flow update for upload-then-commit. |
| `vision.md` | Not touched. Storage is technical infra; no market-framing change. |
| `modules/storage/README.md` | New file — category overview, decision tree (auto vs manual provisioner), backend capability matrix. |
| `modules/storage/s3/README.md` | New file — file map, quick start, API, invariants/gotchas, out of scope, where to look first, specs (per AGENTS.md README template). |
| `packages/contracts/storage/v1/README.md` | New file — RPCs, events, error codes, manifest shape contract. |
| `demo/<chosen-demo>-blueprint/README.md` | If a demo is updated to use storage in v1, document the storage.json route choices and CORS expectations. |

The plan must record either an "update X" task per row or, for any row marked "no change," a recorded decision why. "No docs need updating" is valid only as an explicit recorded outcome.

## 14. Risks and open questions

**Risk: bun + @grpc/grpc-js compatibility regression.** Bun changelog claims grpc-js works via `node:http2`; we accept this on faith for spec-time. Implementation plan must include a bun-grpc smoke test as the FIRST task; if it fails on a current bun version, fall back to HTTP/JSON via `@rntme/bindings-http` and downgrade the storage module to non-gRPC transport (the canonical contract supports both shapes via `@rntme/contracts-storage-v1` proto since proto can be served over HTTP/JSON gRPC-Web style).

**Risk: bun + Docker image stability.** `oven/bun:1-alpine` is the upstream image. We accept it as canonical; if it's flaky, fall back to `oven/bun:1-debian-slim`.

**Risk: provisioner resolution gap (`rntme_provisioner_resolver_gap` memory).** PR #134's resolver imports module package from `platform-http` `node_modules`, but module packages aren't listed as deps. This is an open repo-level issue, not specific to storage. Implementation plan should NOT introduce a parallel resolution scheme; it should rely on whatever fix lands for PR #134 (or the issue gets resolved as a prerequisite).

**Open question: Does `storage.json` live per-service or per-project?** Spec proposes per-service. Reasoning: each service has its own SQLite store and its own bucket prefix; sharing a single bucket across services creates cross-service write paths into the same prefix, which violates single-writer invariants for each service's File aggregate. Per-service `storage.json` keeps each service self-contained. **Decision:** per-service. If the user wants project-level later, add it as a sub-spec.

**Open question: Where do auth roles come from?** `route.auth.requireRole` references a role name. PDM does not currently model roles; identity modules emit roles into JWTs. Spec proposes: validator only checks role-name shape (string regex) in v1; the runtime checks principal's roles from request context against the route's required-role list at request time. If a project-level role catalog is added later (separate spec), the validator graduates to references-layer cross-check. **Decision:** v1 = shape check only; no cross-artifact validation against a role catalog.

**Open question: rustfs admin API support.** rustfs's S3 admin compatibility (CreateBucket, PutBucketCors) is not fully documented. Provisioner's auto-mode against rustfs may fail at the CORS step. Implementation plan must include a real rustfs integration test for auto-mode and document the actual capability matrix in `modules/storage/README.md`. If auto-mode against rustfs is broken, the documented recommendation becomes "use manual mode against rustfs" until rustfs admin API stabilizes.

**Open question: provisioner access to per-service `storage.json`.** Auto-mode reads `storage.json` route lifecycle rules to derive `PutBucketLifecycleConfiguration` content. The exact protocol by which a per-service artifact reaches the provisioner entry running in `platform-http`'s node process is not detailed in `@rntme/contracts-provisioner-v1` today — existing provisioners (auth0) only consume target-secret credentials, not service artifacts. **Decision:** implementation plan's first contract-side task is to extend `ProvisionerContract`'s context with a `serviceArtifacts: Record<string, unknown>` field (or equivalent), populated by the deploy executor from the validated bundle before invoking the provisioner. This is a contract change; it lands in the same PR as the storage module and is documented in the canonical contract README change.

**Open question: how does `<FilePreview/>` handle expired download URLs?** Presigned download URLs have a 15-minute TTL by default. If a user opens a `<FilePreview>` and leaves the tab idle, the URL expires. Spec proposes: component refetches via `useOperation('storage.getDownloadUrl')` on focus regain (when `document.visibilityState === 'visible'`). Acceptable UX; no spec change.

## 15. Backlog (deferred, out of v1 scope)

- **Multipart / resumable uploads** via `@uppy/aws-s3-multipart` or `@uppy/tus` — unlocks files >5GB and reliable retry on flaky networks.
- **Webhook-based commit** — S3 bucket-notifications (or rustfs equivalent) to a runtime webhook endpoint, removing reliance on client-side `CommitUpload` call.
- **Auto-join in QSM projections** (option C from brainstorm round 3) — `"include": ["storage.attachments"]` opt-in; non-breaking add.
- **Content-addressed dedup** — sha256-keyed objects with reference counting for storage cost reduction.
- **Server-side file processing** as separate vendor sub-modules: `storage-image-resize`, `storage-virus-scan`, `storage-ocr`. Each subscribes to `FileUploadCommitted` and emits derived files.
- **Per-user storage quotas** — `STORAGE_VENDOR_QUOTA_EXCEEDED` is reserved.
- **Cross-region replication / multi-bucket sharding**.
- **Orphan-scanner job** — periodic scan of File aggregate against owning aggregate's deletion log; emit `FileOrphaned`.
- **Other vendors**: `@rntme/storage-azure-blob`, `@rntme/storage-gcs`, `@rntme/storage-supabase` (uses Supabase Storage's S3-compatible API but adds row-level security integration).
- **`storage.json` at project level** for cross-service shared buckets (with single-writer enforcement via partition prefixes).
- **PDM role catalog cross-check** for `route.auth.requireRole` references.
