import type { CommandMetadata } from './types.js';

export type RntmeCommandClient = {
  readonly execute: (bindingRef: string, input: unknown, metadata: CommandMetadata) => Promise<unknown>;
};
