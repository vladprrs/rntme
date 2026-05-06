import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteDokployResources, type DokployDeleteResource } from '@rntme/deploy-dokploy';
import { isOk } from '@rntme/platform-core';
import { createDokployClientFactory } from '../../src/deploy/dokploy-client-factory.js';
import { runDeployment } from '../../src/deploy/executor.js';
import { SmokeVerifier } from '../../src/deploy/smoke-verifier.js';
import { resolveDeps } from '../../src/resolve-deps.js';
import { bootE2e, type E2eEnv } from './harness.js';
import { readLiveDokployEnv } from './live-dokploy-env.js';
import { buildProjectBundleForE2e } from './project-bundle-helper.js';
import { seedOrgWithToken } from './seed-auth-helper.js';

const live = readLiveDokployEnv();

describe.skipIf(!live.enabled)(`live Dokploy order fulfillment${live.enabled ? '' : ` (${live.reason})`}`, () => {
  let env: E2eEnv;

  beforeAll(async () => {
    env = await bootE2e();
  }, 300_000);

  afterAll(async () => {
    await env.teardown();
  });

  it('deploys Operaton and demo services, then proves confirmed and cancelled branches', async () => {
    if (!live.enabled) throw new Error(live.reason);
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
    const orgSlug = `bpmn-e2e-${suffix}`;
    const projectSlug = `order-${suffix}`;
    const auth = await seedOrgWithToken(env, orgSlug, `bpmn_org_${suffix}`, `bpmn_user_${suffix}`);
    let deploymentId: string | null = null;

    try {
      await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/projects`, {
        method: 'POST',
        headers: jsonAuth(auth.plain),
        body: JSON.stringify({ slug: projectSlug, displayName: 'Order Fulfillment E2E' }),
      }), 201);

      const bundle = buildProjectBundleForE2e(fileURLToPath(new URL('../../../../demo/order-fulfillment-blueprint', import.meta.url)));
      const published = await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/projects/${projectSlug}/versions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/rntme-project-bundle+json',
          authorization: `Bearer ${auth.plain}`,
        },
        body: bundle.bytes,
      }), 201);
      const publishedJson = await published.json() as { version: { bundleBlobKey: string } };
      const stored = await env.deps.blob.getRaw(publishedJson.version.bundleBlobKey);
      expect(isOk(stored)).toBe(true);
      if (isOk(stored)) expect(gunzipSync(stored.value).toString('utf8')).toBe(bundle.bytes);

      await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/deploy-targets`, {
        method: 'POST',
        headers: jsonAuth(auth.plain),
        body: JSON.stringify({
          slug: 'live',
          displayName: 'Live Dokploy',
          kind: 'dokploy',
          dokployUrl: live.dokployUrl,
          dokployProjectId: live.dokployProjectId,
          allowCreateProject: false,
          apiToken: live.dokployApiToken,
          eventBus: {
            kind: 'kafka',
            mode: 'provisioned',
            provider: 'redpanda',
            ...(live.redpandaImage === undefined ? {} : { image: live.redpandaImage }),
            topicPrefix: `rntme.${suffix}`,
          },
          workflows: {
            engine: { kind: 'operaton', mode: 'provisioned', image: live.operatonImage },
            worker: { image: live.bpmnWorkerImage },
          },
          modules: {},
          auth: {},
          policyValues: { requestContext: { default: {} } },
          isDefault: true,
        }),
      }), 201);

      const queued = await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/projects/${projectSlug}/deployments`, {
        method: 'POST',
        headers: jsonAuth(auth.plain),
        body: JSON.stringify({
          projectVersionSeq: 1,
          targetSlug: 'live',
          configOverrides: {
            runtimeImage: live.runtimeImage,
            policyOverrides: { requestContext: { default: {} } },
          },
        }),
      }), 202);
      deploymentId = ((await queued.json()) as { deployment: { id: string } }).deployment.id;

      await runDeployment(deploymentId, auth.orgId, deploymentDeps(env, orgSlug, live.publicDeployDomain));

      const show = await expectStatus(env.app.request(`/v1/orgs/${orgSlug}/projects/${projectSlug}/deployments/${deploymentId}`, {
        headers: { authorization: `Bearer ${auth.plain}` },
      }), 200);
      const showJson = await show.json() as { deployment: { status: string; applyResult: { resources?: unknown[] } | null } };
      expect(showJson.deployment.status, JSON.stringify(showJson.deployment)).toBe('succeeded');
      expect(showJson.deployment.applyResult?.resources).toEqual(expect.arrayContaining([
        expect.objectContaining({ infrastructureKind: 'event-bus' }),
        expect.objectContaining({ infrastructureKind: 'workflow-engine' }),
        expect.objectContaining({ kind: 'bpmn-worker' }),
        expect.objectContaining({ workloadSlug: 'orders' }),
        expect.objectContaining({ workloadSlug: 'inventory' }),
        expect.objectContaining({ workloadSlug: 'edge' }),
      ]));

      const baseUrl = `https://${orgSlug}-${projectSlug}-default.${live.publicDeployDomain}`;
      const confirmed = await placeOrder(baseUrl, { sku: 'sku-ok', quantity: 1 });
      await waitForOrder(baseUrl, confirmed.aggregateId, (order) =>
        order.status === 'confirmed' && typeof order.reservationId === 'string',
      );

      const cancelled = await placeOrder(baseUrl, { sku: 'missing-stock', quantity: 1 });
      await waitForOrder(baseUrl, cancelled.aggregateId, (order) =>
        order.status === 'cancelled' && order.cancelReason === 'insufficient stock',
      );
    } finally {
      if (deploymentId !== null) await cleanupDeploymentResources(env, auth.orgId, deploymentId);
    }
  }, live.enabled ? live.httpTimeoutMs + 300_000 : 10_000);
});

function jsonAuth(token: string): Record<string, string> {
  return { 'content-type': 'application/json', authorization: `Bearer ${token}` };
}

async function expectStatus(responsePromise: Promise<Response> | Response, status: number): Promise<Response> {
  const response = await responsePromise;
  expect(response.status, await response.clone().text()).toBe(status);
  return response;
}

function deploymentDeps(
  env: E2eEnv,
  orgSlug: string,
  publicDeployDomain: string,
): Parameters<typeof runDeployment>[2] {
  return {
    blob: env.deps.blob,
    withOrgTx: async <T>(orgId: string, fn: (repos: ReturnType<typeof resolveDeps>) => Promise<T>) => {
      const client = await env.deps.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
        const result = await fn(resolveDeps(client));
        await client.query('COMMIT');
        return result;
      } catch (cause) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw cause;
      } finally {
        client.release();
      }
    },
    orgSlugFor: async () => orgSlug,
    dokployClientFactory: createDokployClientFactory(env.deps.cipher!),
    smoker: new SmokeVerifier(fetchSmoke),
    logger: env.deps.logger,
    publicDeployDomain,
    resolveProvisioner: async () => {
      throw new Error('live order-fulfillment demo does not declare provisioner modules');
    },
    targetSecretsRepoFor: async () => ({
      list: async () => [],
      upsert: async () => undefined,
      remove: async () => undefined,
      getAllDecrypted: async () => ({}),
    }),
    secretCipher: env.deps.cipher!,
    lastSuccessfulProvisionOutputs: async () => ({}),
  };
}

async function fetchSmoke(url: string): Promise<{ status: number | 'error'; latencyMs: number; contentType?: string; body?: string }> {
  const started = Date.now();
  try {
    const response = await globalThis.fetch(url);
    return {
      status: response.status,
      latencyMs: Date.now() - started,
      ...(response.headers.get('content-type') === null ? {} : { contentType: response.headers.get('content-type')! }),
      body: await response.text(),
    };
  } catch (cause) {
    return { status: 'error', latencyMs: Date.now() - started, body: String(cause) };
  }
}

type CommandResult = { readonly aggregateId: string };
type OrderView = {
  readonly id: string;
  readonly sku: string;
  readonly quantity: number;
  readonly reservationId?: string | null;
  readonly cancelReason?: string | null;
  readonly status: string;
};

async function placeOrder(baseUrl: string, input: { sku: string; quantity: number }): Promise<CommandResult> {
  const response = await globalThis.fetch(`${baseUrl}/api/orders/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  expect(response.status, await response.clone().text()).toBe(200);
  const body = await response.json() as Partial<CommandResult>;
  if (typeof body.aggregateId !== 'string' || body.aggregateId === '') {
    throw new Error(`PLACE_ORDER_RESPONSE_INVALID: ${JSON.stringify(body)}`);
  }
  return { aggregateId: body.aggregateId };
}

async function waitForOrder(
  baseUrl: string,
  orderId: string,
  predicate: (order: OrderView) => boolean,
): Promise<OrderView> {
  const deadline = Date.now() + 180_000;
  let last: unknown;
  while (Date.now() < deadline) {
    const response = await globalThis.fetch(`${baseUrl}/api/orders/orders/${encodeURIComponent(orderId)}`);
    if (response.status === 200) {
      last = await response.json();
      const order = Array.isArray(last) ? last[0] : last;
      if (order && typeof order === 'object' && predicate(order as OrderView)) return order as OrderView;
    } else {
      last = await response.text();
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`ORDER_STATE_TIMEOUT: ${orderId}: ${JSON.stringify(last)}`);
}

async function cleanupDeploymentResources(env: E2eEnv, orgId: string, deploymentId: string): Promise<void> {
  const targetAndResources = await withOrgTx(env, orgId, async (repos) => {
    const deployment = await repos.deployments.getById(deploymentId);
    if (!deployment.ok || deployment.value === null || deployment.value.applyResult === null) return null;
    const target = await repos.deployTargets.getWithSecretById(deployment.value.targetId);
    if (!target.ok || target.value === null) return null;
    const resources = Array.isArray(deployment.value.applyResult.resources)
      ? deployment.value.applyResult.resources.filter(isDeleteResource)
      : [];
    return { target: target.value, resources };
  });
  if (targetAndResources === null || targetAndResources.resources.length === 0) return;
  const result = await deleteDokployResources(
    targetAndResources.resources,
    createDokployClientFactory(env.deps.cipher!)(targetAndResources.target),
  );
  if (!result.ok) throw new Error(`DOKPLOY_E2E_CLEANUP_FAILED: ${JSON.stringify(result.errors)}`);
}

async function withOrgTx<T>(
  env: E2eEnv,
  orgId: string,
  fn: (repos: ReturnType<typeof resolveDeps>) => Promise<T>,
): Promise<T> {
  const client = await env.deps.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
    const result = await fn(resolveDeps(client));
    await client.query('COMMIT');
    return result;
  } catch (cause) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}

function isDeleteResource(value: unknown): value is DokployDeleteResource {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.resourceKind === 'application' || candidate.resourceKind === 'compose') &&
    typeof candidate.targetResourceId === 'string' &&
    typeof candidate.targetResourceName === 'string'
  );
}
