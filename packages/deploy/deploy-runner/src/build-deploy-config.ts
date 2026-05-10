import { createHash } from 'node:crypto';
import type { DokployTargetConfig } from '@rntme/deploy-dokploy';
import type {
  DeploymentPolicyConfig,
  IntegrationModuleDeploymentConfig,
  ProjectDeploymentConfig,
  StorageConfig,
} from '@rntme/deploy-core';
import type { DeployTargetForBuild } from './deploy-target-types.js';
import { normalizeDokployBaseUrl } from './dokploy-client-factory.js';

type DeployConfigOverrides = {
  readonly eventBusMode?: 'in-memory';
  readonly integrationModuleImages?: Record<string, string>;
  readonly policyOverrides?: Record<string, unknown>;
  readonly publicBaseUrl?: string;
  readonly runtimeImage?: string;
  readonly manualAccess?: {
    readonly redpandaConsole?: { readonly enabled?: boolean; readonly publicBaseUrl?: string };
  };
};

type ProjectSlugContext = {
  readonly projectSlug: string;
  readonly publicDeployDomain?: string;
};

export type PublicBaseUrlContext = {
  readonly orgSlug: string;
  readonly projectSlug: string;
  readonly environment: string;
  readonly publicDeployDomain?: string;
};

export function buildProjectDeploymentConfig(
  target: DeployTargetForBuild,
  orgSlug: string,
  configOverrides: Record<string, unknown>,
  projectCtx?: ProjectSlugContext,
): ProjectDeploymentConfig {
  const overrides = configOverrides as DeployConfigOverrides;
  const modules: Record<string, IntegrationModuleDeploymentConfig> = {};
  for (const [slug, moduleConfig] of Object.entries(target.modules)) {
    modules[slug] = cleanModuleConfig(moduleConfig);
  }
  for (const [slug, image] of Object.entries(overrides.integrationModuleImages ?? {})) {
    modules[slug] = { image };
  }

  const eventBus =
    overrides.eventBusMode === 'in-memory'
      ? {
          kind: 'memory' as const,
          mode: 'in-memory' as const,
        }
      : target.eventBus.mode === 'provisioned'
      ? {
          kind: target.eventBus.kind,
          mode: 'provisioned' as const,
          provider: target.eventBus.provider,
          ...(target.eventBus.image === undefined ? {} : { image: target.eventBus.image }),
          ...(target.eventBus.topicPrefix === undefined ? {} : { topicPrefix: target.eventBus.topicPrefix }),
        }
      : {
          kind: target.eventBus.kind,
          mode: 'external' as const,
          brokers: target.eventBus.brokers,
          ...(target.eventBus.topicPrefix === undefined ? {} : { topicPrefix: target.eventBus.topicPrefix }),
          ...(target.eventBus.security === undefined ? {} : { security: target.eventBus.security }),
        };

  const manualAccess = buildManualAccessDeployConfig(target, overrides, orgSlug, projectCtx);

  return {
    targetSlug: target.slug,
    orgSlug,
    environment: 'default',
    mode: 'preview',
    eventBus,
    storage: cleanStorageConfig(target.storage),
    modules,
    policies: {
      ...(target.policyValues as DeploymentPolicyConfig),
      ...((overrides.policyOverrides ?? {}) as DeploymentPolicyConfig),
    },
    ...(target.workflows === null ? {} : { workflows: cleanWorkflowsConfig(target.workflows) }),
    auth: cleanAuthConfig(target.auth),
    ...(overrides.runtimeImage ? { runtimeImage: overrides.runtimeImage } : {}),
    ...(manualAccess === undefined ? {} : { manualAccess }),
  };
}

function buildManualAccessDeployConfig(
  target: DeployTargetForBuild,
  overrides: DeployConfigOverrides,
  orgSlug: string,
  projectCtx: ProjectSlugContext | undefined,
): ProjectDeploymentConfig['manualAccess'] {
  const t = target.manualAccess.redpandaConsole;
  const d = overrides.manualAccess?.redpandaConsole;
  if (d?.enabled === false) return undefined;

  if (t === undefined || t.enabled !== true) return undefined;

  const publicUrl =
    d?.publicBaseUrl ??
    t.publicBaseUrl ??
    (projectCtx === undefined
      ? undefined
      : deriveRedpandaConsolePublicBaseUrl({
          orgSlug,
          projectSlug: projectCtx.projectSlug,
          environment: 'default',
          ...(projectCtx.publicDeployDomain === undefined
            ? {}
            : { publicDeployDomain: projectCtx.publicDeployDomain }),
        }));

  return {
    redpandaConsole: {
      enabled: true,
      ...(t.image === undefined ? {} : { image: t.image }),
      ...(publicUrl === undefined || publicUrl === '' ? {} : { publicBaseUrl: publicUrl }),
      basicAuth: {
        username: t.basicAuth.username,
        htpasswdSecretRef: t.basicAuth.htpasswdSecretRef,
      },
    },
  };
}

function deriveRedpandaConsolePublicBaseUrl(input: {
  readonly orgSlug: string;
  readonly projectSlug: string;
  readonly environment: string;
  readonly publicDeployDomain?: string;
}): string {
  const label = compactDnsLabel(['console', input.orgSlug, input.projectSlug, input.environment]);
  return `https://${label}.${normalizePublicDeployDomain(input.publicDeployDomain ?? 'rntme.com')}`;
}

function cleanStorageConfig(input: DeployTargetForBuild['storage']): StorageConfig {
  if (input.mode === 'external') return { mode: 'external' };
  return {
    mode: 'provisioned',
    provider: input.provider,
    ...(input.image === undefined ? {} : { image: input.image }),
    publicBaseUrl: input.publicBaseUrl,
    accessKeyRef: input.accessKeyRef,
    secretKeyRef: input.secretKeyRef,
  };
}

function cleanModuleConfig(input: DeployTargetForBuild['modules'][string]): IntegrationModuleDeploymentConfig {
  return {
    image: input.image,
    ...(input.expose === undefined ? {} : { expose: input.expose }),
    ...(input.env === undefined ? {} : { env: input.env }),
    ...(input.secretRefs === undefined ? {} : { secretRefs: input.secretRefs }),
  };
}

function cleanAuthConfig(input: DeployTargetForBuild['auth']): NonNullable<ProjectDeploymentConfig['auth']> {
  if (input.auth0 === undefined) return {};
  return {
    auth0: {
      clientId: input.auth0.clientId,
      ...(input.auth0.domain === undefined ? {} : { domain: input.auth0.domain }),
      ...(input.auth0.audience === undefined ? {} : { audience: input.auth0.audience }),
      ...(input.auth0.redirectUri === undefined ? {} : { redirectUri: input.auth0.redirectUri }),
    },
  };
}

function cleanWorkflowsConfig(
  input: NonNullable<DeployTargetForBuild['workflows']>,
): NonNullable<ProjectDeploymentConfig['workflows']> {
  return {
    engine: {
      kind: input.engine.kind,
      mode: input.engine.mode,
      image: input.engine.image,
      ...(input.engine.adminUserSecretRef === undefined ? {} : { adminUserSecretRef: input.engine.adminUserSecretRef }),
    },
    worker: input.worker,
    ...(input.operatonUi === undefined ? {} : { operatonUi: input.operatonUi }),
  };
}

export function buildDokployTargetConfig(
  target: DeployTargetForBuild,
  configOverrides: Record<string, unknown>,
  publicBaseUrlContext?: PublicBaseUrlContext,
): DokployTargetConfig {
  const overrides = configOverrides as DeployConfigOverrides;
  const publicBaseUrl =
    overrides.publicBaseUrl ??
    target.publicBaseUrl ??
    (publicBaseUrlContext === undefined ? undefined : derivePublicBaseUrl(publicBaseUrlContext));
  if (publicBaseUrl === null || publicBaseUrl === undefined || publicBaseUrl === '') {
    throw new Error('DEPLOY_TARGET_PUBLIC_BASE_URL_REQUIRED');
  }
  return {
    endpoint: normalizeDokployBaseUrl(target.dokployUrl),
    allowCreateProject: target.allowCreateProject,
    publicBaseUrl,
    ...(target.dokployProjectId === null ? {} : { projectId: target.dokployProjectId }),
    ...(target.dokployProjectName === null ? {} : { projectName: target.dokployProjectName }),
  };
}

export function derivePublicBaseUrl(input: PublicBaseUrlContext): string {
  const label = compactDnsLabel([input.orgSlug, input.projectSlug, input.environment]);
  return `https://${label}.${normalizePublicDeployDomain(input.publicDeployDomain ?? 'rntme.com')}`;
}

function compactDnsLabel(parts: readonly string[]): string {
  const label = parts.map(normalizeDnsPart).join('-');
  if (label.length <= 63) return label;
  const hash = createHash('sha256').update(label).digest('hex').slice(0, 12);
  return `${label.slice(0, 50).replace(/-+$/g, '')}-${hash}`;
}

function normalizeDnsPart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length === 0 ? 'unknown' : normalized;
}

function normalizePublicDeployDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '')
    .replace(/\.$/, '');
}
