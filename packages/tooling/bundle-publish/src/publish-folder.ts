import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { buildDeterministicTarGz } from './tar-deterministic.js';
import { hashBuffer } from './hash.js';
import { putBundle, type S3Like } from './s3-put.js';
import type { PublishError, PublishOptions, PublishResult, PublishTarget, S3Reference } from './types.js';
import { err, ok, type Result } from './result.js';

export type PublishDeps = {
  client?: S3Like;
};

export async function publishFolder(
  folder: string,
  target: PublishTarget,
  opts: PublishOptions = {},
  deps: PublishDeps = {},
): Promise<Result<PublishResult, PublishError>> {
  const start = Date.now();

  if (!existsSync(folder)) {
    return err([{ code: 'BUNDLE_PUBLISH_FOLDER_MISSING', message: `folder not found: ${folder}` }]);
  }
  if (!existsSync(join(folder, 'index.html'))) {
    return err([{ code: 'BUNDLE_PUBLISH_NO_INDEX_HTML', message: 'index.html required at folder root' }]);
  }

  const ignore = opts.ignore ?? ['.git', '.git/**', 'node_modules', 'node_modules/**'];
  const maxBytes = opts.maxBytes ?? 50 * 1024 * 1024;
  let bundle: Buffer;
  try {
    bundle = await buildDeterministicTarGz(folder, ignore, maxBytes);
  } catch (error) {
    if (error instanceof Error && error.message === 'BUNDLE_PUBLISH_TOO_LARGE') {
      return err([{ code: 'BUNDLE_PUBLISH_TOO_LARGE', message: `bundle exceeds ${maxBytes} bytes` }]);
    }
    throw error;
  }

  const sha256 = hashBuffer(bundle);
  const prefix = (opts.keyPrefix ?? `bundles/${basename(folder)}`).replace(/\/$/, '');
  const key = `${prefix}/${sha256}.tar.gz`;
  const client = deps.client ?? createS3ClientForTarget(target);

  try {
    await putBundle(client, target.bucket, key, bundle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/credentials/i.test(message)) {
      return err([{ code: 'BUNDLE_PUBLISH_S3_CREDS_MISSING', message, cause: error }]);
    }
    return err([{ code: 'BUNDLE_PUBLISH_S3_PUT_FAILED', message, cause: error }]);
  }

  const ref: S3Reference = withOptionalS3Fields(
    {
      bucket: target.bucket,
      key,
      sha256,
    },
    target,
  );
  return ok({ ref, bytes: bundle.length, durationMs: Date.now() - start });
}

export function createS3ClientForTarget(target: PublishTarget): S3Client {
  return new S3Client({
    ...(target.endpoint === undefined ? {} : { endpoint: target.endpoint }),
    ...(target.endpoint === undefined ? {} : { forcePathStyle: true }),
    region: target.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
  });
}

function withOptionalS3Fields(ref: S3Reference, target: PublishTarget): S3Reference {
  return {
    ...ref,
    ...(target.endpoint === undefined ? {} : { endpoint: target.endpoint }),
    ...(target.region === undefined ? {} : { region: target.region }),
  };
}
