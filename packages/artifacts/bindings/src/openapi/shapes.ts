import type { FieldType, ResolvedShape, ScalarPrimitive, ShapeField } from '../types/resolvers.js';
import type { JsonSchema } from '../types/openapi.js';

export type ShapeEmitOptions = {
  decimalEncoding: 'string' | 'number';
};

export function primitiveToJsonSchema(
  primitive: ScalarPrimitive,
  options: ShapeEmitOptions,
): JsonSchema {
  switch (primitive) {
    case 'integer':
      return { type: 'integer' };
    case 'decimal':
      return options.decimalEncoding === 'number'
        ? { type: 'number' }
        : { type: 'string', format: 'decimal' };
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
  }
}

function withNullable(schema: JsonSchema, nullable: boolean): JsonSchema {
  if (!nullable) return schema;
  if (typeof schema.type === 'string') {
    return { ...schema, type: [schema.type, 'null'] };
  }
  // No direct "type" on schema — wrap.
  return { ...schema, type: [...(Array.isArray(schema.type) ? schema.type : []), 'null'] };
}

export function fieldToJsonSchema(field: ShapeField, options: ShapeEmitOptions): JsonSchema {
  return fieldTypeToJsonSchema(field.type, field.nullable, options);
}

function fieldTypeToJsonSchema(
  type: FieldType,
  nullable: boolean,
  options: ShapeEmitOptions,
): JsonSchema {
  switch (type.kind) {
    case 'scalar':
      return withNullable(primitiveToJsonSchema(type.primitive, options), nullable);
    case 'array': {
      const items = primitiveToJsonSchema(type.element, options);
      return withNullable({ type: 'array', items }, nullable);
    }
    case 'json':
      return {};
  }
}

export function shapeToJsonSchema(shape: ResolvedShape, options: ShapeEmitOptions): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(shape.fields)) {
    properties[name] = fieldToJsonSchema(field, options);
    required.push(name);
  }
  return { type: 'object', required, properties };
}
