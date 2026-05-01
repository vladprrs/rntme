export const ERROR_CODES = {
  DB_STUDIO_PARSE_SYNTAX: 'DB_STUDIO_PARSE_SYNTAX',
  DB_STUDIO_PARSE_MULTIPLE_STATEMENTS: 'DB_STUDIO_PARSE_MULTIPLE_STATEMENTS',
  DB_STUDIO_READONLY_NOT_SELECT: 'DB_STUDIO_READONLY_NOT_SELECT',
  DB_STUDIO_READONLY_PRAGMA_DENIED: 'DB_STUDIO_READONLY_PRAGMA_DENIED',
  DB_STUDIO_READONLY_ATTACH_DENIED: 'DB_STUDIO_READONLY_ATTACH_DENIED',
  DB_STUDIO_READONLY_CTE_WRITE: 'DB_STUDIO_READONLY_CTE_WRITE',
  DB_STUDIO_READONLY_TXN_DENIED: 'DB_STUDIO_READONLY_TXN_DENIED',
  DB_STUDIO_LIMIT_TOO_LARGE: 'DB_STUDIO_LIMIT_TOO_LARGE',
  DB_STUDIO_SQLITE_ERROR: 'DB_STUDIO_SQLITE_ERROR',
  DB_STUDIO_TARGET_UNKNOWN: 'DB_STUDIO_TARGET_UNKNOWN',
  DB_STUDIO_HRANA_UNSUPPORTED: 'DB_STUDIO_HRANA_UNSUPPORTED',
  DB_STUDIO_HRANA_BAD_REQUEST: 'DB_STUDIO_HRANA_BAD_REQUEST',
} as const;

export type StudioErrorCode = keyof typeof ERROR_CODES;

export type StudioError = {
  code: StudioErrorCode;
  message: string;
};

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; error: StudioError };
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}
export function err(code: StudioErrorCode, message: string): Err {
  return { ok: false, error: { code, message } };
}

export type HranaInlineError = {
  type: 'error';
  error: { message: string; code: StudioErrorCode };
};

export function toHranaError(e: StudioError): HranaInlineError {
  return { type: 'error', error: { message: e.message, code: e.code } };
}
