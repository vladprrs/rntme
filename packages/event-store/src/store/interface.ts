import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';

export type ReadFromOptions = Readonly<{
  afterId: number;
  limit: number;
}>;

export interface EventStore {
  appendEvents(requests: readonly AppendRequest[]): AppendResult[];
  readStream(stream: string): EventEnvelope[];
  readFrom(opts: ReadFromOptions): EventEnvelope[];
  readCursor(relayId: string): number;
  writeCursor(relayId: string, lastEventId: number): void;
}
