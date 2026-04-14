import type { HttpParameter } from '../types/artifact.js';
import type { GraphInput, InputType } from '../types/resolvers.js';
import type { JsonSchema, ParameterObject, RequestBodyObject } from '../types/openapi.js';
import { primitiveToJsonSchema, type ShapeEmitOptions } from './shapes.js';

function inputTypeToSchema(type: InputType, options: ShapeEmitOptions): JsonSchema {
  switch (type.kind) {
    case 'scalar':
      return primitiveToJsonSchema(type.primitive, options);
    case 'list':
      return { type: 'array', items: primitiveToJsonSchema(type.element, options) };
    case 'row':
    case 'rowset':
      // Unreachable after consistency validation, but keep a total function.
      return { type: 'object' };
  }
}

function schemaWithDefault(schema: JsonSchema, input: GraphInput): JsonSchema {
  if (input.mode === 'defaulted' && input.default !== undefined) {
    return { ...schema, default: input.default };
  }
  return schema;
}

export function inputToParameter(
  param: HttpParameter,
  input: GraphInput,
  options: ShapeEmitOptions,
): ParameterObject {
  const baseSchema = schemaWithDefault(inputTypeToSchema(input.type, options), input);

  const result: ParameterObject = {
    name: param.name,
    in: param.in === 'body' ? 'query' : param.in, // body never reaches here
    required: param.required,
    schema: baseSchema,
  };

  if (param.in === 'query' && input.type.kind === 'list') {
    result.style = 'form';
    result.explode = true;
  }

  if (param.description !== undefined) result.description = param.description;

  return result;
}

export function collectRequestBody(
  parameters: HttpParameter[],
  inputs: Record<string, GraphInput>,
  options: ShapeEmitOptions,
): RequestBodyObject | undefined {
  const bodyParams = parameters.filter((p) => p.in === 'body');
  if (bodyParams.length === 0) return undefined;

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const p of bodyParams) {
    const input = inputs[p.bindTo];
    if (input === undefined) continue; // already flagged by reference layer
    properties[p.name] = schemaWithDefault(inputTypeToSchema(input.type, options), input);
    if (p.required) required.push(p.name);
  }

  const schema: JsonSchema = { type: 'object', required, properties };
  return {
    required: true,
    content: { 'application/json': { schema } },
  };
}
