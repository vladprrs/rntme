import type { EventEnvelope } from '@rntme/event-store';

/**
 * One message read from Kafka. The value is the JSON-encoded envelope
 * published by `@rntme/event-store` relay. `offset` is opaque to this package
 * and handed back unchanged to `commitOffsets`.
 */
export type ConsumedMessage = Readonly<{
  topic: string;
  partition: number;
  offset: string;
  key: string;              // = envelope.subject (relay partition key)
  envelope: EventEnvelope;
}>;

/**
 * A batch of messages as yielded by one poll of the underlying Kafka client.
 * `commitOffsets(batch)` persists the high-water mark *after* the projection
 * transaction has committed.
 */
export type KafkaBatch = Readonly<{
  messages: readonly ConsumedMessage[];
}>;

/**
 * Minimal async-iterator + offset-commit contract. Callers obtain a
 * `KafkaConsumer` from an adapter (in-memory for tests, real Kafka client for
 * prod) and hand it to `createProjectionConsumer`.
 *
 * Implementations MUST:
 * - Yield each poll as a `KafkaBatch` (empty batches allowed; the loop sleeps).
 * - Keep offsets uncommitted until `commitOffsets` is awaited.
 * - Exit the async iterator cleanly when `stop()` or equivalent is invoked.
 */
export interface KafkaConsumer {
  [Symbol.asyncIterator](): AsyncIterator<KafkaBatch>;
  commitOffsets(batch: KafkaBatch): Promise<void>;
  /** Test harness / adapter hook to end the async iterator cleanly. */
  stop?(): void;
}
