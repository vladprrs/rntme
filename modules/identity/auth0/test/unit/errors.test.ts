import { describe, expect, it } from 'bun:test';
import { GrpcStatus, IdentityModuleError, mapAuth0Error, unimplemented } from '../../src/errors.js';

describe('Auth0 error mapping', () => {
  it('maps Auth0 status errors to gRPC-style canonical errors', () => {
    const authError = { statusCode: 401, message: 'unauthenticated' };
    expect(mapAuth0Error(authError)).toMatchObject({
      code: GrpcStatus.UNAUTHENTICATED,
      identityCode: 'IDENTITY_VENDOR_AUTHENTICATION_FAILED',
      cause: authError,
    });
    expect(mapAuth0Error({ statusCode: 403, message: 'forbidden' })).toMatchObject({
      code: GrpcStatus.PERMISSION_DENIED,
      identityCode: 'IDENTITY_VENDOR_AUTHORIZATION_FAILED',
    });
    expect(mapAuth0Error({ statusCode: 404, message: 'not found' })).toMatchObject({
      code: GrpcStatus.NOT_FOUND,
      identityCode: 'IDENTITY_REFERENCES_RESOURCE_NOT_FOUND',
    });
    expect(mapAuth0Error({ statusCode: 409, message: 'conflict' })).toMatchObject({
      code: GrpcStatus.ALREADY_EXISTS,
      identityCode: 'IDENTITY_CONSISTENCY_DUPLICATE_RESOURCE',
    });
    expect(mapAuth0Error({ statusCode: 408, message: 'timeout' })).toMatchObject({
      code: GrpcStatus.DEADLINE_EXCEEDED,
      identityCode: 'IDENTITY_VENDOR_TIMEOUT',
    });
    expect(mapAuth0Error({ statusCode: 412, message: 'precondition failed' })).toMatchObject({
      code: GrpcStatus.FAILED_PRECONDITION,
      identityCode: 'IDENTITY_PRECONDITION_FAILED',
    });
  });

  it('creates explicit UNIMPLEMENTED errors for unsupported RPCs', () => {
    const error = unimplemented('GetSession');
    expect(error).toBeInstanceOf(IdentityModuleError);
    expect(error).toMatchObject({
      code: GrpcStatus.UNIMPLEMENTED,
      identityCode: 'IDENTITY_VENDOR_UNIMPLEMENTED',
    });
  });
});
