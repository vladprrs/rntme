import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { safeProvisionerName } from '@rntme/blueprint';
import type { ProvisionerContract } from '@rntme/deploy-core';
import type { ResolveProvisioner } from './types.js';

/**
 * Build a {@link ResolveProvisioner} closure that loads a {@link ProvisionerContract}
 * from one of three locations, in order:
 *
 *  1. **Bundle-asset layout** (runtime path): when `bundleAssetDir` is provided,
 *     look for `<projectDir>/<bundleAssetDir>/<safeProvisionerName(packageName)>.entry.js`.
 *  2. **Bundled-manifest layout** (CLI direct-mode + runtime fallback): when
 *     `manifestPath` is provided, look up `<packageName>::<entry-with-forward-slashes>`
 *     in `<projectDir>/<manifestPath>`.
 *  3. **Installed-package layout**: resolve the package via `node_modules` from
 *     `<projectDir>/package.json` (fallback to `module.json`) and then resolve
 *     `entry` relative to that package root.
 *
 * Both manifest-bundled paths and installed-package entries are checked for
 * path-traversal (`back === '..' || back.startsWith('../') || back === ''`).
 *
 * @param opts.bundleAssetDir - Optional sub-path under `projectDir` to probe first
 *   for `<safe>.entry.js`. Pass `undefined` (CLI default) to skip the bundle-asset
 *   probe entirely.
 * @param opts.manifestPath - Optional manifest path relative to `projectDir`
 *   (e.g. `.provisioners/manifest.json`). Pass `undefined` to skip the manifest
 *   lookup.
 * @param opts.errorCodePrefix - Prefix for path-safety violation errors. Defaults
 *   to `'DEPLOY_PROVISIONER'`. CLI direct-mode passes `'CLI_DEPLOY_PROVISIONER'`.
 */
export type BuildResolveProvisionerOptions = {
  readonly bundleAssetDir?: string;
  readonly manifestPath?: string;
  readonly errorCodePrefix?: string;
};

type ProvisionerManifest = {
  readonly entries?: Readonly<Record<string, string>>;
};

export function buildResolveProvisioner(
  opts: BuildResolveProvisionerOptions = {},
): ResolveProvisioner {
  const errorCodePrefix = opts.errorCodePrefix ?? 'DEPLOY_PROVISIONER';
  return async (packageName, entry, projectDir) => {
    if (opts.bundleAssetDir !== undefined) {
      const bundleAsset = resolveBundleAssetProvisioner(
        projectDir,
        opts.bundleAssetDir,
        packageName,
      );
      if (bundleAsset !== null) return importProvisioner(bundleAsset);
    }

    if (opts.manifestPath !== undefined) {
      const bundled = resolveBundledProvisioner(
        projectDir,
        opts.manifestPath,
        packageName,
        entry,
        errorCodePrefix,
      );
      if (bundled !== null) return importProvisioner(bundled);
    }

    const req = createRequire(`${projectDir}/package.json`);
    const packageRoot = resolvePackageRoot(req, packageName);
    const resolved = resolvePackageEntry(packageRoot, entry, errorCodePrefix);
    return importProvisioner(resolved);
  };
}

function resolveBundleAssetProvisioner(
  projectDir: string,
  bundleAssetDir: string,
  packageName: string,
): string | null {
  const safe = safeProvisionerName(packageName);
  const resolved = resolve(projectDir, bundleAssetDir, `${safe}.entry.js`);
  return existsSync(resolved) ? resolved : null;
}

function resolveBundledProvisioner(
  projectDir: string,
  manifestPath: string,
  packageName: string,
  entry: string,
  errorCodePrefix: string,
): string | null {
  const absManifestPath = resolve(projectDir, manifestPath);
  if (!existsSync(absManifestPath)) return null;

  const manifest = JSON.parse(readFileSync(absManifestPath, 'utf8')) as ProvisionerManifest;
  const rel = manifest.entries?.[provisionerKey(packageName, entry)];
  if (rel === undefined || rel === '') return null;

  const resolved = isAbsolute(rel) ? rel : resolve(projectDir, rel);
  const provisionerRoot = dirname(absManifestPath);
  if (resolved !== provisionerRoot && !resolved.startsWith(`${provisionerRoot}/`)) {
    throw new Error(`${errorCodePrefix}_MANIFEST_PATH_INVALID:${packageName}`);
  }
  return resolved;
}

function provisionerKey(packageName: string, entry: string): string {
  return `${packageName}::${entry.replace(/\\/g, '/')}`;
}

function resolvePackageRoot(req: ReturnType<typeof createRequire>, packageName: string): string {
  try {
    return dirname(req.resolve(`${packageName}/package.json`));
  } catch {
    return dirname(req.resolve(`${packageName}/module.json`));
  }
}

function resolvePackageEntry(
  packageRoot: string,
  entry: string,
  errorCodePrefix: string,
): string {
  const resolved = resolve(packageRoot, entry);
  const back = relative(packageRoot, resolved).split(sep).join('/');
  if (back === '..' || back.startsWith('../') || back === '') {
    throw new Error(`${errorCodePrefix}_ENTRY_PATH_INVALID:${entry}`);
  }
  return resolved;
}

async function importProvisioner(path: string): Promise<ProvisionerContract> {
  const mod = (await import(pathToFileURL(path).href)) as {
    default?: ProvisionerContract;
  } & ProvisionerContract;
  if (mod.default && typeof mod.default === 'object') return mod.default;
  return mod;
}
