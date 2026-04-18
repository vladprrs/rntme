// Adapted from plan: demo's `resolve` transition has affects=["resolvedAt"] (no projectId
// in the IssueResolve payload), so this test instead exercises the `report` transition —
// eventType "IssueReport" carries `projectId` — and groups by projectId. The dedup semantics
// (seen_events as the sole idempotency gate for derived projections) are identical.
import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  loadService,
  startService,
  BetterSqliteDriver,
  InMemoryBus,
  type DbDriver,
  type DbHandle,
  type DbOpenOpts,
  type EventBus,
  type RunningService,
} from '@rntme/runtime';

// Minimal structural types sufficient for this test; avoids a direct
// dev-dep on better-sqlite3 / @rntme/event-store in the demo package.
type SqlDb = {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
};

// Post-D9 (CloudEvents binary content mode): each Kafka message carries the
// envelope's CE attributes in headers (ce_*) and only the data payload in
// `value`. We capture the raw wire message so re-publishing is a 1:1 resend
// — no envelope re-encoding is needed in the test.
type KafkaMessageLike = {
  topic: string;
  key: string;
  headers: Record<string, string>;
  value: string;
};

type KafkaProducerLike = { send(message: KafkaMessageLike): Promise<void> };

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, '..', 'artifacts');

/**
 * DbDriver wrapper that captures the QSM handle on first open so the test can
 * query projection / seen_events tables directly.
 */
class CapturingDbDriver implements DbDriver {
  private readonly inner = new BetterSqliteDriver();
  public qsmDb: DbHandle | null = null;
  open(opts: DbOpenOpts): DbHandle {
    const handle = this.inner.open(opts);
    if (opts.purpose === 'qsm') this.qsmDb = handle;
    return handle;
  }
}

/**
 * EventBus wrapper that records every wire message produced so the test can
 * simulate duplicate delivery by re-sending one through the producer path.
 *
 * The CE eventType lives in the `ce_type` header as
 * `${serviceName}.${rntAggregateType}.${eventType}`; we expose a small finder
 * for it so callers can stay header-agnostic.
 */
class CapturingBus implements EventBus {
  private readonly inner: InMemoryBus;
  public readonly captured: KafkaMessageLike[] = [];
  constructor() {
    this.inner = new InMemoryBus({ pollIntervalMs: 2 });
  }
  producer(): KafkaProducerLike {
    const innerProducer = this.inner.producer() as unknown as KafkaProducerLike;
    const captured = this.captured;
    return {
      async send(message: KafkaMessageLike): Promise<void> {
        captured.push(message);
        await innerProducer.send(message);
      },
    };
  }
  consumer(opts: { groupId: string; topic: string }): ReturnType<InMemoryBus['consumer']> {
    return this.inner.consumer(opts);
  }
  /** First captured message whose CE local eventType (last segment of ce_type) matches. */
  findByEventType(eventType: string): KafkaMessageLike | undefined {
    return this.captured.find((m) => m.headers.ce_type?.endsWith(`.${eventType}`));
  }
  /**
   * Re-publish an already-captured wire message straight through the producer
   * path to simulate at-least-once duplicate delivery from the bus.
   */
  async republish(message: KafkaMessageLike): Promise<void> {
    const p = this.inner.producer() as unknown as KafkaProducerLike;
    await p.send(message);
  }
}

let running: RunningService | null = null;

afterEach(async () => {
  if (running) await running.stop();
  running = null;
});

async function waitFor<T>(
  probe: () => T | null | undefined,
  { timeoutMs = 10_000, intervalMs = 20 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = probe();
    if (v !== null && v !== undefined && v !== false) return v as T;
    await delay(intervalMs);
  }
  throw new Error('waitFor: timed out');
}

type CountRow = { projectId: number; count: number };

function queryCounts(db: SqlDb): CountRow[] {
  return db
    .prepare('SELECT "projectId" AS projectId, "count" AS count FROM projection_reported_count ORDER BY "projectId"')
    .all() as CountRow[];
}

function querySeenEventsCount(db: SqlDb, projection: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM seen_events WHERE projection_id = ?')
    .get(projection) as { c: number };
  return row.c;
}

describe('derived-projection — IssueReport rollup + dedup via seen_events', () => {
  it('counts reports per project and dedupes re-delivered envelopes', async () => {
    const loaded = loadService(artifactsDir);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));

    const db = new CapturingDbDriver();
    const bus = new CapturingBus();
    running = await startService(loaded.value, { db, bus, skipSeed: true });

    const qsmHandle = db.qsmDb;
    if (!qsmHandle) throw new Error('qsmDb was not captured by the driver');
    const qsm = qsmHandle as unknown as SqlDb;

    const base = `http://127.0.0.1:${running.httpPort}`;
    const headers = { 'content-type': 'application/json', 'x-actor-id': 'alice' };

    // Three IssueReport commands across two projects: projectId=1 twice, projectId=2 once.
    const commands = [
      { issueId: 99001, title: 'A', projectId: 1, reporterId: 1, priority: 'low',  storyPoints: 1 },
      { issueId: 99002, title: 'B', projectId: 1, reporterId: 1, priority: 'mid',  storyPoints: 2 },
      { issueId: 99003, title: 'C', projectId: 2, reporterId: 1, priority: 'high', storyPoints: 3 },
    ];
    for (const body of commands) {
      const res = await fetch(`${base}/api/v1/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(200);
    }

    // Wait for the consumer to apply all three envelopes to the derived projection.
    const counts = await waitFor(() => {
      const rows = queryCounts(qsm);
      return rows.length === 2 ? rows : null;
    });

    expect(counts).toEqual([
      { projectId: 1, count: 2 },
      { projectId: 2, count: 1 },
    ]);
    expect(querySeenEventsCount(qsm, 'reportedIssueCountByProject')).toBe(3);

    // Wait for all three wire messages to reach the bus-capture list so we
    // can pick a stable one to duplicate (producer is async).
    await waitFor(() => bus.captured.length >= 3);
    const duplicate = bus.findByEventType('IssueReport');
    if (!duplicate) throw new Error('no IssueReport message captured');

    await bus.republish(duplicate);

    // Marker event with a fresh event_id and unique projectId, posted AFTER
    // the duplicate. The InMemoryBus consumer is FIFO, so once the marker's
    // row appears in the projection the duplicate has provably been
    // processed (and skipped via seen_events). Replaces a fixed-delay
    // settle, which would let dedup regressions trivially pass on a slow CI.
    const markerRes = await fetch(`${base}/api/v1/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        issueId: 99004,
        title: 'Marker',
        projectId: 99,
        reporterId: 1,
        priority: 'low',
        storyPoints: 1,
      }),
    });
    expect(markerRes.status).toBe(200);

    await waitFor(() => {
      const rows = queryCounts(qsm);
      return rows.length === 3 ? rows : null;
    });

    const countsAfter = queryCounts(qsm);
    expect(countsAfter).toEqual([
      { projectId: 1, count: 2 },
      { projectId: 2, count: 1 },
      { projectId: 99, count: 1 },
    ]);
    // 3 originals + marker = 4. If dedup were broken, the duplicate would
    // also have inserted a (event_id, projection_id) row → 5.
    expect(querySeenEventsCount(qsm, 'reportedIssueCountByProject')).toBe(4);
  }, 30_000);
});
