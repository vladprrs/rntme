import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/server.js';
import type { Hono } from 'hono';

let app: Hono;
let stop: () => Promise<void>;

beforeAll(() => {
  const built = buildApp();
  app = built.app;
  stop = built.stop;
});

afterAll(async () => {
  await stop();
});

async function post(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await app.fetch(new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-actor-id': 'alice' },
    body: JSON.stringify(body),
  }));
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await app.fetch(new Request(`http://x${path}`));
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function waitForStatus(id: number, expected: string, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { body } = await get(`/v1/issues/${id}`);
    const rows = body as Array<{ status: string }>;
    if (rows.length > 0 && rows[0]!.status === expected) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`Timeout waiting for issue ${id} status=${expected}`);
}

describe('mutations E2E — full Issue lifecycle', () => {
  const ID = 7001;

  it('report → draft', async () => {
    const { status, body } = await post('/v1/issues', {
      issueId: ID, title: 'Lifecycle test', projectId: 1, reporterId: 1,
      priority: 'high', storyPoints: 3,
    });
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(1);
    await waitForStatus(ID, 'draft');
  });

  it('submit → open', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/submit`, {});
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(2);
    await waitForStatus(ID, 'open');
  });

  it('assign → in_progress', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/assign`, { assigneeId: 2 });
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(3);
    await waitForStatus(ID, 'in_progress');
  });

  it('reassign (self-loop) stays in_progress but updates assignee', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/reassign`, { assigneeId: 3 });
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(4);
    await waitForStatus(ID, 'in_progress');

    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
      const { body: detail } = await get(`/v1/issues/${ID}`);
      const row = (detail as Array<{ assigneeUsername: string | null }>)[0]!;
      if (row.assigneeUsername === 'carol') return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('Timeout waiting for reassign to project carol');
  });

  it('resolve → resolved', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/resolve`, {
      resolvedAt: '2026-04-14T12:00:00Z',
    });
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(5);
    await waitForStatus(ID, 'resolved');
  });

  it('close → closed', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/close`, {});
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(6);
    await waitForStatus(ID, 'closed');
  });

  it('illegal transition (close on closed) returns 422', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/close`, {});
    expect(status).toBe(422);
    expect((body as { code: string }).code).toMatch(/^COMMAND_/);
  });
});

describe('mutations E2E — capacity guard', () => {
  it('rejects assign-with-guard when assignee already at capacity', async () => {
    // Commands replay from the event store — seeded projection_issue rows are not on streams.
    // Drive setup through the API so Issue-* streams exist, then fill carol (id=3) to ≥3 in_progress.
    const carol = 3;
    const fillIds = [7201, 7202];
    const guardedId = 7203;
    for (const id of fillIds) {
      expect((await post('/v1/issues', {
        issueId: id, title: `guard fill ${id}`, projectId: 1, reporterId: 1,
        priority: 'low', storyPoints: 1,
      })).status).toBe(200);
      expect((await post(`/v1/issues/${id}/actions/submit`, {})).status).toBe(200);
      expect((await post(`/v1/issues/${id}/actions/assign`, { assigneeId: carol })).status).toBe(200);
      await waitForStatus(id, 'in_progress');
    }

    expect((await post('/v1/issues', {
      issueId: guardedId, title: 'guard target', projectId: 1, reporterId: 1,
      priority: 'low', storyPoints: 1,
    })).status).toBe(200);
    expect((await post(`/v1/issues/${guardedId}/actions/submit`, {})).status).toBe(200);

    await new Promise((r) => setTimeout(r, 200));

    const { status, body } = await post(`/v1/issues/${guardedId}/actions/assign-with-guard`, {
      assigneeId: carol,
    });
    expect(status).toBe(422);
    expect((body as { code: string }).code).toBe('COMMAND_GUARD_REJECTED');
  });
});
