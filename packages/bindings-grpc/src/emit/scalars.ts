import type { ScalarPrimitive } from '@rntme/bindings';

export function scalarToProto(primitive: ScalarPrimitive): string {
  switch (primitive) {
    case 'integer':  return 'int64';
    case 'decimal':  return 'string';
    case 'string':   return 'string';
    case 'boolean':  return 'bool';
    case 'date':     return 'string';
    case 'datetime': return 'string';
  }
}
