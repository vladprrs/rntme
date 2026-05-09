import type { Result as SharedResult } from '@rntme/artifact-shared';

export { ok, err, isOk, isErr } from '@rntme/artifact-shared';
export type { Ok, Err } from '@rntme/artifact-shared';

export type Layer = 'parse' | 'structural' | 'cross-ref' | 'internal';

export type InitError = {
  readonly layer: Layer;
  readonly code: InitErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly cause?: readonly unknown[];
};

export type Result<T> = SharedResult<T, InitError>;

export const ERROR_CODES = {
  INIT_PARSE_SCHEMA_VIOLATION: 'INIT_PARSE_SCHEMA_VIOLATION',
  INIT_STRUCT_PROCESS_DEFINITION_PATH_INVALID: 'INIT_STRUCT_PROCESS_DEFINITION_PATH_INVALID',
  INIT_STRUCT_STEP_ID_DUPLICATE: 'INIT_STRUCT_STEP_ID_DUPLICATE',
  INIT_STRUCT_STEP_PROVIDER_UNSUPPORTED: 'INIT_STRUCT_STEP_PROVIDER_UNSUPPORTED',
  INIT_STRUCT_STEP_MODE_UNSUPPORTED: 'INIT_STRUCT_STEP_MODE_UNSUPPORTED',
  INIT_STRUCT_STEP_INPUT_PATH_INVALID: 'INIT_STRUCT_STEP_INPUT_PATH_INVALID',
  INIT_STRUCT_STEP_DEPENDS_ON_UNKNOWN: 'INIT_STRUCT_STEP_DEPENDS_ON_UNKNOWN',
  INIT_STRUCT_STEP_DEPENDS_ON_SELF: 'INIT_STRUCT_STEP_DEPENDS_ON_SELF',
  INIT_XREF_PROCESS_DEFINITION_MISSING: 'INIT_XREF_PROCESS_DEFINITION_MISSING',
  INIT_XREF_STEP_INPUT_MISSING: 'INIT_XREF_STEP_INPUT_MISSING',
  INIT_XREF_TARGET_SERVICE_UNKNOWN: 'INIT_XREF_TARGET_SERVICE_UNKNOWN',
  INIT_XREF_SEED_INVALID: 'INIT_XREF_SEED_INVALID',
} as const;

export type InitErrorCode = keyof typeof ERROR_CODES;
