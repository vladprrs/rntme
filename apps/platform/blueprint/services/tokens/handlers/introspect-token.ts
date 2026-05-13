import type {
  IntrospectTokenHandlerDeps,
  IntrospectTokenHandlerInput,
  IntrospectTokenHandlerOutput,
} from './types.js';

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

  // Runtime-native persistence/repository wiring is a follow-up slice. Until
  // then, structurally valid PATs are rejected with a typed auth error instead
  // of crashing the runtime on the old dependency-injected handler contract.
  throw platformAuthError('PLATFORM_AUTH_INVALID', 'invalid token');
}

function normalizeBearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isDeps(value: unknown): value is IntrospectTokenHandlerDeps {
  if (value === null || typeof value !== 'object') return false;
  const provider = (value as { provider?: { authenticate?: unknown } }).provider;
  return provider !== undefined && typeof provider.authenticate === 'function';
}

function platformAuthError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code?: string }).code = code;
  return error;
}
