import type { ApiTokenProvider, AuthSubject } from '@rntme/platform-core';

export type IntrospectTokenHandlerInput = {
  readonly bearerToken?: string | null;
};

export type IntrospectTokenHandlerOutput = {
  readonly status: 'active';
  readonly subject: AuthSubject;
};

export type IntrospectTokenHandlerDeps = {
  readonly provider: ApiTokenProvider;
};
