import { describe, expect, it } from 'vitest';
import {
  CreateDeployTargetRequestSchema,
  RotateApiTokenRequestSchema,
  UpdateDeployTargetRequestSchema,
} from '../../../src/schemas/deploy-target.js';

describe('CreateDeployTargetRequestSchema', () => {
  it('accepts a well-formed payload', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-staging',
      displayName: 'Staging',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      publicBaseUrl: 'https://notes.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
  });

  it('allows omitting public app base URL on create for wildcard-derived deploy URLs', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-staging',
      displayName: 'Staging',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
  });

  it('preserves Auth0 target vars on create', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-staging',
      displayName: 'Staging',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      publicBaseUrl: 'https://notes.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
      auth: {
        auth0: {
          clientId: 'public-client-id',
          domain: 'demo-rntme.us.auth0.com',
          audience: 'https://notes-demo.rntme.com/api',
          redirectUri: 'https://notes-demo.rntme.com/',
        },
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.auth.auth0).toEqual({
        clientId: 'public-client-id',
        domain: 'demo-rntme.us.auth0.com',
        audience: 'https://notes-demo.rntme.com/api',
        redirectUri: 'https://notes-demo.rntme.com/',
      });
    }
  });

  it('preserves workflow target config on create', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-workflows',
      displayName: 'Workflow Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { workflows?: unknown }).workflows).toEqual({
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      });
    }
  });

  it('defaults omitted workflow target config to null on create', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-staging',
      displayName: 'Staging',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as { workflows?: unknown }).workflows).toBeNull();
  });

  it('preserves provisioned RustFS storage config on create', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-storage',
      displayName: 'Storage Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      publicBaseUrl: 'https://notes.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      storage: {
        mode: 'provisioned',
        provider: 'rustfs',
        image: 'rustfs/rustfs:1.0.0',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.storage).toEqual({
        mode: 'provisioned',
        provider: 'rustfs',
        image: 'rustfs/rustfs:1.0.0',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      });
    }
  });

  it('defaults omitted storage config to external on create', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-staging',
      displayName: 'Staging',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.storage).toEqual({ mode: 'external' });
  });

  it('preserves provisioned RustFS storage config on patch and allows external', () => {
    const enabled = UpdateDeployTargetRequestSchema.parse({
      storage: {
        mode: 'provisioned',
        provider: 'rustfs',
        publicBaseUrl: 'https://storage.example.test',
        accessKeyRef: 'RUSTFS_ACCESS_KEY',
        secretKeyRef: 'RUSTFS_SECRET_KEY',
      },
    });
    expect(enabled.storage).toEqual({
      mode: 'provisioned',
      provider: 'rustfs',
      publicBaseUrl: 'https://storage.example.test',
      accessKeyRef: 'RUSTFS_ACCESS_KEY',
      secretKeyRef: 'RUSTFS_SECRET_KEY',
    });

    const external = UpdateDeployTargetRequestSchema.parse({ storage: { mode: 'external' } });
    expect(external.storage).toEqual({ mode: 'external' });
  });

  it('rejects invalid provisioned RustFS storage config', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-storage',
      displayName: 'Storage Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', brokers: ['redpanda:9092'] },
      storage: {
        mode: 'provisioned',
        provider: 'minio',
        publicBaseUrl: 'ftp://storage.example.test',
        accessKeyRef: '',
        secretKeyRef: '',
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(false);
  });

  it('leaves omitted policyValues undefined on patch', () => {
    const r = UpdateDeployTargetRequestSchema.parse({ displayName: 'Renamed' });
    expect(r).toEqual({ displayName: 'Renamed' });
    expect(r.policyValues).toBeUndefined();
  });

  it('preserves Auth0 target vars on patch', () => {
    const r = UpdateDeployTargetRequestSchema.parse({
      auth: {
        auth0: {
          clientId: 'public-client-id',
          domain: 'demo-rntme.us.auth0.com',
          audience: 'https://notes-demo.rntme.com/api',
          redirectUri: 'https://notes-demo.rntme.com/',
        },
      },
    });
    expect(r.auth?.auth0).toEqual({
      clientId: 'public-client-id',
      domain: 'demo-rntme.us.auth0.com',
      audience: 'https://notes-demo.rntme.com/api',
      redirectUri: 'https://notes-demo.rntme.com/',
    });
  });

  it('preserves workflow target config on patch and allows clearing it', () => {
    const enabled = UpdateDeployTargetRequestSchema.parse({
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      },
    });
    expect((enabled as { workflows?: unknown }).workflows).toEqual({
      engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
      worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
    });

    const cleared = UpdateDeployTargetRequestSchema.parse({ workflows: null });
    expect((cleared as { workflows?: unknown }).workflows).toBeNull();
  });

  it('rejects invalid workflow target config', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-workflows',
      displayName: 'Workflow Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'zeebe', mode: 'provisioned', image: 'zeebe:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(false);
  });

  it('preserves operatonUi access config on create', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-workflows',
      displayName: 'Workflow Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
        operatonUi: {
          enabled: true,
          publicBaseUrl: 'https://operaton.example.test',
          auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' },
        },
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { workflows?: unknown }).workflows).toEqual({
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
        operatonUi: {
          enabled: true,
          publicBaseUrl: 'https://operaton.example.test',
          auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' },
        },
      });
    }
  });

  it('preserves adminUserSecretRef on create', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-workflows',
      displayName: 'Workflow Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test', adminUserSecretRef: 'operaton-admin-user-v1' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { workflows?: unknown }).workflows).toEqual({
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test', adminUserSecretRef: 'operaton-admin-user-v1' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
      });
    }
  });

  it('rejects operatonUi with missing fields', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-workflows',
      displayName: 'Workflow Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
        operatonUi: {
          enabled: true,
          publicBaseUrl: 'not-a-url',
          auth: { kind: 'basic', secretRef: 'operaton-ui-basic-auth-v1' },
        },
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(false);
  });

  it('rejects operatonUi with non-basic auth kind', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'dokploy-workflows',
      displayName: 'Workflow Target',
      kind: 'dokploy',
      dokployUrl: 'https://dok.example.test',
      dokployProjectId: 'abc-123',
      apiToken: 'dkp_supersecret',
      eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      workflows: {
        engine: { kind: 'operaton', mode: 'provisioned', image: 'operaton/operaton:test' },
        worker: { image: 'ghcr.io/rntme/bpmn-worker:test' },
        operatonUi: {
          enabled: true,
          publicBaseUrl: 'https://operaton.example.test',
          auth: { kind: 'oauth', secretRef: 'operaton-ui-basic-auth-v1' },
        },
      },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-http Auth0 redirect URI', () => {
    const r = UpdateDeployTargetRequestSchema.safeParse({
      auth: {
        auth0: {
          clientId: 'public-client-id',
          redirectUri: 'capacitor://notes-demo/callback',
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('accepts public app base URL patches', () => {
    const r = UpdateDeployTargetRequestSchema.safeParse({
      publicBaseUrl: 'https://notes.example.test',
    });
    expect(r.success).toBe(true);
  });

  it('rejects non-http public app base URLs', () => {
    const r = UpdateDeployTargetRequestSchema.safeParse({
      publicBaseUrl: 'ftp://notes.example.test',
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing apiToken', () => {
    const r = CreateDeployTargetRequestSchema.safeParse({
      slug: 'x',
      displayName: 'X',
      kind: 'dokploy',
      dokployUrl: 'https://x.example.test',
      publicBaseUrl: 'https://x-app.example.test',
      eventBus: { kind: 'kafka', brokers: [] },
      policyValues: {},
      isDefault: false,
    });
    expect(r.success).toBe(false);
  });

  it('forbids apiToken in update payload', () => {
    const r = UpdateDeployTargetRequestSchema.safeParse({ apiToken: 'leak' });
    expect(r.success).toBe(false);
  });

  it('requires apiToken in rotate payload', () => {
    expect(RotateApiTokenRequestSchema.safeParse({}).success).toBe(false);
    expect(RotateApiTokenRequestSchema.safeParse({ apiToken: 'dkp_new' }).success).toBe(true);
  });
});
