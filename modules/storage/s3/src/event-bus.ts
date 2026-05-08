import type { ErrorCode } from '@rntme/contracts-storage-v1';

export type StorageEventType =
  | 'FileUploadInitiated'
  | 'FileUploadCommitted'
  | 'FileUploadAborted'
  | 'FileOrphaned'
  | 'FileDeleted'
  | 'FileLifecycleSwept';

export interface StorageEvent {
  readonly type: StorageEventType;
  /** Aggregate id: file_id for File events; absent for FileLifecycleSwept. */
  readonly subject?: string;
  readonly payload: Record<string, unknown>;
  /** CloudEvent extensions such as correlation_id/idempotency_key. */
  readonly extensions?: Record<string, string>;
}

export interface EventBusLike {
  publish(event: StorageEvent): Promise<void>;
}

export const NOOP_BUS: EventBusLike = {
  async publish() {
    // intentionally empty
  },
};

export function vendorErrorEvent(code: ErrorCode, message: string): StorageEvent {
  return {
    type: 'FileUploadAborted',
    payload: {
      reason: 'route_disabled',
      errorCode: code,
      errorMessage: message,
    },
  };
}
