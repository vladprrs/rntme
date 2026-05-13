import { isOk } from '@rntme/platform-core';
import type {
  IntrospectTokenHandlerDeps,
  IntrospectTokenHandlerInput,
  IntrospectTokenHandlerOutput,
} from './types.js';

export async function introspectTokenHandler(
  deps: IntrospectTokenHandlerDeps,
  input: IntrospectTokenHandlerInput,
): Promise<IntrospectTokenHandlerOutput> {
  const r = await deps.provider.authenticate({
    authorizationHeader: input.bearerToken,
    cookieHeader: undefined,
  });
  if (isOk(r)) {
    return { status: 'active', subject: r.value };
  }
  const first = r.errors[0] ?? { code: 'PLATFORM_AUTH_INVALID', message: 'invalid token' };
  const error = new Error(first.message);
  (error as Error & { code?: string }).code = first.code;
  throw error;
}
