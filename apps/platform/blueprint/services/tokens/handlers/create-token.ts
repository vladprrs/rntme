import type {
  CreateTokenHandlerInput,
  CreateTokenHandlerOutput,
} from './types.js';
import {
  createRuntimeToken,
  isRuntimeCtx,
  platformAuthError,
} from './runtime-token-store.js';

export async function createTokenHandler(
  input: CreateTokenHandlerInput,
  ctx: unknown,
): Promise<CreateTokenHandlerOutput> {
  if (!isRuntimeCtx(ctx)) {
    throw platformAuthError('PLATFORM_AUTH_FORBIDDEN', 'runtime token storage is not available');
  }
  if (input.sessionStatus !== 'ACTIVE' || typeof input.sessionSubject !== 'string') {
    throw platformAuthError('PLATFORM_AUTH_MISSING', 'active edge session is required');
  }

  const created = createRuntimeToken(ctx, {
    organizationId: input.organizationId,
    accountId: input.sessionSubject,
    name: input.name,
    scopesJson: input.scopesJson,
    expiresAt: input.expiresAt,
  });
  return {
    status: 'created',
    token: created.token,
    plaintext: created.plaintext,
  };
}
