> Status: historical.
> Date: 2026-05-03.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Module Provisioner Contract — design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-03
**Related:**
- `docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md` — module discovery and `project.json#modules` composition.
- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md` — `deploy-core` / `deploy-dokploy` plan/render/apply pipeline.
- `docs/history/specs/historical/2026-04-26-project-deploy-flow-design.md` — platform deployment executor, deploy targets, deployment logs.
- `docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md` — Identity contract (RPC list including `CreateOrganization`).
- `docs/history/specs/historical/2026-04-29-notes-demo-auth0-design.md` — current Auth0 module shape (introspection sidecar, client/boot, manifest).
- `docs/history/specs/historical/2026-05-03-project-update-delete-operations-design.md` — project decommission flow (in user-review). This spec adds a per-module tearDown hook *before* its Dokploy resource delete pass.

**Implementation locations:**
- Module manifest schema — `packages/tooling/module-skeleton/`
- Module discovery — `packages/artifacts/blueprint/`
- Pipeline phase, contract types, error codes — `packages/deploy/deploy-core/`
- Render-side env mapping for provisioner outputs — `packages/deploy/deploy-dokploy/`
- Executor phase wiring, target-secret CRUD, log redaction — `apps/platform-http/`
- Encrypted persistence schemas/repos — `packages/platform/platform-storage/`, `packages/platform/platform-core/`
- Auth0 concrete provisioner — `modules/identity/auth0/`

## 1. Problem

A production deploy of a blueprint that uses Auth0 fails when the Auth0 SPA client is missing `token_endpoint_auth_method: 'none'`. The PKCE-only flow returns 401 from `/oauth/token`; the SPA boot rejects; `<div id="root">` stays empty with `?code=…&state=…` in the URL. The fix is one Mgmt API PATCH on the SPA client. It survives only as long as nobody recreates the client through the Auth0 dashboard.

This is one instance of a class of problems: an integration module's runtime correctness depends on **external state** (an Auth0 client, a Stripe webhook endpoint, a Resend domain verification, an S3 CORS rule) that today is provisioned by hand. The current spec backstop — `2026-05-01-notes-demo-recovery-design.md` §"Verify Auth0…" — is a manual checklist. It does not scale to N blueprints × M environments × operator turnover, and it is silent about `token_endpoint_auth_method` (the field that broke the demo).

External tooling does not fit:

- **Terraform with the auth0 provider.** Adds a YAML/HCL artifact alongside the blueprint and deploy target, with its own state file and CI job. Breaks the "one bounded authoring object → one deploy" property of the project blueprint.
- **`a0deploy` (Auth0 Deploy CLI).** YAML-only authoring. Conflicts with the project rule "authoring is JSON only" (`CLAUDE.md`). Duplicates blueprint config.
- **Manual checklist.** What we have. Caused this incident.

## 2. Goals

Make external-state provisioning a **first-class contract of the module** that ships with the runtime and the client, so every integration module declares its required external state once, the deploy pipeline reconciles it on every deploy, and operator drift in third-party dashboards is automatically corrected.

Concretely for v1:

1. Extend `module.json` with a `provisioner` block declaring entry point, produced output kinds, and required target-side credentials.
2. Add a `provision` phase to the deploy pipeline between `plan` and `render`. The phase runs each module's provisioner with deterministic inputs from `(blueprint + deploy target + plan)` and persists outputs.
3. Persist provisioner outputs per-deployment, splitting public outputs (plain JSONB) and secret outputs (encrypted ciphertext column following the existing `apiTokenCiphertext` pattern).
4. Persist deploy-target-side credentials (Mgmt API client/secret/tenant) as encrypted secrets keyed by `requires[].name`, with a CRUD API that never returns plaintext.
5. Implement the contract for Auth0 in `modules/identity/auth0/src/provisioner.ts`. v1 reconciles SPA client, Resource Server, Connection enablement, M2M clients, and the SPA-side Organizations capability flag.
6. Implement `tearDown` so project decommission removes external state before adapter resources are deleted.

## 3. Non-goals

- No Terraform, `a0deploy`, or any external IaC artifact.
- No Stripe / Resend / other vendor implementations in this iteration. The contract is generic; concrete provisioners for other categories ship in their own specs.
- No automatic creation of Auth0 Organizations on deploy. Only the `organization_usage='allow'` capability flag on the SPA client. Org creation, membership, and runtime org-scoped login are deferred (see §13).
- No drift detection or periodic reconciliation. Provision runs only on deploy-trigger.
- No out-of-process execution sandbox for provisioner code. v1 imports each module's provisioner statically into the platform-http process. Sandbox/sidecar is v2 if blast-radius isolation becomes a concern.
- No backwards-compatibility shims for existing deploy targets that lack `targetSecretsCiphertext`. The single existing target (`notes-demo`) is migrated by hand through the new PUT API.
- No runtime SPA changes for Organizations beyond an optional `organizationId` config field already supportable by the existing `client.config.schema`. Enabling organization-scoped login at runtime is out-of-scope.
- No rotation flow for M2M `clientSecret`. Initial create stores the secret; reconcile-no-op preserves it. A separate CLI rotate command is a follow-up.

## 4. Decisions

| #   | Question                                          | Decision (user, 2026-05-03)                                                                                                                                                                                                                |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Scope of v1 Auth0 provisioner                     | Reconcile SPA client + Resource Server + Connection enablement + M2M clients + SPA `organization_usage='allow'` capability flag. No automatic Org creation.                                                                                |
| D2  | Auth0 Organizations runtime impact                | None in v1. Only the SPA capability flag is set. Auto-creation, runtime org-scoped login, and introspection-sidecar org claim handling are deferred to a separate spec.                                                                    |
| D3  | Pipeline ordering                                 | `plan → provision → render → apply → verify`. Provisioner outputs feed render as a third input alongside plan and target config; the render digest covers them.                                                                            |
| D4  | Provisioner output persistence shape              | Split. Public outputs → plain JSONB column on `deployment`. Secret outputs → encrypted ciphertext column on `deployment` (mirrors `apiTokenCiphertext` pattern). Mixed-secret-within-output is rejected.                                   |
| D5  | Deploy-target-side credential storage             | New encrypted blob `targetSecretsCiphertext` on `deploy_target`. Plaintext `moduleConfig` JSONB stays for non-secret module configuration (image tags, regions). Secret CRUD via dedicated `PUT/DELETE …/secrets/:name`; never returns value. |
| D6  | Execution model                                   | In-process. `apps/platform-http` resolves and dynamic-imports each module's `provisioner.entry` through the same package-resolver that `@rntme/blueprint` already uses for discovery.                                                       |
| D7  | Tear-down support in v1                           | Yes. Same module exports `tearDown(input)`. Called by the project-delete operation (designed in `2026-05-03-project-update-delete-operations-design.md`) **before** the Dokploy adapter delete pass.                                       |
| D8  | Manifest declaration shape                        | K2 — declarative `produces[]` (kind/secret) and `requires[]` (named credential schemas). Validates outputs against `produces[]` at runtime; validates `requires[]` against `targetSecretsCiphertext` at validate-time.                     |
| D9  | Auth0 Mgmt API client implementation              | Hand-rolled `fetch` against ~6 Mgmt endpoints. No `auth0` npm dependency.                                                                                                                                                                  |
| D10 | M2M `clientSecret` rotation policy                | Created-once, never rotated by reconcile. Auth0 only returns `client_secret` on `POST /clients`. If the stored ciphertext is lost, recovery is a separate CLI rotate flow, not part of deploy.                                             |
| D11 | Failure recovery semantics                        | Idempotent reconcile. Provision failure aborts the deploy; partial state is left in Auth0 and re-converged on next deploy. No compensating delete on partial-fail. apply/verify failure preserves provisioned outputs unchanged.            |
| D12 | Concurrency                                       | Reuse existing per-target deployment serialization (`deployment_live_idx` and claim-by-status in `deployment` repo). No new locks.                                                                                                          |
| D13 | Cross-cutting category eligibility                | Open. Any module may declare `provisioner`. The contract is not restricted to `category: identity`; future Stripe/Resend/etc. modules use the same shape.                                                                                  |
| D14 | Doc-touch surface                                 | This spec touches `CLAUDE.md`, `AGENTS.md`, six per-package READMEs, and (subject to its merge timing) the project-update/delete spec. `vision.md` is not touched (provisioner is internal IR vocabulary, not market framing).             |

## 5. Module manifest extension

### 5.1 Schema changes — `packages/tooling/module-skeleton/src/manifest-shape.ts`

Add to `ModuleManifestSchema`:

```ts
export const ProvisionerProducesSchema = z
  .object({
    name: z.string().min(1),
    kind: z.enum(['single', 'many']),
    secret: z.boolean(),
  })
  .strict();

export const ProvisionerRequiresSchema = z
  .object({
    name: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict();

export const ProvisionerBlockSchema = z
  .object({
    entry: z.string().min(1),
    produces: z.array(ProvisionerProducesSchema).min(1),
    requires: z.array(ProvisionerRequiresSchema).default([]),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const names = v.produces.map((p) => p.name);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['produces'],
        message: `MODULE_MANIFEST_PROVISIONER_DUPLICATE_PRODUCES: duplicate produces names (${[...new Set(dup)].join(', ')})`,
      });
    }
    const reqNames = v.requires.map((r) => r.name);
    const dupReq = reqNames.filter((n, i) => reqNames.indexOf(n) !== i);
    if (dupReq.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requires'],
        message: `MODULE_MANIFEST_PROVISIONER_DUPLICATE_REQUIRES: duplicate requires names (${[...new Set(dupReq)].join(', ')})`,
      });
    }
  });

// In ModuleManifestSchema:
provisioner: ProvisionerBlockSchema.optional(),
```

The `manifest-shape.ts` file already enforces "manifest must declare a non-empty capabilities or client surface". `provisioner` does not satisfy that requirement on its own — a manifest with only a `provisioner` block remains invalid. This is intentional: provisioning without a runtime or client surface is not a complete module.

### 5.2 Discovery — `packages/artifacts/blueprint/src/compose/modules.ts`

`DiscoveredModule` gains an optional `provisioner: ProvisionerBlock` field, populated when the manifest declares one. Resolution of `entry` is **path-only** at discovery time — actual `import()` happens in the deploy executor (see §6.2). Discovery validates that `entry` is a relative path inside the package directory; cross-package or absolute paths are rejected with `BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY`.

### 5.3 Public type export

`@rntme/module-skeleton` exports `ProvisionerBlock`, `ProvisionerProduces`, `ProvisionerRequires`. These are imported by `@rntme/deploy-core` for the runtime contract (§6.3) and by `apps/platform-http` for validate-time checks (§7.3).

### 5.4 Auth0 manifest concrete

`modules/identity/auth0/module.json` adds:

```jsonc
{
  "provisioner": {
    "entry": "./dist/provisioner.js",
    "produces": [
      { "name": "spaClient",      "kind": "single", "secret": false },
      { "name": "resourceServer", "kind": "single", "secret": false },
      { "name": "m2mClients",     "kind": "many",   "secret": true  }
    ],
    "requires": [
      { "name": "auth0Mgmt", "schema": "auth0-mgmt-api-v1" }
    ],
    "timeoutMs": 60000
  }
}
```

## 6. Deploy pipeline integration

> **Resolver detail superseded by `2026-05-03-provisioner-bundle-transport-design.md`.**
> The original spec assumed the resolver imports modules from the platform-http
> process's `node_modules`; the bundle-transport spec replaces that with
> resolver-from-`tmpDir` and a self-contained bundled entry per module.

### 6.1 Phase ordering — `apps/platform-http/src/deploy/executor.ts`

Insert a `provision` stage between `plan` and `render`:

```
plan → provision → render → apply → verify
```

Implemented as one additional `runStage('provision', …)` call following the existing pattern. The render call gets a third argument `provisionerOutputs` carrying the result of the provision stage.

### 6.2 The provision stage — `packages/deploy/deploy-core/src/provision.ts` (new)

```ts
export type RunProvisionersInput = {
  readonly composedProject: ComposedProjectInput;     // discovered modules + their manifests
  readonly resolvedTargetSecrets: ResolvedTargetSecrets; // decrypted, keyed by requires[].name
  readonly plan: ProjectDeploymentPlan;               // for derived inputs (publicBaseUrl, audience)
  readonly log: StageLog;
  readonly resolveProvisioner: (packageName: string) => Promise<ProvisionerModule>; // dynamic import
};

export type ProvisionedModule = {
  readonly projectKey: string;        // e.g. "identity-auth0"
  readonly publicOutputs: Record<string, unknown>;   // produces.secret=false, keyed by produces[].name
  readonly secretOutputs: Record<string, unknown>;   // produces.secret=true,  keyed by produces[].name
  readonly provisionedAt: string;     // ISO 8601
};

export type RunProvisionersResult = Result<{ readonly modules: readonly ProvisionedModule[] }>;

export async function runProvisioners(input: RunProvisionersInput): Promise<RunProvisionersResult>;
```

The function:

1. Iterates `composedProject.modules` filtered to those with a `provisioner` block.
2. For each, asserts every `requires[].name` is present in `resolvedTargetSecrets`. Missing → `DEPLOY_PROVISION_TARGET_SECRET_MISSING`, no `import()` is attempted.
3. Calls `resolveProvisioner(packageName)`, gets the module's exported `provision` function.
4. Builds the provisioner input from `composedProject.modules[k].publicConfig`, `plan`-derived values, and `resolvedTargetSecrets[requiredKey]`. The exact shape of provisioner input is **module-specific** — `runProvisioners` does not introspect or coerce it; it passes through as `unknown`.
5. Awaits with `timeoutMs` (manifest-declared, default 60 000 ms). Timeout → `DEPLOY_PROVISION_TIMEOUT`.
6. Validates the returned `ProvisionerOutput` against the manifest's `produces[]`: every declared name present, kind correct (`single` → object, `many` → array), `secret`-flag matches the bucket the value lives in. Mismatch → `DEPLOY_PROVISION_OUTPUT_INVALID`.
7. Logs each step under `provision/<projectKey>` step prefix.
8. Returns the aggregated `ProvisionedModule[]`.

### 6.3 Provisioner contract — `packages/deploy/deploy-core/src/provisioner-contract.ts` (new)

```ts
export type ProvisionerLog = (entry: {
  readonly step: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly code?: string;
  readonly message: string;
}) => void;

export type ProvisionerInput<I = unknown> = {
  readonly publicConfig: I;                       // from blueprint module.publicConfig + plan-derived
  readonly targetSecrets: Record<string, unknown>; // requires[].name → decrypted value
  readonly priorOutputs?: {                       // last successful provisionResult for this project+target
    readonly publicOutputs: Record<string, unknown>;
    readonly secretOutputs: Record<string, unknown>;
  };
  readonly log: ProvisionerLog;
  readonly signal: AbortSignal;                    // honors timeoutMs
};

export type ProvisionerOutput = {
  readonly publicOutputs: Record<string, unknown>;
  readonly secretOutputs: Record<string, unknown>;
};

export type ProvisionerContract<I = unknown> = {
  provision(input: ProvisionerInput<I>): Promise<Result<ProvisionerOutput>>;
  tearDown?(input: ProvisionerInput<I>): Promise<Result<void>>;
};
```

`priorOutputs` is intentional: it lets the provisioner skip work when state is already converged and avoid rotating secrets it cannot re-read (M2M `clientSecret`).

### 6.4 Render-side integration — `packages/deploy/deploy-dokploy/src/render.ts`

`renderDokployPlan(plan, targetConfig, provisionerOutputs)`. The new third argument is `ReadonlyMap<string, ProvisionedModule>` keyed by `projectKey`.

A new helper `applyProvisionerEnvMappings(plan, provisionerOutputs)` walks each runtime resource (domain service, integration module, edge gateway) and consults a per-module mapping table:

```ts
// modules/identity/auth0 contributes (declared in modules/identity/auth0/src/provisioner.ts):
export const ENV_MAPPINGS: ProvisionerEnvMapping = {
  'identity-auth0': [
    { from: 'spaClient.id',         envName: 'AUTH0_SPA_CLIENT_ID',    secret: false, target: 'app' },
    { from: 'resourceServer.identifier', envName: 'AUTH0_AUDIENCE',    secret: false, target: 'app' },
    { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_CLIENT_SECRET', secret: true, target: 'identity-auth0' },
  ],
};
```

The mapping table lives in the same module file as `provision()` because they share knowledge of the output shape. `deploy-dokploy/render.ts` imports a tiny resolver layer (`packages/deploy/deploy-core/src/provisioner-env-mapping.ts`) that loads each module's mappings via the same dynamic import and applies them. Plain values render to env entries with `secret: false`; secret values render with `secret: true` (Dokploy stores them in its encrypted secret-store).

The render digest hash now incorporates the resolved env entries — including secret entries by **ciphertext-equivalence** (a stable hash of the encrypted value, not the plaintext). Same secret across deploys → same digest. Rotated secret → digest changes.

### 6.5 Error codes — `packages/deploy/deploy-core/src/errors-provision.ts` (new)

```ts
export const DEPLOY_PROVISION_ERROR_CODES = {
  DEPLOY_PROVISION_MODULE_RESOLVE_FAILED: 'DEPLOY_PROVISION_MODULE_RESOLVE_FAILED',
  DEPLOY_PROVISION_ENTRY_LOAD_FAILED: 'DEPLOY_PROVISION_ENTRY_LOAD_FAILED',
  DEPLOY_PROVISION_TARGET_SECRET_MISSING: 'DEPLOY_PROVISION_TARGET_SECRET_MISSING',
  DEPLOY_PROVISION_TARGET_SECRET_SCHEMA_MISMATCH: 'DEPLOY_PROVISION_TARGET_SECRET_SCHEMA_MISMATCH',
  DEPLOY_PROVISION_TIMEOUT: 'DEPLOY_PROVISION_TIMEOUT',
  DEPLOY_PROVISION_OUTPUT_INVALID: 'DEPLOY_PROVISION_OUTPUT_INVALID',
  DEPLOY_PROVISION_VENDOR_FAILED: 'DEPLOY_PROVISION_VENDOR_FAILED', // umbrella for module-emitted failures
} as const;
```

The Auth0 module emits its own sub-codes via the contract's `Result<…>` failure path: `DEPLOY_PROVISION_AUTH0_UNAUTHORIZED`, `DEPLOY_PROVISION_AUTH0_RATE_LIMITED`, `DEPLOY_PROVISION_AUTH0_CONFLICT`, `DEPLOY_PROVISION_AUTH0_UPSTREAM_5XX`, `DEPLOY_PROVISION_AUTH0_INVALID_INPUT`. Naming convention `DEPLOY_PROVISION_<VENDOR>_<KIND>` follows the project rule `<PKG>_<LAYER>_<KIND>`.

## 7. Persistence

### 7.1 `deployment` table additions — `packages/platform/platform-storage/src/schema/deployment.ts`

```ts
provisionResult: jsonb('provision_result').$type<DeploymentProvisionResult>(),
provisionResultCiphertext: bytea('provision_result_ciphertext'),
provisionResultNonce: bytea('provision_result_nonce'),
provisionResultKeyVersion: smallint('provision_result_key_version'),
```

All four nullable. Populated as a unit when the provision stage finalizes (success or partial).

`DeploymentProvisionResult` shape:

```ts
type DeploymentProvisionResult = {
  modules: Record<string, {                 // keyed by projectKey
    publicOutputs: Record<string, unknown>;
    provisionedAt: string;
  }>;
  startedAt: string;
  finishedAt: string;
};
```

The decrypted ciphertext mirrors the same shape with `secretOutputs` instead of `publicOutputs`. The split into two columns — rather than encrypting the full result — is to keep public outputs queryable, joinable in audit views, and viewable in deployment-detail UIs without decrypt round-trips.

### 7.2 `deploy_target` table additions — `packages/platform/platform-storage/src/schema/deploy-target.ts`

```ts
targetSecretsCiphertext: bytea('target_secrets_ciphertext'),
targetSecretsNonce: bytea('target_secrets_nonce'),
targetSecretsKeyVersion: smallint('target_secrets_key_version'),
```

All three nullable; populated on first PUT to a target-secret. The decrypted JSON is `Record<string, { schema: string; value: unknown }>`, keyed by `requires[].name`. Example for a target that supports the Auth0 module:

```jsonc
{
  "auth0Mgmt": {
    "schema": "auth0-mgmt-api-v1",
    "value": {
      "tenantDomain": "demo-rntme.us.auth0.com",
      "mgmtClientId": "abc...",
      "mgmtClientSecret": "secret-not-returned-via-GET"
    }
  }
}
```

### 7.3 Schema registry for `requires[].schema`

A new module `packages/platform/platform-core/src/use-cases/target-secrets/schemas.ts` registers known credential forms:

```ts
export const TARGET_SECRET_SCHEMAS = {
  'auth0-mgmt-api-v1': z.object({
    tenantDomain: z.string().min(1),
    mgmtClientId: z.string().min(1),
    mgmtClientSecret: z.string().min(1),
  }).strict(),
  // future: 'stripe-restricted-key-v1', 'resend-api-key-v1', ...
} as const;
```

PUT validates the body against the schema named in the `requires[]` declaration of the module that owns the secret name. An unknown schema id → `TARGET_SECRET_SCHEMA_UNKNOWN`. A blueprint that declares `requires: [{ name: 'foo', schema: 'unknown-schema' }]` is rejected at validate-time with the same code.

### 7.4 Target-secret CRUD API — new routes in `apps/platform-http`

```
PUT    /v1/orgs/:orgSlug/deploy-targets/:targetSlug/secrets/:secretName
DELETE /v1/orgs/:orgSlug/deploy-targets/:targetSlug/secrets/:secretName
GET    /v1/orgs/:orgSlug/deploy-targets/:targetSlug/secrets         // names + schema only, never values
```

PUT body matches the schema registered under the module's `requires[].schema`. PUT response excludes `value`. GET returns `[{ name, schema, updatedAt }]`. The bulk `GET /deploy-targets/:slug` does **not** include any decrypted secret value.

Authorization: requires `deploy:target:manage` scope (existing). Audit: every PUT/DELETE writes one audit row whose `params` field excludes the value.

### 7.5 Decryption boundary

`runProvisioners` and `runEnvMappings` (during render) accept already-decrypted `ResolvedTargetSecrets` and `ProvisionedModule[]`. Decryption happens once, at the executor entry, immediately after `startAndResolveContext`. Only those two stages see plaintext. Logs are produced by a redactor that strips field names matching `(?:client_?secret|mgmt_?client_?secret|api_?key|password|token)` regardless of case (extension of the existing `apps/platform-http/src/deploy/log-redactor.ts` rule set).

## 8. Auth0 concrete provisioner

### 8.1 File layout

```
modules/identity/auth0/
├── module.json                  ← +provisioner block (see §5.4)
├── src/
│   ├── server.ts                ← runtime introspection sidecar (existing, untouched)
│   ├── provisioner.ts           ← NEW — provision() + tearDown() + ENV_MAPPINGS export
│   └── mgmt-client.ts           ← NEW — thin fetch wrapper over Auth0 Mgmt API
└── test/unit/provisioner.test.ts ← NEW
```

### 8.2 Inputs

```ts
// derived from blueprint + plan + target secrets
type Auth0ProvisionPublicConfig = {
  appName: string;                  // canonicalized "<orgSlug>-<projectSlug>-<env>", supplied by deploy-core
  redirectUri: string;
  audience: string;
  allowedOrigins: string[];
  allowedLogoutUrls: string[];
  organizationsCapability: 'allow' | 'deny';
  m2mClients: ReadonlyArray<{ name: string; scopes: string[] }>;
};

type Auth0ProvisionTargetSecrets = {
  auth0Mgmt: { tenantDomain: string; mgmtClientId: string; mgmtClientSecret: string };
};
```

`appName` is **derived by deploy-core**, not by the provisioner, so identical naming rules apply across all provisioners (same canonicalizer used for resource naming in render).

### 8.3 `provision()` reconcile sequence

Every step is a single Mgmt API call wrapped in a small idempotent reconcile shape (find → diff → patch-or-create → emit log line):

1. **Mgmt API access token.** `POST {tenantDomain}/oauth/token` with `grant_type=client_credentials`, `audience=https://{tenantDomain}/api/v2/`. Cache for the duration of the provision call. 401 → `DEPLOY_PROVISION_AUTH0_UNAUTHORIZED` with message instructing the operator to rotate the `auth0Mgmt` target secret.
2. **SPA client.** `GET /api/v2/clients?name={appName}`. If absent: `POST /api/v2/clients` with the desired body. If present: compute diff of the desired fields against the returned record; if non-empty diff, `PATCH /api/v2/clients/{id}`. Desired body:
   ```jsonc
   {
     "name": appName,
     "app_type": "spa",
     "token_endpoint_auth_method": "none",   // <-- the fix from this incident
     "grant_types": ["authorization_code", "refresh_token"],
     "callbacks": [redirectUri],
     "web_origins": allowedOrigins,
     "allowed_origins": allowedOrigins,
     "allowed_logout_urls": allowedLogoutUrls,
     "organization_usage": organizationsCapability  // 'allow' | 'deny'
   }
   ```
3. **Resource Server.** `GET /api/v2/resource-servers?identifier={audience}`. If absent: `POST /api/v2/resource-servers` with `{ identifier: audience, name: appName + ' API', signing_alg: 'RS256', token_dialect: 'access_token_authz', enforce_policies: true }`. If present: diff and patch.
4. **Connection enablement.** `GET /api/v2/connections?strategy=auth0&name=Username-Password-Authentication` (or the connection name declared in `publicConfig`, when extended in a future blueprint). Read `enabled_clients`. If SPA `client_id` missing, `PATCH /api/v2/connections/{id}` with `{ enabled_clients: [...existing, spa.id] }`. The reconcile **does not remove** other clients from `enabled_clients` (other apps on the same tenant may share the connection legitimately).
5. **M2M clients.** For each `m2mClients[i]`:
   - `GET /api/v2/clients?name={appName}-m2m-{i.name}`.
   - If absent: `POST /api/v2/clients` with `{ name, app_type: 'non_interactive', grant_types: ['client_credentials'], token_endpoint_auth_method: 'client_secret_post' }`. Capture `client_secret` from the response — this is the only chance to read it.
   - If present and `priorOutputs.secretOutputs.m2mClients[i]` has the secret: do not rotate. Diff non-secret fields and patch if needed.
   - If present and the secret is missing from `priorOutputs`: emit a warning log and do not rotate. The operator runs the separate rotate flow if recovery is required.
   - `POST /api/v2/client-grants` with `{ client_id, audience, scope: m2mClients[i].scopes }` if no matching grant exists.

### 8.4 Outputs

```ts
type Auth0ProvisionOutput = {
  publicOutputs: {
    spaClient:      { id: string; name: string };
    resourceServer: { id: string; identifier: string };
  };
  secretOutputs: {
    m2mClients: Array<{ name: string; clientId: string; clientSecret: string }>;
  };
};
```

### 8.5 `ENV_MAPPINGS` export

Same file. Mappings as shown in §6.4. The `${name}` placeholder in `m2mClients.*` is substituted from each entry's `name` (uppercased, non-alphanumeric → `_`).

### 8.6 `tearDown()` sequence

Reverse of `provision`:

1. For each `m2mClients` in `priorOutputs.secretOutputs`: `DELETE /api/v2/client-grants/?client_id={clientId}` (resolve the grant id), then `DELETE /api/v2/clients/{clientId}`. 404 → success (already gone).
2. `DELETE /api/v2/resource-servers/{id}`.
3. Connection: `PATCH /api/v2/connections/{id}` to remove the SPA `client_id` from `enabled_clients`. Other entries are preserved.
4. `DELETE /api/v2/clients/{spaClient.id}`.

`tearDown` does **not** delete the Connection itself, never touches users, and does not remove M2M clients that lack a `priorOutputs` record (operator-created M2M clients on the same tenant must not be collateral damage).

## 9. Tear-down integration with project-delete

Spec `2026-05-03-project-update-delete-operations-design.md` (in user-review) defines the project decommission operation. This spec adds a **provisioner tear-down step** that runs before the Dokploy adapter delete pass for each target group:

```
project-delete operation:
  └─ for each (project, deploy_target) with at least one deployment:
      ├─ resolveLastSuccessfulDeployment.applyResult       // existing — Dokploy resources
      ├─ resolveLastSuccessfulDeployment.provisionResult   // existing column post this spec
      ├─ for each module in provisionResult:
      │     ├─ rebuild ProvisionerInput from (blueprint version, target secrets, prior outputs)
      │     ├─ dynamic-import provisioner.entry
      │     └─ await tearDown(input)   // ★ NEW
      └─ adapter.deleteResources()      // existing
```

If no successful deployment exists for the (project, target) pair, tear-down is skipped with a warning recorded on the operation. If `tearDown` fails partially, the operation transitions to `delete_failed` (already in the delete spec); retry replays both provisioner tear-downs and adapter deletes idempotently.

Coordination with the in-flight delete spec:

- If `2026-05-03-project-update-delete-operations-design.md` has not yet merged to `done/` when this spec's PR-3 lands: the same PR adds a decision row "D17: tearDown of provisioner-modules is a step in delete-executor before Dokploy delete" to that spec and a paragraph in its tear-down section.
- If it has merged: this spec's PR-3 ships `errata-01.md` next to it under the same dated prefix, recording the tear-down hook addition.

## 10. Failure model and observability

### 10.1 Pipeline-level failure outcomes

| Stage outcome                     | Deployment status                | Provisioned state                                             |
| --------------------------------- | -------------------------------- | ------------------------------------------------------------- |
| `provision` fails                 | `failed`                         | Whatever was created up to the failure remains in Auth0.      |
| `provision` partial success       | `failed`                         | Same — no compensating delete.                                |
| `apply` fails after `provision`   | `failed`                         | `provisionResult` persisted; reused on retry.                 |
| `verify` fails after `apply`      | `succeeded_with_warnings`/`failed` | `provisionResult` persisted; reused on next deploy.          |
| Concurrent deploy on same target  | second attempt is rejected by existing serialization | Second deploy never enters `provision`.    |
| Mgmt token 401                    | `failed`, `DEPLOY_PROVISION_AUTH0_UNAUTHORIZED`     | None.                                       |
| Mgmt 429                          | retried up to 3× with backoff inside the call; if still failing, `DEPLOY_PROVISION_AUTH0_RATE_LIMITED` | Whatever earlier steps already created stays. |

### 10.2 Idempotence proof obligations

Each Auth0 reconcile step has a unit test that runs `provision()` twice in a row against the same fake Mgmt API and asserts: (a) the second run issues zero PATCH/POST calls when the first run converged the state, (b) the output is byte-identical, (c) `priorOutputs` of the second run does not cause a rotation of M2M `clientSecret`.

### 10.3 Log redaction

`apps/platform-http/src/deploy/log-redactor.ts` is extended to redact field-name matches `(client_?secret|mgmt_?client_?secret|api_?key|password|token)` and any value field of any object whose key path contains `secretOutputs` or `targetSecrets`. Test asserts: `provision()` step that creates an M2M client emits one info log "created m2m client {name} id={clientId}" and **no** log line carrying the secret value, even when an Auth0 5xx body is included verbatim by mistake.

### 10.4 Memory-flagged risk

Existing memory `dokploy_mcp_leaks_secrets.md` documents that `mcp__dokploy__application-one` has historically returned full GitHub App private keys in plaintext. This spec's secret outputs flow through Dokploy env entries with `secret: true`. Tests ensure that the `application-one` shape used by `apps/platform-http` callers is never logged in full when used to look up provisioned resources.

## 11. Test strategy

| Layer                       | Location                                                            | Coverage                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit — manifest             | `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts` | parse with/without `provisioner`; duplicate `produces.name`; duplicate `requires.name`; missing `entry`; absolute-path entry rejected                                               |
| Unit — discovery            | `packages/artifacts/blueprint/test/unit/discover-modules.test.ts`   | `DiscoveredModule.provisioner` populated when present and absent; bad-entry rejection                                                                                               |
| Unit — runProvisioners      | `packages/deploy/deploy-core/test/unit/provision.test.ts`           | output validation against `produces[]` (missing/extra/kind/secret bucket); missing `requires[].name` → fail-fast; per-module timeout; module without provisioner skipped silently   |
| Unit — env mapping resolver | `packages/deploy/deploy-core/test/unit/provisioner-env-mapping.test.ts` | dot-path resolution; `*` expansion for `kind: 'many'`; `${name}` substitution; `secret: true` propagation                                                                       |
| Unit — render               | `packages/deploy/deploy-dokploy/test/unit/render.test.ts`           | provisioner outputs become env entries on the right resource; secret entries marked secret; render digest changes when outputs change                                               |
| Unit — Auth0 provisioner    | `modules/identity/auth0/test/unit/provisioner.test.ts`              | create-path, reconcile-path (incl. `token_endpoint_auth_method='none'` patch), no-op-path, idempotence, M2M no-rotation, tearDown idempotence                                       |
| Unit — log redaction        | `apps/platform-http/test/unit/deploy/log-redactor.test.ts`          | `client_secret`, `mgmt_client_secret`, `m2mClients[*].clientSecret` redacted; nested objects under `secretOutputs` redacted                                                         |
| Unit — target-secret CRUD   | `apps/platform-http/test/unit/routes/target-secrets.test.ts`        | PUT validates against schema; DELETE removes; GET excludes value; unknown schema id rejected                                                                                        |
| Integration — pipeline      | `apps/platform-http/test/integration/deploy-executor.test.ts`       | five-phase ordering; provision fail short-circuits; provisioner-less project skips provision stage; render receives provisionerOutputs                                              |
| Conformance — contract      | `packages/deploy/deploy-core/test/conformance/provisioner-contract.test.ts` (new) | every module that declares a `provisioner` exports `provision`; `provision()` of a known-bad input returns `Result<…>{ ok:false }` instead of throwing                            |
| E2E — Auth0 (gated)         | `modules/identity/auth0/test/e2e/provisioner.test.ts`               | gated on `AUTH0_E2E=1` and Mgmt creds in env; full create → reconcile → tearDown roundtrip against the real Auth0 tenant; uses unique-named SPA per run                             |

## 12. Documentation touches

Mandatory per `CLAUDE.md` §"Every plan must include a documentation-touch task":

| File                                                                                                       | Change                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` §"Architecture in one paragraph"                                                              | One sentence: module manifests can declare a `provisioner` block; deploy pipeline runs `plan → provision → render → apply → verify`; outputs persist on `deployment.provisionResult` (public) / `provisionResultCiphertext` (secret) |
| `AGENTS.md` §3 layering (deploy-core paragraph)                                                            | Mention `runProvisioners`, `ProvisionerContract`, `DEPLOY_PROVISION_*`                                                                                                                          |
| `AGENTS.md` §6 task-indexed how-to                                                                         | Two new how-tos: "add a provisioner to a module" and "add a target-secret schema"                                                                                                                |
| `AGENTS.md` §10 glossary                                                                                   | Add: provisioner, provisionerOutputs, target secret, schema id                                                                                                                                  |
| `packages/tooling/module-skeleton/README.md`                                                              | New §"Provisioner block" — schema reference, `produces` semantics, `requires` semantics                                                                                                         |
| `packages/artifacts/blueprint/README.md`                                                                  | One sentence in §Modules — `DiscoveredModule.provisioner` exposed                                                                                                                                |
| `packages/deploy/deploy-core/README.md`                                                                   | New §"Provision phase" — `runProvisioners` signature, error codes, ordering                                                                                                                      |
| `packages/deploy/deploy-dokploy/README.md`                                                                | One paragraph — render now consumes `provisionerOutputs` and applies env mappings                                                                                                                |
| `apps/platform-http/README.md`                                                                            | Update executor §Phases — five phases including `provision`; new target-secret CRUD routes                                                                                                       |
| `modules/identity/auth0/README.md`                                                                        | New §"Provisioner" — what reconciles, required `auth0Mgmt` target secret, produced outputs, env var names, one-time Mgmt API client bootstrap                                                    |
| `docs/history/specs/historical/2026-05-03-project-update-delete-operations-design.md` (or its errata)             | Tear-down hook described in §9                                                                                                                                                                  |
| `docs/architecture.md`                                                                                    | One sentence in deploy-pipeline section                                                                                                                                                         |
| `vision.md` / market-facing copy                                                                          | **Not touched.** Provisioner is internal IR vocabulary, not market framing (per memory `rntme_vision_framing.md`)                                                                                |

## 13. Plan split

The implementation breaks naturally into three PRs. PR 1 and PR 2 can land independently because the executor skips the provision stage for any module without a `provisioner` block.

### PR 1 — Manifest schema + discovery + deploy-core surface

- Manifest schema extension in `@rntme/module-skeleton`.
- `DiscoveredModule.provisioner` plumbed through `@rntme/blueprint`.
- `runProvisioners`, `ProvisionerContract`, `DEPLOY_PROVISION_*` error codes in `@rntme/deploy-core`.
- Provisioner-env-mapping resolver in `@rntme/deploy-core`.
- Tests for all of the above using fake provisioners.
- Doc touches: module-skeleton README, blueprint README, deploy-core README, AGENTS.md §3 paragraph, AGENTS.md §6 first how-to.

### PR 2 — Persistence, executor wiring, render integration, target-secret CRUD

- Drizzle migration adding `provision_result*` columns on `deployment` and `target_secrets_*` columns on `deploy_target`.
- Repos and use-cases for target-secret CRUD in `platform-storage` / `platform-core`.
- HTTP routes `PUT/DELETE/GET …/secrets/:name` in `apps/platform-http`.
- Executor wiring: five-phase pipeline; decryption boundary; redactor extension.
- Render integration: third argument; ENV_MAPPINGS resolver; digest change.
- Schema registry `target-secrets/schemas.ts`.
- Integration test for ordering and skip-when-no-provisioner.
- Doc touches: platform-http README, deploy-dokploy README, CLAUDE.md §Architecture, AGENTS.md §6 second how-to, AGENTS.md §10 glossary, docs/architecture.md.

### PR 3 — Auth0 concrete provisioner + tear-down hook

- `modules/identity/auth0/src/provisioner.ts` and `mgmt-client.ts`.
- Auth0 manifest gains `provisioner` block.
- Conformance contract test in `@rntme/deploy-core`.
- ENV_MAPPINGS export; render-side resolver test against the real mapping table.
- Coordination edit on `2026-05-03-project-update-delete-operations-design.md` (decision row + tear-down paragraph) **or** errata file, depending on its merge status.
- E2E test gated on `AUTH0_E2E=1`.
- Doc touches: `modules/identity/auth0/README.md`.

### Operational follow-up after PR 3

- Bootstrap an Auth0 Mgmt API client in the demo tenant (one-time per-tenant), grant it `read/create/update/delete:clients`, `…:resource_servers`, `…:connections`, `…:client_grants`.
- PUT the `auth0Mgmt` target secret on the `notes-demo` deploy target through the new API.
- Trigger a deploy. The provisioner brings the Auth0 SPA client into compliance (re-asserts `token_endpoint_auth_method='none'` if it was reverted), creates the Resource Server if missing, and ensures the SPA is on the connection's enabled_clients.
- Record outcome in `docs/history/plans/historical/notes-demo-provisioner-rollout-<date>.md`.

## 14. Out of scope (explicit)

- Stripe / Resend / S3 / other vendor provisioners. The contract is generic; their concrete implementations are individual specs.
- Provisioners for non-integration categories (presentation, analytics) — they have no external state today.
- Auth0 Organizations auto-creation, runtime org-scoped login, and introspection-sidecar org claim handling.
- Out-of-process / sandboxed provisioner execution.
- Drift detection or background reconciliation. Provision is deploy-trigger only.
- Backwards-compatibility shims for existing deploy targets without `targetSecretsCiphertext`. Pre-stable project; the single existing target is migrated via API.
- M2M `clientSecret` rotation flow. Documented limitation; separate CLI command.
- Runtime-side `client.boot` or introspection-sidecar changes. v1 only consumes new env vars; protocol stays.

## 15. Risks and reversibility

| Risk                                                                                  | Likelihood | Impact                                                            | Mitigation                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic import of a module's `provisioner.entry` loads malicious or buggy code into the platform-http process | low | platform-http instability or credential exposure                 | All modules currently live in the same monorepo; PR review gates new ones. v2 sandbox is the long-term mitigation. Per-module timeout caps blast radius. Strict log redaction prevents secret exfiltration via stderr. |
| Auth0 Mgmt API rate limit (default 50/sec for free tier) hits during a multi-blueprint deploy day | low-med    | one deploy `failed` with `DEPLOY_PROVISION_AUTH0_RATE_LIMITED`    | Backoff inside the call (3 attempts, exponential). Reconcile is fast (≤6 calls per deploy when converged). Operator increases tenant tier if recurrent.                                                  |
| Tenant operator manually deletes a provisioned SPA client between deploys             | low        | next deploy succeeds (recreate) but issues a fresh client_id      | The render digest changes; runtime apps redeploy with the new client_id automatically. End-user effect is one re-login.                                                                                  |
| `targetSecretsCiphertext` key version is rotated, old key not retained                | very low   | provisioner cannot decrypt creds; deploy fails                    | Existing crypto plumbing keeps key versions. PR 2 carries the migration that sets initial `key_version=1`. Rotation is not in this spec.                                                                  |
| Provisioner emits secret value in error message text                                  | medium     | secret leaked to deployment-logs                                  | Log redactor extension covers field-name patterns *and* any value living under `secretOutputs`/`targetSecrets`. Auth0 module wraps Mgmt API errors and never includes raw response bodies in messages.   |
| Tear-down deletes a SPA client that is shared with a non-rntme app on the same tenant | low        | unrelated app breaks                                              | Tear-down keys deletion off `priorOutputs.spaClient.id` only. A SPA client never created by this provisioner has no record in `provisionResult` and is never touched.                                    |
| Project-delete spec merges before this one with a tear-down hook contract that does not match | medium     | one-PR coordination edit, not a code conflict                     | This spec ships either an inline edit on the in-flight spec or an errata file (§9). Both are reviewed in PR 3.                                                                                            |

All deployment-table additions and deploy-target-table additions are nullable; rolling back the migration drops the columns without affecting existing rows. The contract is additive in `module.json` (`provisioner` is optional). The five-phase executor is functionally indistinguishable from the four-phase one for any deployment whose modules do not declare provisioners.

## 16. Why this shape

Three principles drive the design:

- **One bounded authoring object.** The blueprint folder remains the single thing the operator versions and ships; provisioning rules live inside the same modules that ship the runtime and the client. No external IaC artifact, no separate CI track, no parallel reconciler. This is the same property the project already enforces for PDM/QSM migrations and seed.
- **Every contract is a first-class shape.** The `provisioner` block is a typed, validated, schema-versioned member of the manifest, with the same handshake quality as `capabilities`, `client`, and `secrets`. The cost of formalizing it once is paid back when Stripe, Resend, S3, Clerk, and WorkOS modules each ship their reconcilers under the same shape, with the same test conformance, the same env-mapping mechanism, and the same tear-down semantics.
- **Reconcile, don't track.** The desired state is the `(blueprint + target)` pair; the actual state is whatever Auth0 currently holds. Each deploy converges actual to desired, with `priorOutputs` as the only memory the platform keeps about external state. There is no Terraform-style state file to lose, drift, or merge-conflict on. The single edge case (M2M `clientSecret`) is documented and bounded.
