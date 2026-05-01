import type { GraphIrError, Layer } from './result.js';
import { ERROR_CODES } from './result.js';

export class GraphIrInternalError extends Error {
  readonly graphIrError: GraphIrError;

  constructor(error: GraphIrError) {
    super(error.message);
    this.name = 'GraphIrInternalError';
    this.graphIrError = error;
  }
}

export class GraphIrRuntimeError extends Error {
  readonly code: 'RUNTIME_MISSING_REQUIRED_PARAM' | 'RUNTIME_SQLITE_ERROR' | 'RUNTIME_INTERNAL_ERROR';

  constructor(code: GraphIrRuntimeError['code'], message: string) {
    super(message);
    this.name = 'GraphIrRuntimeError';
    this.code = code;
  }
}

export class GraphIrCompileError extends Error {
  readonly errors: GraphIrError[];

  constructor(errors: GraphIrError[]) {
    super('compile failed');
    this.name = 'GraphIrCompileError';
    this.errors = errors;
  }
}

export function internalError(layer: Layer, message: string, cause?: unknown): GraphIrInternalError {
  const code =
    layer === 'runtime'
      ? ERROR_CODES.RUNTIME_INTERNAL_ERROR
      : ERROR_CODES.LOWERING_INTERNAL_ERROR;
  const hint = cause instanceof Error ? cause.message : cause === undefined ? undefined : String(cause);
  return new GraphIrInternalError({
    layer,
    code,
    message,
    ...(hint !== undefined ? { hint } : {}),
  });
}

export function runtimeError(
  code: GraphIrRuntimeError['code'],
  message: string,
): GraphIrRuntimeError {
  return new GraphIrRuntimeError(code, message);
}

export function compileFailed(errors: GraphIrError[]): GraphIrCompileError {
  return new GraphIrCompileError(errors);
}

export function toGraphIrError(error: unknown, layer: Layer): GraphIrError {
  if (error instanceof GraphIrInternalError) return error.graphIrError;
  return internalError(layer, error instanceof Error ? error.message : String(error)).graphIrError;
}
