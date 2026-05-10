import { describe, expect, it } from 'bun:test';
import { resolveEnvMappings } from '../../src/provisioner-env-mapping.js';
import type { ProvisionerEnvMapping } from '@rntme/contracts-provisioner-v1';
import type { ProvisionedModule } from '../../src/provision.js';

const mod: ProvisionedModule = {
  projectKey: 'identity-auth0',
  packageName: '@rntme/identity-auth0',
  publicOutputs: {
    spaClient: { id: 'cid_xyz', name: 'app' },
    resourceServer: { id: 'rs_1', identifier: 'https://x/api' },
  },
  secretOutputs: {
    m2mClients: [
      { name: 'introspect', clientId: 'm_a', clientSecret: 'sec_a' },
      { name: 'webhook', clientId: 'm_b', clientSecret: 'sec_b' },
    ],
  },
  provisionedAt: '2026-05-03T10:00:00Z',
};

describe('resolveEnvMappings', () => {
  it('resolves dot-paths against publicOutputs (kind=single)', () => {
    const mapping: ProvisionerEnvMapping = {
      'identity-auth0': [
        { from: 'spaClient.id', envName: 'AUTH0_SPA_CLIENT_ID', secret: false, target: 'app' },
      ],
    };
    const out = resolveEnvMappings(new Map([['identity-auth0', mod]]), mapping);
    expect(out).toEqual([
      { module: 'identity-auth0', target: 'app', envName: 'AUTH0_SPA_CLIENT_ID', value: 'cid_xyz', secret: false },
    ]);
  });

  it('expands kind=many with star and ${name} substitution', () => {
    const mapping: ProvisionerEnvMapping = {
      'identity-auth0': [
        { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_CLIENT_SECRET', secret: true, target: 'identity-auth0' },
      ],
    };
    const out = resolveEnvMappings(new Map([['identity-auth0', mod]]), mapping);
    expect(out).toEqual([
      { module: 'identity-auth0', target: 'identity-auth0', envName: 'AUTH0_M2M_INTROSPECT_CLIENT_SECRET', value: 'sec_a', secret: true },
      { module: 'identity-auth0', target: 'identity-auth0', envName: 'AUTH0_M2M_WEBHOOK_CLIENT_SECRET', value: 'sec_b', secret: true },
    ]);
  });

  it('throws on path not found', () => {
    const mapping: ProvisionerEnvMapping = {
      'identity-auth0': [{ from: 'nope.field', envName: 'X', secret: false, target: 'app' }],
    };
    expect(() => resolveEnvMappings(new Map([['identity-auth0', mod]]), mapping)).toThrow(/nope/);
  });

  it('uppercases ${name} and replaces non-alphanumerics with underscore', () => {
    const modWithDash: ProvisionedModule = {
      ...mod,
      secretOutputs: {
        m2mClients: [{ name: 'web-hook 2', clientId: 'a', clientSecret: 's' }],
      },
    };
    const mapping: ProvisionerEnvMapping = {
      'identity-auth0': [
        { from: 'm2mClients.*.clientSecret', envName: 'AUTH0_M2M_${name}_X', secret: true, target: 'identity-auth0' },
      ],
    };
    const out = resolveEnvMappings(new Map([['identity-auth0', modWithDash]]), mapping);
    expect(out[0]?.envName).toBe('AUTH0_M2M_WEB_HOOK_2_X');
  });
});
