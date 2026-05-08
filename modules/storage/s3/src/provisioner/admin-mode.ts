import type { ProvisionerLog } from '@rntme/contracts-provisioner-v1';
import type { ProvisionerOutputs, S3PublicConfig } from './types.js';

export interface S3AdminClient {
  headBucket(args: { Bucket: string }): Promise<unknown>;
  createBucket?(args: { Bucket: string; CreateBucketConfiguration?: { LocationConstraint: string } }): Promise<unknown>;
  putBucketCors(args: { Bucket: string; CORSConfiguration: { CORSRules: unknown[] } }): Promise<unknown>;
  putBucketLifecycleConfiguration(args: { Bucket: string; LifecycleConfiguration: { Rules: unknown[] } }): Promise<unknown>;
}

export interface IamClient {
  createUser(args: { UserName: string }): Promise<unknown>;
  putUserPolicy(args: { UserName: string; PolicyName: string; PolicyDocument: string }): Promise<unknown>;
  createAccessKey(args: { UserName: string }): Promise<{ AccessKey?: { AccessKeyId?: string; SecretAccessKey?: string } }>;
}

export interface AutoArgs {
  config: S3PublicConfig;
  lifecycleRules: Array<{ prefix: string; expirationDays: number }>;
  s3: S3AdminClient;
  iam: IamClient | null;
  projectSlug: string;
  env: string;
  adminFallbackCredentials?: { accessKeyId: string; secretAccessKey: string };
  log: ProvisionerLog;
}

export type AutoResult =
  | { ok: true; value: ProvisionerOutputs }
  | { ok: false; error: { code: string; message: string } };

function bucketScopedPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject', 's3:HeadObject', 's3:AbortMultipartUpload'],
        Resource: `arn:aws:s3:::${bucket}/*`,
      },
      { Effect: 'Allow', Action: ['s3:ListBucket'], Resource: `arn:aws:s3:::${bucket}` },
    ],
  });
}

export async function provisionAuto(args: AutoArgs): Promise<AutoResult> {
  let exists = true;
  try {
    await args.s3.headBucket({ Bucket: args.config.bucketName });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || status === undefined) exists = false;
    else {
      return { ok: false, error: { code: 'STORAGE_PROVISIONER_BUCKET_CREATE_FAILED', message: `HeadBucket failed with status ${status}` } };
    }
  }
  if (!exists) {
    if (args.s3.createBucket === undefined) {
      return { ok: false, error: { code: 'STORAGE_PROVISIONER_BACKEND_UNSUPPORTED', message: 'createBucket unavailable' } };
    }
    try {
      const config = args.config.region === 'us-east-1' ? {} : { CreateBucketConfiguration: { LocationConstraint: args.config.region } };
      await args.s3.createBucket({ Bucket: args.config.bucketName, ...config });
    } catch (error) {
      return { ok: false, error: { code: 'STORAGE_PROVISIONER_BUCKET_CREATE_FAILED', message: (error as Error).message } };
    }
  }

  try {
    await args.s3.putBucketCors({
      Bucket: args.config.bucketName,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: args.config.appOrigins,
          AllowedMethods: ['PUT', 'GET', 'DELETE', 'HEAD'],
          AllowedHeaders: ['*'],
          MaxAgeSeconds: 3600,
        }],
      },
    });
  } catch (error) {
    return { ok: false, error: { code: 'STORAGE_PROVISIONER_CORS_APPLY_FAILED', message: (error as Error).message } };
  }

  try {
    const rules: unknown[] = [{ ID: 'abort-multipart-1d', Status: 'Enabled', AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 }, Filter: {} }];
    for (const rule of args.lifecycleRules) {
      rules.push({ ID: `expire-${rule.prefix}-${rule.expirationDays}d`, Status: 'Enabled', Filter: { Prefix: rule.prefix }, Expiration: { Days: rule.expirationDays } });
    }
    await args.s3.putBucketLifecycleConfiguration({
      Bucket: args.config.bucketName,
      LifecycleConfiguration: { Rules: rules },
    });
  } catch (error) {
    return { ok: false, error: { code: 'STORAGE_PROVISIONER_LIFECYCLE_APPLY_FAILED', message: (error as Error).message } };
  }

  if (args.iam === null) {
    if (args.adminFallbackCredentials === undefined) {
      return { ok: false, error: { code: 'STORAGE_PROVISIONER_BACKEND_UNSUPPORTED', message: `${args.config.backend} has no IAM API` } };
    }
    args.log({ step: 'iam', level: 'warn', code: 'STORAGE_PROVISIONER_BACKEND_UNSUPPORTED', message: `${args.config.backend} has no IAM API; using fallback credentials` });
    return { ok: true, value: { scopedCredentials: args.adminFallbackCredentials, bucketName: args.config.bucketName, endpoint: args.config.endpoint } };
  }

  const userName = `rntme-${args.projectSlug}-${args.env}-storage`;
  try {
    try {
      await args.iam.createUser({ UserName: userName });
    } catch (error) {
      if ((error as { name?: string }).name !== 'EntityAlreadyExists') throw error;
    }
    await args.iam.putUserPolicy({
      UserName: userName,
      PolicyName: `${userName}-bucket-rw`,
      PolicyDocument: bucketScopedPolicy(args.config.bucketName),
    });
    const key = await args.iam.createAccessKey({ UserName: userName });
    const accessKeyId = key.AccessKey?.AccessKeyId;
    const secretAccessKey = key.AccessKey?.SecretAccessKey;
    if (accessKeyId === undefined || secretAccessKey === undefined) {
      return { ok: false, error: { code: 'STORAGE_PROVISIONER_IAM_USER_CREATE_FAILED', message: 'CreateAccessKey returned no key material' } };
    }
    return { ok: true, value: { scopedCredentials: { accessKeyId, secretAccessKey }, bucketName: args.config.bucketName, endpoint: args.config.endpoint } };
  } catch (error) {
    return { ok: false, error: { code: 'STORAGE_PROVISIONER_IAM_USER_CREATE_FAILED', message: (error as Error).message } };
  }
}
