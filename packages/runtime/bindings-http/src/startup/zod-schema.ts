import { z } from 'zod';
import type { GraphSignature, HttpParameter, InputMode } from '@rntme/bindings';
import { primitiveSchema } from './primitive-schema.js';

export type BuiltSchemas = {
  querySchema: z.ZodTypeAny;
  pathSchema: z.ZodTypeAny;
  bodySchema?: z.ZodTypeAny;
};

export function buildSchemas(parameters: HttpParameter[], signature: GraphSignature): BuiltSchemas {
  const byLocation: Record<'query' | 'path' | 'body', Record<string, z.ZodTypeAny>> = {
    query: {},
    path: {},
    body: {},
  };

  for (const p of parameters) {
    const input = signature.inputs[p.bindTo];
    if (!input) {
      throw new Error(`buildSchemas: unknown bindTo "${p.bindTo}" (should be prevented by validateBindings)`);
    }

    let schema = primitiveSchema(input.type);

    if (isNullable(input.mode, p.in)) {
      schema = schema.nullable();
    }

    if (!p.required) {
      schema = schema.optional();
    }

    byLocation[p.in][p.name] = schema;
  }

  const bodyKeys = Object.keys(byLocation.body);

  return {
    querySchema: z.object(byLocation.query).strict(),
    pathSchema: z.object(byLocation.path).strict(),
    ...(bodyKeys.length > 0 ? { bodySchema: z.object(byLocation.body).strict() } : {}),
  };
}

function isNullable(mode: InputMode, location: 'query' | 'path' | 'body'): boolean {
  // Only the `nullable` mode yields null-acceptance at the schema level.
  // For query/path, JSON `null` is unrepresentable anyway; nullable only matters in body.
  if (mode !== 'nullable') return false;
  return location === 'body';
}
