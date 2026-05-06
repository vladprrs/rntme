import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/endpoints.js', () => ({
  endpoints: {
    targets: {
      setConfig: vi.fn(async () => ({ ok: true, value: { target: { slug: 's1' } } })),
    },
  },
}));

describe('rntme target set-config', () => {
  it('sends parsed JSON body', async () => {
    const jsonPath = join(mkdtempSync(join(tmpdir(), 'rntme-target-config-')), 'config.json');
    writeFileSync(jsonPath, JSON.stringify({ auth: { auth0: { clientId: 'client' } } }));
    const { runTargetSetConfig } = await import('../../src/commands/target/set-config.js');
    const exit = await runTargetSetConfig({ slug: 's1', fromPath: jsonPath }, { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never);
    expect(exit).toBe(0);
  });
});
