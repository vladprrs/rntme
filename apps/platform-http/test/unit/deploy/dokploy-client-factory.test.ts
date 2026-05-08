import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import type { RenderedDokployResource } from '@rntme/deploy-dokploy';
import type { DeployTargetWithSecret, SecretCipher } from '@rntme/platform-core';
import { createDokployClientFactory } from '../../../src/deploy/dokploy-client-factory.js';
import { createMockDokployApp } from '../../fixtures/mock-dokploy.js';

describe('createDokployClientFactory', () => {
  it('decrypts the target token and sends it as x-api-key on client calls', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const calls: { url: string; init: FetchInit }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: FetchInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url).includes('/api/project.all')) {
        return jsonResponse([{ projectId: 'project-1', name: 'project-1', environments: [{ environmentId: 'env-1', name: 'production', applications: [{ applicationId: 'app-1', name: 'edge' }] }] }]);
      }
      if (String(url).includes('/api/application.one')) {
        return jsonResponse({ applicationId: 'app-1', name: 'edge', dockerImage: 'nginx' });
      }
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await client.ensureEnvironment({ mode: 'existing', projectId: 'project-1' }, 'production');
    await client.findApplicationByName('env-1', 'edge');

    expect(cipher.decrypt).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(
      expect.objectContaining({
        url: 'https://dokploy.example.com/api/project.all',
        init: expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'plain-token' }) }),
      }),
    );
    expect(calls[1]).toEqual(
      expect.objectContaining({
        url: 'https://dokploy.example.com/api/project.all',
        init: expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'plain-token' }) }),
      }),
    );
  });

  it('finds an existing project by projectId even when the name differs', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/api/project.all')) {
        return jsonResponse([
          {
            projectId: 'project-1',
            name: 'rntme-demos',
            environments: [{ environmentId: 'env-1', name: 'default', applications: [] }],
          },
        ]);
      }
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await expect(client.ensureEnvironment({ mode: 'existing', projectId: 'project-1' }, 'default')).resolves.toEqual({
      environmentId: 'env-1',
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('configures files, ingress, deploy, and start with Dokploy API payloads', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: FetchInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).includes('/api/domain.byApplicationId')) return jsonResponse([]);
      if (String(url).includes('/api/mounts.listByServiceId')) return jsonResponse([]);
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await client.configureApplication('app-1', renderedEdgeResource());
    await client.deployApplication('app-1');
    await client.startApplication('app-1');

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      '/api/application.update',
      '/api/application.saveEnvironment',
      '/api/application.saveDockerProvider',
      '/api/mounts.listByServiceId',
      '/api/mounts.create',
      '/api/domain.byApplicationId',
      '/api/domain.create',
      '/api/application.deploy',
      '/api/application.start',
    ]);
    expect(calls[2]?.body).toMatchObject({
      applicationId: 'app-1',
      dockerImage: 'nginx:1.27-alpine',
      username: '',
      password: '',
      registryUrl: '',
    });
    expect(calls[4]?.body).toMatchObject({
      type: 'file',
      serviceType: 'application',
      serviceId: 'app-1',
      mountPath: '/etc/nginx/nginx.conf',
      filePath: '/etc/dokploy/rntme/app-1/1652e2a03ff06855-etc_nginx_nginx.conf',
      content: 'events {}',
    });
    expect(calls[6]?.body).toMatchObject({
      applicationId: 'app-1',
      host: 'notes.example.com',
      port: 8080,
      https: true,
      certificateType: 'letsencrypt',
    });
    expect(JSON.stringify(calls)).not.toContain('updateTraefikConfig');
  });

  it('retries the Dokploy start race while the docker service appears', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const sleeps: number[] = [];
    let startAttempts = 0;
    const fetcher = vi.fn(async (url: string | URL | Request, _init?: FetchInit) => {
      if (!String(url).includes('/api/application.start')) return jsonResponse({});
      startAttempts += 1;
      if (startAttempts < 3) {
        return errorResponse(500, {
          message:
            'Command execution failed: docker service scale rntme-orders=1: Error response from daemon: service rntme-orders not found',
          data: { path: 'application.start' },
        });
      }
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(
      cipher,
      fetcher as typeof globalThis.fetch,
      async (ms) => {
        sleeps.push(ms);
      },
    )(target());
    await expect(client.startApplication('app-1')).resolves.toBeUndefined();

    expect(startAttempts).toBe(3);
    expect(sleeps).toEqual([2_000, 4_000]);
  });

  it('updates existing application file mounts listed by service id', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: FetchInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).includes('/api/mounts.listByServiceId')) {
        return jsonResponse([
          {
            mountId: 'mount-1',
            mountPath: '/etc/nginx/nginx.conf',
            filePath: '/etc/nginx/nginx.conf',
          },
        ]);
      }
      if (String(url).includes('/api/domain.byApplicationId')) return jsonResponse([]);
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await client.configureApplication('app-1', renderedEdgeResource());

    expect(calls.some((call) => new URL(call.url).pathname === '/api/mounts.create')).toBe(false);
    const updateCall = calls.find((call) => new URL(call.url).pathname === '/api/mounts.update');
    expect(updateCall?.body).toMatchObject({
      mountId: 'mount-1',
      applicationId: 'app-1',
      serviceType: 'application',
      serviceId: 'app-1',
      mountPath: '/etc/nginx/nginx.conf',
      filePath: '/etc/dokploy/rntme/app-1/1652e2a03ff06855-etc_nginx_nginx.conf',
      content: 'events {}',
    });
  });

  it('configures generated artifact builds with Dokploy build-type fields', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: FetchInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await client.configureApplication('app-1', renderedDomainResource());

    const buildTypeCall = calls.find((call) => new URL(call.url).pathname === '/api/application.saveBuildType');
    expect(buildTypeCall?.body).toEqual({
      applicationId: 'app-1',
      buildType: 'dockerfile',
      dockerfile: 'Dockerfile',
      dockerContextPath: '.',
      dockerBuildStage: null,
      herokuVersion: null,
      railpackVersion: null,
    });
  });

  it('looks up created applications when Dokploy create returns an empty body', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/api/application.create')) return emptyResponse();
      if (String(url).includes('/api/project.all')) {
        return jsonResponse([
          {
            projectId: 'project-1',
            name: 'rntme-demos',
            environments: [
              {
                environmentId: 'env-1',
                name: 'default',
                applications: [{ applicationId: 'app-created', name: 'rntme-acme-notes-edge' }],
              },
            ],
          },
        ]);
      }
      if (String(url).includes('/api/application.one')) {
        return jsonResponse({ applicationId: 'app-created', name: 'rntme-acme-notes-edge', dockerImage: 'nginx' });
      }
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await expect(client.createApplication('env-1', renderedEdgeResource())).resolves.toMatchObject({
      id: 'app-created',
      name: 'rntme-acme-notes-edge',
    });
  });

  it('looks up updated applications when Dokploy update returns a boolean ack', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/api/application.update')) return jsonResponse(true);
      if (String(url).includes('/api/application.one')) {
        return jsonResponse({ applicationId: 'app-1', name: 'rntme-acme-notes-edge', dockerImage: 'nginx' });
      }
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await expect(client.updateApplication('app-1', renderedEdgeResource())).resolves.toMatchObject({
      id: 'app-1',
      name: 'rntme-acme-notes-edge',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('/api/application.one?applicationId=app-1');
  });

  it('creates, configures, and deploys Dokploy compose resources', async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'dokploy-token-secret'),
    };
    const client = createDokployClientFactory(cipher, async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      });
      if (url.endsWith('/api/project.all')) {
        return jsonResponse([
          {
            projectId: 'project-1',
            name: 'Project',
            environments: [
              { environmentId: 'env_default', name: 'default', applications: [], composes: [] },
            ],
          },
        ]);
      }
      if (url.endsWith('/api/compose.create')) {
        return jsonResponse({ composeId: 'compose-1', name: 'rntme-acme-commerce-event-bus' });
      }
      if (url.endsWith('/api/compose.update')) return jsonResponse(true);
      if (url.endsWith('/api/compose.one?composeId=compose-1')) {
        return jsonResponse({ composeId: 'compose-1', name: 'rntme-acme-commerce-event-bus' });
      }
      if (url.endsWith('/api/compose.saveEnvironment')) return jsonResponse({});
      if (url.endsWith('/api/compose.deploy')) return jsonResponse({});
      return jsonResponse({});
    })(target());

    const created = await client.createCompose('env_default', renderedComposeResource());
    await client.configureCompose(created.id, renderedComposeResource());
    await client.deployCompose(created.id);

    expect(calls.map((call) => call.url)).toContain('https://dokploy.example.com/api/compose.create');
    expect(calls.map((call) => call.url)).toContain('https://dokploy.example.com/api/compose.update');
    expect(calls.map((call) => call.url)).toContain('https://dokploy.example.com/api/compose.deploy');
    expect(calls.find((call) => call.url.endsWith('/api/compose.create'))?.body).toMatchObject({
      environmentId: 'env_default',
      name: 'rntme-acme-commerce-event-bus',
      composeType: 'docker-compose',
      composeFile: expect.stringContaining('redpanda'),
    });
  });

  it('runs the configure/deploy/start lifecycle against the e2e Dokploy mock', async () => {
    const mock = createMockDokployApp();
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, async (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
      return mock.app.request(url.href, init);
    })(target());

    const { environmentId } = await client.ensureEnvironment(
      { mode: 'existing', projectId: 'mock-project' },
      'production',
    );
    const created = await client.createApplication(environmentId, renderedEdgeResource());

    await expect(client.configureApplication(created.id, renderedEdgeResource())).resolves.toBeUndefined();
    await expect(client.deployApplication(created.id)).resolves.toBeUndefined();
    await expect(client.startApplication(created.id)).resolves.toBeUndefined();
  });

  it('updates the first matching file mount and deletes duplicate mounts for the same mountPath', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: FetchInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).includes('/api/mounts.listByServiceId')) {
        return jsonResponse([
          { mountId: 'mount-1', mountPath: '/etc/nginx/nginx.conf', filePath: '/old/nginx.conf' },
          { mountId: 'mount-2', mountPath: '/etc/nginx/nginx.conf', filePath: '/stale/nginx.conf' },
        ]);
      }
      if (String(url).includes('/api/domain.byApplicationId')) return jsonResponse([]);
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await client.configureApplication('app-1', renderedEdgeResource());

    const paths = calls.map((call) => new URL(call.url).pathname);
    expect(paths).toContain('/api/mounts.update');
    expect(paths).toContain('/api/mounts.remove');
    const updateCall = calls.find((call) => new URL(call.url).pathname === '/api/mounts.update');
    expect(updateCall?.body).toMatchObject({
      mountId: 'mount-1',
      mountPath: '/etc/nginx/nginx.conf',
      filePath: '/etc/dokploy/rntme/app-1/1652e2a03ff06855-etc_nginx_nginx.conf',
      content: 'events {}',
    });
    const deleteCall = calls.find((call) => new URL(call.url).pathname === '/api/mounts.remove');
    expect(deleteCall?.body).toEqual({ mountId: 'mount-2' });
  });

  it('inspects application status after deploy/start', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/api/application.one')) {
        return jsonResponse({
          applicationId: 'app-1',
          name: 'rntme-acme-notes-edge',
          applicationStatus: 'rejected',
          lastDeploymentStatus: 'error',
          statusMessage: 'invalid mount config for type "bind": bind source path does not exist',
        });
      }
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target());
    await expect(client.inspectApplication?.('app-1')).resolves.toEqual({
      status: 'rejected',
      message: 'invalid mount config for type "bind": bind source path does not exist',
    });
  });

  it('mounts resolved secret files for operaton-ui-basic-auth-v1 htpasswd field', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: FetchInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).includes('/api/mounts.listByServiceId')) return jsonResponse([]);
      if (String(url).includes('/api/domain.byApplicationId')) return jsonResponse([]);
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target(), {
      'operaton-ui-basic-auth-v1': { htpasswd: 'admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/' },
    });
    const resource = renderedEdgeResource();
    const resourceWithSecret = {
      ...resource,
      secretFiles: {
        '/etc/nginx/.htpasswd': { secretRef: 'operaton-ui-basic-auth-v1', schema: 'basic-auth-v1', field: 'htpasswd' },
      },
    };
    await client.configureApplication('app-1', resourceWithSecret);

    const mountCreate = calls.find(
      (call) =>
        new URL(call.url).pathname === '/api/mounts.create' &&
        (call.body as Record<string, unknown>)?.mountPath === '/etc/nginx/.htpasswd',
    );
    expect(mountCreate?.body).toMatchObject({
      type: 'file',
      serviceType: 'application',
      serviceId: 'app-1',
      mountPath: '/etc/nginx/.htpasswd',
      content: 'admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/',
    });
  });

  it('mounts resolved secret files for operaton-admin-user-v1 applicationYaml field', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const calls: { url: string; body: unknown }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: FetchInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(url).includes('/api/mounts.listByServiceId')) return jsonResponse([]);
      if (String(url).includes('/api/domain.byApplicationId')) return jsonResponse([]);
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target(), {
      'operaton-admin-user-v1': { id: 'demo', password: 'demo' },
    });
    const resource = renderedEdgeResource();
    const resourceWithSecret = {
      ...resource,
      secretFiles: {
        '/srv/operaton-config/application.yml': { secretRef: 'operaton-admin-user-v1', schema: 'operaton-admin-user-v1', field: 'applicationYaml' },
      },
    };
    await client.configureApplication('app-1', resourceWithSecret);

    const mountCreate = calls.find(
      (call) =>
        new URL(call.url).pathname === '/api/mounts.create' &&
        (call.body as Record<string, unknown>)?.mountPath === '/srv/operaton-config/application.yml',
    );
    expect(mountCreate?.body).toMatchObject({
      type: 'file',
      serviceType: 'application',
      serviceId: 'app-1',
      mountPath: '/srv/operaton-config/application.yml',
      content: 'operaton:\n  bpm:\n    admin-user:\n      id: "demo"\n      password: "demo"\n',
    });
  });

  it('throws DEPLOY_TARGET_SECRET_REF_UNRESOLVED when secret is missing', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: FetchInit) => {
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target(), {});
    const resource = renderedEdgeResource();
    const resourceWithSecret = {
      ...resource,
      secretFiles: {
        '/etc/nginx/.htpasswd': { secretName: 'operaton-ui-basic-auth-v1', field: 'htpasswd' },
      },
    };
    await expect(client.configureApplication('app-1', resourceWithSecret)).rejects.toThrow(
      /DEPLOY_TARGET_SECRET_REF_UNRESOLVED/,
    );
  });

  it('throws DEPLOY_TARGET_SECRET_REF_UNRESOLVED when secret field is missing', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: FetchInit) => {
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target(), {
      'operaton-ui-basic-auth-v1': {},
    });
    const resource = renderedEdgeResource();
    const resourceWithSecret = {
      ...resource,
      secretFiles: {
        '/etc/nginx/.htpasswd': { secretName: 'operaton-ui-basic-auth-v1', field: 'htpasswd' },
      },
    };
    await expect(client.configureApplication('app-1', resourceWithSecret)).rejects.toThrow(
      /DEPLOY_TARGET_SECRET_REF_UNRESOLVED/,
    );
  });

  it('does not leak secret values in error messages', async () => {
    type FetchInit = Parameters<typeof globalThis.fetch>[1];
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: FetchInit) => {
      return jsonResponse({});
    });
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => 'plain-token'),
    };

    const client = createDokployClientFactory(cipher, fetcher as typeof globalThis.fetch)(target(), {});
    const resource = renderedEdgeResource();
    const resourceWithSecret = {
      ...resource,
      secretFiles: {
        '/etc/nginx/.htpasswd': { secretName: 'operaton-ui-basic-auth-v1', field: 'htpasswd' },
      },
    };
    await expect(client.configureApplication('app-1', resourceWithSecret)).rejects.toThrow();
    try {
      await client.configureApplication('app-1', resourceWithSecret);
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).not.toContain('admin');
      expect(error instanceof Error ? error.message : String(error)).not.toContain('password');
    }
  });

  it('throws a redacted decrypt failure', () => {
    const cipher: SecretCipher = {
      encrypt: vi.fn(),
      decrypt: vi.fn(() => {
        throw new Error('bad token secret');
      }),
    };

    expect(() => createDokployClientFactory(cipher, vi.fn() as typeof globalThis.fetch)(target())).toThrow(
      /DEPLOY_TARGET_TOKEN_DECRYPT_FAILED/,
    );
  });
});

function target(): DeployTargetWithSecret {
  return {
    id: 'target-1',
    orgId: '11111111-1111-4111-8111-111111111111',
    slug: 'staging',
    displayName: 'Staging',
    kind: 'dokploy',
    dokployUrl: 'https://dokploy.example.com/api/',
    publicBaseUrl: 'https://notes.example.com',
    dokployProjectId: 'project-1',
    dokployProjectName: null,
    allowCreateProject: false,
    eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
    modules: {},
    workflows: null,
    auth: {},
    policyValues: {},
    isDefault: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    apiTokenCiphertext: Buffer.from('ciphertext'),
    apiTokenNonce: Buffer.from('nonce'),
    apiTokenKeyVersion: 1,
  };
}

function renderedEdgeResource(): Extract<RenderedDokployResource, { kind: 'application' }> {
  return {
    logicalId: 'edge',
    kind: 'application',
    workloadKind: 'edge-gateway',
    workloadSlug: 'edge',
    name: 'rntme-acme-notes-edge',
    image: 'nginx:1.27-alpine',
    env: [],
    labels: { 'rntme.workload': 'edge' },
    ports: [{ containerPort: 8080, protocol: 'http' }],
    ingress: {
      publicBaseUrl: 'https://notes.example.com',
      containerPort: 8080,
      healthPath: '/health',
      routes: [{ routeId: 'ui:/', path: '/', url: 'https://notes.example.com/' }],
    },
    files: { '/etc/nginx/nginx.conf': 'events {}' },
  };
}

function renderedDomainResource(): Extract<RenderedDokployResource, { kind: 'application' }> {
  return {
    logicalId: 'app',
    kind: 'application',
    workloadKind: 'domain-service',
    workloadSlug: 'app',
    name: 'rntme-acme-notes-app',
    image: 'rntme-acme-notes-app:artifact',
    build: {
      kind: 'domain-service-artifact',
      baseImage: 'ghcr.io/vladprrs/rntme-runtime:1.0',
      image: 'rntme-acme-notes-app:artifact',
      artifact: { source: 'composed-project', serviceSlug: 'app' },
      context: { kind: 'generated', serviceSlug: 'app', files: ['Dockerfile'] },
    },
    env: [{ name: 'RNTME_PERSISTENCE_MODE', value: 'ephemeral', secret: false }],
    labels: { 'rntme.workload': 'app' },
  };
}

function renderedComposeResource(): Extract<RenderedDokployResource, { kind: 'compose' }> {
  return {
    logicalId: 'event-bus',
    kind: 'compose',
    infrastructureKind: 'event-bus',
    name: 'rntme-acme-commerce-event-bus',
    image: 'docker.redpanda.com/redpandadata/redpanda:v24.3.6',
    composeFile: 'services:\n  redpanda:\n    image: docker.redpanda.com/redpandadata/redpanda:v24.3.6\n',
    env: [],
    labels: { 'rntme.infrastructure': 'event-bus' },
  };
}

function emptyResponse(): Response {
  return new globalThis.Response('', { status: 200 });
}

function jsonResponse(body: unknown): Response {
  return new globalThis.Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, body: unknown): Response {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
