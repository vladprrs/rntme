> Status: active-rationale.
> Date: 2026-05-09.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Recent Superpowers design rationale preserved during project cleanup; it is not current-state truth by itself.

# Dokploy Single Compose Deploy Design

Date: 2026-05-09

## Status

Draft for review.

## Context

Current Dokploy rendering splits one rntme project deployment across several
Dokploy resources:

- provisioned Redpanda, RustFS, and Operaton are separate Dokploy Compose
  resources;
- domain runtime services, integration modules, BPMN worker, edge gateway, and
  public infra proxies are separate Dokploy Applications.

This shape has two operational failures:

- Provisioned Compose infrastructure does not currently render container restart
  policy, so Redpanda, Operaton, and RustFS can remain stopped after host reboot.
- Application workloads run as Swarm services without explicit crash-loop
  containment or resource limits, so a dependency outage or process bug can
  produce restart churn and host pressure.

The split topology also weakens the project-as-deploy-unit model. A single
blueprint deployment appears in Dokploy as many resources, requiring manual
resource ordering, network aliases, and aggregated verification.

Dokploy supports Docker Compose applications with multiple services and native
domain management for Compose services. Docker Compose also gives one place to
declare service restart and resource policy.

## Goals

- Render one Dokploy Compose resource per rntme project/environment deployment.
- Model every deployable workload as a Docker Compose service inside that stack.
- Add default restart and resource policies by service class.
- Keep provisioned infrastructure private unless an explicit public proxy is
  configured.
- Add post-apply verification that detects crash-looping Compose services before
  a deployment is marked successful.
- Preserve secret redaction: render output and deployment records must not
  contain decrypted secret values.

## Non-Goals

- Background circuit breaker for already-successful projects. This is P1.
- Production topology. Preview deployment remains the active deploy mode.
- Supporting both old multi-resource topology and new single-Compose topology as
  parallel long-term modes.
- Publicly exposing raw Redpanda, Operaton, or RustFS internals.

## Decision

`@rntme/deploy-dokploy` will render a single primary Dokploy Compose resource
for each project deployment. The resource represents the blueprint/project
deployment unit. All app workloads and provisioned per-project infrastructure
are services inside that Compose stack.

This spec adds a locked-pending Deploy bet to `docs/decision-system.md`:

> **Single Dokploy Compose per project deploy** - Dokploy preview deployments
> materialize one blueprint/project/environment as one Dokploy Compose resource
> with per-workload Compose services, not as multiple Dokploy Applications.
> This preserves blueprint-as-deploy-unit and a canonical Dokploy topology. ·
> G1, G5, F6 · `locked-pending` · spec
> `docs/history/specs/active-rationale/2026-05-09-dokploy-single-compose-deploy-design.md`

## Topology

The rendered Dokploy resource is one Compose app named deterministically from
org, project, and environment. It contains these service classes:

| Service class | Compose service name |
| --- | --- |
| Edge gateway | `edge` |
| Domain runtime service | `svc-<serviceSlug>` |
| Integration module | `mod-<moduleSlug>` |
| BPMN worker | `bpmn-worker` |
| Provisioned Redpanda | `redpanda` |
| Provisioned Operaton | `operaton` |
| Provisioned RustFS | `rustfs` |
| RustFS public proxy | `rustfs-public` |
| Operaton UI gateway | `operaton-ui` |
| Redpanda Console | `redpanda-console` |
| Redpanda Console proxy | `redpanda-console-proxy` |

Internal endpoints use Compose service names:

- event bus broker: `redpanda:9092`;
- workflow engine: `http://operaton:8080`;
- edge upstream: `http://svc-<slug>:3000`;
- auth module gRPC endpoint: `mod-<slug>:50051`;
- RustFS internal endpoint: `http://rustfs:9000`.

The default Compose network is sufficient for internal traffic. `dokploy-network`
is attached only where Dokploy/Traefik domain routing or cross-stack visibility
requires it. Public app ingress always targets `edge:8080`.

Optional public surfaces use proxy services inside the same Compose stack:

- Operaton UI domain targets `operaton-ui:8080`;
- RustFS public domain targets `rustfs-public:8080`;
- Redpanda Console domain targets `redpanda-console-proxy:8080`.

Raw infra services remain private.

## Restart And Resource Policy

Runtime workloads receive crash-loop containment:

```yaml
restart: on-failure:3
deploy:
  restart_policy:
    condition: on-failure
    delay: 30s
    max_attempts: 3
    window: 5m
  resources:
    limits:
      cpus: "0.50"
      memory: 512M
```

This applies to:

- `svc-*`;
- `mod-*`;
- `bpmn-worker`.

Edge and public proxy workloads receive smaller defaults:

```yaml
restart: on-failure:3
deploy:
  restart_policy:
    condition: on-failure
    delay: 30s
    max_attempts: 3
    window: 5m
  resources:
    limits:
      cpus: "0.10"
      memory: 128M
```

This applies to:

- `edge`;
- `rustfs-public`;
- `operaton-ui`;
- `redpanda-console-proxy`.

Provisioned infra receives reboot recovery:

```yaml
restart: unless-stopped
deploy:
  resources:
    limits:
      cpus: "<service default>"
      memory: "<service default>"
```

Default infra limits:

- Redpanda: `cpus: "1.00"`, `memory: 1G`, while keeping the existing Redpanda
  process flags `--smp=1 --memory=512M --reserve-memory=0M`.
- Operaton: `cpus: "1.00"`, `memory: 1G`.
- RustFS: `cpus: "0.50"`, `memory: 512M`.
- Redpanda Console: `cpus: "0.25"`, `memory: 256M`.

Dokploy Compose remains `composeType: "docker-compose"` for P0 because that is
the documented Dokploy Docker Compose flow. The YAML renders both `restart` and
`deploy.restart_policy` for app/proxy services. If the active Dokploy/Docker
mode ignores part of the `deploy` stanza, verification and tests should surface
that as a target behavior gap rather than silently dropping the policy.

## Render Model

`RenderedDokployPlan` should contain one primary Compose resource. Internally,
the renderer should build a structured service model before serializing YAML:

```ts
type RenderedComposeService = {
  readonly name: string;
  readonly class:
    | "domain-service"
    | "integration-module"
    | "edge-gateway"
    | "bpmn-worker"
    | "event-bus"
    | "workflow-engine"
    | "object-storage"
    | "infrastructure-proxy";
  readonly image: string;
  readonly env: readonly RenderedEnvVar[];
  readonly files?: Readonly<Record<string, string>>;
  readonly secretFiles?: Readonly<Record<string, RenderedSecretFileRef>>;
  readonly ports?: readonly number[];
  readonly restartPolicy: RenderedRestartPolicy;
  readonly resourceLimits: RenderedResourceLimits;
};
```

The structured model supports deterministic tests, post-apply verification, and
future circuit-breaker logic without parsing YAML strings.

## Apply Model

The Dokploy apply flow becomes:

1. Ensure project environment.
2. Find or create the single Compose resource.
3. Update Compose metadata, env block, and compose file.
4. Materialize non-secret and secret files through the Dokploy client.
5. Configure Compose domains for public surfaces.
6. Deploy/start the Compose resource.
7. Load or inspect Compose services/tasks.
8. Return apply result containing the target compose id plus service inventory.

The `DokployClient` seam needs Compose-specific methods:

```ts
configureComposeDomains(composeId, domains)
loadComposeServices(composeId)
inspectComposeTasks(composeId, serviceNames)
```

The implementation should prefer Dokploy native Compose Domains. If the API does
not allow reliable create/update for Compose domains, generated Traefik labels
are allowed as a fallback for public services.

## Files And Secrets

Rendered plans continue to store public file contents and secret file
references, never decrypted secret values.

Apply materializes a deterministic file tree for the Compose stack and mounts
files into services read-only. The exact host root may depend on the Dokploy
mount API, but the logical layout is:

```text
edge/nginx.conf
edge/config.json
services/<slug>/artifacts/...
services/<slug>/config.json
bpmn-worker/workflows/...
operaton/application.yaml
operaton-ui/.htpasswd
```

Secret file refs stay in render output as:

```ts
{ schema: string; secretRef: string; field: string }
```

The platform HTTP Dokploy client factory resolves those refs during apply, after
target secret validation. Deployment records store only redacted render/apply
metadata.

## Verification And Crash-Loop Guard

P0 verification runs in two phases:

1. Compose stack guard.
2. Existing HTTP smoke verification.

After deploy, the executor waits a short stabilization window. Default: `90s`.
Then it inspects tasks/services for the just-applied Compose resource.

Runtime, module, worker, edge, and proxy services must have no failed, rejected,
or exited tasks. Infra services must be running, or healthy when health status is
available. One-shot bootstrap services are not part of P0.

If the guard detects a crash loop, finalize the deployment as failed:

- error code: `DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP`;
- deployment log step: `verify`;
- verification report includes service name, service class, observed failed task
  count, and last available error message.

The platform verification schema should be extended to support workload status
values rather than encoding non-HTTP checks as fake status codes.

P0 does not automatically stop or scale services after detecting a crash loop.
That behavior is deferred until the Dokploy or Docker operation can stop the
specific failed service without stopping healthy infra.

## Migration

The old topology is not preserved as a long-term option. During implementation,
apply should perform best-effort cleanup of previous rntme-managed per-resource
topology only after the new single Compose stack deploys successfully.

Cleanup may delete old Dokploy Applications and old provisioned Compose
resources only when all of these match:

- `rntme.managed-by=rntme-deploy-dokploy`;
- same org slug;
- same project slug;
- same environment.

If cleanup fails, the deployment may still succeed with warnings because the new
stack is the active deploy unit.

## Error Handling

New or updated error codes:

- `DEPLOY_RENDER_DOKPLOY_COMPOSE_SERVICE_COLLISION` when generated service names
  collide.
- `DEPLOY_APPLY_DOKPLOY_COMPOSE_DOMAIN_FAILED` when Compose domain
  configuration fails.
- `DEPLOY_APPLY_DOKPLOY_COMPOSE_SERVICE_INSPECT_FAILED` when service/task
  inspection fails during apply.
- `DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP` when post-apply guard observes failed,
  rejected, or exited workload tasks above threshold.

Existing render/apply errors remain append-only. Do not repurpose previous error
codes.

## Testing

Add focused tests:

- render tests for one Compose resource per deployment;
- render tests for service names and internal endpoints;
- render tests for restart and resource policies by service class;
- render tests for Redpanda, RustFS, and Operaton `restart: unless-stopped`;
- render tests proving secret values are absent from rendered output;
- apply tests for create/update of one Compose resource;
- apply tests for Compose domains and file materialization;
- migration cleanup tests for old topology resources after successful deploy;
- executor tests where task inspection returns failed tasks and deployment
  finalizes with `DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP`;
- existing smoke verifier tests remain and run after the stack guard.

## Documentation Touch

This spec updates:

- `docs/decision-system.md` with the locked-pending Deploy bet above.

Implementation should update:

- `docs/current/owners/packages/deploy/deploy-dokploy.md` for the new topology,
  apply flow, service naming, restart/resource defaults, and verifier gotchas;
- `docs/current/owners/packages/deploy/deploy-core.md` only if target-neutral
  plan output starts carrying policy or topology data.

No root README, AGENTS.md, or docs navigation updates are required unless
implementation changes common commands or package lookup paths.

## Open Questions For Implementation

- Which Dokploy API calls provide reliable Compose domain create/update for a
  selected service and port?
- Does the active Dokploy target enforce `deploy.resources` for
  `composeType: "docker-compose"` or only for stack/Swarm mode?
- Can Dokploy or Docker API stop/scale one Compose service cleanly without
  stopping the whole stack?
- What exact shape does `compose.loadServices` return across Dokploy versions?

These questions do not block the design. They determine whether P0 uses native
Compose Domains or generated Traefik labels, and whether service-level stop is
deferred to P1.
