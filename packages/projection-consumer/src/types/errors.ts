export type ApplyCompileErrorCode =
  | 'PC_COMPOSITE_KEY_NOT_SUPPORTED'
  | 'PC_COLUMN_SOURCE_UNRESOLVABLE'
  | 'PC_MISSING_ENTITY_FIELD';

export class ApplyCompileError extends Error {
  readonly code: ApplyCompileErrorCode;
  readonly detail?: Record<string, unknown>;

  constructor(code: ApplyCompileErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = 'ApplyCompileError';
    this.code = code;
    if (detail) this.detail = detail;
  }
}
