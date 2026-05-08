import type { ProvisionerLog } from '@rntme/contracts-provisioner-v1';
import type { ProvisionerOutputs, S3PublicConfig, S3ScopedCredentials } from './types.js';

interface S3SmokeClient {
  headBucket(args: { Bucket: string }): Promise<unknown>;
  putObject(args: { Bucket: string; Key: string; Body: string }): Promise<unknown>;
  headObject(args: { Bucket: string; Key: string }): Promise<unknown>;
  deleteObject(args: { Bucket: string; Key: string }): Promise<unknown>;
}

export interface ManualArgs {
  s3: S3SmokeClient;
  config: S3PublicConfig;
  scopedCredentials: S3ScopedCredentials;
  log: ProvisionerLog;
}

export type ManualResult =
  | { ok: true; value: ProvisionerOutputs }
  | { ok: false; error: { code: string; message: string } };

export async function provisionManual(args: ManualArgs): Promise<ManualResult> {
  try {
    await args.s3.headBucket({ Bucket: args.config.bucketName });
  } catch (error) {
    return {
      ok: false,
      error: { code: 'STORAGE_PROVISIONER_VALIDATION_FAILED', message: `HeadBucket failed: ${(error as Error).message}` },
    };
  }

  const probeKey = `__rntme_smoke__/${Date.now()}`;
  try {
    await args.s3.putObject({ Bucket: args.config.bucketName, Key: probeKey, Body: 'rntme-smoke' });
    await args.s3.headObject({ Bucket: args.config.bucketName, Key: probeKey });
    await args.s3.deleteObject({ Bucket: args.config.bucketName, Key: probeKey });
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_PROVISIONER_VALIDATION_FAILED',
        message: `smoke write/read/delete failed: ${(error as Error).message}`,
      },
    };
  }

  args.log({ step: 'smoke', level: 'info', message: `smoke OK against bucket ${args.config.bucketName}` });
  return {
    ok: true,
    value: {
      scopedCredentials: args.scopedCredentials,
      bucketName: args.config.bucketName,
      endpoint: args.config.endpoint,
    },
  };
}
