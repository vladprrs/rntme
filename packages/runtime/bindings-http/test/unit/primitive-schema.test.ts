import { describe, it, expect } from 'bun:test';
import { primitiveSchema } from '../../src/startup/primitive-schema.js';
import type { InputType } from '@rntme/bindings';

const scalar = (primitive: 'integer' | 'string' | 'boolean' | 'date' | 'datetime' | 'decimal'): InputType => ({
  kind: 'scalar',
  primitive,
});

describe('primitiveSchema — integer', () => {
  const s = primitiveSchema(scalar('integer'));
  it('coerces numeric string', () => {
    expect(s.safeParse('42')).toMatchObject({ success: true, data: 42 });
  });
  it('passes through number', () => {
    expect(s.safeParse(42)).toMatchObject({ success: true, data: 42 });
  });
  it('rejects non-integer numeric string', () => {
    expect(s.safeParse('1.5').success).toBe(false);
  });
  it('rejects non-numeric string', () => {
    expect(s.safeParse('abc').success).toBe(false);
  });
});

describe('primitiveSchema — string', () => {
  const s = primitiveSchema(scalar('string'));
  it('accepts string', () => {
    expect(s.safeParse('hello').success).toBe(true);
  });
  it('rejects number', () => {
    expect(s.safeParse(42).success).toBe(false);
  });
});

describe('primitiveSchema — boolean', () => {
  const s = primitiveSchema(scalar('boolean'));
  it("coerces 'true' and '1' to true", () => {
    expect(s.safeParse('true')).toMatchObject({ success: true, data: true });
    expect(s.safeParse('1')).toMatchObject({ success: true, data: true });
  });
  it("coerces 'false' and '0' to false", () => {
    expect(s.safeParse('false')).toMatchObject({ success: true, data: false });
    expect(s.safeParse('0')).toMatchObject({ success: true, data: false });
  });
  it('passes through native booleans', () => {
    expect(s.safeParse(true)).toMatchObject({ success: true, data: true });
    expect(s.safeParse(false)).toMatchObject({ success: true, data: false });
  });
  it('rejects other strings', () => {
    expect(s.safeParse('yes').success).toBe(false);
  });
});

describe('primitiveSchema — date', () => {
  const s = primitiveSchema(scalar('date'));
  it('accepts YYYY-MM-DD', () => {
    expect(s.safeParse('2024-01-15')).toMatchObject({ success: true, data: '2024-01-15' });
  });
  it('rejects YYYY-MM-DD with time', () => {
    expect(s.safeParse('2024-01-15T10:00:00Z').success).toBe(false);
  });
  it('rejects non-date string', () => {
    expect(s.safeParse('not-a-date').success).toBe(false);
  });
});

describe('primitiveSchema — datetime', () => {
  const s = primitiveSchema(scalar('datetime'));
  it('accepts ISO with Z', () => {
    expect(s.safeParse('2024-01-15T10:20:30Z')).toMatchObject({
      success: true,
      data: '2024-01-15T10:20:30Z',
    });
  });
  it('accepts ISO with fractional seconds', () => {
    expect(s.safeParse('2024-01-15T10:20:30.123Z').success).toBe(true);
  });
  it('accepts ISO with tz offset', () => {
    expect(s.safeParse('2024-01-15T10:20:30+02:00').success).toBe(true);
  });
  it('rejects plain date', () => {
    expect(s.safeParse('2024-01-15').success).toBe(false);
  });
});

describe('primitiveSchema — decimal', () => {
  const s = primitiveSchema(scalar('decimal'));
  it('accepts numeric string', () => {
    expect(s.safeParse('123.45')).toMatchObject({ success: true, data: '123.45' });
  });
  it('accepts negative', () => {
    expect(s.safeParse('-0.5').success).toBe(true);
  });
  it('accepts integer-looking decimal', () => {
    expect(s.safeParse('100').success).toBe(true);
  });
  it('rejects native number (must be string)', () => {
    expect(s.safeParse(123.45).success).toBe(false);
  });
  it('rejects non-numeric', () => {
    expect(s.safeParse('abc').success).toBe(false);
  });
});

describe('primitiveSchema — list<integer>', () => {
  const s = primitiveSchema({ kind: 'list', element: 'integer' });
  it('accepts array of numeric strings', () => {
    expect(s.safeParse(['1', '2', '3'])).toMatchObject({
      success: true,
      data: [1, 2, 3],
    });
  });
  it('wraps single scalar into array', () => {
    expect(s.safeParse('42')).toMatchObject({ success: true, data: [42] });
  });
  it('rejects non-integer element', () => {
    expect(s.safeParse(['1', 'abc']).success).toBe(false);
  });
  it('accepts empty array', () => {
    expect(s.safeParse([])).toMatchObject({ success: true, data: [] });
  });
});

describe('primitiveSchema — list<string>', () => {
  const s = primitiveSchema({ kind: 'list', element: 'string' });
  it('accepts array of strings', () => {
    expect(s.safeParse(['a', 'b'])).toMatchObject({
      success: true,
      data: ['a', 'b'],
    });
  });
});
