import type { ZodError } from 'zod';

export type RuntimeErrorEntry = {
  bindingId?: string;
  graphId: string;
  cause: unknown;
};

export class BindingsRuntimeError extends Error {
  readonly errors: readonly RuntimeErrorEntry[];

  constructor(errors: readonly RuntimeErrorEntry[]) {
    super(`Failed to initialize bindings runtime: ${errors.length} binding(s) could not be compiled`);
    this.name = 'BindingsRuntimeError';
    this.errors = errors;
  }
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
