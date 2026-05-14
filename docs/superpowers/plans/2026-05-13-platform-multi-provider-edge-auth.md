# Platform Multi-Provider Edge Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use exactly `superpowers:subagent-driven-development` to implement this plan task-by-task in the current session. Do not substitute `superpowers:executing-plans`, manual-only execution, or another development workflow. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Research and investigation:** Scout/Judge research, drift analysis, and architecture investigation tasks must also use subagents instead of being performed only in the PM thread. Choose each subagent model by task complexity: lightweight model for mechanical lookup, standard model for cross-file synthesis, strongest available model for architecture, security, deployment-risk, or final-audit judgment. Record the model choice rationale in the task receipt.

**Goal:** Replace the unsafe single-provider platform PAT auth attempt with first-class ordered edge auth providers, then make the deployed platform accept both CLI PATs and Auth0 browser JWTs without removing edge auth.

**Architecture:** Auth middleware becomes `providers[]` in blueprint and deploy plan artifacts. `deploy-dokploy` renders one nginx auth chain per protected route; `platform-tokens` is a domain-service HTTP introspection provider, while `auth0` remains a module-backed HTTP introspection provider. Runtime artifacts expose public project-routed binding paths, native bindings dispatch through native handlers without Graph IR files, and bindings support response headers/status so PAT introspection can satisfy the nginx edge contract.

**Tech Stack:** Bun 1.3, TypeScript, Zod, Hono, nginx `auth_request`, `@rntme/blueprint`, `@rntme/deploy-core`, `@rntme/deploy-dokploy`, `@rntme/bindings`, `@rntme/bindings-http`, `@rntme/runtime`, `@rntme/deploy-bundle-input`, platform native handlers.

---

## Scope Check

This plan intentionally stays one cross-layer plan because the live blocker is an end-to-end contract, not a set of independent enhancements. Splitting blueprint, deploy, nginx, runtime, and platform token work into isolated landing branches would recreate the current failure mode: one layer would look fixed while adjacent contracts remain incompatible.

Current branch state matters:

- `dbdec34c`, `9b30f01d`, and `c365b6fe` are local commits already on `main`.
- `c365b6fe` is unsafe to push until this full plan lands and verifies.
- The implementation should evolve the current local state into the final `providers[]` model through new commits. Do not push partial runtime-affecting auth changes to `origin/main`.

Run all commands from `/home/coder/project` unless a step states a package directory.

## File Structure

```
packages/artifacts/blueprint/src/
  parse/schema.ts                    MODIFY - auth provider-list schema
  types/artifact.ts                  MODIFY - AuthProviderDecl + MiddlewareDecl
  validate/composition.ts            MODIFY - provider-indexed composition checks

packages/artifacts/blueprint/test/unit/
  parse.test.ts                      MODIFY - providers[] parser tests
  validate-composition.test.ts       MODIFY - provider target and edgeAuth tests

packages/deploy/deploy-core/src/
  composed-project.ts                MODIFY - deploy input auth provider-list type
  edge.ts                            MODIFY - planned auth middleware providers[]

packages/deploy/deploy-core/test/unit/
  edge.test.ts                       MODIFY - ordered provider plan tests

packages/deploy/deploy-dokploy/src/
  nginx.ts                           MODIFY - nginx auth provider OR-chain

packages/deploy/deploy-dokploy/test/unit/
  nginx.test.ts                      MODIFY - chain rendering and header forwarding tests

packages/deploy/deploy-dokploy/test/integration/
  edge-auth.test.ts                  MODIFY - nginx 401 fallthrough and 200 acceptance tests

packages/artifacts/bindings/src/
  types/input-from.ts                MODIFY - response status/headers types
  parse/schema.ts                    MODIFY - response status/headers schema
  validate/structural.ts             MODIFY - header/status validation
  types/result.ts                    MODIFY - response header validation error code

packages/artifacts/bindings/test/unit/
  parse/schema.test.ts               MODIFY - response headers/status parse tests
  validate/structural.test.ts        MODIFY - unsafe header tests

packages/runtime/bindings-http/src/
  runtime/render-response.ts         MODIFY - render headers/status
  runtime/operation-handler.ts       MODIFY - apply rendered headers
  startup/compile-plan.ts            MODIFY - skip Graph IR compile for native bindings

packages/runtime/bindings-http/test/unit/
  render-response.test.ts            MODIFY - header/status rendering tests
  compile-plan-operation.test.ts     MODIFY - native binding compile skip tests

packages/runtime/bindings-http/test/integration/
  router.test.ts                     MODIFY - response headers over Hono

packages/runtime/runtime/src/
  manifest/types.ts                  MODIFY - optional HTTP binding mount base
  manifest/schema.ts                 MODIFY - parse optional HTTP binding mount base
  manifest/validate.ts               MODIFY - default `/api`, validate `/`
  plugins/http-surface.ts            MODIFY - mount bindings at manifest base
  start/start-service.ts             MODIFY - route native operation names into executor
  plugins/executors/native-operation-executor.ts MODIFY - clear missing-native behavior

packages/runtime/runtime/test/unit/
  manifest-parse.test.ts             MODIFY - binding mount base parse/default tests
  manifest-validate.test.ts          MODIFY - validation tests
  native-operation-executor.test.ts  MODIFY - missing handler fallback/error tests

packages/runtime/runtime/test/integration/
  http-surface-default-middleware.test.ts MODIFY - default `/api` still works

packages/platform/deploy-bundle-input/src/
  runtime-module-wiring.ts           MODIFY - skip non-module auth providers
  to-deploy-core-input.ts            MODIFY - route-prefix bindings and manifest mount base

packages/platform/deploy-bundle-input/test/
  runtime-module-wiring.test.ts      MODIFY - tokens provider does not emit proto
  to-deploy-core-input.test.ts       MODIFY - runtime artifact routes and platform bundle conversion

apps/platform/blueprint/
  project.json                       MODIFY - final multi-provider auth middleware
  services/tokens/bindings/bindings.json MODIFY - `GET /introspect` binding
  test/platform-blueprint.test.ts    MODIFY - route/auth assertions
  test/platform-tokens-handler.test.ts MODIFY - active/inactive output assertions

demo/notes-blueprint/project.json    MODIFY - move auth middleware to providers[]

docs/current/owners/**
  MODIFY - owner docs for changed contracts
docs/decision-system.md              MODIFY - record target scalable auth decision
docs/goals/cv-extract-platform-client-deploy-e2e/**
  MODIFY - record chosen architecture and resumed T012 proof
```

---

## Task 0: Preflight and Branch Hygiene

**Files:**
- Read: `docs/superpowers/specs/2026-05-13-platform-multi-provider-edge-auth-design.md`
- Read: `docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md`
- Read: `docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml`

- [ ] **Step 1: Confirm current branch and local commits**

Run:

```bash
git status --short
git log --oneline -6
```

Expected:

- Branch is `main`.
- Recent commits include `7251e32c`, `c365b6fe`, `9b30f01d`, and `dbdec34c`.
- Dirty files and untracked redeploy logs may exist. Do not stage unrelated files.

- [ ] **Step 2: Reproduce the current deploy-bundle blocker**

Run:

```bash
bun --eval "import { loadComposedBlueprint } from '@rntme/blueprint'; import { toDeployCoreInput } from '@rntme/deploy-bundle-input'; const r = await loadComposedBlueprint('apps/platform/blueprint'); if (!r.ok) { console.log(JSON.stringify(r.errors, null, 2)); process.exit(1); } try { await toDeployCoreInput(r.value, 'apps/platform/blueprint'); console.log('converted'); } catch (err) { console.error(err instanceof Error ? err.message : String(err)); process.exit(1); }"
```

Expected before implementation: FAIL with `DEPLOY_BUNDLE_MODULE_PROTO_UNKNOWN:tokens`.

- [ ] **Step 3: Confirm no implementation files are staged**

Run:

```bash
git diff --cached --name-status
```

Expected before Task 1: no staged implementation files.

---

## Task 1: Convert Blueprint Auth Middleware to `providers[]`

**Files:**
- Modify: `packages/artifacts/blueprint/src/parse/schema.ts`
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`
- Modify: `packages/artifacts/blueprint/src/validate/composition.ts`
- Modify: `packages/artifacts/blueprint/test/unit/parse.test.ts`
- Modify: `packages/artifacts/blueprint/test/unit/validate-composition.test.ts`

- [ ] **Step 1: Write parser tests for ordered providers**

Replace the auth middleware tests in `packages/artifacts/blueprint/test/unit/parse.test.ts` with provider-list expectations:

```ts
describe('parseProjectBlueprint auth middleware', () => {
  it('accepts an auth middleware with ordered providers', () => {
    const r = parseProjectBlueprint({
      name: 'platform',
      services: ['app', 'tokens', 'identity-auth0'],
      middleware: {
        auth: {
          kind: 'auth',
          providers: [
            {
              provider: 'platform-tokens',
              moduleSlug: 'tokens',
              introspectPath: '/api/tokens/introspect',
              introspectPort: 3000,
            },
            {
              provider: 'auth0',
              audience: 'https://platform.rntme.com/api',
              moduleSlug: 'identity-auth0',
            },
          ],
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.middleware?.auth).toMatchObject({
        kind: 'auth',
        providers: [
          { provider: 'platform-tokens', moduleSlug: 'tokens' },
          { provider: 'auth0', moduleSlug: 'identity-auth0' },
        ],
      });
    }
  });

  it('rejects legacy single-provider auth middleware shape', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app', 'identity-auth0'],
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'auth0',
          audience: 'https://demo.rntme.com/api',
          moduleSlug: 'identity-auth0',
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects auth0 provider entries that omit audience', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app', 'identity-auth0'],
      middleware: {
        auth: {
          kind: 'auth',
          providers: [{ provider: 'auth0', moduleSlug: 'identity-auth0' }],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects platform-tokens provider entries without path or port', () => {
    const r = parseProjectBlueprint({
      name: 'platform',
      services: ['app', 'tokens'],
      middleware: {
        auth: {
          kind: 'auth',
          providers: [{ provider: 'platform-tokens', moduleSlug: 'tokens' }],
        },
      },
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run parser tests and verify they fail**

Run:

```bash
bun test packages/artifacts/blueprint/test/unit/parse.test.ts
```

Expected: FAIL because `providers` is not accepted and legacy single-provider shape is still accepted.

- [ ] **Step 3: Update blueprint auth types**

In `packages/artifacts/blueprint/src/types/artifact.ts`, replace the auth fields on `MiddlewareDecl` with explicit provider entries:

```ts
export type AuthProviderDecl =
  | {
      readonly provider: 'auth0';
      readonly audience: string;
      readonly moduleSlug: string;
    }
  | {
      readonly provider: 'platform-tokens';
      readonly moduleSlug: string;
      readonly introspectPath: string;
      readonly introspectPort: number;
    };

export type MiddlewareDecl =
  | {
      readonly kind: 'auth';
      readonly providers: readonly AuthProviderDecl[];
      readonly policy?: string;
    }
  | {
      readonly kind: string;
      readonly provider?: string;
      readonly policy?: string;
    };
```

- [ ] **Step 4: Update Zod schema**

In `packages/artifacts/blueprint/src/parse/schema.ts`, define provider schemas and make `authMiddleware` require non-empty `providers[]`:

```ts
const authProviderBase = z.object({
  provider: nonEmptyString,
  moduleSlug: nonEmptyString,
}).strict();

const auth0Provider = authProviderBase.extend({
  provider: z.literal('auth0'),
  audience: nonEmptyString,
});

const platformTokensProvider = authProviderBase.extend({
  provider: z.literal('platform-tokens'),
  introspectPath: z.string().startsWith('/'),
  introspectPort: z.number().int().positive(),
});

const authProvider = z.union([auth0Provider, platformTokensProvider]);

const authMiddleware = z
  .object({
    kind: z.literal('auth'),
    providers: z.array(authProvider).min(1),
    policy: nonEmptyString.optional(),
  })
  .strict();
```

Keep `genericMiddleware` unchanged so non-auth middleware that uses `provider` remains valid.

- [ ] **Step 5: Update composition tests for provider-indexed validation**

In `packages/artifacts/blueprint/test/unit/validate-composition.test.ts`, update auth fixtures to use `providers[]`. Add this test:

```ts
it('accepts mixed platform-tokens and auth0 providers for one mounted auth middleware', () => {
  const r = validateBlueprintComposition({
    project: {
      name: 'platform',
      services: ['app', 'tokens', 'identity-auth0'],
      routes: { http: { '/api/app': 'app', '/api/tokens': 'tokens' } },
      middleware: {
        auth: {
          kind: 'auth',
          providers: [
            {
              provider: 'platform-tokens',
              moduleSlug: 'tokens',
              introspectPath: '/api/tokens/introspect',
              introspectPort: 3000,
            },
            {
              provider: 'auth0',
              audience: 'https://platform.rntme.com/api',
              moduleSlug: 'identity-auth0',
            },
          ],
        },
      },
      mounts: [{ target: 'http:/api/app', use: ['auth'] }],
    },
    services: {
      app: svc('app', 'domain', { hasBindings: true }),
      tokens: svc('tokens', 'domain', { hasBindings: true }),
      'identity-auth0': svc('identity-auth0', 'integration-module'),
    },
    catalogManifest: {
      components: [],
      operations: [],
      modulesWithBoot: [{ name: '@rntme/identity-auth0' }],
      categoryToModule: { identity: '@rntme/identity-auth0' },
      publicConfig: {},
      moduleEdgeAuth: {
        '@rntme/identity-auth0': {
          kind: 'introspection-sidecar',
          transport: 'http',
          method: 'GET',
          path: '/introspect',
          port: 50052,
        },
      },
    },
    discoveredModules: {
      '@rntme/identity-auth0': {
        manifest: moduleManifest('@rntme/identity-auth0', 'auth0'),
        packageDir: '/tmp/identity-auth0',
        projectKey: 'identity',
        publicConfig: {},
      },
    },
  });

  expect(r.ok, r.ok ? '' : JSON.stringify(r.errors, null, 2)).toBe(true);
});
```

Also add a negative test asserting path `project.middleware.auth.providers.0.moduleSlug` when a provider references an unknown service.

- [ ] **Step 6: Implement provider iteration in composition validation**

In `packages/artifacts/blueprint/src/validate/composition.ts`, add helpers:

```ts
function authProvidersForComposition(declaration: MiddlewareDecl): readonly AuthProviderDecl[] {
  return declaration.kind === 'auth' ? declaration.providers : [];
}

function isPlatformTokensProvider(provider: AuthProviderDecl): boolean {
  return provider.provider === 'platform-tokens';
}
```

Update middleware provider validation to iterate `declaration.providers.entries()` and use provider-indexed paths:

```ts
for (const [name, declaration] of Object.entries(input.project.middleware ?? {})) {
  if (declaration.kind === 'auth') {
    for (const [providerIndex, providerDecl] of declaration.providers.entries()) {
      const providerSlug = providerDecl.moduleSlug;
      const provider = input.services[providerSlug];
      const providerPath = `project.middleware.${name}.providers.${providerIndex}.moduleSlug`;
      if (provider === undefined) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE,
          message: `middleware "${name}" provider[${providerIndex}] references unknown service "${providerSlug}"`,
          path: providerPath,
        });
        continue;
      }
      if (isPlatformTokensProvider(providerDecl)) {
        if (provider.kind !== 'domain') {
          errors.push({
            layer: 'composition',
            code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
            message: `middleware "${name}" provider[${providerIndex}] "${providerSlug}" must be a domain service for platform-tokens`,
            path: providerPath,
          });
        }
        continue;
      }
      if (!isIntegrationKind(provider.kind)) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
          message: `middleware "${name}" provider[${providerIndex}] "${providerSlug}" must be an integration service`,
          path: providerPath,
        });
      }
    }
    continue;
  }
  const providerSlug = declaration.provider;
  if (providerSlug === undefined) continue;
  const provider = input.services[providerSlug];
  if (provider === undefined) {
    errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE,
      message: `middleware "${name}" references unknown provider service "${providerSlug}"`,
      path: `project.middleware.${name}.provider`,
    });
    continue;
  }
  if (!isIntegrationKind(provider.kind)) {
    errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
      message: `middleware "${name}" provider "${providerSlug}" must be an integration service`,
      path: `project.middleware.${name}.provider`,
    });
  }
}
```

Update `checkAuthModuleVendors` and `checkAuthModuleEdgeAuth` to loop `declaration.providers.entries()` and skip only `platform-tokens` entries.

- [ ] **Step 7: Run blueprint tests**

Run:

```bash
bun test packages/artifacts/blueprint/test/unit/parse.test.ts packages/artifacts/blueprint/test/unit/validate-composition.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/artifacts/blueprint/src/parse/schema.ts packages/artifacts/blueprint/src/types/artifact.ts packages/artifacts/blueprint/src/validate/composition.ts packages/artifacts/blueprint/test/unit/parse.test.ts packages/artifacts/blueprint/test/unit/validate-composition.test.ts
git commit -m "feat(blueprint): model auth middleware providers"
```

---

## Task 2: Plan Ordered Auth Providers in `deploy-core`

**Files:**
- Modify: `packages/deploy/deploy-core/src/composed-project.ts`
- Modify: `packages/deploy/deploy-core/src/edge.ts`
- Modify: `packages/deploy/deploy-core/test/unit/edge.test.ts`

- [ ] **Step 1: Write deploy-core provider-list tests**

In `packages/deploy/deploy-core/test/unit/edge.test.ts`, update `baseProject.middleware.auth` to:

```ts
auth: {
  kind: 'auth',
  providers: [
    {
      provider: 'auth0',
      audience: 'https://commerce.example.com/api',
      moduleSlug: 'mod-workos',
    },
  ],
},
```

Add a platform-style test:

```ts
it('plans ordered auth providers with platform-tokens first and auth0 second', () => {
  const project: ComposedProjectInput = {
    ...baseProject,
    services: {
      app: { slug: 'app', kind: 'domain' },
      tokens: { slug: 'tokens', kind: 'domain' },
      'mod-workos': { slug: 'mod-workos', kind: 'integration-module' },
    },
    routes: { http: { '/api/projects': 'app', '/api/tokens': 'tokens' } },
    middleware: {
      auth: {
        kind: 'auth',
        providers: [
          {
            provider: 'platform-tokens',
            moduleSlug: 'tokens',
            introspectPath: '/api/tokens/introspect',
            introspectPort: 3000,
          },
          {
            provider: 'auth0',
            audience: 'https://commerce.example.com/api',
            moduleSlug: 'mod-workos',
          },
        ],
      },
    },
    mounts: [{ target: 'http:/api/projects', use: ['auth'] }],
  };

  const r = buildProjectDeploymentPlan(project, config);

  expect(r.ok, r.ok ? '' : JSON.stringify(r.errors, null, 2)).toBe(true);
  if (!r.ok) return;
  expect(r.value.edge.middleware).toEqual([
    {
      mountTarget: 'http:/api/projects',
      name: 'auth',
      kind: 'auth',
      providers: [
        {
          index: 0,
          provider: 'platform-tokens',
          moduleSlug: 'tokens',
          introspectPath: '/api/tokens/introspect',
          introspectPort: 3000,
        },
        {
          index: 1,
          provider: 'auth0',
          audience: 'https://commerce.example.com/api',
          moduleSlug: 'mod-workos',
          introspectPath: '/introspect',
          introspectPort: 50052,
        },
      ],
    },
  ]);
});
```

Add a negative test where `platform-tokens` omits `introspectPath`; assert `DEPLOY_PLAN_AUTH_MIDDLEWARE_INCOMPLETE` and path `middleware.auth.providers.0.introspectPath`.

- [ ] **Step 2: Run deploy-core edge tests and verify they fail**

Run:

```bash
bun test packages/deploy/deploy-core/test/unit/edge.test.ts
```

Expected: FAIL because `EdgeMiddleware` still uses single provider fields.

- [ ] **Step 3: Replace deploy input and auth edge types**

In `packages/deploy/deploy-core/src/composed-project.ts`, replace `ProjectMiddlewareDecl` with:

```ts
export type ProjectAuthProviderDecl =
  | {
      readonly provider: 'auth0';
      readonly audience: string;
      readonly moduleSlug: string;
    }
  | {
      readonly provider: 'platform-tokens';
      readonly moduleSlug: string;
      readonly introspectPath: string;
      readonly introspectPort: number;
    };

export type ProjectAuthMiddlewareDecl = {
  readonly kind: 'auth';
  readonly providers: readonly ProjectAuthProviderDecl[];
  readonly policy?: string;
  readonly config?: unknown;
};

export type ProjectGenericMiddlewareDecl = {
  readonly kind: string;
  readonly provider?: string;
  readonly policy?: string;
  readonly config?: unknown;
};

export type ProjectMiddlewareDecl = ProjectAuthMiddlewareDecl | ProjectGenericMiddlewareDecl;
```

In `packages/deploy/deploy-core/src/edge.ts`, replace the auth branch in `EdgeMiddleware` with:

```ts
export type EdgeAuthProvider = {
  readonly index: number;
  readonly provider: string;
  readonly moduleSlug: string;
  readonly introspectPath: string;
  readonly introspectPort: number;
  readonly audience?: string;
};
```

Then the auth middleware branch becomes:

```ts
  | {
      readonly mountTarget: string;
      readonly name: string;
      readonly kind: 'auth';
      readonly providers: readonly EdgeAuthProvider[];
      readonly policy?: string;
      readonly config?: unknown;
    };
```

- [ ] **Step 4: Implement `planAuthProviders`**

Add this helper in `packages/deploy/deploy-core/src/edge.ts`:

```ts
function planAuthProviders(
  middlewareName: string,
  decl: ProjectAuthMiddlewareDecl,
  project: ComposedProjectInput,
  workloads: readonly DeploymentWorkload[],
  integrationWorkloads: ReadonlyMap<string, IntegrationModuleWorkload>,
  errors: DeploymentPlanError[],
  vars: ResolvedVars,
): EdgeAuthProvider[] | null {
  const planned: EdgeAuthProvider[] = [];
  const errorCountBefore = errors.length;
  for (const [index, providerDecl] of decl.providers.entries()) {
    const pathBase = `middleware.${middlewareName}.providers.${index}`;
    if (providerDecl.provider === 'platform-tokens') {
      const providerWorkload = workloads.find(
        (w) => w.kind === 'domain-service' && w.serviceSlug === providerDecl.moduleSlug,
      );
      if (providerWorkload === undefined) {
        errors.push({
          code: 'DEPLOY_PLAN_AUTH_MODULE_WORKLOAD_MISSING',
          message: `auth middleware "${middlewareName}" provider[${index}] references missing domain-service workload "${providerDecl.moduleSlug}"`,
          middleware: middlewareName,
          service: providerDecl.moduleSlug,
          path: `${pathBase}.moduleSlug`,
        });
        continue;
      }
      planned.push({
        index,
        provider: providerDecl.provider,
        moduleSlug: applyVars(providerDecl.moduleSlug, vars),
        introspectPath: applyVars(providerDecl.introspectPath, vars),
        introspectPort: providerDecl.introspectPort,
      });
      continue;
    }

    const moduleWorkload = integrationWorkloads.get(providerDecl.moduleSlug);
    if (moduleWorkload === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_AUTH_MODULE_WORKLOAD_MISSING',
        message: `auth middleware "${middlewareName}" provider[${index}] references missing integration module workload "${providerDecl.moduleSlug}"`,
        middleware: middlewareName,
        service: providerDecl.moduleSlug,
        path: `${pathBase}.moduleSlug`,
      });
      continue;
    }
    if (providerDecl.provider === 'auth0' && !isNonEmptyString(moduleWorkload.env.AUTH0_DOMAIN)) {
      errors.push({
        code: 'DEPLOY_PLAN_AUTH_MODULE_ENV_INCOMPLETE',
        message: `auth module workload "${providerDecl.moduleSlug}" missing AUTH0_DOMAIN env`,
        service: providerDecl.moduleSlug,
        path: `modules.${providerDecl.moduleSlug}.env.AUTH0_DOMAIN`,
      });
      continue;
    }
    const moduleInfo = project.modules?.[providerDecl.moduleSlug];
    const edgeAuth = moduleInfo?.edgeAuth;
    if (edgeAuth === null || edgeAuth === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING',
        message: `auth middleware "${middlewareName}" provider[${index}] requires module "${providerDecl.moduleSlug}" to declare capabilities.edgeAuth`,
        middleware: middlewareName,
        moduleSlug: providerDecl.moduleSlug,
        path: `middleware.${middlewareName}.providers.${index}.moduleSlug`,
      });
      continue;
    }
    planned.push({
      index,
      provider: providerDecl.provider,
      audience: applyVars(providerDecl.audience, vars),
      moduleSlug: applyVars(providerDecl.moduleSlug, vars),
      introspectPath: edgeAuth.path,
      introspectPort: edgeAuth.port,
    });
  }
  return errors.length === errorCountBefore ? planned : null;
}
```

Import `ProjectAuthMiddlewareDecl` from `./composed-project.js`. Use this helper where `decl.kind === 'auth'`, then push one `EdgeMiddleware` with `providers: plannedProviders`.

- [ ] **Step 5: Run deploy-core tests**

Run:

```bash
bun test packages/deploy/deploy-core/test/unit/edge.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/deploy/deploy-core/src/composed-project.ts packages/deploy/deploy-core/src/edge.ts packages/deploy/deploy-core/test/unit/edge.test.ts
git commit -m "feat(deploy-core): plan ordered auth providers"
```

---

## Task 3: Render nginx Auth Provider Chains

**Files:**
- Modify: `packages/deploy/deploy-dokploy/src/nginx.ts`
- Modify: `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts`
- Modify: `packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts`

- [ ] **Step 1: Update unit tests for provider chains**

In `packages/deploy/deploy-dokploy/test/unit/nginx.test.ts`, change auth fixtures to the new `providers[]` edge shape. Add this unit test:

```ts
it('renders a platform-tokens to auth0 auth_request chain', () => {
  const edge: EdgePlan = {
    routes: [
      {
        id: 'http:/api/projects',
        kind: 'http',
        path: '/api/projects',
        targetService: 'projects',
        targetWorkload: 'projects',
      },
    ],
    middleware: [
      {
        mountTarget: 'http:/api/projects',
        name: 'auth',
        kind: 'auth',
        providers: [
          {
            index: 0,
            provider: 'platform-tokens',
            moduleSlug: 'tokens',
            introspectPath: '/api/tokens/introspect',
            introspectPort: 3000,
          },
          {
            index: 1,
            provider: 'auth0',
            audience: 'https://platform.rntme.com/api',
            moduleSlug: 'identity-auth0',
            introspectPath: '/introspect',
            introspectPort: 50052,
          },
        ],
      },
    ],
  };

  const rendered = renderNginxConfig(edge, {
    projects: 'http://projects:3000',
    tokens: 'http://tokens:3000',
    'identity-auth0': 'http://identity-auth0:50052',
  });

  expect(rendered).toContain('auth_request          /_rntme_auth_chain_http_api_projects__auth_0;');
  expect(rendered).toContain('location = /_rntme_auth_chain_http_api_projects__auth_0');
  expect(rendered).toContain('location = /_rntme_auth_chain_http_api_projects__auth_1');
  expect(rendered).toContain('error_page 401 = /_rntme_auth_chain_http_api_projects__auth_1;');
  expect(rendered).toContain('upstream rntme_auth_tokens__0 {');
  expect(rendered).toContain('upstream rntme_auth_identity-auth0__1 {');
  expect(rendered).toContain('proxy_pass         http://rntme_auth_tokens__0/api/tokens/introspect;');
  expect(rendered).toContain('proxy_pass         http://rntme_auth_identity-auth0__1/introspect;');
  expect(rendered).toContain('proxy_set_header   X-Rntme-Audience   "https://platform.rntme.com/api";');
  expect(rendered).toContain('auth_request_set      $rntme_session_status $upstream_http_x_rntme_session_status;');
  expect(rendered).toContain('proxy_set_header      X-Rntme-Session-Status $rntme_session_status;');
});
```

The chain key (`__auth`) tracks the middleware mount; the per-provider locations append the index (`__auth_0`, `__auth_1`). The protected route's `auth_request` points directly at the first provider's internal location (`__auth_0`); each provider's 401 cascades to the next via `error_page 401`. The last provider has no `error_page`, so its 401 propagates back through `auth_request` to the route's canonical `@rntme_auth_401_*` named 401 location.

- [ ] **Step 2: Run nginx unit tests and verify they fail**

Run:

```bash
bun test packages/deploy/deploy-dokploy/test/unit/nginx.test.ts
```

Expected: FAIL because the renderer expects single provider fields.

- [ ] **Step 3: Replace auth block model**

In `packages/deploy/deploy-dokploy/src/nginx.ts`, replace `AuthBlock` with:

```ts
type AuthProviderBlock = {
  readonly chainKey: string;
  readonly providerIndex: number;
  readonly provider: string;
  readonly moduleSlug: string;
  readonly audience: string;
  readonly upstream: string;
  readonly upstreamKey: string;
  readonly introspectPath: string;
  readonly nextInternalPath: string | null;
};

type AuthChainBlock = {
  readonly key: string;
  readonly firstInternalPath: string;
};
```

Use `zoneName(`${m.mountTarget}__${m.name}`)` for the chain key so it is stable and safe.

- [ ] **Step 3b: Emit per-provider upstream blocks**

In `packages/deploy/deploy-dokploy/src/nginx.ts`, emit one upstream block per provider entry, keyed by `(moduleSlug, providerIndex)` so duplicate slugs in the same chain stay unique. Build `upstreamKey` as `rntme_auth_${moduleSlug}__${providerIndex}` and `upstream` as `${upstreamKey}` (the server line resolves to the workload's container address):

```nginx
upstream rntme_auth_tokens__0 {
  server tokens:3000;
}

upstream rntme_auth_identity-auth0__1 {
  server identity-auth0:50052;
}
```

The address comes from the existing service-address map passed to `renderNginxConfig` (resolved by `moduleSlug`); the `__<index>` suffix is the only new piece. Provider blocks reference this upstream in `proxy_pass http://${upstreamKey}${introspectPath};`.

- [ ] **Step 4: Render provider upstreams and chain locations**

Create internal locations in this shape:

```nginx
location = /_rntme_auth_chain_http_api_projects__auth_0 {
  internal;
  proxy_pass         http://rntme_auth_tokens__0/api/tokens/introspect;
  proxy_pass_request_body off;
  proxy_set_header   content-length     "";
  proxy_set_header   Authorization      $http_authorization;
  proxy_intercept_errors on;
  error_page 401 = /_rntme_auth_chain_http_api_projects__auth_1;
}

location = /_rntme_auth_chain_http_api_projects__auth_1 {
  internal;
  proxy_pass         http://rntme_auth_identity-auth0__1/introspect;
  proxy_pass_request_body off;
  proxy_set_header   content-length     "";
  proxy_set_header   Authorization      $http_authorization;
  proxy_set_header   X-Rntme-Audience   "https://platform.rntme.com/api";
  proxy_intercept_errors on;
}
```

For a protected route, render:

```nginx
auth_request          /_rntme_auth_chain_http_api_projects__auth_0;
auth_request_set      $rntme_user_sub      $upstream_http_x_rntme_user_sub;
auth_request_set      $rntme_user_audience $upstream_http_x_rntme_user_audience;
auth_request_set      $rntme_session_status $upstream_http_x_rntme_session_status;
error_page 401        = @rntme_auth_401_http_api_projects__auth;
proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;
proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;
proxy_set_header      X-Rntme-Session-Status $rntme_session_status;
proxy_set_header      Authorization         $http_authorization;
```

Keep the canonical named 401 body unchanged.

- [ ] **Step 5: Update integration test for 401 fallthrough and 200 acceptance**

In `packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts`, extract the existing listen code into:

```ts
function listenForTest(server: ReturnType<typeof createServer>): Promise<{ port: number; stop: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      server.off('error', reject);
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('failed to bind test server'));
        return;
      }
      resolve({
        port: addr.port,
        stop: () =>
          new Promise((res, rej) => {
            server.close((error) => {
              if (error) rej(error);
              else res();
            });
          }),
      });
    });
  });
}
```

Then add a second introspection server helper that returns `200` with headers:

```ts
async function startAcceptingIntrospectionServer(): Promise<{ port: number; stop: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === '/introspect' || req.url === '/api/tokens/introspect') {
      res.writeHead(200, {
        'X-Rntme-User-Sub': 'acct_1',
        'X-Rntme-User-Audience': 'urn:rntme:platform-tokens',
        'X-Rntme-Session-Status': 'ACTIVE',
      });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return listenForTest(server);
}
```

Add an app upstream helper:

```ts
async function startEchoAppServer(): Promise<{ port: number; stop: () => Promise<void> }> {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      userSub: req.headers['x-rntme-user-sub'],
      audience: req.headers['x-rntme-user-audience'],
      sessionStatus: req.headers['x-rntme-session-status'],
    }));
  });
  return listenForTest(server);
}
```

Add a test where provider 0 rejects and provider 1 accepts. Expected response:

```ts
expect(r.status).toBe(200);
expect(await r.json()).toEqual({
  userSub: 'acct_1',
  audience: 'urn:rntme:platform-tokens',
  sessionStatus: 'ACTIVE',
});
```

- [ ] **Step 6: Run dokploy tests**

Run:

```bash
bun test packages/deploy/deploy-dokploy/test/unit/nginx.test.ts packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts
```

Expected: PASS. Integration tests skip automatically when testcontainers is unavailable.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/deploy/deploy-dokploy/src/nginx.ts packages/deploy/deploy-dokploy/test/unit/nginx.test.ts packages/deploy/deploy-dokploy/test/integration/edge-auth.test.ts
git commit -m "feat(deploy-dokploy): render auth provider chains"
```

---

## Task 4: Add Response Headers and JSON Status to Bindings Artifacts

**Files:**
- Modify: `packages/artifacts/bindings/src/types/input-from.ts`
- Modify: `packages/artifacts/bindings/src/parse/schema.ts`
- Modify: `packages/artifacts/bindings/src/validate/structural.ts`
- Modify: `packages/artifacts/bindings/test/unit/parse/schema.test.ts`
- Modify: `packages/artifacts/bindings/test/unit/validate/structural.test.ts`

- [ ] **Step 1: Write bindings parser and structural tests**

Add parser test:

```ts
it('accepts json response status and headers', () => {
  const r = BindingArtifactSchema.safeParse({
    version: '1.0',
    graphSpecRef: 'g',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: {
      introspectToken: {
        exposure: 'read',
        graph: 'IntrospectToken',
        target: { engine: 'native', dialect: 'platform' },
        http: { method: 'GET', path: '/introspect', parameters: [] },
        response: {
          onOk: {
            json: null,
            headers: {
              'X-Rntme-User-Sub': '$result.subject.account.id',
              'X-Rntme-User-Audience': 'urn:rntme:platform-tokens',
              'X-Rntme-Session-Status': 'ACTIVE',
            },
          },
          onErr: {
            json: { code: '$error.code', message: '$error.message' },
            status: 401,
          },
        },
      },
    },
  });
  expect(r.success).toBe(true);
});
```

Add structural tests rejecting header names with newline and static header values with control characters.

- [ ] **Step 2: Run bindings tests and verify they fail**

Run:

```bash
bun test packages/artifacts/bindings/test/unit/parse/schema.test.ts packages/artifacts/bindings/test/unit/validate/structural.test.ts
```

Expected: FAIL because `headers` and JSON `status` are unknown keys.

- [ ] **Step 3: Widen response types**

In `packages/artifacts/bindings/src/types/input-from.ts`, replace response branch types with:

```ts
export type ResponseHeaders = Record<string, ExpressionTemplate | ExpressionObject | string | number | boolean>;

export type JsonResponseBranch = {
  json: unknown;
  status?: number;
  headers?: ResponseHeaders;
};

export type RedirectResponseBranch = {
  redirect: ExpressionTemplate | { expr: ExpressionTemplate | ExpressionObject };
  status?: 302 | 303;
  headers?: ResponseHeaders;
};

export type ResponseBranch = JsonResponseBranch | RedirectResponseBranch;
```

- [ ] **Step 4: Update Zod response schema**

In `packages/artifacts/bindings/src/parse/schema.ts`, add:

```ts
const ResponseHeadersSchema = z.record(
  z.string().min(1),
  z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]),
);

const JsonResponseBranchSchema = z
  .object({
    json: z.unknown(),
    status: z.number().int().min(100).max(599).optional(),
    headers: ResponseHeadersSchema.optional(),
  })
  .strict();

const RedirectResponseBranchSchema = z
  .object({
    redirect: RedirectSchema,
    status: z.union([z.literal(302), z.literal(303)]).optional(),
    headers: ResponseHeadersSchema.optional(),
  })
  .strict();

const ResponseBranchSchema = z.union([JsonResponseBranchSchema, RedirectResponseBranchSchema]).refine(
  (val) => 'json' in val || 'redirect' in val,
  { message: 'Response branch must have either json or redirect' },
);
```

- [ ] **Step 5: Validate response headers structurally**

In `packages/artifacts/bindings/src/validate/structural.ts`, add:

```ts
function isSafeHeaderName(name: string): boolean {
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name);
}

function isSafeStaticHeaderValue(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 0x09) continue;
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

function checkResponseHeaders(id: string, branchName: 'onOk' | 'onErr', branch: ResponseBranch, errors: BindingsError[]): void {
  const headers = branch.headers ?? {};
  for (const [name, value] of Object.entries(headers)) {
    if (!isSafeHeaderName(name)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_STRUCTURAL_RESPONSE_HEADER_UNSAFE,
        message: `binding "${id}": response.${branchName}.headers has unsafe header name "${name}"`,
        path: `bindings.${id}.response.${branchName}.headers.${name}`,
      });
    }
    if (!isSafeStaticHeaderValue(value)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_STRUCTURAL_RESPONSE_HEADER_UNSAFE,
        message: `binding "${id}": response.${branchName}.headers.${name} contains an unsafe static value`,
        path: `bindings.${id}.response.${branchName}.headers.${name}`,
      });
    }
  }
}
```

Add `BINDINGS_STRUCTURAL_RESPONSE_HEADER_UNSAFE` to `packages/artifacts/bindings/src/types/result.ts`, then call the helper for `onOk` and `onErr`.

- [ ] **Step 6: Run bindings package tests**

Run:

```bash
bun test packages/artifacts/bindings/test/unit/parse/schema.test.ts packages/artifacts/bindings/test/unit/validate/structural.test.ts
bun run --filter @rntme/bindings typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/artifacts/bindings/src/types/input-from.ts packages/artifacts/bindings/src/parse/schema.ts packages/artifacts/bindings/src/validate/structural.ts packages/artifacts/bindings/src/types/result.ts packages/artifacts/bindings/test/unit/parse/schema.test.ts packages/artifacts/bindings/test/unit/validate/structural.test.ts
git commit -m "feat(bindings): support response headers and status"
```

---

## Task 5: Render Response Headers in `bindings-http`

**Files:**
- Modify: `packages/runtime/bindings-http/src/runtime/render-response.ts`
- Modify: `packages/runtime/bindings-http/src/runtime/operation-handler.ts`
- Modify: `packages/runtime/bindings-http/test/unit/render-response.test.ts`
- Modify: `packages/runtime/bindings-http/test/integration/router.test.ts`

- [ ] **Step 1: Write runtime response rendering tests**

In `packages/runtime/bindings-http/test/unit/render-response.test.ts`, add:

```ts
it('renders expression-derived response headers and json status override', () => {
  const rendered = renderOkResponse(
    {
      onOk: {
        json: null,
        status: 204,
        headers: {
          'X-Rntme-User-Sub': '$result.subject.account.id',
          'X-Rntme-User-Audience': 'urn:rntme:platform-tokens',
          'X-Rntme-Session-Status': 'ACTIVE',
        },
      },
      onErr: { json: { code: '$error.code' } },
    },
    { result: { subject: { account: { id: 'acct_1' } } }, error: null },
  );

  expect(rendered).toEqual({
    kind: 'json',
    status: 204,
    body: null,
    headers: {
      'X-Rntme-User-Sub': 'acct_1',
      'X-Rntme-User-Audience': 'urn:rntme:platform-tokens',
      'X-Rntme-Session-Status': 'ACTIVE',
    },
  });
});
```

Add a test that an evaluated header containing `\n` returns:

```ts
{
  kind: 'json',
  status: 500,
  body: {
    code: 'BINDINGS_RUNTIME_INVALID_RESPONSE_HEADER',
    message: 'response header value is invalid',
  },
  headers: {},
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
bun test packages/runtime/bindings-http/test/unit/render-response.test.ts
```

Expected: FAIL because `RenderedResponse` has no `headers`.

- [ ] **Step 3: Add rendered headers**

In `packages/runtime/bindings-http/src/runtime/render-response.ts`, update:

```ts
export type RenderedResponse =
  | { kind: 'json'; status: number; body: unknown; headers: Record<string, string> }
  | { kind: 'redirect'; status: 302 | 303; location: string; headers: Record<string, string> };
```

Add:

```ts
function invalidHeader(): RenderedResponse {
  return {
    kind: 'json',
    status: 500,
    body: {
      code: 'BINDINGS_RUNTIME_INVALID_RESPONSE_HEADER',
      message: 'response header value is invalid',
    },
    headers: {},
  };
}

function renderHeaders(branch: ResponseBranch, scope: RenderScope): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(branch.headers ?? {})) {
    const evaluated = evaluateExpression(raw, toExprScope(scope));
    const value = evaluated === null || evaluated === undefined ? '' : String(evaluated);
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) return null;
    for (const char of value) {
      const code = char.charCodeAt(0);
      if (code === 0x09) continue;
      if (code < 0x20 || code === 0x7f) return null;
    }
    out[name] = value;
  }
  return out;
}
```

In `renderBranch`, render headers before returning. For JSON:

```ts
const headers = renderHeaders(branch, scope);
if (headers === null) return invalidHeader();
return { kind: 'json', status: branch.status ?? defaultStatus, body, headers };
```

For redirect, return `headers` with the redirect response.

- [ ] **Step 4: Apply headers in Hono operation handler**

In `packages/runtime/bindings-http/src/runtime/operation-handler.ts`, before `c.json` or `c.redirect`, add:

```ts
for (const [name, value] of Object.entries(rendered.headers)) {
  c.header(name, value);
}
```

When caching idempotency responses, include headers for JSON:

```ts
{ status: rendered.status, body: JSON.stringify(rendered.body ?? null), headers: rendered.headers }
```

- [ ] **Step 4b: Restore cached headers on idempotency replay**

In the same handler, on idempotency cache hit, replay the stored `headers` before returning the cached body. Where the current implementation reconstructs the response from the cache entry, add:

```ts
for (const [name, value] of Object.entries(cached.headers ?? {})) {
  c.header(name, value);
}
return c.body(cached.body, cached.status as StatusCode);
```

Treat a missing `cached.headers` (older entries written before this change) as an empty object so existing cache rows don't fail; pre-stable repo policy ([[project_pre_stable_stage]]) means we don't need a write-side migration. Add a unit test in `render-response.test.ts` or `operation-handler.test.ts` proving a cache hit replays `X-Rntme-User-Sub` from the stored headers.

- [ ] **Step 5: Add Hono integration assertion**

In `packages/runtime/bindings-http/test/integration/router.test.ts`, add a binding with response headers and assert:

```ts
expect(response.headers.get('x-rntme-user-sub')).toBe('acct_1');
expect(response.headers.get('x-rntme-session-status')).toBe('ACTIVE');
expect(response.status).toBe(200);
```

- [ ] **Step 6: Run bindings-http response tests**

Run:

```bash
bun test packages/runtime/bindings-http/test/unit/render-response.test.ts packages/runtime/bindings-http/test/integration/router.test.ts
bun run --filter @rntme/bindings-http typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/runtime/bindings-http/src/runtime/render-response.ts packages/runtime/bindings-http/src/runtime/operation-handler.ts packages/runtime/bindings-http/test/unit/render-response.test.ts packages/runtime/bindings-http/test/integration/router.test.ts
git commit -m "feat(bindings-http): emit configured response headers"
```

---

## Task 6: Make Native HTTP Bindings Start Without Graph IR Files

**Files:**
- Modify: `packages/runtime/bindings-http/src/startup/compile-plan.ts`
- Modify: `packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts`
- Modify: `packages/runtime/runtime/src/plugins/executors/native-operation-executor.ts`
- Modify: `packages/runtime/runtime/src/start/start-service.ts`
- Modify: `packages/runtime/runtime/test/unit/native-operation-executor.test.ts`

- [ ] **Step 1: Write compile-plan test for native graph skip**

In `packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts`, change the import to:

```ts
import { buildDefaultGraphIrOperationMap, buildPlan } from '../../src/startup/compile-plan.js';
```

Then add:

```ts
it('does not compile Graph IR for native bindings', () => {
  const result = buildDefaultGraphIrOperationMap(
    {
      artifact: {} as never,
      resolved: {
        publishProjectBundle: {
          entry: {
            exposure: 'action',
            graph: 'publishProjectBundle',
            target: { engine: 'native', dialect: 'platform' },
            http: {
              method: 'POST',
              path: '/api/projects/{projectId}/versions',
              parameters: [{ name: 'projectId', in: 'path', bindTo: 'projectId', required: true }],
            },
          },
          signature: {
            id: 'publishProjectBundle',
            inputs: {
              projectId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
            },
            output: { type: { kind: 'row', shape: 'CommandResult' }, from: '__native__' },
            effects: { localReads: false, localEmits: [], calls: [], waits: false },
          },
          outputShape: { name: 'CommandResult', origin: 'custom', fields: {} },
        },
      },
    },
    { version: '1.0-rc7', shapes: {}, graphs: {} },
    { entities: {} } as never,
    { projections: {}, relations: {} } as never,
  );

  expect(result).toEqual({ ok: true, value: {} });
});
```

- [ ] **Step 2: Run compile-plan test and verify it fails**

Run:

```bash
bun test packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts
```

Expected: FAIL because startup tries to compile `publishProjectBundle` from missing Graph IR.

- [ ] **Step 3: Skip native bindings when building compiled operation map**

In `packages/runtime/bindings-http/src/startup/compile-plan.ts`, change graph collection:

```ts
const graphIds = new Set(
  Object.values(validated.resolved)
    .filter((r) => r.entry.target.engine !== 'native')
    .map((r) => r.entry.graph),
);
```

Leave `plans[bindingId].operationName = entry.graph`, because the native executor dispatch key remains the operation name.

- [ ] **Step 4: Define missing native behavior**

In `packages/runtime/runtime/src/plugins/executors/native-operation-executor.ts`, change missing native behavior for names that look native-owned by checking a `nativeOperationNames` set passed to the constructor:

```ts
constructor(
  private readonly handlers: NativeOperationHandlerMap,
  private readonly fallback: OperationExecutor,
  private readonly nativeOperationNames: ReadonlySet<string> = new Set(Object.keys(handlers)),
) {}
```

Then:

```ts
if (handler === undefined && this.nativeOperationNames.has(input.operationName)) {
  return {
    ok: false,
    error: {
      code: 'NATIVE_OPERATION_HANDLER_MISSING',
      message: `native operation handler "${input.operationName}" is not registered`,
    },
  };
}
```

Keep fallback for Graph IR operations.

- [ ] **Step 5: Pass native binding names from `startService`**

In `packages/runtime/runtime/src/start/start-service.ts`, compute:

```ts
const nativeOperationNames = new Set(
  Object.values(service.bindings.resolved)
    .filter((r) => r.entry.target.engine === 'native')
    .map((r) => r.entry.graph),
);
```

Construct:

```ts
new NativeOperationExecutor(
  runtimeConfig.nativeOperationHandlers ?? {},
  baseOperationExecutor,
  nativeOperationNames,
)
```

Use `NativeOperationExecutor` when `nativeOperationNames.size > 0`, not only when handlers are non-empty.

- [ ] **Step 6: Run native tests**

Run:

```bash
bun test packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts packages/runtime/runtime/test/unit/native-operation-executor.test.ts
bun run --filter @rntme/bindings-http typecheck
bun run --filter @rntme/runtime typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/runtime/bindings-http/src/startup/compile-plan.ts packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts packages/runtime/runtime/src/plugins/executors/native-operation-executor.ts packages/runtime/runtime/src/start/start-service.ts packages/runtime/runtime/test/unit/native-operation-executor.test.ts
git commit -m "feat(runtime): dispatch native bindings without graph files"
```

---

## Task 7: Materialize Project-Routed Runtime Artifacts

**Files:**
- Modify: `packages/runtime/runtime/src/manifest/types.ts`
- Modify: `packages/runtime/runtime/src/manifest/schema.ts`
- Modify: `packages/runtime/runtime/src/manifest/validate.ts`
- Modify: `packages/runtime/runtime/src/plugins/http-surface.ts`
- Modify: `packages/runtime/runtime/test/unit/manifest-parse.test.ts`
- Modify: `packages/runtime/runtime/test/unit/manifest-validate.test.ts`
- Modify: `packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts`
- Modify: `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`
- Modify: `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts`

- [ ] **Step 1: Add tests for runtime binding mount base**

Add manifest tests asserting:

```ts
expect(parseManifest(JSON.stringify({
  rntmeVersion: '1.0',
  service: { name: 'svc', version: '1.0.0' },
  surface: { http: { bindingBasePath: '/' } },
})).toMatchObject({ ok: true });
```

and validation default:

```ts
expect(validateManifest(parsed.value, { major: 1, minor: 0, patch: 0 }).value.surface.http.bindingBasePath).toBe('/api');
```

Add one validation test rejecting `bindingBasePath: 'api'`.

- [ ] **Step 2: Run runtime manifest tests and verify they fail**

Run:

```bash
bun test packages/runtime/runtime/test/unit/manifest-parse.test.ts packages/runtime/runtime/test/unit/manifest-validate.test.ts
```

Expected: FAIL because `bindingBasePath` is unknown.

- [ ] **Step 3: Add `bindingBasePath` to runtime manifest**

In `packages/runtime/runtime/src/manifest/types.ts`:

```ts
surface?: {
  http?: {
    enabled?: boolean;
    port?: number;
    bindingBasePath?: string;
    bodyLimit?: HttpBodyLimitConfig;
    rateLimit?: HttpRateLimitConfig;
    cors?: HttpCorsConfig;
    securityHeaders?: HttpSecurityHeadersConfig;
  };
  grpc?: { enabled?: boolean; port?: number };
};
```

and in validated type:

```ts
bindingBasePath: string;
```

In `schema.ts`, add `bindingBasePath: z.string().startsWith('/').optional()`.

In `validate.ts`, default to `/api`, accept `/`, and reject values with `?`, `#`, or trailing slash except `/`.

- [ ] **Step 4: Mount bindings at configured base**

In `packages/runtime/runtime/src/plugins/http-surface.ts`, replace:

```ts
app.route('/api', router);
```

with:

```ts
app.route(httpCfg.bindingBasePath, router);
```

Verify that the body-limit, CORS, rate-limit, and security-headers middleware in the same file are mounted on **absolute** path patterns (e.g. `app.use('/api/*', bodyLimitMiddleware)`) and not relative to the binding base. Generated platform runtime artifacts use `bindingBasePath: '/'` with `/api/...` binding paths, so these middleware must continue to match `/api/*` regardless of the router mount. If any middleware currently derives its match from `bindingBasePath`, change it to the fixed `/api/*` pattern in this step so the runtime semantics stay identical between the default (`/api`) and the platform (`/`) configurations.

Add a unit test in `manifest-validate.test.ts` (or equivalent) asserting that switching `bindingBasePath` from `/api` to `/` does not change which routes the body-limit middleware applies to.

- [ ] **Step 5: Rewrite domain-service runtime bindings with route prefixes**

In `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`, add:

```ts
function buildDomainServiceBindingArtifacts(
  project: ComposedBlueprint,
  serviceSlug: string,
): unknown {
  const service = project.services[serviceSlug];
  const bindings = service?.bindings?.artifact;
  if (bindings === undefined) throw new Error(`DEPLOY_EXECUTOR_SERVICE_BINDINGS_NOT_FOUND:${serviceSlug}`);
  const routedEntries = Object.values(project.bindingRegistry).filter((entry) => entry.service === serviceSlug);
  if (routedEntries.length === 0) return bindings;
  const byBindingId = new Map(routedEntries.map((entry) => [entry.bindingId, entry]));
  return {
    ...bindings,
    bindings: Object.fromEntries(
      Object.entries(bindings.bindings).map(([bindingId, binding]) => {
        const routed = byBindingId.get(bindingId);
        if (routed === undefined) return [bindingId, binding];
        return [
          bindingId,
          {
            ...binding,
            http: {
              ...binding.http,
              method: routed.method,
              path: routed.path,
            },
          },
        ];
      }),
    ),
  };
}
```

Then in `buildRuntimeArtifactFiles`, emit:

```ts
surface: { http: { enabled: true, port: 3000, bindingBasePath: '/' }, grpc: { enabled: true, port: 50051 } },
```

and:

```ts
addJsonFile(files, 'bindings.json', buildDomainServiceBindingArtifacts(project, serviceSlug));
```

Also set `bindingBasePath: '/'` in `buildUiHostRuntimeArtifactFiles`.

- [ ] **Step 6: Add deploy-bundle tests for project-routed paths**

In `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts`, add assertions to the platform test:

```ts
const projectsManifest = JSON.parse(result.services.projects?.runtimeFiles?.['manifest.json'] ?? '{}');
expect(projectsManifest.surface.http.bindingBasePath).toBe('/');

const projectsBindings = JSON.parse(result.services.projects?.runtimeFiles?.['bindings.json'] ?? '{}');
expect(projectsBindings.bindings.listProjects.http.path).toBe('/api/projects');
expect(projectsBindings.bindings.publishProjectBundle.http.path).toBe('/api/projects/{projectId}/versions');

const tokensBindings = JSON.parse(result.services.tokens?.runtimeFiles?.['bindings.json'] ?? '{}');
expect(tokensBindings.bindings.introspectToken.http.path).toBe('/api/tokens/introspect');
```

- [ ] **Step 7: Run route tests**

Run:

```bash
bun test packages/runtime/runtime/test/unit/manifest-parse.test.ts packages/runtime/runtime/test/unit/manifest-validate.test.ts packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts
bun run --filter @rntme/runtime typecheck
bun run --filter @rntme/deploy-bundle-input typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/runtime/runtime/src/manifest/types.ts packages/runtime/runtime/src/manifest/schema.ts packages/runtime/runtime/src/manifest/validate.ts packages/runtime/runtime/src/plugins/http-surface.ts packages/runtime/runtime/test/unit/manifest-parse.test.ts packages/runtime/runtime/test/unit/manifest-validate.test.ts packages/runtime/runtime/test/integration/http-surface-default-middleware.test.ts packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts
git commit -m "feat(runtime): support project-routed binding paths"
```

---

## Task 8: Keep Domain Auth Providers Out of Runtime Module Wiring

**Files:**
- Modify: `packages/platform/deploy-bundle-input/src/runtime-module-wiring.ts`
- Modify: `packages/platform/deploy-bundle-input/test/runtime-module-wiring.test.ts`
- Modify: `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts`

- [ ] **Step 1: Write runtime-module-wiring tests**

In `packages/platform/deploy-bundle-input/test/runtime-module-wiring.test.ts`, add this helper below `makeCvExtractFixture()`:

```ts
function makePlatformAuthFixture(input: {
  readonly providers: readonly {
    readonly provider: 'platform-tokens' | 'auth0';
    readonly moduleSlug: string;
    readonly audience?: string;
    readonly introspectPath?: string;
    readonly introspectPort?: number;
  }[];
}): ComposedBlueprint {
  return {
    project: {
      name: 'platform',
      services: ['projects', 'tokens', 'identity-auth0'],
      routes: {
        http: {
          '/api/projects': 'projects',
          '/api/tokens': 'tokens',
        },
      },
      middleware: {
        auth: { kind: 'auth', providers: input.providers as never },
      },
      mounts: [{ target: 'http:/api/projects', use: ['auth'] }],
    },
    pdm: {} as never,
    services: {
      projects: {
        slug: 'projects',
        kind: 'domain',
        artifacts: {
          hasGraphs: false,
          hasBindings: true,
          hasUi: false,
          hasSeed: false,
          hasQsm: true,
          hasStorage: false,
          hasCommandHandlers: false,
        },
        qsm: null,
        graphSpec: { version: '1.0-rc7', shapes: {}, graphs: {} },
        qsmValidated: null,
        bindings: null,
        seed: null,
        storage: null,
        compiledUi: null,
        eventTypes: [],
      },
      tokens: {
        slug: 'tokens',
        kind: 'domain',
        artifacts: {
          hasGraphs: false,
          hasBindings: true,
          hasUi: false,
          hasSeed: false,
          hasQsm: true,
          hasStorage: false,
          hasCommandHandlers: false,
        },
        qsm: null,
        graphSpec: null,
        qsmValidated: null,
        bindings: null,
        seed: null,
        storage: null,
        compiledUi: null,
        eventTypes: [],
      },
      'identity-auth0': {
        slug: 'identity-auth0',
        kind: 'integration-module',
        artifacts: {
          hasGraphs: false,
          hasBindings: false,
          hasUi: false,
          hasSeed: false,
          hasQsm: false,
          hasStorage: false,
          hasCommandHandlers: false,
        },
        qsm: null,
        graphSpec: null,
        qsmValidated: null,
        bindings: null,
        seed: null,
        storage: null,
        compiledUi: null,
        eventTypes: [],
      },
    },
    routing: { httpBaseByService: {}, uiPathsByService: {} },
    bindingRegistry: {},
    varsManifest: {},
  } as ComposedBlueprint;
}
```

Then add:

```ts
it('does not emit a proto module entry for platform-tokens auth providers', () => {
  const fixture = makePlatformAuthFixture({
    providers: [
      {
        provider: 'platform-tokens',
        moduleSlug: 'tokens',
        introspectPath: '/api/tokens/introspect',
        introspectPort: 3000,
      },
      {
        provider: 'auth0',
        audience: 'https://platform.rntme.com/api',
        moduleSlug: 'identity-auth0',
      },
    ],
  });

  const wiring = buildRuntimeModuleWiringForService(
    fixture,
    'projects',
    buildServiceSlugByModuleKey(fixture),
  );

  expect(wiring.modules.map((m) => m.name)).toEqual(['identity-auth0']);
  expect(wiring.files['protos/identity.proto']).toContain('service IdentityModule');
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
bun test packages/platform/deploy-bundle-input/test/runtime-module-wiring.test.ts
```

Expected: FAIL with `DEPLOY_BUNDLE_MODULE_PROTO_UNKNOWN:tokens` or a modules array containing `tokens`.

- [ ] **Step 3: Update auth module collection**

In `packages/platform/deploy-bundle-input/src/runtime-module-wiring.ts`, replace `authMiddlewareModuleSlugsForService` with provider-aware collection:

```ts
function authMiddlewareModuleSlugsForService(
  project: ComposedBlueprint,
  serviceSlug: string,
): string[] {
  const slugs: string[] = [];
  for (const [middlewareName, declaration] of Object.entries(project.project.middleware ?? {})) {
    if (declaration.kind !== 'auth') continue;
    if (!middlewareAppliesToService(project, middlewareName, serviceSlug)) continue;
    for (const provider of declaration.providers) {
      if (provider.provider === 'platform-tokens') continue;
      slugs.push(provider.moduleSlug);
    }
  }
  return slugs;
}
```

- [ ] **Step 4: Add deploy-core conversion proof**

In `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts`, add:

```ts
it('converts platform blueprint without wiring tokens as a module proto', async () => {
  const platformDir = join(repoRoot, 'apps', 'platform', 'blueprint');
  const composed = await loadComposedBlueprint(platformDir);
  expect(composed.ok, composed.ok ? '' : JSON.stringify(composed.errors, null, 2)).toBe(true);
  if (!composed.ok) return;

  const result = await toDeployCoreInput(composed.value, platformDir);
  const projectsManifest = JSON.parse(result.services.projects?.runtimeFiles?.['manifest.json'] ?? '{}');
  const moduleNames = (projectsManifest.modules ?? []).map((m: { name: string }) => m.name);
  expect(moduleNames).toContain('identity-auth0');
  expect(moduleNames).not.toContain('tokens');
});
```

- [ ] **Step 5: Run deploy-bundle tests**

Run:

```bash
bun test packages/platform/deploy-bundle-input/test/runtime-module-wiring.test.ts packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts
bun run --filter @rntme/deploy-bundle-input typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/platform/deploy-bundle-input/src/runtime-module-wiring.ts packages/platform/deploy-bundle-input/test/runtime-module-wiring.test.ts packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts
git commit -m "fix(deploy-bundle): skip domain auth providers in module wiring"
```

---

## Task 9: Wire Platform Token Introspection and Multi-Provider Blueprint

**Files:**
- Modify: `apps/platform/blueprint/project.json`
- Modify: `apps/platform/blueprint/services/tokens/bindings/bindings.json`
- Modify: `apps/platform/blueprint/services/tokens/handlers/introspect-token.ts`
- Modify: `apps/platform/blueprint/services/tokens/handlers/types.ts`
- Modify: `apps/platform/blueprint/test/platform-blueprint.test.ts`
- Modify: `apps/platform/blueprint/test/platform-tokens-handler.test.ts`
- Modify: `demo/notes-blueprint/project.json`

- [ ] **Step 1: Add platform blueprint tests**

In `apps/platform/blueprint/test/platform-blueprint.test.ts`, add:

```ts
it('uses multi-provider edge auth with platform-tokens first', async () => {
  const result = await loadComposedBlueprint(join(here, '..'));
  expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
  if (!result.ok) return;

  expect(result.value.project.middleware?.auth).toEqual({
    kind: 'auth',
    providers: [
      {
        provider: 'platform-tokens',
        moduleSlug: 'tokens',
        introspectPath: '/api/tokens/introspect',
        introspectPort: 3000,
      },
      {
        provider: 'auth0',
        audience: '${AUTH0_AUDIENCE}',
        moduleSlug: 'identity-auth0',
      },
    ],
  });
  expect(result.value.bindingRegistry['tokens.introspectToken']?.path).toBe('/api/tokens/introspect');
});
```

- [ ] **Step 2: Add token handler output assertions**

In `apps/platform/blueprint/test/platform-tokens-handler.test.ts`, extend the valid PAT test:

```ts
expect(out.status).toBe('active');
if (out.status === 'active') {
  expect(out.subject.account.id).toBeDefined();
  expect(out.subject.tokenId).toBe('tid-1');
}
```

- [ ] **Step 3: Run platform blueprint tests and verify failures**

Run:

```bash
bun test apps/platform/blueprint/test/platform-blueprint.test.ts apps/platform/blueprint/test/platform-tokens-handler.test.ts
```

Expected: FAIL until `project.json` and tokens binding are updated.

- [ ] **Step 4: Update platform project auth middleware**

In `apps/platform/blueprint/project.json`, replace the current `middleware.auth` object with:

```json
"auth": {
  "kind": "auth",
  "providers": [
    {
      "provider": "platform-tokens",
      "moduleSlug": "tokens",
      "introspectPath": "/api/tokens/introspect",
      "introspectPort": 3000
    },
    {
      "provider": "auth0",
      "audience": "${AUTH0_AUDIENCE}",
      "moduleSlug": "identity-auth0"
    }
  ]
}
```

Keep protected route mounts on `/api/projects`, `/api/tokens`, `/api/deployments`, and `/api/deployments/targets`.

- [ ] **Step 5: Add `tokens.introspectToken` binding**

The native operation `IntrospectToken` is already declared in `apps/platform/blueprint/services/tokens/operations.json` and the handler exists at `apps/platform/blueprint/services/tokens/handlers/introspect-token.ts` returning:

```ts
type IntrospectTokenHandlerOutput =
  | { readonly status: 'active'; readonly subject: AuthSubject }
  | { readonly status: 'inactive'; readonly reason: string; readonly code: string };
```

where `AuthSubject` (from `@rntme/platform-core`) has `account.id`, `tokenId`, etc. No new handler registration is needed; the runtime auto-wires from `operations.json` via `NativeOperationExecutor`.

In `apps/platform/blueprint/services/tokens/bindings/bindings.json`, add:

```json
"introspectToken": {
  "graph": "IntrospectToken",
  "target": { "engine": "native", "dialect": "platform" },
  "http": {
    "method": "GET",
    "path": "/introspect",
    "parameters": []
  },
  "exposure": "read",
  "inputFrom": {
    "bearerToken": { "from": "header", "name": "authorization", "required": true }
  },
  "response": {
    "onOk": {
      "json": null,
      "headers": {
        "X-Rntme-User-Sub": "$result.subject.account.id",
        "X-Rntme-User-Audience": "urn:rntme:platform-tokens",
        "X-Rntme-Session-Status": "ACTIVE"
      }
    },
    "onErr": {
      "json": { "code": "$error.code", "message": "$error.message" },
      "status": 401
    }
  }
}
```

- [ ] **Step 5b: Route inactive introspection through the operation error path**

The current `introspectTokenHandler` returns a successful `{ status: 'inactive', ... }` value for invalid PATs. With the binding above, `onOk` would fire on inactive and emit `X-Rntme-Session-Status: ACTIVE`, which is wrong. The `onErr` branch only fires when the native executor returns `{ ok: false, error }`.

In `apps/platform/blueprint/services/tokens/handlers/introspect-token.ts`, change the inactive return into an operation error so the executor surfaces it as `$error`:

```ts
if (isOk(r)) {
  return { status: 'active', subject: r.value };
}
const first = r.errors[0] ?? { code: 'PLATFORM_AUTH_INVALID', message: 'invalid token' };
const error = new Error(first.message);
(error as Error & { code?: string }).code = first.code;
throw error;
```

Confirm how `native-operation-executor` surfaces a thrown handler error and that `error-to-http.ts` populates the `$error` render scope with `code` and `message`. If the executor swallows thrown errors instead of mapping them, change the handler signature to return a `Result`-shaped value and update `NativeOperationHandlerMap` accordingly (a separate, broader change — flag it explicitly here rather than implementing silently).

Drop the `IntrospectTokenHandlerOutput` `inactive` arm from `apps/platform/blueprint/services/tokens/handlers/types.ts` so the handler signature matches the new contract:

```ts
export type IntrospectTokenHandlerOutput = {
  readonly status: 'active';
  readonly subject: AuthSubject;
};
```

Update `apps/platform/blueprint/test/platform-tokens-handler.test.ts`: keep the active assertion from Step 2, and add a test that an invalid PAT now causes the handler to throw a `PLATFORM_AUTH_*` error (not return inactive).

- [ ] **Step 6: Update notes demo auth middleware**

In `demo/notes-blueprint/project.json`, convert the auth middleware to:

```json
"auth": {
  "kind": "auth",
  "providers": [
    {
      "provider": "auth0",
      "audience": "${AUTH0_AUDIENCE}",
      "moduleSlug": "identity-auth0"
    }
  ]
}
```

- [ ] **Step 7: Run platform and demo blueprint tests**

Run:

```bash
bun test apps/platform/blueprint/test/platform-blueprint.test.ts apps/platform/blueprint/test/platform-tokens-handler.test.ts packages/artifacts/blueprint/test/smoke-notes-demo.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/platform/blueprint/project.json apps/platform/blueprint/services/tokens/bindings/bindings.json apps/platform/blueprint/services/tokens/handlers/introspect-token.ts apps/platform/blueprint/services/tokens/handlers/types.ts apps/platform/blueprint/test/platform-blueprint.test.ts apps/platform/blueprint/test/platform-tokens-handler.test.ts demo/notes-blueprint/project.json
git commit -m "feat(platform): use multi-provider edge auth"
```

---

## Task 10: Documentation Touch

**Files:**
- Modify: `docs/decision-system.md`
- Modify: `docs/current/owners/packages/artifacts/blueprint.md`
- Modify: `docs/current/owners/packages/artifacts/bindings.md`
- Modify: `docs/current/owners/packages/runtime/bindings-http.md`
- Modify: `docs/current/owners/packages/runtime/runtime.md`
- Modify: `docs/current/owners/packages/platform/deploy-bundle-input.md`
- Modify: `docs/current/owners/packages/deploy/deploy-core.md`
- Modify: `docs/current/owners/packages/deploy/deploy-dokploy.md`
- Modify: `docs/current/owners/apps/platform.md`
- Modify: `docs/current/owners/packages/platform/platform-core.md`
- Modify: `docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml`
- Modify: `docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md`

- [ ] **Step 1: Update decision system**

Add a concise decision entry stating:

```md
### Platform Edge Auth Uses Ordered Providers

Protected platform API routes keep edge authentication. When a route must accept
more than one credential family, the auth middleware declares ordered
`providers[]`; nginx authorizes when the first provider returns 200 and falls
through only on 401. Platform PATs are validated by the `tokens` domain service
over HTTP introspection, and Auth0 JWTs remain validated by `identity-auth0`.
Do not remove edge auth, add a PAT sidecar, or route platform PATs through an
identity-auth0 callback as a shortcut.
```

- [ ] **Step 2: Update owner docs for changed public contracts**

Apply these exact content updates in the relevant owner docs:

- Blueprint owner: document `kind: "auth"` with `providers[]`, provider order, `auth0` requirements, and `platform-tokens` requirements.
- Bindings owner: document `response.onOk/onErr.headers` and JSON `status`.
- Bindings-http owner: document rendered response headers and native binding compile behavior.
- Runtime owner: document `surface.http.bindingBasePath`, default `/api`, generated deploy artifacts using `/`.
- Deploy-bundle-input owner: document project route prefix materialization and non-module auth provider exclusions.
- Deploy-core owner: document planned auth providers.
- Deploy-dokploy owner: document nginx auth chains, 401 fallthrough, and forwarded `X-Rntme-*` headers.
- Platform docs: document `tokens` edge introspection and stable `urn:rntme:platform-tokens` audience.

- [ ] **Step 3: Update goal state and T012 notes**

In `docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml` and `docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md`, record:

```md
Decision: quick auth bypasses are rejected. The blocker is resolved through
first-class ordered edge auth providers: `platform-tokens` first for CLI PATs,
`identity-auth0` second for browser JWTs. Live T012 resumes only after local
tests prove provider chains, token introspection headers, native binding
startup, project-routed runtime paths, and deploy-bundle module wiring.
```

- [ ] **Step 4: Run docs diff check**

Run:

```bash
git diff --check -- docs/decision-system.md docs/current/owners/packages/artifacts/blueprint.md docs/current/owners/packages/artifacts/bindings.md docs/current/owners/packages/runtime/bindings-http.md docs/current/owners/packages/runtime/runtime.md docs/current/owners/packages/platform/deploy-bundle-input.md docs/current/owners/packages/deploy/deploy-core.md docs/current/owners/packages/deploy/deploy-dokploy.md docs/current/owners/apps/platform.md docs/current/owners/packages/platform/platform-core.md docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md
```

Expected: no whitespace errors.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/decision-system.md docs/current/owners/packages/artifacts/blueprint.md docs/current/owners/packages/artifacts/bindings.md docs/current/owners/packages/runtime/bindings-http.md docs/current/owners/packages/runtime/runtime.md docs/current/owners/packages/platform/deploy-bundle-input.md docs/current/owners/packages/deploy/deploy-core.md docs/current/owners/packages/deploy/deploy-dokploy.md docs/current/owners/apps/platform.md docs/current/owners/packages/platform/platform-core.md docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md
git commit -m "docs: document platform multi-provider edge auth"
```

---

## Task 11: Full Local Verification

**Files:**
- No planned edits.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
bun test packages/artifacts/blueprint/test/unit/parse.test.ts packages/artifacts/blueprint/test/unit/validate-composition.test.ts packages/deploy/deploy-core/test/unit/edge.test.ts packages/deploy/deploy-dokploy/test/unit/nginx.test.ts packages/artifacts/bindings/test/unit/parse/schema.test.ts packages/artifacts/bindings/test/unit/validate/structural.test.ts packages/runtime/bindings-http/test/unit/render-response.test.ts packages/runtime/bindings-http/test/unit/compile-plan-operation.test.ts packages/runtime/runtime/test/unit/native-operation-executor.test.ts packages/platform/deploy-bundle-input/test/runtime-module-wiring.test.ts packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts apps/platform/blueprint/test/platform-blueprint.test.ts apps/platform/blueprint/test/platform-tokens-handler.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run package typechecks**

Run:

```bash
bun run --filter @rntme/blueprint typecheck
bun run --filter @rntme/deploy-core typecheck
bun run --filter @rntme/deploy-dokploy typecheck
bun run --filter @rntme/bindings typecheck
bun run --filter @rntme/bindings-http typecheck
bun run --filter @rntme/runtime typecheck
bun run --filter @rntme/deploy-bundle-input typecheck
```

Expected: all pass.

- [ ] **Step 3: Prove platform deploy conversion**

Run:

```bash
bun --eval "import { loadComposedBlueprint } from '@rntme/blueprint'; import { toDeployCoreInput } from '@rntme/deploy-bundle-input'; const r = await loadComposedBlueprint('apps/platform/blueprint'); if (!r.ok) { console.log(JSON.stringify(r.errors, null, 2)); process.exit(1); } const input = await toDeployCoreInput(r.value, 'apps/platform/blueprint'); const projects = JSON.parse(input.services.projects.runtimeFiles['bindings.json']); const tokens = JSON.parse(input.services.tokens.runtimeFiles['bindings.json']); const manifest = JSON.parse(input.services.projects.runtimeFiles['manifest.json']); console.log(JSON.stringify({ projectPath: projects.bindings.publishProjectBundle.http.path, tokensPath: tokens.bindings.introspectToken.http.path, bindingBasePath: manifest.surface.http.bindingBasePath, projectModules: JSON.parse(input.services.projects.runtimeFiles['manifest.json']).modules.map(m => m.name) }, null, 2));"
```

Expected output includes:

```json
{
  "projectPath": "/api/projects/{projectId}/versions",
  "tokensPath": "/api/tokens/introspect",
  "bindingBasePath": "/",
  "projectModules": ["identity-auth0"]
}
```

- [ ] **Step 4: Run full CI-equivalent local checks**

Run:

```bash
bun run build
bun run typecheck
bun run test
bun run lint
bun run depcruise
bun run vendor:check
```

Expected: all pass.

- [ ] **Step 5: Commit verification receipt if goal docs changed**

If Task 11 produces new receipt text in `docs/goals/cv-extract-platform-client-deploy-e2e/**`, commit only that receipt:

```bash
git add docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md
git commit -m "docs: record platform auth verification"
```

If no files changed, skip this commit.

---

## Task 12: Redeploy Platform and Resume T012

**Files:**
- Modify: `docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml`
- Modify: `docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md`

- [ ] **Step 1: Confirm push safety**

Run:

```bash
git log --oneline origin/main..HEAD
git status --short
```

Expected:

- All commits from `dbdec34c` through this plan now form one coherent provider-list solution.
- No unrelated dirty files are staged.

- [ ] **Step 2: Push after local verification only**

Run:

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 3: Redeploy platform**

Use the existing goal redeploy command recorded in `docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md`. Record the command, timestamp, deployment id, and rendered public URL in the T012 notes.

- [ ] **Step 4: Prove PAT reaches protected platform API**

Run the existing CLI PAT check from the T012 notes against:

```text
https://platform.rntme.com/api/projects
```

Expected:

- Edge no longer returns the canonical auth 401 for a valid `rntme_pat_*`.
- Handler-level auth succeeds or returns a structured platform authorization error tied to org/project scope.
- Invalid PAT still returns canonical edge 401.

- [ ] **Step 5: Resume publish, target, deploy, smoke, and dashboard proof**

Continue T012 phases 2-7 from `docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml`.

Record:

- live cv-extract URL;
- smoke flow result;
- dashboard proof for `vladprsib/org_uZUWhpWgK54VWC2X`;
- exact dates and command receipts.

- [ ] **Step 6: Commit live receipts**

Run:

```bash
git add docs/goals/cv-extract-platform-client-deploy-e2e/state.yaml docs/goals/cv-extract-platform-client-deploy-e2e/notes/T012-live-deploy.md
git commit -m "docs: record live platform auth smoke proof"
git push origin main
```

Expected: `origin/main` contains the implementation and live proof.
