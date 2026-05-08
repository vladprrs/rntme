import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type {
  DokployApplication,
  DokployClient,
  DokployCompose,
  DokployProjectRef,
  RenderedDokployResource,
  RenderedEnvVar,
} from '@rntme/deploy-dokploy';
import { parseTargetSecret, type DeployTargetWithSecret, type SecretCipher } from '@rntme/platform-core';

export type DokployResolvedTargetSecretMap = Readonly<Record<string, unknown>>;
export type DokployClientFactory = (
  target: DeployTargetWithSecret,
  resolvedTargetSecrets?: DokployResolvedTargetSecretMap,
) => DokployClient;
type Sleep = (ms: number) => Promise<void>;

type DokployApiApplicationSummary = {
  applicationId: string;
  name: string;
};

type DokployApiApplication = DokployApiApplicationSummary & {
  appName?: string;
  dockerImage?: string;
  env?: string;
  command?: string | null;
  args?: string[] | null;
  applicationStatus?: string;
  lastDeploymentStatus?: string;
  statusMessage?: string;
};

type DokployApiComposeSummary = {
  composeId: string;
  name: string;
};

type DokployApiCompose = DokployApiComposeSummary & {
  appName?: string;
  composeFile?: string;
  env?: string;
};

type DokployApiDomain = {
  domainId: string;
  host: string;
};

type DokployApiMount = {
  mountId: string;
  mountPath?: string;
  filePath?: string;
};

type DokployApiEnvironment = {
  environmentId: string;
  name: string;
  applications?: readonly DokployApiApplicationSummary[];
  composes?: readonly DokployApiComposeSummary[];
};

type DokployApiProject = {
  projectId: string;
  name: string;
  environments?: readonly DokployApiEnvironment[];
};

export function createDokployClientFactory(
  cipher: SecretCipher,
  httpFetch: typeof globalThis.fetch = globalThis.fetch,
  sleepFn: Sleep = sleep,
): DokployClientFactory {
  return (target, resolvedTargetSecrets) => {
    let token: string;
    try {
      token = cipher.decrypt({
        ciphertext: target.apiTokenCiphertext,
        nonce: target.apiTokenNonce,
        keyVersion: target.apiTokenKeyVersion,
      });
    } catch {
      throw new Error('DEPLOY_TARGET_TOKEN_DECRYPT_FAILED');
    }

    const baseUrl = normalizeDokployBaseUrl(target.dokployUrl);
    const request = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
      const url = method === 'GET' && body ? `${baseUrl}${path}?${new URLSearchParams(body as Record<string, string>)}` : `${baseUrl}${path}`;
      const response = await httpFetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-api-key': token,
        },
        ...(method === 'POST' && body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        throw new Error(`Dokploy request failed: ${response.status} ${await response.text()}`);
      }
      const text = await response.text();
      if (text.trim() === '') return {} as T;
      return JSON.parse(text) as T;
    };

    return {
      ensureEnvironment: async (ref: DokployProjectRef, environmentName: string) => {
        const projects = await request<DokployApiProject[]>('GET', '/api/project.all');
        let project =
          ref.mode === 'create'
            ? projects.find((p) => p.name === ref.projectName)
            : projects.find((p) => p.projectId === ref.projectId);
        if (!project) {
          if (ref.mode !== 'create') throw new Error(`Project ${ref.projectId} not found`);
          project = await request<DokployApiProject>('POST', '/api/project.create', { name: ref.projectName });
        }
        let environment = project.environments?.find((e) => e.name === environmentName);
        if (!environment) {
          environment = await request<DokployApiEnvironment>('POST', '/api/environment.create', {
            projectId: project.projectId,
            name: environmentName,
          });
        }
        return { environmentId: environment.environmentId };
      },
      findApplicationByName: async (environmentId: string, name: string) => {
        return findApplicationByName(request, environmentId, name);
      },
      createApplication: async (
        environmentId: string,
        resource: Extract<RenderedDokployResource, { kind: 'application' }>,
      ) => {
        const app = await request<DokployApiApplication>('POST', '/api/application.create', {
          environmentId,
          name: resource.name,
          appName: resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63),
          description: `Managed by rntme-cli`,
        });
        if (app.applicationId === undefined || app.applicationId === '') {
          const created = await findApplicationByName(request, environmentId, resource.name);
          if (created === null) throw new Error(`Dokploy application ${resource.name} not found after create`);
          return created;
        }
        return toDokployApplication(app);
      },
      updateApplication: async (
        applicationId: string,
        resource: Extract<RenderedDokployResource, { kind: 'application' }>,
      ) => {
        const app = await request<DokployApiApplication | boolean>('POST', '/api/application.update', {
          applicationId,
          name: resource.name,
          appName: resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63),
          description: `Managed by rntme-cli`,
          ...(resource.command !== undefined ? { command: resource.command } : {}),
          ...(resource.args !== undefined ? { args: [...resource.args] } : {}),
        });
        if (typeof app !== 'object' || app === null || app.applicationId === undefined || app.applicationId === '') {
          const updated = await request<DokployApiApplication>('GET', '/api/application.one', { applicationId });
          return toDokployApplication(updated);
        }
        return toDokployApplication(app);
      },
      configureApplication: async (
        applicationId: string,
        resource: Extract<RenderedDokployResource, { kind: 'application' }>,
      ) => {
        const appName = resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63);
        const envResolved = resolvedApplicationEnv(resource, resolvedTargetSecrets);
        await request('POST', '/api/application.update', {
          applicationId,
          name: resource.name,
          appName,
          description: `Managed by rntme-cli`,
          env: envResolved,
          ...(resource.command !== undefined ? { command: resource.command } : {}),
          ...(resource.args !== undefined ? { args: [...resource.args] } : {}),
        });
        await request('POST', '/api/application.saveEnvironment', {
          applicationId,
          env: envResolved,
          buildArgs: '',
          buildSecrets: '',
          createEnvFile: true,
        });
        if (resource.build !== undefined) {
          await request('POST', '/api/application.saveBuildType', {
            applicationId,
            buildType: 'dockerfile',
            dockerfile: 'Dockerfile',
            dockerContextPath: '.',
            dockerBuildStage: null,
            herokuVersion: null,
            railpackVersion: null,
          });
        } else {
          await request('POST', '/api/application.saveDockerProvider', {
            applicationId,
            dockerImage: resource.image,
            username: '',
            password: '',
            registryUrl: '',
          });
        }
        await configureFileMounts(request, applicationId, resource.files);
        if (resource.ingress !== undefined) {
          const domainsResponse = await request<unknown>('GET', '/api/domain.byApplicationId', {
            applicationId,
          });
          const domains = Array.isArray(domainsResponse) ? (domainsResponse as DokployApiDomain[]) : [];
          const host = new URL(resource.ingress.publicBaseUrl).host;
          const domain = domains.find((d) => d.host === host);
          const body = {
            host,
            path: '/',
            port: resource.ingress.containerPort,
            https: new URL(resource.ingress.publicBaseUrl).protocol === 'https:',
            certificateType: 'letsencrypt',
          };
          if (domain === undefined) {
            await request('POST', '/api/domain.create', {
              ...body,
              applicationId,
            });
          } else {
            await request('POST', '/api/domain.update', {
              ...body,
              domainId: domain.domainId,
            });
          }
        }
      },
      deployApplication: async (applicationId: string) => {
        await request('POST', '/api/application.deploy', { applicationId });
      },
      startApplication: async (applicationId: string) => {
        await startApplicationWithRetry(request, applicationId, sleepFn);
      },
      inspectApplication: async (applicationId: string) => {
        const app = await request<DokployApiApplication>('GET', '/api/application.one', { applicationId });
        const status = normalizeApplicationStatus(app.applicationStatus ?? app.lastDeploymentStatus);
        return {
          status,
          ...(app.statusMessage === undefined ? {} : { message: app.statusMessage }),
        };
      },
      findComposeByName: async (environmentId: string, name: string) => {
        return findComposeByName(request, environmentId, name);
      },
      createCompose: async (
        environmentId: string,
        resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
      ) => {
        const compose = await request<DokployApiCompose>('POST', '/api/compose.create', {
          environmentId,
          name: resource.name,
          appName: resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63),
          description: 'Managed by rntme-cli',
          composeType: 'docker-compose',
          composeFile: resource.composeFile,
        });
        if (compose.composeId === undefined || compose.composeId === '') {
          const created = await findComposeByName(request, environmentId, resource.name);
          if (created === null) throw new Error(`Dokploy compose ${resource.name} not found after create`);
          return created;
        }
        return toDokployCompose(compose, resource);
      },
      updateCompose: async (
        composeId: string,
        resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
      ) => {
        const compose = await request<DokployApiCompose | boolean>('POST', '/api/compose.update', {
          composeId,
          name: resource.name,
          appName: resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63),
          description: 'Managed by rntme-cli',
          sourceType: 'raw',
          composeType: 'docker-compose',
          composeFile: resource.composeFile,
        });
        if (typeof compose !== 'object' || compose === null || compose.composeId === undefined || compose.composeId === '') {
          const updated = await request<DokployApiCompose>('GET', '/api/compose.one', { composeId });
          return toDokployCompose(updated, resource);
        }
        return toDokployCompose(compose, resource);
      },
      configureCompose: async (
        composeId: string,
        resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
      ) => {
        await request('POST', '/api/compose.update', {
          composeId,
          name: resource.name,
          appName: resource.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 63),
          description: 'Managed by rntme-cli',
          sourceType: 'raw',
          composeType: 'docker-compose',
          composeFile: resource.composeFile,
        });
        await request('POST', '/api/compose.saveEnvironment', {
          composeId,
          env: envBlock(resource),
        });
      },
      deployCompose: async (composeId: string) => {
        await request('POST', '/api/compose.deploy', { composeId });
      },
      deleteApplication: async (applicationId: string) => {
        await request('POST', '/api/application.delete', { applicationId });
      },
      deleteCompose: async (composeId: string) => {
        await request('POST', '/api/compose.delete', { composeId });
      },
    };
  };
}

const START_APPLICATION_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000, 30_000] as const;

async function startApplicationWithRetry(
  request: <T>(method: 'GET' | 'POST', path: string, body?: unknown) => Promise<T>,
  applicationId: string,
  sleepFn: Sleep,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await request('POST', '/api/application.start', { applicationId });
      return;
    } catch (cause) {
      const delay = START_APPLICATION_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isTransientDokployStartRace(cause)) throw cause;
      await sleepFn(delay);
    }
  }
}

function isTransientDokployStartRace(cause: unknown): boolean {
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'object' && cause !== null && 'message' in cause && typeof cause.message === 'string'
        ? cause.message
        : String(cause);
  return /application\.start/.test(message) && /service .* not found/i.test(message);
}

function envBlock(resource: RenderedDokployResource, resolvedTargetSecrets?: DokployResolvedTargetSecretMap): string {
  if (resource.kind === 'compose') {
    return resource.env.map((e) => `${e.name}=${e.value}`).join('\n');
  }
  return resolvedApplicationEnv(resource, resolvedTargetSecrets);
}

function resolvedApplicationEnv(
  resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  resolvedTargetSecrets?: DokployResolvedTargetSecretMap,
): string {
  return resource.env
    .map((entry) => `${entry.name}=${resolveRenderedEnvValue(resource, entry, resolvedTargetSecrets)}`)
    .join('\n');
}

function resolveRenderedEnvValue(
  resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  envVar: RenderedEnvVar,
  resolvedTargetSecrets?: DokployResolvedTargetSecretMap,
): string {
  const needsConsoleSecret =
    envVar.name === 'RNTME_CONSOLE_HTPASSWD_B64' &&
    envVar.secret === true &&
    resource.infrastructureKind === 'redpanda-console-proxy';

  if (!needsConsoleSecret) return envVar.value;

  const hints = resource.secretResolutionHints?.redpandaConsoleHtpasswd;
  if (hints === undefined || resolvedTargetSecrets === undefined) {
    throw new Error('DEPLOY_DOKPLOY_CONSOLE_HTPASSWD_RESOLUTION_UNAVAILABLE');
  }

  const rawSecret = resolvedTargetSecrets[hints.secretRef];
  if (rawSecret === undefined || rawSecret === null) {
    throw new Error('DEPLOY_DOKPLOY_CONSOLE_HTPASSWD_SECRET_MISSING');
  }

  const parsed = parseTargetSecret('redpanda-console-basic-auth-v1', rawSecret);
  if (!parsed.ok) {
    throw new Error('DEPLOY_DOKPLOY_CONSOLE_HTPASSWD_SECRET_VALIDATION_FAILED');
  }

  const v = parsed.value as { username: string; htpasswdB64: string };
  if (v.username !== hints.expectedUsername) {
    throw new Error('DEPLOY_DOKPLOY_CONSOLE_HTPASSWD_USERNAME_MISMATCH');
  }

  return v.htpasswdB64;
}

async function findApplicationByName(
  request: <T>(method: 'GET' | 'POST', path: string, body?: unknown) => Promise<T>,
  environmentId: string,
  name: string,
): Promise<DokployApplication | null> {
  const projects = await request<DokployApiProject[]>('GET', '/api/project.all');
  for (const p of projects) {
    for (const e of p.environments || []) {
      if (e.environmentId === environmentId) {
        const app = e.applications?.find((a) => a.name === name);
        if (app) {
          const details = await request<DokployApiApplication>('GET', '/api/application.one', { applicationId: app.applicationId });
          return toDokployApplication(details);
        }
        return null;
      }
    }
  }
  return null;
}

async function findComposeByName(
  request: <T>(method: 'GET' | 'POST', path: string, body?: unknown) => Promise<T>,
  environmentId: string,
  name: string,
): Promise<DokployCompose | null> {
  const projects = await request<DokployApiProject[]>('GET', '/api/project.all');
  for (const p of projects) {
    for (const e of p.environments || []) {
      if (e.environmentId === environmentId) {
        const compose = e.composes?.find((c) => c.name === name);
        if (compose) {
          const details = await request<DokployApiCompose>('GET', '/api/compose.one', { composeId: compose.composeId });
          return toDokployCompose(details);
        }
        return null;
      }
    }
  }
  return null;
}

async function configureFileMounts(
  request: <T>(method: 'GET' | 'POST', path: string, body?: unknown) => Promise<T>,
  applicationId: string,
  files: Readonly<Record<string, string>> | undefined,
): Promise<void> {
  if (files === undefined) return;

  const mountsResponse = await request<unknown>('GET', '/api/mounts.listByServiceId', {
    serviceType: 'application',
    serviceId: applicationId,
  });
  const mounts = Array.isArray(mountsResponse) ? (mountsResponse as DokployApiMount[]) : [];

  for (const [path, content] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const matches = mounts.filter((mount) => mount.mountPath === path);
    const existing = matches[0];
    const body = {
      type: 'file',
      serviceType: 'application',
      serviceId: applicationId,
      mountPath: path,
      filePath: dokployFilePath(applicationId, path),
      content,
    };
    if (existing === undefined) {
      await request('POST', '/api/mounts.create', body);
    } else {
      await request('POST', '/api/mounts.update', {
        ...body,
        mountId: existing.mountId,
        applicationId,
      });
      for (const duplicate of matches.slice(1)) {
        await request('POST', '/api/mounts.remove', { mountId: duplicate.mountId });
      }
    }
  }
}

function dokployFilePath(applicationId: string, mountPath: string): string {
  const digest = createHash('sha256').update(`${applicationId}:${mountPath}`).digest('hex').slice(0, 16);
  const safeName = mountPath
    .split('/')
    .filter(Boolean)
    .join('_')
    .replace(/[^A-Za-z0-9._-]/g, '_');
  return `/etc/dokploy/rntme/${applicationId}/${digest}-${safeName || 'file'}`;
}

function toDokployApplication(details: DokployApiApplication): DokployApplication {
  return {
    id: details.applicationId,
    name: details.name,
    ...(details.appName ? { appName: details.appName } : {}),
    ...(details.dockerImage ? { image: details.dockerImage } : {}),
    ...(details.command !== undefined && details.command !== null && details.command !== ''
      ? { command: details.command }
      : {}),
    ...(details.args !== undefined && details.args !== null && details.args.length > 0
      ? { args: details.args }
      : {}),
    env: parseEnvBlock(details.env),
  };
}

function toDokployCompose(
  details: DokployApiCompose,
  rendered?: Extract<RenderedDokployResource, { kind: 'compose' }>,
): DokployCompose {
  return {
    id: details.composeId,
    name: details.name,
    ...(details.appName ? { appName: details.appName } : {}),
    ...(details.composeFile ? { composeFile: details.composeFile } : {}),
    ...(rendered === undefined ? {} : { image: rendered.image, labels: rendered.labels }),
    env: parseEnvBlock(details.env),
  };
}

function parseEnvBlock(input: string | undefined): NonNullable<DokployApplication['env']> {
  return input
    ? input.split('\n').filter(Boolean).map((line) => {
      const [name = '', ...rest] = line.split('=');
      return { name, value: rest.join('='), secret: false };
    })
    : [];
}

export function normalizeDokployBaseUrl(input: string): string {
  const trimmed = input.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function normalizeApplicationStatus(status: string | undefined): 'running' | 'done' | 'failed' | 'rejected' | 'unknown' {
  if (status === 'running' || status === 'done' || status === 'failed' || status === 'rejected') return status;
  if (status === 'error') return 'failed';
  return 'unknown';
}
