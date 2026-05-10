import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { SecretCipher, TargetSecretRecord } from '@rntme/platform-core';
import { withTransaction } from '../../src/pg/tx.js';
import { PgDeployTargetRepo } from '../../src/repos/pg-deploy-target-repo.js';
import { createPgTargetSecretsRepo } from '../../src/repos/pg-target-secrets-repo.js';
import { integrationContainersAvailable } from './docker-available.js';
import { startPostgres, stopPostgres, resetSchema, type PgHandles } from './harness.js';

const shouldRun = integrationContainersAvailable();
const d = shouldRun ? describe : describe.skip;

const fakeCipher: SecretCipher = {
  encrypt: (pt) => ({ ciphertext: Buffer.from(`enc:${pt}`), nonce: Buffer.from('n'), keyVersion: 1 }),
  decrypt: (s) => s.ciphertext.toString('utf8').replace(/^enc:/, ''),
};

const EVENT_BUS = {
  kind: 'kafka' as const,
  brokers: ['kafka:9092'],
  topicPrefix: 'rntme',
};

const POLICY_VALUES = {
  deploy: { maxServices: 12 },
};

d('PgTargetSecretsRepo', () => {
  let h: PgHandles;
  let orgId: string;
  let accountId: string;
  let targetId: string;

  beforeAll(async () => {
    h = await startPostgres();
  }, 120_000);

  afterAll(async () => {
    if (h) await stopPostgres(h);
  });

  beforeEach(async () => {
    await resetSchema(h.pool);
    orgId = randomUUID();
    accountId = randomUUID();
    targetId = randomUUID();

    await h.pool.query(
      `INSERT INTO organization (id, workos_organization_id, slug, display_name)
       VALUES ($1, $2, 'org', 'Org')`,
      [orgId, `org_${orgId}`],
    );
    await h.pool.query(
      `INSERT INTO account (id, workos_user_id, email, display_name)
       VALUES ($1, $2, 'owner@example.com', 'Owner')`,
      [accountId, `user_${accountId}`],
    );

    // Seed a deploy_target row that secrets repo can write to
    await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgDeployTargetRepo(client);
      const result = await repo.create({
        row: {
          id: targetId,
          orgId,
          slug: 'prod',
          displayName: 'Production',
          kind: 'dokploy',
          dokployUrl: 'https://dokploy.example.com',
          publicBaseUrl: null,
          dokployProjectId: null,
          dokployProjectName: null,
          allowCreateProject: false,
          apiTokenCiphertext: Buffer.from('token-v1'),
          apiTokenNonce: Buffer.from('nonce-v1'),
          apiTokenKeyVersion: 1,
          eventBusConfig: EVENT_BUS,
          storageConfig: { mode: 'external' },
          modules: {},
          workflows: null,
          auth: {},
          policyValues: POLICY_VALUES,
          manualAccess: {},
          isDefault: false,
        },
        auditActorAccountId: accountId,
        auditActorTokenId: null,
      });
      if (!result.ok) throw new Error(result.errors.map((e) => e.message).join(', '));
      return result;
    });
  });

  it('upsert + list + getAllDecrypted roundtrip', async () => {
    const repo = createPgTargetSecretsRepo({ db: h.pool, cipher: fakeCipher });
    const record: TargetSecretRecord = { name: 'auth0_client_secret', schema: 'string-v1', value: 'secret-value' };

    await repo.upsert(targetId, record, new Date('2024-01-01T00:00:00Z'));

    const listed = await repo.list(targetId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      name: 'auth0_client_secret',
      schema: 'string-v1',
    });
    expect(listed[0]?.updatedAt).toBeInstanceOf(Date);

    const decrypted = await repo.getAllDecrypted(targetId);
    expect(decrypted).toEqual({ auth0_client_secret: 'secret-value' });
  });

  it('remove deletes a single secret without affecting others', async () => {
    const repo = createPgTargetSecretsRepo({ db: h.pool, cipher: fakeCipher });
    const now = new Date('2024-01-01T00:00:00Z');

    await repo.upsert(targetId, { name: 'a', schema: 'string-v1', value: 'value-a' }, now);
    await repo.upsert(targetId, { name: 'b', schema: 'string-v1', value: 'value-b' }, now);
    await repo.remove(targetId, 'a');

    const listed = await repo.list(targetId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe('b');
  });

  it('list returns [] for a target with no secrets configured', async () => {
    const repo = createPgTargetSecretsRepo({ db: h.pool, cipher: fakeCipher });

    const listed = await repo.list(targetId);
    expect(listed).toEqual([]);
  });
});
