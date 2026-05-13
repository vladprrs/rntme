// apps/cli/src/bundle/project-folder-assets.ts
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDeterministicTarGz, hashBuffer } from '@rntme/bundle-publish';

export type ProjectFolderAssetsError = Readonly<{
  code:
    | 'BLUEPRINT_PROJECT_FOLDER_ASSET_MISSING'
    | 'BLUEPRINT_PROJECT_FOLDER_ASSET_INVALID'
    | 'CLI_BUNDLE_ASSETS_TOO_LARGE';
  message: string;
}>;

export type ProjectFolderAssetsOk = {
  readonly ok: true;
  readonly value: Readonly<Record<string, string>>;
};
export type ProjectFolderAssetsErr = {
  readonly ok: false;
  readonly errors: ProjectFolderAssetsError[];
};
export type ProjectFolderAssetsResult =
  | ProjectFolderAssetsOk
  | ProjectFolderAssetsErr;

const MAX_BYTES_PER_FOLDER = 8 * 1024 * 1024;

/**
 * Walk `project.json` for module declarations whose `publicConfig.source.kind`
 * is `project-folder` and pack the referenced folder into a deterministic
 * `assets/project-folders/<moduleKey>/<sha256>.tar.gz` entry.
 *
 * The original `project.json` source is left untouched so the bundle stays
 * authored-as-declared; deploy-runner materializes the bundle-side asset
 * back into a local path before any provisioner runs (see
 * deploy-runner/project-assets.ts).
 */
export async function collectProjectFolderAssets(
  root: string,
  bundleFiles: Readonly<Record<string, unknown>>,
  budget: { totalBytes: number },
  maxTotalBytes: number,
): Promise<ProjectFolderAssetsResult> {
  const out: Record<string, string> = {};
  const project = bundleFiles['project.json'];
  if (!isJsonObject(project)) return { ok: true, value: out };

  const modules = project['modules'];
  if (!isJsonObject(modules)) return { ok: true, value: out };

  const moduleKeys = Object.keys(modules).sort();
  for (const moduleKey of moduleKeys) {
    if (!isSafeModuleKey(moduleKey)) {
      return {
        ok: false,
        errors: [
          {
            code: 'BLUEPRINT_PROJECT_FOLDER_ASSET_INVALID',
            message: `module key "${moduleKey}" is not a safe asset path segment`,
          },
        ],
      };
    }
    const moduleEntry = modules[moduleKey];
    if (!isJsonObject(moduleEntry)) continue;
    const publicConfig = moduleEntry['publicConfig'];
    if (!isJsonObject(publicConfig)) continue;
    const source = publicConfig['source'];
    if (!isJsonObject(source)) continue;
    if (source['kind'] !== 'project-folder') continue;
    const path = source['path'];
    if (typeof path !== 'string' || path.length === 0) {
      return {
        ok: false,
        errors: [
          {
            code: 'BLUEPRINT_PROJECT_FOLDER_ASSET_INVALID',
            message: `module "${moduleKey}" project-folder source.path must be a non-empty string`,
          },
        ],
      };
    }

    const abs = resolve(root, path);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      return {
        ok: false,
        errors: [
          {
            code: 'BLUEPRINT_PROJECT_FOLDER_ASSET_MISSING',
            message: `module "${moduleKey}" project-folder "${path}" does not exist or is not a directory at ${abs}`,
          },
        ],
      };
    }

    let tarGz: Buffer;
    try {
      tarGz = await buildDeterministicTarGz(abs, [], MAX_BYTES_PER_FOLDER);
    } catch (cause) {
      return {
        ok: false,
        errors: [
          {
            code: 'BLUEPRINT_PROJECT_FOLDER_ASSET_INVALID',
            message: `module "${moduleKey}" project-folder "${path}" failed to pack: ${(cause as Error).message}`,
          },
        ],
      };
    }

    budget.totalBytes += tarGz.byteLength;
    if (budget.totalBytes > maxTotalBytes) {
      return {
        ok: false,
        errors: [
          {
            code: 'CLI_BUNDLE_ASSETS_TOO_LARGE',
            message: `combined bundle asset bytes exceed ${maxTotalBytes} (got ${budget.totalBytes})`,
          },
        ],
      };
    }
    const sha = hashBuffer(tarGz);
    out[`assets/project-folders/${moduleKey}/${sha}.tar.gz`] = tarGz.toString('base64');
  }

  return { ok: true, value: out };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeModuleKey(key: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(key);
}
