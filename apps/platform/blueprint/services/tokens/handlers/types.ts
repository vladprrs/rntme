import type { RuntimeApiToken } from './runtime-token-store.js';

export type AuthSubject = {
  readonly account: {
    readonly id: string;
    readonly workosUserId: string;
    readonly displayName: string;
    readonly email: string | null;
  };
  readonly org: {
    readonly id: string;
    readonly workosOrgId: string;
    readonly slug: string;
  };
  readonly role: 'admin' | 'member';
  readonly scopes: readonly string[];
  readonly tokenId: string | null | undefined;
};

export type ApiTokenProviderLike = {
  readonly authenticate: (input: {
    readonly authorizationHeader: string | undefined;
    readonly cookieHeader: string | undefined;
  }) => Promise<
    | { readonly ok: true; readonly value: AuthSubject }
    | { readonly ok: false; readonly errors: readonly { readonly code: string; readonly message: string }[] }
  >;
};

export type IntrospectTokenHandlerInput = {
  readonly bearerToken?: string | null;
};

export type IntrospectTokenHandlerOutput = {
  readonly status: 'active';
  readonly subject: AuthSubject;
};

export type IntrospectTokenHandlerDeps = {
  readonly provider: ApiTokenProviderLike;
};

export type CreateTokenHandlerInput = {
  readonly authorization?: string | null;
  readonly organizationId: string;
  readonly name: string;
  readonly scopesJson: string;
  readonly expiresAt?: string | null;
  readonly sessionSubject?: string | null;
  readonly sessionStatus?: string | null;
  readonly sessionAudience?: string | null;
};

export type CreateTokenHandlerOutput = {
  readonly status: 'created';
  readonly token: RuntimeApiToken;
  readonly plaintext: string;
};
