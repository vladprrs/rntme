import type { ResolvedShape, FieldType } from '@rntme/bindings';
import { scalarToProto } from './scalars.js';
import { shapeNameToMessageName, toSnakeCase } from './ids.js';

function fieldTypeToProto(type: FieldType): { type: string; repeated: boolean; optionalAllowed: boolean } {
  switch (type.kind) {
    case 'scalar':
      return { type: scalarToProto(type.primitive), repeated: false, optionalAllowed: true };
    case 'array':
      return { type: scalarToProto(type.element), repeated: true, optionalAllowed: false };
    case 'json':
      return { type: 'google.protobuf.Value', repeated: false, optionalAllowed: false };
  }
}

export function shapeToProtoMessage(name: string, shape: ResolvedShape): string {
  const messageName = shapeNameToMessageName(name);
  const lines: string[] = [`message ${messageName} {`];
  let fieldNumber = 1;
  for (const [fieldName, field] of Object.entries(shape.fields)) {
    const { type, repeated, optionalAllowed } = fieldTypeToProto(field.type);
    // proto3: `repeated` fields have implicit presence and cannot use `optional`,
    // so nullable repeated/message-like fields are emitted without the label.
    const prefix = repeated ? 'repeated ' : field.nullable && optionalAllowed ? 'optional ' : '';
    const protoName = toSnakeCase(fieldName);
    lines.push(`  ${prefix}${type} ${protoName} = ${fieldNumber};`);
    fieldNumber++;
  }
  lines.push('}');
  return lines.join('\n');
}
