export const GRPC_STATUS_INVALID_ARGUMENT = 3;
export const GRPC_STATUS_NOT_FOUND = 5;
export const GRPC_STATUS_ALREADY_EXISTS = 6;
export const GRPC_STATUS_PERMISSION_DENIED = 7;
export const GRPC_STATUS_RESOURCE_EXHAUSTED = 8;
export const GRPC_STATUS_UNIMPLEMENTED = 12;
export const GRPC_STATUS_UNAVAILABLE = 14;
export const GRPC_STATUS_UNAUTHENTICATED = 16;

export class AmoCrmError extends Error {
  public readonly code: number;
  public readonly canonicalCode: string;
  public override readonly cause?: unknown;

  public constructor(message: string, code: number, canonicalCode: string, cause?: unknown) {
    super(message);
    this.name = 'AmoCrmError';
    this.code = code;
    this.canonicalCode = canonicalCode;
    this.cause = cause;
  }
}

export function isAmoCrmError(error: unknown): error is AmoCrmError {
  return error instanceof AmoCrmError;
}

export function unimplemented(rpc: string): AmoCrmError {
  return new AmoCrmError(
    `${rpc} is not implemented by @rntme/crm-amocrm`,
    GRPC_STATUS_UNIMPLEMENTED,
    'CRM_VENDOR_UNIMPLEMENTED',
  );
}

export function invalidArgument(message: string): AmoCrmError {
  return new AmoCrmError(message, GRPC_STATUS_INVALID_ARGUMENT, 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD');
}

export function mapAmoCrmError(error: unknown, notFoundCode: string): AmoCrmError {
  if (isAmoCrmError(error)) {
    return error;
  }

  const status = readNumber(error, 'status') ?? readNumber(error, 'statusCode') ?? readStatusFromResponse(error);
  const message = error instanceof Error ? error.message : 'amoCRM request failed';

  if (status === 400 || status === 422) {
    return new AmoCrmError(message, GRPC_STATUS_INVALID_ARGUMENT, 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD', error);
  }
  if (status === 401) {
    return new AmoCrmError(message, GRPC_STATUS_UNAUTHENTICATED, 'CRM_VENDOR_UNAUTHORIZED', error);
  }
  if (status === 403) {
    return new AmoCrmError(message, GRPC_STATUS_PERMISSION_DENIED, 'CRM_VENDOR_FORBIDDEN', error);
  }
  if (status === 404) {
    return new AmoCrmError(message, GRPC_STATUS_NOT_FOUND, notFoundCode, error);
  }
  if (status === 409) {
    return new AmoCrmError(message, GRPC_STATUS_ALREADY_EXISTS, 'CRM_CONSISTENCY_DUPLICATE', error);
  }
  if (status === 429) {
    return new AmoCrmError(message, GRPC_STATUS_RESOURCE_EXHAUSTED, 'CRM_VENDOR_RATE_LIMITED', error);
  }
  if (status !== undefined && status >= 500) {
    return new AmoCrmError(message, GRPC_STATUS_UNAVAILABLE, 'CRM_VENDOR_UNAVAILABLE', error);
  }

  const responseBody = asRecord(error);
  const responseRecord = asRecord(responseBody.response);
  if (responseRecord?.error === 'QUERY_LIMIT_EXCEEDED' || responseBody?.error === 'QUERY_LIMIT_EXCEEDED') {
    return new AmoCrmError(message, GRPC_STATUS_RESOURCE_EXHAUSTED, 'CRM_VENDOR_RATE_LIMITED', error);
  }

  return new AmoCrmError(message, GRPC_STATUS_UNAVAILABLE, 'CRM_VENDOR_UNAVAILABLE', error);
}

function readStatusFromResponse(error: unknown): number | undefined {
  const record = asRecord(error);
  const response = asRecord(record.response);
  if (typeof response.status === 'number') {
    return response.status;
  }
  if (typeof response.statusCode === 'number') {
    return response.statusCode;
  }
  return undefined;
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

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
