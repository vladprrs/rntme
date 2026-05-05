import type { SecretCipher, TargetSecretRecord, TargetSecretSummary, TargetSecretsRepo } from '@rntme/platform-core';
import type { Buffer } from 'node:buffer';
import type { PgQueryable } from '../pg/pool.js';

type StoredEntry = {
  schema: string;
  value: unknown;
  updatedAt: string;
};

type StoredEnvelope = {
  secrets: Record<string, StoredEntry>;
};

export function createPgTargetSecretsRepo(deps: {
  db: PgQueryable;
  cipher: SecretCipher;
}): TargetSecretsRepo {
  return {
    async list(targetId: string): Promise<readonly TargetSecretSummary[]> {
      const env = await loadEnvelope(deps, targetId);
      return Object.entries(env.secrets).map(([name, e]) => ({
        name,
        schema: e.schema,
        updatedAt: new Date(e.updatedAt),
      }));
    },

    async upsert(targetId: string, record: TargetSecretRecord, now: Date): Promise<void> {
      const env = await loadEnvelope(deps, targetId);
      env.secrets[record.name] = {
        schema: record.schema,
        value: record.value,
        updatedAt: now.toISOString(),
      };
      await writeEnvelope(deps, targetId, env);
    },

    async remove(targetId: string, name: string): Promise<void> {
      const env = await loadEnvelope(deps, targetId);
      delete env.secrets[name];
      await writeEnvelope(deps, targetId, env);
    },

    async getAllDecrypted(targetId: string): Promise<Readonly<Record<string, unknown>>> {
      const env = await loadEnvelope(deps, targetId);
      const out: Record<string, unknown> = {};
      for (const [name, entry] of Object.entries(env.secrets)) {
        out[name] = entry.value;
      }
      return out;
    },
  };
}

async function loadEnvelope(
  deps: { db: PgQueryable; cipher: SecretCipher },
  targetId: string,
): Promise<StoredEnvelope> {
  const result = await deps.db.query<{
    ct: Buffer | null;
    nonce: Buffer | null;
    kv: number | null;
  }>(
    `SELECT target_secrets_ciphertext AS ct,
            target_secrets_nonce AS nonce,
            target_secrets_key_version AS kv
     FROM deploy_target
     WHERE id = $1`,
    [targetId],
  );

  const row = result.rows[0];
  if (!row || row.ct === null || row.nonce === null || row.kv === null) {
    return { secrets: {} };
  }

  const plaintext = deps.cipher.decrypt({ ciphertext: row.ct, nonce: row.nonce, keyVersion: row.kv });
  return JSON.parse(plaintext) as StoredEnvelope;
}

async function writeEnvelope(
  deps: { db: PgQueryable; cipher: SecretCipher },
  targetId: string,
  env: StoredEnvelope,
): Promise<void> {
  const enc = deps.cipher.encrypt(JSON.stringify(env));
  await deps.db.query(
    `UPDATE deploy_target
     SET target_secrets_ciphertext = $1,
         target_secrets_nonce = $2,
         target_secrets_key_version = $3
     WHERE id = $4`,
    [enc.ciphertext, enc.nonce, enc.keyVersion, targetId],
  );
}
