import type { S3Client } from '@aws-sdk/client-s3';
import type { MarketingSiteV1Config } from '@rntme/contracts-marketing-site-v1';
import type { Result } from './result-shim.js';

export type StaticHtmlConfig = MarketingSiteV1Config;

/**
 * Internal source variant injected by deploy-runner BEFORE the provisioner
 * runs for `project-folder` declarations. The canonical
 * `MarketingSiteV1ConfigSchema` does NOT include this shape — it is a
 * deploy-runner -> provisioner handshake, not a public bundle source.
 */
export type MaterializedProjectAssetSource = {
  readonly kind: 'materialized-project-asset';
  readonly assetPath: string;
  readonly localPath: string;
  readonly sha256: string;
};

/**
 * Config the provisioner actually accepts at runtime. Identical to the
 * canonical contract shape except `source` may also carry the deploy-runner
 * materialized variant for project-folder declarations.
 */
export type InternalMarketingConfig = Omit<MarketingSiteV1Config, 'source'> & {
  readonly source: MarketingSiteV1Config['source'] | MaterializedProjectAssetSource;
};

export type ProvisionError = {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
};

/**
 * Target secrets for the marketing-site-static provisioner. Every field is
 * optional because the canonical `project-folder` / `materialized-project-asset`
 * code path is fully target-agnostic — it runs without `bundleStorage`,
 * `registry`, or `dokploy` secrets.
 *
 * The legacy `s3` and `local-path` source helpers still reference these slots
 * until their callers migrate; the provisioner returns a clear error when a
 * legacy path is taken without the required secret.
 */
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
  readonly registry?: {
    readonly url: string;
    readonly username?: string;
    readonly password?: string;
    readonly buildImage?: (input: {
      bundleDir: string;
      imageRef: string;
      registry: NonNullable<TargetSecrets['registry']>;
      log: (message: string) => void;
    }) => Promise<Result<{ imageRef: string }, ProvisionError>>;
  };
  readonly dokploy?: {
    readonly upsertDockerApp: (cfg: {
      name: string;
      image: string;
      domain: string;
      ssl: 'auto' | 'manual' | 'none';
    }) => Promise<{ appId: string }>;
    readonly deleteApplication?: (id: string) => Promise<void>;
  };
};

/**
 * Canonical static-site provisioner output. `files` keys are relative UTF-8
 * file paths under the extracted static-site root (e.g. `landing/index.html`).
 * The deploy target (deploy-dokploy) is responsible for turning this into a
 * concrete hosted resource — the provisioner itself never calls a registry
 * or Dokploy.
 */
export type StaticSiteV1 = {
  readonly kind: 'static-site-v1';
  readonly primaryDomain: string;
  readonly ssl: 'auto' | 'manual' | 'none';
  readonly sha256: string;
  readonly files: Readonly<Record<string, string>>;
};

export type Outputs = {
  readonly url: { readonly href: string };
  readonly deployedSha256: { readonly value: string };
  readonly staticSite: StaticSiteV1;
};
