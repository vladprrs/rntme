import type { WorkflowArtifact, WorkflowEventRef } from '@rntme/workflows';

import type { RntmeCommandClient } from './command-client.js';
import { evaluateMappingValue } from './mapping.js';
import { buildCommandMetadata } from './metadata.js';
import type { OperatonClient } from './operaton.js';
import type { EventEnvelopeLike } from './types.js';

export type RunWorkflowEventOnceInput = {
  readonly manifest: WorkflowArtifact;
  readonly event: EventEnvelopeLike;
  readonly eventRef: WorkflowEventRef;
  readonly operaton: OperatonClient;
  readonly commands: RntmeCommandClient;
};

export async function runWorkflowEventOnce(input: RunWorkflowEventOnceInput): Promise<void> {
  const start = input.manifest.messageStarts.find(
    (candidate) =>
      candidate.event.service === input.eventRef.service &&
      candidate.event.aggregateType === input.eventRef.aggregateType &&
      candidate.event.eventType === input.eventRef.eventType,
  );
  if (start === undefined) return;

  const definition = input.manifest.definitions.find((candidate) => candidate.id === start.definition);
  if (definition === undefined) return;

  const variables = Object.fromEntries(
    Object.entries(start.variables ?? {}).map(([key, value]) => [
      key,
      evaluateMappingValue(value, { event: input.event, process: {} }),
    ]),
  );
  const businessKey = String(evaluateMappingValue(start.businessKey, { event: input.event, process: {} }) ?? '');
  const process = await input.operaton.startProcess({
    processId: definition.processId,
    messageName: start.messageName,
    businessKey,
    variables,
  });

  const tasks = await input.operaton.fetchAndLock();
  for (const task of tasks.filter((candidate) => candidate.processInstanceId === process.processInstanceId)) {
    const mapping = input.manifest.serviceTasks.find((candidate) => candidate.taskId === task.taskId);
    if (mapping === undefined) continue;

    try {
      const commandInput = Object.fromEntries(
        Object.entries(mapping.input ?? {}).map(([key, value]) => [
          key,
          evaluateMappingValue(value, { event: input.event, process: task.variables }),
        ]),
      );
      const metadata = buildCommandMetadata({
        processInstanceId: task.processInstanceId,
        taskId: task.taskId,
        activityInstanceId: task.activityInstanceId,
        sourceEventId: input.event.eventId ?? input.event.id ?? null,
        sourceCorrelationId: input.event.correlationId ?? input.event.correlationid ?? null,
        previousCommandId: null,
      });
      const result = await input.commands.execute(mapping.bindingRef, commandInput, metadata);
      const completionVars = mapping.resultVariable === undefined ? {} : { [mapping.resultVariable]: result };
      await input.operaton.completeTask(task.id, completionVars);
    } catch (cause) {
      await input.operaton.failTask(task.id, cause instanceof Error ? cause.message : String(cause));
    }
  }
}
