import { describe, expect, it } from 'bun:test';
import { parseProjectBlueprint } from '../../src/parse/parse.js';
import { ServiceDescriptorSchema } from '../../src/parse/schema.js';

describe('parseProjectBlueprint', () => {
  it('parses minimal project.json shape', () => {
    const r = parseProjectBlueprint({
      name: 'commerce-catalog',
      services: ['catalog', 'app', 'mod-workos'],
    });
    expect(r.ok).toBe(true);
  });

  it('parses integration-module service descriptors', () => {
    const r = ServiceDescriptorSchema.safeParse({ kind: 'integration-module' });
    expect(r.success).toBe(true);
  });

  it('parses integration-module service descriptors with a module alias', () => {
    const r = ServiceDescriptorSchema.safeParse({
      kind: 'integration-module',
      module: 'storage',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ kind: 'integration-module', module: 'storage' });
  });

  it('rejects an empty module alias', () => {
    const r = ServiceDescriptorSchema.safeParse({ kind: 'integration-module', module: '' });
    expect(r.success).toBe(false);
  });

  it('rejects unknown fields on service descriptors', () => {
    const r = ServiceDescriptorSchema.safeParse({ kind: 'integration-module', extra: 'nope' });
    expect(r.success).toBe(false);
  });
});

describe('parseProjectBlueprint vars', () => {
  it('accepts a vars block with from + required', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app'],
      vars: { FOO: { from: 'target.auth.auth0.clientId', required: true } },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.vars).toEqual({ FOO: { from: 'target.auth.auth0.clientId', required: true } });
  });

  it('rejects vars entry missing from', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app'],
      vars: { FOO: { required: true } },
    });
    expect(r.ok).toBe(false);
  });
});

describe('parseProjectBlueprint auth middleware', () => {
  it('accepts an auth middleware with ordered providers', () => {
    const r = parseProjectBlueprint({
      name: 'platform',
      services: ['app', 'tokens', 'identity-auth0'],
      middleware: {
        auth: {
          kind: 'auth',
          providers: [
            {
              provider: 'platform-tokens',
              moduleSlug: 'tokens',
              introspectPath: '/api/tokens/introspect',
              introspectPort: 3000,
            },
            {
              provider: 'auth0',
              audience: 'https://platform.rntme.com/api',
              moduleSlug: 'identity-auth0',
            },
          ],
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.middleware?.auth).toMatchObject({
        kind: 'auth',
        providers: [
          { provider: 'platform-tokens', moduleSlug: 'tokens' },
          { provider: 'auth0', moduleSlug: 'identity-auth0' },
        ],
      });
    }
  });

  it('rejects legacy single-provider auth middleware shape', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app', 'identity-auth0'],
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'auth0',
          audience: 'https://demo.rntme.com/api',
          moduleSlug: 'identity-auth0',
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects auth0 provider entries that omit audience', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app', 'identity-auth0'],
      middleware: {
        auth: {
          kind: 'auth',
          providers: [{ provider: 'auth0', moduleSlug: 'identity-auth0' }],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects platform-tokens provider entries without path or port', () => {
    const r = parseProjectBlueprint({
      name: 'platform',
      services: ['app', 'tokens'],
      middleware: {
        auth: {
          kind: 'auth',
          providers: [{ provider: 'platform-tokens', moduleSlug: 'tokens' }],
        },
      },
    });
    expect(r.ok).toBe(false);
  });
});
