import type { ErrorCode } from '@rntme/contracts-storage-v1';

export const GrpcStatus = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  UNAUTHENTICATED: 16,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
} as const;

export type GrpcStatusCode = (typeof GrpcStatus)[keyof typeof GrpcStatus];

export class StorageS3Error extends Error {
  constructor(
    readonly storageCode: ErrorCode,
    message: string,
    readonly grpcStatus: GrpcStatusCode = GrpcStatus.UNKNOWN,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageS3Error';
  }
}
