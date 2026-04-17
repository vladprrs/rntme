import type { EventStore, EventRecord } from '../store/interface.js';
import type { EventEnvelope } from '../types/envelope.js';
import type { KafkaProducer } from '../kafka/producer.js';
import { defaultTopicOf } from './topic.js';
import { toCloudEventWire } from '../kafka/wire-codec.js';
import { buildDlqEnvelope } from './dlq-envelope.js';

export type RelayOptions = Readonly<{
  store: EventStore;
  kafka: KafkaProducer;
  cursorId: string;
  serviceName: string;
  now: () => string;
  nextId: () => string;
  pollIntervalMs?: number;
  batchSize?: number;
  topicOf?: (serviceName: string, aggregateType: string) => string;
  maxBackoffMs?: number;
  /** Default: 10. Number of primary-topic send attempts before DLQ. Must be an integer >= 1. */
  maxAttempts?: number;
  /** Called once per failed primary-topic send. `attempt` is 1-indexed. */
  onSendError?: (err: unknown, envelope: EventEnvelope, attempt: number) => void;
  /**
   * Called once per failed DLQ-topic send. DLQ retries are unbounded with capped
   * backoff (spec §D-DLQ-RETRY): silently dropping a DLQ event would lose data,
   * so the relay loops until the DLQ accepts the event or `stop()` is called.
   * Wire this for operator alerting / metrics.
   */
  onDlqError?: (err: unknown, envelope: EventEnvelope, attempt: number) => void;
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
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error(
      `[relay] maxAttempts must be an integer >= 1, got: ${opts.maxAttempts}`,
    );
  }
  const onErr = opts.onSendError ?? ((err, _envelope, attempt) => {
    // eslint-disable-next-line no-console
    console.error(`[relay] kafka send failed (attempt ${attempt}), will retry:`, err);
  });
  const onDlqErr = opts.onDlqError ?? ((err, envelope, attempt) => {
    // eslint-disable-next-line no-console
    console.error(
      `[relay] DLQ send failed for ${envelope.id} (attempt ${attempt}), will retry:`,
      err,
    );
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
        const eventId = rec.envelope.id;
        const existing = opts.store.readDeliveryAttempt(eventId);
        if (existing && (existing.deliveredAt !== null || existing.dlqAt !== null)) {
          highestDeliveredId = rec.id;
          continue;
        }
        const primaryTopic = topicOf(opts.serviceName, rec.envelope.rntAggregateType);

        // Short-circuit on restart: if attemptCount already reached the cap
        // (relay crashed mid-DLQ-emit, leaving counter == maxAttempts and dlq_at NULL),
        // skip another wasted primary send and go straight to DLQ.
        if (existing && existing.attemptCount >= maxAttempts) {
          const sent = await emitDlq({
            kafka: opts.kafka,
            rec,
            primaryTopic,
            attempts: existing.attemptCount,
            firstAttemptAt: existing.firstAttemptAt,
            lastError: existing.lastError ?? 'unknown (counter already at cap on restart)',
            maxBackoff,
            isRunning: () => running,
            onDlqError: onDlqErr,
            serviceName: opts.serviceName,
            now: opts.now,
            nextId: opts.nextId,
          });
          if (!sent) return; // cooperative shutdown during DLQ emit
          opts.store.markDlq(eventId, new Date().toISOString());
          highestDeliveredId = rec.id;
          continue;
        }

        let attempts = existing?.attemptCount ?? 0;
        let backoff = 10;
        while (running) {
          attempts += 1;
          const attemptIso = new Date().toISOString();
          opts.store.recordDeliveryAttempt(eventId, attemptIso);
          try {
            const primaryMsg = toCloudEventWire(rec.envelope, primaryTopic);
            await opts.kafka.send(primaryMsg);
            opts.store.markDelivered(eventId, new Date().toISOString());
            break;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            opts.store.updateLastError(eventId, truncate(msg, 1024));
            onErr(err, rec.envelope, attempts);
            if (attempts >= maxAttempts) {
              const state = opts.store.readDeliveryAttempt(eventId);
              const firstAttemptAt = state?.firstAttemptAt ?? attemptIso;
              const sent = await emitDlq({
                kafka: opts.kafka,
                rec,
                primaryTopic,
                attempts,
                firstAttemptAt,
                lastError: msg,
                maxBackoff,
                isRunning: () => running,
                onDlqError: onDlqErr,
                serviceName: opts.serviceName,
                now: opts.now,
                nextId: opts.nextId,
              });
              if (!sent) return; // cooperative shutdown during DLQ emit
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
  onDlqError: (err: unknown, envelope: EventEnvelope, attempt: number) => void;
  serviceName: string;
  now: () => string;
  nextId: () => string;
}>;

/**
 * Send to `${primaryTopic}.dlq` with capped exponential backoff. Per spec
 * §D-DLQ-RETRY this loop is unbounded: silently dropping a DLQ event would
 * lose data, and exiting on a terminal cap would leave the relay zombied
 * (running=true but loop exited), re-introducing the "poison blocks the
 * stream" failure mode A1 exists to prevent. Returns `true` on success;
 * `false` ONLY for cooperative shutdown via `isRunning() === false`.
 *
 * DLQ payload is a CloudEvents wrapper envelope (`<svc>.Relay.EventDeliveryFailed`)
 * built via `buildDlqEnvelope` — the original event rides in `data.failedEvent`.
 */
async function emitDlq(o: EmitDlqOpts): Promise<boolean> {
  let backoff = 10;
  let dlqAttempt = 0;
  const dlqEnvelope = buildDlqEnvelope({
    serviceName: o.serviceName,
    original: o.rec.envelope,
    attempts: o.attempts,
    firstAttemptAt: o.firstAttemptAt,
    lastError: o.lastError,
    now: o.now,
    nextId: o.nextId,
  });
  const dlqMsg = toCloudEventWire(dlqEnvelope, `${o.primaryTopic}.dlq`);
  while (o.isRunning()) {
    dlqAttempt += 1;
    try {
      await o.kafka.send(dlqMsg);
      return true;
    } catch (dlqErr) {
      o.onDlqError(dlqErr, o.rec.envelope, dlqAttempt);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, o.maxBackoff);
    }
  }
  return false;
}
