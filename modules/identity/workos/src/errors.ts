export const GRPC_STATUS_INVALID_ARGUMENT = 3;
export const GRPC_STATUS_NOT_FOUND = 5;
export const GRPC_STATUS_ALREADY_EXISTS = 6;
export const GRPC_STATUS_PERMISSION_DENIED = 7;
export const GRPC_STATUS_RESOURCE_EXHAUSTED = 8;
export const GRPC_STATUS_UNIMPLEMENTED = 12;
export const GRPC_STATUS_UNAVAILABLE = 14;
export const GRPC_STATUS_UNAUTHENTICATED = 16;

export class WorkOSIdentityError extends Error {
  public readonly code: number;
  public readonly canonicalCode: string;
  public override readonly cause?: unknown;

  public constructor(message: string, code: number, canonicalCode: string, cause?: unknown) {
    super(message);
    this.name = 'WorkOSIdentityError';
    this.code = code;
    this.canonicalCode = canonicalCode;
    this.cause = cause;
  }
}

export function isWorkOSIdentityError(error: unknown): error is WorkOSIdentityError {
  return error instanceof WorkOSIdentityError;
}

export function unimplemented(rpc: string): WorkOSIdentityError {
  return new WorkOSIdentityError(
    `${rpc} is not implemented by @rntme/identity-workos`,
    GRPC_STATUS_UNIMPLEMENTED,
    'IDENTITY_VENDOR_INVALID_REQUEST',
  );
}

export function invalidArgument(message: string): WorkOSIdentityError {
  return new WorkOSIdentityError(message, GRPC_STATUS_INVALID_ARGUMENT, 'IDENTITY_VENDOR_INVALID_REQUEST');
}

export function mapWorkOSError(error: unknown, notFoundCode: string): WorkOSIdentityError {
  if (isWorkOSIdentityError(error)) {
    return error;
  }

  const status = readNumber(error, 'status') ?? readNumber(error, 'statusCode');
  const message = readString(error, 'message') || (error instanceof Error ? error.message : 'WorkOS request failed');

  if (status === 400 || status === 422) {
    return new WorkOSIdentityError(message, GRPC_STATUS_INVALID_ARGUMENT, 'IDENTITY_VENDOR_INVALID_REQUEST', error);
  }
  if (status === 401) {
    return new WorkOSIdentityError(message, GRPC_STATUS_UNAUTHENTICATED, 'IDENTITY_VENDOR_UNAUTHORIZED', error);
  }
  if (status === 403) {
    return new WorkOSIdentityError(message, GRPC_STATUS_PERMISSION_DENIED, 'IDENTITY_VENDOR_UNAUTHORIZED', error);
  }
  if (status === 404) {
    return new WorkOSIdentityError(message, GRPC_STATUS_NOT_FOUND, notFoundCode, error);
  }
  if (status === 409) {
    return new WorkOSIdentityError(message, GRPC_STATUS_ALREADY_EXISTS, 'IDENTITY_CONSISTENCY_DUPLICATE_EMAIL', error);
  }
  if (status === 429) {
    return new WorkOSIdentityError(message, GRPC_STATUS_RESOURCE_EXHAUSTED, 'IDENTITY_VENDOR_RATE_LIMITED', error);
  }
  if (status !== undefined && status >= 500) {
    return new WorkOSIdentityError(message, GRPC_STATUS_UNAVAILABLE, 'IDENTITY_VENDOR_UNAVAILABLE', error);
  }

  return new WorkOSIdentityError(message, GRPC_STATUS_UNAVAILABLE, 'IDENTITY_VENDOR_UNAVAILABLE', error);
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const maybe = value[key];
  return typeof maybe === 'number' ? maybe : undefined;
}

function readString(value: unknown, key: string): string {
  if (!isRecord(value)) {
    return '';
  }
  const maybe = value[key];
  return typeof maybe === 'string' ? maybe : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
