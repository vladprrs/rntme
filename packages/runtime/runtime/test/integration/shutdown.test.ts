import { describe, it, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';
import { startService } from '../../src/start/start-service.js';
import type { Surface } from '../../src/plugins/interfaces.js';

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

  it('bounds stop when an HTTP request never completes', async () => {
    const loaded = loadService(fixtureDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

    let markEntered: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    const hangingSurface: Surface = {
      mount(app) {
        app.get('/hang', () => {
          markEntered();
          return new Promise<Response>(() => undefined);
        });
      },
    };
    const running = await startService(loaded.value, {
      surfaces: [hangingSurface],
      shutdownTimeoutMs: 25,
    });
    const controller = new globalThis.AbortController();
    const pendingFetch = fetch(`http://127.0.0.1:${running.httpPort}/hang`, {
      signal: controller.signal,
    }).catch((err: unknown) => err);
    let stopped = false;

    try {
      await entered;
      const startedAt = Date.now();
      await running.stop();
      stopped = true;
      expect(Date.now() - startedAt).toBeLessThan(1000);
    } finally {
      controller.abort();
      await pendingFetch;
      if (!stopped) await running.stop();
    }
  });
});
