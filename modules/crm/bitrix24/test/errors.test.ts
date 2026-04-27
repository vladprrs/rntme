import { describe, expect, it } from 'vitest';
import { mapBitrix24Error } from '../src/errors.js';

describe('Bitrix24 error mapping', () => {
  it.each([
    [{ error: 'QUERY_LIMIT_EXCEEDED', message: 'slow down' }, 'CRM_VENDOR_RATE_LIMITED', 8],
    [{ error: 'ACCESS_DENIED', status: 403 }, 'CRM_VENDOR_UNAUTHORIZED', 7],
    [{ error: 'INVALID_CREDENTIALS', status: 401 }, 'CRM_VENDOR_UNAUTHORIZED', 16],
    [{ error: 'ERROR_NOT_FOUND', status: 404 }, 'CRM_REFERENCES_CONTACT_NOT_FOUND', 5],
    [{ error: 'INVALID_REQUEST', status: 400 }, 'CRM_VENDOR_INVALID_REQUEST', 3],
    [{ status: 503, message: 'offline' }, 'CRM_VENDOR_UNAVAILABLE', 14],
  ])('maps %j to %s', (input, canonicalCode, grpcCode) => {
    expect(mapBitrix24Error(input, 'CRM_REFERENCES_CONTACT_NOT_FOUND')).toMatchObject({
      canonicalCode,
      code: grpcCode,
    });
  });
});
