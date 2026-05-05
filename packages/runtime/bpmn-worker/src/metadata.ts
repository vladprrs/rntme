import type { CommandMetadata } from './types.js';

export type CommandMetadataInput = {
  readonly processInstanceId: string;
  readonly taskId: string;
  readonly activityInstanceId: string;
  readonly sourceEventId: string | null;
  readonly sourceCorrelationId: string | null;
  readonly previousCommandId: string | null;
};

export function buildCommandMetadata(input: CommandMetadataInput): CommandMetadata {
  const commandId = `bpmn:${input.processInstanceId}:${input.taskId}:${input.activityInstanceId}`;
  return {
    commandId,
    correlationId: input.sourceCorrelationId ?? input.processInstanceId,
    causationId: input.previousCommandId ?? input.sourceEventId ?? input.processInstanceId,
  };
}
