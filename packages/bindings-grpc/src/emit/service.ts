import type { ValidatedBindings, OutputType, GraphInput } from '@rntme/bindings';
import { scalarToProto } from './scalars.js';
import { bindingIdToRpcName, shapeNameToMessageName } from './ids.js';

export type ServiceEmitResult = {
  serviceBlock: string;
  messageBlocks: string[];
  usesCommandResult: boolean;
};

export function buildServiceBlock(
  validated: ValidatedBindings,
  serviceName: string,
): ServiceEmitResult {
  const rpcs: string[] = [];
  const messageBlocks: string[] = [];
  let usesCommandResult = false;

  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const rpcName = bindingIdToRpcName(bindingId);
    const reqName = `${rpcName}Request`;
    const resName = resolveResponseMessageName(rpcName, resolved.entry.kind, resolved.signature.output.type);
    if (resolved.entry.kind === 'command') usesCommandResult = true;

    messageBlocks.push(buildRequestMessage(reqName, resolved.signature.inputs));
    const resMessage = buildResponseMessage(resName, resolved.entry.kind, resolved.signature.output);
    if (resMessage !== null) messageBlocks.push(resMessage);

    rpcs.push(`  rpc ${rpcName} (${reqName}) returns (${resName});`);
  }

  return {
    serviceBlock: `service ${serviceName} {\n${rpcs.join('\n')}\n}`,
    messageBlocks,
    usesCommandResult,
  };
}

function resolveResponseMessageName(
  rpcName: string,
  kind: 'query' | 'command' | undefined,
  output: OutputType,
): string {
  if (kind === 'command') return 'CommandResult';
  if (output.kind === 'rowset' || output.kind === 'row') return `${rpcName}Response`;
  return `${rpcName}Response`;
}

function buildRequestMessage(name: string, inputs: Record<string, GraphInput>): string {
  const lines: string[] = [`message ${name} {`];
  let n = 1;
  for (const [inputName, input] of Object.entries(inputs)) {
    const { type, prefix } = inputToProto(input);
    const protoName = toSnakeCase(inputName);
    lines.push(`  ${prefix}${type} ${protoName} = ${n};`);
    n++;
  }
  lines.push('}');
  return lines.join('\n');
}

function buildResponseMessage(
  name: string,
  kind: 'query' | 'command' | undefined,
  output: { type: OutputType; from: string },
): string | null {
  if (kind === 'command') return null;
  const fieldName = toSnakeCase(output.from);
  switch (output.type.kind) {
    case 'rowset':
      return [
        `message ${name} {`,
        `  repeated ${shapeNameToMessageName(output.type.shape)} ${fieldName} = 1;`,
        `}`,
      ].join('\n');
    case 'row':
      return [
        `message ${name} {`,
        `  ${shapeNameToMessageName(output.type.shape)} ${fieldName} = 1;`,
        `}`,
      ].join('\n');
    case 'scalar':
      return [
        `message ${name} {`,
        `  ${scalarToProto(output.type.primitive)} ${fieldName} = 1;`,
        `}`,
      ].join('\n');
  }
}

function inputToProto(input: GraphInput): { type: string; prefix: string } {
  switch (input.type.kind) {
    case 'scalar': {
      const type = scalarToProto(input.type.primitive);
      const prefix = input.mode === 'required' ? '' : 'optional ';
      return { type, prefix };
    }
    case 'list': {
      const type = scalarToProto(input.type.element);
      return { type, prefix: 'repeated ' };
    }
    case 'row':
      return { type: shapeNameToMessageName(input.type.shape), prefix: input.mode === 'required' ? '' : 'optional ' };
    case 'rowset':
      return { type: shapeNameToMessageName(input.type.shape), prefix: 'repeated ' };
  }
}

function toSnakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
