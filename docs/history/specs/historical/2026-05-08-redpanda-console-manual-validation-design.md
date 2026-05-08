> Status: historical.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, .dependency-cruiser.cjs, and current code/tests.
> Why retained: Completed design rationale for Redpanda Console manual validation access; implementation landed via PR #167 and current truth is code/tests plus current owner docs.

# Redpanda Console Manual Validation Access - design

**Issue:** RNT-466 / root backlog RNT-462.
**Stage:** SPEC.
**Scope:** design only; no product code implementation.

## 1. Problem

Provisioned Redpanda is now available for preview Dokploy deployments, but the
broker is intentionally internal-only. That is correct for runtime safety, yet
manual validation of event-bus flows is still awkward: an operator cannot easily
inspect topics, consumer groups, and CloudEvents payloads after a deploy.

The missing capability is safe, explicit access to Redpanda Console for preview
manual validation without turning the project broker into a public service,
leaking Kafka credentials, or adding another authoring concept to blueprints.

## 2. Goals

- Provide opt-in Redpanda Console access for deployments whose event bus is
  `kind: "kafka", mode: "provisioned", provider: "redpanda"`.
- Keep the Redpanda broker, Kafka port `9092`, and Redpanda Admin API
  non-public.
- Require an auth boundary before any browser can reach Console.
- Keep plaintext credentials out of rendered plans, apply results, logs, docs,
  and issue comments.
- Use the existing deploy plan/render/apply pipeline and Dokploy resource model.
- Preserve the runtime event-bus env contract:
  `RNTME_EVENT_BUS_BROKERS`, `RNTME_EVENT_BUS_PROTOCOL`, and optional
  `RNTME_EVENT_BUS_TOPIC_PREFIX` stay unchanged for domain services and BPMN
  workers.

## 3. Non-goals

- No production observability/admin console design.
- No public Kafka listener, SASL/TLS for provisioned Redpanda, or Redpanda
  Admin API exposure.
- No new blueprint artifact, module contract, or provisioner contract.
- No dependency on Redpanda Console Enterprise/OIDC features.
- No automatic expiry scheduler in the MVP. Disabling access and redeploying
  removes the resources; later platform cleanup automation can shorten this.

## 4. Current context

Current docs/code establish these boundaries:

- `deploy-core` plans provisioned Redpanda as target-neutral infrastructure with
  deterministic `resourceName`, internal brokers, pinned image validation, and a
  persistent named volume.
- `deploy-dokploy` renders provisioned Redpanda as a Dokploy Compose resource
  attached to `dokploy-network` with no public domain or external port.
- Runtime and BPMN worker containers receive only Kafka-compatible env vars.
  Provisioned Redpanda is plaintext because it is internal to the target network.
- External Kafka credentials, when used, are secret references; current docs
  explicitly say usernames/passwords must not be logged.
- Platform deploy targets persist the event-bus shape and build
  `ProjectDeploymentConfig`; module provisioners run before plan/render and are
  unrelated to project infrastructure like Redpanda.
- `.dependency-cruiser.cjs` keeps deploy packages from importing runtime and
  keeps modules behind contracts. This design does not require a carve-out.

Redpanda Console docs, checked through Context7 `/redpanda-data/console`, show:

- Docker/self-hosted Console can connect with `KAFKA_BROKERS`.
- Console supports server config such as listen address, listen port, base path,
  and forwarded-prefix handling.
- Console supports Kafka TLS/SASL, but provisioned Redpanda currently does not
  need those because it is internal plaintext.
- OAuth/OIDC login is documented as enterprise auth. The OSS-safe MVP should not
  rely on Console itself being the auth boundary.

## 5. Decision-system fit

Applicable goals, filters, and bets:

- **G3 / F4 Inspectable runtime:** Console is a human inspection surface for
  event-bus flows. It improves inspectability without asking humans to read
  JSON artifacts.
- **G1 / F6 Repeatability:** Access is explicit deploy-target/deployment config;
  identical inputs produce identical resources. No hidden boot-time flag opens
  Console.
- **G4 / F1 Lean core:** This is deployment infrastructure, not blueprint core
  and not a module capability needed by every service.
- **G5 / F2 Canonical-way:** Reuses `ProjectDeploymentPlan.infrastructure`,
  `RenderedDokployResource`, labels, apply ordering, and secret redaction rather
  than inventing a separate admin deploy path.
- **F3 Contract boundary:** No vendor SDK or Redpanda Console type crosses into
  contracts; no provisioner contract change.
- **F8 Standards/libraries:** Uses Redpanda Console and Nginx instead of a custom
  Kafka inspection UI.
- Locked/current bets: Kafka-compatible protocol, Redpanda as current default,
  Dokploy as current default, provisioner contract, dependency-cruiser layering.

No contradiction with Goals, Filters, or locked/current Bets was found. No
`docs/decision-system.md` change or `rntme decisions` escalation is required.

## 6. Proposed design

Add an explicit manual-access config under deploy target/deployment config:

```ts
type RedpandaConsoleAccessConfig = {
  readonly enabled: boolean;
  readonly image?: string;
  readonly publicBaseUrl?: string;
  readonly basicAuth: {
    readonly username: string;
    readonly htpasswdSecretRef: string;
  };
};
```

Naming is intentionally not a blueprint concept. The platform owns this as a
deploy-target or deployment override setting, because Console is an operator
inspection surface for deployed infrastructure.

When enabled and the planned event bus is provisioned Redpanda, `deploy-core`
adds target-neutral planned manual-access infrastructure:

```ts
type PlannedRedpandaConsole = {
  readonly kind: "redpanda-console";
  readonly resourceName: string;
  readonly proxyResourceName: string;
  readonly internalUrl: string;
  readonly image: string;
  readonly publicBaseUrl: string;
  readonly basicAuthUsername: string;
  readonly htpasswdSecretRef: string;
};
```

Validation rules:

- Reject Console access unless event bus is provisioned Redpanda.
- Reject missing or blank `basicAuth.username`.
- Reject missing `basicAuth.htpasswdSecretRef`.
- Require a pinned Console image tag; no `latest`.
- Derive a deterministic default public URL when not supplied, for example
  `https://console-<org>-<project>-<environment>.<publicDeployDomain>`.
- Scope to preview/default MVP; production mode is already rejected by deploy
  planning today.

## 7. Dokploy rendering

Render two additional application resources after Redpanda and before the edge
gateway:

1. **Console application**
   - Image: pinned `docker.redpanda.com/redpandadata/console:<tag>`.
   - No ingress/domain.
   - No public port.
   - Env:
     - `KAFKA_BROKERS=<planned-event-bus-resource>:9092`
     - `SERVER_LISTENADDRESS=0.0.0.0`
     - `SERVER_LISTENPORT=8080`
     - `ANALYTICS_ENABLED=false`
   - Labels:
     - normal rntme labels
     - `rntme.infrastructure=redpanda-console`
     - `rntme.access=internal`

2. **Console proxy application**
   - Image: pinned `nginx:1.27-alpine`.
   - Public ingress/domain on `publicBaseUrl`.
   - Mounted Nginx config proxies to the Console app on `http://<console-resource>:8080`.
   - Mounted bootstrap script decodes a secret env var into
     `/etc/nginx/.htpasswd`, then `exec`s `nginx -g 'daemon off;'`.
   - `deploy-dokploy` must add an explicit application command/entrypoint
     field, and the Dokploy client must apply it, so the bootstrap script is
     run deterministically. Do not rely on mounted file executable bits or
     Docker image entrypoint hook behavior unless the implementation first
     proves and tests that Dokploy preserves the required mode bits.
   - Env:
     - `RNTME_CONSOLE_HTPASSWD_B64=<htpasswdSecretRef>`, `secret: true`
   - Nginx config:
     - `auth_basic` required for all paths.
     - forwards `X-Forwarded-*` headers.
     - does not forward `Authorization` to Console.
     - sets conservative request/body limits; Console is for inspection, not
       bulk export.

This keeps rendered plans audit-friendly: the Nginx config and script contain
no plaintext password and no password hash. The secret value is injected only
by the platform/Dokploy secret path.

The apply phase already replaces rendered resource names inside env/files with
Dokploy app network names after target creation. The proxy config should rely on
that mechanism for the Console upstream hostname, the same way current edge
gateway files are resolved.

Because current rendered application resources are workload-backed, the
implementation should add an explicit infrastructure-application render shape
for Console and Console proxy instead of pretending they are domain, integration,
BPMN-worker, or edge workloads. Suggested apply rank:

1. provisioned Redpanda compose;
2. provisioned workflow-engine compose, when present;
3. internal Redpanda Console application;
4. public Console proxy application;
5. domain-service and integration-module workloads;
6. BPMN worker;
7. edge gateway.

## 8. Credentials handling

The platform should generate or accept Console basic-auth material at the
platform boundary:

- Plain password is shown once to the operator or accepted through stdin/UI
  secret input.
- Platform stores only the htpasswd line, encrypted like other deploy target
  secrets. When the platform generates the line, it must use
  `basicAuth.username`; when it accepts an existing line, it must reject a
  username mismatch so logs/UI do not display a different user than Nginx
  accepts.
- Render/apply receives only a secret reference or decrypted secret inside the
  existing Dokploy client closure, never a plaintext password.
- Logs and deployment records show the Console URL, username, and `***` for the
  password/htpasswd secret.
- Redaction patterns should include `htpasswd`, `RNTME_CONSOLE_HTPASSWD_B64`,
  and `consolePassword` before executor logs include this feature.

The Console password protects access to event payloads. Operators should enable
it only on preview/manual-validation deployments and disable/redeploy after
validation when the project data is sensitive.

## 9. Deploy/provisioner flow

The platform deployment stage order remains:

`compose -> plan(bus-mode log) -> provision modules -> plan(with provision results) -> render Dokploy -> apply -> smoke verify`.

Console access slots into plan/render/apply only:

- Module provisioners are unchanged and must not learn about Redpanda Console.
- Redpanda remains the first infrastructure resource.
- Console app and proxy are infrastructure applications that depend on the
  Redpanda resource name.
- Domain services, BPMN worker, module workloads, edge gateway, and smoke
  verifier keep their current contracts.
- Apply ordering should be: compose infrastructure, internal Console app, proxy
  app, domain/integration/workflow workloads, edge gateway. If type constraints
  make this awkward, add explicit infrastructure application ordering rather
  than overloading `DeploymentWorkload`.

Smoke verification should add an optional protected check:

- `GET <console-public-url>/` without auth returns `401`.
- Authenticated content smoke is manual-only; automated tests should not require
  logging into Console or reading topics.

## 10. Alternatives rejected

1. **Expose Redpanda broker or Admin API publicly.** Rejected: violates the
   current internal-only provisioned Redpanda design and increases blast radius.
2. **Expose Console directly as a public Dokploy app.** Rejected: Console docs
   do not give an OSS-safe built-in basic-auth boundary; direct exposure would
   rely on every Console feature being safe by default.
3. **Require Redpanda Console Enterprise/OIDC login.** Rejected for MVP: adds a
   licensing/product dependency and duplicates the platform auth decision.
4. **Tunnel-only access.** Safer, but poorer operator UX and not currently
   modeled by the Dokploy client. It remains an acceptable emergency runbook,
   but the product path should be repeatable through deploy resources.
5. **Make Console a vendor module/provisioner.** Rejected by F1/F2/F3: Console
   is not a blueprint capability and does not belong behind a business contract.

## 11. Docs touch

This spec does not update current docs by itself. A future implementation should
update:

- `docs/current/owners/packages/deploy/deploy-core.md` for the new planned
  manual-access infrastructure and validation errors.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` for Console/proxy
  rendering, auth boundary, apply ordering, and secret handling.
- `docs/current/owners/apps/platform-http.md` for platform-owned credentials,
  deploy target config, executor logs, and UI/API behavior.
- `docs/current/owners/packages/platform/platform-core.md` for deploy target
  schemas, supported deployment overrides, and secret-cipher contract changes.
- `docs/current/owners/packages/platform/platform-storage.md` if new encrypted
  storage fields or migrations are added for Console access credentials.
- Local READMEs only if package commands or current-doc pointers change.
- `docs/decision-system.md` does not need a change.

## 12. Validation and evidence

Evidence checked for this spec:

- `AGENTS.md`, `docs/README.md`, `docs/decision-system.md`.
- Current owner docs for `deploy-core`, `deploy-dokploy`, `provisioner/v1`,
  runtime, event-store, and BPMN worker.
- Local package README stubs for the same surfaces.
- `.dependency-cruiser.cjs`.
- Current code/tests around Redpanda planning/rendering/apply, platform deploy
  target schemas, deployment config construction, Dokploy client behavior, and
  log redaction.
- Historical specs for provisioned event bus and provisioned BPMN/Operaton as
  rationale, not current truth.
- Context7 Redpanda Console docs for Docker/env config and auth capabilities.

Future implementation acceptance gates:

- Unit tests in `deploy-core` reject invalid Console access and plan deterministic
  resource names.
- Unit tests in `deploy-dokploy` render Console and proxy resources with no
  secret values in files, env values marked secret, no direct Console ingress,
  deterministic proxy bootstrap command/entrypoint, and correct resource
  ordering.
- Unit tests in `deploy-dokploy` apply cover command/entrypoint persistence and
  network-name replacement inside the proxy config without exposing the
  htpasswd value.
- Unit tests in `platform-core` validate the persisted access config and reject
  missing auth material.
- Unit tests in `platform-http` cover deploy config construction, secret
  storage/redaction, and executor log output.
- Smoke verifier checks unauthenticated Console URL returns `401` when enabled.
- `pnpm -F @rntme/deploy-core test`,
  `pnpm -F @rntme/deploy-dokploy test`,
  `pnpm -F @rntme/platform-core test`,
  `pnpm -F @rntme/platform-http test`, and `pnpm depcruise`.

## 13. Risks

- Console can display event payloads, which may include sensitive preview data.
  Mitigation: explicit opt-in, protected proxy, no default enablement, and
  disable/redeploy guidance.
- Basic auth is a coarse operator gate, not full RBAC. Mitigation: use only for
  preview/manual validation; revisit SSO/RBAC if Console becomes a persistent
  production surface.
- Long-lived enabled access may be forgotten. Mitigation: deployment UI should
  label it clearly and future cleanup automation can enforce expiry.
- Nginx proxy and Console are two apps; apply ordering and name replacement must
  be tested so the proxy always reaches the internal Console hostname.
- `htpasswd` hashes are attackable if logged. Mitigation: secret env injection
  and expanded redaction before any executor output includes the feature.
