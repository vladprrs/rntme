import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  CreateAccessKeyCommand,
  CreateUserCommand,
  IAMClient,
  PutUserPolicyCommand,
} from '@aws-sdk/client-iam';
import type {
  ProvisionerContract,
  ProvisionerInput,
  ProvisionerOutput,
  ProvisionerVendorError,
  Result,
} from '@rntme/contracts-provisioner-v1';
import { provisionAuto, type IamClient, type S3AdminClient } from './admin-mode.js';
import { provisionManual } from './manual-mode.js';
import type { S3PublicConfig } from './types.js';

interface ServiceArtifactBundle {
  storage?: { routes: Record<string, { id: string; lifecycle: { retainCommittedMs: number | null } }> };
}

function gatherLifecycleRules(
  serviceArtifacts: Readonly<Record<string, unknown>> | undefined,
): Array<{ prefix: string; expirationDays: number }> {
  const out: Array<{ prefix: string; expirationDays: number }> = [];
  if (serviceArtifacts === undefined) return out;
  for (const svc of Object.values(serviceArtifacts)) {
    const bundle = svc as ServiceArtifactBundle;
    if (bundle.storage === undefined) continue;
    for (const route of Object.values(bundle.storage.routes)) {
      if (route.lifecycle.retainCommittedMs !== null) {
        out.push({
          prefix: `${route.id}/`,
          expirationDays: Math.ceil(route.lifecycle.retainCommittedMs / 86_400_000),
        });
      }
    }
  }
  return out;
}

function liftS3Client(client: S3Client): S3AdminClient & Parameters<typeof provisionManual>[0]['s3'] {
  return {
    headBucket: (args) => client.send(new HeadBucketCommand(args)),
    createBucket: (args) => client.send(new CreateBucketCommand(args as never)),
    putBucketCors: (args) => client.send(new PutBucketCorsCommand(args as never)),
    putBucketLifecycleConfiguration: (args) =>
      client.send(new PutBucketLifecycleConfigurationCommand(args as never)),
    putObject: (args) => client.send(new PutObjectCommand(args)),
    headObject: (args) => client.send(new HeadObjectCommand(args)),
    deleteObject: (args) => client.send(new DeleteObjectCommand(args)),
  };
}

function liftIamClient(client: IAMClient | null): IamClient | null {
  if (client === null) return null;
  return {
    createUser: (args) => client.send(new CreateUserCommand(args)),
    putUserPolicy: (args) => client.send(new PutUserPolicyCommand(args)),
    createAccessKey: (args) => client.send(new CreateAccessKeyCommand(args)),
  };
}

function okOutput(value: ProvisionerOutput): Result<ProvisionerOutput, ProvisionerVendorError> {
  return { ok: true, value };
}

function errOutput(code: string, message: string): Result<ProvisionerOutput, ProvisionerVendorError> {
  return { ok: false, errors: [{ code, message }] };
}

export const storageS3Provisioner: ProvisionerContract<S3PublicConfig> = {
  async provision(input: ProvisionerInput<S3PublicConfig>) {
    const cfg = input.publicConfig;
    const adminCreds = input.targetSecrets.s3Admin as
      | { accessKeyId: string; secretAccessKey: string }
      | undefined;
    const scopedFromTarget = input.targetSecrets.s3Scoped as
      | { accessKeyId: string; secretAccessKey: string }
      | undefined;
    const projectSlug = (input.targetSecrets.projectSlug as string | undefined) ?? 'rntme';
    const envName = (input.targetSecrets.env as string | undefined) ?? 'prod';

    if (adminCreds !== undefined) {
      const adminS3 = new S3Client({
        endpoint: cfg.endpoint,
        region: cfg.region,
        forcePathStyle: cfg.forcePathStyle,
        credentials: adminCreds,
      });
      const iam = cfg.backend === 'cloudflare-r2' ? null : new IAMClient({ region: cfg.region, credentials: adminCreds });
      const result = await provisionAuto({
        config: cfg,
        lifecycleRules: gatherLifecycleRules(input.serviceArtifacts),
        s3: liftS3Client(adminS3),
        iam: liftIamClient(iam),
        projectSlug,
        env: envName,
        adminFallbackCredentials: adminCreds,
        log: input.log,
      });
      if (!result.ok) return errOutput(result.error.code, result.error.message);
      return okOutput({
        publicOutputs: { bucketName: result.value.bucketName, endpoint: result.value.endpoint ?? '' },
        secretOutputs: { scopedCredentials: result.value.scopedCredentials },
      });
    }

    if (scopedFromTarget !== undefined) {
      const s3 = new S3Client({
        endpoint: cfg.endpoint,
        region: cfg.region,
        forcePathStyle: cfg.forcePathStyle,
        credentials: scopedFromTarget,
      });
      const result = await provisionManual({
        s3: liftS3Client(s3),
        config: cfg,
        scopedCredentials: scopedFromTarget,
        log: input.log,
      });
      if (!result.ok) return errOutput(result.error.code, result.error.message);
      return okOutput({
        publicOutputs: { bucketName: result.value.bucketName, endpoint: result.value.endpoint ?? '' },
        secretOutputs: { scopedCredentials: result.value.scopedCredentials },
      });
    }

    return errOutput(
      'STORAGE_PROVISIONER_VALIDATION_FAILED',
      'no admin or scoped credentials supplied via target.storage.s3',
    );
  },
};

export default storageS3Provisioner;
