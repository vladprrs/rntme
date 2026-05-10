import { describe, expect, it, mock } from 'bun:test';
import { restoreGlobals, stubGlobal } from '../helpers/globals.js';

describe('rntme target show', () => {
  it('renders target fields', async () => {
    stubGlobal('fetch', mock(async () => Response.json({
      target: { id: 'a', slug: 's1', displayName: 'X', kind: 'dokploy', publicBaseUrl: null, isDefault: false, auth: {}, modules: {}, eventBus: {} },
    })));
    const { runTargetShow } = await import('../../src/commands/target/show.js');
    const exit = await runTargetShow({ slug: 's1' }, { org: 'o', token: 'rntme_pat_aaaaaaaaaaaaaaaaaaaaaa' } as never);
    expect(exit).toBe(0);
    restoreGlobals();
  });
});
