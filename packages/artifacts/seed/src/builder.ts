import { randomUUID } from 'node:crypto';
import type { SeedArtifact, SeedEventInput } from './types.js';

export interface SeedBuilder {
  /**
   * Add an event. If the input omits `correlationId`, the builder stamps its
   * own stable `seed:<uuid>` value (shared across every event in the builder).
   */
  event(input: SeedEventInput): SeedBuilder;
  build(): SeedArtifact;
}

export function seedBuilder(): SeedBuilder {
  const events: SeedEventInput[] = [];
  const builderCorrelationId = `seed:${randomUUID()}`;

  const self: SeedBuilder = {
    event(input: SeedEventInput) {
      const stamped: SeedEventInput = {
        ...input,
        correlationId: input.correlationId ?? builderCorrelationId,
      };
      events.push(stamped);
      return self;
    },
    build() {
      return Object.freeze({
        seedVersion: 1,
        events: Object.freeze(events.slice()) as readonly SeedEventInput[],
      }) as SeedArtifact;
    },
  };
  return self;
}
