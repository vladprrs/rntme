import { describe, it, expect } from 'vitest';
import { validateReferences } from '../../../src/validate/references.js';
import type { StructurallyValid } from '../../../src/types/artifact.js';
import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const artifact = {
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
        parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
      },
    },
  },
} as unknown as StructurallyValid;

const defaultSig: GraphSignature = {
  id: 'g',
  effects: { localReads: true, localEmits: [], calls: [], waits: false },
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
};

const defaultShape: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
};

const makeResolvers = (
  overrides: Partial<BindingResolvers> = {},
): BindingResolvers => ({
  resolveGraphSignature: (id) => (id === 'g' ? defaultSig : null),
  resolveShape: (name) => (name === 'Row' ? defaultShape : null),
  ...overrides,
});

describe('validateReferences', () => {
  it('resolves graph and output shape', () => {
    const r = validateReferences(artifact, makeResolvers());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.resolved.primary?.signature.id).toBe('g');
      expect(r.value.resolved.primary?.outputShape.name).toBe('Row');
    }
  });

  it('errors when graph unresolved', () => {
    const r = validateReferences(
      artifact,
      makeResolvers({ resolveGraphSignature: () => null }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe('BINDINGS_UNRESOLVED_GRAPH');
  });

  it('errors when bindTo unknown', () => {
    const sig: GraphSignature = { ...defaultSig, inputs: {} };
    const r = validateReferences(
      artifact,
      makeResolvers({ resolveGraphSignature: () => sig }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNKNOWN_BIND_TO')).toBe(true);
  });

  it('errors when output shape unresolved', () => {
    const r = validateReferences(
      artifact,
      makeResolvers({ resolveShape: () => null }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'BINDINGS_UNRESOLVED_OUTPUT_SHAPE')).toBe(true);
  });

  it('skips output shape lookup for scalar output', () => {
    const scalarSig: GraphSignature = {
      ...defaultSig,
      output: { type: { kind: 'scalar', primitive: 'boolean' }, from: 't' },
    };
    const r = validateReferences(
      artifact,
      makeResolvers({ resolveGraphSignature: () => scalarSig }),
    );
    // reference layer passes; consistency layer will fail on unsupported output
    expect(r.ok).toBe(true);
  });

  it('aggregates multiple errors', () => {
    const r = validateReferences(artifact, {
      resolveGraphSignature: () => null,
      resolveShape: () => null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // when graph is missing, we cannot check bindTo/output; but we still produce UNRESOLVED_GRAPH per binding.
      expect(r.errors[0]?.code).toBe('BINDINGS_UNRESOLVED_GRAPH');
    }
  });

  it('resolves reserved CommandResult shape without consulting resolver', () => {
    const cmdArtifact = {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: {
        cmd: {
          exposure: 'action' as const,
          graph: 'g',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: {
            method: 'POST' as const,
            path: '/v1/cmd',
            parameters: [{ name: 'actor', in: 'body' as const, bindTo: 'actor', required: true }],
          },
        },
      },
    } as unknown as StructurallyValid;

    const cmdSig: GraphSignature = {
      id: 'g',
      effects: {
        localReads: false,
        localEmits: [{ aggregate: 'Issue', transition: 'assign', eventType: 'IssueAssigned' }],
        calls: [],
        waits: false,
      },
      inputs: { actor: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' } },
      output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'emitX' },
    };

    const resolvers: BindingResolvers = {
      resolveGraphSignature: (id) => (id === 'g' ? cmdSig : null),
      resolveShape: (name) => {
        if (name === 'CommandResult') throw new Error('resolver must not be consulted for CommandResult');
        return null;
      },
    };

    const r = validateReferences(cmdArtifact, resolvers);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.resolved.cmd?.outputShape.name).toBe('CommandResult');
  });
});
