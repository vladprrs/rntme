export type EventStoreErrorCode =
  | 'CONCURRENCY_CONFLICT'
  | 'DUPLICATE_EVENT_ID'
  | 'STORAGE_FAILURE';

export class EventStoreError extends Error {
  readonly code: EventStoreErrorCode;
  constructor(code: EventStoreErrorCode, message: string) {
    super(message);
    this.name = 'EventStoreError';
    this.code = code;
  }
}

export class ConcurrencyConflict extends EventStoreError {
  readonly subject: string;
  readonly expectedVersion: number | undefined;
  readonly actualVersion: number;
  constructor(subject: string, expectedVersion: number | undefined, actualVersion: number) {
    super(
      'CONCURRENCY_CONFLICT',
      `Concurrency conflict on subject="${subject}": expected ${expectedVersion ?? '<unchecked>'}, actual ${actualVersion}`,
    );
    this.name = 'ConcurrencyConflict';
    this.subject = subject;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class DuplicateEventId extends EventStoreError {
  readonly eventId: string;
  constructor(eventId: string) {
    super('DUPLICATE_EVENT_ID', `eventId already appended: ${eventId}`);
    this.name = 'DuplicateEventId';
    this.eventId = eventId;
  }
}
