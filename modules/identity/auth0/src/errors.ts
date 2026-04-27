export enum GrpcStatus {
  INVALID_ARGUMENT = 3,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
}

export class IdentityModuleError extends Error {
  readonly code: GrpcStatus;
  readonly identityCode: string;
  readonly cause?: unknown;

  constructor(message: string, code: GrpcStatus, identityCode: string, cause?: unknown) {
    super(message);
    this.name = 'IdentityModuleError';
    this.code = code;
    this.identityCode = identityCode;
    this.cause = cause;
  }
}

export function unimplemented(rpc: string): IdentityModuleError {
  return new IdentityModuleError(`${rpc} is not implemented by @rntme/identity-auth0`, GrpcStatus.UNIMPLEMENTED, 'IDENTITY_VENDOR_UNIMPLEMENTED');
}

export function invalidArgument(message: string): IdentityModuleError {
  return new IdentityModuleError(message, GrpcStatus.INVALID_ARGUMENT, 'IDENTITY_STRUCTURAL_INVALID_ARGUMENT');
}

function statusCodeOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  const value = record.statusCode ?? record.status ?? record.code;
  return typeof value === 'number' ? value : undefined;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return 'Auth0 request failed';
  const record = error as Record<string, unknown>;
  return typeof record.message === 'string' ? record.message : 'Auth0 request failed';
}

export function mapAuth0Error(error: unknown): IdentityModuleError {
  if (error instanceof IdentityModuleError) return error;

  switch (statusCodeOf(error)) {
    case 400:
      return new IdentityModuleError(messageOf(error), GrpcStatus.INVALID_ARGUMENT, 'IDENTITY_STRUCTURAL_INVALID_ARGUMENT', error);
    case 401:
    case 403:
      return new IdentityModuleError(messageOf(error), GrpcStatus.PERMISSION_DENIED, 'IDENTITY_VENDOR_AUTHORIZATION_FAILED', error);
    case 404:
      return new IdentityModuleError(messageOf(error), GrpcStatus.NOT_FOUND, 'IDENTITY_REFERENCES_RESOURCE_NOT_FOUND', error);
    case 409:
      return new IdentityModuleError(messageOf(error), GrpcStatus.ALREADY_EXISTS, 'IDENTITY_CONSISTENCY_DUPLICATE_RESOURCE', error);
    case 429:
      return new IdentityModuleError(messageOf(error), GrpcStatus.RESOURCE_EXHAUSTED, 'IDENTITY_VENDOR_RATE_LIMITED', error);
    case 500:
    case 502:
    case 503:
    case 504:
      return new IdentityModuleError(messageOf(error), GrpcStatus.UNAVAILABLE, 'IDENTITY_VENDOR_UNAVAILABLE', error);
    default:
      return new IdentityModuleError(messageOf(error), GrpcStatus.INTERNAL, 'IDENTITY_VENDOR_REQUEST_FAILED', error);
  }
}
