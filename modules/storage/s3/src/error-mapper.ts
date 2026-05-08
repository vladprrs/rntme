import type { ErrorCode } from '@rntme/contracts-storage-v1';

type AwsLikeError = {
  readonly name?: unknown;
  readonly Code?: unknown;
  readonly code?: unknown;
  readonly $metadata?: { readonly httpStatusCode?: unknown };
};

function errorName(error: unknown): string {
  if (error === null || typeof error !== 'object') return '';
  const e = error as AwsLikeError;
  const value = e.name ?? e.Code ?? e.code;
  return typeof value === 'string' ? value : '';
}

function httpStatus(error: unknown): number | null {
  if (error === null || typeof error !== 'object') return null;
  const value = (error as AwsLikeError).$metadata?.httpStatusCode;
  return typeof value === 'number' ? value : null;
}

export function mapS3ErrorToStorageCode(error: unknown): ErrorCode {
  const name = errorName(error);
  const status = httpStatus(error);

  if (name === 'NoSuchBucket') return 'STORAGE_VENDOR_BUCKET_NOT_FOUND';
  if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
    return 'STORAGE_VENDOR_OBJECT_NOT_FOUND';
  }
  if (name === 'AccessDenied' || name === 'Forbidden' || status === 403) {
    return 'STORAGE_VENDOR_AUTH_DENIED';
  }
  if (status === 429 || name === 'TooManyRequests' || name === 'SlowDown') {
    return 'STORAGE_VENDOR_RATE_LIMITED';
  }
  if (status === 507 || name === 'InsufficientStorage' || name === 'QuotaExceeded') {
    return 'STORAGE_VENDOR_QUOTA_EXCEEDED';
  }
  return 'STORAGE_VENDOR_NETWORK_ERROR';
}
