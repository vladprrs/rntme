import { describe, expect, it } from 'bun:test';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDirectDeploy } from '../../../src/commands/deploy.js';

const fixture = {
  kind: 'dokploy',
  displayName: 'preview',
  config: { dokployUrl: 'https://dokploy.example.com', dokployProjectId: 'p1' },
  secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
};

describe('rntme deploy (direct mode)', () => {
  it('returns CLI_DEPLOY_SECRET_MISSING when env var is not set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-deploy-cmd-'));
    const targetPath = join(dir, 'target.json');
    writeFileSync(targetPath, JSON.stringify(fixture));
    delete process.env['DOKPLOY_API_TOKEN'];
    const exit = await runDirectDeploy({ blueprintDir: dir, targetPath, json: true, quiet: true });
    expect(exit).toBe(2);
  });
});
