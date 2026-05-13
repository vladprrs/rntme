import type {
  IntrospectTokenHandlerDeps,
  IntrospectTokenHandlerInput,
  IntrospectTokenHandlerOutput,
} from './types.js';
import {
  introspectRuntimeToken,
  isRuntimeCtx,
  normalizeBearerToken,
  platformAuthError,
} from './runtime-token-store.js';

export async function introspectTokenHandler(
  inputOrDeps: IntrospectTokenHandlerInput | IntrospectTokenHandlerDeps,
  maybeInput?: IntrospectTokenHandlerInput,
): Promise<IntrospectTokenHandlerOutput> {
  if (isDeps(inputOrDeps)) {
    const r = await inputOrDeps.provider.authenticate({
      authorizationHeader: normalizeBearerToken(maybeInput?.bearerToken) ?? undefined,
      cookieHeader: undefined,
    });
    if (r.ok) {
      return { status: 'active', subject: r.value };
    }
    const first = r.errors[0] ?? { code: 'PLATFORM_AUTH_INVALID', message: 'invalid token' };
    throw platformAuthError(first.code, first.message);
  }

  const bearerToken = normalizeBearerToken(inputOrDeps.bearerToken);
  if (bearerToken === null) throw platformAuthError('PLATFORM_AUTH_MISSING', 'no bearer token');
  const plaintext = bearerToken.startsWith('Bearer ') ? bearerToken.slice('Bearer '.length) : bearerToken;
  if (!plaintext.startsWith('rntme_pat_')) throw platformAuthError('PLATFORM_AUTH_MISSING', 'no bearer token');

  if (!isRuntimeCtx(maybeInput)) {
    throw platformAuthError('PLATFORM_AUTH_INVALID', 'invalid token');
  }
  const subject = introspectRuntimeToken(maybeInput, bearerToken);
  return { status: 'active', subject };
}

function isDeps(value: unknown): value is IntrospectTokenHandlerDeps {
  if (value === null || typeof value !== 'object') return false;
  const provider = (value as { provider?: { authenticate?: unknown } }).provider;
  return provider !== undefined && typeof provider.authenticate === 'function';
}
