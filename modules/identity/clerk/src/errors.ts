export const GRPC_STATUS_INVALID_ARGUMENT = 3;
export const GRPC_STATUS_NOT_FOUND = 5;
export const GRPC_STATUS_ALREADY_EXISTS = 6;
export const GRPC_STATUS_PERMISSION_DENIED = 7;
export const GRPC_STATUS_RESOURCE_EXHAUSTED = 8;
export const GRPC_STATUS_UNIMPLEMENTED = 12;
export const GRPC_STATUS_UNAVAILABLE = 14;
export const GRPC_STATUS_UNAUTHENTICATED = 16;

export class ClerkIdentityError extends Error {
  public readonly code: number;
  public readonly canonicalCode: string;
  public override readonly cause?: unknown;

  public constructor(message: string, code: number, canonicalCode: string, cause?: unknown) {
    super(message);
    this.name = 'ClerkIdentityError';
    this.code = code;
    this.canonicalCode = canonicalCode;
    this.cause = cause;
  }
}

export function isClerkIdentityError(error: unknown): error is ClerkIdentityError {
  return error instanceof ClerkIdentityError;
}

export function unimplemented(rpc: string): ClerkIdentityError {
  return new ClerkIdentityError(
    `${rpc} is not implemented by @rntme/identity-clerk`,
    GRPC_STATUS_UNIMPLEMENTED,
    'IDENTITY_VENDOR_INVALID_REQUEST',
  );
}

export function invalidArgument(message: string): ClerkIdentityError {
  return new ClerkIdentityError(message, GRPC_STATUS_INVALID_ARGUMENT, 'IDENTITY_VENDOR_INVALID_REQUEST');
}

export function mapClerkError(error: unknown, notFoundCode: string): ClerkIdentityError {
  if (isClerkIdentityError(error)) {
    return error;
  }

  const status = readNumber(error, 'status') ?? readNumber(error, 'statusCode');
  const message = error instanceof Error ? error.message : 'Clerk request failed';

  if (status === 400 || status === 422) {
    return new ClerkIdentityError(message, GRPC_STATUS_INVALID_ARGUMENT, 'IDENTITY_VENDOR_INVALID_REQUEST', error);
  }
  if (status === 401) {
    return new ClerkIdentityError(message, GRPC_STATUS_UNAUTHENTICATED, 'IDENTITY_VENDOR_UNAUTHORIZED', error);
  }
  if (status === 403) {
    return new ClerkIdentityError(message, GRPC_STATUS_PERMISSION_DENIED, 'IDENTITY_VENDOR_UNAUTHORIZED', error);
  }
  if (status === 404) {
    return new ClerkIdentityError(message, GRPC_STATUS_NOT_FOUND, notFoundCode, error);
  }
  if (status === 409) {
    return new ClerkIdentityError(message, GRPC_STATUS_ALREADY_EXISTS, 'IDENTITY_CONSISTENCY_DUPLICATE_EMAIL', error);
  }
  if (status === 429) {
    return new ClerkIdentityError(message, GRPC_STATUS_RESOURCE_EXHAUSTED, 'IDENTITY_VENDOR_RATE_LIMITED', error);
  }
  if (status !== undefined && status >= 500) {
    return new ClerkIdentityError(message, GRPC_STATUS_UNAVAILABLE, 'IDENTITY_VENDOR_UNAVAILABLE', error);
  }

  return new ClerkIdentityError(message, GRPC_STATUS_UNAVAILABLE, 'IDENTITY_VENDOR_UNAVAILABLE', error);
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const maybe = value[key];
  return typeof maybe === 'number' ? maybe : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
