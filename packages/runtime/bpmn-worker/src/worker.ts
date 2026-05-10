import type { WorkflowArtifact, WorkflowEventRef } from '@rntme/workflows';

import type { RntmeCommandClient } from './command-client.js';
import { evaluateMappingValue } from './mapping.js';
import { buildCommandMetadata } from './metadata.js';
import type { NativeHandlerFn } from './native-handlers.js';
import type { OperatonClient } from './operaton.js';
import type { EventEnvelopeLike } from './types.js';

export type RunWorkflowEventOnceInput = {
  readonly manifest: WorkflowArtifact;
  readonly event: EventEnvelopeLike;
  readonly eventRef: WorkflowEventRef;
  readonly operaton: OperatonClient;
  readonly commands: RntmeCommandClient;
  readonly nativeHandlers?: ReadonlyMap<string, NativeHandlerFn>;
  readonly maxTaskFetches?: number;
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

  const maxTaskFetches = input.maxTaskFetches ?? 8;
  const handledTaskIds = new Set<string>();
  for (let pass = 0; pass < maxTaskFetches; pass += 1) {
    const tasks = await input.operaton.fetchAndLock();
    let progressed = false;
    for (const task of tasks.filter((candidate) => candidate.processInstanceId === process.processInstanceId)) {
      if (handledTaskIds.has(task.id)) continue;

      const nativeKey = `${start.definition}.${task.taskId}`;
      const nativeFn = input.nativeHandlers?.get(nativeKey);
      const mapping = input.manifest.serviceTasks.find(
        (candidate) => candidate.definition === start.definition && candidate.taskId === task.taskId,
      );
      const native = nativeMapping(input.manifest, start.definition, task.taskId);

      if (nativeFn !== undefined && mapping !== undefined) {
        await input.operaton.failTask(
          task.id,
          `WORKFLOW_TASK_AMBIGUOUS_DISPATCH: task "${nativeKey}" matched both a nativeTask and a serviceTask`,
        );
        handledTaskIds.add(task.id);
        progressed = true;
        continue;
      }

      if (nativeFn === undefined && mapping === undefined) {
        await input.operaton.failTask(
          task.id,
          `WORKFLOW_TASK_HANDLER_MISSING: no nativeTask or serviceTask mapping for "${nativeKey}"`,
        );
        handledTaskIds.add(task.id);
        progressed = true;
        continue;
      }

      try {
        if (nativeFn !== undefined) {
          const nativeInput = Object.fromEntries(
            Object.entries(native?.input ?? {}).map(([key, value]) => [
              key,
              evaluateMappingValue(value, { event: input.event, process: task.variables }),
            ]),
          );
          const processVars = (task.variables ?? {}) as Readonly<Record<string, unknown>>;
          const result = await nativeFn(nativeInput, processVars);
          const completionVars =
            native?.resultVariable === undefined ? {} : { [native.resultVariable]: result };
          await input.operaton.completeTask(task.id, completionVars);
        } else if (mapping !== undefined) {
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
        }
      } catch (cause) {
        await input.operaton.failTask(task.id, cause instanceof Error ? cause.message : String(cause));
      }
      handledTaskIds.add(task.id);
      progressed = true;
    }
    if (!progressed) break;
  }
}

function nativeMapping(
  manifest: WorkflowArtifact,
  definition: string,
  taskId: string,
): WorkflowArtifact['nativeTasks'][number] | undefined {
  return manifest.nativeTasks?.find((n) => n.definition === definition && n.taskId === taskId);
}
