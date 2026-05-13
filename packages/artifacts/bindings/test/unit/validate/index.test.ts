import { describe, it, expect } from 'bun:test';
import { validateBindings } from '../../../src/validate/index.js';
import type { BindingArtifact } from '../../../src/types/artifact.js';
import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const artifact: BindingArtifact = {
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
};

const goodSig: GraphSignature = {
  id: 'g',
  effects: { localReads: true, localEmits: [], calls: [], waits: false },
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
};

const goodShape: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'g' ? goodSig : null),
  resolveShape: (name) => (name === 'Row' ? goodShape : null),
};

describe('validateBindings', () => {
  it('completes all three layers for a valid artifact', () => {
    const r = validateBindings(artifact, resolvers);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.resolved.primary?.signature.id).toBe('g');
  });

  it('fails fast at structural layer', () => {
    const bad = JSON.parse(JSON.stringify(artifact)) as BindingArtifact;
    bad.bindings.dup = { ...(bad.bindings.primary!) };
    const r = validateBindings(bad, resolvers);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.every((e) => e.layer === 'structural')).toBe(true);
    }
  });

  it('fails fast at references layer', () => {
    const r = validateBindings(artifact, {
      resolveGraphSignature: () => null,
      resolveShape: () => null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => e.layer === 'references')).toBe(true);
  });

  it('passes the full pipeline for a native-engine binding without consulting graph resolvers', () => {
    const nativeArtifact: BindingArtifact = {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: {
        publishProjectBundle: {
          exposure: 'action',
          graph: 'publishProjectBundle',
          target: { engine: 'native', dialect: 'platform' },
          http: {
            method: 'POST',
            path: '/{projectId}/versions',
            parameters: [
              { name: 'projectId', in: 'path', bindTo: 'projectId', required: true },
            ],
          },
          inputFrom: {
            authorization: { from: 'header', name: 'authorization', required: true },
            bodyBytes: { from: 'bodyBytes' },
          },
        },
      },
    };

    const r = validateBindings(nativeArtifact, {
      resolveGraphSignature: () => {
        throw new Error('graph resolver must not be consulted for native bindings');
      },
      resolveShape: () => null,
    });
    expect(r.ok).toBe(true);
  });

  it('fails at consistency layer', () => {
    const sig: GraphSignature = {
      ...goodSig,
      inputs: { limit: { ...goodSig.inputs.limit!, mode: 'required' } },
    };
    const r = validateBindings(artifact, {
      resolveGraphSignature: () => sig,
      resolveShape: () => goodShape,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => e.layer === 'consistency')).toBe(true);
  });
});
