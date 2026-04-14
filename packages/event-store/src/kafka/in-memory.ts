import type { KafkaMessage, KafkaProducer } from './producer.js';

export type InMemoryKafkaProducer = KafkaProducer & {
  readonly sent: readonly KafkaMessage[];
  /** Cause the next `n` send() calls to reject with `err`. */
  failNext(n: number, err: Error): void;
  /** Clear sent log and pending failures (useful between test cases). */
  reset(): void;
};

export function createInMemoryKafkaProducer(): InMemoryKafkaProducer {
  const sent: KafkaMessage[] = [];
  let failuresRemaining = 0;
  let failureError: Error | null = null;

  const producer: InMemoryKafkaProducer = {
    sent,
    async send(message: KafkaMessage): Promise<void> {
      if (failuresRemaining > 0 && failureError) {
        failuresRemaining -= 1;
        throw failureError;
      }
      sent.push(message);
    },
    failNext(n: number, err: Error): void {
      failuresRemaining = n;
      failureError = err;
    },
    reset(): void {
      sent.length = 0;
      failuresRemaining = 0;
      failureError = null;
    },
  };
  return producer;
}
