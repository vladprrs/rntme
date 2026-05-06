import type { ValidatedBindings, GraphInput } from '@rntme/bindings';
import { scalarToProto } from './scalars.js';
import { bindingIdToRpcName, shapeNameToMessageName, toSnakeCase } from './ids.js';

export type ServiceEmitResult = {
  serviceBlock: string;
  messageBlocks: string[];
  usesStructResponse: boolean;
};

export function buildServiceBlock(
  validated: ValidatedBindings,
  serviceName: string,
): ServiceEmitResult {
  const rpcs: string[] = [];
  const messageBlocks: string[] = [];

  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const rpcName = bindingIdToRpcName(bindingId);
    const reqName = `${rpcName}Request`;
    const resName = `${rpcName}Response`;

    messageBlocks.push(buildRequestMessage(reqName, resolved.signature.inputs));
    messageBlocks.push(buildResponseMessage(resName));

    rpcs.push(`  rpc ${rpcName} (${reqName}) returns (${resName});`);
  }

  return {
    serviceBlock: `service ${serviceName} {\n${rpcs.join('\n')}\n}`,
    messageBlocks,
    usesStructResponse: Object.keys(validated.resolved).length > 0,
  };
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

function buildResponseMessage(name: string): string {
  return [
    `message ${name} {`,
    '  google.protobuf.Struct result = 1;',
    '}',
  ].join('\n');
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
