import { Buffer } from 'node:buffer';
import {
  createDokployClientFactory,
  type DokployResolvedTargetSecretMap,
  type DokployTargetWithSecret,
  type ParseTargetSecretFn,
  type SecretCipher,
} from '@rntme/deploy-runner';
import type { DokployClient } from '@rntme/deploy-dokploy';

export function buildPlainTokenDokployClient(
  apiToken: string,
  dokployUrl: string,
  httpFetch: typeof globalThis.fetch = globalThis.fetch,
  resolvedTargetSecrets?: DokployResolvedTargetSecretMap,
): DokployClient {
  const stubCipher: SecretCipher = {
    encrypt: () => ({ ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 0 }),
    decrypt: () => apiToken,
  };
  // Direct mode does not support secret schemas that require runtime parsing
  // (e.g., redpanda-console-htpasswd). The factory only invokes this fn when
  // such a secret is referenced; CLI users should provide pre-resolved values.
  const stubParse: ParseTargetSecretFn = () => ({
    ok: false,
    errors: [
      {
        code: 'CLI_DEPLOY_SECRET_PARSE_UNSUPPORTED',
        message: 'direct-mode CLI does not support runtime secret schemas',
      },
    ],
  });
  const stubTarget: DokployTargetWithSecret = {
    apiTokenCiphertext: Buffer.alloc(0),
    apiTokenNonce: Buffer.alloc(0),
    apiTokenKeyVersion: 0,
    dokployUrl,
  };
  const factory = createDokployClientFactory(stubCipher, stubParse, httpFetch);
  return factory(stubTarget, resolvedTargetSecrets);
}
