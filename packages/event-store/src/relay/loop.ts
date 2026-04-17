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
  /** Default: 10. Number of primary-topic send attempts before DLQ. Must be >= 1. */
  maxAttempts?: number;
  /** Called once per failed send. `attempt` is 1-indexed. */
  onSendError?: (err: unknown, envelope: EventEnvelope, attempt: number) => void;
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
  const maxAttempts = opts.maxAttempts ?? 10;
  const onErr = opts.onSendError ?? ((err, _envelope, attempt) => {
    // eslint-disable-next-line no-console
    console.error(`[relay] kafka send failed (attempt ${attempt}), will retry:`, err);
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
        const eventId = rec.envelope.eventId;
        const existing = opts.store.readDeliveryAttempt(eventId);
        if (existing && (existing.deliveredAt !== null || existing.dlqAt !== null)) {
          highestDeliveredId = rec.id;
          continue;
        }
        const primaryTopic = topicOf(rec.envelope.aggregateType);
        let attempts = existing?.attemptCount ?? 0;
        let backoff = 10;
        while (running) {
          attempts += 1;
          const attemptIso = new Date().toISOString();
          opts.store.recordDeliveryAttempt(eventId, attemptIso);
          try {
            await opts.kafka.send({
              topic: primaryTopic,
              key: rec.envelope.stream,
              headers: {
                'event-id': rec.envelope.eventId,
                'event-type': rec.envelope.eventType,
                'schema-version': String(rec.envelope.schemaVersion),
              },
              value: JSON.stringify(rec.envelope),
            });
            opts.store.markDelivered(eventId, new Date().toISOString());
            break;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            opts.store.updateLastError(eventId, truncate(msg, 1024));
            onErr(err, rec.envelope, attempts);
            if (attempts >= maxAttempts) {
              const state = opts.store.readDeliveryAttempt(eventId);
              const firstAttemptAt = state?.firstAttemptAt ?? attemptIso;
              await emitDlq({
                kafka: opts.kafka,
                rec,
                primaryTopic,
                attempts,
                firstAttemptAt,
                lastError: msg,
                maxBackoff,
                isRunning: () => running,
              });
              opts.store.markDlq(eventId, new Date().toISOString());
              break;
            }
            await sleep(backoff);
            backoff = Math.min(backoff * 2, maxBackoff);
            if (!running) return;
          }
        }
        if (!running) return;
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

function truncate(s: string, maxBytes: number): string {
  // Byte-bounded truncation: TextEncoder would be most accurate, but for
  // error messages a char-count upper bound is a safe lower-bound guard.
  // We accept that multi-byte chars may yield strings slightly over maxBytes;
  // the 1024 target is a header-size heuristic, not a hard broker limit.
  return s.length > maxBytes ? s.slice(0, maxBytes) : s;
}

type EmitDlqOpts = Readonly<{
  kafka: KafkaProducer;
  rec: EventRecord;
  primaryTopic: string;
  attempts: number;
  firstAttemptAt: string;
  lastError: string;
  maxBackoff: number;
  isRunning: () => boolean;
}>;

async function emitDlq(o: EmitDlqOpts): Promise<void> {
  let backoff = 10;
  while (o.isRunning()) {
    try {
      await o.kafka.send({
        topic: `${o.primaryTopic}.dlq`,
        key: o.rec.envelope.stream,
        headers: {
          'event-id': o.rec.envelope.eventId,
          'event-type': o.rec.envelope.eventType,
          'schema-version': String(o.rec.envelope.schemaVersion),
          'x-dlq-reason': 'max-attempts-exceeded',
          'x-dlq-attempts': String(o.attempts),
          'x-dlq-first-attempt-at': o.firstAttemptAt,
          'x-dlq-last-error': truncate(o.lastError, 1024),
        },
        value: JSON.stringify(o.rec.envelope),
      });
      return;
    } catch (dlqErr) {
      // eslint-disable-next-line no-console
      console.error(`[relay] DLQ-send failed for ${o.rec.envelope.eventId}, will retry:`, dlqErr);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, o.maxBackoff);
    }
  }
}
