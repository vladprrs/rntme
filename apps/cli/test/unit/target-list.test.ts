import { describe, expect, it, mock } from 'bun:test';
import { restoreGlobals, stubGlobal } from '../helpers/globals.js';

describe('rntme target list', () => {
  it('renders SLUG / DISPLAY NAME columns', async () => {
    stubGlobal('fetch', mock(async () => Response.json({
      targets: [{ id: 'a', slug: 's1', displayName: 'X', kind: 'dokploy', publicBaseUrl: null, isDefault: false }],
    })));
    const { runTargetList } = await import('../../src/commands/target/list.js');
    const exit = await runTargetList({}, { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never);
    expect(exit).toBe(0);
    restoreGlobals();
  });
});
