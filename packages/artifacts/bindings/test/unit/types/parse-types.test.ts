import { describe, it, expect } from 'bun:test';
import {
  parseFieldType,
  parseInputType,
  parseOutputType,
  parseScalarType,
  isShapeName,
} from '../../../src/types/resolvers.js';

describe('parseScalarType', () => {
  it('accepts every scalar primitive', () => {
    for (const p of ['integer', 'decimal', 'string', 'boolean', 'date', 'datetime'] as const) {
      const r = parseScalarType(p);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual({ kind: 'scalar', primitive: p });
    }
  });

  it('rejects unknown scalars', () => {
    const r = parseScalarType('uuid');
    expect(r.ok).toBe(false);
  });
});

describe('parseFieldType', () => {
  it('parses scalar', () => {
    const r = parseFieldType('integer');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'scalar', primitive: 'integer' });
  });

  it('parses array<scalar>', () => {
    const r = parseFieldType('array<string>');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'array', element: 'string' });
  });

  it('rejects array<non-scalar>', () => {
    const r = parseFieldType('array<uuid>');
    expect(r.ok).toBe(false);
  });

  it('rejects list<> (list is input-only, not field)', () => {
    const r = parseFieldType('list<string>');
    expect(r.ok).toBe(false);
  });

  it('rejects row<Shape> (row/rowset are input/output, not field)', () => {
    const r = parseFieldType('row<Order>');
    expect(r.ok).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(parseFieldType('').ok).toBe(false);
    expect(parseFieldType('array<>').ok).toBe(false);
    expect(parseFieldType('array<string').ok).toBe(false);
    expect(parseFieldType('Array<string>').ok).toBe(false);
  });
});

describe('parseInputType', () => {
  it('parses scalar', () => {
    const r = parseInputType('boolean');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'scalar', primitive: 'boolean' });
  });

  it('parses list<scalar>', () => {
    const r = parseInputType('list<integer>');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'list', element: 'integer' });
  });

  it('parses row<Shape>', () => {
    const r = parseInputType('row<Order>');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'row', shape: 'Order' });
  });

  it('parses rowset<Shape>', () => {
    const r = parseInputType('rowset<OrderRow>');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'rowset', shape: 'OrderRow' });
  });

  it('rejects array<> (field-only)', () => {
    expect(parseInputType('array<string>').ok).toBe(false);
  });

  it('rejects shape names that do not match identifier rules', () => {
    expect(parseInputType('row<1Bad>').ok).toBe(false);
    expect(parseInputType('row<>').ok).toBe(false);
    expect(parseInputType('row<a-b>').ok).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(parseInputType('').ok).toBe(false);
    expect(parseInputType('list<uuid>').ok).toBe(false);
    expect(parseInputType('LIST<string>').ok).toBe(false);
  });
});

describe('parseOutputType', () => {
  it('parses scalar', () => {
    const r = parseOutputType('decimal');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'scalar', primitive: 'decimal' });
  });

  it('parses row<Shape>', () => {
    const r = parseOutputType('row<User>');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'row', shape: 'User' });
  });

  it('parses rowset<Shape>', () => {
    const r = parseOutputType('rowset<UserRow>');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ kind: 'rowset', shape: 'UserRow' });
  });

  it('rejects list<> (input-only)', () => {
    expect(parseOutputType('list<string>').ok).toBe(false);
  });

  it('rejects array<> (field-only)', () => {
    expect(parseOutputType('array<string>').ok).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(parseOutputType('').ok).toBe(false);
    expect(parseOutputType('row<>').ok).toBe(false);
    expect(parseOutputType('garbage').ok).toBe(false);
  });
});

describe('isShapeName', () => {
  it('accepts valid identifiers', () => {
    expect(isShapeName('A')).toBe(true);
    expect(isShapeName('Order')).toBe(true);
    expect(isShapeName('order_row_v2')).toBe(true);
    expect(isShapeName('_Hidden')).toBe(true);
  });

  it('rejects invalid identifiers', () => {
    expect(isShapeName('')).toBe(false);
    expect(isShapeName('1Bad')).toBe(false);
    expect(isShapeName('a-b')).toBe(false);
    expect(isShapeName('a b')).toBe(false);
  });
});
