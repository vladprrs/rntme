import { status as grpcStatus } from '@grpc/grpc-js';
import type { ErrorCode } from '@rntme/contracts-storage-v1';

export const GrpcStatus = grpcStatus;

export type GrpcStatusCode = (typeof GrpcStatus)[keyof typeof GrpcStatus];

export class StorageS3Error extends Error {
  readonly code: GrpcStatusCode;
  override readonly cause?: unknown;

  constructor(
    readonly storageCode: ErrorCode,
    message: string,
    code: GrpcStatusCode = GrpcStatus.UNKNOWN,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageS3Error';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

export function grpcStatusFor(code: ErrorCode): GrpcStatusCode {
  if (code.startsWith('STORAGE_STRUCTURAL_')) return GrpcStatus.INVALID_ARGUMENT;
  if (code.startsWith('STORAGE_REFERENCES_')) return GrpcStatus.NOT_FOUND;
  if (code.startsWith('STORAGE_CONSISTENCY_')) return GrpcStatus.FAILED_PRECONDITION;
  if (code.startsWith('STORAGE_AUTH_NOT_AUTHENTICATED')) return GrpcStatus.UNAUTHENTICATED;
  if (code.startsWith('STORAGE_AUTH_')) return GrpcStatus.PERMISSION_DENIED;
  if (code === 'STORAGE_VENDOR_RATE_LIMITED' || code === 'STORAGE_VENDOR_QUOTA_EXCEEDED') {
    return GrpcStatus.RESOURCE_EXHAUSTED;
  }
  if (code === 'STORAGE_VENDOR_OBJECT_NOT_FOUND' || code === 'STORAGE_VENDOR_BUCKET_NOT_FOUND') {
    return GrpcStatus.NOT_FOUND;
  }
  if (code === 'STORAGE_VENDOR_AUTH_DENIED') return GrpcStatus.PERMISSION_DENIED;
  return GrpcStatus.UNAVAILABLE;
}

export function unimplemented(rpcName: string): StorageS3Error {
  return new StorageS3Error(
    'STORAGE_VENDOR_NETWORK_ERROR',
    `RPC ${rpcName} is not implemented by @rntme/storage-s3`,
    GrpcStatus.UNIMPLEMENTED,
  );
}
