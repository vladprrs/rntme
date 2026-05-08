import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../../src/validate/structural.js';
import type { BindingArtifact, HttpMethod } from '../../../src/types/artifact.js';
import { ERROR_CODES } from '../../../src/types/result.js';

const base: BindingArtifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      exposure: 'read',
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

const first = <T>(xs: readonly T[]): T => {
  if (xs.length === 0) throw new Error('empty');
  return xs[0] as T;
};

describe('validateStructural', () => {
  it('accepts a minimal valid artifact', () => {
    const r = validateStructural(base);
    expect(r.ok).toBe(true);
  });

  it('rejects a binding artifact that declares a shape named CommandResult', () => {
    const bad = {
      ...clone(base),
      shapes: {
        CommandResult: {
          fields: [
            {
              name: 'x',
              type: { kind: 'scalar' as const, scalar: 'string' as const },
            },
          ],
        },
      },
    } as unknown as BindingArtifact & { shapes: Record<string, unknown> };
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.BINDINGS_STRUCTURAL_RESERVED_SHAPE_NAME)).toBe(true);
    }
  });

  it('detects duplicate method + path', () => {
    const bad = clone(base);
    bad.bindings.other = {
      exposure: 'read',
      graph: 'other',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [],
      },
    };
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_DUPLICATE_METHOD_PATH')).toBe(true);
  });

  it('detects duplicate (in, name) within a binding', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({
      name: 'limit',
      in: 'query',
      bindTo: 'other',
      required: false,
    });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_DUPLICATE_PARAM_NAME');
  });

  it('detects duplicate bindTo within a binding', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({
      name: 'limit2',
      in: 'query',
      bindTo: 'limit',
      required: false,
    });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_DUPLICATE_BIND_TO');
  });

  it('detects path placeholder mismatch (extra placeholder)', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.path = '/v1/things/{id}';
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_PATH_PLACEHOLDER_MISMATCH');
  });

  it('detects path placeholder mismatch (extra path parameter)', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({ name: 'id', in: 'path', bindTo: 'id', required: true });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(first(r.errors).code).toBe('BINDINGS_PATH_PLACEHOLDER_MISMATCH');
  });

  it('detects path parameter with required=false', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.path = '/v1/things/{id}';
    primary.http.parameters = [
      { name: 'id', in: 'path', bindTo: 'id', required: false },
    ];
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_PATH_NOT_REQUIRED')).toBe(true);
  });

  it('detects body parameter on GET', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({ name: 'payload', in: 'body', bindTo: 'payload', required: true });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_BODY_ON_GET')).toBe(true);
  });

  it('accepts POST with body parameters', () => {
    const good = clone(base);
    const primary = good.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.method = 'POST';
    primary.http.parameters.push({ name: 'payload', in: 'body', bindTo: 'payload', required: true });
    const r = validateStructural(good);
    expect(r.ok).toBe(true);
  });

  it('aggregates multiple errors in one err()', () => {
    const bad = clone(base);
    const primary = bad.bindings.primary;
    if (!primary) throw new Error('missing primary');
    primary.http.parameters.push({
      name: 'limit', // duplicate name
      in: 'query',
      bindTo: 'limit', // duplicate bindTo
      required: false,
    });
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain('BINDINGS_DUPLICATE_PARAM_NAME');
      expect(codes).toContain('BINDINGS_DUPLICATE_BIND_TO');
    }
  });

  it('rejects action bindings with method !== POST', () => {
    const bad = clone(base);
    bad.bindings.primary!.exposure = 'action';
    bad.bindings.primary!.http.method = 'PATCH' as HttpMethod;
    bad.bindings.primary!.http.path = '/v1/things/{id}';
    bad.bindings.primary!.http.parameters = [
      { name: 'id', in: 'path', bindTo: 'id', required: true },
    ];
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_COMMAND_METHOD_NOT_POST')).toBe(true);
  });

  it('rejects GET action bindings without redirect response', () => {
    const bad = clone(base);
    bad.bindings.primary!.exposure = 'action';
    bad.bindings.primary!.http.path = '/v1/things/{id}';
    bad.bindings.primary!.http.parameters = [
      { name: 'id', in: 'path', bindTo: 'id', required: true },
    ];
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT')).toBe(true);
  });

  it('rejects action bindings with any in=query parameter', () => {
    const bad = clone(base);
    bad.bindings.primary!.exposure = 'action';
    bad.bindings.primary!.http.method = 'POST';
    bad.bindings.primary!.http.parameters = [
      { name: 'limit', in: 'query', bindTo: 'limit', required: false },
    ];
    const r = validateStructural(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN')).toBe(true);
  });

  it('accepts action bindings with POST + path + body only', () => {
    const good = clone(base);
    good.bindings.primary!.exposure = 'action';
    good.bindings.primary!.http.method = 'POST';
    good.bindings.primary!.http.path = '/v1/things/{id}/actions/do';
    good.bindings.primary!.http.parameters = [
      { name: 'id', in: 'path', bindTo: 'id', required: true },
      { name: 'actor', in: 'body', bindTo: 'actor', required: true },
    ];
    const r = validateStructural(good);
    expect(r.ok).toBe(true);
  });
});
