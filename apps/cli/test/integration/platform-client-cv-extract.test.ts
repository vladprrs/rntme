import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProjectBundle } from '../../src/bundle/build.js';
import { endpoints } from '../../src/api/endpoints.js';
import { createFakePlatform } from '../fixtures/fake-platform.js';

const DEMO_CV_EXTRACT = resolve(
  fileURLToPath(import.meta.url),
  '../../../../../demo/cv-extract-blueprint',
);

const BASE = 'https://fake.platform';
const PAT = 'rntme_pat_cv_extract_e2e_xxxxxxxxxxxxxxxxxxxx';
const PROJECT_ID = 'cv-extract';
const DEPLOYMENT_ID = '99999999-9999-4999-8999-999999999999';

const fake = createFakePlatform({
  baseUrl: BASE,
  projectIdOrSlug: PROJECT_ID,
  deploymentId: DEPLOYMENT_ID,
});

beforeAll(() => fake.server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  fake.reset();
  fake.server.resetHandlers();
});
afterAll(() => fake.server.close());

describe('platform-client cv-extract: build -> publish -> deploy -> poll', () => {
  it(
    'builds the cv-extract bundle, posts raw bytes, starts a deployment, and polls deployment + logs',
    async () => {
      // 1. Build the cv-extract bundle through the CLI.
      const built = await buildProjectBundle(DEMO_CV_EXTRACT);
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      expect(built.value.bundle.version).toBe(2);

      // Sanity: the bundle we'll send must include the marketing project-folder
      // asset and the expected project.json shape so the fake platform's
      // assertions can run.
      const marketingAssetKeys = Object.keys(built.value.bundle.assets).filter(
        (k) => k.startsWith('assets/project-folders/marketing/') && k.endsWith('.tar.gz'),
      );
      expect(marketingAssetKeys.length).toBe(1);

      const projectJson = built.value.bundle.files['project.json'] as {
        services: string[];
        modules: Record<string, unknown>;
      };
      expect(projectJson.services).toEqual(['app', 'openrouter', 'storage-s3']);
      expect(Object.keys(projectJson.modules).sort()).toEqual(
        ['marketing', 'openrouter', 'storage'].sort(),
      );

      // 2. POST raw bundle bytes to the platform publish endpoint.
      const apiCtx = { baseUrl: BASE, token: PAT };
      const published = await endpoints.projectVersions.publishBundle(
        apiCtx,
        PROJECT_ID,
        built.value.bytes,
      );

      expect(published.ok, published.ok ? '' : JSON.stringify(published.error)).toBe(true);
      if (!published.ok) return;
      expect(published.value.version.seq).toBe(1);

      // The fake platform's publish assertions must all have fired.
      const assertions = fake.publishAssertions();
      expect(assertions.assertedBundleVersionTwo).toBe(true);
      expect(assertions.assertedMarketingAsset).toBe(true);
      expect(assertions.assertedSummaryServices).toBe(true);
      expect(assertions.assertedSummaryModules).toBe(true);

      // 3. Start a deployment.
      const queued = await endpoints.deployments.start(
        apiCtx,
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        {
          projectVersionSeq: 1,
          targetSlug: 'prod',
          configOverrides: {},
        },
      );
      expect(queued.ok).toBe(true);
      if (!queued.ok) return;
      expect(queued.value.deployment.id).toBe(DEPLOYMENT_ID);
      expect(queued.value.deployment.status).toBe('queued');

      // 4. Poll the deployment and its logs.
      const shown = await endpoints.deployments.show(apiCtx, DEPLOYMENT_ID);
      expect(shown.ok).toBe(true);
      if (!shown.ok) return;
      expect(shown.value.deployment.id).toBe(DEPLOYMENT_ID);

      const logs = await endpoints.deployments.logs(apiCtx, DEPLOYMENT_ID, {
        sinceLineId: 0,
        limit: 200,
      });
      expect(logs.ok).toBe(true);
      if (!logs.ok) return;
      expect(logs.value.lines.length).toBeGreaterThan(0);

      // 5. Verify the recorded calls and assert no legacy /v1/orgs path was used.
      const paths = fake.recordedPaths();
      expect(paths.some((p) => p === `/api/projects/${PROJECT_ID}/versions`)).toBe(true);
      expect(paths.some((p) => p === '/api/deployments')).toBe(true);
      expect(paths.some((p) => p === `/api/deployments/${DEPLOYMENT_ID}`)).toBe(true);
      expect(
        paths.some((p) => p.startsWith(`/api/deployments/${DEPLOYMENT_ID}/logs`)),
      ).toBe(true);

      for (const p of paths) {
        expect(p).not.toContain('/v1/orgs');
        expect(p).not.toContain('deploy-targets');
        expect(p).not.toMatch(/^\/v1\//);
      }

      // Confirm the publish call used the canonical bundle content-type.
      const publishCall = fake.recorded.find(
        (r) => r.path === `/api/projects/${PROJECT_ID}/versions`,
      );
      expect(publishCall?.contentType).toBe('application/rntme-project-bundle+json');
    },
    /* timeout */ 60_000,
  );
});
