#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Database } from 'bun:sqlite';
import { createHandler } from '../handler.js';
import { createPendingStore } from '../pending-store.js';
import { createRouteResolver } from '../route-resolver.js';
import { createStorageGrpcServer, type StorageRpcName } from '../server.js';
import { createBunS3Client, resolveS3OptionsFromEnv } from '../s3-client.js';
import { ensureRustfsStorage } from '../startup-ensure.js';
import { NOOP_BUS } from '../event-bus.js';
import { startSweeper } from '../sweeper.js';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 50051);
  const dbPath = process.env.STORAGE_S3_PENDING_STORE_PATH ?? '/data/storage.sqlite';
  const presignTtlSec = Number(process.env.STORAGE_S3_PRESIGN_TTL_SEC ?? 900);
  const storageJsonPath = process.env.STORAGE_S3_STORAGE_JSON_PATH ?? '/srv/storage.json';

  const envResolved = resolveS3OptionsFromEnv(process.env as Record<string, string | undefined>);
  if (!envResolved.ok) throw new Error(envResolved.error);

  const storage = JSON.parse(readFileSync(storageJsonPath, 'utf8'));
  if (envResolved.value.backend === 'rustfs') {
    const admin = new S3Client({
      endpoint: envResolved.value.endpoint,
      region: envResolved.value.region,
      forcePathStyle: envResolved.value.forcePathStyle,
      credentials: {
        accessKeyId: envResolved.value.accessKeyId,
        secretAccessKey: envResolved.value.secretAccessKey,
      },
    });
    await ensureRustfsStorage({
      client: {
        headBucket: (args) => admin.send(new HeadBucketCommand(args)),
        createBucket: (args) => admin.send(new CreateBucketCommand(args)),
        putBucketCors: (args) => admin.send(new PutBucketCorsCommand(args as never)),
        putBucketLifecycleConfiguration: (args) =>
          admin.send(new PutBucketLifecycleConfigurationCommand(args as never)),
      },
      bucket: envResolved.value.bucket,
      appOrigins: envResolved.value.appOrigins,
      storage,
      log: (message) => process.stdout.write(`storage-s3 startup ensure: ${message}\n`),
    });
  }
  const db = new Database(dbPath, { create: true });
  const s3 = createBunS3Client(envResolved.value);
  const store = createPendingStore({ db: db as never });
  const handler = createHandler({
    storage,
    s3,
    pendingStore: store,
    routeResolver: createRouteResolver(storage),
    bus: NOOP_BUS,
    presignTtlSec,
  });

  const module = Object.fromEntries(
    ([
      'PrepareUpload',
      'CommitUpload',
      'AbortUpload',
      'GetFile',
      'ListFiles',
      'GetDownloadUrl',
      'DeleteFile',
    ] as StorageRpcName[]).map((rpc) => [rpc, handler[rpc] as (request: object) => Promise<object>]),
  ) as Record<StorageRpcName, (request: object) => Promise<object>>;

  const server = createStorageGrpcServer({ module, port });
  const { port: bound } = await server.listen();
  startSweeper({ store, s3, bus: NOOP_BUS });
  process.stdout.write(`storage-s3 grpc listening on :${bound}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
