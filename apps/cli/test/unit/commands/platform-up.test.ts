import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPlatformUp } from '../../../src/commands/platform/up.js';

const fixture = {
  kind: 'dokploy',
  displayName: 'preview',
  config: { dokployUrl: 'https://dokploy.example.com', dokployProjectId: 'p1' },
  secrets: { apiToken: { source: 'env', name: 'DOKPLOY_API_TOKEN' } },
};

describe('rntme platform up', () => {
  it('uses the bundled platform blueprint dir, then delegates to deploy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-platform-up-'));
    const targetPath = join(dir, 'target.json');
    writeFileSync(targetPath, JSON.stringify(fixture));
    delete process.env['DOKPLOY_API_TOKEN'];
    const exit = await runPlatformUp({ targetPath, json: true, quiet: true });
    // bundled blueprint exists post-build but secrets are missing → exit 2
    expect(exit).toBe(2);
  });
});
