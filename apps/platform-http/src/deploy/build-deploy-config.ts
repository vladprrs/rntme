import { createHash } from 'node:crypto';
import type { DokployTargetConfig } from '@rntme/deploy-dokploy';
import type {
  DeploymentPolicyConfig,
  IntegrationModuleDeploymentConfig,
  ProjectDeploymentConfig,
} from '@rntme/deploy-core';
import type { DeployTarget } from '@rntme/platform-core';
import { normalizeDokployBaseUrl } from './dokploy-client-factory.js';

type DeployConfigOverrides = {
  readonly eventBusMode?: 'in-memory';
  readonly integrationModuleImages?: Record<string, string>;
  readonly policyOverrides?: Record<string, unknown>;
  readonly publicBaseUrl?: string;
  readonly runtimeImage?: string;
};

type PublicBaseUrlContext = {
  readonly orgSlug: string;
  readonly projectSlug: string;
  readonly environment: string;
  readonly publicDeployDomain?: string;
};

export function buildProjectDeploymentConfig(
  target: DeployTarget,
  orgSlug: string,
  configOverrides: Record<string, unknown>,
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

  return {
    targetSlug: target.slug,
    orgSlug,
    environment: 'default',
    mode: 'preview',
    eventBus,
    modules,
    policies: {
      ...(target.policyValues as DeploymentPolicyConfig),
      ...((overrides.policyOverrides ?? {}) as DeploymentPolicyConfig),
    },
    ...(target.workflows === null ? {} : { workflows: target.workflows }),
    auth: cleanAuthConfig(target.auth),
    ...(overrides.runtimeImage ? { runtimeImage: overrides.runtimeImage } : {}),
  };
}

function cleanModuleConfig(input: DeployTarget['modules'][string]): IntegrationModuleDeploymentConfig {
  return {
    image: input.image,
    ...(input.expose === undefined ? {} : { expose: input.expose }),
    ...(input.env === undefined ? {} : { env: input.env }),
    ...(input.secretRefs === undefined ? {} : { secretRefs: input.secretRefs }),
  };
}

function cleanAuthConfig(input: DeployTarget['auth']): NonNullable<ProjectDeploymentConfig['auth']> {
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

export function buildDokployTargetConfig(
  target: DeployTarget,
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
