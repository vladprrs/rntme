import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

describe('startService shutdown', () => {
  it('closes the listener and the pipeline', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const running = await startService(loaded.value);
    const port = running.httpPort;
    await running.stop();

    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });
});
