# Provisioned Event Bus - design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-01
**Related:**
- `docs/superpowers/specs/done/2026-04-24-project-deployment-pipeline-design.md` - project deployment pipeline. This spec changes D13/D14 by adding an explicit provisioned event bus path while preserving external Kafka/Redpanda.
- `docs/superpowers/specs/done/2026-04-26-project-deploy-flow-design.md` - platform deploy targets and deployment executor.
- `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md` - current Redpanda Cloud path. This spec adds a target-local alternative; it does not replace the external Redpanda Cloud option.
- Dokploy Compose API docs: https://docs.dokploy.com/docs/api/compose
- Redpanda single-broker Docker Compose docs: https://docs.redpanda.com/redpanda-labs/docker-compose/single-broker/

**Implementation locations:**
- `packages/deploy/deploy-core/`
- `packages/deploy/deploy-dokploy/`
- `packages/platform/platform-core/`
- `apps/platform-http/`
- `packages/platform/platform-storage/` only if schema normalization or persisted shape tests require it

## 1. Problem

Project deployments currently require a project-level external Kafka-compatible event bus. That is suitable for Redpanda Cloud and other managed brokers, but it makes preview targets harder to operate: the user must provision a broker outside the deploy pipeline before a project can be deployed.

The deployment packages need an explicit way to say: "this target should provision the event bus for this project environment." The first concrete target is Dokploy, and the first provider is Redpanda.

The change must preserve the existing library boundary:

- `deploy-core` plans target-neutral infrastructure.
- `deploy-dokploy` renders and applies Dokploy resources.
- platform deploy targets provide the typed deploy config.

## 2. Goal

Add **Provisioned Event Bus** support:

- `eventBus.mode: "external"` keeps the current behavior.
- `eventBus.mode: "provisioned"` asks the deploy pipeline to create a target-local Kafka-compatible broker.
- First provisioned provider: `provider: "redpanda"`.
- First target implementation: Dokploy Compose resource.
- Bus lifetime: one broker per `org/project/environment` on a target, reused across redeploys.
- Security in the first implementation: internal-only plaintext.
- Persistence in the first implementation: persistent named volume per project environment.

## 3. Non-goals

- Cleanup/delete/deprovision workflow. A separate spec will define destructive stack cleanup.
- Kafka topic provisioning. Deploy does not create topics or compute a topic manifest.
- Kafka protocol readiness polling in `deploy-dokploy`.
- External listener, Redpanda Console, Admin API public exposure, SASL, TLS, or multi-node Redpanda.
- Replacing the runtime Kafka bus plugin work. This spec only controls deployment config/rendering.
- Making provisioned Redpanda the default when `eventBus` is missing.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Feature name | Provisioned Event Bus |
| D2 | Scope | Generic provisioned event bus model, Redpanda-on-Dokploy as first implementation |
| D3 | Bus lifetime | Per `org/project/environment`, reused across redeploys |
| D4 | Access | Internal-only plaintext for first implementation |
| D5 | Dokploy resource type | Compose resource |
| D6 | Persistence | Persistent named volume per project environment |
| D7 | Selection | Explicit only; missing `eventBus` remains an error |
| D8 | Target-neutral placement | `ProjectDeploymentPlan.infrastructure.eventBus` discriminated union |
| D9 | First config surface | Minimal: `provider`, optional `image`, optional `topicPrefix` |
| D10 | Readiness | Apply orders resources but does not wait for Kafka protocol readiness |
| D11 | Topics | Not provisioned by deploy |
| D12 | Platform plumbing | In scope so the platform executor can use the new mode |
| D13 | Backward compatibility | Stored external bus configs without `mode` remain valid and mean `external` |
| D14 | Rendered audit artifact | Include the compose resource and compose file; no secrets are present in this scope |
| D15 | Cleanup | Separate spec; this spec keeps stable names, labels, and apply result entries as future hooks |

## 5. Deploy config

`ProjectDeploymentConfig.eventBus` becomes a union. Existing external configs remain accepted.

```ts
export type ExternalEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode?: 'external';
  readonly brokers: readonly string[];
  readonly topicPrefix?: string;
  readonly security?: ExternalEventBusSecurity;
};

export type ProvisionedEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode: 'provisioned';
  readonly provider: 'redpanda';
  readonly image?: string;
  readonly topicPrefix?: string;
};

export type EventBusConfig = ExternalEventBusConfig | ProvisionedEventBusConfig;
```

Rules:

- `mode` omitted means `external`.
- `external` requires non-empty `brokers`.
- `external` may use the existing plaintext or `sasl_ssl` security union.
- `provisioned` must not accept `brokers` from the user. The planner derives internal brokers.
- `provisioned.provider` is limited to `"redpanda"` in this spec.
- `provisioned.image` is optional. Implementation must use a pinned Redpanda image tag, never `latest`.

## 6. Deploy-core plan model

`deploy-core` normalizes the authored config into a planned infrastructure shape.

```ts
export type PlannedEventBus =
  | {
      readonly kind: 'kafka';
      readonly mode: 'external';
      readonly brokers: readonly string[];
      readonly topicPrefix?: string;
      readonly security?: ExternalEventBusSecurity;
    }
  | {
      readonly kind: 'kafka';
      readonly mode: 'provisioned';
      readonly provider: 'redpanda';
      readonly resourceName: string;
      readonly internalBrokers: readonly string[];
      readonly topicPrefix?: string;
      readonly image: string;
      readonly persistence: {
        readonly mode: 'persistent';
        readonly volumeName: string;
      };
    };
```

`ProjectDeploymentPlan.infrastructure.eventBus` uses `PlannedEventBus`.

`deploy-core` owns stable logical infrastructure identity:

- resource slug: `event-bus`
- resource name basis: `orgSlug`, `projectSlug`, `environment`, `event-bus`
- volume name basis: same as resource name plus a stable data suffix

`deploy-core` must not render Dokploy Compose YAML. It may produce target-neutral names and the internal broker address that target adapters consume.

No `DeploymentWorkload` variant is added. The event bus remains infrastructure, not a project service workload.

## 7. Dokploy rendering

`deploy-dokploy` extends its rendered resource model from only applications to applications plus compose resources.

```ts
export type RenderedDokployResource =
  | RenderedDokployApplicationResource
  | RenderedDokployComposeResource;
```

For provisioned Redpanda, render adds one compose resource:

- `logicalId: "event-bus"`
- `kind: "compose"`
- `infrastructureKind: "event-bus"`
- deterministic name from the planned resource name
- single Redpanda service in `docker-compose.yml`
- no public ingress/domain
- no externally exposed port
- internal Kafka listener on port `9092`
- persistent named volume using the planned volume name
- labels:
  - `rntme.org`
  - `rntme.project`
  - `rntme.environment`
  - `rntme.managed-by`
  - `rntme.infrastructure=event-bus`
  - `rntme.provider=redpanda`

Rendered plan output includes the compose file because it contains no secrets in this scope. This keeps audit/debug artifacts useful.

Domain service env rendering:

```text
RNTME_EVENT_BUS_BROKERS=rntme-acme-notes-event-bus:9092
RNTME_EVENT_BUS_PROTOCOL=plaintext
RNTME_EVENT_BUS_TOPIC_PREFIX=rntme.notes   # only when configured
```

For external buses, env rendering stays as it is today, including SASL env for `sasl_ssl`.

## 8. Dokploy apply

`DokployClient` gains a narrow Compose seam alongside the existing application seam:

```ts
type DokployClient = {
  ensureEnvironment(ref: DokployProjectRef, environmentName: string): Promise<{ environmentId: string }>;

  findApplicationByName(environmentId: string, name: string): Promise<DokployApplication | null>;
  createApplication(environmentId: string, resource: RenderedDokployApplicationResource): Promise<DokployApplication>;
  updateApplication(applicationId: string, resource: RenderedDokployApplicationResource): Promise<DokployApplication>;
  configureApplication(applicationId: string, resource: RenderedDokployApplicationResource): Promise<void>;
  deployApplication(applicationId: string): Promise<void>;

  findComposeByName(environmentId: string, name: string): Promise<DokployCompose | null>;
  createCompose(environmentId: string, resource: RenderedDokployComposeResource): Promise<DokployCompose>;
  updateCompose(composeId: string, resource: RenderedDokployComposeResource): Promise<DokployCompose>;
  configureCompose(composeId: string, resource: RenderedDokployComposeResource): Promise<void>;
  deployCompose(composeId: string): Promise<void>;
};
```

Apply order:

1. Ensure Dokploy project/environment.
2. Find/create/update and deploy compose resources.
3. Find/create/update and deploy application resources.

No Kafka readiness wait is performed. The runtime/bus client is responsible for retrying while Redpanda starts.

`DeploymentApplyResult.resources` generalizes from application-only resources to all applied resources:

```ts
type DeploymentApplyResource = {
  readonly logicalId: string;
  readonly resourceKind: 'application' | 'compose';
  readonly workloadKind?: 'domain-service' | 'integration-module' | 'edge-gateway';
  readonly infrastructureKind?: 'event-bus';
  readonly targetResourceId: string;
  readonly targetResourceName: string;
  readonly action: 'created' | 'updated' | 'unchanged';
};
```

Partial failure reporting should be resource-level rather than application-only. Existing secret redaction rules still apply.

## 9. Platform plumbing

`packages/platform/platform-core`:

- `EventBusConfigSchema` accepts old external shape, explicit external shape, and provisioned Redpanda shape.
- Old stored JSON such as `{ "kind": "kafka", "brokers": ["redpanda:9092"] }` remains valid.
- New create/update deploy target requests may use:

```json
{
  "kind": "kafka",
  "mode": "provisioned",
  "provider": "redpanda",
  "topicPrefix": "rntme.notes"
}
```

`apps/platform-http`:

- `buildProjectDeploymentConfig` passes provisioned event bus config through to `deploy-core`.
- Deploy target pages should display whether the bus is external or provisioned.
- Executor logs distinguish external vs provisioned:
  - external: "Using external Kafka/Redpanda event bus"
  - provisioned: "Provisioning Redpanda event bus"
- No new secret handling is required for provisioned Redpanda.

Storage:

- No required migration for old rows.
- If tests need response normalization, normalize at schema/use-case boundaries rather than rewriting stored JSON.

## 10. Error model

Add deploy-core errors:

- `DEPLOY_PLAN_EVENT_BUS_MODE_UNSUPPORTED`
- `DEPLOY_PLAN_EVENT_BUS_PROVIDER_UNSUPPORTED`
- `DEPLOY_PLAN_EVENT_BUS_IMAGE_INVALID` if implementation validates image references beyond non-empty strings

Keep existing errors:

- `DEPLOY_PLAN_MISSING_EVENT_BUS`
- `DEPLOY_PLAN_EVENT_BUS_SASL_MECHANISM_UNSUPPORTED`
- `DEPLOY_PLAN_EVENT_BUS_SASL_INCOMPLETE`

Add or generalize deploy-dokploy errors:

- `DEPLOY_RENDER_DOKPLOY_EVENT_BUS_UNSUPPORTED`
- `DEPLOY_APPLY_DOKPLOY_RESOURCE_PARTIAL_FAILURE`

If the current application partial failure error is generalized cleanly, prefer one resource-level partial failure code over separate application/compose codes.

## 11. Testing

`deploy-core` unit tests:

- old external config without `mode` still plans as `mode: "external"`;
- explicit external config still plans as external;
- external SASL config still validates and plans unchanged;
- provisioned Redpanda plans a normalized infrastructure event bus;
- unsupported provisioned provider is rejected;
- missing event bus still returns `DEPLOY_PLAN_MISSING_EVENT_BUS`.

`deploy-dokploy` unit tests:

- provisioned Redpanda renders one compose resource;
- compose YAML has no public ingress or external port;
- compose YAML uses the configured or default pinned Redpanda image;
- persistent volume name is deterministic;
- domain service env points to the provisioned internal broker;
- compose resources are applied before applications;
- compose create/update/unchanged paths are covered;
- partial failure reports the failed resource and remains retry-safe;
- rendered plan and apply errors do not leak secrets.

`platform-core` tests:

- schema accepts old external, explicit external, and provisioned Redpanda;
- invalid provisioned provider is rejected.

`platform-http` tests:

- `buildProjectDeploymentConfig` passes provisioned bus config through;
- executor path records a compose resource in the apply result;
- deploy target page renders the bus mode.

No browser smoke expansion is required. Existing smoke verification continues to check application URLs.

## 12. Documentation touch

The implementation plan must include documentation updates for:

- `packages/deploy/deploy-core/README.md`
- `packages/deploy/deploy-dokploy/README.md`
- `apps/platform-http/README.md`
- `AGENTS.md` section 6.14 if the deploy workflow instructions become stale
- root `README.md` only if the package table, dependency graph, or MVP scope wording becomes stale

## 13. Future cleanup spec hooks

Cleanup is intentionally out of scope. This spec still leaves stable hooks for a future destructive cleanup design:

- deterministic resource names;
- deterministic persistent volume name;
- resource labels that identify org, project, environment, provider, and infrastructure role;
- apply result entries for compose resources;
- no hidden target-specific resources outside the rendered plan.

The cleanup spec can decide whether to use the latest deployment, a persisted rendered plan snapshot, or a separate cleanup manifest. This spec does not add those storage fields.

## 14. Risks

**Dokploy Compose API shape drift.** Implementation must verify the exact request/response shape against Dokploy docs and tests. The package boundary should hide this behind the narrow `DokployClient` seam.

**Internal DNS/name mismatch.** Dokploy may assign runtime network names that differ from rendered names. Apply already resolves application network references; the same replacement pattern must cover compose resources before domain service env/files are configured.

**Redpanda startup lag.** Domain services may start before the broker is fully ready. This is accepted in this spec; runtime bus clients should retry.

**Stateful preview data.** Persistent Redpanda data survives redeploys. Operators need a future explicit cleanup workflow before relying on this path for disposable environments.
