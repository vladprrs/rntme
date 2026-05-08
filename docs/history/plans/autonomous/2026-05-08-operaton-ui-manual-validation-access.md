> Status: autonomous plan.
> Date: 2026-05-08.
> Current source: docs/current/**, docs/decision-system.md, .dependency-cruiser.cjs, current code/tests on `origin/main` at `d2b42f78`, and accepted spec commit `f03b5b03`.
> Why retained: Executable implementation handoff for safe manual access to provisioned Operaton UI during BPMN/workflow runtime validation.

# Operaton UI Manual Validation Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit target-level access to a protected Operaton UI gateway for manual BPMN/workflow validation without exposing the provisioned Operaton Compose service directly.

**Architecture:** Deploy target config opt-in produces target-neutral `workflowEngine.uiAccess` secret references in deploy-core. deploy-dokploy renders a separate Nginx application `operaton-ui-gateway` with a Dokploy application domain and Basic Auth before proxying to the internal Operaton Compose service. platform-http validates target secrets before render/apply, injects secret values only inside the Dokploy client boundary, and smoke verification proves public unauthenticated access is rejected.

**Tech Stack:** TypeScript strict ESM, Zod, Vitest, pnpm workspaces, dependency-cruiser, Hono platform executor, Dokploy application/domain APIs, Nginx `auth_basic`, Operaton webapps and REST paths.

---

## Scope

Implement one focused PR.

In scope:

- Extend deploy target workflow config with opt-in `workflows.operatonUi`.
- Add target-secret schemas for outer gateway htpasswd and optional Operaton admin user credentials.
- Extend deploy-core workflow planning with redacted secret refs only.
- Render and apply a Dokploy application gateway in front of internal Operaton.
- Validate required target secrets before render/apply.
- Add smoke checks for `401` on no-auth and invalid Basic Auth.
- Update current owner docs and CLI JSON-patch documentation.

Out of scope:

- No project-blueprint artifact change.
- No direct public domain on Operaton Compose.
- No public product API for `/engine-rest`.
- No generic admin console exposure for Redpanda or other infra.
- No `allowedCidrs` schema in the MVP. Add it only after a separate implementation verifies real client IP handling through Dokploy/Traefik.
- No CLI flag that accepts plaintext passwords. Operators create target secrets through the existing target-secret route and patch target JSON config.

## References Checked

- Accepted spec: `docs/history/specs/autonomous/2026-05-08-operaton-ui-manual-validation-design.md` at commit `f03b5b03`.
- Operaton Run docs: webapps are under `/operaton/app/`, REST is under `/engine-rest/`, Run uses `configuration/default.yml` and `production.yml`, and Run can be configured through YAML.
- Operaton security docs: REST API and web applications require authentication when exposed to users; webapp authentication is enabled by default.
- Operaton Spring Boot configuration docs: `operaton.bpm.admin-user.id`, `operaton.bpm.webapp.application-path`, and related webapp properties are available through `application.yaml`.
- Dokploy domain API docs: `domain.create` accepts `applicationId`, `composeId`, `serviceName`, `port`, and `domainType`.
- Dokploy generated-domain docs: domain `Container Port` routes through Traefik to the container and differs from direct port exposure.

DEV must re-open these docs/source at implementation time before choosing exact Operaton image mount paths. If the official Operaton image does not read the planned mounted YAML path, use the image-supported configuration path and keep the same secret-ref and redaction model.

## File Structure

Modify:

- `packages/platform/platform-core/src/schemas/deploy-target.ts` - deploy target `workflows.operatonUi` and `engine.adminUserSecretRef`.
- `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts` - `operaton-ui-basic-auth-v1` and `operaton-admin-user-v1` parsers.
- `packages/platform/platform-core/test/unit/schemas/deploy-target.test.ts` - target config schema coverage.
- `apps/platform-http/test/unit/routes/target-secrets.test.ts` - secret schema route coverage and value-free list assertion.
- `apps/platform-http/src/deploy/build-deploy-config.ts` - pass workflow UI/admin refs to deploy-core.
- `apps/platform-http/test/unit/deploy/build-deploy-config.test.ts` - config mapping coverage.
- `packages/deploy/deploy-core/src/config.ts` - target-neutral config types.
- `packages/deploy/deploy-core/src/plan.ts` - `PlannedWorkflowUiAccess`, `RequiredTargetSecretRef`, and plan shape.
- `packages/deploy/deploy-core/src/workflows.ts` - workflow UI validation and planned refs.
- `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts` - planner acceptance and errors.
- `packages/deploy/deploy-dokploy/src/render.ts` - rendered secret-file refs, URLs, and gateway resource insertion.
- `packages/deploy/deploy-dokploy/src/workflow-render.ts` - Operaton admin config mount refs and UI gateway renderer.
- `packages/deploy/deploy-dokploy/src/apply.ts` - verification hints and secret-file resource comparison behavior.
- `packages/deploy/deploy-dokploy/src/client.ts` - `DokployClient` interface for secret files on the existing injected-client seam.
- `packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts` - gateway, no direct Compose ingress, secret refs, and admin config rendering.
- `packages/deploy/deploy-dokploy/test/unit/apply.test.ts` - verification hints and secret-file update behavior.
- `apps/platform-http/src/deploy/executor.ts` - pre-render target-secret validation and client factory call.
- `apps/platform-http/src/deploy/dokploy-client-factory.ts` - resolve target secret refs inside client boundary and mount secret files.
- `apps/platform-http/src/deploy/smoke-verifier.ts` - Operaton UI no-auth and invalid-Basic checks.
- `apps/platform-http/src/deploy/log-redactor.ts` - htpasswd/admin-user redaction patterns.
- `apps/platform-http/test/unit/deploy/executor.test.ts` - missing secret, resolved secret handoff, and no leak coverage.
- `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts` - secret-file mount body and no value in ordinary env/logs.
- `apps/platform-http/test/unit/deploy/smoke-verifier.test.ts` - `operaton-ui-auth-required` checks.
- `apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts` - gated live validation additions when live env is present.
- `docs/current/owners/packages/deploy/deploy-core.md` - planned UI access model and errors.
- `docs/current/owners/packages/deploy/deploy-dokploy.md` - gateway resource, domain, and secret-ref rendering.
- `docs/current/owners/packages/platform/platform-core.md` - deploy target and target-secret schema ownership.
- `docs/current/owners/apps/platform-http.md` - executor ordering, pre-apply validation, smoke and manual evidence.
- `docs/current/owners/apps/cli.md` - JSON-patch example only.

No change:

- `.dependency-cruiser.cjs` unless implementation introduces an impossible import. Expected layering stays valid: deploy-core remains target-neutral; deploy-dokploy does not import platform packages; platform-http owns secret decryption.
- `docs/decision-system.md` because this plan follows current Goals/Filters/Bets.
- `packages/artifacts/workflows/**` and BPMN artifact schemas.

---

### Task 1: Platform Target Config and Secret Schemas

**Files:**
- Modify: `packages/platform/platform-core/src/schemas/deploy-target.ts`
- Modify: `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts`
- Test: `packages/platform/platform-core/test/unit/schemas/deploy-target.test.ts`
- Test: `apps/platform-http/test/unit/routes/target-secrets.test.ts`

- [ ] **Step 1: Add failing deploy-target schema tests**

Add cases that parse this enabled config:

```ts
workflows: {
  engine: {
    kind: 'operaton',
    mode: 'provisioned',
    image: 'operaton/operaton:2.1.0',
    adminUserSecretRef: 'operatonAdmin'
  },
  worker: { image: 'ghcr.io/acme/rntme-bpmn-worker:v1' },
  operatonUi: {
    enabled: true,
    publicBaseUrl: 'https://operaton-order-flow.example.com',
    auth: { kind: 'basic', secretRef: 'operatonUiBasicAuth' }
  }
}
```

Expected assertions:

- parsed `operatonUi.enabled` is `true`;
- `operatonUi.publicBaseUrl` must be HTTP(S);
- `operatonUi.auth.kind` accepts only `basic`;
- `operatonUi.auth.secretRef` must be non-empty;
- `engine.adminUserSecretRef` is optional and must be non-empty when present;
- `allowedCidrs` is rejected because the MVP does not implement trusted client IP handling.

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/schemas/deploy-target.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Extend platform target schemas**

Add strict Zod objects:

```ts
const OperatonUiAccessSchema = z
  .object({
    enabled: z.literal(true),
    publicBaseUrl: HttpUrlSchema,
    auth: z
      .object({
        kind: z.literal('basic'),
        secretRef: z.string().min(1),
      })
      .strict(),
  })
  .strict();
```

Extend `DeployTargetWorkflowsConfigSchema.engine` with:

```ts
adminUserSecretRef: z.string().min(1).optional()
```

Extend `DeployTargetWorkflowsConfigSchema` with:

```ts
operatonUi: OperatonUiAccessSchema.optional()
```

Do not add `allowedCidrs`.

- [ ] **Step 3: Add failing target-secret parser tests**

Add tests for:

```ts
parseTargetSecret('operaton-ui-basic-auth-v1', {
  htpasswd: 'operator:$apr1$abcdefghijklmnop$ABCDEFGHIJKLMNOPQRSTUV'
})
```

Expected: `ok: true`.

Add tests for:

```ts
parseTargetSecret('operaton-admin-user-v1', {
  id: 'admin',
  password: 'correct horse battery staple',
  firstName: 'Workflow',
  lastName: 'Admin',
  email: 'workflow-admin@example.com'
})
```

Expected: `ok: true`.

Add rejection tests:

- `operaton-ui-basic-auth-v1` rejects `{ password: 'plaintext' }`;
- htpasswd value must contain one non-empty line with one colon;
- admin `id` and `password` are required and non-empty;
- unknown schema still returns `TARGET_SECRET_SCHEMA_UNKNOWN`.

Run:

```bash
pnpm -F @rntme/platform-core test -- test/unit/use-cases/target-secrets
pnpm -F @rntme/platform-http test -- test/unit/routes/target-secrets.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 4: Add target-secret schemas**

Extend `TARGET_SECRET_SCHEMAS`:

```ts
'operaton-ui-basic-auth-v1': z
  .object({
    htpasswd: z
      .string()
      .min(1)
      .refine((value) => value.split(/\r?\n/).filter((line) => line.trim() !== '').every((line) => /^[^:\s][^:]*:.+/.test(line)), {
        message: 'htpasswd must contain one or more username:hash lines',
      }),
  })
  .strict(),
'operaton-admin-user-v1': z
  .object({
    id: z.string().min(1),
    password: z.string().min(1),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .strict(),
```

The route list response must continue returning names/schema/updatedAt only.

- [ ] **Step 5: Commit**

```bash
git add packages/platform/platform-core/src/schemas/deploy-target.ts \
  packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts \
  packages/platform/platform-core/test/unit/schemas/deploy-target.test.ts \
  apps/platform-http/test/unit/routes/target-secrets.test.ts
git commit -m "plan-target schemas for Operaton UI access"
```

---

### Task 2: Deploy-Core Plan Shape and Validation

**Files:**
- Modify: `packages/deploy/deploy-core/src/config.ts`
- Modify: `packages/deploy/deploy-core/src/plan.ts`
- Modify: `packages/deploy/deploy-core/src/workflows.ts`
- Test: `packages/deploy/deploy-core/test/unit/plan-workflows.test.ts`

- [ ] **Step 1: Add failing planner tests**

Add tests for:

- no `workflows.operatonUi` keeps current plan unchanged;
- enabled UI on provisioned Operaton adds:

```ts
workflowEngine: {
  kind: 'operaton',
  mode: 'provisioned',
  resourceName: 'rntme-acme-order-fulfillment-operaton',
  internalBaseUrl: 'http://rntme-acme-order-fulfillment-operaton:8080',
  image: 'operaton/operaton:test',
  adminUserSecretRef: 'operatonAdmin',
  uiAccess: {
    publicBaseUrl: 'https://operaton.example.test',
    auth: {
      kind: 'basic',
      secretRef: 'operatonUiBasicAuth',
      schema: 'operaton-ui-basic-auth-v1'
    }
  }
}
```

- `requiredTargetSecrets` includes:

```ts
[
  { name: 'operatonUiBasicAuth', schema: 'operaton-ui-basic-auth-v1', reason: 'operaton-ui-basic-auth' },
  { name: 'operatonAdmin', schema: 'operaton-admin-user-v1', reason: 'operaton-admin-user' }
]
```

- UI enabled without `publicBaseUrl` emits `DEPLOY_PLAN_WORKFLOWS_UI_PUBLIC_URL_MISSING`;
- UI enabled without `auth.secretRef` emits `DEPLOY_PLAN_WORKFLOWS_UI_AUTH_SECRET_MISSING`;
- UI enabled without a workflow project/provisioned Operaton emits `DEPLOY_PLAN_WORKFLOWS_UI_REQUIRES_OPERATON`;
- `adminUserSecretRef` present but empty emits `DEPLOY_PLAN_WORKFLOWS_OPERATON_ADMIN_SECRET_MISSING`;
- plan JSON does not contain htpasswd, admin password, or any decrypted secret value.

Run:

```bash
pnpm -F @rntme/deploy-core test -- test/unit/plan-workflows.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Extend target-neutral config types**

In `config.ts`, update `WorkflowEngineConfig`:

```ts
export type OperatonUiAccessConfig = {
  readonly enabled: true;
  readonly publicBaseUrl: string;
  readonly auth: {
    readonly kind: 'basic';
    readonly secretRef: string;
  };
};

export type WorkflowEngineConfig =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'operaton';
      readonly mode: 'provisioned';
      readonly image: string;
      readonly adminUserSecretRef?: string;
    };
```

Extend `ProjectDeploymentConfig.workflows` with:

```ts
readonly operatonUi?: OperatonUiAccessConfig;
```

- [ ] **Step 3: Add plan output types**

In `plan.ts`, add:

```ts
export type RequiredTargetSecretRef = {
  readonly name: string;
  readonly schema: 'operaton-ui-basic-auth-v1' | 'operaton-admin-user-v1' | string;
  readonly reason: string;
};

export type PlannedWorkflowUiAccess = {
  readonly publicBaseUrl: string;
  readonly auth: {
    readonly kind: 'basic';
    readonly secretRef: string;
    readonly schema: 'operaton-ui-basic-auth-v1';
  };
};
```

Extend planned Operaton engine with optional:

```ts
readonly adminUserSecretRef?: string;
readonly uiAccess?: PlannedWorkflowUiAccess;
```

Extend `ProjectDeploymentPlan` with:

```ts
readonly requiredTargetSecrets: readonly RequiredTargetSecretRef[];
```

Default it to `[]`.

- [ ] **Step 4: Validate UI access in workflow planning**

In `workflows.ts`, validate `workflowConfig.operatonUi` while planning a workflow project:

- trim `publicBaseUrl`;
- require `auth.kind === 'basic'`;
- trim and require `auth.secretRef`;
- emit the spec error codes exactly:
  - `DEPLOY_PLAN_WORKFLOWS_UI_REQUIRES_OPERATON`
  - `DEPLOY_PLAN_WORKFLOWS_UI_PUBLIC_URL_MISSING`
  - `DEPLOY_PLAN_WORKFLOWS_UI_AUTH_SECRET_MISSING`
  - `DEPLOY_PLAN_WORKFLOWS_OPERATON_ADMIN_SECRET_MISSING`
- do not ever read target secret values in deploy-core.

If the project has no workflows and `config.workflows?.operatonUi?.enabled === true`, return an error instead of rendering a dangling gateway.

- [ ] **Step 5: Pass platform target config through**

In `apps/platform-http/src/deploy/build-deploy-config.ts`, keep copying `target.workflows` into `ProjectDeploymentConfig`. Add tests proving `adminUserSecretRef` and `operatonUi` survive the mapping.

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/build-deploy-config.test.ts
```

Expected: PASS after implementation.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-core/src/config.ts \
  packages/deploy/deploy-core/src/plan.ts \
  packages/deploy/deploy-core/src/workflows.ts \
  packages/deploy/deploy-core/test/unit/plan-workflows.test.ts \
  apps/platform-http/src/deploy/build-deploy-config.ts \
  apps/platform-http/test/unit/deploy/build-deploy-config.test.ts
git commit -m "plan Operaton UI access in deploy core"
```

---

### Task 3: Dokploy Rendering for Gateway and Redacted Secret Refs

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/render.ts`
- Modify: `packages/deploy/deploy-dokploy/src/workflow-render.ts`
- Test: `packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts`

- [ ] **Step 1: Add failing render tests**

Add a plan fixture with `workflowEngine.uiAccess`.

Assert rendered resources contain:

- existing `workflow-engine` Compose resource with no `ingress`, no `ports`, no domain fields;
- new application resource:

```ts
{
  logicalId: 'operaton-ui-gateway',
  kind: 'application',
  workloadKind: 'operaton-ui-gateway',
  workloadSlug: 'operaton-ui-gateway',
  name: 'rntme-acme-order-fulfillment-operaton-ui-gateway',
  image: 'nginx:1.27-alpine',
  ports: [{ containerPort: 8080, protocol: 'http' }],
  ingress: {
    publicBaseUrl: 'https://operaton.example.test',
    containerPort: 8080,
    healthPath: '/health',
    routes: [{ routeId: 'operaton-ui', path: '/', url: 'https://operaton.example.test/' }]
  }
}
```

Assert gateway files include an Nginx config with:

```nginx
auth_basic "rntme Operaton";
auth_basic_user_file /etc/nginx/.htpasswd;
proxy_pass http://rntme-acme-order-fulfillment-operaton:8080;
```

Assert gateway secret files include only refs:

```ts
secretFiles: {
  '/etc/nginx/.htpasswd': {
    schema: 'operaton-ui-basic-auth-v1',
    secretRef: 'operatonUiBasicAuth',
    field: 'htpasswd'
  }
}
```

Assert rendered JSON does not contain a htpasswd line or admin password.

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/render-workflows.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Add rendered secret-file metadata**

In `render.ts`, add:

```ts
export type RenderedSecretFileRef = {
  readonly schema: string;
  readonly secretRef: string;
  readonly field: string;
};
```

Extend application workload kind typing to allow a Dokploy-only infrastructure
application:

```ts
export type RenderedDokployApplicationWorkloadKind =
  | DeploymentWorkload['kind']
  | 'operaton-ui-gateway';
```

Extend application and compose resources with:

```ts
readonly secretFiles?: Readonly<Record<string, RenderedSecretFileRef>>;
```

Keep `files` for non-secret generated content. Do not put secret values in `files`.

- [ ] **Step 3: Render Operaton admin config through secret refs**

In `workflow-render.ts`, when `engine.adminUserSecretRef` is present, render an Operaton configuration file mount ref on the Compose resource rather than env values:

```ts
secretFiles: {
  '/operaton/configuration/application.yaml': {
    schema: 'operaton-admin-user-v1',
    secretRef: engine.adminUserSecretRef,
    field: 'applicationYaml'
  }
}
```

The platform client will synthesize `applicationYaml` from the decrypted admin secret:

```yaml
operaton:
  bpm:
    admin-user:
      id: "<secret.id>"
      password: "<secret.password>"
```

DEV must adjust the mount path to the official image-supported config path after checking Operaton image docs/source. Keep the key contract as `field: 'applicationYaml'` so render/apply stays value-free.

- [ ] **Step 4: Render the gateway application**

Add `renderOperatonUiGateway(plan)` in `workflow-render.ts`.

Render only when `workflowEngine.kind === 'operaton'` and `workflowEngine.uiAccess` is present.

Use Nginx config:

```nginx
server {
  listen 8080;
  server_name _;

  location = /health {
    return 200 "ok\n";
  }

  location / {
    auth_basic "rntme Operaton";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://rntme-acme-order-fulfillment-operaton:8080;
  }
}
```

Generate the real upstream from `engine.resourceName`.

- [ ] **Step 5: Add URLs and collision checks**

Extend rendered `urls` with:

```ts
operatonUiUrl?: string;
operatonUiAuthChecks?: readonly { readonly name: string; readonly url: string }[];
```

Set:

```ts
operatonUiUrl: uiAccess.publicBaseUrl
operatonUiAuthChecks: [{ name: 'operaton-ui', url: joinPublicUrl(uiAccess.publicBaseUrl, '/') }]
```

Resource-name collision checks must include `operaton-ui-gateway`.

- [ ] **Step 6: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/render.ts \
  packages/deploy/deploy-dokploy/src/workflow-render.ts \
  packages/deploy/deploy-dokploy/test/unit/render-workflows.test.ts
git commit -m "render protected Operaton UI gateway"
```

---

### Task 4: Apply Secret Files Inside the Platform Dokploy Client Boundary

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Modify: `packages/deploy/deploy-dokploy/src/client.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/apply.test.ts`
- Modify: `apps/platform-http/src/deploy/dokploy-client-factory.ts`
- Modify: `apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts`

- [ ] **Step 1: Add failing apply/client tests**

In deploy-dokploy apply tests, assert:

- resources with `secretFiles` are not considered unchanged solely because ordinary `files` match;
- apply result contains no `secretFiles` values;
- verification hints carry `operatonUiAuthChecks`.

In platform-http client factory tests, use:

```ts
resolvedTargetSecrets: {
  operatonUiBasicAuth: {
    htpasswd: 'operator:$apr1$abcdefghijklmnop$ABCDEFGHIJKLMNOPQRSTUV'
  },
  operatonAdmin: {
    id: 'admin',
    password: 'admin-secret'
  }
}
```

Assert Dokploy mount create/update receives:

- `/etc/nginx/.htpasswd` content from `operatonUiBasicAuth.htpasswd`;
- `/operaton/configuration/application.yaml` content synthesized from `operatonAdmin`;
- ordinary rendered/apply results do not include either secret value.

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/dokploy-client-factory.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Keep apply value-free**

Do not pass secret values into `applyDokployPlan`.

Change the Dokploy client factory seam to close over target secrets:

```ts
export type DokployClientFactory = (
  target: DeployTargetWithSecret,
  resolvedTargetSecrets?: Readonly<Record<string, unknown>>,
) => DokployClient;
```

The `DokployClient` continues receiving rendered resources with secret refs only.

- [ ] **Step 3: Resolve secret files in `configureFileMounts`**

In `apps/platform-http/src/deploy/dokploy-client-factory.ts`, extend `configureFileMounts` to accept both:

```ts
files: Readonly<Record<string, string>> | undefined
secretFiles: Readonly<Record<string, RenderedSecretFileRef>> | undefined
```

Resolution rules:

- `operaton-ui-basic-auth-v1` + `field: 'htpasswd'` returns `secret.htpasswd`;
- `operaton-admin-user-v1` + `field: 'applicationYaml'` returns the YAML described in Task 3;
- missing secret or field throws `DEPLOY_TARGET_SECRET_REF_UNRESOLVED`;
- thrown messages must include schema/ref/field but never the value.

- [ ] **Step 4: Force secret-file resources through configure**

In deploy-dokploy apply comparison, treat any resource with `secretFiles` as needing configure/update on each apply attempt. This handles secret rotation because rendered plan digests intentionally contain refs, not values.

Expected result: repeated deploys can mark the gateway as `updated` even when only secret files are present. That is acceptable for the MVP and avoids secret fingerprints.

- [ ] **Step 5: Commit**

```bash
git add packages/deploy/deploy-dokploy/src/apply.ts \
  packages/deploy/deploy-dokploy/src/client.ts \
  packages/deploy/deploy-dokploy/test/unit/apply.test.ts \
  apps/platform-http/src/deploy/dokploy-client-factory.ts \
  apps/platform-http/test/unit/deploy/dokploy-client-factory.test.ts
git commit -m "resolve Dokploy secret files inside platform client"
```

---

### Task 5: Platform Executor Pre-Render Secret Validation and Redaction

**Files:**
- Modify: `apps/platform-http/src/deploy/executor.ts`
- Modify: `apps/platform-http/src/deploy/log-redactor.ts`
- Test: `apps/platform-http/test/unit/deploy/executor.test.ts`
- Test: `apps/platform-http/test/unit/deploy/log-redactor.test.ts`

- [ ] **Step 1: Add failing executor tests**

Add tests for:

- plan has `requiredTargetSecrets`, target secret missing -> deployment finalizes failed before render/apply;
- target secret exists but schema mismatch -> failed before render/apply;
- target secret exists and schema matches -> `dokployClientFactory(target, resolvedTargetSecrets)` is called;
- logs, final error message, apply result, and verification report do not contain htpasswd/admin password.

Use error code:

```ts
DEPLOY_EXECUTOR_TARGET_SECRET_MISSING
```

and structured causes containing `{ path: 'targetSecrets.operatonUiBasicAuth', schema: 'operaton-ui-basic-auth-v1' }`.

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/executor.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Add required-secret validation helper**

In `executor.ts`, after a successful deploy-core plan and before render:

1. Read `plan.value.requiredTargetSecrets`.
2. If the array is empty, keep current behavior.
3. If non-empty, call `targetSecretsRepo.list(target.id)` and `targetSecretsRepo.getAllDecrypted(target.id)`.
4. For each required ref:
   - missing name -> fail with `DEPLOY_EXECUTOR_TARGET_SECRET_MISSING`;
   - listed schema mismatch -> fail with `DEPLOY_EXECUTOR_TARGET_SECRET_SCHEMA_MISMATCH`;
   - decrypted value fails `parseTargetSecret(required.schema, value)` -> fail with `DEPLOY_EXECUTOR_TARGET_SECRET_INVALID`.
5. Store validated values in local `resolvedTargetSecrets`.
6. Pass `resolvedTargetSecrets` only to `deps.dokployClientFactory(target, resolvedTargetSecrets)`.

This must also work when the project has no provisioner modules. Current code resolves target secrets only inside the provision branch; do not reuse that conditional as-is.

- [ ] **Step 3: Keep provisioner target secrets compatible**

If provisioners are present, avoid double logging secret resolution. Either:

- reuse the same decrypted map for provisioning and UI secret validation; or
- read twice but log only `Resolving target secrets` without names/values.

The final code must preserve existing Auth0 provisioner behavior.

- [ ] **Step 4: Harden redaction**

In `log-redactor.ts`, add coverage for:

- htpasswd hash-looking fragments after `htpasswd`;
- `adminUser`, `admin-user`, `operatonAdmin`, `applicationYaml`;
- Basic Auth credentials in headers are already redacted; keep that test.

Do not redact non-secret URLs such as `https://operaton.example.test`.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-http/src/deploy/executor.ts \
  apps/platform-http/src/deploy/log-redactor.ts \
  apps/platform-http/test/unit/deploy/executor.test.ts \
  apps/platform-http/test/unit/deploy/log-redactor.test.ts
git commit -m "validate Operaton UI target secrets before apply"
```

---

### Task 6: Smoke Verification and Manual Live Evidence

**Files:**
- Modify: `apps/platform-http/src/deploy/smoke-verifier.ts`
- Modify: `packages/deploy/deploy-dokploy/src/apply.ts`
- Test: `apps/platform-http/test/unit/deploy/smoke-verifier.test.ts`
- Test: `apps/platform-http/test/unit/deploy/smoke-verifier-real.test.ts`
- Test: `apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts`

- [ ] **Step 1: Add failing smoke-verifier tests**

Extend `VerificationHints` with:

```ts
readonly operatonUiAuthChecks?: readonly {
  readonly name: string;
  readonly url: string;
}[];
```

Add test fetch map:

```ts
{
  'https://operaton.example.test/': { status: 401, contentType: 'text/html' }
}
```

Assert checks:

- `operaton-ui-auth-required (no-auth)` sends `GET` with no auth and requires `401`;
- `operaton-ui-auth-required (invalid-basic)` sends `GET` with `Authorization: Basic <base64("invalid:invalid")>` and requires `401`;
- no JSON body requirement for Nginx Basic Auth checks.

Run:

```bash
pnpm -F @rntme/platform-http test -- test/unit/deploy/smoke-verifier.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Implement Operaton UI smoke checks**

In `SmokeVerifier.verify`, run these checks before public route checks:

```ts
for (const check of verificationHints.operatonUiAuthChecks ?? []) {
  const noAuth = await this.fetcher(check.url, { method: 'GET', timeoutMs: 5_000 });
  const invalid = await this.fetcher(check.url, {
    method: 'GET',
    timeoutMs: 5_000,
    headers: { Authorization: `Basic ${btoa('invalid:invalid')}` },
  });
}
```

Use `Buffer.from('invalid:invalid').toString('base64')` in Node code.

- [ ] **Step 3: Add hints from apply**

In `packages/deploy/deploy-dokploy/src/apply.ts`, include `rendered.urls.operatonUiAuthChecks ?? []` in `verificationHints`.

Run:

```bash
pnpm -F @rntme/deploy-dokploy test -- test/unit/apply.test.ts
```

Expected: PASS after implementation.

- [ ] **Step 4: Extend live e2e expectations**

In the gated live test, when env enables Operaton UI validation:

Required env presence only; never print values:

```bash
RNTME_E2E_OPERATON_UI_BASE_URL
RNTME_E2E_OPERATON_UI_BASIC_AUTH_SECRET_NAME
RNTME_E2E_OPERATON_ADMIN_SECRET_NAME
```

The live test should:

- create/update target secrets through the platform route using values from env;
- patch target workflows with `operatonUi.publicBaseUrl` and secret refs;
- deploy order-fulfillment;
- assert smoke report contains the two Operaton UI `401` checks;
- assert apply result contains `operaton-ui-gateway` application and `workflow-engine` Compose;
- assert deployment logs do not contain the secret values.

Do not automate authenticated browsing with plaintext Basic Auth. That remains manual QA evidence.

- [ ] **Step 5: Manual validation checklist for QA/DEV**

After live deploy succeeds, collect evidence beyond `/health` or `/healthz`:

- `GET <operatonUi.publicBaseUrl>/` with no credentials returns `401`;
- `GET <operatonUi.publicBaseUrl>/` with invalid Basic credentials returns `401`;
- with valid Basic credentials, browser reaches `/operaton/app/`;
- Operaton login succeeds with the configured admin user or the operator-owned admin flow;
- Cockpit shows deployed process definitions for the workflow demo;
- a public demo API event starts a process instance;
- Cockpit shows the process instance progression and completed service tasks;
- `/engine-rest` is reachable only behind the same Basic Auth boundary and is not documented as product API;
- platform deployment logs, apply result, rendered digest, verification report, and `GET /deploy-targets/:slug/secrets` contain no secret values.

- [ ] **Step 6: Commit**

```bash
git add apps/platform-http/src/deploy/smoke-verifier.ts \
  packages/deploy/deploy-dokploy/src/apply.ts \
  apps/platform-http/test/unit/deploy/smoke-verifier.test.ts \
  apps/platform-http/test/unit/deploy/smoke-verifier-real.test.ts \
  apps/platform-http/test/e2e/order-fulfillment-dokploy-live.test.ts
git commit -m "verify Operaton UI rejects unauthenticated access"
```

---

### Task 7: Docs and CLI Operator Flow

**Files:**
- Modify: `docs/current/owners/packages/deploy/deploy-core.md`
- Modify: `docs/current/owners/packages/deploy/deploy-dokploy.md`
- Modify: `docs/current/owners/packages/platform/platform-core.md`
- Modify: `docs/current/owners/apps/platform-http.md`
- Modify: `docs/current/owners/apps/cli.md`

- [ ] **Step 1: Update deploy-core owner doc**

Document:

- `workflows.operatonUi` is target config, not blueprint config;
- planned `workflowEngine.uiAccess`;
- `requiredTargetSecrets`;
- error codes from Task 2;
- deploy-core never reads target secret values.

- [ ] **Step 2: Update deploy-dokploy owner doc**

Document:

- `workflow-engine` remains internal Compose on `dokploy-network`;
- `operaton-ui-gateway` is a separate application with Dokploy application ingress;
- direct public Compose exposure is forbidden;
- Nginx Basic Auth runs before proxying to Operaton;
- secret files are rendered as refs and resolved only inside the platform client;
- secret-file resources may update every apply to support rotation without secret fingerprints.

- [ ] **Step 3: Update platform docs**

In platform-core owner doc, document:

- `operaton-ui-basic-auth-v1`;
- `operaton-admin-user-v1`;
- target secret list remains value-free.

In platform-http owner doc, document:

- executor validates required target secrets after plan and before render/apply;
- smoke checks for no-auth and invalid Basic Auth;
- manual evidence checklist from Task 6;
- live e2e env names without printing sample secret values.

- [ ] **Step 4: Update CLI owner doc**

Add JSON patch-only example:

```json
{
  "workflows": {
    "engine": {
      "kind": "operaton",
      "mode": "provisioned",
      "image": "operaton/operaton:2.1.0",
      "adminUserSecretRef": "operatonAdmin"
    },
    "worker": {
      "image": "ghcr.io/vladprrs/rntme-bpmn-worker:<tag>"
    },
    "operatonUi": {
      "enabled": true,
      "publicBaseUrl": "https://operaton-order-flow.example.com",
      "auth": {
        "kind": "basic",
        "secretRef": "operatonUiBasicAuth"
      }
    }
  }
}
```

Do not document plaintext password flags.

- [ ] **Step 5: Commit**

```bash
git add docs/current/owners/packages/deploy/deploy-core.md \
  docs/current/owners/packages/deploy/deploy-dokploy.md \
  docs/current/owners/packages/platform/platform-core.md \
  docs/current/owners/apps/platform-http.md \
  docs/current/owners/apps/cli.md
git commit -m "document Operaton UI validation access"
```

---

## Acceptance Gates

Unit and architecture:

```bash
pnpm -F @rntme/platform-core test -- test/unit/schemas/deploy-target.test.ts
pnpm -F @rntme/platform-core test -- test/unit/use-cases/target-secrets
pnpm -F @rntme/deploy-core test -- test/unit/plan-workflows.test.ts
pnpm -F @rntme/deploy-dokploy test -- test/unit/render-workflows.test.ts test/unit/apply.test.ts
pnpm -F @rntme/platform-http test -- test/unit/deploy/build-deploy-config.test.ts test/unit/deploy/executor.test.ts test/unit/deploy/dokploy-client-factory.test.ts test/unit/deploy/smoke-verifier.test.ts test/unit/deploy/log-redactor.test.ts test/unit/routes/target-secrets.test.ts
pnpm depcruise
```

Package gates:

```bash
pnpm -F @rntme/deploy-core test
pnpm -F @rntme/deploy-dokploy test
pnpm -F @rntme/platform-core test
pnpm -F @rntme/platform-http test
pnpm -r run typecheck
```

Live gated evidence:

```bash
./scripts/agent-env-check.sh platform
./scripts/agent-env-check.sh dokploy
RNTME_DOKPLOY_E2E=1 pnpm -F @rntme/platform-http test -- test/e2e/order-fulfillment-dokploy-live.test.ts
```

Never print secret values from these env vars or target secrets.

## Required Live Evidence

The implementation PR is not done until a live run records:

- target config contains `workflows.operatonUi.enabled: true`;
- target secrets exist for htpasswd and admin credentials and `GET .../secrets` returns names only;
- Dokploy resources include internal `workflow-engine` Compose, `bpmn-worker` application, and `operaton-ui-gateway` application;
- no public domain is attached directly to the Operaton Compose resource;
- `operaton-ui-gateway` domain maps to the gateway app container port `8080`;
- smoke report includes no-auth `401` and invalid-Basic `401` for the Operaton UI URL;
- authenticated manual browser check reaches Operaton webapps and validates process definitions/instances/service tasks;
- logs/apply result/verification report contain only secret refs or redacted markers.

## Risk and Collision Points

- The accepted spec is on PR #163 / commit `f03b5b03`, not on `origin/main` at plan time. DEV must either merge/rebase after the spec lands or keep the plan reference by commit.
- Current executor reads target secrets only inside the provisioner branch. This plan requires a separate plan-derived secret validation path so workflow-only projects without provisioners still work.
- Current rendered application `files` are plain strings. Secret file refs must not be flattened into `files`; otherwise apply result comparison and error serialization can leak values.
- Secret rotation cannot be detected through rendered digest without storing secret fingerprints. The MVP deliberately reconfigures resources with `secretFiles` on each apply.
- Operaton image config paths must be verified against official docs/source at implementation time. If `/operaton/configuration/application.yaml` is wrong for the selected image, change only the mount path, not the target-secret contract.
- Basic Auth is an outer gateway. It does not replace Operaton webapp auth or authorization.
- `/engine-rest` remains reachable behind the same auth boundary for manual validation and webapp same-origin calls. It must not be added to product route docs.
- CIDR allowlists are excluded until the real client IP chain through Dokploy/Traefik is verified.

## Docs Touch

Required owner docs are listed in Task 7.

No `docs/decision-system.md` update is needed. This work supports G3 inspectability, keeps blueprint core lean, uses target secrets for repeatability, and does not contradict locked bets.

## Ready for DEV

Ready for DEV after this plan lands. Recommended implementation order is Tasks 1-7 as written, with one commit per task and live evidence captured after unit/typecheck/depcruise gates pass.
