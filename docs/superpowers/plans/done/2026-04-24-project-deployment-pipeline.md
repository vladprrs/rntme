# Project Deployment Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build target-neutral project deployment planning and a first Dokploy adapter for preview deployments.

**Architecture:** Add `@rntme-cli/deploy-core` for pure planning from an already validated/composed project model, then add `@rntme-cli/deploy-dokploy` for Dokploy render/apply. Frontends remain responsible for loading raw blueprints, collecting secrets, persisting audit artifacts, and running browser verification.

**Tech Stack:** TypeScript 5, Node 20, pnpm workspace packages in `rntme-cli/packages/*`, Vitest, Zod 4, Result-style error returns, fake Dokploy client tests.

---

## Scope guard

- This plan does not touch `@rntme/runtime` or implement Kafka/Redpanda runtime support. Production mode remains rejected.
- This plan does not add CLI commands or platform UI. It builds reusable packages only.
- This plan does not call Dokploy MCP. The adapter API is an injected HTTP-client interface.
- `deploy-core` accepts a composed project object. It does not read raw project folders or call blueprint loaders.

## File structure

Create these new packages:

```text
rntme-cli/packages/deploy-core/
  package.json
  README.md
  eslint.config.mjs
  tsconfig.json
  tsconfig.check.json
  vitest.config.ts
  src/
    index.ts
    composed-project.ts
    config.ts
    errors.ts
    result.ts
    plan.ts
    edge.ts
  test/unit/
    plan.test.ts
    edge.test.ts

rntme-cli/packages/deploy-dokploy/
  package.json
  README.md
  eslint.config.mjs
  tsconfig.json
  tsconfig.check.json
  vitest.config.ts
  src/
    index.ts
    client.ts
    config.ts
    errors.ts
    result.ts
    names.ts
    render.ts
    nginx.ts
    apply.ts
  test/unit/
    names.test.ts
    render.test.ts
    nginx.test.ts
    apply.test.ts
```

Package responsibilities:

- `deploy-core/src/composed-project.ts`: structural input seam for the already validated/composed project model. It intentionally contains only the deploy-relevant subset.
- `deploy-core/src/config.ts`: target-neutral deployment config types.
- `deploy-core/src/plan.ts`: validates deployment-specific constraints and builds `ProjectDeploymentPlan`.
- `deploy-core/src/edge.ts`: route and middleware planning helpers.
- `deploy-dokploy/src/config.ts`: typed Dokploy config plus module image config.
- `deploy-dokploy/src/render.ts`: converts the neutral plan into redacted Dokploy resources.
- `deploy-dokploy/src/nginx.ts`: renders Nginx config from the edge plan.
- `deploy-dokploy/src/apply.ts`: upserts rendered resources through an injected Dokploy client and returns structured apply results.
- `deploy-dokploy/src/client.ts`: narrow Dokploy client interface used by tests and future HTTP implementation.

---

### Task 1: Scaffold `@rntme-cli/deploy-core`

**Files:**
- Create: `rntme-cli/packages/deploy-core/package.json`
- Create: `rntme-cli/packages/deploy-core/tsconfig.json`
- Create: `rntme-cli/packages/deploy-core/tsconfig.check.json`
- Create: `rntme-cli/packages/deploy-core/vitest.config.ts`
- Create: `rntme-cli/packages/deploy-core/eslint.config.mjs`
- Create: `rntme-cli/packages/deploy-core/README.md`
- Create: `rntme-cli/packages/deploy-core/src/result.ts`
- Create: `rntme-cli/packages/deploy-core/src/errors.ts`
- Create: `rntme-cli/packages/deploy-core/src/index.ts`
- Test: `rntme-cli/packages/deploy-core/test/unit/package-smoke.test.ts`

- [ ] **Step 1: Write the package smoke test**

Create `rntme-cli/packages/deploy-core/test/unit/package-smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEPLOY_CORE_ERROR_CODES, err, isErr, isOk, ok } from '../../src/index.js';

describe('@rntme-cli/deploy-core package surface', () => {
  it('exports Result helpers and error codes', () => {
    const success = ok({ value: 1 });
    const failure = err([
      {
        code: 'DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE',
        message: 'production mode is not supported in the MVP',
      },
    ]);

    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    expect(DEPLOY_CORE_ERROR_CODES.DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE).toBe(
      'DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE',
    );
  });
});
```

- [ ] **Step 2: Add package metadata**

Create `rntme-cli/packages/deploy-core/package.json`:

```json
{
  "name": "@rntme-cli/deploy-core",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Target-neutral project deployment planning for rntme.",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint --no-error-on-unmatched-pattern \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Add TypeScript, Vitest, and ESLint config**

Create `rntme-cli/packages/deploy-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": false },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

Create `rntme-cli/packages/deploy-core/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Create `rntme-cli/packages/deploy-core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
    passWithNoTests: true,
  },
});
```

Create `rntme-cli/packages/deploy-core/eslint.config.mjs`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.check.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

- [ ] **Step 4: Add Result helpers and error registry**

Create `rntme-cli/packages/deploy-core/src/result.ts`:

```ts
import type { DeploymentPlanError } from './errors.js';

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly errors: readonly E[] };
export type Result<T, E = DeploymentPlanError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(errors: readonly E[]): Err<E> => ({ ok: false, errors });
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok === true;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r.ok === false;
```

Create `rntme-cli/packages/deploy-core/src/errors.ts`:

```ts
export const DEPLOY_CORE_ERROR_CODES = {
  DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE: 'DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE',
  DEPLOY_PLAN_INVALID_ENVIRONMENT: 'DEPLOY_PLAN_INVALID_ENVIRONMENT',
  DEPLOY_PLAN_MISSING_ORG_SLUG: 'DEPLOY_PLAN_MISSING_ORG_SLUG',
  DEPLOY_PLAN_MISSING_EVENT_BUS: 'DEPLOY_PLAN_MISSING_EVENT_BUS',
  DEPLOY_PLAN_MISSING_MODULE_IMAGE: 'DEPLOY_PLAN_MISSING_MODULE_IMAGE',
  DEPLOY_PLAN_PUBLIC_MODULE_NOT_EXPOSED: 'DEPLOY_PLAN_PUBLIC_MODULE_NOT_EXPOSED',
  DEPLOY_PLAN_UNSUPPORTED_MIDDLEWARE: 'DEPLOY_PLAN_UNSUPPORTED_MIDDLEWARE',
  DEPLOY_PLAN_MISSING_POLICY_VALUE: 'DEPLOY_PLAN_MISSING_POLICY_VALUE',
  DEPLOY_PLAN_ROUTE_TARGET_MISSING_WORKLOAD: 'DEPLOY_PLAN_ROUTE_TARGET_MISSING_WORKLOAD',
} as const;

export type DeploymentPlanErrorCode = keyof typeof DEPLOY_CORE_ERROR_CODES;

export type DeploymentPlanError = {
  readonly code: DeploymentPlanErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly service?: string;
  readonly route?: string;
  readonly middleware?: string;
  readonly policy?: string;
};
```

- [ ] **Step 5: Add public exports and README**

Create `rntme-cli/packages/deploy-core/src/index.ts`:

```ts
export {
  DEPLOY_CORE_ERROR_CODES,
  type DeploymentPlanError,
  type DeploymentPlanErrorCode,
} from './errors.js';
export { err, isErr, isOk, ok, type Err, type Ok, type Result } from './result.js';
```

Create `rntme-cli/packages/deploy-core/README.md`:

```md
# @rntme-cli/deploy-core

Target-neutral project deployment planning for rntme.

This package accepts an already validated/composed project model and produces a
`ProjectDeploymentPlan`. It does not read raw blueprint folders, collect
secrets, call Dokploy, or run browser verification.
```

- [ ] **Step 6: Run the smoke test**

Run:

```bash
pnpm -F @rntme-cli/deploy-core test
```

Expected:

```text
PASS  test/unit/package-smoke.test.ts
```

- [ ] **Step 7: Build and typecheck the package**

Run:

```bash
pnpm -F @rntme-cli/deploy-core build
pnpm -F @rntme-cli/deploy-core typecheck
pnpm -F @rntme-cli/deploy-core lint
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add rntme-cli/packages/deploy-core
git commit -m "feat: scaffold deploy-core package"
```

---

### Task 2: Define deploy-core input, config, and plan types

**Files:**
- Create: `rntme-cli/packages/deploy-core/src/composed-project.ts`
- Create: `rntme-cli/packages/deploy-core/src/config.ts`
- Create: `rntme-cli/packages/deploy-core/src/plan.ts`
- Modify: `rntme-cli/packages/deploy-core/src/index.ts`
- Test: `rntme-cli/packages/deploy-core/test/unit/plan.test.ts`

- [ ] **Step 1: Write tests for preview plan construction and production rejection**

Create `rntme-cli/packages/deploy-core/test/unit/plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProjectDeploymentPlan } from '../../src/plan.js';
import type { ComposedProjectInput } from '../../src/composed-project.js';
import type { ProjectDeploymentConfig } from '../../src/config.js';

const project: ComposedProjectInput = {
  name: 'commerce',
  services: {
    catalog: { slug: 'catalog', kind: 'domain' },
    app: { slug: 'app', kind: 'domain' },
    'mod-workos': { slug: 'mod-workos', kind: 'integration' },
  },
  routes: {
    ui: { '/': 'app' },
    http: { '/api/catalog': 'catalog' },
  },
  middleware: {},
  mounts: [],
};

const previewConfig: ProjectDeploymentConfig = {
  orgSlug: 'acme',
  environment: 'default',
  mode: 'preview',
  eventBus: {
    kind: 'kafka',
    mode: 'external',
    brokers: ['redpanda.internal:9092'],
  },
  modules: {
    'mod-workos': {
      image: 'ghcr.io/acme/mod-workos:2026-04-24',
      expose: false,
    },
  },
  policies: {},
};

describe('buildProjectDeploymentPlan', () => {
  it('builds preview workloads for domain services, integration modules, and edge', () => {
    const r = buildProjectDeploymentPlan(project, previewConfig);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.project).toEqual({
      orgSlug: 'acme',
      projectSlug: 'commerce',
      environment: 'default',
      mode: 'preview',
    });
    expect(r.value.infrastructure.eventBus.brokers).toEqual(['redpanda.internal:9092']);
    expect(r.value.workloads.map((w) => w.slug)).toEqual([
      'catalog',
      'app',
      'mod-workos',
      'edge',
    ]);
    expect(r.value.workloads.find((w) => w.kind === 'domain-service' && w.slug === 'catalog')).toMatchObject({
      runtime: { image: 'rntme-runtime' },
      persistence: { mode: 'ephemeral' },
    });
    expect(r.value.workloads.find((w) => w.kind === 'integration-module')).toMatchObject({
      slug: 'mod-workos',
      image: 'ghcr.io/acme/mod-workos:2026-04-24',
      expose: false,
    });
  });

  it('rejects production mode in the MVP', () => {
    const r = buildProjectDeploymentPlan(project, {
      ...previewConfig,
      mode: 'production',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE',
        }),
      );
    }
  });
});
```

- [ ] **Step 2: Add composed project input types**

Create `rntme-cli/packages/deploy-core/src/composed-project.ts`:

```ts
export type ServiceKind = 'domain' | 'integration';

export type ComposedProjectService = {
  readonly slug: string;
  readonly kind: ServiceKind;
};

export type ProjectRouteMap = {
  readonly ui?: Readonly<Record<string, string>>;
  readonly http?: Readonly<Record<string, string>>;
};

export type ProjectMiddlewareDecl = {
  readonly kind: string;
  readonly provider?: string;
  readonly policy?: string;
};

export type ProjectMountDecl = {
  readonly target: string;
  readonly use: readonly string[];
};

export type ComposedProjectInput = {
  readonly name: string;
  readonly services: Readonly<Record<string, ComposedProjectService>>;
  readonly routes?: ProjectRouteMap;
  readonly middleware?: Readonly<Record<string, ProjectMiddlewareDecl>>;
  readonly mounts?: readonly ProjectMountDecl[];
};
```

- [ ] **Step 3: Add deployment config types**

Create `rntme-cli/packages/deploy-core/src/config.ts`:

```ts
export type DeploymentMode = 'preview' | 'production';

export type DeploymentEnvironment = 'default';

export type ExternalEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode: 'external';
  readonly brokers: readonly string[];
  readonly topicPrefix?: string;
  readonly security?: {
    readonly protocol: 'plaintext' | 'sasl_ssl';
    readonly secretRefs?: Readonly<Record<string, string>>;
  };
};

export type IntegrationModuleDeploymentConfig = {
  readonly image: string;
  readonly expose?: boolean;
  readonly env?: Readonly<Record<string, string>>;
  readonly secretRefs?: Readonly<Record<string, string>>;
};

export type RateLimitPolicyConfig = {
  readonly requestsPerMinute: number;
  readonly burst: number;
};

export type BodyLimitPolicyConfig = {
  readonly maxBodySize: string;
};

export type TimeoutPolicyConfig = {
  readonly upstreamTimeoutMs: number;
};

export type RequestContextPolicyConfig = {
  readonly requestIdHeader?: string;
  readonly correlationIdHeader?: string;
};

export type DeploymentPolicyConfig = {
  readonly rateLimit?: Readonly<Record<string, RateLimitPolicyConfig>>;
  readonly bodyLimit?: Readonly<Record<string, BodyLimitPolicyConfig>>;
  readonly timeout?: Readonly<Record<string, TimeoutPolicyConfig>>;
  readonly requestContext?: Readonly<Record<string, RequestContextPolicyConfig>>;
};

export type ProjectDeploymentConfig = {
  readonly orgSlug: string;
  readonly environment: DeploymentEnvironment;
  readonly mode: DeploymentMode;
  readonly eventBus?: ExternalEventBusConfig;
  readonly modules?: Readonly<Record<string, IntegrationModuleDeploymentConfig>>;
  readonly policies?: DeploymentPolicyConfig;
  readonly runtimeImage?: string;
};
```

- [ ] **Step 4: Add plan types and base builder**

Create `rntme-cli/packages/deploy-core/src/plan.ts`:

```ts
import type { ComposedProjectInput } from './composed-project.js';
import type {
  ExternalEventBusConfig,
  ProjectDeploymentConfig,
  DeploymentMode,
} from './config.js';
import type { DeploymentPlanError } from './errors.js';
import { err, ok, type Result } from './result.js';

export type PlannedProject = {
  readonly orgSlug: string;
  readonly projectSlug: string;
  readonly environment: 'default';
  readonly mode: DeploymentMode;
};

export type DomainServiceWorkload = {
  readonly kind: 'domain-service';
  readonly slug: string;
  readonly serviceSlug: string;
  readonly resourceName: string;
  readonly runtime: { readonly image: string };
  readonly artifact: { readonly source: 'composed-project'; readonly serviceSlug: string };
  readonly persistence: { readonly mode: 'ephemeral' };
};

export type IntegrationModuleWorkload = {
  readonly kind: 'integration-module';
  readonly slug: string;
  readonly serviceSlug: string;
  readonly resourceName: string;
  readonly image: string;
  readonly expose: boolean;
  readonly env: Readonly<Record<string, string>>;
  readonly secretRefs: Readonly<Record<string, string>>;
};

export type EdgeGatewayWorkload = {
  readonly kind: 'edge-gateway';
  readonly slug: 'edge';
  readonly resourceName: string;
  readonly image: 'nginx:1.27-alpine';
};

export type DeploymentWorkload =
  | DomainServiceWorkload
  | IntegrationModuleWorkload
  | EdgeGatewayWorkload;

export type EdgePlan = {
  readonly routes: readonly [];
  readonly middleware: readonly [];
};

export type DeploymentWarning = {
  readonly code: string;
  readonly message: string;
};

export type ProjectDeploymentPlan = {
  readonly project: PlannedProject;
  readonly infrastructure: {
    readonly eventBus: ExternalEventBusConfig;
  };
  readonly workloads: readonly DeploymentWorkload[];
  readonly edge: EdgePlan;
  readonly diagnostics: {
    readonly warnings: readonly DeploymentWarning[];
  };
};

export function buildProjectDeploymentPlan(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
): Result<ProjectDeploymentPlan, DeploymentPlanError> {
  const errors: DeploymentPlanError[] = [];

  if (config.mode === 'production') {
    errors.push({
      code: 'DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE',
      message: 'production mode is modeled but rejected until runtime production prerequisites land',
      path: 'mode',
    });
  }

  if (config.environment !== 'default') {
    errors.push({
      code: 'DEPLOY_PLAN_INVALID_ENVIRONMENT',
      message: 'the MVP accepts only environment "default"',
      path: 'environment',
    });
  }

  if (config.orgSlug.trim() === '') {
    errors.push({
      code: 'DEPLOY_PLAN_MISSING_ORG_SLUG',
      message: 'orgSlug is required for deterministic target resource names',
      path: 'orgSlug',
    });
  }

  if (config.eventBus === undefined || config.eventBus.brokers.length === 0) {
    errors.push({
      code: 'DEPLOY_PLAN_MISSING_EVENT_BUS',
      message: 'preview deployments require one project-level external Kafka/Redpanda endpoint',
      path: 'eventBus',
    });
  }

  const workloads: DeploymentWorkload[] = [];
  const runtimeImage = config.runtimeImage ?? 'rntme-runtime';

  for (const service of Object.values(project.services)) {
    if (service.kind === 'domain') {
      workloads.push({
        kind: 'domain-service',
        slug: service.slug,
        serviceSlug: service.slug,
        resourceName: resourceName(config.orgSlug, project.name, service.slug),
        runtime: { image: runtimeImage },
        artifact: { source: 'composed-project', serviceSlug: service.slug },
        persistence: { mode: 'ephemeral' },
      });
      continue;
    }

    const moduleConfig = config.modules?.[service.slug];
    if (moduleConfig === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_MISSING_MODULE_IMAGE',
        message: `integration module "${service.slug}" requires explicit image config`,
        service: service.slug,
        path: `modules.${service.slug}`,
      });
      continue;
    }

    workloads.push({
      kind: 'integration-module',
      slug: service.slug,
      serviceSlug: service.slug,
      resourceName: resourceName(config.orgSlug, project.name, service.slug),
      image: moduleConfig.image,
      expose: moduleConfig.expose === true,
      env: moduleConfig.env ?? {},
      secretRefs: moduleConfig.secretRefs ?? {},
    });
  }

  workloads.push({
    kind: 'edge-gateway',
    slug: 'edge',
    resourceName: resourceName(config.orgSlug, project.name, 'edge'),
    image: 'nginx:1.27-alpine',
  });

  if (errors.length > 0 || config.eventBus === undefined) return err(errors);

  return ok({
    project: {
      orgSlug: config.orgSlug,
      projectSlug: project.name,
      environment: config.environment,
      mode: config.mode,
    },
    infrastructure: {
      eventBus: config.eventBus,
    },
    workloads,
    edge: { routes: [], middleware: [] },
    diagnostics: { warnings: [] },
  });
}

function resourceName(orgSlug: string, projectSlug: string, workloadSlug: string): string {
  return `rntme-${orgSlug}-${projectSlug}-${workloadSlug}`;
}
```

- [ ] **Step 5: Export new types and builder**

Modify `rntme-cli/packages/deploy-core/src/index.ts`:

```ts
export {
  type ComposedProjectInput,
  type ComposedProjectService,
  type ProjectMiddlewareDecl,
  type ProjectMountDecl,
  type ProjectRouteMap,
  type ServiceKind,
} from './composed-project.js';
export {
  type BodyLimitPolicyConfig,
  type DeploymentEnvironment,
  type DeploymentMode,
  type DeploymentPolicyConfig,
  type ExternalEventBusConfig,
  type IntegrationModuleDeploymentConfig,
  type ProjectDeploymentConfig,
  type RateLimitPolicyConfig,
  type RequestContextPolicyConfig,
  type TimeoutPolicyConfig,
} from './config.js';
export {
  buildProjectDeploymentPlan,
  type DeploymentWarning,
  type DeploymentWorkload,
  type DomainServiceWorkload,
  type EdgeGatewayWorkload,
  type EdgePlan,
  type IntegrationModuleWorkload,
  type PlannedProject,
  type ProjectDeploymentPlan,
} from './plan.js';
export {
  DEPLOY_CORE_ERROR_CODES,
  type DeploymentPlanError,
  type DeploymentPlanErrorCode,
} from './errors.js';
export { err, isErr, isOk, ok, type Err, type Ok, type Result } from './result.js';
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm -F @rntme-cli/deploy-core test
```

Expected: `plan.test.ts` and `package-smoke.test.ts` pass.

- [ ] **Step 7: Run build, typecheck, and lint**

Run:

```bash
pnpm -F @rntme-cli/deploy-core build
pnpm -F @rntme-cli/deploy-core typecheck
pnpm -F @rntme-cli/deploy-core lint
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add rntme-cli/packages/deploy-core
git commit -m "feat: add deploy-core plan model"
```

---

### Task 3: Implement edge routes and middleware validation

**Files:**
- Create: `rntme-cli/packages/deploy-core/src/edge.ts`
- Modify: `rntme-cli/packages/deploy-core/src/plan.ts`
- Modify: `rntme-cli/packages/deploy-core/src/index.ts`
- Test: `rntme-cli/packages/deploy-core/test/unit/edge.test.ts`
- Test: `rntme-cli/packages/deploy-core/test/unit/plan.test.ts`

- [ ] **Step 1: Write route and middleware tests**

Create `rntme-cli/packages/deploy-core/test/unit/edge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProjectDeploymentPlan } from '../../src/plan.js';
import type { ComposedProjectInput } from '../../src/composed-project.js';
import type { ProjectDeploymentConfig } from '../../src/config.js';

const baseProject: ComposedProjectInput = {
  name: 'commerce',
  services: {
    app: { slug: 'app', kind: 'domain' },
    catalog: { slug: 'catalog', kind: 'domain' },
    'mod-workos': { slug: 'mod-workos', kind: 'integration' },
  },
  routes: {
    ui: { '/': 'app' },
    http: {
      '/api/catalog': 'catalog',
      '/oauth': 'mod-workos',
    },
  },
  middleware: {
    requestContext: { kind: 'request-context', policy: 'default' },
    rateLimit: { kind: 'rate-limit', policy: 'default' },
    auth: { kind: 'auth', provider: 'mod-workos' },
  },
  mounts: [
    { target: 'ui:/', use: ['requestContext'] },
    { target: 'http:/api/catalog', use: ['rateLimit'] },
  ],
};

const config: ProjectDeploymentConfig = {
  orgSlug: 'acme',
  environment: 'default',
  mode: 'preview',
  eventBus: {
    kind: 'kafka',
    mode: 'external',
    brokers: ['redpanda.internal:9092'],
  },
  modules: {
    'mod-workos': {
      image: 'ghcr.io/acme/mod-workos:2026-04-24',
      expose: true,
    },
  },
  policies: {
    requestContext: {
      default: {
        requestIdHeader: 'x-request-id',
        correlationIdHeader: 'x-correlation-id',
      },
    },
    rateLimit: {
      default: { requestsPerMinute: 60, burst: 20 },
    },
  },
};

describe('edge planning', () => {
  it('plans UI and HTTP routes plus supported middleware', () => {
    const project = { ...baseProject, middleware: { ...baseProject.middleware, auth: undefined } };
    const middleware = {
      requestContext: baseProject.middleware?.requestContext,
      rateLimit: baseProject.middleware?.rateLimit,
    };

    const r = buildProjectDeploymentPlan({ ...project, middleware }, config);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.edge.routes).toEqual([
      { id: 'ui:/', kind: 'ui', path: '/', targetService: 'app', targetWorkload: 'app' },
      {
        id: 'http:/api/catalog',
        kind: 'http',
        path: '/api/catalog',
        targetService: 'catalog',
        targetWorkload: 'catalog',
      },
      {
        id: 'http:/oauth',
        kind: 'http',
        path: '/oauth',
        targetService: 'mod-workos',
        targetWorkload: 'mod-workos',
      },
    ]);
    expect(r.value.edge.middleware).toEqual([
      {
        mountTarget: 'ui:/',
        name: 'requestContext',
        kind: 'request-context',
        policy: 'default',
        config: { requestIdHeader: 'x-request-id', correlationIdHeader: 'x-correlation-id' },
      },
      {
        mountTarget: 'http:/api/catalog',
        name: 'rateLimit',
        kind: 'rate-limit',
        policy: 'default',
        config: { requestsPerMinute: 60, burst: 20 },
      },
    ]);
  });

  it('rejects unsupported auth middleware', () => {
    const r = buildProjectDeploymentPlan(baseProject, config);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_UNSUPPORTED_MIDDLEWARE',
          middleware: 'auth',
        }),
      );
    }
  });

  it('rejects a public integration route when the module is not explicitly exposed', () => {
    const r = buildProjectDeploymentPlan(baseProject, {
      ...config,
      modules: {
        'mod-workos': {
          image: 'ghcr.io/acme/mod-workos:2026-04-24',
          expose: false,
        },
      },
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_PUBLIC_MODULE_NOT_EXPOSED',
          service: 'mod-workos',
          route: '/oauth',
        }),
      );
    }
  });

  it('rejects missing policy values', () => {
    const project = {
      ...baseProject,
      middleware: {
        rateLimit: { kind: 'rate-limit', policy: 'missing' },
      },
      mounts: [{ target: 'http:/api/catalog', use: ['rateLimit'] }],
    };

    const r = buildProjectDeploymentPlan(project, config);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_PLAN_MISSING_POLICY_VALUE',
          policy: 'missing',
          middleware: 'rateLimit',
        }),
      );
    }
  });
});
```

- [ ] **Step 2: Add edge planning types and helpers**

Create `rntme-cli/packages/deploy-core/src/edge.ts`:

```ts
import type { ComposedProjectInput, ProjectMiddlewareDecl } from './composed-project.js';
import type {
  DeploymentPolicyConfig,
  ProjectDeploymentConfig,
} from './config.js';
import type { DeploymentPlanError } from './errors.js';
import type { DeploymentWorkload } from './plan.js';

export type EdgeRoute = {
  readonly id: string;
  readonly kind: 'ui' | 'http';
  readonly path: string;
  readonly targetService: string;
  readonly targetWorkload: string;
};

export type EdgeMiddleware =
  | {
      readonly mountTarget: string;
      readonly name: string;
      readonly kind: 'request-context';
      readonly policy: string;
      readonly config: NonNullable<DeploymentPolicyConfig['requestContext']>[string];
    }
  | {
      readonly mountTarget: string;
      readonly name: string;
      readonly kind: 'rate-limit';
      readonly policy: string;
      readonly config: NonNullable<DeploymentPolicyConfig['rateLimit']>[string];
    }
  | {
      readonly mountTarget: string;
      readonly name: string;
      readonly kind: 'body-limit';
      readonly policy: string;
      readonly config: NonNullable<DeploymentPolicyConfig['bodyLimit']>[string];
    }
  | {
      readonly mountTarget: string;
      readonly name: string;
      readonly kind: 'timeout';
      readonly policy: string;
      readonly config: NonNullable<DeploymentPolicyConfig['timeout']>[string];
    };

export type PlannedEdge = {
  readonly routes: readonly EdgeRoute[];
  readonly middleware: readonly EdgeMiddleware[];
};

const supportedMiddlewareKinds = new Set([
  'request-context',
  'rate-limit',
  'body-limit',
  'timeout',
]);

export function planEdge(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  workloads: readonly DeploymentWorkload[],
): { edge: PlannedEdge; errors: DeploymentPlanError[] } {
  const errors: DeploymentPlanError[] = [];
  const routes: EdgeRoute[] = [];
  const workloadByService = new Map(workloads.map((w) => [w.serviceSlug ?? w.slug, w]));

  for (const [path, service] of Object.entries(project.routes?.ui ?? {})) {
    addRoute('ui', path, service);
  }

  for (const [path, service] of Object.entries(project.routes?.http ?? {})) {
    addRoute('http', path, service);
  }

  const middleware = planMiddleware(project, config, errors);

  return { edge: { routes, middleware }, errors };

  function addRoute(kind: 'ui' | 'http', path: string, service: string): void {
    const workload = workloadByService.get(service);
    if (workload === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_ROUTE_TARGET_MISSING_WORKLOAD',
        message: `route ${kind}:${path} targets service "${service}" but no workload exists`,
        service,
        route: path,
      });
      return;
    }

    if (workload.kind === 'integration-module' && workload.expose !== true) {
      errors.push({
        code: 'DEPLOY_PLAN_PUBLIC_MODULE_NOT_EXPOSED',
        message: `integration module "${service}" must set expose: true before receiving public routes`,
        service,
        route: path,
      });
    }

    routes.push({
      id: `${kind}:${path}`,
      kind,
      path,
      targetService: service,
      targetWorkload: workload.slug,
    });
  }
}

function planMiddleware(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  errors: DeploymentPlanError[],
): EdgeMiddleware[] {
  const planned: EdgeMiddleware[] = [];
  const declarations = project.middleware ?? {};

  for (const [name, decl] of Object.entries(declarations)) {
    if (!supportedMiddlewareKinds.has(decl.kind)) {
      errors.push({
        code: 'DEPLOY_PLAN_UNSUPPORTED_MIDDLEWARE',
        message: `middleware "${name}" uses unsupported kind "${decl.kind}"`,
        middleware: name,
      });
    }
  }

  for (const mount of project.mounts ?? []) {
    for (const middlewareName of mount.use) {
      const decl = declarations[middlewareName];
      if (decl === undefined || !supportedMiddlewareKinds.has(decl.kind)) continue;
      const policy = decl.policy ?? 'default';
      const resolved = resolvePolicy(middlewareName, decl, policy, config.policies, errors);
      if (resolved !== null) {
        planned.push({
          mountTarget: mount.target,
          name: middlewareName,
          kind: decl.kind,
          policy,
          config: resolved,
        } as EdgeMiddleware);
      }
    }
  }

  return planned;
}

function resolvePolicy(
  middlewareName: string,
  decl: ProjectMiddlewareDecl,
  policy: string,
  policies: DeploymentPolicyConfig | undefined,
  errors: DeploymentPlanError[],
): EdgeMiddleware['config'] | null {
  const table =
    decl.kind === 'request-context'
      ? policies?.requestContext
      : decl.kind === 'rate-limit'
        ? policies?.rateLimit
        : decl.kind === 'body-limit'
          ? policies?.bodyLimit
          : decl.kind === 'timeout'
            ? policies?.timeout
            : undefined;
  const value = table?.[policy];
  if (value === undefined) {
    errors.push({
      code: 'DEPLOY_PLAN_MISSING_POLICY_VALUE',
      message: `middleware "${middlewareName}" references missing policy "${policy}"`,
      middleware: middlewareName,
      policy,
    });
    return null;
  }
  return value;
}
```

- [ ] **Step 3: Wire edge planning into the plan builder**

Modify `rntme-cli/packages/deploy-core/src/plan.ts`:

```ts
import type { ComposedProjectInput } from './composed-project.js';
import type {
  ExternalEventBusConfig,
  ProjectDeploymentConfig,
  DeploymentMode,
} from './config.js';
import type { DeploymentPlanError } from './errors.js';
import { planEdge, type EdgeMiddleware, type EdgeRoute } from './edge.js';
import { err, ok, type Result } from './result.js';

export type PlannedProject = {
  readonly orgSlug: string;
  readonly projectSlug: string;
  readonly environment: 'default';
  readonly mode: DeploymentMode;
};

export type DomainServiceWorkload = {
  readonly kind: 'domain-service';
  readonly slug: string;
  readonly serviceSlug: string;
  readonly resourceName: string;
  readonly runtime: { readonly image: string };
  readonly artifact: { readonly source: 'composed-project'; readonly serviceSlug: string };
  readonly persistence: { readonly mode: 'ephemeral' };
};

export type IntegrationModuleWorkload = {
  readonly kind: 'integration-module';
  readonly slug: string;
  readonly serviceSlug: string;
  readonly resourceName: string;
  readonly image: string;
  readonly expose: boolean;
  readonly env: Readonly<Record<string, string>>;
  readonly secretRefs: Readonly<Record<string, string>>;
};

export type EdgeGatewayWorkload = {
  readonly kind: 'edge-gateway';
  readonly slug: 'edge';
  readonly resourceName: string;
  readonly image: 'nginx:1.27-alpine';
};

export type DeploymentWorkload =
  | DomainServiceWorkload
  | IntegrationModuleWorkload
  | EdgeGatewayWorkload;

export type EdgePlan = {
  readonly routes: readonly EdgeRoute[];
  readonly middleware: readonly EdgeMiddleware[];
};

export type DeploymentWarning = {
  readonly code: string;
  readonly message: string;
};

export type ProjectDeploymentPlan = {
  readonly project: PlannedProject;
  readonly infrastructure: {
    readonly eventBus: ExternalEventBusConfig;
  };
  readonly workloads: readonly DeploymentWorkload[];
  readonly edge: EdgePlan;
  readonly diagnostics: {
    readonly warnings: readonly DeploymentWarning[];
  };
};

export function buildProjectDeploymentPlan(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
): Result<ProjectDeploymentPlan, DeploymentPlanError> {
  const errors: DeploymentPlanError[] = [];

  if (config.mode === 'production') {
    errors.push({
      code: 'DEPLOY_PLAN_UNSUPPORTED_PRODUCTION_MODE',
      message: 'production mode is modeled but rejected until runtime production prerequisites land',
      path: 'mode',
    });
  }

  if (config.environment !== 'default') {
    errors.push({
      code: 'DEPLOY_PLAN_INVALID_ENVIRONMENT',
      message: 'the MVP accepts only environment "default"',
      path: 'environment',
    });
  }

  if (config.orgSlug.trim() === '') {
    errors.push({
      code: 'DEPLOY_PLAN_MISSING_ORG_SLUG',
      message: 'orgSlug is required for deterministic target resource names',
      path: 'orgSlug',
    });
  }

  if (config.eventBus === undefined || config.eventBus.brokers.length === 0) {
    errors.push({
      code: 'DEPLOY_PLAN_MISSING_EVENT_BUS',
      message: 'preview deployments require one project-level external Kafka/Redpanda endpoint',
      path: 'eventBus',
    });
  }

  const workloads = buildWorkloads(project, config, errors);
  const { edge, errors: edgeErrors } = planEdge(project, config, workloads);
  errors.push(...edgeErrors);

  if (errors.length > 0 || config.eventBus === undefined) return err(errors);

  return ok({
    project: {
      orgSlug: config.orgSlug,
      projectSlug: project.name,
      environment: config.environment,
      mode: config.mode,
    },
    infrastructure: {
      eventBus: config.eventBus,
    },
    workloads,
    edge,
    diagnostics: { warnings: [] },
  });
}

function buildWorkloads(
  project: ComposedProjectInput,
  config: ProjectDeploymentConfig,
  errors: DeploymentPlanError[],
): DeploymentWorkload[] {
  const workloads: DeploymentWorkload[] = [];
  const runtimeImage = config.runtimeImage ?? 'rntme-runtime';

  for (const service of Object.values(project.services)) {
    if (service.kind === 'domain') {
      workloads.push({
        kind: 'domain-service',
        slug: service.slug,
        serviceSlug: service.slug,
        resourceName: resourceName(config.orgSlug, project.name, service.slug),
        runtime: { image: runtimeImage },
        artifact: { source: 'composed-project', serviceSlug: service.slug },
        persistence: { mode: 'ephemeral' },
      });
      continue;
    }

    const moduleConfig = config.modules?.[service.slug];
    if (moduleConfig === undefined) {
      errors.push({
        code: 'DEPLOY_PLAN_MISSING_MODULE_IMAGE',
        message: `integration module "${service.slug}" requires explicit image config`,
        service: service.slug,
        path: `modules.${service.slug}`,
      });
      continue;
    }

    workloads.push({
      kind: 'integration-module',
      slug: service.slug,
      serviceSlug: service.slug,
      resourceName: resourceName(config.orgSlug, project.name, service.slug),
      image: moduleConfig.image,
      expose: moduleConfig.expose === true,
      env: moduleConfig.env ?? {},
      secretRefs: moduleConfig.secretRefs ?? {},
    });
  }

  workloads.push({
    kind: 'edge-gateway',
    slug: 'edge',
    resourceName: resourceName(config.orgSlug, project.name, 'edge'),
    image: 'nginx:1.27-alpine',
  });

  return workloads;
}

function resourceName(orgSlug: string, projectSlug: string, workloadSlug: string): string {
  return `rntme-${orgSlug}-${projectSlug}-${workloadSlug}`;
}
```

- [ ] **Step 4: Export edge types**

Modify `rntme-cli/packages/deploy-core/src/index.ts` and add:

```ts
export {
  planEdge,
  type EdgeMiddleware,
  type EdgeRoute,
  type PlannedEdge,
} from './edge.js';
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm -F @rntme-cli/deploy-core test -- test/unit/edge.test.ts test/unit/plan.test.ts
```

Expected: all deploy-core route and middleware tests pass.

- [ ] **Step 6: Run package verification**

Run:

```bash
pnpm -F @rntme-cli/deploy-core build
pnpm -F @rntme-cli/deploy-core typecheck
pnpm -F @rntme-cli/deploy-core lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/deploy-core
git commit -m "feat: plan deployment edge routes"
```

---

### Task 4: Scaffold `@rntme-cli/deploy-dokploy`

**Files:**
- Create: `rntme-cli/packages/deploy-dokploy/package.json`
- Create: `rntme-cli/packages/deploy-dokploy/tsconfig.json`
- Create: `rntme-cli/packages/deploy-dokploy/tsconfig.check.json`
- Create: `rntme-cli/packages/deploy-dokploy/vitest.config.ts`
- Create: `rntme-cli/packages/deploy-dokploy/eslint.config.mjs`
- Create: `rntme-cli/packages/deploy-dokploy/README.md`
- Create: `rntme-cli/packages/deploy-dokploy/src/result.ts`
- Create: `rntme-cli/packages/deploy-dokploy/src/errors.ts`
- Create: `rntme-cli/packages/deploy-dokploy/src/config.ts`
- Create: `rntme-cli/packages/deploy-dokploy/src/index.ts`
- Test: `rntme-cli/packages/deploy-dokploy/test/unit/package-smoke.test.ts`

- [ ] **Step 1: Write package smoke test**

Create `rntme-cli/packages/deploy-dokploy/test/unit/package-smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEPLOY_DOKPLOY_ERROR_CODES,
  err,
  isErr,
  isOk,
  ok,
} from '../../src/index.js';

describe('@rntme-cli/deploy-dokploy package surface', () => {
  it('exports Result helpers and Dokploy error codes', () => {
    const success = ok({ rendered: true });
    const failure = err([
      {
        code: 'DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT',
        message: 'missing Dokploy project config',
      },
    ]);

    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    expect(DEPLOY_DOKPLOY_ERROR_CODES.DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT).toBe(
      'DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT',
    );
  });
});
```

- [ ] **Step 2: Add package metadata**

Create `rntme-cli/packages/deploy-dokploy/package.json`:

```json
{
  "name": "@rntme-cli/deploy-dokploy",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Dokploy target adapter for rntme project deployments.",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint --no-error-on-unmatched-pattern \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@rntme-cli/deploy-core": "workspace:*"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Add TypeScript, Vitest, and ESLint config**

Create `rntme-cli/packages/deploy-dokploy/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": false },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

Create `rntme-cli/packages/deploy-dokploy/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Create `rntme-cli/packages/deploy-dokploy/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
    passWithNoTests: true,
  },
});
```

Create `rntme-cli/packages/deploy-dokploy/eslint.config.mjs`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.check.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

- [ ] **Step 4: Add Result helpers, errors, config, exports, and README**

Create `rntme-cli/packages/deploy-dokploy/src/errors.ts`:

```ts
export const DEPLOY_DOKPLOY_ERROR_CODES = {
  DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT: 'DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT',
  DEPLOY_RENDER_DOKPLOY_SECRET_LEAK: 'DEPLOY_RENDER_DOKPLOY_SECRET_LEAK',
  DEPLOY_APPLY_DOKPLOY_API_ERROR: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
  DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
} as const;

export type DokployDeploymentErrorCode = keyof typeof DEPLOY_DOKPLOY_ERROR_CODES;

export type DokployDeploymentError = {
  readonly code: DokployDeploymentErrorCode;
  readonly message: string;
  readonly resource?: string;
  readonly cause?: unknown;
};
```

Create `rntme-cli/packages/deploy-dokploy/src/result.ts`:

```ts
import type { DokployDeploymentError } from './errors.js';

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly errors: readonly E[] };
export type Result<T, E = DokployDeploymentError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(errors: readonly E[]): Err<E> => ({ ok: false, errors });
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok === true;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r.ok === false;
```

Create `rntme-cli/packages/deploy-dokploy/src/config.ts`:

```ts
export type DokployTargetConfig = {
  readonly endpoint: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly allowCreateProject?: boolean;
  readonly publicBaseUrl: string;
};

export type DokploySecretInput = {
  readonly apiToken: string;
  readonly secrets?: Readonly<Record<string, string>>;
};
```

Create `rntme-cli/packages/deploy-dokploy/src/index.ts`:

```ts
export {
  DEPLOY_DOKPLOY_ERROR_CODES,
  type DokployDeploymentError,
  type DokployDeploymentErrorCode,
} from './errors.js';
export { type DokploySecretInput, type DokployTargetConfig } from './config.js';
export { err, isErr, isOk, ok, type Err, type Ok, type Result } from './result.js';
```

Create `rntme-cli/packages/deploy-dokploy/README.md`:

```md
# @rntme-cli/deploy-dokploy

Dokploy target adapter for rntme project deployments.

This package renders a `ProjectDeploymentPlan` into redacted Dokploy resources
and applies them through an injected Dokploy HTTP client.
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm -F @rntme-cli/deploy-dokploy test
```

Expected: package smoke test passes.

- [ ] **Step 6: Run build, typecheck, and lint**

Run:

```bash
pnpm -F @rntme-cli/deploy-dokploy build
pnpm -F @rntme-cli/deploy-dokploy typecheck
pnpm -F @rntme-cli/deploy-dokploy lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/deploy-dokploy
git commit -m "feat: scaffold deploy-dokploy package"
```

---

### Task 5: Implement Dokploy render and Nginx generation

**Files:**
- Create: `rntme-cli/packages/deploy-dokploy/src/names.ts`
- Create: `rntme-cli/packages/deploy-dokploy/src/nginx.ts`
- Create: `rntme-cli/packages/deploy-dokploy/src/render.ts`
- Modify: `rntme-cli/packages/deploy-dokploy/src/index.ts`
- Test: `rntme-cli/packages/deploy-dokploy/test/unit/names.test.ts`
- Test: `rntme-cli/packages/deploy-dokploy/test/unit/nginx.test.ts`
- Test: `rntme-cli/packages/deploy-dokploy/test/unit/render.test.ts`

- [ ] **Step 1: Write deterministic naming tests**

Create `rntme-cli/packages/deploy-dokploy/test/unit/names.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dokployResourceName, dokployLabels } from '../../src/names.js';

describe('Dokploy names', () => {
  it('uses rntme org/project/workload names', () => {
    expect(dokployResourceName('acme', 'commerce', 'catalog')).toBe(
      'rntme-acme-commerce-catalog',
    );
  });

  it('normalizes invalid characters and adds labels', () => {
    expect(dokployResourceName('Acme Org', 'Commerce_App', 'Catalog API')).toBe(
      'rntme-acme-org-commerce-app-catalog-api',
    );
    expect(dokployLabels('acme', 'commerce', 'default', 'catalog')).toEqual({
      'rntme.org': 'acme',
      'rntme.project': 'commerce',
      'rntme.environment': 'default',
      'rntme.workload': 'catalog',
      'rntme.managed-by': 'rntme-deploy-dokploy',
    });
  });
});
```

- [ ] **Step 2: Write Nginx generation test**

Create `rntme-cli/packages/deploy-dokploy/test/unit/nginx.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderNginxConfig } from '../../src/nginx.js';
import type { EdgePlan } from '@rntme-cli/deploy-core';

describe('renderNginxConfig', () => {
  it('renders upstreams, routes, request context, and rate limits', () => {
    const edge: EdgePlan = {
      routes: [
        { id: 'ui:/', kind: 'ui', path: '/', targetService: 'app', targetWorkload: 'app' },
        {
          id: 'http:/api/catalog',
          kind: 'http',
          path: '/api/catalog',
          targetService: 'catalog',
          targetWorkload: 'catalog',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api/catalog',
          name: 'rateLimit',
          kind: 'rate-limit',
          policy: 'default',
          config: { requestsPerMinute: 60, burst: 20 },
        },
        {
          mountTarget: 'ui:/',
          name: 'requestContext',
          kind: 'request-context',
          policy: 'default',
          config: { requestIdHeader: 'x-request-id', correlationIdHeader: 'x-correlation-id' },
        },
      ],
    };

    const rendered = renderNginxConfig(edge, {
      app: 'http://rntme-acme-commerce-app:3000',
      catalog: 'http://rntme-acme-commerce-catalog:3000',
    });

    expect(rendered).toContain('limit_req_zone $binary_remote_addr zone=http_api_catalog:10m rate=60r/m;');
    expect(rendered).toContain('proxy_pass http://rntme-acme-commerce-catalog:3000;');
    expect(rendered).toContain('proxy_set_header x-request-id $request_id;');
    expect(rendered).toContain('location /api/catalog');
  });
});
```

- [ ] **Step 3: Write render tests**

Create `rntme-cli/packages/deploy-dokploy/test/unit/render.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ProjectDeploymentPlan } from '@rntme-cli/deploy-core';
import { renderDokployPlan } from '../../src/render.js';

const plan: ProjectDeploymentPlan = {
  project: { orgSlug: 'acme', projectSlug: 'commerce', environment: 'default', mode: 'preview' },
  infrastructure: {
    eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda.internal:9092'] },
  },
  workloads: [
    {
      kind: 'domain-service',
      slug: 'catalog',
      serviceSlug: 'catalog',
      resourceName: 'rntme-acme-commerce-catalog',
      runtime: { image: 'rntme-runtime' },
      artifact: { source: 'composed-project', serviceSlug: 'catalog' },
      persistence: { mode: 'ephemeral' },
    },
    {
      kind: 'edge-gateway',
      slug: 'edge',
      resourceName: 'rntme-acme-commerce-edge',
      image: 'nginx:1.27-alpine',
    },
  ],
  edge: {
    routes: [
      {
        id: 'http:/api/catalog',
        kind: 'http',
        path: '/api/catalog',
        targetService: 'catalog',
        targetWorkload: 'catalog',
      },
    ],
    middleware: [],
  },
  diagnostics: { warnings: [] },
};

describe('renderDokployPlan', () => {
  it('renders redacted Dokploy resources and digest', () => {
    const r = renderDokployPlan(plan, {
      endpoint: 'https://dokploy.example.com',
      projectId: 'project_123',
      publicBaseUrl: 'https://commerce.example.com',
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.targetProject).toEqual({ mode: 'existing', projectId: 'project_123' });
    expect(r.value.resources.map((resource) => resource.name)).toEqual([
      'rntme-acme-commerce-catalog',
      'rntme-acme-commerce-edge',
    ]);
    expect(r.value.resources[0]).toMatchObject({
      kind: 'application',
      workloadKind: 'domain-service',
      image: 'rntme-runtime',
    });
    expect(r.value.resources[0].env).toContainEqual({
      name: 'RNTME_EVENT_BUS_BROKERS',
      value: 'redpanda.internal:9092',
      secret: false,
    });
    expect(r.value.digest).toMatch(/^sha256:/);
    expect(JSON.stringify(r.value)).not.toContain('apiToken');
  });

  it('rejects missing Dokploy project identity when creation is disabled', () => {
    const r = renderDokployPlan(plan, {
      endpoint: 'https://dokploy.example.com',
      publicBaseUrl: 'https://commerce.example.com',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({ code: 'DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT' }),
      );
    }
  });
});
```

- [ ] **Step 4: Implement names**

Create `rntme-cli/packages/deploy-dokploy/src/names.ts`:

```ts
export function dokployResourceName(orgSlug: string, projectSlug: string, workloadSlug: string): string {
  return ['rntme', orgSlug, projectSlug, workloadSlug].map(normalizePart).join('-');
}

export function dokployLabels(
  orgSlug: string,
  projectSlug: string,
  environment: string,
  workloadSlug: string,
): Record<string, string> {
  return {
    'rntme.org': orgSlug,
    'rntme.project': projectSlug,
    'rntme.environment': environment,
    'rntme.workload': workloadSlug,
    'rntme.managed-by': 'rntme-deploy-dokploy',
  };
}

function normalizePart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length === 0 ? 'unknown' : normalized;
}
```

- [ ] **Step 5: Implement Nginx renderer**

Create `rntme-cli/packages/deploy-dokploy/src/nginx.ts`:

```ts
import type { EdgeMiddleware, EdgePlan, EdgeRoute } from '@rntme-cli/deploy-core';

export function renderNginxConfig(
  edge: EdgePlan,
  upstreams: Readonly<Record<string, string>>,
): string {
  const zones = edge.middleware
    .filter((m) => m.kind === 'rate-limit')
    .map((m) => {
      const zone = zoneName(m.mountTarget);
      return `limit_req_zone $binary_remote_addr zone=${zone}:10m rate=${m.config.requestsPerMinute}r/m;`;
    });

  const locations = edge.routes.map((route) =>
    renderLocation(route, upstreams[route.targetWorkload] ?? `http://${route.targetWorkload}:3000`, edge.middleware),
  );

  return [
    'events {}',
    'http {',
    ...zones.map((line) => `  ${line}`),
    '  server {',
    '    listen 8080;',
    '    location = /health { return 200 "ok\\n"; }',
    ...locations,
    '  }',
    '}',
    '',
  ].join('\n');
}

function renderLocation(
  route: EdgeRoute,
  upstream: string,
  middleware: readonly EdgeMiddleware[],
): string {
  const applied = middleware.filter((m) => m.mountTarget === route.id);
  const lines = [`    location ${route.path} {`];

  for (const m of applied) {
    if (m.kind === 'rate-limit') {
      lines.push(`      limit_req zone=${zoneName(m.mountTarget)} burst=${m.config.burst};`);
    }
    if (m.kind === 'body-limit') {
      lines.push(`      client_max_body_size ${m.config.maxBodySize};`);
    }
    if (m.kind === 'timeout') {
      const seconds = Math.ceil(m.config.upstreamTimeoutMs / 1000);
      lines.push(`      proxy_connect_timeout ${seconds}s;`);
      lines.push(`      proxy_read_timeout ${seconds}s;`);
      lines.push(`      proxy_send_timeout ${seconds}s;`);
    }
    if (m.kind === 'request-context') {
      const requestHeader = m.config.requestIdHeader ?? 'x-request-id';
      const correlationHeader = m.config.correlationIdHeader ?? 'x-correlation-id';
      lines.push(`      proxy_set_header ${requestHeader} $request_id;`);
      lines.push(`      proxy_set_header ${correlationHeader} $http_${headerVariable(correlationHeader)};`);
    }
  }

  lines.push('      proxy_set_header Host $host;');
  lines.push('      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
  lines.push(`      proxy_pass ${upstream};`);
  lines.push('    }');
  return lines.join('\n');
}

function zoneName(target: string): string {
  return target.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function headerVariable(header: string): string {
  return header.toLowerCase().replace(/-/g, '_');
}
```

- [ ] **Step 6: Implement Dokploy render**

Create `rntme-cli/packages/deploy-dokploy/src/render.ts`:

```ts
import { createHash } from 'node:crypto';
import type { DeploymentWorkload, ProjectDeploymentPlan } from '@rntme-cli/deploy-core';
import type { DokployTargetConfig } from './config.js';
import type { DokployDeploymentError } from './errors.js';
import { dokployLabels, dokployResourceName } from './names.js';
import { renderNginxConfig } from './nginx.js';
import { err, ok, type Result } from './result.js';

export type RenderedDokployProject =
  | { readonly mode: 'existing'; readonly projectId: string }
  | { readonly mode: 'create'; readonly projectName: string };

export type RenderedEnvVar = {
  readonly name: string;
  readonly value: string;
  readonly secret: boolean;
};

export type RenderedDokployResource = {
  readonly logicalId: string;
  readonly kind: 'application';
  readonly workloadKind: DeploymentWorkload['kind'];
  readonly workloadSlug: string;
  readonly name: string;
  readonly image: string;
  readonly env: readonly RenderedEnvVar[];
  readonly labels: Readonly<Record<string, string>>;
  readonly files?: Readonly<Record<string, string>>;
};

export type RenderedDokployPlan = {
  readonly target: { readonly kind: 'dokploy'; readonly endpoint: string };
  readonly targetProject: RenderedDokployProject;
  readonly resources: readonly RenderedDokployResource[];
  readonly urls: {
    readonly projectUrl: string;
    readonly uiUrl?: string;
    readonly publicRoutes: readonly { readonly routeId: string; readonly url: string }[];
  };
  readonly digest: string;
  readonly warnings: readonly string[];
};

export function renderDokployPlan(
  plan: ProjectDeploymentPlan,
  config: DokployTargetConfig,
): Result<RenderedDokployPlan, DokployDeploymentError> {
  const targetProject = resolveProject(config);
  if (targetProject === null) {
    return err([
      {
        code: 'DEPLOY_RENDER_DOKPLOY_MISSING_PROJECT',
        message: 'set projectId or projectName with allowCreateProject: true',
      },
    ]);
  }

  const upstreams = Object.fromEntries(
    plan.workloads
      .filter((w) => w.kind !== 'edge-gateway')
      .map((w) => [w.slug, `http://${dokployResourceName(plan.project.orgSlug, plan.project.projectSlug, w.slug)}:3000`]),
  );
  const nginxConfig = renderNginxConfig(plan.edge, upstreams);
  const resources = plan.workloads.map((workload) => renderResource(plan, workload, nginxConfig));
  const publicRoutes = plan.edge.routes.map((route) => ({
    routeId: route.id,
    url: `${config.publicBaseUrl}${route.path}`,
  }));
  const renderedWithoutDigest = {
    target: { kind: 'dokploy' as const, endpoint: config.endpoint },
    targetProject,
    resources,
    urls: {
      projectUrl: config.publicBaseUrl,
      uiUrl: plan.edge.routes.find((route) => route.kind === 'ui')?.path
        ? `${config.publicBaseUrl}${plan.edge.routes.find((route) => route.kind === 'ui')?.path ?? '/'}`
        : undefined,
      publicRoutes,
    },
    warnings: plan.diagnostics.warnings.map((warning) => warning.message),
  };

  return ok({
    ...renderedWithoutDigest,
    digest: digest(renderedWithoutDigest),
  });
}

function resolveProject(config: DokployTargetConfig): RenderedDokployProject | null {
  if (config.projectId !== undefined && config.projectId !== '') {
    return { mode: 'existing', projectId: config.projectId };
  }
  if (config.projectName !== undefined && config.projectName !== '' && config.allowCreateProject === true) {
    return { mode: 'create', projectName: config.projectName };
  }
  return null;
}

function renderResource(
  plan: ProjectDeploymentPlan,
  workload: DeploymentWorkload,
  nginxConfig: string,
): RenderedDokployResource {
  const name = dokployResourceName(plan.project.orgSlug, plan.project.projectSlug, workload.slug);
  const labels = dokployLabels(
    plan.project.orgSlug,
    plan.project.projectSlug,
    plan.project.environment,
    workload.slug,
  );

  if (workload.kind === 'edge-gateway') {
    return {
      logicalId: workload.slug,
      kind: 'application',
      workloadKind: workload.kind,
      workloadSlug: workload.slug,
      name,
      image: workload.image,
      env: [],
      labels,
      files: { '/etc/nginx/nginx.conf': nginxConfig },
    };
  }

  if (workload.kind === 'integration-module') {
    return {
      logicalId: workload.slug,
      kind: 'application',
      workloadKind: workload.kind,
      workloadSlug: workload.slug,
      name,
      image: workload.image,
      env: [
        ...Object.entries(workload.env).map(([envName, value]) => ({ name: envName, value, secret: false })),
        ...Object.entries(workload.secretRefs).map(([envName, ref]) => ({ name: envName, value: ref, secret: true })),
      ],
      labels,
    };
  }

  return {
    logicalId: workload.slug,
    kind: 'application',
    workloadKind: workload.kind,
    workloadSlug: workload.slug,
    name,
    image: workload.runtime.image,
    env: [
      {
        name: 'RNTME_EVENT_BUS_BROKERS',
        value: plan.infrastructure.eventBus.brokers.join(','),
        secret: false,
      },
      {
        name: 'RNTME_PERSISTENCE_MODE',
        value: workload.persistence.mode,
        secret: false,
      },
    ],
    labels,
  };
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
```

- [ ] **Step 7: Export render APIs**

Modify `rntme-cli/packages/deploy-dokploy/src/index.ts` and add:

```ts
export { dokployLabels, dokployResourceName } from './names.js';
export { renderNginxConfig } from './nginx.js';
export {
  renderDokployPlan,
  type RenderedDokployPlan,
  type RenderedDokployProject,
  type RenderedDokployResource,
  type RenderedEnvVar,
} from './render.js';
```

- [ ] **Step 8: Run focused render tests**

Run:

```bash
pnpm -F @rntme-cli/deploy-dokploy test -- test/unit/names.test.ts test/unit/nginx.test.ts test/unit/render.test.ts
```

Expected: all render tests pass.

- [ ] **Step 9: Run package verification**

Run:

```bash
pnpm -F @rntme-cli/deploy-dokploy build
pnpm -F @rntme-cli/deploy-dokploy typecheck
pnpm -F @rntme-cli/deploy-dokploy lint
```

Expected: all commands exit 0.

- [ ] **Step 10: Commit**

```bash
git add rntme-cli/packages/deploy-dokploy
git commit -m "feat: render dokploy deployment plans"
```

---

### Task 6: Implement Dokploy apply with an injected client

**Files:**
- Create: `rntme-cli/packages/deploy-dokploy/src/client.ts`
- Create: `rntme-cli/packages/deploy-dokploy/src/apply.ts`
- Modify: `rntme-cli/packages/deploy-dokploy/src/index.ts`
- Test: `rntme-cli/packages/deploy-dokploy/test/unit/apply.test.ts`

- [ ] **Step 1: Write apply tests with a fake client**

Create `rntme-cli/packages/deploy-dokploy/test/unit/apply.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyDokployPlan } from '../../src/apply.js';
import type { DokployClient, DokployProjectRef } from '../../src/client.js';
import type { RenderedDokployPlan } from '../../src/render.js';

const rendered: RenderedDokployPlan = {
  target: { kind: 'dokploy', endpoint: 'https://dokploy.example.com' },
  targetProject: { mode: 'existing', projectId: 'project_123' },
  resources: [
    {
      logicalId: 'catalog',
      kind: 'application',
      workloadKind: 'domain-service',
      workloadSlug: 'catalog',
      name: 'rntme-acme-commerce-catalog',
      image: 'rntme-runtime',
      env: [{ name: 'RNTME_EVENT_BUS_BROKERS', value: 'redpanda.internal:9092', secret: false }],
      labels: { 'rntme.workload': 'catalog' },
    },
  ],
  urls: {
    projectUrl: 'https://commerce.example.com',
    publicRoutes: [{ routeId: 'http:/api/catalog', url: 'https://commerce.example.com/api/catalog' }],
  },
  digest: 'sha256:abc',
  warnings: [],
};

describe('applyDokployPlan', () => {
  it('creates missing resources and returns structured result', async () => {
    const client = new FakeDokployClient();
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.resources).toEqual([
      {
        logicalId: 'catalog',
        workloadSlug: 'catalog',
        kind: 'domain-service',
        targetResourceId: 'app_1',
        targetResourceName: 'rntme-acme-commerce-catalog',
        action: 'created',
      },
    ]);
    expect(r.value.urls.publicRoutes[0].url).toBe('https://commerce.example.com/api/catalog');
    expect(JSON.stringify(r.value)).not.toContain('token');
  });

  it('updates existing resources by name and labels', async () => {
    const client = new FakeDokployClient([
      {
        id: 'app_existing',
        name: 'rntme-acme-commerce-catalog',
      },
    ]);
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.resources[0]).toMatchObject({
      targetResourceId: 'app_existing',
      action: 'updated',
    });
  });

  it('returns partial failure when an API call fails', async () => {
    const client = new FakeDokployClient([], true);
    const r = await applyDokployPlan(rendered, client);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual(
        expect.objectContaining({
          code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
          resource: 'rntme-acme-commerce-catalog',
        }),
      );
    }
  });
});

class FakeDokployClient implements DokployClient {
  private readonly apps = new Map<string, { id: string; name: string }>();
  private next = 1;

  constructor(existing: Array<{ id: string; name: string }> = [], private readonly fail = false) {
    for (const app of existing) this.apps.set(app.name, app);
  }

  async ensureProject(ref: DokployProjectRef): Promise<{ projectId: string }> {
    if (ref.mode === 'existing') return { projectId: ref.projectId };
    return { projectId: 'project_created' };
  }

  async findApplicationByName(projectId: string, name: string): Promise<{ id: string; name: string } | null> {
    void projectId;
    return this.apps.get(name) ?? null;
  }

  async createApplication(): Promise<{ id: string; name: string }> {
    if (this.fail) throw new Error('create failed');
    const app = { id: `app_${this.next++}`, name: 'rntme-acme-commerce-catalog' };
    this.apps.set(app.name, app);
    return app;
  }

  async updateApplication(id: string, input: { name: string }): Promise<{ id: string; name: string }> {
    if (this.fail) throw new Error('update failed');
    const app = { id, name: input.name };
    this.apps.set(input.name, app);
    return app;
  }
}
```

- [ ] **Step 2: Add Dokploy client interface**

Create `rntme-cli/packages/deploy-dokploy/src/client.ts`:

```ts
import type { RenderedDokployProject, RenderedDokployResource } from './render.js';

export type DokployProjectRef = RenderedDokployProject;

export type DokployApplication = {
  readonly id: string;
  readonly name: string;
};

export type DokployClient = {
  ensureProject(ref: DokployProjectRef): Promise<{ projectId: string }>;
  findApplicationByName(projectId: string, name: string): Promise<DokployApplication | null>;
  createApplication(projectId: string, resource: RenderedDokployResource): Promise<DokployApplication>;
  updateApplication(
    applicationId: string,
    resource: RenderedDokployResource,
  ): Promise<DokployApplication>;
};
```

- [ ] **Step 3: Implement apply**

Create `rntme-cli/packages/deploy-dokploy/src/apply.ts`:

```ts
import type { DokployClient } from './client.js';
import type { DokployDeploymentError } from './errors.js';
import type { RenderedDokployPlan } from './render.js';
import { err, ok, type Result } from './result.js';

export type DeploymentApplyResource = {
  readonly logicalId: string;
  readonly workloadSlug: string;
  readonly kind: 'domain-service' | 'integration-module' | 'edge-gateway';
  readonly targetResourceId: string;
  readonly targetResourceName: string;
  readonly action: 'created' | 'updated' | 'unchanged';
};

export type DeploymentApplyResult = {
  readonly target: {
    readonly kind: 'dokploy';
    readonly projectId: string;
  };
  readonly deployment: {
    readonly orgSlug?: string;
    readonly projectSlug?: string;
    readonly environment: 'default';
    readonly mode: 'preview';
  };
  readonly resources: readonly DeploymentApplyResource[];
  readonly urls: RenderedDokployPlan['urls'];
  readonly renderedPlanDigest: string;
  readonly warnings: readonly string[];
  readonly verificationHints: {
    readonly healthUrl: string;
    readonly uiUrl?: string;
    readonly publicRouteUrls: readonly string[];
  };
};

export async function applyDokployPlan(
  rendered: RenderedDokployPlan,
  client: DokployClient,
): Promise<Result<DeploymentApplyResult, DokployDeploymentError>> {
  const applied: DeploymentApplyResource[] = [];

  try {
    const { projectId } = await client.ensureProject(rendered.targetProject);

    for (const resource of rendered.resources) {
      try {
        const existing = await client.findApplicationByName(projectId, resource.name);
        const action = existing === null ? 'created' : 'updated';
        const target =
          existing === null
            ? await client.createApplication(projectId, resource)
            : await client.updateApplication(existing.id, resource);

        applied.push({
          logicalId: resource.logicalId,
          workloadSlug: resource.workloadSlug,
          kind: resource.workloadKind,
          targetResourceId: target.id,
          targetResourceName: target.name,
          action,
        });
      } catch (cause) {
        return err([
          {
            code: 'DEPLOY_APPLY_DOKPLOY_PARTIAL_FAILURE',
            message: `failed while applying resource "${resource.name}"`,
            resource: resource.name,
            cause,
          },
        ]);
      }
    }

    return ok({
      target: { kind: 'dokploy', projectId },
      deployment: {
        environment: 'default',
        mode: 'preview',
      },
      resources: applied,
      urls: rendered.urls,
      renderedPlanDigest: rendered.digest,
      warnings: rendered.warnings,
      verificationHints: {
        healthUrl: `${rendered.urls.projectUrl}/health`,
        uiUrl: rendered.urls.uiUrl,
        publicRouteUrls: rendered.urls.publicRoutes.map((route) => route.url),
      },
    });
  } catch (cause) {
    return err([
      {
        code: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
        message: 'failed to initialize Dokploy project',
        cause,
      },
    ]);
  }
}
```

- [ ] **Step 4: Export apply APIs**

Modify `rntme-cli/packages/deploy-dokploy/src/index.ts` and add:

```ts
export {
  applyDokployPlan,
  type DeploymentApplyResource,
  type DeploymentApplyResult,
} from './apply.js';
export {
  type DokployApplication,
  type DokployClient,
  type DokployProjectRef,
} from './client.js';
```

- [ ] **Step 5: Run apply tests**

Run:

```bash
pnpm -F @rntme-cli/deploy-dokploy test -- test/unit/apply.test.ts
```

Expected: apply tests pass.

- [ ] **Step 6: Run package verification**

Run:

```bash
pnpm -F @rntme-cli/deploy-dokploy build
pnpm -F @rntme-cli/deploy-dokploy typecheck
pnpm -F @rntme-cli/deploy-dokploy lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/deploy-dokploy
git commit -m "feat: apply dokploy deployment plans"
```

---

### Task 7: Documentation and workspace verification

**Files:**
- Modify: `rntme-cli/packages/deploy-core/README.md`
- Modify: `rntme-cli/packages/deploy-dokploy/README.md`
- Optional Modify: `AGENTS.md`
- Optional Modify: `rntme-cli/README.md`

- [ ] **Step 1: Expand deploy-core README**

Replace `rntme-cli/packages/deploy-core/README.md` with:

```md
# @rntme-cli/deploy-core

Target-neutral project deployment planning for rntme.

## Role

`deploy-core` accepts an already validated/composed project model and produces a
`ProjectDeploymentPlan`. It does not read raw blueprint folders, collect
secrets, call Dokploy, or run browser verification.

## Public API

- `buildProjectDeploymentPlan(project, config)` — creates a preview deployment
  plan or returns `DEPLOY_PLAN_*` errors.
- `ProjectDeploymentConfig` — org/environment/mode, external event bus,
  integration module image config, and policy values.
- `ComposedProjectInput` — deploy-relevant structural subset of the composed
  project model.

## MVP limits

- Only `mode: "preview"` is supported.
- Only `environment: "default"` is supported.
- Production mode is rejected until Kafka/Redpanda runtime bus support,
  persistence, auth middleware, and deployment records are designed.
- Integration modules require explicit image config.
```

- [ ] **Step 2: Expand deploy-dokploy README**

Replace `rntme-cli/packages/deploy-dokploy/README.md` with:

```md
# @rntme-cli/deploy-dokploy

Dokploy target adapter for rntme project deployments.

## Role

`deploy-dokploy` renders a `ProjectDeploymentPlan` into redacted Dokploy
resources and applies them through an injected Dokploy HTTP client. It does not
load raw blueprints, store platform credentials, or run browser verification.

## Public API

- `renderDokployPlan(plan, config)` — creates a redacted Dokploy plan with
  deterministic names, labels, generated Nginx config, and digest.
- `applyDokployPlan(rendered, client)` — upserts Dokploy resources through an
  injected client and returns a structured apply result.
- `DokployClient` — narrow interface for the real HTTP client and tests.

## Security

Rendered plans and apply results must not contain secret values. Secret values
are allowed only as in-memory input to the future real HTTP client.
```

- [ ] **Step 3: Update root agent map if the packages are intended as standing repo knowledge**

If the implementation is merged as a durable package addition, update `AGENTS.md` §3 with:

```md
- **`@rntme-cli/deploy-core`** — Target-neutral project deployment planning from a validated/composed project model. Preview MVP only; no raw blueprint loading.
- **`@rntme-cli/deploy-dokploy`** — Dokploy target adapter: render/apply redacted deployment plans through the Dokploy HTTP API.
```

If the team wants `AGENTS.md` changes deferred until packages stabilize, skip this step and mention the omission in the final implementation summary.

- [ ] **Step 4: Run targeted workspace verification**

Run:

```bash
pnpm -F @rntme-cli/deploy-core test
pnpm -F @rntme-cli/deploy-core typecheck
pnpm -F @rntme-cli/deploy-core lint
pnpm -F @rntme-cli/deploy-dokploy test
pnpm -F @rntme-cli/deploy-dokploy typecheck
pnpm -F @rntme-cli/deploy-dokploy lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Run submodule-wide build if time permits**

Run:

```bash
pnpm --dir rntme-cli -r run build
```

Expected: all `@rntme-cli/*` packages build.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/deploy-core rntme-cli/packages/deploy-dokploy AGENTS.md rntme-cli/README.md
git commit -m "docs: document deployment packages"
```

If `AGENTS.md` or `rntme-cli/README.md` were intentionally not changed, omit them from `git add`.

## Plan self-review

- Spec coverage: package split, validated/composed input, preview-only mode, external event bus requirement, Nginx edge, supported middleware, unsupported middleware rejection, module image requirement, public module exposure rule, Dokploy rendering, apply idempotency, redaction, structured apply result, and frontend verification handoff all map to tasks.
- Placeholder scan: no TBD/TODO/fill-in placeholders are used. Optional docs updates are explicitly bounded with a skip rule and final-summary requirement.
- Type consistency: `ComposedProjectInput`, `ProjectDeploymentConfig`, `ProjectDeploymentPlan`, `RenderedDokployPlan`, and `DeploymentApplyResult` are introduced before later tasks use them.
