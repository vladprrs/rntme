import { describe, it, expect } from 'vitest';
import type {
  BindingResolvers,
  GraphSignature,
  ResolvedShape,
  ScalarPrimitive,
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
    const primitives: ScalarPrimitive[] = ['integer', 'decimal', 'string', 'boolean', 'date', 'datetime'];
    expect(resolvers.resolveGraphSignature('g')?.id).toBe('g');
    expect(resolvers.resolveShape('Row')?.origin).toBe('custom');
    expect(primitives).toHaveLength(6);
  });
});
