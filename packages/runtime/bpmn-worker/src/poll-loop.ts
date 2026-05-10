import type { WorkflowArtifact } from '@rntme/workflows';

import { evaluateMappingValue } from './mapping.js';
import type { NativeHandlerFn } from './native-handlers.js';
import type { OperatonClient } from './operaton.js';

export type RunPollOnceInput = {
  readonly manifest: WorkflowArtifact;
  readonly operaton: OperatonClient;
  readonly nativeHandlers: ReadonlyMap<string, NativeHandlerFn>;
  /**
   * Map from active processInstanceId to its definitionId. The poll worker
   * maintains this externally (e.g., by listening on Kafka or by querying
   * Operaton at startup). For deploy, the queueDeployment graph emits an event
   * that triggers a process start; we record (pi → definition) when we observe
   * the start.
   */
  readonly definitionByProcessInstance: ReadonlyMap<string, string>;
};

export async function runPollOnce(input: RunPollOnceInput): Promise<void> {
  const tasks = await input.operaton.fetchAndLock();
  for (const task of tasks) {
    const definition = input.definitionByProcessInstance.get(task.processInstanceId);
    if (definition === undefined) {
      await input.operaton.failTask(
        task.id,
        `WORKFLOW_PROCESS_DEFINITION_UNKNOWN: no definition recorded for processInstanceId=${task.processInstanceId}`,
      );
      continue;
    }
    const key = `${definition}.${task.taskId}`;
    const handler = input.nativeHandlers.get(key);
    if (handler === undefined) {
      await input.operaton.failTask(
        task.id,
        `WORKFLOW_TASK_HANDLER_MISSING: no nativeTask handler for "${key}"`,
      );
      continue;
    }
    const native = (input.manifest.nativeTasks ?? []).find(
      (n) => n.definition === definition && n.taskId === task.taskId,
    );
    try {
      const processVars = (task.variables ?? {}) as Readonly<Record<string, unknown>>;
      const inputVars = Object.fromEntries(
        Object.entries(native?.input ?? {}).map(([k, v]) => [
          k,
          evaluateMappingValue(v, { event: { data: undefined }, process: processVars }),
        ]),
      );
      const result = await handler(inputVars, processVars);
      const vars =
        native?.resultVariable === undefined ? {} : { [native.resultVariable]: result };
      await input.operaton.completeTask(task.id, vars);
    } catch (cause) {
      await input.operaton.failTask(task.id, cause instanceof Error ? cause.message : String(cause));
    }
  }
}

export type RunPollLoopInput = RunPollOnceInput & {
  readonly intervalMs?: number;
  readonly stopSignal?: globalThis.AbortSignal;
};

export async function runPollLoop(input: RunPollLoopInput): Promise<void> {
  const intervalMs = input.intervalMs ?? 500;
  while (!(input.stopSignal?.aborted ?? false)) {
    try {
      await runPollOnce(input);
    } catch {
      // swallow to keep looping; individual task errors are reported via failTask
    }
    if (input.stopSignal?.aborted ?? false) break;
    await new Promise((resolve) => globalThis.setTimeout(resolve, intervalMs));
  }
}
