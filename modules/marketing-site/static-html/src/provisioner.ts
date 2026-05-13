import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { fetchAndVerifyBundle } from './s3-fetch.js';
import { untarToDir } from './untar.js';
import { buildAndPushImage } from './build-image.js';
import { upsertDokployApp } from './dokploy-upsert.js';
import { err, ok } from './result-shim.js';
import type { ProvisionerContract } from '@rntme/contracts-provisioner-v1';
import type { MarketingSiteV1Config } from '@rntme/contracts-marketing-site-v1';
import type {
  InternalMarketingConfig,
  MaterializedProjectAssetSource,
  StaticSiteV1,
  TargetSecrets,
} from './types.js';

export const provisioner: ProvisionerContract<MarketingSiteV1Config> = {
  async provision(input) {
    const cfg = input.publicConfig as unknown as InternalMarketingConfig;
    const targets = input.targetSecrets as TargetSecrets;

    if (cfg.source.kind === 'materialized-project-asset') {
      return provisionFromMaterializedAsset(cfg, cfg.source);
    }

    if (cfg.source.kind === 'project-folder') {
      // deploy-runner converts project-folder -> materialized-project-asset
      // BEFORE this provisioner runs. Reaching here means materialization was
      // skipped (e.g. a stale runner) — fail loudly so the caller fixes it.
      return err({
        code: 'MARKETING_SITE_PROVISION_PROJECT_FOLDER_NOT_MATERIALIZED',
        message:
          'project-folder source must be materialized by deploy-runner before reaching the marketing provisioner',
      });
    }

    if (cfg.source.kind === 'local-path' && targets.isProd === true) {
      return err({ code: 'MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD', message: 'local-path source forbidden in prod' });
    }

    if (targets.registry === undefined || targets.dokploy === undefined) {
      return err({
        code: 'MARKETING_SITE_PROVISION_TARGET_SECRETS_MISSING',
        message: 's3/local-path marketing-site sources require both registry and dokploy target secrets',
      });
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

    const sha = cfg.source.sha256;
    return ok({
      publicOutputs: {
        url: { href: upserted.value.url },
        deployedSha256: { value: sha },
        staticSite: legacyStaticSitePlaceholder(cfg.primaryDomain, cfg.ssl, sha),
      },
      secretOutputs: {},
    });
  },

  async tearDown(input) {
    const targets = input.targetSecrets as TargetSecrets;
    const appId = (input.priorOutputs?.publicOutputs.appId as string | undefined) ?? undefined;
    if (appId !== undefined && targets.dokploy?.deleteApplication !== undefined) {
      await targets.dokploy.deleteApplication(appId);
    }
    return ok(undefined);
  },
};

async function provisionFromMaterializedAsset(
  cfg: InternalMarketingConfig,
  source: MaterializedProjectAssetSource,
) {
  let bundle: Buffer;
  try {
    bundle = await readFile(source.localPath);
  } catch (cause) {
    return err({
      code: 'MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND',
      message: `materialized project-folder asset not readable at ${source.localPath}: ${(cause as Error).message}`,
      cause,
    });
  }

  const actualSha = createHash('sha256').update(bundle).digest('hex');
  if (actualSha !== source.sha256.toLowerCase()) {
    return err({
      code: 'MARKETING_SITE_PROVISION_HASH_MISMATCH',
      message: `expected ${source.sha256} got ${actualSha}`,
    });
  }

  const extracted = await untarToDir(bundle);
  if (!extracted.ok) return extracted;

  const files = readUtf8FilesUnder(extracted.value.dir);

  const staticSite: StaticSiteV1 = {
    kind: 'static-site-v1',
    primaryDomain: cfg.primaryDomain,
    ssl: cfg.ssl,
    sha256: source.sha256,
    files,
  };

  return ok({
    publicOutputs: {
      url: { href: `https://${cfg.primaryDomain}` },
      deployedSha256: { value: source.sha256 },
      staticSite,
    },
    secretOutputs: {},
  });
}

function readUtf8FilesUnder(dir: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const name of readdirSync(current).sort()) {
      const abs = resolve(current, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!st.isFile()) continue;
      const rel = relative(dir, abs).replaceAll('\\', '/');
      out[rel] = readFileSync(abs, 'utf8');
    }
  }
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function legacyStaticSitePlaceholder(
  primaryDomain: string,
  ssl: 'auto' | 'manual' | 'none',
  sha256: string,
): StaticSiteV1 {
  return {
    kind: 'static-site-v1',
    primaryDomain,
    ssl,
    sha256,
    files: {},
  };
}

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
