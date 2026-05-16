import { Buffer } from 'node:buffer';
import { AesGcmSecretCipher } from '@rntme/platform-storage';

/**
 * Shared runtime-secret-cipher helper for the deployments-service handlers.
 *
 * - readRuntimeSecretKey() reads PLATFORM_SECRET_ENCRYPTION_KEY and builds the
 *   canonical AesGcmSecretCipher; returns a typed Result-like discriminated
 *   union so both `start-deployment.ts` and `deploy-targets.ts` can pattern-
 *   match consistently.
 * - encryptRuntimeSecret / decryptRuntimeSecret convert between the wire
 *   shape used in DB rows (base64 strings) and the canonical Buffer-based
 *   EncryptedSecret algebra owned by @rntme/platform-storage. Crypto is
 *   delegated; only the encoding boundary lives here.
 *
 * Both error paths use code `PLATFORM_STORAGE_DB_UNAVAILABLE` to align with
 * the existing CLI test fixture (`apps/cli/test/unit/api/target-endpoints.test.ts`)
 * and other PLATFORM_STORAGE_DB_UNAVAILABLE call sites in the deployments
 * handlers. The audit (F031) flagged the old code-divergence as a real bug
 * leaking into API responses.
 */

export type RuntimeSecretKeyResult =
  | { readonly status: 'ok'; readonly cipher: AesGcmSecretCipher }
  | { readonly status: 'error'; readonly code: 'PLATFORM_STORAGE_DB_UNAVAILABLE'; readonly message: string };

export function readRuntimeSecretKey(): RuntimeSecretKeyResult {
  const raw = process.env.PLATFORM_SECRET_ENCRYPTION_KEY;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {
      status: 'error',
      code: 'PLATFORM_STORAGE_DB_UNAVAILABLE',
      message: 'runtime-native deploy target creation requires encrypted target-secret storage',
    };
  }
  const trimmed = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return {
      status: 'error',
      code: 'PLATFORM_STORAGE_DB_UNAVAILABLE',
      message: 'runtime-native deploy target creation requires a 32-byte hex PLATFORM_SECRET_ENCRYPTION_KEY',
    };
  }
  return { status: 'ok', cipher: new AesGcmSecretCipher(trimmed) };
}

export type RuntimeSecretWireFormat = {
  readonly ciphertext: string;
  readonly nonce: string;
  readonly keyVersion: 1;
};

export function encryptRuntimeSecret(cipher: AesGcmSecretCipher, plaintext: string): RuntimeSecretWireFormat {
  const sealed = cipher.encrypt(plaintext);
  return {
    ciphertext: sealed.ciphertext.toString('base64'),
    nonce: sealed.nonce.toString('base64'),
    keyVersion: 1,
  };
}

export function decryptRuntimeSecret(cipher: AesGcmSecretCipher, ciphertext: string, nonce: string): string {
  return cipher.decrypt({
    ciphertext: Buffer.from(ciphertext, 'base64'),
    nonce: Buffer.from(nonce, 'base64'),
    keyVersion: 1,
  });
}

export function encryptJson(cipher: AesGcmSecretCipher, value: unknown): RuntimeSecretWireFormat {
  return encryptRuntimeSecret(cipher, JSON.stringify(value));
}
