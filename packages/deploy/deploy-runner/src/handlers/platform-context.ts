import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool, type PoolClient } from 'pg';
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
import { safeProvisionerName } from '@rntme/blueprint';
import { parseTargetSecret } from '@rntme/platform-core';
import type { ProvisionerContract } from '@rntme/deploy-core';
import { createDokployClientFactory } from '../dokploy-client-factory.js';
import type { DokployClient } from '@rntme/deploy-dokploy';
import type { ResolveProvisioner } from '../types.js';

/**
 * Repos resolved against a single transaction client. Every BPMN-task handler
 * runs its DB reads/writes inside `withOrgTx` so RLS sees `app.org_id` set on
 * the connection. Per-call repo factories on `HandlerContext` itself are kept
 * only for tests that don't exercise the tx wrapper.
 */
export type TxRepos = {
  readonly stageState: DeployStageStateRepo;
  readonly deployment: DeploymentRepo;
  readonly deployTarget: DeployTargetRepo;
  readonly targetSecrets: TargetSecretsRepo;
  readonly projectVersion: ProjectVersionRepo;
};

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
  /**
   * Run `fn` inside a Postgres transaction with `app.org_id` set so RLS
   * policies on `deploy_stage_state`, `deployment`, `deploy_target`, and
   * friends accept reads/writes for `orgId`.
   * Used on the runtime request path by the BPMN compose-handler.
   */
  readonly withOrgTx: <T>(orgId: string, fn: (repos: TxRepos) => Promise<T>) => Promise<T>;
  /**
   * Resolves a provisioner package by reading its compiled entry from the
   * materialized bundle (`<projectDir>/assets/provisioners/<safe>.entry.js`).
   * Provisioner module packages are loaded from the materialized bundle's
   * `assets/provisioners/<safe>.entry.js` path rather than node_modules.
   */
  readonly resolveProvisioner: ResolveProvisioner;
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

  const dokployClientFactory = createDokployClientFactory(
    cipher,
    parseTargetSecret as unknown as Parameters<typeof createDokployClientFactory>[1],
  );

  const reposForClient = (client: PoolClient): TxRepos => ({
    stageState: createPgDeployStageStateRepo({ db: drizzle(client) }),
    deployment: new PgDeploymentRepo(client),
    deployTarget: new PgDeployTargetRepo(client),
    targetSecrets: createPgTargetSecretsRepo({ db: client, cipher }),
    projectVersion: new PgProjectVersionRepo(client),
  });

  const withOrgTx = async <T>(
    orgId: string,
    fn: (repos: TxRepos) => Promise<T>,
  ): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
      const result = await fn(reposForClient(client));
      await client.query('COMMIT');
      return result;
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw cause;
    } finally {
      client.release();
    }
  };

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
    withOrgTx,
    resolveProvisioner: buildResolveProvisioner(),
  };
  return cached;
}

/**
 * Loads provisioner entry files from the materialized bundle tmpDir rather
 * than from the worker's own node_modules (which do not contain module
 * packages). Convention: `<projectDir>/assets/provisioners/<safe>.entry.js`
 * where `safe = safeProvisionerName(packageName)`.
 */
export function buildResolveProvisioner(): ResolveProvisioner {
  return async (packageName, _entry, projectDir) => {
    const safe = safeProvisionerName(packageName);
    const relPath = `assets/provisioners/${safe}.entry.js`;
    const absPath = join(projectDir, relPath);
    if (!existsSync(absPath)) {
      throw new Error(
        `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING: module "${packageName}" expected ${relPath} in materialized bundle`,
      );
    }
    let pkg: { provision?: unknown; tearDown?: unknown };
    try {
      pkg = (await import(pathToFileURL(absPath).href)) as { provision?: unknown; tearDown?: unknown };
    } catch (cause) {
      throw new Error(
        `DEPLOY_PROVISION_ENTRY_LOAD_FAILED: module "${packageName}" failed to import: ${(cause as Error).message}`,
      );
    }
    return pkg as ProvisionerContract;
  };
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
