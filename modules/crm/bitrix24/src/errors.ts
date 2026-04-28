export const GRPC_STATUS_INVALID_ARGUMENT = 3;
export const GRPC_STATUS_NOT_FOUND = 5;
export const GRPC_STATUS_PERMISSION_DENIED = 7;
export const GRPC_STATUS_RESOURCE_EXHAUSTED = 8;
export const GRPC_STATUS_FAILED_PRECONDITION = 9;
export const GRPC_STATUS_UNIMPLEMENTED = 12;
export const GRPC_STATUS_UNAVAILABLE = 14;
export const GRPC_STATUS_UNAUTHENTICATED = 16;

export enum GrpcStatus {
  INVALID_ARGUMENT = 3,
  NOT_FOUND = 5,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  UNIMPLEMENTED = 12,
  UNAVAILABLE = 14,
  UNAUTHENTICATED = 16,
}

export class Bitrix24CrmError extends Error {
  public readonly code: number;
  public readonly canonicalCode: string;
  public readonly crmCode: string;
  public override readonly cause?: unknown;

  public constructor(message: string, code: number, canonicalCode: string, cause?: unknown) {
    super(message);
    this.name = 'Bitrix24CrmError';
    this.code = code;
    this.canonicalCode = canonicalCode;
    this.crmCode = canonicalCode;
    this.cause = cause;
  }
}

export function labelsNotSupported(): Bitrix24CrmError {
  return new Bitrix24CrmError(
    'Bitrix24 does not support native labeled CRM associations',
    GRPC_STATUS_FAILED_PRECONDITION,
    'CRM_CONSISTENCY_LABELS_NOT_SUPPORTED',
  );
}

export function notFound(canonicalCode: string, message = 'Bitrix24 CRM resource was not found'): Bitrix24CrmError {
  return new Bitrix24CrmError(message, GRPC_STATUS_NOT_FOUND, canonicalCode);
}

export function invalidRequest(message: string, canonicalCode = 'CRM_VENDOR_INVALID_REQUEST'): Bitrix24CrmError {
  return new Bitrix24CrmError(message, GRPC_STATUS_INVALID_ARGUMENT, canonicalCode);
}

export function unsupported(rpc: string): Bitrix24CrmError {
  return new Bitrix24CrmError(
    `${rpc} is not yet implemented by @rntme/crm-bitrix24`,
    GRPC_STATUS_UNIMPLEMENTED,
    'CRM_VENDOR_INVALID_REQUEST',
  );
}

export function mapBitrix24Error(error: unknown, notFoundCode = 'CRM_REFERENCES_CONTACT_NOT_FOUND'): Bitrix24CrmError {
  if (error instanceof Bitrix24CrmError) return error;

  const record = isRecord(error) ? error : {};
  const status = readNumber(record, 'status') ?? readNumber(record, 'statusCode') ?? readNumber(record, 'code');
  const message = messageOf(error);
  const vendorCode = String(record.error ?? record.error_description ?? record.errorCode ?? message ?? '').toUpperCase();

  if (vendorCode.includes('QUERY_LIMIT') || status === 429) {
    return new Bitrix24CrmError(message, GRPC_STATUS_RESOURCE_EXHAUSTED, 'CRM_VENDOR_RATE_LIMITED', error);
  }
  if (vendorCode.includes('DAILY') || vendorCode.includes('QUOTA')) {
    return new Bitrix24CrmError(message, GRPC_STATUS_RESOURCE_EXHAUSTED, 'CRM_VENDOR_DAILY_QUOTA_EXCEEDED', error);
  }
  if (status === 401 || vendorCode.includes('INVALID_CREDENTIAL') || vendorCode.includes('NO_AUTH')) {
    return new Bitrix24CrmError(message, GRPC_STATUS_UNAUTHENTICATED, 'CRM_VENDOR_UNAUTHORIZED', error);
  }
  if (status === 403 || vendorCode.includes('ACCESS_DENIED') || vendorCode.includes('INSUFFICIENT_SCOPE')) {
    return new Bitrix24CrmError(message, GRPC_STATUS_PERMISSION_DENIED, 'CRM_VENDOR_UNAUTHORIZED', error);
  }
  if (status === 404 || vendorCode.includes('NOT_FOUND')) {
    return new Bitrix24CrmError(message, GRPC_STATUS_NOT_FOUND, notFoundCode, error);
  }
  if (status === 400 || status === 422 || vendorCode.includes('INVALID')) {
    return new Bitrix24CrmError(message, GRPC_STATUS_INVALID_ARGUMENT, 'CRM_VENDOR_INVALID_REQUEST', error);
  }
  if (status !== undefined && status >= 500) {
    return new Bitrix24CrmError(message, GRPC_STATUS_UNAVAILABLE, 'CRM_VENDOR_UNAVAILABLE', error);
  }

  return new Bitrix24CrmError(message, GRPC_STATUS_UNAVAILABLE, 'CRM_VENDOR_UNAVAILABLE', error);
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error)) {
    const message = error.message ?? error.error_description ?? error.error;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return 'Bitrix24 CRM request failed';
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
