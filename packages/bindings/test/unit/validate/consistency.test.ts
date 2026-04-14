import { describe, it, expect } from 'vitest';
import { validateConsistency } from '../../../src/validate/consistency.js';
import type { ResolvedBindings, ResolvedBinding } from '../../../src/types/artifact.js';
import type { GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const outputShape: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
};

const makeResolved = (over: Partial<ResolvedBinding> = {}): ResolvedBindings => {
  const entry = over.entry ?? {
    graph: 'g',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'GET',
      path: '/v1/things',
      parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
    },
  };
  const signature: GraphSignature = over.signature ?? {
    id: 'g',
    inputs: {
      limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
    },
    output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
  };
  const binding: ResolvedBinding = {
    entry,
    signature,
    outputShape: over.outputShape ?? outputShape,
  };
  return {
    artifact: {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: { primary: entry },
    },
    resolved: { primary: binding },
  } as unknown as ResolvedBindings;
};

describe('validateConsistency', () => {
  it('accepts a clean binding', () => {
    const r = validateConsistency(makeResolved());
    expect(r.ok).toBe(true);
  });

  it('rejects graph with root input', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        $root: { type: { kind: 'row', shape: 'Root' }, mode: 'root' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_GRAPH_HAS_ROOT_INPUT')).toBe(true);
  });

  it('rejects non-rowset output', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {},
      output: { type: { kind: 'row', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNSUPPORTED_OUTPUT_TYPE')).toBe(true);
  });

  it('rejects required mismatch: mode=required with required=false', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_REQUIRED_MISMATCH')).toBe(true);
  });

  it('rejects required mismatch: mode=defaulted with required=true', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET' as const,
        path: '/v1/things',
        parameters: [{ name: 'limit', in: 'query' as const, bindTo: 'limit', required: true }],
      },
    };
    const r = validateConsistency(makeResolved({ signature: sig, entry }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_REQUIRED_MISMATCH')).toBe(true);
  });

  it('rejects list<T> in path', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: { ids: { type: { kind: 'list', element: 'integer' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET' as const,
        path: '/v1/things/{ids}',
        parameters: [{ name: 'ids', in: 'path' as const, bindTo: 'ids', required: true }],
      },
    };
    const r = validateConsistency(makeResolved({ signature: sig, entry }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_TYPE_LOCATION_INVALID')).toBe(true);
  });

  it('rejects row<> type on parameter (root-only types cannot bind)', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: { payload: { type: { kind: 'row', shape: 'Anything' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST' as const,
        path: '/v1/things',
        parameters: [{ name: 'payload', in: 'body' as const, bindTo: 'payload', required: true }],
      },
    };
    const r = validateConsistency(makeResolved({ signature: sig, entry }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_TYPE_LOCATION_INVALID')).toBe(true);
  });

  it('rejects unbound required input', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
        dateFrom: { type: { kind: 'scalar', primitive: 'date' }, mode: 'required' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNBOUND_INPUT')).toBe(true);
  });

  it('rejects unbound nullable input', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
        filter: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNBOUND_INPUT')).toBe(true);
  });

  it('accepts unbound defaulted and predicate_optional inputs', () => {
    const sig: GraphSignature = {
      id: 'g',
      inputs: {
        limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
        minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET' as const,
        path: '/v1/things',
        parameters: [],
      },
    };
    const r = validateConsistency(makeResolved({ signature: sig, entry }));
    expect(r.ok).toBe(true);
  });
});
