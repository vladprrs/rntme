# @rntme/deploy-dokploy

Dokploy target adapter for rntme project deployments.

## Role

`deploy-dokploy` renders a `ProjectDeploymentPlan` into redacted Dokploy
resources and applies them through an injected Dokploy HTTP client. It does not
load raw blueprints, store platform credentials, or run browser verification.

On the platform path, deploy target credentials are decrypted inside
`@rntme/platform-http`'s Dokploy client factory. This package receives only
redacted target configuration and the injected client seam.

## Public API

- `renderDokployPlan(plan, config)` — creates a redacted Dokploy plan with
  deterministic names, labels, generated Nginx config, and digest.
- `applyDokployPlan(rendered, client)` — upserts Dokploy resources through an
  injected client and returns a structured apply result.
- `DokployClient` — narrow interface for the real HTTP client and tests.

## Apply hardening

Application file mounts are idempotent by `mountPath`: apply lists existing mounts, updates the first matching mount, creates missing mounts, and removes duplicate stale mounts for the same target path. Generated `filePath` values use the platform convention `/etc/dokploy/rntme/<applicationId>/<digest>-<safe-name>` so Dokploy materializes real source files for Swarm bind mounts.

Application lifecycle is `configure -> deploy -> start -> inspect` when the injected client supports inspection. A rejected or failed application task is returned as `DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE`, which causes the platform deployment to finalize as failed.

Existing-resource comparison is typed by resource kind instead of raw object
serialization. Apply compares common fields (`image`, env entries, labels),
then compose `composeFile` or application build/ports/ingress/files. Env vars,
labels, files, ports, and ingress routes are treated as unordered where order is
not semantically meaningful; undeclared Dokploy API fields are ignored. Real
value drift still triggers an update.

Partial failures now perform best-effort cleanup for resources created earlier
in the same apply attempt. Cleanup uses the idempotent delete helper, deletes
applications before compose resources, treats already-missing resources as
warnings, and records the result under `partialFailure.cleanup`. Resources that
already existed and were updated are recorded in `updatedResources` but are not
rolled back because the adapter does not have a prior-state snapshot. `retrySafe`
is `true` only when created-resource cleanup has no errors; cleanup errors are
sanitized the same way as apply errors.

## Provisioned Redpanda

When `plan.infrastructure.eventBus.mode === "provisioned"` and
`provider === "redpanda"`, render adds a Dokploy Compose resource before the
application resources. The compose file starts a single internal Redpanda
broker on port `9092`, uses a deterministic persistent named volume, and does
not expose a public domain or external broker port. The Redpanda service is
attached to both `default` (compose-internal) and the external
`dokploy-network` so swarm-service apps can resolve the broker by its
network alias (full container name, set via `apply.ts` networkNameMap from
the Dokploy-assigned compose appName).

Domain-service workloads receive:

- `RNTME_EVENT_BUS_BROKERS=<provisioned-resource>:9092`
- `RNTME_EVENT_BUS_PROTOCOL=plaintext`
- optional `RNTME_EVENT_BUS_TOPIC_PREFIX`

Apply creates or updates compose resources before applications. It does not
wait for Kafka protocol readiness; runtime bus clients must tolerate broker
warm-up. For provisioned Redpanda, the rendered compose attaches the broker to
`dokploy-network` with the planned resource name as an alias and pre-creates
workflow message-start topics before waiting on the Redpanda process. This
covers BPMN workers and older runtime images that subscribe or publish before
the first automatic topic creation would otherwise happen.

## Provisioned RustFS object storage

When `plan.infrastructure.objectStorage.kind === "s3-compatible"` and
`provider === "rustfs"`, render adds:

- a RustFS Compose resource on `dokploy-network`;
- a persistent named volume;
- secret env entries for `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY`;
- a public Nginx proxy application bound to `storage.publicBaseUrl`;
- `STORAGE_S3_*` env entries on `@rntme/storage-s3` integration-module workloads.

The public proxy preserves the browser-facing `Host` header so presigned URLs
are validated against the public storage origin. File bytes do not flow through
the rntme runtime or edge gateway.

## Provisioned Operaton and BPMN worker

When `plan.infrastructure.workflowEngine.kind === "operaton"`, render adds a
Dokploy Compose resource before application resources. The compose file starts
the configured Operaton image on the internal `dokploy-network`; it is not
publicly exposed by this adapter.

When the plan contains a `bpmn-worker` workload, render creates an application
resource after domain services/modules and before the edge gateway. The worker
receives:

- `RNTME_OPERATON_BASE_URL=<workflow-engine-internal-url>`
- `RNTME_WORKFLOWS_MANIFEST_PATH=/srv/workflows/workflows.json`
- `RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON=<binding-ref-to-grpc-endpoint JSON>`
- event-bus env entries matching the planned Kafka/Redpanda mode
- file mounts under `/srv/workflows/` for `workflows.json` and every referenced BPMN file

`RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON` is non-secret and generated from the
rendered Dokploy domain-service names, for example
`{"inventory.reserveStock":"rntme-acme-order-fulfillment-inventory:50051"}`.
If a BPMN task targets a missing or non-domain service, render fails with
`DEPLOY_RENDER_DOKPLOY_WORKFLOW_SERVICE_ENDPOINT_UNAVAILABLE`.

Worker file paths are validated as relative paths below `/srv/workflows`; empty
segments, parent traversal, absolute paths, backslashes, and URL-scheme paths
are rejected during render.

## Operaton UI gateway

When `plan.infrastructure.workflowEngine.uiAccess` is present, render adds a
separate Dokploy **application** resource (`operaton-ui-gateway`) with its own
Dokploy application ingress. This is distinct from the `workflow-engine` Compose
resource, which remains internal-only on `dokploy-network` and is never publicly
exposed. Direct public Compose exposure is forbidden by design.

The gateway runs `nginx:1.27-alpine` and proxies to the internal Operaton
service. Nginx Basic Auth (`auth_basic`) is enforced before proxying. The
`.htpasswd` file is declared as a `secretFiles` mount:

```ts
secretFiles: {
  '/etc/nginx/.htpasswd': {
    schema: 'basic-auth-v1',
    secretRef: engine.uiAccess.authSecretRef,
    field: 'htpasswd',
  }
}
```

Secret files are rendered as **references** (`schema` + `secretRef` + `field`).
The values are resolved only inside the platform client's Dokploy client
factory, which decrypts the target secret and mounts the resolved content as a
Dokploy application file. The render/apply packages never see secret values.

### Edge gateway and Operaton UI ingress ordering

The edge gateway handles project-level routes (UI, APIs, modules). The
`operaton-ui-gateway` application has its own independent Dokploy ingress with
`publicBaseUrl` from `uiAccess`. Both ingresses are rendered and applied;
smoke checks verify the Operaton UI URL returns `401` for no-auth and invalid
Basic Auth before the deployment is marked successful.

## Provisioner outputs in render

`renderDokployPlan` accepts optional `provisionedModules` (a map of module slug to `ProvisionerOutput`) and `envMappings` (an array of `EnvMapping` entries produced by `resolveEnvMappings` in `@rntme/deploy-core`). When present, render bakes provisioner outputs into the env entries of the relevant resource definitions before computing the plan digest. The digest therefore covers provisioned values: re-rendering with different provisioner outputs produces a different digest and forces a re-apply.

## Where to look first

- `src/render.ts` — redacted Dokploy resource rendering and digesting.
- `src/nginx.ts` — generated Nginx edge config.
- `src/apply.ts` — idempotent apply flow through an injected client.
- `src/client.ts` — narrow Dokploy client seam.

## Auth and external event bus rendering

Domain-service workloads always receive `RNTME_EVENT_BUS_BROKERS` and
`RNTME_EVENT_BUS_PROTOCOL`. When the deployment plan uses
`security.protocol: "sasl_ssl"`, render adds:

- `RNTME_EVENT_BUS_MECHANISM`
- `RNTME_EVENT_BUS_USERNAME` with `secret: true`
- `RNTME_EVENT_BUS_PASSWORD` with `secret: true`
- optional `RNTME_EVENT_BUS_TOPIC_PREFIX`

The runtime applies its own KafkaJS connection-timeout default for external
brokers. Targets that need a non-default handshake budget can provide
`RNTME_EVENT_BUS_CONNECTION_TIMEOUT_MS` as an additional service env var.

The username/password values are secret references, not plaintext credentials.

## Delete helper

`deleteDokployResources` accepts sanitized apply-result resources and removes
Dokploy resources idempotently. Compose resources are deleted before
applications and use `deleteVolumes: true` for explicit project
decommissioning. Missing resources are treated as warnings; real API failures
are returned so callers can leave the project in `delete_failed` and retry.

When `kind: "auth"` middleware is mounted on a domain-service route, render
adds `RNTME_AUTH_PROVIDER`, `RNTME_AUTH_AUDIENCE`, `RNTME_AUTH_MODULE_SLUG`,
and `RNTME_AUTH_MODULE_ENDPOINT=<module-resource>:50051` to that domain
service. It also generates public `/srv/config.json` with Auth0 `domain`,
`clientId`, `audience`, and `redirectUri` from the composed blueprint
`publicConfigJson` sidecar, keyed by module package name. The file must contain
only public SPA values. The same sidecar is mounted into the edge gateway, and
Nginx serves browser `GET /config.json` directly from that mounted file.

### Edge auth rendering

For each `kind: "auth"` middleware in the plan, the renderer emits:

1. An `upstream rntme_auth_<slug>__<audHash>` block pointing at `<module-resource>:<introspectPort>`. The audience hash (`first 8 hex chars of sha256(audience)`) lets a future project mount the same module image with different audiences without colliding.
2. An internal `location = /_rntme_auth_<slug>__<audHash>` that forwards the `Authorization` header and a literal `X-Rntme-Audience` header to the module HTTP introspection endpoint. The location strips the request body (`proxy_pass_request_body off`) — `auth_request` never forwards body.
3. On every route mounted with `kind: "auth"`: an `auth_request` directive, two `auth_request_set` lines capturing `X-Rntme-User-Sub` / `X-Rntme-User-Audience` from the introspection response, and an `error_page 401 = @rntme_auth_401_<slug>__<audHash>` so the 401 body is canonical JSON regardless of upstream.
4. A named `location @rntme_auth_401_<slug>__<audHash>` returning `401 application/json` with body `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}`.

Nginx itself does not validate JWTs. The module HTTP endpoint does (Auth0: JWKS verification; WorkOS/Clerk: API call). Provider-swap is therefore purely an image change — the rendered nginx config is parameterized by `moduleSlug`, `audience`, and `moduleIntrospectPort` only.

Runtime continues to call gRPC `IntrospectSession` itself for the canonical `Session` shape (defence in depth); edge sets `X-Rntme-User-Sub` / `X-Rntme-User-Audience` headers as advisory hints.

### Edge auth invariants

The named 401 fallback is the only canonical 401 body for protected routes. If a client sees a 401 with a `reason` field on a protected route, the request bypassed nginx and reached backend operation execution directly — investigate.

## Specs

- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md`
- `docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md`
- `docs/history/specs/historical/2026-05-01-provisioned-event-bus-design.md`
- `docs/history/specs/historical/2026-05-05-provisioned-bpmn-operaton-design.md`

## Security

Rendered plans and apply results must not contain secret values. The package
never accepts secret values as input: secrets are closed over inside the
injected `DokployClient` implementation and never enter render or apply
argument surfaces. Leak-prevention is structural for render/apply inputs; apply
error cause serialization also redacts common credential-bearing fragments from
client error messages while preserving non-secret diagnostic context.

### Redpanda Console (manual validation)

When `manualAccess.redpandaConsole` is enabled in the upstream deployment input, rendering adds an internal Console application wired to the provisioned broker and a sibling `nginx` proxy with public ingress. The proxy uses `auth_basic_user_file /etc/nginx/.htpasswd`, populated at container start from `RNTME_CONSOLE_HTPASSWD_B64` (target secret resolved at apply — not embedded in rendered plan JSON). Dokploy workloads may declare explicit `command` / `args` for this bootstrap pattern.
