import { describe, it, expect } from 'vitest';
import type {
  BindingArtifact,
  BindingEntry,
  HttpBinding,
  HttpParameter,
  StructurallyValid,
  ResolvedBindings,
  ValidatedBindings,
  ResolvedBinding,
  OperationPassthrough,
  ParameterPassthrough,
} from '../../../src/types/artifact.js';
import type { GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

describe('artifact types', () => {
  it('types compose cleanly', () => {
    const param: HttpParameter = {
      name: 'limit',
      in: 'query',
      bindTo: 'limit',
      required: false,
    };
    const http: HttpBinding = {
      method: 'GET',
      path: '/v1/things',
      parameters: [param],
    };
    const entry: BindingEntry = {
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http,
    };
    const artifact: BindingArtifact = {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: { primary: entry },
    };

    // branded types are assignable from their raw structure at construction time:
    const structural = artifact as unknown as StructurallyValid;

    const sig: GraphSignature = {
      id: 'g',
      inputs: { limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 } },
      output: { type: { kind: 'rowset', shape: 'R' }, from: 't' },
    };
    const shape: ResolvedShape = {
      name: 'R',
      origin: 'custom',
      fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
    };
    const resolvedBinding: ResolvedBinding = {
      entry,
      signature: sig,
      outputShape: shape,
    };
    const resolved = { artifact: structural, resolved: { primary: resolvedBinding } } as unknown as ResolvedBindings;
    const validated = resolved as unknown as ValidatedBindings;

    const op: OperationPassthrough = { 'x-rate-limit': { max: 60 } };
    const pp: ParameterPassthrough = { example: 10 };

    expect(artifact.bindings.primary?.http.method).toBe('GET');
    expect(validated.resolved.primary?.signature.id).toBe('g');
    expect(op['x-rate-limit']).toBeTruthy();
    expect(pp.example).toBe(10);
  });
});
