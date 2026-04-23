export type BlueprintErrorCode = 'BLUEPRINT_IO_ERROR';

export type BlueprintError = Readonly<{
  layer: 'load';
  code: BlueprintErrorCode;
  message: string;
  path?: string;
}>;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: BlueprintError[] };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(errors: BlueprintError[]): Result<T> {
  return { ok: false, errors };
}
