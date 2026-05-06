import type { ValidatedBindings, ResolvedShape } from '@rntme/bindings';
import { buildServiceBlock } from './service.js';
import { shapeToProtoMessage } from './shapes.js';

export type EmitProtoOptions = {
  packageName: string;
  serviceName: string;
};

export function emitProto(
  validated: ValidatedBindings,
  shapes: Record<string, ResolvedShape>,
  options: EmitProtoOptions,
): string {
  const { serviceBlock, messageBlocks, usesStructResponse } = buildServiceBlock(validated, options.serviceName);
  const usesJsonShape = Object.values(shapes).some((shape) =>
    Object.values(shape.fields).some((field) => field.type.kind === 'json'),
  );

  const shapeBlocks = Object.entries(shapes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, shape]) => shapeToProtoMessage(name, shape));

  const parts: string[] = [];
  parts.push('// Generated from ValidatedBindings. Do not edit manually — regenerate via emitProto().');
  parts.push('syntax = "proto3";');
  parts.push('');
  parts.push(`package ${options.packageName};`);
  parts.push('');
  if (usesStructResponse || usesJsonShape) {
    parts.push('import "google/protobuf/struct.proto";');
    parts.push('');
  }

  for (const block of shapeBlocks) {
    parts.push(block);
    parts.push('');
  }
  for (const block of messageBlocks) {
    parts.push(block);
    parts.push('');
  }
  parts.push(serviceBlock);
  parts.push('');
  return parts.join('\n');
}
