import type { ZodError } from 'zod';

export type RuntimeErrorEntry = {
  bindingId?: string;
  graphId: string;
  cause: unknown;
};

export const BINDINGS_HTTP_STARTUP_ERROR_CODES = {
  MISSING_RUNTIME_DEPENDENCY: 'BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY',
} as const;

export type StartupDependencyName =
  | 'eventStore'
  | 'commandExecutor'
  | 'externalAdapterClient';

export type MissingRuntimeDependencyCause = Readonly<{
  code: typeof BINDINGS_HTTP_STARTUP_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY;
  dependency: StartupDependencyName;
  message: string;
}>;

export class BindingsRuntimeError extends Error {
  readonly errors: readonly RuntimeErrorEntry[];

  constructor(errors: readonly RuntimeErrorEntry[]) {
    const firstCause = errors[0]?.cause;
    const causeMessage =
      errors.length === 1 &&
      typeof firstCause === 'object' &&
      firstCause !== null &&
      'code' in firstCause &&
      firstCause.code === BINDINGS_HTTP_STARTUP_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY &&
      'message' in firstCause &&
      typeof firstCause.message === 'string'
        ? firstCause.message
        : null;
    super(
      causeMessage === null
        ? `Failed to initialize bindings runtime: ${errors.length} binding(s) could not be compiled`
        : `Failed to initialize bindings runtime: ${causeMessage}`,
    );
    this.name = 'BindingsRuntimeError';
    this.errors = errors;
  }
}

export function missingRuntimeDependencyError(
  entry: Pick<RuntimeErrorEntry, 'bindingId' | 'graphId'>,
  dependency: StartupDependencyName,
): BindingsRuntimeError {
  const cause: MissingRuntimeDependencyCause = {
    code: BINDINGS_HTTP_STARTUP_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY,
    dependency,
    message: `${dependency} is required for this bindings runtime configuration`,
  };
  return new BindingsRuntimeError([{ ...entry, cause }]);
}

export type ErrorResponseBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type ValidationDetail = {
  path: string;
  message: string;
  code: string;
};

export function validationErrorBody(err: ZodError): ErrorResponseBody & { details: ValidationDetail[] } {
  return {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request parameters',
    details: err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    })),
  };
}

export function invalidBodyErrorBody(message: string): ErrorResponseBody {
  return { code: 'INVALID_BODY', message };
}

export function internalErrorBody(): ErrorResponseBody {
  return { code: 'INTERNAL_ERROR', message: 'Internal server error' };
}

export type CommandErrorStatus = 409 | 422;

export type CommandErrorLike = { code: string; message: string; detail?: unknown };

export function commandErrorStatus(err: CommandErrorLike): CommandErrorStatus {
  return err.code === 'COMMAND_CONCURRENCY_CONFLICT' ? 409 : 422;
}

export function commandErrorBody(err: CommandErrorLike): ErrorResponseBody {
  const body: ErrorResponseBody = { code: err.code, message: err.message };
  if (err.detail !== undefined) body.details = err.detail;
  return body;
}
