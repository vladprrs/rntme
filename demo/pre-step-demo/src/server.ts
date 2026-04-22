// demo/pre-step-demo/src/server.ts
import { loadService, startService } from '@rntme/runtime';
import { startFakePayments } from './fake-payments-module.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const artifactDir = resolve(here, '..', 'artifacts');
const protoPath = resolve(artifactDir, 'protos', 'payments.proto');

async function main(): Promise<void> {
  const stopFake = await startFakePayments('127.0.0.1:60051', protoPath);

  const loaded = loadService(artifactDir);
  if (!loaded.ok) {
    console.error(JSON.stringify({ ok: false, errors: loaded.errors }, null, 2));
    process.exit(1);
  }

  const running = await startService(loaded.value, { artifactDir });

  const shutdown = async (): Promise<void> => {
    await running.stop();
    await stopFake();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
