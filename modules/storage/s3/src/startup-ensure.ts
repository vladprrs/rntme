import type { StorageJsonLike } from './route-resolver.js';

export interface StartupEnsureS3Client {
  headBucket(args: { Bucket: string }): Promise<unknown>;
  createBucket(args: { Bucket: string }): Promise<unknown>;
  putBucketCors(args: { Bucket: string; CORSConfiguration: { CORSRules: unknown[] } }): Promise<unknown>;
  putBucketLifecycleConfiguration(args: { Bucket: string; LifecycleConfiguration: { Rules: unknown[] } }): Promise<unknown>;
}

export async function ensureRustfsStorage(args: {
  client: StartupEnsureS3Client;
  bucket: string;
  appOrigins: readonly string[];
  storage: StorageJsonLike;
  log: (message: string) => void;
}): Promise<void> {
  await ensureBucket(args.client, args.bucket);
  if (args.appOrigins.length > 0) {
    await args.client.putBucketCors({
      Bucket: args.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [...args.appOrigins],
            AllowedMethods: ['PUT', 'GET', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });
  }
  const lifecycleRules = lifecycleRulesFromStorage(args.storage);
  if (lifecycleRules.length === 0) return;
  try {
    await args.client.putBucketLifecycleConfiguration({
      Bucket: args.bucket,
      LifecycleConfiguration: { Rules: lifecycleRules },
    });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 400 || status === 404 || status === 501) {
      args.log('lifecycle unsupported by RustFS endpoint; continuing without lifecycle rules');
      return;
    }
    throw error;
  }
}

async function ensureBucket(client: StartupEnsureS3Client, bucket: string): Promise<void> {
  try {
    await client.headBucket({ Bucket: bucket });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404 && status !== undefined) throw error;
    await client.createBucket({ Bucket: bucket });
  }
}

function lifecycleRulesFromStorage(storage: StorageJsonLike): unknown[] {
  const rules: unknown[] = [
    {
      ID: 'abort-multipart-1d',
      Status: 'Enabled',
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
      Filter: {},
    },
  ];
  for (const route of Object.values(storage.routes)) {
    if (route.lifecycle.retainCommittedMs === null) continue;
    rules.push({
      ID: `expire-${route.id}-${Math.ceil(route.lifecycle.retainCommittedMs / 86_400_000)}d`,
      Status: 'Enabled',
      Filter: { Prefix: `${route.id}/` },
      Expiration: { Days: Math.ceil(route.lifecycle.retainCommittedMs / 86_400_000) },
    });
  }
  return rules;
}
