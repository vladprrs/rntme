export type UiErrorCode =
  // Resolve phase
  | 'MANIFEST_INVALID'
  | 'FILE_NOT_FOUND'
  | 'CIRCULAR_REF'
  // Expand phase
  | 'UNBOUND_PARAM'
  | 'UNKNOWN_PARAM'
  // Validate — parse
  | 'SPEC_INVALID'
  | 'SCREEN_SCHEMA_INVALID'
  // Validate — structural
  | 'MISSING_ROOT'
  | 'ORPHAN_ELEMENT'
  | 'BAD_CHILD_REF'
  | 'SLOT_NOT_IN_LAYOUT'
  // Validate — references
  | 'UNRESOLVED_BINDING'
  | 'BINDING_KIND_MISMATCH'
  | 'UNCOVERED_STATE_PATH'
  | 'UNKNOWN_ROUTE'
  // Validate — consistency
  | 'TYPE_MISMATCH'
  | 'UNCOVERED_INPUT'
  // Emit
  | 'EMIT_FAILED'
  // Generic
  | 'INTERNAL';

export type UiError = {
  code: UiErrorCode;
  message: string;
  path?: string;
};

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; errors: UiError[] };
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(...errors: UiError[]): Err {
  return { ok: false, errors };
}

export function isOk<T>(r: Result<T>): r is Ok<T> {
  return r.ok;
}

export function isErr<T>(r: Result<T>): r is Err {
  return !r.ok;
}
