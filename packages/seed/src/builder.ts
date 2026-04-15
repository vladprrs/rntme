import type { SeedArtifact, SeedEventInput } from './types.js';

export interface SeedBuilder {
  event(input: SeedEventInput): SeedBuilder;
  build(): SeedArtifact;
}

export function seedBuilder(): SeedBuilder {
  const events: SeedEventInput[] = [];
  const self: SeedBuilder = {
    event(input: SeedEventInput) {
      events.push(input);
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
