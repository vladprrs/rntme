import { describe, expect, it } from 'bun:test';
import { mapOpenRouterError } from '../../src/error-mapper.js';
import { GrpcStatus } from '../../src/errors.js';

const cases: { name: string; status: number; orError?: { code?: string; message?: string }; expectedCode: string; expectedGrpc: number }[] = [
  { name: '400', status: 400, expectedCode: 'AI_LLM_VENDOR_INVALID_REQUEST', expectedGrpc: GrpcStatus.INVALID_ARGUMENT },
  { name: '401', status: 401, expectedCode: 'AI_LLM_VENDOR_UNAUTHORIZED', expectedGrpc: GrpcStatus.UNAUTHENTICATED },
  { name: '402', status: 402, expectedCode: 'AI_LLM_VENDOR_QUOTA_EXCEEDED', expectedGrpc: GrpcStatus.RESOURCE_EXHAUSTED },
  { name: '403', status: 403, expectedCode: 'AI_LLM_VENDOR_UNAUTHORIZED', expectedGrpc: GrpcStatus.PERMISSION_DENIED },
  { name: '404', status: 404, expectedCode: 'AI_LLM_VENDOR_INVALID_REQUEST', expectedGrpc: GrpcStatus.NOT_FOUND },
  { name: '408', status: 408, expectedCode: 'AI_LLM_VENDOR_UNAVAILABLE', expectedGrpc: GrpcStatus.DEADLINE_EXCEEDED },
  { name: '413', status: 413, expectedCode: 'AI_LLM_VENDOR_INVALID_REQUEST', expectedGrpc: GrpcStatus.INVALID_ARGUMENT },
  { name: '429', status: 429, expectedCode: 'AI_LLM_VENDOR_RATE_LIMITED', expectedGrpc: GrpcStatus.RESOURCE_EXHAUSTED },
  { name: '500', status: 500, expectedCode: 'AI_LLM_VENDOR_UNAVAILABLE', expectedGrpc: GrpcStatus.UNAVAILABLE },
  { name: '503', status: 503, expectedCode: 'AI_LLM_VENDOR_UNAVAILABLE', expectedGrpc: GrpcStatus.UNAVAILABLE },
  { name: '504', status: 504, expectedCode: 'AI_LLM_VENDOR_UNAVAILABLE', expectedGrpc: GrpcStatus.DEADLINE_EXCEEDED },
  { name: 'context_window_exceeded', status: 400, orError: { code: 'context_window_exceeded' }, expectedCode: 'AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED', expectedGrpc: GrpcStatus.INVALID_ARGUMENT },
  { name: 'content_filter', status: 400, orError: { code: 'content_filter' }, expectedCode: 'AI_LLM_VENDOR_CONTENT_FILTERED', expectedGrpc: GrpcStatus.INVALID_ARGUMENT },
  { name: 'model_deprecated', status: 400, orError: { code: 'model_deprecated' }, expectedCode: 'AI_LLM_VENDOR_MODEL_DEPRECATED', expectedGrpc: GrpcStatus.FAILED_PRECONDITION },
];

describe('mapOpenRouterError', () => {
  for (const c of cases) {
    it(c.name, () => {
      const input: { httpStatus: number; orError?: { code?: string; message?: string } } = { httpStatus: c.status };
      if (c.orError) input.orError = c.orError;
      const e = mapOpenRouterError(input);
      expect(e.aiLlmCode).toBe(c.expectedCode);
      expect(e.code).toBe(c.expectedGrpc);
    });
  }

  it('network error (no httpStatus) maps to UNAVAILABLE', () => {
    const e = mapOpenRouterError({ networkError: new Error('ENOTFOUND') });
    expect(e.aiLlmCode).toBe('AI_LLM_VENDOR_UNAVAILABLE');
    expect(e.code).toBe(GrpcStatus.UNAVAILABLE);
  });
});
