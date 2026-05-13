# CV Extract Platform-Client Deploy E2E Design

Date: 2026-05-13

## Status

Brainstorming-approved design, written for user review. Implementation plan has
not been written yet.

## Context

The CLI universal deploy design established three deploy paths:

1. CLI direct mode: `rntme deploy` / `rntme platform up` talks directly to a
   deploy target.
2. CLI platform-client mode: CLI publishes a project to a deployed platform and
   asks that platform to deploy to a target.
3. Platform bootstrap: direct mode used specifically for
   `apps/platform/blueprint`.

Path 1 has already been exercised by deploying the platform itself. The next
goal is to exercise path 2 with a real demo project, preferably
`demo/cv-extract-blueprint`.

Current repository state shows the path is not yet coherent end to end:

- `cv-extract` declares `project.services = ["app", "marketing"]`, but there is
  no `services/marketing/service.json`, so composition fails.
- `cv-extract` binds `MARKETING_DOMAIN` from `target.marketing.primaryDomain`,
  but the current var schema supports target module values under
  `target.modules.<moduleKey>.<field>`.
- `marketing-site-static` is currently modeled as if it owns target-specific
  `bundleStorage`, `registry`, and `dokploy` secrets.
- The CLI platform-client publish/deploy commands do not line up with the
  platform blueprint HTTP surface. The CLI sends a raw canonical bundle and a
  `{ projectVersionSeq, targetSlug }` deploy request, while the generated
  blueprint API currently exposes JSON metadata fields and ID-shaped deploy
  inputs.
- Runtime artifact generation currently wires module calls for auth middleware
  modules, but `cv-extract` calls `openrouter.Complete` from Graph IR and needs
  general module call wiring.

This design narrows the next work to making path 2 testable and meaningful
without reintroducing `apps/platform-http`.

## Goals

- Make `demo/cv-extract-blueprint` a valid, deployable demo for path 2.
- Keep `project.services` focused on runnable workloads.
- Keep modules as one entity with capability facets, not separate "module
  kinds".
- Move target infrastructure concerns out of `marketing-site-static` and into
  the platform/deploy target boundary.
- Let `rntme project publish` carry the landing bundle inside the canonical
  project version rather than requiring a separate manual external S3 publish.
- Use `modules/storage/s3` in `cv-extract` for user CV/PDF files, backed by the
  target's provisioned or external S3-compatible storage.
- Make CLI platform-client publish/deploy align with the deployed platform
  blueprint API.
- Provide a live e2e test path: CLI -> deployed platform -> BPMN/deploy-runner
  -> Dokploy target -> smoke checks.

## Non-Goals

- A new deploy module category or a `modules/deploy/*` abstraction.
- A local Docker target adapter.
- Reintroducing `apps/platform-http` as a handwritten server.
- A full redesign of the marketing-site contract beyond what path 2 needs.
- Making every demo current. This work focuses on `cv-extract`.

## Key Design Decisions

### Modules Have Capability Facets

A module remains one project-level entity declared under `project.modules`.
Different platform subsystems consume different facets of that same entity:

- Graph IR/runtime consumes RPC/gRPC capabilities such as
  `openrouter.Complete` and storage module RPCs such as
  `storage.GetDownloadUrl`.
- UI runtime consumes client components/assets/actions when a module declares
  them.
- Edge planning consumes `capabilities.edgeAuth` when auth middleware uses a
  module.
- Deploy orchestration consumes `provisioner` and hosted-surface capabilities
  when a module needs deploy-time reconciliation.

There is no new taxonomy such as "runtime module" vs "deploy-shaped hosted
module". `marketing-site-static` is simply a module with a hosted static-site
facet and a provisioner. `openrouter` is a module with AI/LLM RPC capabilities.

### `project.services` Means Runnable Workloads

`project.services` should list services that the deploy planner turns into
workloads:

- domain service workloads, such as `app`;
- integration-module workloads, such as `openrouter`, when runtime Graph IR
  calls need a running module process.

`marketing` must not be listed in `project.services` unless it has a runnable
service descriptor and the planner should start it as a workload. In the
`cv-extract` case, `marketing` is a project module with hosted-surface
provisioning, not a runtime service workload.

The target `cv-extract` shape becomes:

```json
{
  "services": ["app", "openrouter", "storage-s3"],
  "vars": {
    "MARKETING_DOMAIN": {
      "from": "target.modules.marketing.primaryDomain",
      "required": true
    }
  },
  "modules": {
    "openrouter": {
      "package": "@rntme/ai-llm-openrouter",
      "publicConfig": {
        "defaultModel": "openrouter/deepseek/deepseek-v4-flash",
        "timeoutMs": 60000
      }
    },
    "storage": {
      "package": "@rntme/storage-s3",
      "publicConfig": {
        "backend": "rustfs",
        "bucketName": "cv-extract-files",
        "region": "us-east-1"
      }
    },
    "marketing": {
      "package": "@rntme/marketing-site-static",
      "publicConfig": {
        "source": { "kind": "project-folder", "path": "landing" },
        "primaryDomain": "${MARKETING_DOMAIN}",
        "ssl": "auto"
      }
    }
  }
}
```

`services/openrouter/service.json` is added with `"kind": "integration-module"`.
`services/storage-s3/service.json` is added with `"kind": "integration-module"`.
`services/marketing` is not added.

`services/app/storage.json` declares the upload route used by the app UI, for
example a `resume-upload` route that allows PDFs within the demo's size limit
and binds files to the `Resume` aggregate. The `Resume` entity should record the
source file id/object metadata alongside extracted JSON so the demo exercises
both AI and storage modules.

### Deploy Target Module Config Is Broader Than Integration Images

Today deploy target module config is shaped like an integration workload image:

```ts
{ image, expose?, env?, secretRefs? }
```

That is too narrow for module-scoped target values such as
`target.modules.marketing.primaryDomain`.

The deploy target schema should distinguish these concerns while keeping a
single `modules` object:

```json
{
  "modules": {
    "openrouter": {
      "image": "ghcr.io/vladprrs/rntme-ai-llm-openrouter:dev",
      "secretRefs": {
        "OPENROUTER_API_KEY": "openrouter-api-key"
      }
    },
    "storage-s3": {
      "image": "ghcr.io/vladprrs/rntme-storage-s3:dev"
    },
    "marketing": {
      "primaryDomain": "cv-extract.example.com"
    }
  }
}
```

The planner still uses `image`, `env`, `secretRefs`, and `expose` only for
services whose descriptor is `integration-module`. The var resolver sees the
whole per-module target config, so `target.modules.marketing.primaryDomain`
can be resolved before the marketing provisioner runs.

This avoids adding a separate `target.marketing` root and avoids inventing
marketing-specific target schema.

### Two Different Storage Concerns Must Stay Separate

There are two S3-compatible storage uses in this path, and they must not be
collapsed into one abstraction:

1. **Platform artifact storage** stores canonical project version bundles. This
   is internal platform infrastructure exposed through `BlobStore`, backed by
   S3-compatible storage such as RustFS. It is not a project module and must not
   depend on `modules/storage/s3`, because the platform needs it before a user
   project is deployed.
2. **Project file storage** stores user/product files for `cv-extract`, such as
   uploaded resumes. This should use `@rntme/storage-s3` as a normal project
   module with RPC/client/UI capabilities.

`modules/storage/s3` belongs in `cv-extract` for uploaded PDFs and file access.
It does not own the platform's ProjectVersion blob store.

### Platform Owns Artifact Storage And Target Adapter Credentials

The marketing module should not require target secrets named `bundleStorage`,
`registry`, or `dokploy`.

Those are platform/deploy concerns:

- Project version bytes are stored in the platform `BlobStore`, backed by the
  configured S3-compatible storage. In hosted/self-hosted path 2 this is the
  platform artifact store; in a provisioned target story the backing can be
  RustFS.
- Dokploy credentials are target adapter credentials. They are already stored
  as deploy target secrets and decrypted by the platform deploy executor.
- Registry/image build mechanics are target adapter implementation details.
  The module can describe a desired hosted static site; the adapter decides how
  that becomes a Dokploy app/image/resource.

`marketing-site-static` continues to validate a sha-pinned static site source
and produce `url`/`deployedSha256`, but the source for path 2 is a project
version asset, not a module-owned external S3 bucket.

The storage-s3 module is still a module-owned app dependency for user files. In
a provisioned RustFS target, deploy planning wires the storage module to the
target-local RustFS endpoints and credentials. That wiring is separate from the
platform BlobStore used to persist project version bundles.

### Landing Source Becomes A Project Version Asset

`cv-extract` should not require a separate `rntme bundle publish` step before
`rntme project publish`.

Add a marketing-site source variant:

```json
{
  "kind": "project-folder",
  "path": "landing"
}
```

Publish-time behavior:

1. CLI validates that `landing/` is inside the project root and contains
   `index.html`.
2. CLI packages it as deterministic tar+gzip using the existing bundle publish
   primitive semantics: sorted entries, stable metadata, stable gzip header.
3. CLI adds the bytes to the canonical project bundle assets under a
   deterministic project asset path, for example:
   `assets/project-folders/marketing/<sha256>.tar.gz`.
4. The canonical bundle digest covers both JSON artifacts and assets.
5. The platform stores the canonical bundle in `BlobStore` as the
   `ProjectVersion` blob.

Deploy-time behavior:

1. Platform materializes the project version bundle.
2. Deploy-runner discovers modules and substitutes target vars before
   provision.
3. The marketing provisioner receives a resolved source that points to the
   materialized project asset and includes the computed sha256.
4. The provisioner verifies the sha before hosting.

For the first implementation, deploy-runner rewrites
`source.kind = "project-folder"` to an internal materialized-asset source before
invoking the provisioner. This keeps the provisioner contract stable and avoids
adding project-asset resolver APIs before there is a second consumer. The module
public config remains the author-facing `project-folder` shape.

### Platform-Client API Alignment

Path 2 should preserve the CLI UX:

```bash
rntme project publish demo/cv-extract-blueprint --project <project-id-or-slug>
rntme project deploy --project <project-id-or-slug> --version <seq> --target <slug>
```

The platform blueprint must support those semantics without a handwritten
`apps/platform-http` launcher.

Required API alignment:

- Project version publish accepts the raw canonical bundle bytes with content
  type `application/rntme-project-bundle+json`.
- The platform route computes digest and summary server-side, stores the bundle
  in `BlobStore`, and creates or returns the matching `ProjectVersion`.
- Deploy start accepts `projectVersionSeq` and `targetSlug`, resolves them to
  IDs inside the platform, creates the deployment/project operation, and starts
  the BPMN process.
- Deploy target CRUD in the CLI moves from legacy `/v1/orgs/{org}/deploy-targets`
  to the platform blueprint `/api/deployments/targets` surface.

Because generated Graph IR HTTP bindings are JSON-body oriented today, the raw
bundle upload path needs a native platform operation or a generic raw-body
binding extension. The preferred boundary is a native platform operation under
the `projects` service, because it has to call `BlobStore` and project-version
repositories, which are already platform-core use cases rather than pure Graph
IR.

### Runtime Module Call Wiring

`cv-extract` Graph IR calls:

```json
{ "target": { "module": "openrouter", "operation": "Complete" } }
```

The storage-backed version should also call the storage module, for example:

```json
{ "target": { "module": "storage-s3", "operation": "GetDownloadUrl" } }
```

Runtime artifacts must therefore include module client wiring for Graph IR
module calls, not only modules used by auth middleware.

For `cv-extract` this means:

- `services/app` runtime manifest declares an `openrouter` module endpoint.
- The deploy plan renders an `openrouter` integration-module workload.
- The app runtime receives the module endpoint and proto path it needs to call
  `Complete`.
- The app runtime also receives the storage module endpoint/proto when the
  extraction graph uses `GetDownloadUrl` or other storage RPCs.
- The target config provides the OpenRouter module image and the
  `OPENROUTER_API_KEY` secret ref.
- The target config provides the storage-s3 module image; storage credentials
  are resolved from the deploy target storage/provisioned RustFS configuration
  and provisioner outputs.

The implementation should generalize module discovery from Graph IR call
targets, then keep auth middleware as one consumer of the same runtime module
wiring path.

For `cv-extract`, the recommended extraction flow is:

1. UI uploads the PDF through `@rntme/storage-s3`'s upload operation/component.
2. App graph receives the committed `fileId`.
3. App graph calls storage `GetDownloadUrl` for a short-lived public URL.
4. App graph calls OpenRouter `Complete` with a file block containing that URL.
5. App graph emits `Resume.complete` with `sourceFileId` and extracted JSON.

The existing base64 fixture test can remain as a narrow OpenRouter-module unit
test, but the path 2 demo smoke should use the storage-backed flow.

## Target E2E Flow

1. Bootstrap or reuse a deployed platform through path 1.
2. Create or update a deploy target in the platform with:
   - Dokploy target connection and API token;
   - event bus/storage/workflow settings required by the target;
   - `modules.openrouter.image`;
   - `modules.storage-s3.image`;
   - OpenRouter API key as a target secret;
   - `modules.marketing.primaryDomain`.
3. CLI publishes `demo/cv-extract-blueprint` to the platform.
4. Platform stores the canonical bundle as a project version.
5. CLI requests deploy of that project version to the target.
6. Platform BPMN/deploy-runner composes, provisions, plans, renders, applies,
   and verifies.
7. Smoke checks:
   - marketing domain returns the landing `index.html`;
   - app UI is reachable;
   - upload `sample-resume.pdf` through the storage route;
   - `POST /api/extractResume` with the committed file id returns a resume ID;
   - `GET /api/getResume` returns extracted JSON.

## Error Handling

- Invalid `project-folder` path fails during publish with a CLI/platform
  validation error before creating a project version.
- Missing `services/openrouter/service.json` or missing module image fails at
  composition/plan time with existing blueprint/deploy error style.
- Missing `services/storage-s3/service.json`, `services/app/storage.json`, or
  storage module image fails at composition/plan time before apply.
- Missing `target.modules.marketing.primaryDomain` fails during pre-provision
  target var resolution.
- Missing OpenRouter API key target secret fails before apply because required
  rendered env cannot be resolved.
- A non-public or misconfigured RustFS/S3 public endpoint fails the live
  extraction smoke when OpenRouter cannot fetch the presigned PDF URL.
- Raw bundle upload rejects invalid content type, unsupported bundle version,
  unsafe bundle paths, and malformed canonical bundle JSON before storing bytes.
- Marketing asset sha mismatch fails provision and marks the platform deployment
  failed.
- All platform-client failures are visible as project operation/deployment
  failure states and logs; the CLI should print the platform error code and the
  operation/deployment ID.

## Testing Strategy

### Unit Tests

- Blueprint vars accept `target.modules.marketing.primaryDomain`.
- Deploy target schemas preserve arbitrary module target fields while still
  validating integration workload image/env/secret fields.
- `buildProjectDeploymentConfig` keeps non-workload module fields for var
  resolution and only requires `image` for integration-module services.
- Project bundle collection includes `project-folder` assets deterministically.
- Marketing-site contract validates `project-folder` source.
- Platform publish native operation accepts raw canonical bundle bytes and
  stores project version blobs.
- Runtime artifact generation includes modules referenced by Graph IR call
  nodes.
- `cv-extract` storage route validates PDF MIME/size rules and produces module
  client assets for the storage UI components.

### Demo Tests

- `loadComposedBlueprint("demo/cv-extract-blueprint")` succeeds.
- `cv-extract` landing source hash/asset packaging is deterministic.
- `cv-extract` includes storage-s3 route/component wiring and validates against
  storage route reference checks.
- OpenRouter module integration test remains mocked and fast by default.
- A local platform-client test can publish and start deploy using fake repos and
  fake deploy-runner stage handlers.

### Live E2E

The live e2e is gated by environment variables and should not run in default CI:

- deployed platform base URL and token;
- organization/project identifiers;
- target slug;
- OpenRouter API key target secret already configured or creatable by CLI;
- storage-s3 image configured and provisioned/external S3-compatible storage
  reachable through the target public endpoint;
- marketing primary domain pointing to the Dokploy target.

The live test publishes `cv-extract`, deploys the returned version, waits for
success, and performs the smoke checks listed above.

## Implementation Sequence For The Future Plan

1. Fix `cv-extract` composition: services list, `services/openrouter`,
   `services/storage-s3`, storage route, var path, demo tests.
2. Broaden deploy target module config and var resolution without weakening
   integration-module image validation.
3. Generalize runtime module wiring from Graph IR module calls, including
   OpenRouter and storage module calls.
4. Add `project-folder` source packaging into canonical project bundles.
5. Refactor marketing-site provision so path 2 uses project version assets and
   target adapter credentials instead of module-specific Dokploy/registry/S3
   secrets.
6. Add platform native publish operation for raw canonical bundle upload.
7. Align platform-client deploy and target APIs with blueprint routes.
8. Add fake platform-client integration tests.
9. Run the gated live e2e against a deployed platform and target.

## Documentation Touch

- `docs/decision-system.md`: no strategic goal changes are required. If the
  implementation makes project-folder sources or module target config a new
  current default, add a short decision line then.
- `docs/current/owners/demo/cv-extract-blueprint.md`: update current demo shape,
  target requirements, and e2e commands.
- `docs/current/owners/modules/storage.md` and
  `docs/current/owners/modules/storage/s3.md`: only update if implementation
  changes target wiring or demo-specific gotchas; otherwise existing docs already
  describe provisioned RustFS vs storage-s3.
- `docs/current/owners/modules/marketing-site.md`: update source semantics and
  remove module-owned Dokploy/registry/bundleStorage wording.
- `docs/current/owners/packages/contracts/marketing-site.md`: document
  `project-folder`.
- `docs/current/owners/packages/deploy/deploy-core.md`: document target module
  config and var resolution semantics.
- `docs/current/owners/packages/deploy/deploy-runner.md`: document project asset
  handling during provision.
- `docs/current/owners/apps/cli.md` and `apps/cli/README.md`: document path 2
  publish/deploy commands and target API alignment.
- `docs/current/owners/apps/platform.md`: document raw bundle publish and
  deployment start API behavior.

## Review Notes

This spec intentionally supersedes the part of the marketing-site rationale that
made `rntme bundle publish` to external S3 mandatory for `cv-extract`. The
command can remain useful for external/static sources, but path 2 should use the
platform project-version artifact store so a single `project publish` captures
the whole deployable project.

This spec also clarifies that `target.modules.*` is not reserved for integration
workload image settings. It is the module-scoped target input namespace. The
planner decides which fields are relevant for runnable workloads; var
resolution and provisioners may consume other fields through explicit module
contracts.
