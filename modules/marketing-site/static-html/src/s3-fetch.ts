import { createHash } from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { err, ok, type Result } from './result-shim.js';
import type { ProvisionError } from './types.js';

export type BundleRef = {
  readonly bucket: string;
  readonly key: string;
  readonly sha256: string;
};

export type S3GetObjectLike = {
  send(command: unknown): Promise<{ Body?: { transformToByteArray: () => Promise<Uint8Array> } }>;
};

export async function fetchAndVerifyBundle(
  client: S3GetObjectLike,
  ref: BundleRef,
): Promise<Result<Buffer, ProvisionError>> {
  let body: Uint8Array;
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key }));
    if (!out.Body) {
      return err({ code: 'MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND', message: 'S3 object body was empty' });
    }
    body = await out.Body.transformToByteArray();
  } catch (cause) {
    return err({
      code: 'MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND',
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    });
  }

  const buf = Buffer.from(body);
  const actual = createHash('sha256').update(buf).digest('hex');
  if (actual !== ref.sha256.toLowerCase()) {
    return err({
      code: 'MARKETING_SITE_PROVISION_HASH_MISMATCH',
      message: `expected ${ref.sha256} got ${actual}`,
    });
  }
  return ok(buf);
}
