// apps/cli/src/bundle/collect-assets.ts
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { safeProvisionerName } from '@rntme/blueprint';

const MAX_ASSETS_BYTES = 10 * 1024 * 1024;

export type CollectAssetsError = Readonly<{
  code:
    | 'BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN'
    | 'BLUEPRINT_PROVISIONER_ENTRY_MISSING'
    | 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING'
    | 'BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED'
    | 'CLI_BUNDLE_ASSETS_TOO_LARGE';
  message: string;
}>;

export type CollectAssetsOk = { readonly ok: true; readonly value: Readonly<Record<string, string>> };
export type CollectAssetsErr = { readonly ok: false; readonly errors: CollectAssetsError[] };
export type CollectAssetsResult = CollectAssetsOk | CollectAssetsErr;

type ProvisionerBlock = { entry?: unknown };
type ManifestShape = { name?: unknown; provisioner?: unknown };

export function collectBundleAssets(
  root: string,
  bundleFiles: Readonly<Record<string, unknown>>,
  projectFiles: readonly string[],
): CollectAssetsResult {
  const out: Record<string, string> = {};
  const budget = { totalBytes: 0 };

  const provisioners = collectProvisionerAssetsInto(root, bundleFiles, out, budget);
  if (!provisioners.ok) return provisioners;

  const moduleClientAssets = collectModuleClientAssetsInto(root, bundleFiles, out, budget);
  if (!moduleClientAssets.ok) return moduleClientAssets;

  const workflows = collectWorkflowAssetsInto(root, projectFiles, out, budget);
  if (!workflows.ok) return workflows;

  const commandHandlers = rejectCommandHandlerAssets(projectFiles);
  if (!commandHandlers.ok) return commandHandlers;

  return { ok: true, value: out };
}

export function collectProvisionerAssets(
  root: string,
  bundleFiles: Readonly<Record<string, unknown>>,
): CollectAssetsResult {
  const out: Record<string, string> = {};
  const budget = { totalBytes: 0 };
  const result = collectProvisionerAssetsInto(root, bundleFiles, out, budget);
  if (!result.ok) return result;
  return { ok: true, value: out };
}

function collectProvisionerAssetsInto(
  root: string,
  bundleFiles: Readonly<Record<string, unknown>>,
  out: Record<string, string>,
  budget: { totalBytes: number },
): CollectAssetsResult {
  // Sort keys for stable, deterministic output order
  const sortedKeys = Object.keys(bundleFiles).sort();

  for (const relPath of sortedKeys) {
    if (!relPath.endsWith('/module.json')) continue;
    if (!relPath.startsWith('node_modules/')) continue;

    const value = bundleFiles[relPath];
    const manifest = value as ManifestShape;
    const provisioner = manifest.provisioner as ProvisionerBlock | undefined;
    if (!provisioner) continue;

    const entry = provisioner.entry;
    if (typeof entry !== 'string' || entry.length === 0) continue;

    const name = manifest.name;
    if (typeof name !== 'string' || name.length === 0) continue;

    const moduleDir = dirname(relPath);
    const absEntry = resolve(root, moduleDir, entry);

    let bytes: Buffer;
    try {
      const st = statSync(absEntry);
      if (!st.isFile()) {
        return {
          ok: false,
          errors: [{
            code: 'BLUEPRINT_PROVISIONER_ENTRY_MISSING',
            message: `module "${name}" provisioner.entry "${entry}" is not a regular file`,
          }],
        };
      }
      bytes = readFileSync(absEntry);
    } catch (cause) {
      return {
        ok: false,
        errors: [{
          code: 'BLUEPRINT_PROVISIONER_ENTRY_MISSING',
          message: `module "${name}" provisioner.entry "${entry}" is missing on disk (${(cause as Error).message})`,
        }],
      };
    }

    const safe = safeProvisionerName(name);
    const added = addAsset(out, `assets/provisioners/${safe}.entry.js`, bytes, budget);
    if (!added.ok) return added;
  }

  return { ok: true, value: out };
}

function collectWorkflowAssetsInto(
  root: string,
  projectFiles: readonly string[],
  out: Record<string, string>,
  budget: { totalBytes: number },
): CollectAssetsResult {
  for (const relPath of [...projectFiles].sort()) {
    if (!relPath.startsWith('workflows/')) continue;
    if (!relPath.endsWith('.bpmn')) continue;

    let bytes: Buffer;
    const absPath = resolve(root, relPath);
    try {
      const st = statSync(absPath);
      if (!st.isFile()) continue;
      bytes = readFileSync(absPath);
    } catch {
      continue;
    }

    const added = addAsset(out, relPath, bytes, budget);
    if (!added.ok) return added;
  }

  return { ok: true, value: out };
}

function rejectCommandHandlerAssets(
  projectFiles: readonly string[],
): CollectAssetsResult {
  for (const relPath of [...projectFiles].sort()) {
    if (!isServiceCommandModulePath(relPath)) continue;
    return {
      ok: false,
      errors: [{
        code: 'BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN',
        message: `domain service command handler file "${relPath}" is not bundleable`,
      }],
    };
  }

  return { ok: true, value: {} };
}

function isServiceCommandModulePath(relPath: string): boolean {
  const parts = relPath.split('/');
  return parts.length >= 4 && parts[0] === 'services' && parts[2] === 'commands' && relPath.endsWith('.mjs');
}

type ClientAssetDecl = { id?: unknown; path?: unknown };
type ClientAssetsBlock = {
  stylesheets?: unknown;
  fonts?: unknown;
  icons?: unknown;
  images?: unknown;
  staticFiles?: unknown;
  preloads?: unknown;
};
type ClientBlockShape = { assets?: unknown };
type ClientAssetManifestShape = ManifestShape & { client?: ClientBlockShape };

function collectModuleClientAssetsInto(
  root: string,
  bundleFiles: Readonly<Record<string, unknown>>,
  out: Record<string, string>,
  budget: { totalBytes: number },
): CollectAssetsResult {
  for (const relPath of Object.keys(bundleFiles).sort()) {
    if (!relPath.startsWith('node_modules/') || !relPath.endsWith('/module.json')) continue;
    const manifest = bundleFiles[relPath] as ClientAssetManifestShape;
    const assets = manifest.client?.assets as ClientAssetsBlock | undefined;
    if (assets === undefined) continue;
    const moduleDir = dirname(relPath);
    const assetPaths = declaredClientAssetPaths(assets);
    for (const assetPath of [...assetPaths].sort()) {
      if (isJavaScriptAsset(assetPath)) {
        return {
          ok: false,
          errors: [{
            code: 'BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED',
            message: `module client asset "${moduleDir}/${assetPath}" is executable JavaScript`,
          }],
        };
      }
      const bundleAssetPath = `${moduleDir}/${assetPath}`;
      const absPath = resolve(root, bundleAssetPath);
      let bytes: Buffer;
      try {
        const st = statSync(absPath);
        if (!st.isFile()) {
          return {
            ok: false,
            errors: [{
              code: 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING',
              message: `module client asset "${bundleAssetPath}" is not a regular file`,
            }],
          };
        }
        bytes = readFileSync(absPath);
      } catch (cause) {
        return {
          ok: false,
          errors: [{
            code: 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING',
            message: `module client asset "${bundleAssetPath}" is missing on disk (${(cause as Error).message})`,
          }],
        };
      }
      const added = addAsset(out, bundleAssetPath, bytes, budget);
      if (!added.ok) return added;
    }
  }
  return { ok: true, value: out };
}

function declaredClientAssetPaths(assets: ClientAssetsBlock): Set<string> {
  const paths = new Set<string>();
  for (const key of ['stylesheets', 'fonts', 'icons', 'images', 'staticFiles'] as const) {
    const list = assets[key];
    if (!Array.isArray(list)) continue;
    for (const item of list as ClientAssetDecl[]) {
      if (typeof item.path === 'string' && item.path.length > 0) paths.add(item.path);
    }
  }
  const preloads = assets.preloads;
  if (Array.isArray(preloads)) {
    for (const item of preloads as ClientAssetDecl[]) {
      if (typeof item.path === 'string' && item.path.length > 0) paths.add(item.path);
    }
  }
  return paths;
}

function isJavaScriptAsset(path: string): boolean {
  return /\.(?:mjs|cjs|js|jsx|ts|tsx)$/i.test(path);
}

function addAsset(
  out: Record<string, string>,
  key: string,
  bytes: Buffer,
  budget: { totalBytes: number },
): CollectAssetsResult {
  budget.totalBytes += bytes.byteLength;
  if (budget.totalBytes > MAX_ASSETS_BYTES) {
    return {
      ok: false,
      errors: [{
        code: 'CLI_BUNDLE_ASSETS_TOO_LARGE',
        message: `combined bundle asset bytes exceed 10 MiB (got ${budget.totalBytes})`,
      }],
    };
  }

  out[key] = bytes.toString('base64');
  return { ok: true, value: out };
}
