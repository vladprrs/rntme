import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { S3Client } from '@aws-sdk/client-s3';
import { fetchAndVerifyBundle } from './s3-fetch.js';
import { untarToDir } from './untar.js';
import { buildAndPushImage } from './build-image.js';
import { upsertDokployApp } from './dokploy-upsert.js';
import { err, ok } from './result-shim.js';
import type { ProvisionerContract } from '@rntme/contracts-provisioner-v1';
import type { MarketingSiteV1Config } from '@rntme/contracts-marketing-site-v1';
import type { TargetSecrets } from './types.js';

export const provisioner: ProvisionerContract<MarketingSiteV1Config> = {
  async provision(input) {
    const cfg = input.publicConfig;
    const targets = input.targetSecrets as TargetSecrets;

    if (cfg.source.kind === 'local-path' && targets.isProd === true) {
      return err({ code: 'MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD', message: 'local-path source forbidden in prod' });
    }

    const bundle = cfg.source.kind === 's3'
      ? await fetchS3Bundle(cfg.source, targets)
      : await readLocalBundle(cfg.source.path, cfg.source.sha256);
    if (!bundle.ok) return bundle;

    const extracted = await untarToDir(bundle.value);
    if (!extracted.ok) return extracted;

    const appName = appNameForDomain(cfg.primaryDomain);
    const imageRef = `${targets.registry.url}/${appName}:${cfg.source.sha256.slice(0, 7)}`;
    const build = targets.registry.buildImage ?? buildAndPushImage;
    const built = await build({
      bundleDir: extracted.value.dir,
      imageRef,
      registry: targets.registry,
      log: (message) => input.log({ step: 'image-build', level: 'info', message: message.trim() }),
    });
    if (!built.ok) return built;

    const upserted = await upsertDokployApp({
      appName,
      imageRef: built.value.imageRef,
      primaryDomain: cfg.primaryDomain,
      ssl: cfg.ssl,
      client: targets.dokploy,
    });
    if (!upserted.ok) return upserted;

    return ok({
      publicOutputs: { url: upserted.value.url, deployedSha256: cfg.source.sha256 },
      secretOutputs: {},
    });
  },

  async tearDown(input) {
    const targets = input.targetSecrets as TargetSecrets;
    const appId = (input.priorOutputs?.publicOutputs.appId as string | undefined) ?? undefined;
    if (appId !== undefined && targets.dokploy.deleteApplication !== undefined) {
      await targets.dokploy.deleteApplication(appId);
    }
    return ok(undefined);
  },
};

function createS3Client(source: Extract<MarketingSiteV1Config['source'], { kind: 's3' }>, targets: TargetSecrets): S3Client {
  const s3 = targets.bundleStorage?.s3;
  const endpoint = source.endpoint ?? s3?.endpoint;
  return new S3Client({
    ...(endpoint === undefined ? {} : { endpoint }),
    region: source.region ?? s3?.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
    forcePathStyle: endpoint !== undefined,
    credentials: {
      accessKeyId: s3?.accessKeyId ?? '',
      secretAccessKey: s3?.secretAccessKey ?? '',
    },
  });
}

async function fetchS3Bundle(
  source: Extract<MarketingSiteV1Config['source'], { kind: 's3' }>,
  targets: TargetSecrets,
) {
  const client = targets.bundleStorage?.s3?.client ?? createS3Client(source, targets);
  return fetchAndVerifyBundle(client, { bucket: source.bucket, key: source.key, sha256: source.sha256 });
}

async function readLocalBundle(path: string, expectedSha256: string) {
  let bundle: Buffer;
  try {
    bundle = await readFile(path);
  } catch (cause) {
    return err({
      code: 'MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND',
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    });
  }

  const actual = createHash('sha256').update(bundle).digest('hex');
  if (actual !== expectedSha256.toLowerCase()) {
    return err({ code: 'MARKETING_SITE_PROVISION_HASH_MISMATCH', message: `expected ${expectedSha256} got ${actual}` });
  }
  return ok(bundle);
}

export function appNameForDomain(domain: string): string {
  return domain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
