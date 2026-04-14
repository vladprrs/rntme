import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/server.js';
import type { Hono } from 'hono';

let app: Hono;
let stop: () => Promise<void>;

beforeAll(async () => {
  const built = buildApp();
  app = built.app;
  stop = built.stop;
});

afterAll(async () => {
  await stop();
});

describe('server wires commands', () => {
  it('POST /v1/issues returns 200 CommandResult', async () => {
    const res = await app.fetch(new Request('http://x/v1/issues', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        issueId: 5000,
        title: 'wire test',
        projectId: 1,
        reporterId: 1,
        priority: 'low',
        storyPoints: 1,
      }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { aggregateId: string; version: number; eventIds: string[] };
    expect(body.aggregateId).toBe('5000');
    expect(body.version).toBe(1);
    expect(body.eventIds).toHaveLength(1);
  });

  it('OpenAPI now includes POST paths for commands', async () => {
    const res = await app.fetch(new Request('http://x/openapi.json'));
    const doc = await res.json() as { paths: Record<string, Record<string, unknown>> };
    expect(doc.paths['/v1/issues']).toHaveProperty('post');
    expect(doc.paths['/v1/issues/{issueId}/actions/assign']).toHaveProperty('post');
  });
});
