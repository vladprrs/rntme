/**
 * Gated live CV-extract deploy smoke test.
 *
 * This test publishes the demo bundle to a live platform, starts a deployment,
 * waits for it to become "running", and then drives the application-level
 * smoke flow against the deployed app. It only runs when ALL of the required
 * environment variables are set; otherwise it skips cleanly.
 *
 * Required env vars (any missing -> the test SKIPS):
 *   RNTME_LIVE_DEPLOY
 *   RNTME_PLATFORM_URL
 *   RNTME_PLATFORM_TOKEN
 *   RNTME_ORG
 *   RNTME_PROJECT
 *   RNTME_TARGET
 *   RNTME_CV_BASE_URL
 *   OPENROUTER_API_KEY
 *   RNTME_OPENROUTER_IMAGE
 *   RNTME_STORAGE_S3_IMAGE
 *
 * IMPORTANT: imports must be kept minimal at module load time so that
 * `describe.skipIf(...)` triggers BEFORE any heavy CLI/build dependencies
 * are resolved. Heavy work (bundle build, fetch calls) happens lazily inside
 * the test body via dynamic imports.
 */

import { describe, expect, it } from 'bun:test';

const REQUIRED_ENV = [
  'RNTME_LIVE_DEPLOY',
  'RNTME_PLATFORM_URL',
  'RNTME_PLATFORM_TOKEN',
  'RNTME_ORG',
  'RNTME_PROJECT',
  'RNTME_TARGET',
  'RNTME_CV_BASE_URL',
  'OPENROUTER_API_KEY',
  'RNTME_OPENROUTER_IMAGE',
  'RNTME_STORAGE_S3_IMAGE',
] as const;

const ENABLED = REQUIRED_ENV.every((key) => {
  const v = process.env[key];
  return typeof v === 'string' && v.length > 0;
});

describe.skipIf(!ENABLED)('cv-extract live platform-client deploy smoke', () => {
  it(
    'configures target, publishes bundle, starts deploy, waits running, and drives smoke flow',
    async () => {
      // All env values are guaranteed non-empty here.
      const platformUrl = process.env.RNTME_PLATFORM_URL!.replace(/\/+$/, '');
      const platformToken = process.env.RNTME_PLATFORM_TOKEN!;
      const organizationId = process.env.RNTME_ORG!;
      const projectId = process.env.RNTME_PROJECT!;
      const targetSlug = process.env.RNTME_TARGET!;
      const cvBaseUrl = process.env.RNTME_CV_BASE_URL!.replace(/\/+$/, '');
      const openrouterImage = process.env.RNTME_OPENROUTER_IMAGE!;
      const storageS3Image = process.env.RNTME_STORAGE_S3_IMAGE!;

      // Live target config per plan Task 8.
      const targetConfig = {
        modules: {
          openrouter: {
            image: openrouterImage,
            secretRefs: { OPENROUTER_API_KEY: 'openrouter-api-key' },
          },
          'storage-s3': {
            image: storageS3Image,
          },
          'marketing-site': {
            primaryDomain: 'cv.example.com',
            ssl: 'auto',
          },
        },
        storage: {
          mode: 'provisioned',
          provider: 'rustfs',
          publicBaseUrl: 'https://files.example.com',
          accessKeyRef: 'rustfs-access-key',
          secretKeyRef: 'rustfs-secret-key',
        },
      };

      // --- Minimal HTTP helpers (inlined to keep skipIf cheap). ---
      const authHeaders = (extra?: Record<string, string>): Record<string, string> => ({
        Authorization: `Bearer ${platformToken}`,
        ...(extra ?? {}),
      });

      async function platformPostJson(path: string, body: unknown): Promise<unknown> {
        const res = await fetch(`${platformUrl}${path}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`POST ${path} -> ${res.status}: ${text}`);
        }
        return await res.json();
      }

      async function platformGetJson(path: string): Promise<unknown> {
        const res = await fetch(`${platformUrl}${path}`, {
          method: 'GET',
          headers: authHeaders(),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`GET ${path} -> ${res.status}: ${text}`);
        }
        return await res.json();
      }

      async function platformPostBundle(path: string, bytes: Uint8Array): Promise<unknown> {
        const res = await fetch(`${platformUrl}${path}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/rntme-project-bundle+json' }),
          body: bytes as BodyInit,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`POST ${path} -> ${res.status}: ${text}`);
        }
        return await res.json();
      }

      // --- 1. Upsert target config. ---
      // Try update first; if it does not exist, create it.
      const updatePath = `/api/deployments/targets/${encodeURIComponent(targetSlug)}/actions/update`;
      const createPath = `/api/deployments/targets`;
      const updateBody = { organizationId, ...targetConfig };

      const updateRes = await fetch(`${platformUrl}${updatePath}`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updateBody),
      });
      if (!updateRes.ok) {
        // Fall back to create.
        const createBody = { organizationId, slug: targetSlug, ...targetConfig };
        await platformPostJson(createPath, createBody);
      }

      // --- 2. Build the bundle (lazy import to avoid module-load cost when skipped). ---
      const buildMod: { buildProjectBundle: (dir: string) => Promise<{
        ok: boolean;
        value: { bytes: Uint8Array };
        error?: unknown;
      }> } = (await import('../../../../apps/cli/src/bundle/build.js')) as unknown as {
        buildProjectBundle: (dir: string) => Promise<{
          ok: boolean;
          value: { bytes: Uint8Array };
          error?: unknown;
        }>;
      };
      const projectDir = new URL('../..', import.meta.url).pathname;
      const built = await buildMod.buildProjectBundle(projectDir);
      if (!built.ok) {
        throw new Error(`bundle build failed: ${JSON.stringify(built.error)}`);
      }

      // --- 3. Publish bundle bytes. ---
      const publishPath = `/api/projects/${encodeURIComponent(projectId)}/versions`;
      const published = (await platformPostBundle(publishPath, built.value.bytes)) as {
        version: { seq: number };
      };
      expect(published.version.seq).toBeGreaterThan(0);
      const projectVersionSeq = published.version.seq;

      // --- 4. Start a deployment. ---
      const queued = (await platformPostJson('/api/deployments', {
        organizationId,
        projectId,
        projectVersionSeq,
        targetSlug,
        configOverrides: {},
      })) as { deployment: { id: string; status: string } };
      expect(queued.deployment.id).toBeTruthy();
      const deploymentId = queued.deployment.id;

      // --- 5. Poll deployment until it leaves "queued"/"running" state and becomes ready. ---
      // We tolerate either "succeeded" or "running" as a terminal-enough signal
      // for the smoke flow, since target readiness can lag the deployment row.
      const deadline = Date.now() + 15 * 60_000; // 15 minutes
      let lastStatus = queued.deployment.status;
      while (Date.now() < deadline) {
        const shown = (await platformGetJson(
          `/api/deployments/${encodeURIComponent(deploymentId)}`,
        )) as { deployment: { status: string } };
        lastStatus = shown.deployment.status;
        if (lastStatus === 'succeeded') break;
        if (lastStatus === 'failed' || lastStatus === 'errored') {
          throw new Error(`deployment ${deploymentId} ended in status ${lastStatus}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
      expect(['succeeded', 'running']).toContain(lastStatus);

      // --- 6. Drive the smoke flow against the deployed CV base URL. ---
      const smokeMod: typeof import('../../scripts/smoke-cv-extract.js') = (await import(
        '../../scripts/smoke-cv-extract.js'
      )) as typeof import('../../scripts/smoke-cv-extract.js');
      const smoke = await smokeMod.runSmoke({ baseUrl: cvBaseUrl });
      const extractedJson = smoke.resume.extractedJson;
      const downloadUrl = smoke.resume.downloadUrl;
      const fileId = smoke.resume.fileId;
      expect(typeof extractedJson).toBe('string');
      expect(extractedJson.length).toBeGreaterThan(0);
      expect(typeof downloadUrl).toBe('string');
      expect(downloadUrl.length).toBeGreaterThan(0);
      expect(typeof fileId).toBe('string');
      expect(fileId.length).toBeGreaterThan(0);
    },
    /* timeout */ 30 * 60_000,
  );
});
