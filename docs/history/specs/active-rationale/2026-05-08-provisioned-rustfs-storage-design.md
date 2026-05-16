> Status: active-rationale.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Recent Superpowers design rationale preserved during project cleanup; it is not current-state truth by itself.

> Status: design.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Brainstorm output for provisioned RustFS project storage.

# Provisioned RustFS project storage - design

## 1. Problem

`@rntme/storage-s3` can already use S3-compatible backends, including RustFS,
but preview deployments still need an externally available object store,
bucket, credentials, and endpoint configuration before a storage-backed
project can run.

The deploy stack already has a target-local infrastructure pattern for
Redpanda and Operaton: `deploy-core` plans project infrastructure, and
`deploy-dokploy` renders it as Dokploy Compose resources. RustFS should follow
that pattern. The storage module should remain a canonical contract adapter,
not the owner of target infrastructure.

## 2. Goal

Add target-level **Provisioned RustFS storage** for Dokploy preview targets:

- One RustFS instance per `org/project/environment`.
- One deterministic project bucket inside that RustFS instance.
- A public storage origin for browser direct uploads and downloads.
- Internal S3 endpoint for module server-side S3 calls.
- `@rntme/storage-s3` remains the only storage module and consumes the planned
  S3-compatible environment.
- MVP keeps the current deploy phase order and records the cleaner future
  pipeline explicitly.

## 3. Non-goals

- No module-owned RustFS deployment.
- No RustFS instance per module or per service.
- No bucket-per-service isolation in MVP.
- No multi-node RustFS, erasure coding, external disks, or production storage
  topology.
- No generated platform-managed storage credentials in MVP.
- No generalized object storage provider matrix beyond `provider: "rustfs"`.
- No new provisioner execution phase in MVP.
- No server-side file byte proxy through runtime or edge.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Feature name | Provisioned RustFS storage |
| D2 | Ownership boundary | Target-level infrastructure in deploy-core/deploy-dokploy |
| D3 | Selection surface | Deploy target `storage.mode: "provisioned"` |
| D4 | First provider | RustFS |
| D5 | Target implementation | Dokploy Compose resource |
| D6 | Instance lifetime | One RustFS instance per `org/project/environment` |
| D7 | Bucket model | One deterministic bucket per project environment |
| D8 | Browser access | Explicit public storage origin |
| D9 | Runtime access | Internal Dokploy network endpoint |
| D10 | Credentials | Target-supplied access/secret key refs in MVP |
| D11 | Module env | Renderer injects `STORAGE_S3_*` into storage-s3 workloads |
| D12 | Provisioner phase | No new phase in MVP; storage-s3 provisioner remains for external/manual S3 |
| D13 | Bucket/CORS bridge | `@rntme/storage-s3` performs idempotent server startup ensure for provisioned RustFS |
| D14 | Future direction | Move to `apply infrastructure -> run module provisioners -> render/apply workloads` |

## 5. Decision-system fit

This design preserves the locked module and contract boundary:

- Storage remains a module under the canonical Storage contract, not blueprint
  core.
- RustFS is project infrastructure, like Redpanda and Operaton, not a side
  effect of a vendor module.
- The runtime-visible backend is still S3-compatible storage through
  `@rntme/storage-s3`.

`docs/decision-system.md` should gain a current-default bet:

```text
**RustFS as provisioned object storage (current default)** - target-local
S3-compatible storage for preview Dokploy targets; external S3-compatible
storage remains supported. · F8, G5 · current-default
```

This does not make file storage core. It selects the first provisioned engine
for the existing storage module path.

## 6. Deploy target config

Add optional project storage config to `ProjectDeploymentConfig` and platform
deploy target schemas:

```ts
export type ExternalStorageConfig = {
  readonly mode: 'external';
};

export type ProvisionedRustfsStorageConfig = {
  readonly mode: 'provisioned';
  readonly provider: 'rustfs';
  readonly image?: string;
  readonly publicBaseUrl: string;
  readonly accessKeyRef: string;
  readonly secretKeyRef: string;
};

export type StorageConfig =
  | ExternalStorageConfig
  | ProvisionedRustfsStorageConfig;
```

Rules:

- Omitted storage config means `external` for compatibility with existing
  module provisioner behavior.
- `external` provisions no target-local object storage.
- `provisioned` requires `provider: "rustfs"`.
- `publicBaseUrl` is required; it must not be inferred from `publicBaseUrl` for
  the project app because path and subdomain layouts vary by target.
- `accessKeyRef` and `secretKeyRef` are required in MVP.
- `image`, when supplied, must be pinned and must not use `latest`.

## 7. Deploy-core plan model

Add `ProjectDeploymentPlan.infrastructure.objectStorage`:

```ts
export type PlannedObjectStorage =
  | { readonly kind: 'none' }
  | {
      readonly kind: 's3-compatible';
      readonly mode: 'provisioned';
      readonly provider: 'rustfs';
      readonly resourceName: string;
      readonly internalEndpoint: string;
      readonly publicBaseUrl: string;
      readonly bucketName: string;
      readonly region: 'us-east-1';
      readonly forcePathStyle: true;
      readonly image: string;
      readonly credentials: {
        readonly accessKeyRef: string;
        readonly secretKeyRef: string;
      };
      readonly persistence: {
        readonly mode: 'persistent';
        readonly volumeName: string;
      };
    };
```

Derived values:

- `resourceName`: `rntme-<org>-<project>-storage`
- `internalEndpoint`: `http://<resourceName>:9000`
- `bucketName`: `rntme-<org>-<project>-default-storage`
- `region`: `us-east-1`
- `forcePathStyle`: `true`
- `volumeName`: `<resourceName>-data`

Planning errors:

- `DEPLOY_PLAN_STORAGE_PROVIDER_UNSUPPORTED`
- `DEPLOY_PLAN_STORAGE_IMAGE_INVALID`
- `DEPLOY_PLAN_STORAGE_PUBLIC_BASE_URL_MISSING`
- `DEPLOY_PLAN_STORAGE_CREDENTIAL_REF_MISSING`

## 8. Dokploy rendering

Extend `RenderedDokployComposeResource.infrastructureKind` with
`"object-storage"`.

When planned object storage is provisioned RustFS, render one Compose resource
before workloads:

- `logicalId: "object-storage"`
- `infrastructureKind: "object-storage"`
- name from planned `resourceName`
- image from planned image
- persistent named volume from planned `volumeName`
- attached to `dokploy-network`
- network alias equal to planned `resourceName`
- `RUSTFS_ACCESS_KEY` from `accessKeyRef`, marked secret
- `RUSTFS_SECRET_KEY` from `secretKeyRef`, marked secret
- labels:
  - `rntme.infrastructure=object-storage`
  - `rntme.provider=rustfs`
  - existing org/project/environment/managed-by labels

RustFS docs describe Docker deployment with `RUSTFS_ACCESS_KEY` and
`RUSTFS_SECRET_KEY`, and describe RustFS as S3-compatible object storage. The
implementation plan should verify the exact Docker command, data directory, and
image tag against current RustFS docs before code is written.

### Public origin

The RustFS public S3 endpoint is exposed through `storage.publicBaseUrl`.
Browser uploads and downloads use this origin because presigned URLs are
consumed directly by the browser.

MVP should prefer direct Dokploy domain support for the RustFS Compose service
when the Dokploy API exposes it through a stable endpoint. If the current
Dokploy API cannot expose Compose services directly, render a small public
application wrapper for ingress while keeping RustFS itself as the Compose
service. The design requirement is stable: public S3 bytes do not flow through
the rntme runtime or edge gateway.

## 9. Storage module wiring

When `plan.infrastructure.objectStorage` is provisioned RustFS, the renderer
adds these env entries to `@rntme/storage-s3` integration-module workloads:

```text
STORAGE_S3_ENDPOINT=http://<rustfs-resource>:9000
STORAGE_S3_PUBLIC_ENDPOINT=<publicBaseUrl>
STORAGE_S3_BUCKET=<project-bucket>
STORAGE_S3_REGION=us-east-1
STORAGE_S3_FORCE_PATH_STYLE=true
STORAGE_S3_ACCESS_KEY_ID=<accessKeyRef>
STORAGE_S3_SECRET_ACCESS_KEY=<secretKeyRef>
STORAGE_S3_BACKEND=rustfs
```

`STORAGE_S3_ACCESS_KEY_ID` and `STORAGE_S3_SECRET_ACCESS_KEY` are secret env
entries. The other env entries are non-secret.

Renderer matching should use module identity from the composed/discovered
module metadata, not just a service slug convention, so aliases still work.

For external storage, behavior stays as today:

- module `publicConfig` describes bucket, endpoint, backend, region, origins;
- target secrets provide admin or scoped credentials;
- the module provisioner validates or reconciles the external backend;
- provisioner env mappings feed runtime env.

## 10. Internal endpoint vs public presign endpoint

`@rntme/storage-s3` currently builds one Bun S3 client from env and presigns
with that endpoint. Provisioned RustFS needs two endpoints:

- internal endpoint for server-side `HEAD`, `DELETE`, and bucket ensure;
- public endpoint for presigned browser `PUT` and `GET`.

Add `STORAGE_S3_PUBLIC_ENDPOINT` support. The module should keep internal S3
calls on `STORAGE_S3_ENDPOINT` while producing presigned URLs for the public
origin.

If Bun's S3 client cannot safely sign for a separate public endpoint while
using a different internal endpoint for API calls, add a small presign adapter
using the AWS SDK presigner for URL generation only. Do not proxy bytes through
the module server.

## 11. Startup ensure bridge

Because MVP does not add an `apply infrastructure -> run module provisioners`
phase, `@rntme/storage-s3` cannot use its existing provisioner to validate the
provisioned RustFS instance before workloads are rendered.

For provisioned RustFS only, the storage module server performs an idempotent
startup ensure when `STORAGE_S3_BACKEND=rustfs`:

1. Ensure the project bucket exists.
2. Apply CORS for configured app/public origins.
3. Apply lifecycle rules derived from mounted `storage.json` when RustFS
   supports the relevant S3 lifecycle API.

This is a deliberate bridge, not the final architecture. The cleaner future
path is:

```text
plan infrastructure -> apply infrastructure -> run module provisioners -> render/apply workloads
```

In that future path, the existing storage-s3 provisioner runs against the
already-started RustFS endpoint and owns bucket/CORS/lifecycle reconciliation.
When that lands, the server startup ensure should be removed or reduced to a
readiness assertion.

## 12. Apply ordering and lifecycle

Resource order:

1. event bus compose
2. object storage compose
3. workflow engine compose
4. domain-service and integration-module applications
5. BPMN worker
6. edge gateway

Object storage does not require Kafka or workflow infrastructure, so it can be
created immediately after the event bus or before it. The chosen ordering above
keeps project infrastructure grouped before workloads and leaves event bus
ordering unchanged.

Apply does not need to wait for S3 protocol readiness in MVP. Storage module
startup should retry bucket ensure briefly because RustFS may still be warming
up after Dokploy marks the Compose deployment started.

Project delete uses the existing Dokploy resource deletion path. Compose
resources are deleted before applications only when the delete helper already
requires it; if resource ordering needs adjustment to keep application cleanup
from using storage, the implementation plan should update delete ordering
explicitly. Destructive project deletion should pass `deleteVolumes: true` for
RustFS data volume cleanup, matching the Redpanda provisioned volume policy.

## 13. Security and redaction

MVP credentials are target-supplied references. This avoids generating secret
material inside render.

Current Dokploy render/apply surfaces treat `secret: true` env entries as
redaction metadata, but the real Dokploy client serializes env blocks. This is
an existing limitation and should not be worsened by logging full rendered
plans or raw env blocks. The implementation should preserve existing cause
redaction and extend tests so RustFS access/secret key values do not appear in
apply errors.

The future platform-managed secret model should generate and persist RustFS
credentials outside render, then expose them to both RustFS and storage module
workloads through target-secret resolution.

## 14. Testing

Required tests:

- `deploy-core` unit tests for `storage` config planning, default `none`, RustFS
  planned resource names, bucket names, public origin, credential refs, and
  image validation.
- `platform-core` schema tests for deploy target create/update storage config.
- `platform-http` build-deploy-config tests to pass storage config through.
- `deploy-dokploy` render tests for RustFS Compose resource, env, labels,
  persistent volume, public origin, resource ordering, digest stability, and
  storage module env injection.
- `deploy-dokploy` apply tests for `object-storage` resource ordering and
  partial failure metadata.
- `modules/storage/s3` unit tests for `STORAGE_S3_PUBLIC_ENDPOINT` presigned
  URLs and internal endpoint use for server operations.
- `modules/storage/s3` startup ensure tests using mocked S3 admin calls.

Optional later tests:

- live Dokploy e2e deploy of a storage-backed demo using provisioned RustFS;
- integration roundtrip against RustFS container for startup ensure and public
  presign behavior.

## 15. Documentation touch evaluation

Update required:

- `docs/decision-system.md` for the RustFS current-default provisioned object
  storage bet.
- `docs/current/owners/packages/deploy/deploy-core.md` for `storage` config and
  planned object storage.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` for RustFS Compose
  rendering and public storage origin.
- `docs/current/owners/modules/storage.md` for target-level provisioned RustFS
  guidance.
- `docs/current/owners/modules/storage/s3.md` for provisioned RustFS env,
  public presign endpoint, and startup ensure bridge.
- Platform deploy target owner docs or UI docs if a current owner doc covers
  deploy target schema/UI behavior.

No update expected:

- Root `README.md`; this is not a public quick-start or positioning change.
- `AGENTS.md`; navigation, workflow, and layering rules do not change.
- Local package README stubs unless command hints or current-doc links change.

## 16. References

- RustFS introduction: https://docs.rustfs.com/concepts/introduction.html
- RustFS Docker installation: https://docs.rustfs.com/installation/docker/index.html
- RustFS Helm chart values: https://charts.rustfs.com/
