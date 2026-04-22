// demo/pre-step-demo/test/e2e/pre-step.test.ts
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

describe('pre-step demo E2E', () => {
  it('executes a pre[] module call before emitting the command event', async () => {
    const resp = await fetch(`http://127.0.0.1:${running.httpPort}/api/commands/createOrder`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'test-key-1' },
      body: JSON.stringify({ orderId: 1, userId: 'u-42', amount: 100 }),
    });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { aggregateId: string };
    expect(typeof body.aggregateId).toBe('string');
  });

  it('replays cached response on second call with same Idempotency-Key', async () => {
    const headers = { 'content-type': 'application/json', 'Idempotency-Key': 'test-key-2' };
    const body = JSON.stringify({ orderId: 2, userId: 'u-43', amount: 200 });
    const r1 = await fetch(`http://127.0.0.1:${running.httpPort}/api/commands/createOrder`, {
      method: 'POST',
      headers,
      body,
    });
    await new Promise((r) => setTimeout(r, 100)); // Wait for cache write
    const r2 = await fetch(`http://127.0.0.1:${running.httpPort}/api/commands/createOrder`, {
      method: 'POST',
      headers,
      body,
    });
    expect(r2.headers.get('Idempotency-Replay')).toBe('true');
    const t1 = await r1.text();
    const t2 = await r2.text();
    expect(t1).toBe(t2);
  });
});
