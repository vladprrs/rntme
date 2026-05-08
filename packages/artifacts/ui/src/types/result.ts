import type { Result as SharedResult } from '@rntme/artifact-shared';

export { ok, err, isOk, isErr } from '@rntme/artifact-shared';
export type { Ok, Err } from '@rntme/artifact-shared';

export type UiErrorCode =
  // Resolve phase
  | 'MANIFEST_INVALID'
  | 'FILE_NOT_FOUND'
  | 'CIRCULAR_REF'
  | 'DUPLICATE_SCREEN_KEY'
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
  | 'UI_REFERENCES_UNKNOWN_STORAGE_ROUTE'
  | 'UNKNOWN_ONSUCCESS_ROUTE'
  | 'UNDECLARED_REFETCH_TARGET'
  | 'INVALID_FORM_STATE_CLEAR'
  // Validate — consistency
  | 'TYPE_MISMATCH'
  | 'UNCOVERED_INPUT'
  // Emit
  | 'EMIT_FAILED'
  // Generic
  | 'INTERNAL'
  // Module actions / catalog
  | 'UNKNOWN_OPERATION'
  | 'UNKNOWN_COMPONENT_TYPE'
  | 'PROP_REQUIRED_MISSING'
  | 'MODULE_ACTION_NEEDS_TARGET_OR_MODULE'
  | 'MODULE_ACTION_AMBIGUOUS_ADDRESSING'
  | 'MODULE_ACTION_TARGET_MISSING'
  | 'MODULE_ACTION_TARGET_TYPE_MISMATCH'
  | 'MODULE_ACTION_NEEDS_TARGET'
  | 'MODULE_ACTION_NEEDS_MODULE'
  | 'MODULE_ACTION_PARAM_REQUIRED'
  | 'MODULE_ACTION_PARAM_TYPE_MISMATCH'
  | 'CATEGORY_NOT_MAPPED'
  | 'VISIBLE_OPERATOR_UNKNOWN'
  | 'ON_HANDLER_ARRAY_INVALID';

export type UiError = {
  layer?: UiErrorLayer;
  code: UiErrorCode;
  message: string;
  path?: string;
};

export type UiErrorLayer =
  | 'resolve'
  | 'expand'
  | 'parse'
  | 'structural'
  | 'references'
  | 'consistency'
  | 'emit'
  | 'internal';

export type Result<T> = SharedResult<T, UiError>;
