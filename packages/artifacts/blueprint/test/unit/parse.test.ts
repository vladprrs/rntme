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
  it('accepts an auth middleware with audience and moduleSlug (auth0 shape)', () => {
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
    expect(r.ok).toBe(true);
  });

  it('accepts an auth middleware with introspectPath and introspectPort overrides', () => {
    const r = parseProjectBlueprint({
      name: 'platform',
      services: ['app', 'tokens'],
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'platform-tokens',
          moduleSlug: 'tokens',
          introspectPath: '/api/tokens/introspect',
          introspectPort: 3000,
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.middleware?.auth).toMatchObject({
        provider: 'platform-tokens',
        moduleSlug: 'tokens',
        introspectPath: '/api/tokens/introspect',
        introspectPort: 3000,
      });
    }
  });

  it('rejects an auth middleware with introspectPath that does not start with "/"', () => {
    const r = parseProjectBlueprint({
      name: 'platform',
      services: ['app', 'tokens'],
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'platform-tokens',
          moduleSlug: 'tokens',
          introspectPath: 'api/tokens/introspect',
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects an auth middleware with non-positive introspectPort', () => {
    const r = parseProjectBlueprint({
      name: 'platform',
      services: ['app', 'tokens'],
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'platform-tokens',
          moduleSlug: 'tokens',
          introspectPort: 0,
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects an auth0 auth middleware that omits audience', () => {
    const r = parseProjectBlueprint({
      name: 'demo',
      services: ['app', 'identity-auth0'],
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'auth0',
          moduleSlug: 'identity-auth0',
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts a platform-tokens auth middleware that omits audience', () => {
    const r = parseProjectBlueprint({
      name: 'platform',
      services: ['app', 'tokens'],
      middleware: {
        auth: {
          kind: 'auth',
          provider: 'platform-tokens',
          moduleSlug: 'tokens',
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});
