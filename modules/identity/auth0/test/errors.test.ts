import { describe, expect, it } from 'vitest';
import { GrpcStatus, IdentityModuleError, mapAuth0Error, unimplemented } from '../src/errors.js';

describe('Auth0 error mapping', () => {
  it('maps Auth0 status errors to gRPC-style canonical errors', () => {
    expect(mapAuth0Error({ statusCode: 404, message: 'not found' })).toMatchObject({
      code: GrpcStatus.NOT_FOUND,
      identityCode: 'IDENTITY_REFERENCES_RESOURCE_NOT_FOUND',
    });
    expect(mapAuth0Error({ statusCode: 409, message: 'conflict' })).toMatchObject({
      code: GrpcStatus.ALREADY_EXISTS,
      identityCode: 'IDENTITY_CONSISTENCY_DUPLICATE_RESOURCE',
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
