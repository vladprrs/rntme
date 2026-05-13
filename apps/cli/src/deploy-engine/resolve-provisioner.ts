import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProvisionerContract } from '@rntme/deploy-core';
import type { ResolveProvisioner } from '@rntme/deploy-runner';

export function createCliResolveProvisioner(): ResolveProvisioner {
  return async (packageName, entry, projectDir) => {
    const bundled = resolveBundledProvisioner(projectDir, packageName, entry);
    if (bundled !== null) return importProvisioner(bundled);

    const req = createRequire(`${projectDir}/package.json`);
    const packageRoot = resolvePackageRoot(req, packageName);
    const resolved = resolvePackageEntry(packageRoot, entry);
    return importProvisioner(resolved);
  };
}

type ProvisionerManifest = {
  readonly entries?: Readonly<Record<string, string>>;
};

function resolveBundledProvisioner(projectDir: string, packageName: string, entry: string): string | null {
  const manifestPath = resolve(projectDir, '.provisioners', 'manifest.json');
  if (!existsSync(manifestPath)) return null;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ProvisionerManifest;
  const rel = manifest.entries?.[provisionerKey(packageName, entry)];
  if (rel === undefined || rel === '') return null;

  const resolved = isAbsolute(rel) ? rel : resolve(projectDir, rel);
  const provisionerRoot = resolve(projectDir, '.provisioners');
  if (resolved !== provisionerRoot && !resolved.startsWith(`${provisionerRoot}/`)) {
    throw new Error(`CLI_DEPLOY_PROVISIONER_MANIFEST_PATH_INVALID:${packageName}`);
  }
  return resolved;
}

function provisionerKey(packageName: string, entry: string): string {
  return `${packageName}::${entry.replace(/\\/g, '/')}`;
}

function resolvePackageRoot(req: NodeJS.Require, packageName: string): string {
  try {
    return dirname(req.resolve(`${packageName}/package.json`));
  } catch {
    return dirname(req.resolve(`${packageName}/module.json`));
  }
}

function resolvePackageEntry(packageRoot: string, entry: string): string {
  const resolved = resolve(packageRoot, entry);
  const back = relative(packageRoot, resolved).split(sep).join('/');
  if (back === '..' || back.startsWith('../') || back === '') {
    throw new Error(`CLI_DEPLOY_PROVISIONER_ENTRY_PATH_INVALID:${entry}`);
  }
  return resolved;
}

async function importProvisioner(path: string): Promise<ProvisionerContract> {
  const mod = (await import(pathToFileURL(path).href)) as { default?: ProvisionerContract } & ProvisionerContract;
  if (mod.default && typeof mod.default === 'object') return mod.default;
  return mod;
}
