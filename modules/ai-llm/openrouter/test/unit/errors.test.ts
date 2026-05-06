import { describe, expect, it } from 'vitest';
import { AiLlmOpenRouterError, GrpcStatus, unimplemented } from '../../src/errors.js';

describe('AiLlmOpenRouterError', () => {
  it('carries gRPC code and AI_LLM error short-name', () => {
    const e = new AiLlmOpenRouterError('boom', GrpcStatus.UNAUTHENTICATED, 'AI_LLM_VENDOR_UNAUTHORIZED');
    expect(e.message).toBe('boom');
    expect(e.code).toBe(GrpcStatus.UNAUTHENTICATED);
    expect(e.aiLlmCode).toBe('AI_LLM_VENDOR_UNAUTHORIZED');
  });

  it('unimplemented(name) returns a UNIMPLEMENTED-coded error', () => {
    const e = unimplemented('CreateThread');
    expect(e.code).toBe(GrpcStatus.UNIMPLEMENTED);
    expect(e.message).toContain('CreateThread');
  });
});
