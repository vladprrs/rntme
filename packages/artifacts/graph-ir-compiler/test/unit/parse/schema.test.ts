import { describe, it, expect } from 'vitest';
import { AuthoringSpecSchema } from '../../../src/parse/schema.js';

const minimal = {
  version: '1.0-rc7',
  pdmRef: 'x',
  qsmRef: 'y',
  shapes: {},
  graphs: {
    g: {
      id: 'g',
      signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'items' } },
      nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }],
    },
  },
};

describe('AuthoringSpecSchema', () => {
  it('accepts a minimal spec', () => {
    expect(() => AuthoringSpecSchema.parse(minimal)).not.toThrow();
  });

  it('rejects missing version', () => {
    expect(() => AuthoringSpecSchema.parse({ ...minimal, version: undefined })).toThrow();
  });

  it('rejects unknown node type', () => {
    const bad = {
      ...minimal,
      graphs: {
        g: {
          ...minimal.graphs.g,
          nodes: [{ id: 'n', type: 'frobnicate', config: {} }],
        },
      },
    };
    expect(() => AuthoringSpecSchema.parse(bad)).toThrow();
  });
});
