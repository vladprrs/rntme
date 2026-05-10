import { describe, expectTypeOf, it } from 'bun:test';
import type {
  S3PublicConfig,
  StorageS3ProvisionerInput,
} from '../../src/provisioner/types.js';

describe('storage-s3 provisioner types', () => {
  it('S3PublicConfig narrows to a known backend', () => {
    expectTypeOf<S3PublicConfig['backend']>().toEqualTypeOf<
      | 'aws-s3'
      | 'cloudflare-r2'
      | 'minio'
      | 'rustfs'
      | 'digitalocean-spaces'
      | 'backblaze-b2'
      | 'tigris'
    >();
  });

  it('input has serviceArtifacts', () => {
    expectTypeOf<StorageS3ProvisionerInput>().toHaveProperty('serviceArtifacts');
  });
});
