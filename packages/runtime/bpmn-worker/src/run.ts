import { loadWorkerConfigFromEnv } from './env.js';

export async function runBpmnWorkerFromEnv(env: Record<string, string | undefined> = process.env): Promise<void> {
  loadWorkerConfigFromEnv(env);
  throw new Error('BPMN_WORKER_RUN_LOOP_NOT_IMPLEMENTED');
}
