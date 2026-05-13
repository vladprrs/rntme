# @rntme/deploy-core

Target-neutral project deployment planning for rntme.

## Role

`deploy-core` accepts an already validated/composed project model and produces a
`ProjectDeploymentPlan`. It does not read raw blueprint folders, collect
secrets, call Dokploy, or run browser verification.

On the platform path, the `runDeployment` BPMN process invokes
`@rntme/deploy-runner` stage handlers, which fetch and revalidate an
immutable project-version bundle, convert the saved deploy target into
`ProjectDeploymentConfig`, and then call this package before handing the plan
to a target adapter. The CLI direct-deploy path drives the same runner stages
without the BPMN orchestration.

deploy-core consumes manifest types from `@rntme/contracts-module-v1`
(`ModuleManifest`, `ProvisionerBlock`, etc.) and the provisioner runtime
contract from `@rntme/contracts-provisioner-v1` (`ProvisionerContract`,
`ProvisionerInput`/`Output`, `ProvisionerLog`, `ProvisionerVendorError`,
`ProvisionerEnvMapping`, `ResolvedEnvEntry`). deploy-core re-exports those
contract types for convenience. The runtime helpers `runProvisioners` and
`resolveEnvMappings` live here.

## Public API

- `buildProjectDeploymentPlan(project, config, options?)` — creates a preview deployment
  plan or returns `DEPLOY_PLAN_*` errors. See "Two-pass plan API" below for `options`.
- `ProjectDeploymentConfig` — org/environment/mode, event bus,
  workflow engine/worker config, integration module image config, backend auth config, and policy values.
- `ComposedProjectInput` — deploy-relevant structural subset of the composed
  project model.
- `resolveVars(manifest, target, options?)` — resolve every `target.*` and (when
  `options.provisionResult` is given) `provision.*` binding to a `ResolvedVars`
  string map. Used inside `buildProjectDeploymentPlan`.
- `resolveTargetVarsOnly(manifest, target)` — partial resolver used pre-provision
  to substitute target-derived placeholders (e.g. `${AUTH0_REDIRECT_URI}` from
  `target.auth.auth0.redirectUri`) into module `publicConfig` before passing it
  to provisioners. `provision.*` bindings are filtered out and any matching
  placeholders remain as `${VAR}` literals.
- `applyVars(value, vars)` — recursive `${VAR}` substitution into strings,
  objects, and arrays. Missing placeholders are left intact.
- `targetForVars(config, fallbackSlug)` — projects a `ProjectDeploymentConfig`
  into the `TargetForVars` shape consumed by the resolvers.

## Var sources

Blueprint `vars` may pull values from three sources, selected by the `from` string prefix:

- `target.<root>.<...>` — read from `ProjectDeploymentConfig`'s typed shape (e.g., `target.auth.auth0.domain`). Resolved at every plan call. Also resolvable
  pre-provision via `resolveTargetVarsOnly`, so module `publicConfig` can carry
  `${VAR}` placeholders for target-derived fields the provisioner needs (such
  as the SPA `redirectUri` Auth0 reconciles against).
- `provision.<moduleKey>.<output>.<jsonPointer>` — read from a provisioner's `publicOutputs`. **Requires** `buildProjectDeploymentPlan` to be called with `options.provisionResult` populated. The executor sequences provision before plan to make this possible.
- `env.<NAME>` — (future) read from process env. Not implemented yet.

`<moduleKey>` is the local key from `project.json#modules`, not the package name. `<output>` must be declared in `module.json#provisioner.produces`. The plan validates these at resolve time and emits one of:

- `BLUEPRINT_VAR_PROVISION_PATH_INVALID` (syntax wrong)
- `BLUEPRINT_VAR_PROVISION_MODULE_MISSING` (key not in project.json#modules)
- `BLUEPRINT_VAR_PROVISION_OUTPUT_NOT_DECLARED` (output not in produces)
- `BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING` (provisioner didn't run for this module)
- `BLUEPRINT_VAR_PROVISION_PATH_NOT_FOUND` (JSON pointer dead-ends)

## Two-pass plan API

`buildProjectDeploymentPlan(input, config, options?)` accepts:
- `options.provisionResult: { modules: { [key]: { publicOutputs } } }` — output of the provisioner stage.
- `options.discoveredModules: { [key]: { producesNames } }` — used to validate `provision.*` paths against declared outputs.

Callers without `provision.*` vars can omit `options`; behavior is identical to a pre-options call.

## Event bus modes, auth, and SASL

`ProjectDeploymentConfig.eventBus` supports two Kafka-compatible modes:

- `{ kind: "kafka", mode: "external", brokers, security? }` for an already provisioned Kafka/Redpanda endpoint. Omitted `mode` is normalized to `"external"` for backward compatibility.
- `{ kind: "kafka", mode: "provisioned", provider: "redpanda", image?, topicPrefix? }` for a target-local provisioned bus. The first implementation is Redpanda on Dokploy. The planner derives the internal broker address and persistent volume identity.

`ExternalEventBusConfig.security` is a discriminated union:

- `{ protocol: "plaintext" }` for unauthenticated Kafka-compatible endpoints.
- `{ protocol: "sasl_ssl", mechanism, secretRefs }` for managed Redpanda/Kafka.
  `mechanism` must be `scram-sha-256` or `scram-sha-512`; `secretRefs.username`
  and `secretRefs.password` are required and are secret names, not secret values.

Provisioned Redpanda is internal-only plaintext in this design. Cleanup/deprovisioning is a separate future workflow.

Optional **Redpanda Console (manual validation access)** (`ProjectDeploymentConfig.manualAccess.redpandaConsole`) plans an internal Console workload plus an nginx Basic Auth proxy with public ingress only when the event bus is `provisioned` Redpanda. The plan carries secret **names/ref** (`htpasswdSecretRef`) and pinned Console image identifiers; decrypted values resolve only during platform apply.

## Object storage planning

`ProjectDeploymentConfig.storage` supports:

- `{ mode: "external" }` or omitted, which leaves object storage to module provisioners and target secrets.
- `{ mode: "provisioned", provider: "rustfs", publicBaseUrl, accessKeyRef, secretKeyRef, image? }`, which plans one target-local RustFS resource per `org/project/environment`.

Provisioned RustFS plans `infrastructure.objectStorage` with a deterministic
internal endpoint, public S3 origin, project bucket, `us-east-1`, path-style
access, a persistent volume, and credential refs. The MVP does not add an
infrastructure-before-provisioner phase; storage-s3 performs a startup ensure
bridge for bucket/CORS/lifecycle.

## Domain-service SQLite persistence

Domain services are ephemeral by default. A `ComposedProjectInput` service may
opt into runtime SQLite persistence with:

```ts
{
  persistence: {
    mode: 'persistent',
    eventStorePath: '/srv/data/events.sqlite',
    qsmPath: '/srv/data/qsm.sqlite'
  }
}
```

The planner turns that request into a deterministic writable volume named from
`rntme-<org>-<project>-<service>-data`, mounted at `/srv/data`, and carries the
explicit event-store/QSM paths into the workload. The current platform deploy
conversion uses this only for the `rntme-platform` `tokens` service so platform
PAT rows survive runtime image redeploys.

## BPMN workflow planning

`ComposedProjectInput.workflows` carries the validated project-level
`@rntme/workflows` artifact, and `ComposedProjectInput.workflowFiles` carries
the referenced BPMN XML contents keyed by project-relative path under
`workflows/`.

When a project has workflows, `ProjectDeploymentConfig.workflows` is required:

```ts
{
  engine: { kind: 'operaton', mode: 'provisioned', image: '...' },
  worker: { image: '...' }
}
```

The planner writes `plan.infrastructure.workflowEngine` as either
`{ kind: "none" }` or a provisioned Operaton resource with an internal base
URL. Workflow projects require a provisioned Kafka-compatible event bus in the
MVP so message starts can subscribe to `rntme.{svc}.{agg}` topics.

The planner also adds one `bpmn-worker` workload. It receives the worker image,
`/srv/workflows/workflows.json`, the BPMN files, event subscriptions derived
from `messageStarts[]`, and action binding targets derived from
`serviceTasks[]`. Each service task target includes the deterministic internal
domain-service gRPC endpoint, for example
`rntme-acme-order-fulfillment-inventory:50051`.

Workflow service tasks can target only domain services with a generated gRPC
runtime surface. If a task's binding ref points at a missing service or a
non-domain service, planning fails with
`DEPLOY_PLAN_WORKFLOWS_BINDING_GRPC_UNAVAILABLE`.

### Operaton UI access

`workflows.operatonUi` is **target config**, not blueprint. It is stored on the
deploy target and passed through `ProjectDeploymentConfig.workflows`:

```ts
{
  engine: { kind: 'operaton', mode: 'provisioned', image: '...' },
  worker: { image: '...' },
  operatonUi: {
    enabled: true,
    publicBaseUrl: 'https://operaton.acme.example.test',
    auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' }
  }
}
```

`operatonUi.enabled` triggers UI access planning only when the workflow engine
is a provisioned Operaton. The planner writes `workflowEngine.uiAccess` into the
plan infrastructure and adds the referenced secret to `requiredTargetSecrets`.

deploy-core **never reads target secret values**. It only records which secrets
are required (`secretRef`, `schema`, `purpose`) so the platform executor can
fetch, decrypt, and validate them before render/apply.

Planning fails with one of the following if the UI access config is invalid:

- `DEPLOY_PLAN_WORKFLOWS_UI_REQUIRES_OPERATON` — `operatonUi.enabled` is set but
the engine is missing or not `kind: 'operaton', mode: 'provisioned'`.
- `DEPLOY_PLAN_WORKFLOWS_UI_PUBLIC_URL_MISSING` — `publicBaseUrl` is empty or
missing.
- `DEPLOY_PLAN_WORKFLOWS_UI_AUTH_SECRET_MISSING` — `auth.secretRef` is empty or
missing.
- `DEPLOY_PLAN_WORKFLOWS_OPERATON_ADMIN_SECRET_MISSING` —
`engine.adminUserSecretRef` is present but empty.

### Edge auth

`mounts: [...].use: ["auth"]` declares an `auth` middleware with an ordered
`providers[]` list. The planner walks each provider in order and emits one
`EdgeAuthProvider` entry per provider on the resulting `EdgeMiddleware`. nginx
authorizes when the first provider returns 200 and falls through to the next
provider on 401 (see `@rntme/deploy-dokploy`).

Per-provider planning enforces:

- The provider entry resolves to either a module-backed provider (`auth0`) or a
  domain-service provider (`platform-tokens`).
- For module-backed providers, an integration-module workload exists for
  `moduleSlug` and its `module.json#capabilities.edgeAuth` declares an HTTP
  introspection endpoint (today only `kind: "introspection-sidecar"` is
  supported).
- For Auth0 providers, `AUTH0_DOMAIN` env is set on the workload.
- For `platform-tokens`, the provider supplies `moduleSlug`, `introspectPath`,
  and `introspectPort`, and the planner reuses those values verbatim — there is
  no module proto/sidecar to look up.

Errors are indexed by provider position to keep nested causes actionable:

- `DEPLOY_PLAN_AUTH_MIDDLEWARE_PROVIDERS_EMPTY` — `providers[]` is missing or empty.
- `DEPLOY_PLAN_AUTH_PROVIDER_INCOMPLETE` (at `providers[i]`) — required fields missing.
- `DEPLOY_PLAN_AUTH_MODULE_WORKLOAD_MISSING` — no integration-module workload for `moduleSlug`.
- `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` — module does not declare `capabilities.edgeAuth`.
- `DEPLOY_PLAN_AUTH_MODULE_ENV_INCOMPLETE` — Auth0 provider missing `AUTH0_DOMAIN`.

Each planned `EdgeAuthProvider` carries `moduleSlug`, the introspection port and
path, and any forwarded headers (`X-Rntme-Audience` for Auth0 providers). Public
SPA config still comes from the composed project `publicConfigJson` sidecar, not
from deployment auth settings.

```json
{
  "kind": "auth",
  "providers": [
    {
      "provider": "platform-tokens",
      "moduleSlug": "platform-tokens",
      "introspectPath": "/api/tokens/introspect",
      "introspectPort": 3000
    },
    {
      "provider": "auth0",
      "audience": "https://notes.example.com/api",
      "moduleSlug": "identity-auth0"
    }
  ]
}
```

On the platform executor path, composed project module aliases are mapped through the catalog's canonical module manifest name before planning. For example, a project package alias `rntme_identity_auth0` with catalog category `identity -> @rntme/identity-auth0` still provides `modules["identity-auth0"].edgeAuth` to the planner. Blueprint composition rejects mounted auth middleware before deploy if the canonical module manifest lacks `capabilities.edgeAuth` for any module-backed provider.

## Where to look first

- `src/plan.ts` — deployment plan and workload construction.
- `src/edge.ts` — route and middleware planning.
- `src/config.ts` — target-neutral deployment config types.

Run package gates from `packages/deploy/deploy-core` with `bun test`,
`bun run typecheck`, `bun run build`, and `bun run lint`.

## Specs

- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md`
- `docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md`
- `docs/history/specs/historical/2026-05-01-provisioned-event-bus-design.md`
- `docs/history/specs/historical/2026-05-05-provisioned-bpmn-operaton-design.md`

## Provision phase

`runProvisioners(input)` runs each module's provisioner sequentially. It is invoked by the platform deploy executor before `plan` (so blueprint vars can resolve `provision.*` outputs at plan time) and before `render`. The function:

1. Iterates `modules[]` and skips entries without a `provisioner` block.
2. Asserts every `requires[].name` is present in `resolvedTargetSecrets`. Missing → `DEPLOY_PROVISION_TARGET_SECRET_MISSING`.
3. Calls `resolveProvisioner(packageName, entry)` (caller-supplied dynamic-import shim) to load the contract.
4. Awaits `contract.provision({ publicConfig, targetSecrets, priorOutputs?, log, signal })` with a per-module abort signal honoring `provisioner.timeoutMs`.
5. Validates the returned output against the declared `produces[]`: every name present, kind matches (`single` → object, `many` → array), `secret` flag matches the bucket the value lives in.
6. Returns aggregated `ProvisionedModule[]`. The platform persists these on `deployment.provisionResult` (public) and `deployment.provisionResultCiphertext` (secret).

The companion helper `resolveEnvMappings(modules, mapping)` projects provisioner outputs into env entries the renderer bakes into runtime resources.

Error codes live in `errors-provision.ts`. Vendor-side failures (e.g. an Auth0 5xx) are wrapped under `DEPLOY_PROVISION_VENDOR_FAILED` while preserving the vendor error message.

## Resolver signature

`resolveProvisioner(packageName: string, entry: string, projectDir: string) => Promise<ProvisionerContract>`

Implementations should ignore `entry` at runtime in favor of a stable
convention from `manifest.name` rooted at `projectDir`. The
`@rntme/deploy-runner` implementation
(`src/handlers/platform-context.ts`) uses
`<projectDir>/assets/provisioners/${safeProvisionerName(packageName)}.entry.js`.

## Integration module images

Integration-module services (`service.kind === 'integration-module'`) must
have an image declared at `target.modules.<moduleSlug>.image` in the deploy
target config (e.g., `target.modules.storage-s3.image` for the
`@rntme/storage-s3` workload). Planning maps the service's
`moduleKey`/slug to that entry and fails with
`DEPLOY_PLAN_MISSING_MODULE_IMAGE` (per offending service slug) when no
matching image is configured. The marketing module facet is exempt because
its workload is rendered as a static-site by the target adapter, not as a
runnable integration-module image.

## MVP limits

- Only `mode: "preview"` is supported.
- Only `environment: "default"` is supported.
- Production mode is rejected until persistence and deployment records are
  designed for the production path.
- Integration modules require explicit image config.
