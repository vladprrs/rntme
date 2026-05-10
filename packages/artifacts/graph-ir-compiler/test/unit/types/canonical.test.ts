import { describe, it, expectTypeOf } from 'bun:test';
import type { CanonicalGraph, CanonicalNode, ScopeId } from '../../../src/types/canonical.js';

describe('canonical types', () => {
  it('exports CanonicalGraph with nodes and scope', () => {
    expectTypeOf<CanonicalGraph>().toHaveProperty('nodes');
    expectTypeOf<CanonicalNode>().toHaveProperty('scope');
    expectTypeOf<ScopeId>().toEqualTypeOf<string>();
  });
});
