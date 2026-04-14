import type { EventStore, EventRecord } from '../store/interface.js';
import type { EventEnvelope } from '../types/envelope.js';
import type { KafkaProducer } from '../kafka/producer.js';
import { defaultTopicOf } from './topic.js';

export type RelayOptions = Readonly<{
  store: EventStore;
  kafka: KafkaProducer;
  cursorId: string;
  pollIntervalMs?: number;
  batchSize?: number;
  topicOf?: (aggregateType: string) => string;
  maxBackoffMs?: number;
  onSendError?: (err: unknown, envelope: EventEnvelope) => void;
}>;

export type Relay = Readonly<{
  start: () => void;
  stop: () => Promise<void>;
}>;

export function createRelay(opts: RelayOptions): Relay {
  const poll = opts.pollIntervalMs ?? 100;
  const batch = opts.batchSize ?? 500;
  const topicOf = opts.topicOf ?? defaultTopicOf;
  const maxBackoff = opts.maxBackoffMs ?? 1000;
  const onErr = opts.onSendError ?? ((err) => {
    // eslint-disable-next-line no-console
    console.error('[relay] kafka send failed, will retry:', err);
  });

  let running = false;
  let donePromise: Promise<void> | null = null;

  async function loop(): Promise<void> {
    while (running) {
      const cursor = opts.store.readCursor(opts.cursorId);
      const records: EventRecord[] = opts.store.readRecordsFrom({
        afterId: cursor, limit: batch,
      });

      if (records.length === 0) {
        await sleep(poll);
        continue;
      }

      let highestDeliveredId = cursor;
      for (const rec of records) {
        if (!running) break;
        let backoff = 10;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await opts.kafka.send({
              topic: topicOf(rec.envelope.aggregateType),
              key: rec.envelope.stream,
              headers: {
                'event-id': rec.envelope.eventId,
                'event-type': rec.envelope.eventType,
                'schema-version': String(rec.envelope.schemaVersion),
              },
              value: JSON.stringify(rec.envelope),
            });
            break;
          } catch (err) {
            onErr(err, rec.envelope);
            await sleep(backoff);
            backoff = Math.min(backoff * 2, maxBackoff);
            if (!running) return;
          }
        }
        highestDeliveredId = rec.id;
      }
      if (highestDeliveredId > cursor) {
        opts.store.writeCursor(opts.cursorId, highestDeliveredId);
      }
    }
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      donePromise = loop().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[relay] loop crashed:', err);
      });
    },
    async stop(): Promise<void> {
      running = false;
      if (donePromise) await donePromise;
      donePromise = null;
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
