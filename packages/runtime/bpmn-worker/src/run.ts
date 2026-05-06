import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createGrpcCommandClient, type RntmeCommandClient } from './command-client.js';
import { loadWorkerConfigFromEnv } from './env.js';
import { createKafkaWorkflowConsumer } from './kafka-consumer.js';
import { createOperatonRestClient } from './operaton-rest.js';
import type { OperatonClient } from './operaton.js';
import type { LoadedWorkerManifest, PlannedWorkflowSubscriptionInput, WorkflowEventConsumer } from './types.js';
import { runWorkflowEventOnce } from './worker.js';

export async function runBpmnWorker(input: {
  readonly manifest: LoadedWorkerManifest;
  readonly subscriptions: readonly PlannedWorkflowSubscriptionInput[];
  readonly operaton: OperatonClient;
  readonly commands: RntmeCommandClient;
  readonly consumer: WorkflowEventConsumer;
  readonly stopAfterEvents?: number;
}): Promise<void> {
  let processed = 0;
  try {
    for await (const event of input.consumer.events()) {
      await runWorkflowEventOnce({
        manifest: input.manifest,
        event: event.envelope,
        eventRef: event.eventRef,
        operaton: input.operaton,
        commands: input.commands,
      });
      await event.commit();
      processed += 1;
      if (input.stopAfterEvents !== undefined && processed >= input.stopAfterEvents) break;
    }
  } finally {
    await input.consumer.stop();
  }
}

export async function runBpmnWorkerFromEnv(env: Record<string, string | undefined> = process.env): Promise<void> {
  const config = loadWorkerConfigFromEnv(env);
  const manifest = JSON.parse(await readFile(config.workflowsManifestPath, 'utf8')) as LoadedWorkerManifest;
  const workflowRoot = dirname(config.workflowsManifestPath);
  const topics = [...new Set(manifest.serviceTasks.map((task) => task.taskId))].sort();
  const operaton = createOperatonRestClient({
    baseUrl: config.operatonBaseUrl,
    workerId: `rntme-bpmn-worker-${process.pid}`,
    topics,
  });
  await operaton.deployDefinitions(
    Object.fromEntries(
      await Promise.all(
        manifest.definitions.map(async (definition) => [
          definition.bpmnFile,
          await readFile(join(workflowRoot, definition.bpmnFile), 'utf8'),
        ]),
      ),
    ),
  );
  const commands = createGrpcCommandClient({
    endpoints: config.workflowServiceEndpoints ?? {},
    services: config.workflowGrpcServices ?? {},
  });
  const consumer = await createKafkaWorkflowConsumer({
    brokers: config.eventBusBrokers,
    clientId: 'rntme-bpmn-worker',
    groupId: `rntme-bpmn-worker-${env['HOSTNAME'] ?? 'local'}`,
    subscriptions: config.workflowSubscriptions,
  });
  await runBpmnWorker({ manifest, subscriptions: config.workflowSubscriptions, operaton, commands, consumer });
}
