import type { ProvisionerInput } from '@rntme/contracts-provisioner-v1';

export interface S3PublicConfig {
  bucketName: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  appOrigins: string[];
  backend:
    | 'aws-s3'
    | 'cloudflare-r2'
    | 'minio'
    | 'rustfs'
    | 'digitalocean-spaces'
    | 'backblaze-b2'
    | 'tigris';
}

export interface S3AdminCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface S3ScopedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ProvisionerOutputs {
  scopedCredentials: S3ScopedCredentials;
  bucketName: string;
  endpoint?: string;
}

export type StorageS3ProvisionerInput = ProvisionerInput<S3PublicConfig>;
