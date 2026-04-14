import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { KafkaConsumer } from './types/consumer.js';
import type { ApplyPlan } from './types/apply.js';
import { applyEvent } from './apply/apply-event.js';

export type ProjectionConsumerOptions = Readonly<{
  kafka: KafkaConsumer;
  plan: ApplyPlan;
  db: BetterSqliteDatabase;
  /** Called when a batch fails and is rolled back. Default: log + stop. */
  onError?: (err: unknown) => void;
}>;

export type ProjectionConsumer = Readonly<{
  start(): void;
  stop(): Promise<void>;
}>;

export function createProjectionConsumer(opts: ProjectionConsumerOptions): ProjectionConsumer {
  const onError = opts.onError ?? ((err) => {
    // eslint-disable-next-line no-console
    console.error('[projection-consumer] batch failed, rolled back:', err);
  });

  let running = false;
  let donePromise: Promise<void> | null = null;

  async function loop(): Promise<void> {
    for await (const batch of opts.kafka) {
      if (!running) break;
      if (batch.messages.length === 0) continue;
      try {
        opts.db.exec('BEGIN IMMEDIATE');
        for (const msg of batch.messages) {
          applyEvent(opts.db, opts.plan, msg.envelope);
        }
        opts.db.exec('COMMIT');
      } catch (err) {
        try { opts.db.exec('ROLLBACK'); } catch { /* noop */ }
        onError(err);
        continue; // don't commit offsets; next poll will re-deliver
      }
      await opts.kafka.commitOffsets(batch);
    }
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      donePromise = loop().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[projection-consumer] loop crashed:', err);
      });
    },
    async stop(): Promise<void> {
      running = false;
      const maybeStop = (opts.kafka as { stop?: () => void }).stop;
      if (typeof maybeStop === 'function') maybeStop.call(opts.kafka);
      if (donePromise) await donePromise;
      donePromise = null;
    },
  };
}
