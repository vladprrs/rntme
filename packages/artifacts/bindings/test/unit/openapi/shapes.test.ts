import { describe, it, expect } from 'bun:test';
import { fieldToJsonSchema, shapeToJsonSchema, primitiveToJsonSchema } from '../../../src/openapi/shapes.js';
import type { ResolvedShape } from '../../../src/types/resolvers.js';

describe('primitiveToJsonSchema', () => {
  it('maps integer', () => {
    expect(primitiveToJsonSchema('integer', { decimalEncoding: 'string' })).toEqual({ type: 'integer' });
  });
  it('maps decimal as string by default', () => {
    expect(primitiveToJsonSchema('decimal', { decimalEncoding: 'string' })).toEqual({
      type: 'string',
      format: 'decimal',
    });
  });
  it('maps decimal as number when option set', () => {
    expect(primitiveToJsonSchema('decimal', { decimalEncoding: 'number' })).toEqual({ type: 'number' });
  });
  it('maps string, boolean', () => {
    expect(primitiveToJsonSchema('string', { decimalEncoding: 'string' })).toEqual({ type: 'string' });
    expect(primitiveToJsonSchema('boolean', { decimalEncoding: 'string' })).toEqual({ type: 'boolean' });
  });
  it('maps date and datetime', () => {
    expect(primitiveToJsonSchema('date', { decimalEncoding: 'string' })).toEqual({
      type: 'string',
      format: 'date',
    });
    expect(primitiveToJsonSchema('datetime', { decimalEncoding: 'string' })).toEqual({
      type: 'string',
      format: 'date-time',
    });
  });
});

describe('fieldToJsonSchema', () => {
  it('maps scalar non-null', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: 'integer' });
  });

  it('maps scalar nullable with union type', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: ['string', 'null'] });
  });

  it('preserves format when adding null', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'scalar', primitive: 'datetime' }, nullable: true },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: ['string', 'null'], format: 'date-time' });
  });

  it('maps array of scalar', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'array', element: 'integer' }, nullable: false },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: 'array', items: { type: 'integer' } });
  });

  it('maps nullable array as union on outer type', () => {
    expect(
      fieldToJsonSchema(
        { type: { kind: 'array', element: 'integer' }, nullable: true },
        { decimalEncoding: 'string' },
      ),
    ).toEqual({ type: ['array', 'null'], items: { type: 'integer' } });
  });
});

describe('shapeToJsonSchema', () => {
  const shape: ResolvedShape = {
    name: 'Row',
    origin: 'custom',
    fields: {
      id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
      name: { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
    },
  };

  it('produces an object schema with all fields required', () => {
    expect(shapeToJsonSchema(shape, { decimalEncoding: 'string' })).toEqual({
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: ['string', 'null'] },
      },
    });
  });
});
