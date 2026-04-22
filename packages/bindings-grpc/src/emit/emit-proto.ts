import type { ValidatedBindings, ResolvedShape } from '@rntme/bindings';
import { buildServiceBlock } from './service.js';
import { shapeToProtoMessage } from './shapes.js';

export type EmitProtoOptions = {
  packageName: string;
  serviceName: string;
};

const COMMAND_RESULT_BLOCK = [
  'message CommandResult {',
  '  string aggregate_id = 1;',
  '  int64 version = 2;',
  '  repeated string event_ids = 3;',
  '  string command_id = 4;',
  '  string correlation_id = 5;',
  '}',
].join('\n');

export function emitProto(
  validated: ValidatedBindings,
  shapes: Record<string, ResolvedShape>,
  options: EmitProtoOptions,
): string {
  const { serviceBlock, messageBlocks, usesCommandResult } = buildServiceBlock(validated, options.serviceName);

  const shapeBlocks = Object.entries(shapes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, shape]) => shapeToProtoMessage(name, shape));

  const parts: string[] = [];
  parts.push('// Generated from ValidatedBindings. Do not edit manually — regenerate via emitProto().');
  parts.push('syntax = "proto3";');
  parts.push('');
  parts.push(`package ${options.packageName};`);
  parts.push('');

  for (const block of shapeBlocks) {
    parts.push(block);
    parts.push('');
  }
  for (const block of messageBlocks) {
    parts.push(block);
    parts.push('');
  }
  if (usesCommandResult) {
    parts.push(COMMAND_RESULT_BLOCK);
    parts.push('');
  }
  parts.push(serviceBlock);
  parts.push('');

  const [firstLine, ...rest] = parts;
  const header = [
    '// packages/bindings-grpc/test/fixtures/golden/minimal.proto',
    firstLine,
    ...rest,
  ].join('\n');
  return header;
}
