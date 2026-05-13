#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadService } from '../load/load-service.js';
import { startService } from '../start/start-service.js';
import type { NativeOperationHandlerMap } from '../plugins/executors/native-operation-executor.js';

function usage(): never {
  // eslint-disable-next-line no-console
  console.error('usage: rntme-runtime <start|validate> [artifacts-dir]');
  process.exit(2);
}

type OperationsJson = {
  readonly version?: unknown;
  readonly operations?: Record<
    string,
    {
      readonly handler?: {
        readonly kind?: unknown;
        readonly entry?: unknown;
        readonly export?: unknown;
      };
    }
  >;
};

export async function loadNativeHandlers(artifactDir: string): Promise<NativeOperationHandlerMap> {
  const operationsPath = join(artifactDir, 'operations.json');
  if (!existsSync(operationsPath)) return {};
  const raw = readFileSync(operationsPath, 'utf8');
  const parsed = JSON.parse(raw) as OperationsJson;
  const operations = parsed.operations ?? {};
  const handlers: NativeOperationHandlerMap = {};
  for (const [operationName, operation] of Object.entries(operations)) {
    const handler = operation?.handler;
    if (handler === undefined || handler.kind !== 'native') continue;
    if (typeof handler.entry !== 'string' || typeof handler.export !== 'string') {
      throw new Error(
        `RUNTIME_NATIVE_HANDLER_INVALID:${operationName}: handler.entry and handler.export must be strings`,
      );
    }
    const entryFile = basename(handler.entry);
    const tsPath = join(artifactDir, 'handlers', entryFile);
    const jsCandidate = tsPath.replace(/\.ts$/, '.js');
    const modulePath = existsSync(tsPath) ? tsPath : jsCandidate;
    if (!existsSync(modulePath)) {
      throw new Error(
        `RUNTIME_NATIVE_HANDLER_MISSING:${operationName}: ${tsPath} not found`,
      );
    }
    const moduleUrl = pathToFileURL(resolve(modulePath)).href;
    const mod = (await import(moduleUrl)) as Record<string, unknown>;
    const exportName = handler.export;
    const fn = mod[exportName];
    if (typeof fn !== 'function') {
      throw new Error(
        `RUNTIME_NATIVE_HANDLER_EXPORT_MISSING:${operationName}: export "${exportName}" not found in ${modulePath}`,
      );
    }
    handlers[operationName] = fn as NativeOperationHandlerMap[string];
  }
  return handlers;
}

async function main(): Promise<void> {
  const [cmd, maybeDir] = process.argv.slice(2);
  const dir = maybeDir ?? process.env.RNTME_ARTIFACTS_DIR ?? '/srv/artifacts';

  if (cmd === 'validate') {
    const r = loadService(dir);
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ ok: false, errors: r.errors }, null, 2));
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        ok: true,
        service: r.value.manifest.service.name,
        graphs: Object.keys(r.value.graphSpec.graphs).length,
      }),
    );
    return;
  }

  if (cmd === 'start') {
    const r = loadService(dir);
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ ok: false, errors: r.errors }, null, 2));
      process.exit(1);
    }
    const nativeOperationHandlers = await loadNativeHandlers(dir);
    const running = await startService(r.value, {
      artifactDir: dir,
      nativeOperationHandlers,
    });
    const shutdown = async (): Promise<void> => {
      await running.stop();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  usage();
}

if (import.meta.main) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ fatal: e instanceof Error ? e.message : String(e) }));
    process.exit(1);
  });
}
