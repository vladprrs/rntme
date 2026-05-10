import { describe, expect, it } from 'bun:test';
import * as grpc from '@grpc/grpc-js';
import { statusToAdapterError } from '../../src/plugins/adapter-client/grpc-adapter-client.js';

describe('statusToAdapterError domainCode extraction', () => {
  it('extracts domainCode from DOMAIN_CODE: message format', () => {
    const error = statusToAdapterError({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'LIMIT_EXCEEDED: too many',
    });

    expect(error.code).toBe('EXTERNAL_VENDOR_DOMAIN');
    expect(error.domainCode).toBe('LIMIT_EXCEEDED');
    expect(error.httpStatus).toBe(400);
  });

  it('does not extract domainCode from plain English messages', () => {
    const error = statusToAdapterError({
      code: grpc.status.NOT_FOUND,
      message: 'resource not found',
    });

    expect(error.code).toBe('EXTERNAL_VENDOR_DOMAIN');
    expect(error.domainCode).toBeUndefined();
    expect(error.httpStatus).toBe(404);
  });

  it('does not extract domainCode from empty messages', () => {
    const error = statusToAdapterError({
      code: grpc.status.ALREADY_EXISTS,
      message: '',
    });

    expect(error.code).toBe('EXTERNAL_VENDOR_DOMAIN');
    expect(error.domainCode).toBeUndefined();
    expect(error.httpStatus).toBe(409);
  });
});
