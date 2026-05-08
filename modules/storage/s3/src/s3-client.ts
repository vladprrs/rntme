import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3ClientOptions {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  publicEndpoint?: string;
  region?: string;
  forcePathStyle?: boolean;
  backend?: string;
  appOrigins: readonly string[];
}

export interface PresignArgs {
  method: 'PUT' | 'GET' | 'DELETE' | 'HEAD';
  expiresIn: number;
  contentType?: string;
}

export interface S3ClientLike {
  presign(key: string, args: PresignArgs): string | Promise<string>;
  exists(key: string): Promise<boolean>;
  size(key: string): Promise<number>;
  deleteObject(key: string): Promise<void>;
}

export type ResolveResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function resolveS3OptionsFromEnv(
  env: Record<string, string | undefined>,
): ResolveResult<S3ClientOptions> {
  const accessKeyId = env.STORAGE_S3_ACCESS_KEY_ID;
  const secretAccessKey = env.STORAGE_S3_SECRET_ACCESS_KEY;
  const bucket = env.STORAGE_S3_BUCKET;
  if (!accessKeyId || !secretAccessKey || !bucket) {
    return {
      ok: false,
      error:
        'STORAGE_S3_ACCESS_KEY_ID, STORAGE_S3_SECRET_ACCESS_KEY, STORAGE_S3_BUCKET are all required',
    };
  }
  return {
    ok: true,
    value: {
      accessKeyId,
      secretAccessKey,
      bucket,
      endpoint: env.STORAGE_S3_ENDPOINT,
      publicEndpoint: env.STORAGE_S3_PUBLIC_ENDPOINT,
      region: env.STORAGE_S3_REGION ?? 'us-east-1',
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
      backend: env.STORAGE_S3_BACKEND,
      appOrigins: splitCsv(env.STORAGE_S3_APP_ORIGINS),
    },
  };
}

export function createBunS3Client(opts: S3ClientOptions): S3ClientLike {
  const bun = (globalThis as unknown as { Bun?: { S3Client?: new (opts: S3ClientOptions) => BunS3ClientLike } }).Bun;
  if (bun?.S3Client === undefined) {
    throw new Error('Bun.S3Client is not available; this server runtime requires bun >= 1.2');
  }
  const c = new bun.S3Client(opts);
  const presignClient =
    opts.publicEndpoint === undefined
      ? null
      : new S3Client({
          endpoint: opts.publicEndpoint,
          region: opts.region ?? 'us-east-1',
          forcePathStyle: opts.forcePathStyle,
          credentials: {
            accessKeyId: opts.accessKeyId,
            secretAccessKey: opts.secretAccessKey,
          },
        });
  return {
    presign(key, args) {
      if (presignClient !== null) {
        const command =
          args.method === 'PUT'
            ? new PutObjectCommand({ Bucket: opts.bucket, Key: key, ContentType: args.contentType })
            : new GetObjectCommand({ Bucket: opts.bucket, Key: key });
        return presignWithAws(presignClient, command, args.expiresIn);
      }
      return c.presign(key, {
        method: args.method,
        expiresIn: args.expiresIn,
        type: args.contentType,
      });
    },
    async exists(key) {
      return await c.file(key).exists();
    },
    async size(key) {
      return await c.file(key).size;
    },
    async deleteObject(key) {
      await c.file(key).delete();
    },
  };
}

function splitCsv(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function presignWithAws(
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand,
  expiresIn: number,
): Promise<string> {
  return getSignedUrl(client, command, { expiresIn });
}

interface BunS3ClientLike {
  presign(key: string, args: { method: string; expiresIn: number; type?: string }): string;
  file(key: string): {
    exists(): Promise<boolean>;
    readonly size: Promise<number>;
    delete(): Promise<void>;
  };
}
