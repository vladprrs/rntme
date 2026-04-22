import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../src/validate/structural.js';
import type { BindingArtifact } from '../../../src/types/artifact.js';

const base: BindingArtifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [
          { name: 'limit', in: 'query', bindTo: 'limit', required: false },
        ],
      },
    },
  },
};

const clone = (a: BindingArtifact): BindingArtifact =>
  JSON.parse(JSON.stringify(a)) as BindingArtifact;

const first = <T>(xs: T[]): T => {
  if (xs.length === 0) throw new Error('empty');
  return xs[0] as T;
};

describe('pre[] structural validation', () => {
  it('rejects pre[] on a query binding', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.pre = [
      {
        kind: 'module-rpc',
        module: 'mod',
        rpc: 'rpc1',
        input: {},
        bindAs: 'x',
      },
    ];
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_STRUCTURAL_PRE_ON_NON_COMMAND');
  });

  it('rejects pre.length > 2', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.kind = 'command';
    primary.http.method = 'POST';
    primary.http.parameters = [
      { name: 'id', in: 'path', bindTo: 'id', required: true },
    ];
    primary.http.path = '/v1/things/{id}';
    primary.pre = [
      { kind: 'module-rpc', module: 'mod', rpc: 'r1', input: {}, bindAs: 'a' },
      { kind: 'module-rpc', module: 'mod', rpc: 'r2', input: {}, bindAs: 'b' },
      { kind: 'module-rpc', module: 'mod', rpc: 'r3', input: {}, bindAs: 'c' },
    ];
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_STRUCTURAL_PRE_TOO_MANY');
  });

  it('rejects duplicate bindAs within one pre[]', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.kind = 'command';
    primary.http.method = 'POST';
    primary.http.parameters = [
      { name: 'id', in: 'path', bindTo: 'id', required: true },
    ];
    primary.http.path = '/v1/things/{id}';
    primary.pre = [
      { kind: 'module-rpc', module: 'mod', rpc: 'r1', input: {}, bindAs: 'x' },
      { kind: 'module-rpc', module: 'mod', rpc: 'r2', input: {}, bindAs: 'x' },
    ];
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_STRUCTURAL_PRE_DUPLICATE_BIND_AS');
  });

  it('accepts a single module-rpc pre-step', () => {
    const good = clone(base);
    const primary = good.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.kind = 'command';
    primary.http.method = 'POST';
    primary.http.parameters = [
      { name: 'id', in: 'path', bindTo: 'id', required: true },
    ];
    primary.http.path = '/v1/things/{id}';
    primary.pre = [
      { kind: 'module-rpc', module: 'mod', rpc: 'r1', input: {}, bindAs: 'x' },
    ];
    const r = validateStructural(good);
    expect(r.ok).toBe(true);
  });
});
