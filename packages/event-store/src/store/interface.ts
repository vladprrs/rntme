import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';

export type ReadFromOptions = Readonly<{
  afterId: number;
  limit: number;
}>;

export type EventRecord = Readonly<{
  id: number;
  envelope: EventEnvelope;
}>;

export type AppendRawOptions = Readonly<{
  ignoreDuplicates?: boolean;
}>;

export interface EventStore {
  appendEvents(requests: readonly AppendRequest[]): AppendResult[];
  readStream(stream: string): EventEnvelope[];
  readFrom(opts: ReadFromOptions): EventEnvelope[];
  readRecordsFrom(opts: ReadFromOptions): EventRecord[];
  readCursor(relayId: string): number;
  writeCursor(relayId: string, lastEventId: number): void;
  appendRaw(envelopes: readonly EventEnvelope[], opts?: AppendRawOptions): void;
}
