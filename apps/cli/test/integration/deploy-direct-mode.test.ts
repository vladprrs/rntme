import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dockerAvailable } from '../helpers/docker-available.js';

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = join(here, '..', '..', 'dist', 'bin', 'cli.js');

type LiveEnv = {
  readonly dokployUrl: string;
  readonly dokployApiToken: string;
  readonly dokployProjectId: string;
};

function readLiveEnv(): LiveEnv | null {
  if (process.env['RNTME_DOKPLOY_E2E'] !== '1') return null;
  const url = process.env['RNTME_DOKPLOY_URL'];
  const token = process.env['RNTME_DOKPLOY_API_TOKEN'];
  const projectId = process.env['RNTME_DOKPLOY_PROJECT_ID'];
  if (!url || !token || !projectId) return null;
  return { dokployUrl: url, dokployApiToken: token, dokployProjectId: projectId };
}

const live = readLiveEnv();
const shouldRun = dockerAvailable() && live !== null;
const describeOrSkip = shouldRun ? describe : describe.skip;

describeOrSkip('rntme deploy <bp> --target <file> (direct mode)', () => {
  // TODO(plan-2): wire a shared Dokploy testcontainer harness so we don't depend
  // on RNTME_DOKPLOY_E2E env vars. Until then this suite runs only when the env
  // is set against a live Dokploy instance.
  it('deploys notes-blueprint successfully', () => {
    if (live === null) throw new Error('RNTME_DOKPLOY_E2E env not configured');
    const tmp = mkdtempSync(join(tmpdir(), 'cli-direct-e2e-'));
    const targetPath = join(tmp, 'target.json');
    writeFileSync(
      targetPath,
      JSON.stringify({
        kind: 'dokploy',
        displayName: 'e2e',
        config: {
          dokployUrl: live.dokployUrl,
          dokployProjectId: live.dokployProjectId,
          allowCreateProject: false,
        },
        secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
        eventBus: { kind: 'kafka', mode: 'provisioned', provider: 'redpanda' },
      }),
    );
    const blueprintDir = join(here, '..', 'fixtures', 'bundle');
    const result = spawnSync(process.execPath, [cliPath, 'deploy', blueprintDir, '--target', targetPath], {
      encoding: 'utf8',
      env: { ...process.env, DOKPLOY_API_TOKEN: live.dokployApiToken },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('▶ plan');
    expect(result.stdout).toContain('✓ verify');
  });
});
