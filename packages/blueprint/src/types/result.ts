export type Layer = 'load' | 'parse' | 'structural';

export type BlueprintError = Readonly<{
  layer: Layer;
  code: BlueprintErrorCode;
  message: string;
  path?: string;
  cause?: unknown[];
}>;

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; errors: BlueprintError[] };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = (errors: BlueprintError[]): Err => ({ ok: false, errors });
export const isOk = <T>(r: Result<T>): r is Ok<T> => r.ok;
export const isErr = <T>(r: Result<T>): r is Err => !r.ok;

export const ERROR_CODES = {
  BLUEPRINT_IO_ERROR: 'BLUEPRINT_IO_ERROR',
  BLUEPRINT_PARSE_SCHEMA_VIOLATION: 'BLUEPRINT_PARSE_SCHEMA_VIOLATION',
  BLUEPRINT_STRUCT_DECLARED_SERVICE_DIR_MISSING:
    'BLUEPRINT_STRUCT_DECLARED_SERVICE_DIR_MISSING',
  BLUEPRINT_STRUCT_UNDECLARED_SERVICE_DIR:
    'BLUEPRINT_STRUCT_UNDECLARED_SERVICE_DIR',
  BLUEPRINT_STRUCT_SERVICE_JSON_MISSING:
    'BLUEPRINT_STRUCT_SERVICE_JSON_MISSING',
  BLUEPRINT_STRUCT_MOD_KIND_MISMATCH: 'BLUEPRINT_STRUCT_MOD_KIND_MISMATCH',
} as const;

export type BlueprintErrorCode = keyof typeof ERROR_CODES;
