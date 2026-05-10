import type { ApiTokenProvider, AuthSubject } from '@rntme/platform-core';

export type IntrospectTokenHandlerInput = {
  readonly bearerToken: string;
};

export type IntrospectTokenHandlerOutput =
  | { readonly status: 'active'; readonly subject: AuthSubject }
  | { readonly status: 'inactive'; readonly reason: string; readonly code: string };

export type IntrospectTokenHandlerDeps = {
  readonly provider: ApiTokenProvider;
};
