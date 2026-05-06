import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { CanonicalBundle } from '@rntme/platform-core';

export async function materializeBundle(bundle: CanonicalBundle): Promise<string> {
  if (typeof bundle.version === 'number' && bundle.version > 2) {
    throw new Error(`DEPLOY_BUNDLE_VERSION_UNSUPPORTED: bundle version ${bundle.version} not supported`);
  }

  const dir = await mkdtemp(join(tmpdir(), 'rntme-deploy-'));
  try {
    const materializedFilePaths = new Set<string>();
    for (const [relPath, value] of Object.entries(bundle.files)) {
      const path = safeBundlePath(dir, relPath, 'json');
      materializedFilePaths.add(path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(value));
    }

    const assets = bundle.assets ?? {};
    for (const [relPath, base64] of Object.entries(assets)) {
      const path = safeBundlePath(dir, relPath, 'asset');
      if (materializedFilePaths.has(path)) {
        throw new Error(`DEPLOY_BUNDLE_PATH_COLLISION: asset path "${relPath}" collides with a bundle file`);
      }
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, Buffer.from(base64, 'base64'));
    }
  } catch (cause) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw cause;
  }

  return dir;
}

function safeBundlePath(root: string, relPath: string, kind: 'json' | 'asset'): string {
  if (!isSafeBundleRelPath(relPath)) {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: unsafe bundle path "${relPath}"`);
  }
  if (kind === 'json' && !relPath.endsWith('.json')) {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: bundle JSON file path "${relPath}" must end with .json`);
  }

  const normalizedRoot = resolve(root);
  const absPath = resolve(normalizedRoot, relPath);
  const relativePath = relative(normalizedRoot, absPath);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${pathSeparator()}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`DEPLOY_BUNDLE_PATH_UNSAFE: bundle path "${relPath}" escapes materialization root`);
  }

  return absPath;
}

function isSafeBundleRelPath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function pathSeparator(): string {
  return process.platform === 'win32' ? '\\' : '/';
}
