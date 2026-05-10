import { describe, it, expect } from 'bun:test';
import {
  SCALAR_PRIMITIVES,
  isScalarPrimitive,
  type BindingResolvers,
  type GraphSignature,
  type ResolvedShape,
  type ScalarPrimitive,
} from '../../../src/types/resolvers.js';

describe('resolver types', () => {
  it('compiles a minimal valid resolver', () => {
    const shape: ResolvedShape = {
      name: 'Row',
      origin: 'custom',
      fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
    };
    const sig: GraphSignature = {
      id: 'g',
      effects: { localReads: true, localEmits: [], calls: [], waits: false },
      inputs: {
        limit: {
          type: { kind: 'scalar', primitive: 'integer' },
          mode: 'defaulted',
          default: 20,
        },
      },
      output: { type: { kind: 'rowset', shape: 'Row' }, from: 'tail' },
    };
    const resolvers: BindingResolvers = {
      resolveGraphSignature: (id) => (id === 'g' ? sig : null),
      resolveShape: (name) => (name === 'Row' ? shape : null),
    };
    const primitives: ScalarPrimitive[] = [...SCALAR_PRIMITIVES];
    expect(resolvers.resolveGraphSignature('g')?.id).toBe('g');
    expect(resolvers.resolveShape('Row')?.origin).toBe('custom');
    expect(primitives).toEqual([
      'integer',
      'decimal',
      'string',
      'boolean',
      'date',
      'datetime',
    ]);
  });

  it('exports scalar primitives in canonical order', () => {
    expect(SCALAR_PRIMITIVES).toEqual([
      'integer',
      'decimal',
      'string',
      'boolean',
      'date',
      'datetime',
    ]);
  });

  it('guards scalar primitive strings at runtime', () => {
    for (const primitive of SCALAR_PRIMITIVES) {
      expect(isScalarPrimitive(primitive)).toBe(true);
    }

    expect(isScalarPrimitive('uuid')).toBe(false);
    expect(isScalarPrimitive('json')).toBe(false);
    expect(isScalarPrimitive('')).toBe(false);
  });
});
