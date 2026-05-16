import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { err, ok, type Result } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import { canonicalJson } from '../util/canonical-json.js';
import { collectBundleAssets } from './collect-assets.js';
import type { CanonicalBundle } from '@rntme/blueprint';

export type CliCanonicalBundle = CanonicalBundle & {
  readonly version: 2;
  readonly assets: Record<string, string>;
};

export type BuiltProjectBundle = {
  readonly bundle: CliCanonicalBundle;
  readonly bytes: string;
  readonly digest: string;
  readonly size: number;
};

export async function buildProjectBundle(folder: string): Promise<Result<BuiltProjectBundle, CliError>> {
  const root = resolve(folder);
  const files = collectFiles(root);
  if (!files.ok) return files;

  if (!files.value.includes('project.json')) {
    return err(cliError('CLI_CONFIG_MISSING', 'project.json not found in bundle root'));
  }

  const bundleFiles: Record<string, unknown> = {};
  for (const relPath of files.value) {
    if (!relPath.endsWith('.json')) continue;
    try {
      bundleFiles[relPath] = normalizeBundledJson(relPath, JSON.parse(readFileSync(resolve(root, relPath), 'utf8')));
    } catch (cause) {
      return err(cliError('CLI_CONFIG_INVALID', `invalid JSON in ${relPath}`, undefined, cause));
    }
  }

  const assetsResult = await collectBundleAssets(root, bundleFiles, files.value);
  if (!assetsResult.ok) {
    const e = assetsResult.errors[0] ?? { code: 'CLI_VALIDATE_LOCAL_FAILED' as const, message: 'unknown asset collection error' };
    return err(cliError(
      e.code === 'CLI_BUNDLE_ASSETS_TOO_LARGE' ? 'CLI_BUNDLE_ASSETS_TOO_LARGE' : 'CLI_VALIDATE_LOCAL_FAILED',
      `${e.code}: ${e.message}`,
    ));
  }

  const bundle: CliCanonicalBundle = { version: 2, files: bundleFiles, assets: assetsResult.value };
  const bytes = canonicalJson(bundle);
  return ok({
    bundle,
    bytes,
    digest: canonicalBundleDigest(bundle),
    size: Buffer.byteLength(bytes),
  });
}

export function canonicalBundleDigest(bundle: CanonicalBundle): string {
  return `sha256:${createHash('sha256').update(canonicalJson(bundle)).digest('hex')}`;
}

function collectFiles(root: string): Result<string[], CliError> {
  const out: string[] = [];

  function walk(dir: string): void {
    for (const name of readdirSync(dir).sort()) {
      const abs = resolve(dir, name);
      const relPath = relative(root, abs).split(sep).join('/');
      if (!shouldVisitBundlePath(relPath)) continue;
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!st.isFile()) continue;
      if (shouldBundleFile(root, relPath)) out.push(relPath);
    }
  }

  try {
    walk(root);
  } catch (cause) {
    return err(cliError('CLI_CONFIG_MISSING', `cannot read project bundle folder: ${root}`, undefined, cause));
  }

  out.sort();
  return ok(out);
}

function shouldVisitBundlePath(relPath: string): boolean {
  if (!relPath.startsWith('node_modules/')) return true;
  const parts = relPath.split('/');
  if (parts.length === 1) return true;

  if (parts[1]?.startsWith('@')) {
    if (parts.length <= 3) return true;
    return parts.length === 4 && (parts[3] === 'module.json' || parts[3] === 'package.json');
  }

  if (parts.length <= 2) return true;
  return parts.length === 3 && (parts[2] === 'module.json' || parts[2] === 'package.json');
}

function shouldBundleFile(root: string, relPath: string): boolean {
  if (!relPath.startsWith('node_modules/')) return true;
  if (relPath.endsWith('/module.json')) return true;
  if (!relPath.endsWith('/package.json')) return false;
  return existsSync(resolve(root, relPath.slice(0, -'package.json'.length), 'module.json'));
}

function normalizeBundledJson(relPath: string, value: unknown): unknown {
  if (!isBundledModuleManifest(relPath) || !isJsonObject(value) || !isJsonObject(value['capabilities'])) return value;

  const capabilities = { ...value['capabilities'] };
  delete capabilities['agent_execution_mode'];
  delete capabilities['gateway_upstreams'];
  delete capabilities['input_modalities'];
  delete capabilities['reasoning_visibility_supported'];
  delete capabilities['thread'];

  return { ...value, capabilities };
}

function isBundledModuleManifest(relPath: string): boolean {
  return relPath.startsWith('node_modules/') && relPath.endsWith('/module.json');
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
