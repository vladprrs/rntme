import type { ResolvedShape, ShapeField, FieldType } from '@rntme/bindings';
import { scalarToProto } from './scalars.js';
import { shapeNameToMessageName } from './ids.js';

function fieldTypeToProto(type: FieldType): { type: string; repeated: boolean } {
  switch (type.kind) {
    case 'scalar':
      return { type: scalarToProto(type.primitive), repeated: false };
    case 'array':
      return { type: scalarToProto(type.element), repeated: true };
  }
}

export function shapeToProtoMessage(name: string, shape: ResolvedShape): string {
  const messageName = shapeNameToMessageName(name);
  const lines: string[] = [`message ${messageName} {`];
  let fieldNumber = 1;
  for (const [fieldName, field] of Object.entries(shape.fields)) {
    const { type, repeated } = fieldTypeToProto(field.type);
    const prefix = repeated ? 'repeated ' : field.nullable ? 'optional ' : '';
    const protoName = toSnakeCase(fieldName);
    lines.push(`  ${prefix}${type} ${protoName} = ${fieldNumber};`);
    fieldNumber++;
  }
  lines.push('}');
  return lines.join('\n');
}

function toSnakeCase(camelOrPascal: string): string {
  return camelOrPascal.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
