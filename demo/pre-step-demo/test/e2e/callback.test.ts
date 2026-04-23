import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadService, startService, type RunningService } from '@rntme/runtime';
import { startFakePayments } from '../../src/fake-payments-module.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const artifactDir = resolve(here, '..', '..', 'artifacts');
const protoPath = resolve(artifactDir, 'protos', 'payments.proto');

let running: RunningService;
let stopFake: () => Promise<void>;

beforeAll(async () => {
  stopFake = await startFakePayments('127.0.0.1:60051', protoPath);
  const loaded = loadService(artifactDir);
  if (!loaded.ok) throw new Error(`load failed: ${JSON.stringify(loaded.errors)}`);
  running = await startService(loaded.value, { artifactDir });
}, 30_000);

afterAll(async () => {
  await running.stop();
  await stopFake();
});

describe('P2 callback E2E', () => {
  it('GET /oauth/stripe/callback → 302 Location', async () => {
    const resp = await fetch(`http://127.0.0.1:${running.httpPort}/api/oauth/stripe/callback?state=abc&code=xyz`, {
      redirect: 'manual',
    });
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toMatch(/^\/app\/connected\?flow=/);
  });

  it('missing query param returns 400', async () => {
    const resp = await fetch(`http://127.0.0.1:${running.httpPort}/api/oauth/stripe/callback?state=abc`, {
      redirect: 'manual',
    });
    expect(resp.status).toBe(400);
  });
});
