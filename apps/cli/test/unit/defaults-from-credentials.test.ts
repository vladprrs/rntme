import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/config/resolve.js';

describe('resolveConfig defaultOrg', () => {
  it('uses credentials.defaultOrg when --org and project config absent', () => {
    const r = resolveConfig({
      flags: {},
      env: {},
      projectConfig: null,
      credentials: {
        version: 1,
        defaultProfile: 'default',
        profiles: {
          default: {
            baseUrl: 'https://x',
            token: 'rntme_pat_abcdefghijklmnopqrstuv',
            addedAt: '2026-05-02T00:00:00.000Z',
            defaultOrg: 'my-org',
          },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.org).toBe('my-org');
  });

  it('--org wins over credentials default', () => {
    const r = resolveConfig({
      flags: { org: 'flag-org' },
      env: {},
      projectConfig: null,
      credentials: {
        version: 1,
        defaultProfile: 'default',
        profiles: {
          default: {
            baseUrl: 'https://x',
            token: 'rntme_pat_abcdefghijklmnopqrstuv',
            addedAt: '2026-05-02T00:00:00.000Z',
            defaultOrg: 'cred-org',
          },
        },
      },
    });
    if (r.ok) expect(r.value.org).toBe('flag-org');
  });
});
