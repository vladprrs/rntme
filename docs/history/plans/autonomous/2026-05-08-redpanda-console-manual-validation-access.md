> Status: autonomous-plan, ready for DEV.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, .dependency-cruiser.cjs, current code/tests, and approved spec PR #162.
> Why retained: Autonomous backlog implementation plan for safe manual validation access to provisioned Redpanda Console; history/rationale only until promoted by current docs and implementation.

# Redpanda Console Manual Validation Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in, basic-auth-protected Redpanda Console access for preview deployments that use provisioned Redpanda, without exposing Kafka/Admin API or leaking htpasswd/password material.

**Architecture:** Platform deploy-target config stores only access intent plus a target-secret reference. `deploy-core` plans target-neutral manual-access infrastructure only for provisioned Redpanda. `deploy-dokploy` renders an internal Console app and a public Nginx basic-auth proxy; decrypted htpasswd material stays inside the platform/Dokploy client closure and never enters rendered plans, apply results, logs, or docs.

**Tech Stack:** TypeScript, Zod, Vitest, Hono/platform executor, Dokploy HTTP API, Redpanda Console Docker image, Nginx basic auth, existing target-secrets encryption.

---

## Scope

Implement only preview/manual-validation access for `eventBus: { kind: "kafka", mode: "provisioned", provider: "redpanda" }`.

Do not add a blueprint artifact, provisioner contract field, runtime env contract change, public Kafka listener, Redpanda Admin API exposure, production mode, expiry scheduler, or Console SSO/RBAC.

Use these defaults unless the deploy target overrides them:

- Console image: `docker.redpanda.com/redpandadata/console:v3.7.2`.
- Proxy image: `nginx:1.27-alpine`, matching the existing edge gateway image.
- Derived Console URL: `https://console-<org>-<project>-<environment>.<publicDeployDomain>` with the same DNS-label normalization style as `derivePublicBaseUrl`. Resolve this in `platform-http` before calling `deploy-core`; `deploy-core` should consume an explicit `publicBaseUrl`.

## Files And Responsibilities

- Modify `packages/deploy/deploy-core/src/config.ts`: add manual-access config types and default Console image export.
- Modify `packages/deploy/deploy-core/src/plan.ts`: validate config, plan `infrastructure.manualAccess.redpandaConsole`, and add plan errors.
- Modify `packages/deploy/deploy-core/src/index.ts`: export new types/default.
- Modify `packages/deploy/deploy-core/test/unit/plan.test.ts`: cover valid planning and invalid combinations.
- Modify `packages/platform/platform-core/src/schemas/deploy-target.ts`: persist deploy-target `manualAccess` config with strict Zod validation.
- Modify `packages/platform/platform-core/src/schemas/deployment.ts`: allow per-deployment `configOverrides.manualAccess.redpandaConsole.enabled` and optional `publicBaseUrl`.
- Modify `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts`: add `redpanda-console-basic-auth-v1` schema with username/htpasswd consistency validation.
- Modify platform-core tests under `packages/platform/platform-core/test/unit/schemas/**` and `test/unit/use-cases/target-secrets/schemas.test.ts`.
- Modify `packages/platform/platform-storage/src/schema/deploy-target.ts`, `src/repos/pg-deploy-target-repo.ts`, and integration/unit repo tests if deploy-target storage does not already round-trip unknown JSON config fields through `event_bus_config` or another existing JSONB column.
- Add a migration only if the current deploy-target row cannot store `manualAccess` without a new JSONB column. Prefer extending an existing config JSON column over adding encrypted credential columns; htpasswd material belongs in target secrets.
- Modify `apps/platform-http/src/deploy/build-deploy-config.ts`: map deploy-target/override manual access into `ProjectDeploymentConfig`.
- Modify `apps/platform-http/src/deploy/executor.ts`: resolve target secrets before apply when Console access is enabled, and pass a resolver into the Dokploy client factory without logging secret values.
- Modify `apps/platform-http/src/deploy/dokploy-client-factory.ts`: resolve secret env vars from decrypted target secrets inside the client closure before `saveEnvironment`.
- Modify `apps/platform-http/src/deploy/log-redactor.ts`: add explicit redaction coverage for `htpasswd`, `RNTME_CONSOLE_HTPASSWD_B64`, and `consolePassword`.
- Modify `apps/platform-http/src/deploy/smoke-verifier.ts`: add optional Console unauthenticated and invalid-basic-auth checks.
- Modify platform-http tests under `apps/platform-http/test/unit/deploy/**` and route tests if request schemas change API responses.
- Modify `packages/deploy/deploy-dokploy/src/render.ts`: add Redpanda Console/proxy infrastructure application rendering.
- Add `packages/deploy/deploy-dokploy/src/redpanda-console.ts`: keep Nginx config/script generation out of the already large `render.ts`.
- Modify `packages/deploy/deploy-dokploy/src/apply.ts`, `src/client.ts`, and `apps/platform-http/src/deploy/dokploy-client-factory.ts`: carry command/entrypoint fields through render, match, apply, and Dokploy API payloads.
- Modify `packages/deploy/deploy-dokploy/test/unit/render.test.ts` and `test/unit/apply.test.ts`: cover resources, ordering, network-name replacement, command/entrypoint, and no secret leakage.
- Modify current owner docs:
  - `docs/current/owners/packages/deploy/deploy-core.md`
  - `docs/current/owners/packages/deploy/deploy-dokploy.md`
  - `docs/current/owners/apps/platform-http.md`
  - `docs/current/owners/packages/platform/platform-core.md`
  - `docs/current/owners/packages/platform/platform-storage.md` only if storage schema/repo changes.

## Task 0: Preflight

- [ ] Start from the approved spec branch if PR #162 is not merged:

```bash
git fetch origin
git checkout -b dev/rnt-471-redpanda-console-access origin/spec/rnt-466-redpanda-console-access
```

- [ ] Re-read the required context:

```bash
sed -n '1,260p' AGENTS.md
sed -n '1,260p' docs/README.md
sed -n '1,320p' docs/decision-system.md
sed -n '1,360p' docs/history/specs/autonomous/2026-05-08-redpanda-console-manual-validation-design.md
```

- [ ] Verify external assumptions before coding:

```bash
# Redpanda Console config/env: confirm image tag and KAFKA_BROKERS/SERVER_* env names.
# Dokploy command/entrypoint: inspect the currently deployed Dokploy API/source and record the exact payload fields in the PR.
```

Expected: no decision-system contradiction. If Dokploy has no application command/entrypoint API field, stop and create a `Decision:` issue with options: use compose for proxy, build a tiny proxy image, or require a Dokploy version upgrade. Recommended default: use a proxy compose/application shape only if it still supports public domain and file mounts without secret leaks.

## Task 1: Platform Config And Target Secret Schema

- [ ] In `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts`, add a strict schema:

```ts
'redpanda-console-basic-auth-v1': z
  .object({
    username: z.string().trim().min(1),
    htpasswdB64: z.string().trim().min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    let decoded = '';
    try {
      decoded = Buffer.from(value.htpasswdB64, 'base64').toString('utf8');
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'htpasswdB64 must be valid base64' });
      return;
    }
    const line = decoded.replace(/\n$/, '');
    if (line.includes('\n') || !line.startsWith(`${value.username}:`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'htpasswdB64 must decode to a single htpasswd line for username',
      });
    }
  })
```

- [ ] Add tests proving valid base64 htpasswd passes, invalid base64 fails, blank username fails, and username mismatch fails without printing the decoded hash.
- [ ] In `packages/platform/platform-core/src/schemas/deploy-target.ts`, add:

```ts
const RedpandaConsoleAccessSchema = z
  .object({
    enabled: z.boolean(),
    image: z.string().min(1).optional(),
    publicBaseUrl: HttpUrlSchema.optional(),
    basicAuth: z
      .object({
        username: z.string().trim().min(1),
        htpasswdSecretRef: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

const DeployTargetManualAccessSchema = z
  .object({
    redpandaConsole: RedpandaConsoleAccessSchema.optional(),
  })
  .default({});
```

- [ ] Add `manualAccess` to create/update/public deploy-target schemas and repo row types.
- [ ] In `packages/platform/platform-core/src/schemas/deployment.ts`, add a strict override shape that can disable access for one deployment or override only Console `publicBaseUrl`. Do not allow password/htpasswd values in deployment overrides.
- [ ] Tests:

```bash
pnpm -F @rntme/platform-core test -- test/unit/schemas/deploy-target.test.ts test/unit/schemas/deployment.test.ts test/unit/use-cases/target-secrets/schemas.test.ts
```

Expected: all selected tests pass; failures must not include htpasswd content.

## Task 2: Deploy-Core Planning

- [ ] In `packages/deploy/deploy-core/src/config.ts`, add:

```ts
export const DEFAULT_REDPANDA_CONSOLE_IMAGE = 'docker.redpanda.com/redpandadata/console:v3.7.2';

export type RedpandaConsoleAccessConfig = {
  readonly enabled: boolean;
  readonly image?: string;
  readonly publicBaseUrl?: string;
  readonly basicAuth: {
    readonly username: string;
    readonly htpasswdSecretRef: string;
  };
};
```

- [ ] Add `manualAccess?: { readonly redpandaConsole?: RedpandaConsoleAccessConfig }` to `ProjectDeploymentConfig`.
- [ ] In `packages/deploy/deploy-core/src/plan.ts`, add:

```ts
export type PlannedRedpandaConsoleAccess = {
  readonly kind: 'redpanda-console';
  readonly resourceName: string;
  readonly proxyResourceName: string;
  readonly internalUrl: string;
  readonly image: string;
  readonly publicBaseUrl: string;
  readonly basicAuthUsername: string;
  readonly htpasswdSecretRef: string;
};
```

- [ ] Add `manualAccess?: { readonly redpandaConsole?: PlannedRedpandaConsoleAccess }` under `ProjectDeploymentPlan.infrastructure`.
- [ ] Implement `planRedpandaConsoleAccess(config, plannedEventBus, project)` after event-bus planning. Rules:
  - `enabled: false` returns no planned access.
  - `enabled: true` requires planned event bus mode `provisioned` provider `redpanda`.
  - username and `htpasswdSecretRef` must be non-empty after trim.
  - image must be pinned and not `latest`; omitted image uses `DEFAULT_REDPANDA_CONSOLE_IMAGE`.
  - `publicBaseUrl` is accepted only as HTTP(S); platform-core should already validate, but deploy-core must fail fast on non-empty invalid strings.
  - `publicBaseUrl` must be present by the time `deploy-core` plans access. The default URL is derived in `apps/platform-http/src/deploy/build-deploy-config.ts`, because that layer has the platform public deploy domain.
- [ ] Add plan errors with codes in the existing `DEPLOY_PLAN_*` style; append only, do not repurpose old codes.
- [ ] Tests in `packages/deploy/deploy-core/test/unit/plan.test.ts`:
  - plans deterministic `resourceName`, `proxyResourceName`, internal URL, username, secret ref, and default image.
  - rejects enabled Console with external or in-memory event bus.
  - rejects blank username and blank `htpasswdSecretRef`.
  - rejects `:latest` and missing tag.
  - disabled access does not alter the plan.
- [ ] Run:

```bash
pnpm -F @rntme/deploy-core test -- test/unit/plan.test.ts
pnpm -F @rntme/deploy-core typecheck
```

Expected: pass.

## Task 3: Dokploy Render Shape For Console And Proxy

- [ ] In `packages/deploy/deploy-dokploy/src/render.ts`, split rendered application resources into workload applications and infrastructure applications. Do not fake Console as `domain-service`, `integration-module`, `bpmn-worker`, or `edge-gateway`.
- [ ] Add a rendered infrastructure application variant:

```ts
export type RenderedDokployInfrastructureApplicationResource = {
  readonly logicalId: 'redpanda-console' | 'redpanda-console-proxy';
  readonly kind: 'application';
  readonly infrastructureKind: 'redpanda-console' | 'redpanda-console-proxy';
  readonly name: string;
  readonly image: string;
  readonly command?: readonly string[];
  readonly entrypoint?: readonly string[];
  readonly ports?: readonly RenderedDokployPort[];
  readonly ingress?: RenderedDokployIngress;
  readonly env: readonly RenderedEnvVar[];
  readonly labels: Readonly<Record<string, string>>;
  readonly files?: Readonly<Record<string, string>>;
};
```

- [ ] In `packages/deploy/deploy-dokploy/src/redpanda-console.ts`, implement:
  - internal Console app with no ingress/domain and no public port.
  - env:
    - `KAFKA_BROKERS=<planned-event-bus-resource>:9092`
    - `SERVER_LISTENADDRESS=0.0.0.0`
    - `SERVER_LISTENPORT=8080`
    - `ANALYTICS_ENABLED=false`
  - labels `rntme.infrastructure=redpanda-console`, `rntme.access=internal`, and normal rntme labels.
  - public proxy app with ingress on Console `publicBaseUrl`, Nginx config at `/etc/nginx/nginx.conf`, bootstrap script at `/docker-entrypoint-rntme.sh`, and secret env `RNTME_CONSOLE_HTPASSWD_B64=<htpasswdSecretRef>` marked `secret: true`.
  - explicit `entrypoint: ["/bin/sh", "/docker-entrypoint-rntme.sh"]` or exact Dokploy-supported equivalent confirmed in Task 0.
  - Nginx config with `auth_basic`, `auth_basic_user_file /etc/nginx/.htpasswd`, `proxy_pass http://<console-resource>:8080`, forwarded headers, no forwarded `Authorization`, and conservative body/request limits.
  - bootstrap script:

```sh
set -eu
printf '%s' "$RNTME_CONSOLE_HTPASSWD_B64" | base64 -d > /etc/nginx/.htpasswd
chmod 600 /etc/nginx/.htpasswd
exec nginx -g 'daemon off;'
```

- [ ] Render Console resources after Redpanda compose and before domain/module/workflow/edge workloads.
- [ ] Add `urls.redpandaConsoleUrl` and `verificationHints.redpandaConsoleUrl` only when enabled.
- [ ] Tests:
  - Console app has no ingress and points to the planned Redpanda broker.
  - proxy app has public ingress and only the proxy is public.
  - rendered files/env do not contain htpasswd hash, plaintext password, or decoded htpasswd line.
  - proxy env has `secret: true`.
  - generated Nginx does not forward `Authorization`.
  - `renderDokployPlan(...).digest` changes when `htpasswdSecretRef`, username, image, or public URL changes.
- [ ] Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/render.test.ts
pnpm -F @rntme/deploy-dokploy typecheck
```

Expected: pass.

## Task 4: Dokploy Apply Ordering, Command/Entrypoint, And Secret Resolution

- [ ] In `packages/deploy/deploy-dokploy/src/client.ts`, add `command` and `entrypoint` to `DokployApplication` and rendered application comparison inputs.
- [ ] In `packages/deploy/deploy-dokploy/src/apply.ts`, update:
  - `DeploymentApplyResource` so application infrastructure resources report `infrastructureKind`.
  - `resourceRank` ordering:
    1. event-bus compose
    2. workflow-engine compose
    3. Redpanda Console internal app
    4. Redpanda Console proxy app
    5. domain-service and integration-module apps
    6. BPMN worker
    7. edge gateway
  - `resourceMatches` to compare command/entrypoint.
  - `resolveNetworkReferences` to replace planned names inside proxy Nginx files and env after Dokploy app names are known.
- [ ] In `apps/platform-http/src/deploy/dokploy-client-factory.ts`, carry command/entrypoint through the actual Dokploy application API payload. Use the exact field names verified in Task 0 and cover them with fetch payload assertions.
- [ ] Add a secret resolver to the client factory without adding secret values to `RenderedDokployPlan` or `DeploymentApplyResult`. Acceptable shape:

```ts
export type DokployResolvedTargetSecretMap = Readonly<Record<string, unknown>>;
export type DokployClientFactory = (
  target: DeployTargetWithSecret,
  resolvedTargetSecrets?: DokployResolvedTargetSecretMap,
) => DokployClient;
```

- [ ] When writing env blocks, for `secret: true` entries whose value is a target-secret ref, resolve:
  - `redpanda-console-basic-auth-v1` secret object by ref.
  - `RNTME_CONSOLE_HTPASSWD_B64` to `secret.htpasswdB64`.
  - fail before `saveEnvironment` if the secret is missing, malformed, or username mismatches planned config.
- [ ] Keep other existing secret env behavior unchanged unless a test proves it is currently broken. Do not silently convert external Kafka secret refs to plaintext in this task.
- [ ] Tests in `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`:
  - ordering matches the rank above.
  - network replacement updates proxy `proxy_pass`.
  - command/entrypoint changes trigger update.
  - apply result contains no secret values.
- [ ] Tests in `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`:
  - proxy env sent to Dokploy contains decoded secret value only inside HTTP payload.
  - thrown errors redact secret contents.
  - command/entrypoint fields are sent on create/update/configure using the verified Dokploy API fields.
- [ ] Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/dokploy-client-factory.test.ts
```

Expected: pass; no captured test output contains htpasswd/hash material.

## Task 5: Platform Executor, Build Config, Redaction, And Smoke Checks

- [ ] In `apps/platform-http/src/deploy/build-deploy-config.ts`, map deploy target manual access and deployment overrides into `ProjectDeploymentConfig.manualAccess`. Extend the helper input so it receives `projectSlug`, `environment`, and optional `publicDeployDomain`; use those values to derive `https://console-<org>-<project>-<environment>.<publicDeployDomain>` when the target did not set `manualAccess.redpandaConsole.publicBaseUrl`. Disabled override must remove planned Console resources for that deployment.
- [ ] In `apps/platform-http/src/deploy/executor.ts`, after target lookup and before apply:
  - Determine whether `config.manualAccess.redpandaConsole.enabled === true`.
  - Fetch decrypted target secrets if Console is enabled even when no module provisioners exist.
  - Log only the Console URL and username; never log htpasswd or password.
  - Pass decrypted secrets to `deps.dokployClientFactory(target, resolvedTargetSecrets)`.
- [ ] In `apps/platform-http/src/deploy/log-redactor.ts`, extend patterns and tests for:
  - `htpasswd=...`
  - `RNTME_CONSOLE_HTPASSWD_B64=...`
  - JSON `"consolePassword":"..."`
  - JSON `"htpasswdB64":"..."`
- [ ] In `apps/platform-http/src/deploy/smoke-verifier.ts`, add optional checks when `verificationHints.redpandaConsoleUrl` exists:
  - `GET /` with no auth returns `401`.
  - `GET /` with `Authorization: Basic <base64 invalid:invalid>` returns `401`.
  - Do not add automated valid-login checks; valid credentials are sensitive and manual validation covers Console content.
- [ ] Tests:
  - build config preserves manual access from target.
  - executor fetches target secrets for Console-only deployments with no provisioner modules.
  - executor failure for missing console secret finalizes failed with redacted error.
  - smoke verifier records both protected Console checks.
- [ ] Run:

```bash
pnpm -F @rntme/platform-http test -- \
  test/unit/deploy/build-deploy-config.test.ts \
  test/unit/deploy/executor.test.ts \
  test/unit/deploy/log-redactor.test.ts \
  test/unit/deploy/smoke-verifier.test.ts
pnpm -F @rntme/platform-http typecheck
```

Expected: pass.

## Task 6: Storage And API Round Trip

- [ ] If `manualAccess` requires a new deploy-target storage column, add the next Drizzle migration and update:
  - `packages/platform/platform-storage/src/schema/deploy-target.ts`
  - `packages/platform/platform-storage/src/repos/pg-deploy-target-repo.ts`
  - `packages/platform/platform-storage/test/integration/pg-deploy-target-repo.test.ts`
  - migration journal snapshot files generated by the repo's existing migration workflow.
- [ ] If an existing JSON config column stores the new field, add repo tests proving create/update/list/get round-trip `manualAccess` without changing storage schema.
- [ ] Do not store htpasswd/password material in deploy-target rows. Only the target-secret repo stores encrypted `redpanda-console-basic-auth-v1` values.
- [ ] Run storage tests only if storage changed:

```bash
pnpm -F @rntme/platform-storage test -- test/unit/repos/pg-deploy-target-repo.test.ts test/integration/pg-deploy-target-repo.test.ts
pnpm -F @rntme/platform-storage typecheck
```

Expected: pass or documented skip when Docker/Postgres testcontainers are unavailable.

## Task 7: Docs

- [ ] Update `docs/current/owners/packages/deploy/deploy-core.md` with:
  - `ProjectDeploymentConfig.manualAccess.redpandaConsole`
  - validation rules and errors
  - planned manual-access infrastructure shape
- [ ] Update `docs/current/owners/packages/deploy/deploy-dokploy.md` with:
  - internal Console app and public proxy app
  - command/entrypoint invariant
  - apply ordering
  - no-secret-render/apply invariant
  - smoke checks
- [ ] Update `docs/current/owners/apps/platform-http.md` with:
  - target-secret schema name
  - how the executor resolves the secret only for the Dokploy client closure
  - deployment logs/redaction behavior
  - manual validation steps
- [ ] Update `docs/current/owners/packages/platform/platform-core.md` with deploy-target schema and override rules.
- [ ] Update `docs/current/owners/packages/platform/platform-storage.md` only if storage schema/repo changes.
- [ ] Do not update `docs/decision-system.md`; this plan found no Goal/Filter/Bet conflict.

## Acceptance Gates

Required local gates:

```bash
pnpm -F @rntme/deploy-core test
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/platform-core test
pnpm -F @rntme/platform-http test
pnpm -F @rntme/platform-storage test   # only if storage changed
pnpm -F @rntme/deploy-core typecheck
pnpm -F @rntme/deploy-dokploy typecheck
pnpm -F @rntme/platform-core typecheck
pnpm -F @rntme/platform-http typecheck
pnpm -F @rntme/platform-storage typecheck   # only if storage changed
pnpm depcruise
git diff --check
```

Required evidence in the DEV final comment/PR:

- Rendered Dokploy plan excerpt proving Console has no direct ingress and proxy env is `secret: true`.
- Apply-result/log excerpt proving htpasswd/password material is redacted or absent.
- Test output for unauthenticated and invalid-basic-auth Console smoke checks.
- Confirmation that no Redpanda broker port or Admin API domain was created.

## Live Manual Validation

Before calling the feature complete, run one disposable preview deployment with provisioned Redpanda and Console access enabled. Use low-sensitivity dev/e2e env only and never print secret values.

Operator setup:

```bash
# Generate a password locally and create one htpasswd line without printing it in logs.
# Store the base64-encoded htpasswd line through the target-secrets API using schema redpanda-console-basic-auth-v1.
```

Required live checks:

- Console URL without `Authorization` returns `401`.
- Console URL with invalid Basic auth returns `401`.
- Console URL with the configured username/password loads the Console UI manually.
- Redpanda broker `9092` is not publicly reachable and has no Dokploy domain.
- Redpanda Admin API is not publicly reachable and has no Dokploy domain.
- Trigger at least one domain operation that emits an event.
- In Console, inspect the expected `rntme.<service>.<aggregate>` topic and verify a CloudEvents message is present. Record topic name, event type, and timestamp only; do not paste event payloads if they contain data.
- For a workflow project, verify the BPMN worker consumer group/subscription is visible or the workflow branch ran from the event-bus flow.
- Disable Console access and redeploy; verify the Console/proxy resources are removed or no longer reachable.

## Collision Points And Risks

- The plan branch is stacked on spec PR #162 until that PR is merged. If main receives the spec first, rebase the DEV branch onto `origin/main`.
- Existing rendered `secret: true` env values are references, not decrypted values. Do not broaden secret resolution globally while adding Console; resolve only the Console htpasswd secret unless a separate issue scopes external Kafka secret handling.
- Dokploy application command/entrypoint API field names must be verified against the deployed Dokploy version/source before implementation. This is the highest implementation risk.
- Nginx `.htpasswd` hashes are sensitive. Redaction must land before any executor path can log Console secret material.
- Console can display event payloads. Keep it opt-in, preview/manual-validation only, and document disable/redeploy cleanup.
- If a live protected Dokploy project is needed for validation, check env presence only with `./scripts/agent-env-check.sh dokploy` or `./scripts/agent-env-check.sh platform`; never print `DOKPLOY_API_KEY`, API tokens, passwords, or htpasswd values.

## Ready For DEV

Ready for DEV after this plan is merged or the DEV branch is based on this plan branch. No `rntme decisions` escalation is required.
