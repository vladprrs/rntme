import { describe, it, expect } from 'vitest';
import { buildEventPipeline } from '../src/events.js';

describe('events.ts — event pipeline', () => {
  it('appends an event and the projection consumer applies it to the QSM DB', async () => {
    const pipeline = buildEventPipeline();
    pipeline.start();
    try {
      // Append a synthetic IssueReport directly via the store for the plumbing test.
      pipeline.eventStore.appendEvents([{
        stream: 'Issue-9001',
        expectedVersion: 0,
        events: [{
          eventId: 'test-evt-1',
          eventType: 'IssueReport',
          aggregateType: 'Issue',
          aggregateId: '9001',
          occurredAt: '2026-04-14T00:00:00Z',
          actor: null,
          payload: {
            before: null,
            after: {
              status: 'draft',
              title: 'plumbing check',
              projectId: 1,
              reporterId: 1,
              priority: 'low',
              storyPoints: 1,
            },
          },
          schemaVersion: 1,
        }],
      }]);

      // Poll for projection row.
      const deadline = Date.now() + 2000;
      let row: { id: number; title: string } | undefined;
      while (Date.now() < deadline) {
        row = pipeline.qsmDb.prepare(
          'SELECT id, title FROM projection_issue WHERE id = 9001',
        ).get() as { id: number; title: string } | undefined;
        if (row) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(row?.title).toBe('plumbing check');
    } finally {
      await pipeline.stop();
    }
  });
});
