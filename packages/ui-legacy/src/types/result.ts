export type Layer = 'parse' | 'structural' | 'references' | 'consistency' | 'internal';

export type UiError = {
  layer: Layer;
  code: UiErrorCode;
  message: string;
  path?: string;
  hint?: string;
};

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; errors: UiError[] };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = (errors: UiError[]): Err => ({ ok: false, errors });
export const isOk = <T>(r: Result<T>): r is Ok<T> => r.ok;
export const isErr = <T>(r: Result<T>): r is Err => !r.ok;

export const UI_ERROR_CODES = {
  UI_PARSE_SCHEMA_VIOLATION: 'UI_PARSE_SCHEMA_VIOLATION',
  UI_DUPLICATE_ROUTE_PATH: 'UI_DUPLICATE_ROUTE_PATH',
  UI_BAD_PATH_FORMAT: 'UI_BAD_PATH_FORMAT',
  UI_MISSING_ROOT: 'UI_MISSING_ROOT',
  UI_ORPHAN_ELEMENT: 'UI_ORPHAN_ELEMENT',
  UI_BAD_CHILD_REF: 'UI_BAD_CHILD_REF',
  UI_LAYOUT_SLOT_MISSING: 'UI_LAYOUT_SLOT_MISSING',
  UI_LAYOUT_SLOT_DUPLICATE: 'UI_LAYOUT_SLOT_DUPLICATE',
  UI_UNKNOWN_ACTION: 'UI_UNKNOWN_ACTION',
  UI_UNKNOWN_DATASET: 'UI_UNKNOWN_DATASET',
  UI_UNKNOWN_LAYOUT: 'UI_UNKNOWN_LAYOUT',
  UI_STATE_PATH_UNKNOWN_DATASET: 'UI_STATE_PATH_UNKNOWN_DATASET',
  UI_STATE_PATH_UNKNOWN_ACTION: 'UI_STATE_PATH_UNKNOWN_ACTION',
  UI_UNRESOLVED_BINDING: 'UI_UNRESOLVED_BINDING',
  UI_BINDING_KIND_MISMATCH: 'UI_BINDING_KIND_MISMATCH',
  UI_UNKNOWN_COMPONENT_TYPE: 'UI_UNKNOWN_COMPONENT_TYPE',
  UI_UNCOVERED_QUERY_INPUT: 'UI_UNCOVERED_QUERY_INPUT',
  UI_UNCOVERED_COMMAND_INPUT: 'UI_UNCOVERED_COMMAND_INPUT',
  UI_TYPE_MISMATCH: 'UI_TYPE_MISMATCH',
  UI_UNSUPPORTED_INPUT_MODE: 'UI_UNSUPPORTED_INPUT_MODE',
  UI_NAVIGATION_UNKNOWN_ROUTE: 'UI_NAVIGATION_UNKNOWN_ROUTE',
  UI_NAVIGATION_PLACEHOLDER_UNBOUND: 'UI_NAVIGATION_PLACEHOLDER_UNBOUND',
  UI_INTERNAL: 'UI_INTERNAL',
} as const;

export type UiErrorCode = keyof typeof UI_ERROR_CODES;
