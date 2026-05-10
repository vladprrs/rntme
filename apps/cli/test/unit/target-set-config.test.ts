import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, mock } from 'bun:test';
import { restoreGlobals, stubGlobal } from '../helpers/globals.js';

describe('rntme target set-config', () => {
  it('sends parsed JSON body', async () => {
    const jsonPath = join(mkdtempSync(join(tmpdir(), 'rntme-target-config-')), 'config.json');
    writeFileSync(jsonPath, JSON.stringify({ auth: { auth0: { clientId: 'client' } } }));
    stubGlobal('fetch', mock(async () => Response.json({
      target: { id: 'a', slug: 's1', displayName: 'X', kind: 'dokploy', publicBaseUrl: null, isDefault: false },
    })));
    const { runTargetSetConfig } = await import('../../src/commands/target/set-config.js');
    const exit = await runTargetSetConfig({ slug: 's1', fromPath: jsonPath }, { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never);
    expect(exit).toBe(0);
    restoreGlobals();
  });
});
