// packages/deploy/deploy-runner/src/project-assets.ts
//
// Convert bundle-side `project-folder` source declarations into the
// deploy-runner -> provisioner handshake shape `materialized-project-asset`.
//
// `materializeBundle` (in @rntme/blueprint) has already extracted every
// `assets/**` base64 entry into a real file under `bundleDir`. This stage's
// only job is to pick the matching tar.gz for each `project-folder` module
// and rewrite the `publicConfig.source` so the vendor provisioner sees a
// local file path with a pre-computed sha256 instead of a bundle-side
// shape it has no business decoding.
//
// Running this BEFORE `runProvisioners` keeps the canonical
// `MarketingSiteV1ConfigSchema` source union closed (no
// `materialized-project-asset` member), keeps the vendor provisioner
// target-agnostic (no bundle storage / registry / Dokploy access required
// for the project-folder path), and confines tar-extract responsibility to
// one place.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DiscoveredProvisionerModule } from '@rntme/deploy-core';

export type MaterializeProjectAssetsInput = {
  readonly modules: readonly DiscoveredProvisionerModule[];
  readonly bundleDir: string;
};

export type MaterializeProjectAssetsError = {
  readonly code:
    | 'DEPLOY_PROVISION_PROJECT_FOLDER_ASSET_MISSING'
    | 'DEPLOY_PROVISION_PROJECT_FOLDER_ASSET_INVALID';
  readonly message: string;
  readonly module?: string;
};

export type MaterializeProjectAssetsResult = {
  readonly modules: readonly DiscoveredProvisionerModule[];
  readonly errors: readonly MaterializeProjectAssetsError[];
};

export function materializeProjectFolderAssets(
  input: MaterializeProjectAssetsInput,
): MaterializeProjectAssetsResult {
  const errors: MaterializeProjectAssetsError[] = [];
  const next: DiscoveredProvisionerModule[] = [];

  for (const mod of input.modules) {
    const publicConfig = mod.publicConfig as Record<string, unknown>;
    const source = publicConfig['source'];
    if (!isProjectFolderSource(source)) {
      next.push(mod);
      continue;
    }

    const assetPath = findAssetPath(input.bundleDir, mod.projectKey);
    if (assetPath === null) {
      errors.push({
        code: 'DEPLOY_PROVISION_PROJECT_FOLDER_ASSET_MISSING',
        message: `module "${mod.projectKey}" declared project-folder source but no asset is packed at assets/project-folders/${mod.projectKey}/<sha>.tar.gz`,
        module: mod.packageName,
      });
      continue;
    }

    const sha = shaFromAssetPath(assetPath);
    if (sha === null) {
      errors.push({
        code: 'DEPLOY_PROVISION_PROJECT_FOLDER_ASSET_INVALID',
        message: `module "${mod.projectKey}" project-folder asset path "${assetPath}" missing sha256 segment`,
        module: mod.packageName,
      });
      continue;
    }

    const localPath = join(input.bundleDir, assetPath);
    if (!existsSync(localPath)) {
      errors.push({
        code: 'DEPLOY_PROVISION_PROJECT_FOLDER_ASSET_MISSING',
        message: `module "${mod.projectKey}" project-folder asset materialized path missing on disk: ${localPath}`,
        module: mod.packageName,
      });
      continue;
    }

    const nextPublicConfig: Record<string, unknown> = {
      ...publicConfig,
      source: {
        kind: 'materialized-project-asset',
        assetPath,
        localPath,
        sha256: sha,
      },
    };
    next.push({ ...mod, publicConfig: nextPublicConfig });
  }

  return { modules: next, errors };
}

function isProjectFolderSource(value: unknown): value is { kind: 'project-folder' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).kind === 'project-folder'
  );
}

function findAssetPath(bundleDir: string, moduleKey: string): string | null {
  const dir = join(bundleDir, 'assets', 'project-folders', moduleKey);
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir).filter((name) => /^[0-9a-f]{64}\.tar\.gz$/.test(name));
  if (entries.length === 0) return null;
  entries.sort();
  return `assets/project-folders/${moduleKey}/${entries[0]}`;
}

function shaFromAssetPath(assetPath: string): string | null {
  const match = /\/([0-9a-f]{64})\.tar\.gz$/.exec(assetPath);
  return match === null ? null : match[1] ?? null;
}
