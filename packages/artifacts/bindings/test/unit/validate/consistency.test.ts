import { describe, it, expect } from 'vitest';
import { validateConsistency } from '../../../src/validate/consistency.js';
import type { ResolvedBindings, ResolvedBinding } from '../../../src/types/artifact.js';
import type { GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const outputShape: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
};

const emptyEffects = {
  localReads: false,
  localEmits: [],
  calls: [],
  waits: false,
} as const;

const makeResolved = (over: Partial<ResolvedBinding> = {}): ResolvedBindings => {
  const entry = over.entry ?? {
    exposure: 'read' as const,
    graph: 'g',
    target: { engine: 'sqlite', dialect: 'sqlite' },
    http: {
      method: 'GET' as const,
      path: '/v1/things',
      parameters: [{ name: 'limit', in: 'query' as const, bindTo: 'limit', required: false }],
    },
  };
  const signature: GraphSignature = over.signature ?? {
    id: 'g',
    effects: emptyEffects,
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
  it('accepts a clean read binding', () => {
    const r = validateConsistency(makeResolved());
    expect(r.ok).toBe(true);
  });

  it('accepts row output as a bindable operation result', () => {
    const sig: GraphSignature = {
      id: 'g',
      effects: emptyEffects,
      inputs: {},
      output: { type: { kind: 'row', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(true);
  });

  it('rejects graph with root input', () => {
    const sig: GraphSignature = {
      id: 'g',
      effects: emptyEffects,
      inputs: {
        $root: { type: { kind: 'row', shape: 'Root' }, mode: 'root' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_GRAPH_HAS_ROOT_INPUT')).toBe(true);
  });

  it('rejects scalar output', () => {
    const sig: GraphSignature = {
      id: 'g',
      effects: emptyEffects,
      inputs: {},
      output: { type: { kind: 'scalar', primitive: 'boolean' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNSUPPORTED_OUTPUT_TYPE')).toBe(true);
  });

  it('rejects exposure=read on a graph with local emits', () => {
    const r = validateConsistency(
      makeResolved({
        entry: {
          exposure: 'read',
          graph: 'reserveStock',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: { method: 'GET', path: '/x', parameters: [] },
        },
        signature: {
          id: 'reserveStock',
          inputs: {},
          output: { type: { kind: 'row', shape: 'ReservationResult' }, from: 'out' },
          effects: {
            localReads: true,
            localEmits: [
              { aggregate: 'StockReservation', transition: 'reserve', eventType: 'StockReserved' },
            ],
            calls: [],
            waits: false,
          },
        },
        outputShape: { name: 'ReservationResult', origin: 'custom', fields: {} },
      }),
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BINDINGS_EXPOSURE_EFFECT_FORBIDDEN')).toBe(true);
    }
  });

  it('rejects exposure=read on a graph with action calls', () => {
    const r = validateConsistency(
      makeResolved({
        signature: {
          id: 'checkout',
          inputs: {},
          output: { type: { kind: 'row', shape: 'CheckoutResult' }, from: 'out' },
          effects: {
            localReads: false,
            localEmits: [],
            calls: [
              {
                target: 'module',
                operation: 'payments.CreateCheckoutSession',
                effect: 'action',
                idempotency: 'required',
              },
            ],
            waits: false,
          },
        },
        outputShape: { name: 'CheckoutResult', origin: 'custom', fields: {} },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BINDINGS_EXPOSURE_EFFECT_FORBIDDEN')).toBe(true);
    }
  });

  it('accepts exposure=action on a graph with action effects', () => {
    const r = validateConsistency(
      makeResolved({
        entry: {
          exposure: 'action',
          graph: 'reserveStock',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: { method: 'POST', path: '/x', parameters: [] },
        },
        signature: {
          id: 'reserveStock',
          inputs: {},
          output: { type: { kind: 'row', shape: 'ReservationResult' }, from: 'out' },
          effects: {
            localReads: true,
            localEmits: [
              { aggregate: 'StockReservation', transition: 'reserve', eventType: 'StockReserved' },
            ],
            calls: [],
            waits: false,
          },
        },
        outputShape: { name: 'ReservationResult', origin: 'custom', fields: {} },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects required mismatch: mode=required with required=false', () => {
    const sig: GraphSignature = {
      id: 'g',
      effects: emptyEffects,
      inputs: { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const r = validateConsistency(makeResolved({ signature: sig }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_REQUIRED_MISMATCH')).toBe(true);
  });

  it('rejects list<T> in path', () => {
    const sig: GraphSignature = {
      id: 'g',
      effects: emptyEffects,
      inputs: { ids: { type: { kind: 'list', element: 'integer' }, mode: 'required' } },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      exposure: 'read' as const,
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

  it('rejects unbound required input', () => {
    const sig: GraphSignature = {
      id: 'g',
      effects: emptyEffects,
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

  it('accepts unbound defaulted and predicate_optional inputs', () => {
    const sig: GraphSignature = {
      id: 'g',
      effects: emptyEffects,
      inputs: {
        limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
        minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
    };
    const entry = {
      exposure: 'read' as const,
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
