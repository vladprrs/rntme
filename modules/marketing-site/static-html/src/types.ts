import type { S3Client } from '@aws-sdk/client-s3';
import type { MarketingSiteV1Config } from '@rntme/contracts-marketing-site-v1';
import type { Result } from './result-shim.js';

export type StaticHtmlConfig = MarketingSiteV1Config;

export type ProvisionError = {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
};

export type TargetSecrets = {
  readonly isProd?: boolean;
  readonly bundleStorage?: {
    readonly s3?: {
      readonly accessKeyId?: string;
      readonly secretAccessKey?: string;
      readonly endpoint?: string;
      readonly region?: string;
      readonly client?: Pick<S3Client, 'send'>;
    };
  };
  readonly registry: {
    readonly url: string;
    readonly username?: string;
    readonly password?: string;
    readonly buildImage?: (input: {
      bundleDir: string;
      imageRef: string;
      registry: TargetSecrets['registry'];
      log: (message: string) => void;
    }) => Promise<Result<{ imageRef: string }, ProvisionError>>;
  };
  readonly dokploy: {
    readonly upsertDockerApp: (cfg: {
      name: string;
      image: string;
      domain: string;
      ssl: 'auto' | 'manual' | 'none';
    }) => Promise<{ appId: string }>;
    readonly deleteApplication?: (id: string) => Promise<void>;
  };
};

export type Outputs = {
  readonly url: string;
  readonly deployedSha256: string;
};
