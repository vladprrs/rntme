import { mkdir, mkdtemp, cp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { dirname, relative, resolve, sep, join } from 'node:path';
import { defaultResolvePackage, loadComposedBlueprint } from '@rntme/blueprint';
import type { ComposedProjectInput } from '@rntme/deploy-core';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import { toDeployCoreInput } from '@rntme/deploy-bundle-input';
import { buildProjectBundle } from '../bundle/build.js';

export type LoadedBlueprint = {
  readonly composedBlueprint: ComposedProjectInput;
  readonly bundleDir: string;
  readonly cleanup: () => Promise<void>;
};

export async function loadBlueprintForDeploy(dir: string): Promise<Result<LoadedBlueprint, CliError>> {
  const prepared = await prepareBundleDir(dir);
  if (!prepared.ok) return prepared;

  const composed = await loadComposedBlueprint(prepared.value.bundleDir);
  if (!composed.ok) {
    await prepared.value.cleanup();
    const n = composed.errors.length;
    const first = composed.errors[0];
    return err(
      cliError(
        'CLI_DEPLOY_BLUEPRINT_INVALID',
        n === 1
          ? `failed to compose blueprint at ${prepared.value.bundleDir}: ${first?.code ?? 'UNKNOWN'}: ${first?.message ?? ''}`
          : `failed to compose blueprint at ${prepared.value.bundleDir}: ${n} errors (first: ${first?.code ?? 'UNKNOWN'}); see nested for details`,
        undefined,
        composed.errors,
      ),
    );
  }
  try {
    const projectInput = await toDeployCoreInput(composed.value, prepared.value.bundleDir);
    return ok({ composedBlueprint: projectInput, bundleDir: prepared.value.bundleDir, cleanup: prepared.value.cleanup });
  } catch (cause) {
    await prepared.value.cleanup();
    return err(
      cliError(
        'CLI_DEPLOY_BLUEPRINT_INVALID',
        `failed to build deploy input for blueprint at ${prepared.value.bundleDir}: ${cause instanceof Error ? cause.message : String(cause)}`,
        undefined,
        cause,
      ),
    );
  }
}

type PreparedBundleDir = {
  readonly bundleDir: string;
  readonly cleanup: () => Promise<void>;
};

async function prepareBundleDir(dir: string): Promise<Result<PreparedBundleDir, CliError>> {
  const built = await buildProjectBundle(dir);
  if (!built.ok) {
    return err(
      cliError(
        'CLI_DEPLOY_BLUEPRINT_INVALID',
        `failed to prepare deploy bundle at ${dir}: ${built.error.code}: ${built.error.message}`,
        undefined,
        built.error,
      ),
    );
  }

  if (Object.keys(built.value.bundle.assets).length === 0) {
    return ok({ bundleDir: dir, cleanup: async () => undefined });
  }

  const sourceRoot = resolve(dir);
  const tempRoot = dirname(sourceRoot);
  let tempDir = '';
  try {
    await mkdir(tempRoot, { recursive: true });
    tempDir = await mkdtemp(join(tempRoot, 'rntme-direct-deploy-'));
    await cp(sourceRoot, tempDir, {
      recursive: true,
      filter: (source) => shouldCopyBlueprintPath(sourceRoot, source),
    });
    await linkDeclaredWorkspaceModules(sourceRoot, tempDir);
    await writeBundleAssets(tempDir, built.value.bundle.assets);
  } catch (cause) {
    if (tempDir !== '') await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    return err(
      cliError(
        'CLI_DEPLOY_BLUEPRINT_INVALID',
        `failed to materialize deploy bundle at ${tempDir}: ${cause instanceof Error ? cause.message : String(cause)}`,
        undefined,
        cause,
      ),
    );
  }

  return ok({ bundleDir: tempDir, cleanup: async () => { await rm(tempDir, { recursive: true, force: true }); } });
}

async function linkDeclaredWorkspaceModules(sourceRoot: string, tempDir: string): Promise<void> {
  const rawProject = JSON.parse(await readFile(join(sourceRoot, 'project.json'), 'utf8')) as {
    modules?: Record<string, { package?: unknown }>;
  };
  const packageNames = new Set<string>();
  for (const moduleRef of Object.values(rawProject.modules ?? {})) {
    if (typeof moduleRef.package === 'string' && moduleRef.package.length > 0) {
      packageNames.add(moduleRef.package);
    }
  }

  for (const packageName of [...packageNames].sort()) {
    const packageDir = await defaultResolvePackage(packageName, sourceRoot);
    const linkPath = join(tempDir, 'node_modules', ...packageName.split('/'));
    await mkdir(dirname(linkPath), { recursive: true });
    await symlink(packageDir, linkPath, 'dir');
  }
}

function shouldCopyBlueprintPath(root: string, source: string): boolean {
  const rel = relative(root, source).split(sep).join('/');
  if (rel === '') return true;
  return !rel.split('/').some((part) => part === 'node_modules' || part === '.git' || part === '.rntme-ui-build');
}

async function writeBundleAssets(root: string, assets: Readonly<Record<string, string>>): Promise<void> {
  for (const [relPath, base64] of Object.entries(assets)) {
    const absPath = safeAssetPath(root, relPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, Buffer.from(base64, 'base64'));
  }
}

function safeAssetPath(root: string, relPath: string): string {
  if (relPath === '' || relPath.startsWith('/') || relPath.includes('\\') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(relPath)) {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: unsafe asset path "${relPath}"`);
  }
  if (!relPath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')) {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: unsafe asset path "${relPath}"`);
  }
  const rootAbs = resolve(root);
  const abs = resolve(rootAbs, relPath);
  const back = relative(rootAbs, abs).split(sep).join('/');
  if (back === '..' || back.startsWith('../') || back === '') {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: asset path "${relPath}" escapes materialization root`);
  }
  return abs;
}
