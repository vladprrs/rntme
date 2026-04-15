import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService, startService } from '@rntme/runtime';

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, '..', 'artifacts');

const loaded = loadService(artifactsDir);
if (!loaded.ok) {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ ok: false, errors: loaded.errors }, null, 2));
  process.exit(1);
}

const running = await startService(loaded.value);

const shutdown = async (): Promise<void> => {
  await running.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
