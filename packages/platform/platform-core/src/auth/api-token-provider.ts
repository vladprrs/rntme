import type { IdentityProvider, AuthContext } from './provider.js';
import { introspectToken, type IntrospectTokenDeps } from '../use-cases/tokens.js';
import { err } from '../types/result.js';

export class ApiTokenProvider implements IdentityProvider {
  readonly name = 'api-token' as const;
  constructor(private readonly deps: IntrospectTokenDeps['repos']) {}

  async authenticate(ctx: AuthContext) {
    const header = ctx.authorizationHeader;
    if (!header) {
      return err([{ code: 'PLATFORM_AUTH_MISSING' as const, message: 'no bearer token' }]);
    }
    return introspectToken({ deps: { repos: this.deps }, input: { bearerToken: header } });
  }
}
