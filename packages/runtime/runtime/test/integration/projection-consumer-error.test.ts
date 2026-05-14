import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AppendEventInput } from '@rntme/event-store';
import { BunSqliteDriver } from '../../src/plugins/bun-sqlite-driver.js';
import { InMemoryBus } from '../../src/plugins/in-memory-bus.js';
import { loadService } from '../../src/load/load-service.js';
import { wireEventPipeline } from '../../src/start/wire-event-pipeline.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

describe('projection consumer runtime wiring', () => {
  it('logs projection apply failures and keeps consuming later batches', async () => {
    const loaded = loadService(fixtureDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const errors: unknown[] = [];
    const logger = {
      error(obj: unknown) {
        errors.push(obj);
      },
    };
    const pipeline = wireEventPipeline(
      loaded.value,
      new BunSqliteDriver(),
      new InMemoryBus({ pollIntervalMs: 1 }),
      { logger },
    );

    try {
      pipeline.start();
      pipeline.eventStore.appendEvents([
        {
          subject: 'Issue-9101',
          expectedVersion: 0,
          events: [
            issueReportEvent('bad-event', '9101', {
              // Missing non-null title should make the projection INSERT fail.
              projectId: 1,
              reporterId: 1,
              priority: 'high',
              storyPoints: 1,
            }),
          ],
        },
      ]);

      await sleep(25);

      pipeline.eventStore.appendEvents([
        {
          subject: 'Issue-9102',
          expectedVersion: 0,
          events: [
            issueReportEvent('good-event', '9102', {
              title: 'consumer survives a bad projection event',
              projectId: 1,
              reporterId: 1,
              priority: 'high',
              storyPoints: 1,
            }),
          ],
        },
      ]);

      await sleep(100);

      expect(errors).toHaveLength(1);
      const row = pipeline.qsmDb
        .prepare('SELECT title FROM projection_issue WHERE id = ?')
        .get(9102) as { title: string } | undefined;
      expect(row?.title).toBe('consumer survives a bad projection event');
    } finally {
      await pipeline.stop().catch(() => undefined);
    }
  });
});

function issueReportEvent(
  id: string,
  aggregateId: string,
  after: Record<string, unknown>,
): AppendEventInput {
  return {
    id,
    eventType: 'IssueReport',
    rntAggregateType: 'Issue',
    rntAggregateId: aggregateId,
    time: '2026-05-14T00:00:00.000Z',
    actor: null,
    data: { before: null, after },
    rntSchemaVersion: 1,
    correlationId: `corr-${id}`,
    causationId: `cmd-${id}`,
    commandId: `cmd-${id}`,
    traceparent: null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
