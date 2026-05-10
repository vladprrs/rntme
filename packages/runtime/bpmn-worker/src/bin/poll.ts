#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { loadWorkerConfigFromEnv } from '../env.js';
import { resolveNativeHandlers } from '../native-handlers.js';
import { createOperatonRestClient } from '../operaton-rest.js';
import { runPollLoop } from '../poll-loop.js';
import type { LoadedWorkerManifest } from '../types.js';

async function main(): Promise<void> {
  const config = loadWorkerConfigFromEnv(process.env);
  const manifest = JSON.parse(await readFile(config.workflowsManifestPath, 'utf8')) as LoadedWorkerManifest;
  const root = dirname(config.workflowsManifestPath);

  const topics = [...new Set((manifest.nativeTasks ?? []).map((t) => t.taskId))].sort();
  const operaton = createOperatonRestClient({
    baseUrl: config.operatonBaseUrl,
    workerId: `rntme-deploy-worker-${process.pid}`,
    topics,
  });
  await operaton.deployDefinitions(
    Object.fromEntries(
      await Promise.all(
        manifest.definitions.map(async (def) => [def.bpmnFile, await readFile(join(root, def.bpmnFile), 'utf8')]),
      ),
    ),
  );

  const nativeHandlers = await resolveNativeHandlers({ manifest });

  // For the deploy use case, we maintain definitionByProcessInstance by querying
  // Operaton's process-instance API periodically. The poll loop reads this map
  // each fetch; the interval below refreshes it from the engine.
  const definitionByProcessInstance = new Map<string, string>();
  const refreshTimer = globalThis.setInterval(async () => {
    try {
      const list = await globalThis.fetch(`${config.operatonBaseUrl}/process-instance`, { method: 'GET' });
      if (!list.ok) return;
      const rows = (await list.json()) as Array<{ id: string; processDefinitionKey: string }>;
      definitionByProcessInstance.clear();
      for (const row of rows) {
        const def = manifest.definitions.find((d) => d.processId === row.processDefinitionKey);
        if (def !== undefined) definitionByProcessInstance.set(row.id, def.id);
      }
    } catch {
      // tolerate transient errors
    }
  }, 1_000);
  refreshTimer.unref();

  const stop = new globalThis.AbortController();
  const onSignal = (): void => stop.abort();
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    await runPollLoop({
      manifest,
      operaton,
      nativeHandlers,
      definitionByProcessInstance,
      stopSignal: stop.signal,
    });
  } finally {
    globalThis.clearInterval(refreshTimer);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

main().catch((cause) => {
  process.stderr.write(`${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`);
  process.exitCode = 1;
});
