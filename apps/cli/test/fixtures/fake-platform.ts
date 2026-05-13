import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

type SetupServerApi = ReturnType<typeof setupServer>;

type RecordedCall = {
  readonly method: string;
  readonly path: string;
  readonly contentType: string | null;
  readonly bodyText: string;
};

export type FakePlatformOptions = {
  readonly baseUrl: string;
  /** Project id or slug accepted by `POST /api/projects/{projectId}/versions`. */
  readonly projectIdOrSlug: string;
  /** Deployment id that the fake `POST /api/deployments` will return. */
  readonly deploymentId: string;
  /** Allow the fake publish endpoint to skip bundle assertions (for negative tests). */
  readonly skipPublishAssertions?: boolean;
};

export type PublishAssertions = {
  readonly assertedBundleVersionTwo: boolean;
  readonly assertedMarketingAsset: boolean;
  readonly assertedSummaryServices: boolean;
  readonly assertedSummaryModules: boolean;
};

export type FakePlatform = {
  readonly server: SetupServerApi;
  readonly recorded: ReadonlyArray<RecordedCall>;
  readonly publishAssertions: () => PublishAssertions;
  readonly recordedPaths: () => ReadonlyArray<string>;
  reset(): void;
};

/**
 * Fake platform HTTP fixture used by CLI integration tests.
 *
 * Records:
 *   POST /api/projects/{projectId}/versions
 *   POST /api/deployments
 *   GET  /api/deployments/{deploymentId}
 *   GET  /api/deployments/{deploymentId}/logs
 *
 * The publish handler parses the raw canonical bundle bytes and asserts:
 *   - bundle.version === 2
 *   - bundle.assets['assets/project-folders/marketing/<sha>.tar.gz'] exists
 *   - bundle.files['project.json'].services === ['app','openrouter','storage-s3']
 *   - bundle.files['project.json'].modules includes openrouter, storage, marketing
 */
export function createFakePlatform(opts: FakePlatformOptions): FakePlatform {
  const recorded: RecordedCall[] = [];
  let assertedBundleVersionTwo = false;
  let assertedMarketingAsset = false;
  let assertedSummaryServices = false;
  let assertedSummaryModules = false;

  const projectVersion = {
    id: '11111111-1111-4111-8111-111111111111',
    orgId: '22222222-2222-4222-8222-222222222222',
    projectId: '33333333-3333-4333-8333-333333333333',
    seq: 1,
    bundleDigest: 'sha256:' + 'a'.repeat(64),
    bundleBlobKey: `project-versions/${opts.projectIdOrSlug}/1.json`,
    bundleSizeBytes: 0,
    summary: {
      projectName: 'cv-extract',
      services: ['app', 'openrouter', 'storage-s3'],
      routes: { ui: { '/': 'app' }, http: { '/api': 'app' } },
      middleware: {},
      mounts: [],
    },
    uploadedByAccountId: '44444444-4444-4444-8444-444444444444',
    createdAt: '2026-05-13T00:00:00.000Z',
  };

  const deployment = {
    id: opts.deploymentId,
    orgId: '22222222-2222-4222-8222-222222222222',
    projectId: '33333333-3333-4333-8333-333333333333',
    projectVersionId: '44444444-4444-4444-8444-444444444444',
    projectVersionSeq: 1,
    targetId: '55555555-5555-4555-8555-555555555555',
    targetSlug: 'prod',
    status: 'queued',
    configOverrides: {},
    renderedPlanDigest: null,
    applyResult: null,
    verificationReport: null,
    warnings: [],
    errorCode: null,
    errorMessage: null,
    startedByAccountId: '66666666-6666-4666-8666-666666666666',
    queuedAt: '2026-05-13T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    lastHeartbeatAt: null,
  };

  function recordCall(
    req: { url: string; method: string; headers: { get(name: string): string | null } },
    bodyText: string,
  ): void {
    const u = new URL(req.url);
    recorded.push({
      method: req.method,
      path: u.pathname + (u.search ?? ''),
      contentType: req.headers.get('content-type'),
      bodyText,
    });
  }

  const base = opts.baseUrl.replace(/\/+$/, '');

  const handlers = [
    // POST /api/projects/{projectId}/versions — raw bundle bytes
    http.post(
      `${base}/api/projects/${opts.projectIdOrSlug}/versions`,
      async ({ request }) => {
        const bodyText = await request.text();
        recordCall(request, bodyText);

        if (opts.skipPublishAssertions === true) {
          return HttpResponse.json({ version: projectVersion }, { status: 201 });
        }

        // Parse bundle and assert structure.
        let bundle: {
          version?: number;
          files?: Record<string, unknown>;
          assets?: Record<string, string>;
        };
        try {
          bundle = JSON.parse(bodyText) as typeof bundle;
        } catch (cause) {
          return HttpResponse.json(
            {
              error: {
                code: 'FAKE_PLATFORM_BUNDLE_NOT_JSON',
                message: `bundle bytes are not JSON: ${(cause as Error).message}`,
              },
            },
            { status: 400 },
          );
        }

        if (bundle.version !== 2) {
          return HttpResponse.json(
            {
              error: {
                code: 'FAKE_PLATFORM_BUNDLE_VERSION_MISMATCH',
                message: `expected bundle.version === 2, got ${String(bundle.version)}`,
              },
            },
            { status: 400 },
          );
        }
        assertedBundleVersionTwo = true;

        const assets = bundle.assets ?? {};
        const marketingAsset = Object.keys(assets).find(
          (k) => k.startsWith('assets/project-folders/marketing-site/') && k.endsWith('.tar.gz'),
        );
        if (!marketingAsset) {
          return HttpResponse.json(
            {
              error: {
                code: 'FAKE_PLATFORM_MARKETING_ASSET_MISSING',
                message: 'expected assets/project-folders/marketing-site/<sha>.tar.gz entry',
              },
            },
            { status: 400 },
          );
        }
        assertedMarketingAsset = true;

        const projectJson = bundle.files?.['project.json'] as
          | { services?: unknown; modules?: Record<string, unknown> }
          | undefined;
        const services = Array.isArray(projectJson?.services)
          ? (projectJson?.services as string[])
          : [];
        const expectedServices = ['app', 'openrouter', 'storage-s3'];
        const serviceMismatch = expectedServices.some((s) => !services.includes(s)) ||
          services.length !== expectedServices.length;
        if (serviceMismatch) {
          return HttpResponse.json(
            {
              error: {
                code: 'FAKE_PLATFORM_SUMMARY_SERVICES_MISMATCH',
                message: `expected services ${JSON.stringify(expectedServices)}, got ${JSON.stringify(services)}`,
              },
            },
            { status: 400 },
          );
        }
        assertedSummaryServices = true;

        const moduleKeys = Object.keys(projectJson?.modules ?? {});
        const expectedModules = ['openrouter', 'storage', 'marketing-site'];
        const moduleMismatch = expectedModules.some((m) => !moduleKeys.includes(m));
        if (moduleMismatch) {
          return HttpResponse.json(
            {
              error: {
                code: 'FAKE_PLATFORM_SUMMARY_MODULES_MISSING',
                message: `expected modules to include ${JSON.stringify(expectedModules)}, got ${JSON.stringify(moduleKeys)}`,
              },
            },
            { status: 400 },
          );
        }
        assertedSummaryModules = true;

        return HttpResponse.json(
          {
            version: {
              ...projectVersion,
              bundleSizeBytes: bodyText.length,
            },
          },
          { status: 201 },
        );
      },
    ),

    // POST /api/deployments — queue a new deployment
    http.post(`${base}/api/deployments`, async ({ request }) => {
      const bodyText = await request.text();
      recordCall(request, bodyText);
      return HttpResponse.json({ deployment }, { status: 202 });
    }),

    // GET /api/deployments/{id} — fetch deployment
    http.get(`${base}/api/deployments/${opts.deploymentId}`, ({ request }) => {
      recordCall(request, '');
      return HttpResponse.json({ deployment }, { status: 200 });
    }),

    // GET /api/deployments/{id}/logs — fetch log lines
    http.get(`${base}/api/deployments/${opts.deploymentId}/logs`, ({ request }) => {
      recordCall(request, '');
      return HttpResponse.json(
        {
          lines: [
            {
              id: 1,
              deploymentId: opts.deploymentId,
              orgId: deployment.orgId,
              ts: '2026-05-13T00:00:01.000Z',
              level: 'info',
              step: 'plan',
              message: 'fake platform: deployment queued',
            },
          ],
          lastLineId: 1,
        },
        { status: 200 },
      );
    }),

    // Catch-all for legacy /v1/orgs/.../deploy-targets — these MUST NOT be
    // invoked. Returns a marker error if the CLI accidentally calls them.
    http.all(`${base}/v1/orgs/:org/deploy-targets`, ({ request }) => {
      recordCall(request, '');
      return HttpResponse.json(
        {
          error: {
            code: 'FAKE_PLATFORM_LEGACY_PATH_INVOKED',
            message: 'CLI must not call /v1/orgs/{org}/deploy-targets — use /api/deployments/targets',
          },
        },
        { status: 410 },
      );
    }),
    http.all(`${base}/v1/orgs/:org/deploy-targets/*`, ({ request }) => {
      recordCall(request, '');
      return HttpResponse.json(
        {
          error: {
            code: 'FAKE_PLATFORM_LEGACY_PATH_INVOKED',
            message: 'CLI must not call /v1/orgs/{org}/deploy-targets/* — use /api/deployments/targets/*',
          },
        },
        { status: 410 },
      );
    }),
  ];

  const server = setupServer(...handlers);

  return {
    server,
    recorded,
    publishAssertions: () => ({
      assertedBundleVersionTwo,
      assertedMarketingAsset,
      assertedSummaryServices,
      assertedSummaryModules,
    }),
    recordedPaths: () => recorded.map((r) => r.path),
    reset(): void {
      recorded.length = 0;
      assertedBundleVersionTwo = false;
      assertedMarketingAsset = false;
      assertedSummaryServices = false;
      assertedSummaryModules = false;
    },
  };
}

