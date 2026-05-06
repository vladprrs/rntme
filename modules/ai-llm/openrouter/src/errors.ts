import { status as grpcStatus } from '@grpc/grpc-js';

export const GrpcStatus = grpcStatus;
export type GrpcStatusCode = (typeof grpcStatus)[keyof typeof grpcStatus];

export class AiLlmOpenRouterError extends Error {
  readonly code: GrpcStatusCode;
  readonly aiLlmCode: string;
  override readonly cause?: unknown;

  constructor(message: string, code: GrpcStatusCode, aiLlmCode: string, cause?: unknown) {
    super(message);
    this.name = 'AiLlmOpenRouterError';
    this.code = code;
    this.aiLlmCode = aiLlmCode;
    if (cause !== undefined) this.cause = cause;
  }
}

export function unimplemented(rpcName: string): AiLlmOpenRouterError {
  return new AiLlmOpenRouterError(
    `RPC ${rpcName} is not implemented by @rntme/ai-llm-openrouter`,
    GrpcStatus.UNIMPLEMENTED,
    'AI_LLM_VENDOR_INVALID_REQUEST',
  );
}
