import { describe, expect, it } from 'bun:test';
import { mapS3ErrorToStorageCode } from '../../src/error-mapper.js';

describe('mapS3ErrorToStorageCode', () => {
  it('maps NoSuchKey/404 to STORAGE_VENDOR_OBJECT_NOT_FOUND', () => {
    expect(
      mapS3ErrorToStorageCode({ name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } }),
    ).toBe('STORAGE_VENDOR_OBJECT_NOT_FOUND');
  });

  it('maps 403/AccessDenied to STORAGE_VENDOR_AUTH_DENIED', () => {
    expect(
      mapS3ErrorToStorageCode({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }),
    ).toBe('STORAGE_VENDOR_AUTH_DENIED');
  });

  it('maps NoSuchBucket to STORAGE_VENDOR_BUCKET_NOT_FOUND', () => {
    expect(
      mapS3ErrorToStorageCode({ name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } }),
    ).toBe('STORAGE_VENDOR_BUCKET_NOT_FOUND');
  });

  it('maps 429 to STORAGE_VENDOR_RATE_LIMITED', () => {
    expect(
      mapS3ErrorToStorageCode({ name: 'TooManyRequests', $metadata: { httpStatusCode: 429 } }),
    ).toBe('STORAGE_VENDOR_RATE_LIMITED');
  });

  it('maps 507 to STORAGE_VENDOR_QUOTA_EXCEEDED', () => {
    expect(
      mapS3ErrorToStorageCode({ name: 'InsufficientStorage', $metadata: { httpStatusCode: 507 } }),
    ).toBe('STORAGE_VENDOR_QUOTA_EXCEEDED');
  });

  it('falls back to STORAGE_VENDOR_NETWORK_ERROR for unknown shape', () => {
    expect(mapS3ErrorToStorageCode({ message: 'ENETUNREACH' })).toBe(
      'STORAGE_VENDOR_NETWORK_ERROR',
    );
  });
});
