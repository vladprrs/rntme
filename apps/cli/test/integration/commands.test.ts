import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../src/bin/cli.js';

const DEMO_BLUEPRINT = resolve(fileURLToPath(import.meta.url), '../../../../../demo/notes-blueprint');

const BASE = 'https://test.platform';
const PAT = 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa';

type RunResult = { code: number; stdout: string; stderr: string };

async function runCli(argv: string[]): Promise<RunResult> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const origStdout = process.stdout.write.bind(process.stdout);
  const origStderr = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stderr.write;

  const envBackup = { ...process.env };
  process.env['RNTME_BASE_URL'] = BASE;
  process.env['RNTME_TOKEN'] = PAT;

  try {
    const code = await main(argv);
    return { code, stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') };
  } finally {
    process.stdout.write = origStdout;
    process.stderr.write = origStderr;
    process.env = envBackup;
  }
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('whoami', () => {
  it('200 → human output with account/org/role', async () => {
    server.use(
      http.get(`${BASE}/v1/auth/me`, () =>
        HttpResponse.json({
          account: { id: 'a', workosUserId: 'u', displayName: 'Vlad', email: 'v@example.com' },
          org: { id: 'o', workosOrgId: 'wo', slug: 'acme' },
          role: 'admin',
          scopes: ['project:read'],
          tokenId: null,
        }),
      ),
    );
    const r = await runCli(['whoami']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('acme');
    expect(r.stdout).toContain('admin');
  });

  it('401 → exit 3 with PLATFORM_AUTH_INVALID', async () => {
    server.use(
      http.get(`${BASE}/v1/auth/me`, () =>
        HttpResponse.json(
          { error: { code: 'PLATFORM_AUTH_INVALID', message: 'bad token' } },
          { status: 401 },
        ),
      ),
    );
    const r = await runCli(['whoami']);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain('PLATFORM_AUTH_INVALID');
  });
});

describe('project create', () => {
  it('201 → exit 0 with slug', async () => {
    server.use(
      http.post(`${BASE}/api/projects`, () =>
        HttpResponse.json(
          {
            project: {
              id: 'p',
              orgId: 'o',
              slug: 'test',
              displayName: 'Test',
              createdAt: '2026-04-19T00:00:00Z',
              updatedAt: '2026-04-19T00:00:00Z',
              archivedAt: null,
            },
          },
          { status: 201 },
        ),
      ),
    );
    const r = await runCli(['--org', 'acme', 'project', 'create', 'test']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('test');
  });
});

describe('project publish folder resolution', () => {
  it('accepts a positional folder argument', async () => {
    const r = await runCli([
      'project', 'publish', DEMO_BLUEPRINT,
      '--dry-run', '--org', 'test', '--project', 'notes-demo',
    ]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('project bundle validated');
  });

  it('accepts --folder flag (back-compat)', async () => {
    const r = await runCli([
      'project', 'publish',
      '--folder', DEMO_BLUEPRINT,
      '--dry-run', '--org', 'test', '--project', 'notes-demo',
    ]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('project bundle validated');
  });

  it('rejects positional + --folder together with CLI_CONFIG_INVALID', async () => {
    const r = await runCli([
      'project', 'publish', DEMO_BLUEPRINT,
      '--folder', DEMO_BLUEPRINT,
      '--dry-run', '--org', 'test', '--project', 'notes-demo',
    ]);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('cannot use positional and --folder together');
  });
});

describe('project deploy commands', () => {
  it('rejects project deploy without --version', async () => {
    const r = await runCli(['--org', 'acme', '--project', 'notes-demo', 'project', 'deploy', '--target', 'preview']);

    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Usage: rntme project deploy --version <seq> --target <target>');
  });

  it('rejects project deploy without --target', async () => {
    const r = await runCli(['--org', 'acme', '--project', 'notes-demo', 'project', 'deploy', '--version', '4']);

    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Usage: rntme project deploy --version <seq> --target <target>');
  });

  it('dispatches project deploy to the platform deployments endpoint', async () => {
    server.use(
      http.post(`${BASE}/api/deployments`, async ({ request }) => {
        expect(await request.json()).toEqual({
          organizationId: 'acme',
          projectId: 'notes-demo',
          projectVersionSeq: 4,
          targetSlug: 'preview',
          configOverrides: {},
        });
        return HttpResponse.json({
          deployment: {
            id: '11111111-1111-4111-8111-111111111111',
            orgId: '22222222-2222-4222-8222-222222222222',
            projectId: '33333333-3333-4333-8333-333333333333',
            projectVersionId: '44444444-4444-4444-8444-444444444444',
            projectVersionSeq: 4,
            targetId: '55555555-5555-4555-8555-555555555555',
            targetSlug: 'preview',
            status: 'queued',
            configOverrides: {},
            renderedPlanDigest: null,
            applyResult: null,
            verificationReport: null,
            warnings: [],
            errorCode: null,
            errorMessage: null,
            startedByAccountId: '66666666-6666-4666-8666-666666666666',
            queuedAt: '2026-05-02T12:00:00.000Z',
            startedAt: null,
            finishedAt: null,
            lastHeartbeatAt: null,
          },
        }, { status: 202 });
      }),
    );

    const r = await runCli(['--org', 'acme', '--project', 'notes-demo', 'project', 'deploy', '--version', '4', '--target', 'preview']);

    expect(r.code).toBe(0);
    expect(r.stdout).toContain('11111111-1111-4111-8111-111111111111');
  });
});
