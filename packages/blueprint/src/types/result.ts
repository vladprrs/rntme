export type Layer = 'load';

export type BlueprintError = Readonly<{
  layer: Layer;
  code: BlueprintErrorCode;
  message: string;
  path?: string;
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
} as const;

export type BlueprintErrorCode = keyof typeof ERROR_CODES;
