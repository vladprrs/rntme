import { AiLlmOpenRouterError, GrpcStatus, type GrpcStatusCode } from './errors.js';

export interface MapErrorInput {
  httpStatus?: number;
  orError?: { code?: string; message?: string };
  networkError?: unknown;
}

export function mapOpenRouterError(input: MapErrorInput): AiLlmOpenRouterError {
  if (input.networkError) {
    return new AiLlmOpenRouterError(
      `network error: ${(input.networkError as Error).message ?? String(input.networkError)}`,
      GrpcStatus.UNAVAILABLE,
      'AI_LLM_VENDOR_UNAVAILABLE',
      input.networkError,
    );
  }

  // OR-specific error.code overrides HTTP status semantics.
  switch (input.orError?.code) {
    case 'context_window_exceeded':
      return mk(input, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED');
    case 'content_filter':
      return mk(input, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_VENDOR_CONTENT_FILTERED');
    case 'model_deprecated':
      return mk(input, GrpcStatus.FAILED_PRECONDITION, 'AI_LLM_VENDOR_MODEL_DEPRECATED');
  }

  switch (input.httpStatus) {
    case 400: return mk(input, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_VENDOR_INVALID_REQUEST');
    case 401: return mk(input, GrpcStatus.UNAUTHENTICATED, 'AI_LLM_VENDOR_UNAUTHORIZED');
    case 402: return mk(input, GrpcStatus.RESOURCE_EXHAUSTED, 'AI_LLM_VENDOR_QUOTA_EXCEEDED');
    case 403: return mk(input, GrpcStatus.PERMISSION_DENIED, 'AI_LLM_VENDOR_UNAUTHORIZED');
    case 404: return mk(input, GrpcStatus.NOT_FOUND, 'AI_LLM_VENDOR_INVALID_REQUEST');
    case 408: return mk(input, GrpcStatus.DEADLINE_EXCEEDED, 'AI_LLM_VENDOR_UNAVAILABLE');
    case 413: return mk(input, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_VENDOR_INVALID_REQUEST');
    case 429: return mk(input, GrpcStatus.RESOURCE_EXHAUSTED, 'AI_LLM_VENDOR_RATE_LIMITED');
    case 504: return mk(input, GrpcStatus.DEADLINE_EXCEEDED, 'AI_LLM_VENDOR_UNAVAILABLE');
  }
  if (input.httpStatus !== undefined && input.httpStatus >= 500) {
    return mk(input, GrpcStatus.UNAVAILABLE, 'AI_LLM_VENDOR_UNAVAILABLE');
  }
  return mk(input, GrpcStatus.UNKNOWN, 'AI_LLM_VENDOR_UNAVAILABLE');
}

function mk(input: MapErrorInput, code: GrpcStatusCode, aiLlmCode: string): AiLlmOpenRouterError {
  const msg = input.orError?.message ?? `OR HTTP ${input.httpStatus ?? '?'}`;
  return new AiLlmOpenRouterError(msg, code, aiLlmCode, input.orError);
}
