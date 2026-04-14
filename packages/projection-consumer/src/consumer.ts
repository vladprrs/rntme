import type { Database } from 'better-sqlite3';
import { applyEvent } from './apply/apply-event.js';
import type { ApplyPlan } from './types/apply.js';
import type { KafkaBatch, KafkaConsumer } from './types/consumer.js';

export type ProjectionConsumerOptions = Readonly<{
  kafka: KafkaConsumer;
  plan: ApplyPlan;
  db: Database;
  onError?: (err: unknown, batch: KafkaBatch) => void;
}>;

export type ProjectionConsumer = Readonly<{
  start(): void;
  stop(): Promise<void>;
}>;

/**
 * Batch consumer loop (spec §6.4): `BEGIN IMMEDIATE` → apply each envelope →
 * `COMMIT` → `commitOffsets(batch)` after the DB transaction succeeds.
 */
export function createProjectionConsumer(options: ProjectionConsumerOptions): ProjectionConsumer {
  const { kafka, plan, db, onError } = options;
  let loop: Promise<void> | null = null;

  async function run(): Promise<void> {
    try {
      for await (const batch of kafka) {
        if (batch.messages.length === 0) continue;
        try {
          db.prepare('BEGIN IMMEDIATE').run();
          try {
            for (const m of batch.messages) {
              applyEvent(db, plan, m.envelope);
            }
            db.prepare('COMMIT').run();
          } catch (err) {
            db.prepare('ROLLBACK').run();
            throw err;
          }
          await kafka.commitOffsets(batch);
        } catch (err) {
          if (onError) onError(err, batch);
          else throw err;
        }
      }
    } finally {
      loop = null;
    }
  }

  return {
    start() {
      if (loop) return;
      loop = run();
    },
    async stop() {
      kafka.stop?.();
      await loop;
    },
  };
}
