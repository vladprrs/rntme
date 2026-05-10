import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  AesGcmSecretCipher,
  PgDeployTargetRepo,
  PgDeploymentRepo,
  PgProjectVersionRepo,
  S3BlobStore,
  createPgDeployStageStateRepo,
  createPgTargetSecretsRepo,
  type DeployStageStateRepo,
} from '@rntme/platform-storage';
import type {
  BlobStore,
  DeployTargetRepo,
  DeployTargetWithSecret,
  DeploymentRepo,
  ProjectVersionRepo,
  SecretCipher,
  TargetSecretsRepo,
} from '@rntme/platform-core';
import { createDokployClientFactory } from '../dokploy-client-factory.js';
import type { DokployClient } from '@rntme/deploy-dokploy';
import { parseTargetSecret } from '@rntme/platform-core';

/**
 * Platform-side context every stage handler needs: a Postgres pool, the blob
 * store, a secret cipher for decrypting target secrets, and per-org repo
 * factories for the entities the runner reads. This module is loaded once per
 * worker process and memoizes the constructed context.
 *
 * Tests inject a fully-formed mock context via `_setHandlerContextForTest` so
 * unit tests can avoid touching real env / network.
 */
export type HandlerContext = {
  readonly pool: Pool;
  readonly db: NodePgDatabase;
  readonly cipher: SecretCipher;
  readonly blob: BlobStore;
  readonly stageStateRepoFor: (orgId: string) => DeployStageStateRepo;
  readonly deploymentRepoFor: (orgId: string) => DeploymentRepo;
  readonly deployTargetRepoFor: (orgId: string) => DeployTargetRepo;
  readonly targetSecretsRepoFor: (orgId: string) => TargetSecretsRepo;
  readonly projectVersionRepoFor: (orgId: string) => ProjectVersionRepo;
  readonly dokployClientFactoryFor: (
    target: DeployTargetWithSecret,
    extras?: Readonly<Record<string, unknown>>,
  ) => DokployClient;
};

let cached: HandlerContext | undefined;

export function getPlatformHandlerContext(): HandlerContext {
  if (cached !== undefined) return cached;

  const databaseUrl = required('DATABASE_URL');
  const blobBucket = required('PLATFORM_BLOB_BUCKET');
  const blobEndpoint = required('PLATFORM_BLOB_ENDPOINT');
  const blobAccessKeyId = required('PLATFORM_BLOB_ACCESS_KEY_ID');
  const blobSecretAccessKey = required('PLATFORM_BLOB_SECRET_ACCESS_KEY');
  const encryptionKey = required('PLATFORM_SECRET_ENCRYPTION_KEY');

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const cipher = new AesGcmSecretCipher(encryptionKey);
  const blob = new S3BlobStore({
    bucket: blobBucket,
    endpoint: blobEndpoint,
    accessKeyId: blobAccessKeyId,
    secretAccessKey: blobSecretAccessKey,
  });

  // The platform-storage class-based repos accept any `PgQueryable`, so the
  // shared pool is fine for handlers — RLS context is set per-call by the
  // platform's withOrgTx wrapper in app.ts; the BPMN worker runs each handler
  // outside that wrapper today and falls back to the pool's default RLS rules.
  // (Task 17 smoke will reveal whether per-call RLS context is required for
  // the handler path; if so, we wrap each handler in a connect/BEGIN/SET-LOCAL
  // dance similar to app.ts withOrgTx in a follow-up.)
  const dokployClientFactory = createDokployClientFactory(
    cipher,
    parseTargetSecret as unknown as Parameters<typeof createDokployClientFactory>[1],
  );

  cached = {
    pool,
    db,
    cipher,
    blob,
    stageStateRepoFor: (_orgId) => createPgDeployStageStateRepo({ db }),
    deploymentRepoFor: (_orgId) => new PgDeploymentRepo(pool),
    deployTargetRepoFor: (_orgId) => new PgDeployTargetRepo(pool),
    targetSecretsRepoFor: (_orgId) => createPgTargetSecretsRepo({ db: pool, cipher }),
    projectVersionRepoFor: (_orgId) => new PgProjectVersionRepo(pool),
    dokployClientFactoryFor: (target, extras) => dokployClientFactory(target, extras),
  };
  return cached;
}

/** Test-only: inject a mock context (or clear it). */
export function _setHandlerContextForTest(ctx: HandlerContext | undefined): void {
  cached = ctx;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`HANDLER_ENV_MISSING: ${name}`);
  }
  return value;
}
