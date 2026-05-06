import type { OperatonClient, OperatonStartProcessInput, OperatonTask } from './operaton.js';

export type OperatonRestClient = OperatonClient & {
  readonly deployDefinitions: (files: Readonly<Record<string, string>>) => Promise<void>;
};

export function createOperatonRestClient(options: {
  readonly baseUrl: string;
  readonly workerId: string;
  readonly topics: readonly string[];
  readonly fetch?: typeof globalThis.fetch;
  readonly lockDurationMs?: number;
  readonly maxTasks?: number;
  readonly asyncResponseTimeoutMs?: number;
}): OperatonRestClient {
  const httpFetch = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const lockDuration = options.lockDurationMs ?? 30_000;
  const maxTasks = options.maxTasks ?? 8;
  const asyncResponseTimeout = options.asyncResponseTimeoutMs ?? 10_000;

  async function json<T>(path: string, body: unknown): Promise<T> {
    const response = await httpFetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`OPERATON_HTTP_${response.status}: ${await response.text()}`);
    const text = await response.text();
    return (text.trim() === '' ? {} : JSON.parse(text)) as T;
  }

  return {
    async deployDefinitions(files) {
      const form = new FormData();
      form.set('deployment-name', 'rntme-workflows');
      form.set('enable-duplicate-filtering', 'true');
      for (const [name, content] of Object.entries(files).filter(([path]) => path.endsWith('.bpmn'))) {
        form.set(name, new Blob([content], { type: 'application/xml' }), name);
      }
      const response = await httpFetch(`${baseUrl}/deployment/create`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(`OPERATON_HTTP_${response.status}: ${await response.text()}`);
    },
    async startProcess(input: OperatonStartProcessInput) {
      const result = await json<Array<{ processInstance?: { id?: string } }>>('/message', {
        messageName: input.messageName,
        businessKey: input.businessKey,
        processVariables: toOperatonVariables(input.variables),
        resultEnabled: true,
      });
      const id = result[0]?.processInstance?.id;
      if (typeof id !== 'string' || id === '') {
        throw new Error(`OPERATON_MESSAGE_NOT_CORRELATED: ${input.messageName}`);
      }
      return { processInstanceId: id };
    },
    async fetchAndLock() {
      const result = await json<readonly OperatonExternalTask[]>('/external-task/fetchAndLock', {
        workerId: options.workerId,
        maxTasks,
        usePriority: true,
        asyncResponseTimeout,
        topics: options.topics.map((topicName) => ({ topicName, lockDuration })),
      });
      return result.map(toTask);
    },
    async completeTask(taskId, variables) {
      await json(`/external-task/${encodeURIComponent(taskId)}/complete`, {
        workerId: options.workerId,
        variables: toOperatonVariables(variables),
      });
    },
    async failTask(taskId, message) {
      await json(`/external-task/${encodeURIComponent(taskId)}/failure`, {
        workerId: options.workerId,
        errorMessage: message.slice(0, 666),
        errorDetails: message,
        retries: 0,
        retryTimeout: 0,
      });
    },
  };
}

type OperatonExternalTask = {
  readonly id: string;
  readonly activityId?: string;
  readonly taskId?: string;
  readonly processInstanceId: string;
  readonly activityInstanceId: string;
  readonly variables?: Readonly<Record<string, { readonly value?: unknown }>>;
};

function toTask(task: OperatonExternalTask): OperatonTask {
  return {
    id: task.id,
    taskId: task.activityId ?? task.taskId ?? '',
    processInstanceId: task.processInstanceId,
    activityInstanceId: task.activityInstanceId,
    variables: Object.fromEntries(Object.entries(task.variables ?? {}).map(([key, value]) => [key, value.value])),
  };
}

function toOperatonVariables(input: unknown): Record<string, { value: unknown; type: string }> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, toVariable(value)]),
  );
}

function toVariable(value: unknown): { value: unknown; type: string } {
  if (Number.isInteger(value)) return { value, type: 'Integer' };
  if (typeof value === 'number') return { value, type: 'Double' };
  if (typeof value === 'boolean') return { value, type: 'Boolean' };
  if (value === null) return { value: null, type: 'Null' };
  if (typeof value === 'object') return { value: JSON.stringify(value), type: 'Json' };
  return { value: String(value), type: 'String' };
}
