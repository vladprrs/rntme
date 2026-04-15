import { describe, expect, it } from 'vitest';
import { buildBindingResolver } from '../../src/resolvers/from-bindings.js';
import { buildComponentResolver } from '../../src/resolvers/from-shadcn.js';

describe('buildBindingResolver', () => {
  it('returns ResolvedBinding shape from a validated bindings fixture', async () => {
    const { validated, mockResolveShape } = await import('../fixtures/bindings-fixtures.js');
    const resolve = buildBindingResolver(validated, mockResolveShape);
    const got = resolve('listIssues');
    expect(got).toBeDefined();
    if (got) {
      expect(got.kind).toBe('query');
      expect(got.http.method).toBe('GET');
    }
  });
});

describe('buildComponentResolver', () => {
  it('resolves known shadcn components', () => {
    const r = buildComponentResolver();
    expect(r('Button')).toBeDefined();
    expect(r('DefinitelyNotAComponent_xyz')).toBeUndefined();
  });

  it('marks Table.rows as a known list prop', () => {
    const r = buildComponentResolver();
    const table = r('Table');
    expect(table?.knownListProps).toContain('rows');
  });
});
