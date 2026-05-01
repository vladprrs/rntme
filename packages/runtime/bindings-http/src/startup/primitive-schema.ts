import { z } from 'zod';
import type { InputType, ScalarPrimitive } from '@rntme/bindings';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

function scalarSchema(primitive: ScalarPrimitive): z.ZodTypeAny {
  switch (primitive) {
    case 'integer':
      return z.coerce.number().int();
    case 'string':
      return z.string();
    case 'boolean':
      return z.preprocess(
        (v) =>
          typeof v === 'boolean'
            ? v
            : v === 'true' || v === '1'
              ? true
              : v === 'false' || v === '0'
                ? false
                : v,
        z.boolean(),
      );
    case 'date':
      return z.string().regex(ISO_DATE_RE);
    case 'datetime':
      return z.string().regex(ISO_DATETIME_RE);
    case 'decimal':
      return z.string().regex(DECIMAL_RE);
  }
}

export function primitiveSchema(type: InputType): z.ZodTypeAny {
  if (type.kind === 'scalar') {
    return scalarSchema(type.primitive);
  }
  if (type.kind === 'list') {
    return z.preprocess(
      (v) => (Array.isArray(v) ? v : v === undefined ? v : [v]),
      z.array(scalarSchema(type.element)),
    );
  }
  throw new Error(`primitiveSchema: unsupported input type kind "${(type as { kind: string }).kind}"`);
}
