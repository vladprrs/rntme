# CV Extract Platform Client Deploy E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `demo/cv-extract-blueprint` publish and deploy end-to-end through CLI platform-client mode against a deployed platform, including OpenRouter, S3-backed resume uploads, project-folder marketing assets, and gated live smoke checks.

**Architecture:** Keep modules as one concept with multiple facets. `project.services` lists runnable workloads only: the app runtime plus integration-module workloads that must be deployed. `project.modules` declares module facets and public config. The platform stores canonical project bundles in its internal `BlobStore`; user resume files go through the `modules/storage/s3` runtime integration. Marketing project folders are packaged as canonical bundle assets, materialized by deploy-runner, and hosted by the target adapter, not by marketing module target secrets.

**Tech Stack:** TypeScript, Bun, Zod, Hono bindings, Graph IR runtime, BPMN worker, deploy-runner, deploy-core, deploy-dokploy, project bundles v2.

---

## Current Invariants

- `demo/cv-extract-blueprint/project.json` must end with `services: ["app", "openrouter", "storage-s3"]`.
- `project.modules.openrouter` points to `@rntme/ai-llm-openrouter`.
- `project.modules.storage` points to `@rntme/storage-s3`.
- `project.modules.marketing` points to `@rntme/marketing-site-static` and uses `publicConfig.source.kind = "project-folder"`.
- `MARKETING_DOMAIN` resolves from `target.modules.marketing.primaryDomain`.
- Runnable integration workload images live under `target.modules.<serviceSlug>.image`: `openrouter.image` and `storage-s3.image`.
- Non-runnable module facet config lives under `target.modules.<moduleKey>.*`: for this plan, `marketing.primaryDomain` and `marketing.ssl`.
- `marketing` must not appear in `project.services`.
- `modules/marketing-site/static-html` must not require `bundleStorage`, `registry`, or `dokploy` target secrets after this plan lands.
- Do not use fake proto snippets for runtime module calls. Runtime artifacts must use canonical contract proto sources from `packages/contracts/*/v1/proto`.

## Spec Coverage

This plan implements `docs/superpowers/specs/2026-05-13-cv-extract-platform-client-deploy-e2e-design.md` by covering:

- CV extract blueprint validity and deployability.
- `project.services` as runnable workloads only.
- OpenRouter and storage deployed as integration-module workloads.
- Storage S3 upload, commit, download URL, and extraction flow.
- Marketing `project-folder` source packaging into canonical bundle assets.
- Target-owned static-site hosting for marketing output.
- Runtime module manifest wiring for Graph IR calls.
- Platform-native raw bundle publish and deployment start.
- CLI platform-client publish/deploy/target API alignment.
- Fake platform-client e2e plus a gated live Dokploy smoke test.
- Owner doc and decision-system updates.

## Task 1: Add Integration Service Aliases and Target Module Config Semantics

**Files:**

- `packages/artifacts/blueprint/src/parse/schema.ts`
- `packages/artifacts/blueprint/src/load/load-blueprint.ts`
- `packages/artifacts/blueprint/src/types/artifact.ts`
- `packages/artifacts/blueprint/test/unit/parse.test.ts`
- `packages/artifacts/blueprint/test/unit/load-blueprint.test.ts`
- `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`
- `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts`
- `packages/deploy/deploy-core/src/composed-project.ts`
- `packages/deploy/deploy-core/src/config.ts`
- `packages/deploy/deploy-core/src/plan.ts`
- `packages/deploy/deploy-core/test/unit/plan.test.ts`
- `packages/deploy/deploy-core/test/unit/vars.test.ts`
- `packages/platform/platform-core/src/schemas/deploy-target.ts`
- `packages/platform/platform-core/test/unit/schemas/deploy-target.test.ts`
- `apps/cli/src/deploy-engine/target-schema.ts`
- `apps/cli/test/unit/deploy-engine/load-target.test.ts`

### Steps

- [ ] Add a failing blueprint parser test that accepts service alias metadata:

  ```ts
  expect(ServiceDescriptorSchema.parse({
    kind: "integration-module",
    module: "storage",
  })).toEqual({
    kind: "integration-module",
    module: "storage",
  });
  ```

- [ ] Extend the service descriptor schema and type:

  ```ts
  export const ServiceDescriptorSchema = z
    .object({
      kind: z.enum(["domain", "integration", "integration-module"]),
      module: nonEmptyString.optional(),
    })
    .strict();
  ```

  ```ts
  export type ServiceDescriptor = {
    slug: string;
    kind: ServiceKind;
    moduleKey?: string;
  };
  ```

- [ ] In `loadServiceDescriptor`, map `service.json.module` to `moduleKey` while keeping `slug` as the service directory name.

- [ ] Add a loader test with `services/storage-s3/service.json`:

  ```json
  {
    "kind": "integration-module",
    "module": "storage"
  }
  ```

  Expected: `services["storage-s3"].slug === "storage-s3"` and `services["storage-s3"].moduleKey === "storage"`.

- [ ] Extend `ComposedProjectService` in deploy-core to accept `kind: "integration-module"` and `moduleKey?: string`. Keep legacy `"integration"` accepted only for backward compatibility.

- [ ] Update `toDeployCoreInput` so each service preserves `moduleKey`:

  ```ts
  {
    slug,
    kind: service.kind,
    ...(service.moduleKey === undefined ? {} : { moduleKey: service.moduleKey }),
  }
  ```

- [ ] Broaden target module config types in platform-core, deploy-core, deploy-runner, and CLI schemas:

  ```ts
  export const DeployTargetModuleConfigSchema = z
    .object({
      image: z.string().trim().min(1).optional(),
      expose: z.boolean().optional(),
      env: z.record(z.string(), z.string()).optional(),
      secretRefs: z.record(z.string(), z.string()).optional(),
    })
    .catchall(z.unknown());
  ```

- [ ] Update deploy-core `buildWorkloads` rules:

  ```ts
  const isIntegration = service.kind === "integration" || service.kind === "integration-module";
  const moduleKey = service.moduleKey ?? service.slug;
  const moduleConfig = config.modules?.[service.slug];

  if (isIntegration && moduleConfig?.image === undefined) {
    errors.push({
      code: "DEPLOY_PLAN_MISSING_MODULE_IMAGE",
      message: `integration module service "${service.slug}" requires target.modules.${service.slug}.image`,
      service: service.slug,
      path: `modules.${service.slug}.image`,
    });
    continue;
  }
  ```

- [ ] Ensure integration workloads use image/env/secretRefs from `target.modules.<serviceSlug>` and package metadata from `project.modules.<moduleKey>`.

- [ ] Add deploy-core coverage for:
  - `marketing` target config without image does not fail when no `marketing` service exists.
  - `storage-s3` service with `moduleKey: "storage"` reads package name from `project.modules.storage`.
  - `openrouter` and `storage-s3` both fail if their service-slug image config is absent.
  - `target.modules.marketing.primaryDomain` resolves through vars.

- [ ] Run:

  ```bash
  bun run --filter @rntme/blueprint test
  bun run --filter @rntme/deploy-bundle-input test
  bun run --filter @rntme/deploy-core test
  bun run --filter @rntme/platform-core test
  bun run --filter @rntme/cli test
  ```

- [ ] Commit:

  ```bash
  git add packages/artifacts/blueprint packages/platform/deploy-bundle-input packages/deploy/deploy-core packages/platform/platform-core apps/cli
  git commit -m "Support integration service module aliases"
  ```

## Task 2: Make CV Extract a Valid Deployable Demo

**Files:**

- `demo/cv-extract-blueprint/project.json`
- `demo/cv-extract-blueprint/services/openrouter/service.json`
- `demo/cv-extract-blueprint/services/storage-s3/service.json`
- `demo/cv-extract-blueprint/services/app/storage.json`
- `demo/cv-extract-blueprint/pdm/entities/Resume.json`
- `demo/cv-extract-blueprint/services/app/qsm/projections/ResumeView.json`
- `demo/cv-extract-blueprint/services/app/graphs/shapes.json`
- `demo/cv-extract-blueprint/services/app/graphs/prepareResumeFileUpload.json`
- `demo/cv-extract-blueprint/services/app/graphs/commitResumeFileUpload.json`
- `demo/cv-extract-blueprint/services/app/graphs/extractResume.json`
- `demo/cv-extract-blueprint/services/app/bindings/bindings.json`
- `demo/cv-extract-blueprint/test/composition.test.ts`
- `demo/cv-extract-blueprint/test/integration/extract.test.ts`
- `demo/cv-extract-blueprint/package.json`

### Steps

- [ ] Add a failing composition test:

  ```ts
  import { describe, expect, test } from "bun:test";
  import { loadComposedBlueprint } from "@rntme/blueprint";

  describe("cv-extract deployable composition", () => {
    test("declares app, openrouter, and storage-s3 as runnable services", async () => {
      const result = await loadComposedBlueprint(new URL("..", import.meta.url).pathname);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const composed = result.value;

      expect(composed.project.services).toEqual(["app", "openrouter", "storage-s3"]);
      expect(Object.keys(composed.services).sort()).toEqual(["app", "openrouter", "storage-s3"]);
      expect(composed.services["storage-s3"]?.moduleKey).toBe("storage");
      expect(composed.project.modules?.marketing?.package).toBe("@rntme/marketing-site-static");
      expect(composed.project.modules?.storage?.package).toBe("@rntme/storage-s3");
      expect(composed.project.vars?.MARKETING_DOMAIN).toEqual({
        from: "target.modules.marketing.primaryDomain",
        required: true,
      });
    });
  });
  ```

- [ ] Replace `project.json` with:

  ```json
  {
    "name": "cv-extract",
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
          "timeoutMs": 30000
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
          "source": {
            "kind": "project-folder",
            "path": "landing"
          },
          "primaryDomain": "${MARKETING_DOMAIN}",
          "ssl": "auto"
        }
      }
    },
    "routes": {
      "ui": {
        "/": "app"
      },
      "http": {
        "/api": "app"
      }
    }
  }
  ```

- [ ] Add `services/openrouter/service.json`:

  ```json
  {
    "kind": "integration-module",
    "module": "openrouter"
  }
  ```

- [ ] Add `services/storage-s3/service.json`:

  ```json
  {
    "kind": "integration-module",
    "module": "storage"
  }
  ```

- [ ] Add a valid `services/app/storage.json`:

  ```json
  {
    "version": "1.0",
    "routes": {
      "resume-file": {
        "owner": { "aggregate": "Resume", "association": "file" },
        "maxSize": "20MB",
        "allowedTypes": ["application/pdf"],
        "maxCount": 1,
        "auth": { "requireRole": null },
        "lifecycle": { "expirePending": "15m", "retainCommitted": "30d" }
      }
    }
  }
  ```

- [ ] Update `Resume.json` using the current PDM shape:

  ```json
  {
    "ownerService": "app",
    "kind": "owned",
    "table": "resumes",
    "fields": {
      "id": { "type": "string", "nullable": false, "column": "id" },
      "filename": { "type": "string", "nullable": false, "column": "filename" },
      "mediaType": { "type": "string", "nullable": false, "column": "media_type" },
      "fileId": { "type": "string", "nullable": false, "column": "file_id" },
      "objectKey": { "type": "string", "nullable": false, "column": "object_key" },
      "downloadUrl": { "type": "string", "nullable": false, "column": "download_url" },
      "extractedJson": { "type": "string", "nullable": false, "column": "extracted_json" },
      "status": { "type": "string", "nullable": false, "column": "status" },
      "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
    },
    "keys": ["id"],
    "stateMachine": {
      "stateField": "status",
      "initial": null,
      "states": ["complete"],
      "transitions": {
        "complete": {
          "from": null,
          "to": "complete",
          "affects": ["filename", "mediaType", "fileId", "objectKey", "downloadUrl", "extractedJson"]
        }
      }
    }
  }
  ```

- [ ] Update `ResumeView` and `shapes.json` to expose `fileId`, `objectKey`, `downloadUrl`, and existing fields. Add `PrepareUploadResult` and `CommitUploadResult` shapes with scalar fields only.

- [ ] Add `prepareResumeFileUpload.json`. The graph must call `storage.PrepareUpload` with proto field names:

  ```json
  {
    "id": "prepared",
    "type": "call",
    "target": { "module": "storage", "operation": "PrepareUpload" },
    "input": {
      "context": { "$literal": { "idempotency_key": "", "correlation_id": "" } },
      "route_id": { "$literal": "resume-file" },
      "entity_id": { "$node": "resumeId" },
      "filename": { "$param": "filename" },
      "content_type": { "$param": "mediaType" },
      "declared_size": { "$param": "declaredSize" }
    },
    "policy": {
      "timeoutMs": 30000,
      "retry": { "attempts": 1, "retryOn": "transient" },
      "idempotency": { "mode": "inherit" },
      "onError": "fail"
    }
  }
  ```

  The result node must return `resumeId`, `fileId` from `prepared.result.file_id`, `objectKey` from `prepared.result.object_key`, and `uploadUrl` from `prepared.result.presigned.url`.

- [ ] Add `commitResumeFileUpload.json` calling `storage.CommitUpload` with `file_id`.

- [ ] Rewrite `extractResume.json` so its required inputs are `resumeId`, `filename`, `mediaType`, `fileId`, and `objectKey`. Its first call must be `storage.GetDownloadUrl`:

  ```json
  {
    "id": "download",
    "type": "call",
    "target": { "module": "storage", "operation": "GetDownloadUrl" },
    "input": {
      "context": { "$literal": { "idempotency_key": "", "correlation_id": "" } },
      "file_id": { "$param": "fileId" },
      "ttl_sec": { "$literal": 900 }
    },
    "policy": {
      "timeoutMs": 30000,
      "retry": { "attempts": 1, "retryOn": "transient" },
      "idempotency": { "mode": "none" },
      "onError": "fail"
    }
  }
  ```

  The OpenRouter file block must use `{ "$ref": "download.result.presigned.url" }` instead of base64 input.

- [ ] Update bindings using the current binding artifact format:

  ```json
  {
    "prepareResumeFileUpload": {
      "graph": "prepareResumeFileUpload",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/files/prepare-upload",
        "parameters": [
          { "name": "filename", "in": "body", "bindTo": "filename", "required": true },
          { "name": "mediaType", "in": "body", "bindTo": "mediaType", "required": true },
          { "name": "declaredSize", "in": "body", "bindTo": "declaredSize", "required": true }
        ]
      },
      "exposure": "action"
    }
  }
  ```

  Add equivalent entries for `POST /files/commit-upload`, `POST /resumes`, and the existing `GET /resumes/{id}`.

- [ ] Update `test/integration/extract.test.ts` so storage and OpenRouter calls are stubbed. Assert storage receives `GetDownloadUrl` with `file_id`, and OpenRouter receives a file URL, not base64.

- [ ] Add missing dev dependencies:

  ```json
  {
    "devDependencies": {
      "@rntme/blueprint": "workspace:*",
      "@rntme/storage-s3": "workspace:*"
    }
  }
  ```

- [ ] Run:

  ```bash
  bun run --filter @rntme/demo-cv-extract-blueprint test
  bun run vendor:check
  ```

- [ ] Commit:

  ```bash
  git add demo/cv-extract-blueprint
  git commit -m "Make cv extract deployable"
  ```

## Task 3: Wire Graph IR Module Calls Into Runtime Manifests

**Files:**

- `packages/platform/deploy-bundle-input/src/runtime-module-wiring.ts`
- `packages/platform/deploy-bundle-input/src/contract-protos.ts`
- `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`
- `packages/platform/deploy-bundle-input/test/runtime-module-wiring.test.ts`
- `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts`
- `packages/runtime/runtime/src/start/runtime-module-operations.ts`
- `packages/runtime/runtime/src/start/start-service.ts`
- `packages/runtime/runtime/test/unit/runtime-module-operations.test.ts`
- `packages/runtime/runtime/test/unit/start-service.test.ts`

### Steps

- [ ] Extract current auth-only module manifest logic from `to-deploy-core-input.ts` into `runtime-module-wiring.ts`.

- [ ] Add `collectGraphModuleTargets` that walks every graph node and collects `node.type === "call"` targets with `target.module`.

- [ ] Resolve runtime module addresses from service aliases:

  ```ts
  const serviceSlug = serviceSlugByModuleKey.get(moduleKey) ?? moduleKey;
  const address = `mod-${serviceSlug}:50051`;
  ```

- [ ] Add a test for CV extract app runtime files. Expected manifest modules:

  ```ts
  expect(manifest.modules).toEqual([
    { name: "openrouter", grpc: { address: "mod-openrouter:50051" }, protoPath: "protos/ai_llm.proto" },
    { name: "storage", grpc: { address: "mod-storage-s3:50051" }, protoPath: "protos/storage.proto" }
  ]);
  ```

- [ ] Add `contract-protos.ts` that reads canonical proto sources from:
  - `packages/contracts/ai-llm/v1/proto/ai_llm.proto`
  - `packages/contracts/storage/v1/proto/storage.proto`
  - `packages/contracts/_common/v1/proto/common.proto`

  Do not copy reduced proto snippets into this package.

- [ ] Write runtime artifact files:

  ```text
  protos/ai_llm.proto
  protos/storage.proto
  protos/rntme/contracts/common/v1/common.proto
  ```

- [ ] Keep identity auth proto handling intact, but use the same module address convention unless `RNTME_AUTH_MODULE_ENDPOINT` overrides it.

- [ ] Add `runtime-module-operations.ts`:

  ```ts
  export function runtimeModuleOperationEffect(moduleName: string, operation: string): "read" | "action" | null {
    if (moduleName === "identity-auth0" && operation === "IntrospectSession") return "read";
    if (moduleName === "openrouter" && operation === "Complete") return "action";
    if (moduleName === "storage" && operation === "GetDownloadUrl") return "read";
    if (moduleName === "storage" && ["PrepareUpload", "CommitUpload", "AbortUpload", "DeleteFile"].includes(operation)) return "action";
    if (moduleName === "storage" && ["GetFile", "ListFiles"].includes(operation)) return "read";
    return null;
  }
  ```

- [ ] Replace the private `moduleOperationEffect` in `start-service.ts` with this helper.

- [ ] Run:

  ```bash
  bun run --filter @rntme/deploy-bundle-input test
  bun run --filter @rntme/runtime test
  ```

- [ ] Commit:

  ```bash
  git add packages/platform/deploy-bundle-input packages/runtime/runtime
  git commit -m "Wire runtime module calls from graph targets"
  ```

## Task 4: Package Marketing Project Folders Into Canonical Bundles

**Files:**

- `packages/contracts/marketing-site/v1/src/schema.ts`
- `packages/contracts/marketing-site/v1/src/types.ts`
- `packages/contracts/marketing-site/v1/test/schema.test.ts`
- `apps/cli/src/bundle/collect-assets.ts`
- `apps/cli/src/bundle/project-folder-assets.ts`
- `apps/cli/test/unit/bundle/project-folder-assets.test.ts`
- `apps/cli/test/unit/bundle/build.test.ts`
- `demo/cv-extract-blueprint/test/landing-deploy.test.ts`

### Steps

- [ ] Add `project-folder` to the marketing contract:

  ```ts
  export const ProjectFolderSourceSchema = z.object({
    kind: z.literal("project-folder"),
    path: RelativeProjectPathSchema,
  }).strict();
  ```

  Reject absolute paths and `..` traversal.

- [ ] Add CLI asset collection for `project-folder` sources. Use the existing utilities:

  ```ts
  import { buildDeterministicTarGz, hashBuffer } from "@rntme/bundle-publish";
  ```

  Asset key format:

  ```text
  assets/project-folders/<moduleKey>/<sha256>.tar.gz
  ```

- [ ] Add tests that building `demo/cv-extract-blueprint` produces exactly one `assets/project-folders/marketing/<sha>.tar.gz` asset and leaves `project.json` source as `{ "kind": "project-folder", "path": "landing" }`.

- [ ] Run:

  ```bash
  bun run --filter @rntme/contracts-marketing-site-v1 test
  bun run --filter @rntme/cli test
  bun run --filter @rntme/demo-cv-extract-blueprint test
  ```

- [ ] Commit:

  ```bash
  git add packages/contracts/marketing-site apps/cli demo/cv-extract-blueprint
  git commit -m "Package marketing project folders as bundle assets"
  ```

## Task 5: Materialize Marketing Assets and Move Static Hosting to the Target Adapter

**Files:**

- `packages/deploy/deploy-runner/src/project-assets.ts`
- `packages/deploy/deploy-runner/src/stages/provision.ts`
- `packages/deploy/deploy-runner/test/project-assets.test.ts`
- `packages/deploy/deploy-runner/test/stages/provision.test.ts`
- `modules/marketing-site/static-html/module.json`
- `modules/marketing-site/static-html/src/provisioner.ts`
- `modules/marketing-site/static-html/src/types.ts`
- `modules/marketing-site/static-html/test/unit/provisioner.test.ts`
- `modules/marketing-site/static-html/test/conformance.test.ts`
- `modules/marketing-site/conformance/src/scenarios/happy-path.ts`
- `packages/deploy/deploy-core/src/provision.ts`
- `packages/deploy/deploy-dokploy/src/render.ts`
- `packages/deploy/deploy-dokploy/src/apply.ts`
- `packages/deploy/deploy-dokploy/test/unit/render.test.ts`
- `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`

### Steps

- [ ] Add deploy-runner materialization logic before provisioners run:

  ```ts
  if (source.kind === "project-folder") {
    publicConfig.source = {
      kind: "materialized-project-asset",
      assetPath,
      localPath: join(input.bundleDir, assetPath),
      sha256,
    };
  }
  ```

- [ ] Add internal-only `materialized-project-asset` support in `modules/marketing-site/static-html`:

  ```ts
  {
    kind: "materialized-project-asset",
    assetPath: "assets/project-folders/marketing/<sha>.tar.gz",
    localPath: "<bundleDir>/assets/project-folders/marketing/<sha>.tar.gz",
    sha256: "<sha>"
  }
  ```

- [ ] Change marketing static module provisioner output to be target-agnostic:

  ```ts
  type StaticSiteV1 = {
    kind: "static-site-v1";
    primaryDomain: string;
    ssl: "auto" | "manual" | "none";
    sha256: string;
    files: Record<string, string>;
  };
  ```

  `files` are relative UTF-8 file paths under the extracted static site. For this CV extract path, `landing/index.html` and `landing/styles.css` must be supported.

- [ ] Update `module.json`:

  ```json
  {
    "provisioner": {
      "produces": [
        { "name": "url", "kind": "single", "secret": false },
        { "name": "deployedSha256", "kind": "single", "secret": false },
        { "name": "staticSite", "kind": "single", "secret": false }
      ],
      "requires": []
    }
  }
  ```

- [ ] Remove Dokploy and registry calls from the `project-folder`/`materialized-project-asset` provision path. `publicOutputs.url` may be computed from `primaryDomain`; `publicOutputs.staticSite` carries the site to deploy.

- [ ] Keep legacy `s3` and `local-path` tests passing until removed by a later cleanup. Legacy paths may still use old helper code, but `project-folder` must be the path used by CV extract.

- [ ] Add deploy-dokploy render support for `staticSite-v1` provision outputs. Render one `application` resource with:
  - `image: "nginx:1.27-alpine"`
  - `files` mounted under `/usr/share/nginx/html`
  - nginx config for static fallback
  - `ingress` using `staticSite.primaryDomain`
  - labels using project/org/environment/module key

- [ ] Ensure `applyDokployPlan` already handles application files and ingress for this resource. Extend `RenderedDokployApplicationResource.workloadKind` with `"static-site"` if needed, and update equality checks accordingly.

- [ ] Add render/apply tests that prove no `registry` or `dokploy` target secret is required by the marketing module provisioner, while deploy-dokploy still creates the hosted static application.

- [ ] Update conformance tests to require target-agnostic provision output for `project-folder`/`materialized-project-asset`.

- [ ] Run:

  ```bash
  bun run --filter @rntme/deploy-runner test
  bun run --filter @rntme/marketing-site-static test
  bun run --filter @rntme/conformance-marketing-site test
  bun run --filter @rntme/deploy-dokploy test
  bun run --filter @rntme/deploy-core test
  ```

- [ ] Commit:

  ```bash
  git add modules/marketing-site packages/deploy/deploy-core packages/deploy/deploy-runner packages/deploy/deploy-dokploy
  git commit -m "Move marketing static hosting to deploy target"
  ```

## Task 6: Add Platform-Native Publish, Deploy, and Target APIs

**Files:**

- `packages/artifacts/bindings/src/parse/schema.ts`
- `packages/artifacts/bindings/src/types/artifact.ts`
- `packages/runtime/bindings-http/src/runtime/operation-handler.ts`
- `packages/runtime/bindings-http/src/operation-contract.ts`
- `packages/runtime/runtime/src/plugins/executors/native-operation-executor.ts`
- `packages/runtime/runtime/src/start/start-service.ts`
- `packages/platform/platform-core/src/use-cases/project-versions.ts`
- `packages/platform/platform-core/test/unit/use-cases/project-versions.test.ts`
- `apps/platform/blueprint/services/projects/operations.json`
- `apps/platform/blueprint/services/projects/bindings/bindings.json`
- `apps/platform/blueprint/services/projects/handlers/publish-project-bundle.ts`
- `apps/platform/blueprint/services/deployments/operations.json`
- `apps/platform/blueprint/services/deployments/bindings/bindings.json`
- `apps/platform/blueprint/services/deployments/handlers/start-deployment.ts`
- `apps/platform/blueprint/services/deployments/handlers/deploy-targets.ts`
- `apps/platform/blueprint/test/platform-projects-handler.test.ts`
- `apps/platform/blueprint/test/platform-deployments-handler.test.ts`

### Steps

- [ ] Reuse the existing `operations.json` native-handler pattern from `services/tokens/operations.json`. Do not add OpenAPI-shaped binding entries.

- [ ] Extend bindings so an entry may target a native operation instead of a graph:

  ```json
  {
    "operation": "publishProjectBundle",
    "target": { "engine": "native", "dialect": "platform" },
    "http": {
      "method": "POST",
      "path": "/{projectId}/versions",
      "parameters": [
        { "name": "projectId", "in": "path", "bindTo": "projectId", "required": true }
      ]
    },
    "inputFrom": {
      "authorization": { "from": "header", "name": "authorization", "required": true },
      "bodyBytes": { "from": "bodyBytes" }
    },
    "exposure": "action"
  }
  ```

- [ ] Extend `inputFrom` with `{ "from": "bodyBytes" }`. `bindings-http` must read `await c.req.arrayBuffer()` only when the binding declares this input source.

- [ ] Add `NativeOperationExecutor` that conforms to the current executor contract:

  ```ts
  export class NativeOperationExecutor implements OperationExecutor {
    async execute(input: OperationExecutorInput): Promise<OperationExecutorOutput> {
      const handler = this.handlers[input.operationName];
      if (handler === undefined) return this.fallback.execute(input);
      const value = await handler(input.inputs, input.ctx);
      return {
        ok: true,
        value: {
          value,
          metadata: {
            eventIds: [],
            commandId: input.ctx.correlation.commandId,
            correlationId: input.ctx.correlation.correlationId
          }
        }
      };
    }
  }
  ```

  Do not introduce `{ handled: false }`; it is not part of `OperationExecutorOutput`.

- [ ] Add `publishProjectVersionFromBundleBytes` in platform-core. It must parse and validate the canonical bundle, compute digest server-side, gzip the raw canonical bytes into platform `BlobStore`, create the project version, and return the version row.

- [ ] Add native project publish handler that resolves org/project id-or-slug, authenticates from `authorization`, and calls `publishProjectVersionFromBundleBytes`.

- [ ] Add native deployment start handler for `POST /api/deployments`. The request body is:

  ```json
  {
    "organizationId": "acme",
    "projectId": "cv-extract",
    "projectVersionSeq": 1,
    "targetSlug": "prod",
    "configOverrides": {}
  }
  ```

  The handler resolves IDs, creates a `ProjectOperation`, and starts the deploy BPMN/native deploy-runner path from `projectVersionSeq` plus `targetSlug`.

- [ ] Add target CRUD native handlers under `/api/deployments/targets` using platform-core deploy target use-cases.

- [ ] Run:

  ```bash
  bun run --filter @rntme/bindings test
  bun run --filter @rntme/bindings-http test
  bun run --filter @rntme/runtime test
  bun run --filter @rntme/platform-core test
  bun run --filter @rntme/platform-blueprint test
  ```

- [ ] Commit:

  ```bash
  git add packages/artifacts/bindings packages/runtime/bindings-http packages/runtime/runtime packages/platform/platform-core apps/platform/blueprint
  git commit -m "Add platform native publish and deploy APIs"
  ```

## Task 7: Align CLI Platform-Client Flow and Add Fake E2E

**Files:**

- `apps/cli/src/api/endpoints.ts`
- `apps/cli/src/api/target-endpoints.ts`
- `apps/cli/src/commands/project/publish.ts`
- `apps/cli/src/commands/project/deploy.ts`
- `apps/cli/src/commands/target/create.ts`
- `apps/cli/src/commands/target/set-config.ts`
- `apps/cli/test/unit/commands/project/publish.test.ts`
- `apps/cli/test/unit/commands/project/deploy.test.ts`
- `apps/cli/test/unit/api/target-endpoints.test.ts`
- `apps/cli/test/integration/platform-client-cv-extract.test.ts`
- `apps/cli/test/fixtures/fake-platform.ts`

### Steps

- [ ] Keep `project publish` sending raw canonical bundle bytes with `Content-Type: application/rntme-project-bundle+json`.

- [ ] Update `project deploy` to call:

  ```text
  POST /api/deployments
  ```

  with `organizationId`, `projectId`, `projectVersionSeq`, `targetSlug`, and `configOverrides`.

- [ ] Update target endpoints to the platform blueprint path:

  ```ts
  export const targetEndpoints = {
    list: () => "/api/deployments/targets",
    show: (slug: string) => `/api/deployments/targets/${encodeURIComponent(slug)}`,
    create: () => "/api/deployments/targets",
    update: (slug: string) => `/api/deployments/targets/${encodeURIComponent(slug)}`,
    delete: (slug: string) => `/api/deployments/targets/${encodeURIComponent(slug)}`,
  };
  ```

  Include `organizationId` in query/body as required by the platform handlers.

- [ ] Add fake platform e2e that records:

  ```text
  POST /api/projects/cv-extract/versions
  POST /api/deployments
  GET /api/deployments/:deploymentId
  GET /api/deployments/:deploymentId/logs
  ```

- [ ] The fake publish endpoint must parse raw bundle bytes and assert:
  - bundle `version === 2`
  - `assets/project-folders/marketing/<sha>.tar.gz` exists
  - summary services are `["app", "openrouter", "storage-s3"]`
  - summary modules include `openrouter`, `storage`, and `marketing`

- [ ] Assert the CLI no longer calls legacy `/v1/orgs/:org/deploy-targets`.

- [ ] Run:

  ```bash
  bun run --filter @rntme/cli test -- platform-client-cv-extract.test.ts
  bun run --filter @rntme/cli test
  ```

- [ ] Commit:

  ```bash
  git add apps/cli
  git commit -m "Test cv extract platform client flow"
  ```

## Task 8: Add Gated Live CV Extract Deploy Smoke Test

**Files:**

- `demo/cv-extract-blueprint/test/live/platform-client-deploy.test.ts`
- `demo/cv-extract-blueprint/scripts/smoke-cv-extract.ts`
- `demo/cv-extract-blueprint/package.json`
- `.github/workflows/ci.yml`

### Steps

- [ ] Add package scripts:

  ```json
  {
    "scripts": {
      "test:live": "bun test test/live/platform-client-deploy.test.ts",
      "smoke": "bun run scripts/smoke-cv-extract.ts"
    }
  }
  ```

- [ ] Live test must skip unless all env vars are present:

  ```ts
  const required = [
    "RNTME_LIVE_DEPLOY",
    "RNTME_PLATFORM_URL",
    "RNTME_PLATFORM_TOKEN",
    "RNTME_ORG",
    "RNTME_PROJECT",
    "RNTME_TARGET",
    "RNTME_CV_BASE_URL",
    "OPENROUTER_API_KEY",
    "RNTME_OPENROUTER_IMAGE",
    "RNTME_STORAGE_S3_IMAGE"
  ];
  ```

- [ ] The live target config must include:

  ```json
  {
    "modules": {
      "openrouter": {
        "image": "${RNTME_OPENROUTER_IMAGE}",
        "secretRefs": { "OPENROUTER_API_KEY": "openrouter-api-key" }
      },
      "storage-s3": {
        "image": "${RNTME_STORAGE_S3_IMAGE}"
      },
      "marketing": {
        "primaryDomain": "cv.example.com",
        "ssl": "auto"
      }
    },
    "storage": {
      "mode": "provisioned",
      "provider": "rustfs",
      "publicBaseUrl": "https://files.example.com",
      "accessKeyRef": "rustfs-access-key",
      "secretKeyRef": "rustfs-secret-key"
    }
  }
  ```

- [ ] The smoke script must call the app API endpoints created in Task 2:

  ```ts
  const prepare = await postJson(`${baseUrl}/api/files/prepare-upload`, {
    filename: "sample-resume.pdf",
    mediaType: "application/pdf",
    declaredSize: samplePdfBytes.byteLength
  });
  await putFile(prepare.uploadUrl, samplePdfBytes, "application/pdf");
  await postJson(`${baseUrl}/api/files/commit-upload`, { fileId: prepare.fileId });
  const created = await postJson(`${baseUrl}/api/resumes`, {
    resumeId: prepare.resumeId,
    filename: "sample-resume.pdf",
    mediaType: "application/pdf",
    fileId: prepare.fileId,
    objectKey: prepare.objectKey
  });
  const resume = await pollUntilComplete(`${baseUrl}/api/resumes/${created.resumeId}`);
  ```

- [ ] Assert `resume.extractedJson`, `resume.downloadUrl`, and `resume.fileId` are non-empty.

- [ ] Add a manual-dispatch CI job disabled by default.

- [ ] Run locally without env and confirm skip:

  ```bash
  bun run --filter @rntme/demo-cv-extract-blueprint test:live
  ```

- [ ] Commit:

  ```bash
  git add demo/cv-extract-blueprint .github/workflows/ci.yml
  git commit -m "Add gated cv extract live deploy smoke test"
  ```

## Task 9: Update Owner Docs and Decision Canon

**Files:**

- `docs/current/owners/demo/cv-extract-blueprint.md`
- `docs/current/owners/apps/cli.md`
- `docs/current/owners/apps/platform.md`
- `docs/current/owners/packages/artifacts/bindings.md`
- `docs/current/owners/packages/artifacts/blueprint.md`
- `docs/current/owners/packages/platform/deploy-bundle-input.md`
- `docs/current/owners/packages/deploy/deploy-core.md`
- `docs/current/owners/packages/deploy/deploy-runner.md`
- `docs/current/owners/packages/deploy/deploy-dokploy.md`
- `docs/current/owners/packages/runtime/runtime.md`
- `docs/current/owners/modules/marketing-site.md`
- `docs/current/owners/packages/contracts/marketing-site.md`
- `docs/current/owners/modules/storage/s3.md`
- `docs/decision-system.md`

### Steps

- [ ] Document the CV extract service/module shape:

  ```md
  - `project.services` lists `app`, `openrouter`, and `storage-s3`.
  - `project.modules.storage` uses `@rntme/storage-s3`; the deploy workload image lives at `target.modules.storage-s3.image`.
  - `project.modules.marketing` is a hosted module facet, not a service.
  ```

- [ ] Document CLI API paths:

  ```md
  | Command | API |
  | --- | --- |
  | `project publish` | `POST /api/projects/{projectId}/versions` with `application/rntme-project-bundle+json` bytes |
  | `project deploy` | `POST /api/deployments` with `projectVersionSeq` and `targetSlug` |
  | `target *` | `/api/deployments/targets` |
  ```

- [ ] Document binding native operation support and `inputFrom.bodyBytes`.

- [ ] Document runtime module wiring: graph `call` module targets are scanned into manifest modules, using canonical contract proto sources.

- [ ] Document marketing project-folder packaging and target-owned static-site hosting.

- [ ] Add a decision-system current-state line:

  ```md
  - Marketing static sites authored from project folders are packaged as canonical project bundle assets and hosted by deploy target adapters; marketing module authoring config does not reference target-owned bundle storage, registry, or Dokploy credentials.
  ```

- [ ] Run:

  ```bash
  bun run lint
  ```

- [ ] Commit:

  ```bash
  git add docs
  git commit -m "Document cv extract platform deploy flow"
  ```

## Task 10: Full Verification

### Steps

- [ ] Run CI-equivalent checks:

  ```bash
  bun run build
  bun run typecheck
  bun run test
  bun run lint
  bun run depcruise
  bun run vendor:check
  ```

- [ ] Run focused checks:

  ```bash
  bun run --filter @rntme/demo-cv-extract-blueprint test
  bun run --filter @rntme/cli test -- platform-client-cv-extract.test.ts
  bun run --filter @rntme/demo-cv-extract-blueprint test:live
  ```

- [ ] When live credentials are available, run:

  ```bash
  RNTME_LIVE_DEPLOY=1 bun run --filter @rntme/demo-cv-extract-blueprint test:live
  ```

- [ ] Record in final handoff:
  - published project version sequence
  - deployment id
  - target slug
  - app base URL
  - marketing URL
  - smoke result

## Documentation Touch Evaluation

- `docs/decision-system.md`: update required because project-folder static hosting becomes a deploy convention.
- Local README stubs: update only if current-doc links or command hints change.
- `docs/current/owners/**`: update required for CV extract, CLI, platform, bindings, blueprint, deploy-bundle-input, deploy-core, deploy-runner, deploy-dokploy, runtime, marketing, and storage S3.
- `docs/current/guides/**`: update not required unless implementation adds a new authoring guide.
- `docs/README.md`: update not required because navigation does not change.
- `AGENTS.md`: update not required because repo navigation, workflow, layering, and lookup paths do not change.
- `README.md`: update not required because public positioning and quick start do not change.
- `CLAUDE.md`: update not required because bootstrap instructions and command list do not change.

## Final Handoff Checklist

- `demo/cv-extract-blueprint` composes with services `app`, `openrouter`, and `storage-s3`.
- `marketing` is only `project.modules.marketing`.
- `project.modules.storage` uses `@rntme/storage-s3`; `target.modules.storage-s3.image` configures the runnable storage workload.
- Storage upload, commit, download URL, and extraction endpoints use the current binding and Graph IR formats.
- Runtime manifests include `openrouter` and `storage` module clients with canonical proto files.
- Marketing landing folder is packaged as a canonical project bundle asset.
- Marketing module no longer requires `bundleStorage`, `registry`, or `dokploy` secrets for the project-folder path.
- Deploy-dokploy hosts the marketing static site through target-owned resources.
- `project publish` sends raw bundle bytes to `/api/projects/{projectId}/versions`.
- `project deploy` starts deployment from `projectVersionSeq` plus `targetSlug`.
- Target CRUD uses `/api/deployments/targets`.
- Fake platform-client e2e passes.
- Live smoke test skips without env and passes with credentials.
- CI-equivalent checks pass.
