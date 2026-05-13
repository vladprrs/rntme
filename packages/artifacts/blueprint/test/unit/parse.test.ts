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
