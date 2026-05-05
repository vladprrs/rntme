// apps/cli/src/bundle/collect-assets.ts
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { safeProvisionerName } from '@rntme/blueprint';

const MAX_ASSETS_BYTES = 10 * 1024 * 1024;

export type CollectAssetsError = Readonly<{
  code: 'BLUEPRINT_PROVISIONER_ENTRY_MISSING' | 'CLI_BUNDLE_ASSETS_TOO_LARGE';
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

  const workflows = collectWorkflowAssetsInto(root, projectFiles, out, budget);
  if (!workflows.ok) return workflows;

  const commandHandlers = collectCommandHandlerAssetsInto(root, projectFiles, out, budget);
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

function collectCommandHandlerAssetsInto(
  root: string,
  projectFiles: readonly string[],
  out: Record<string, string>,
  budget: { totalBytes: number },
): CollectAssetsResult {
  for (const relPath of [...projectFiles].sort()) {
    if (!isServiceCommandModulePath(relPath)) continue;

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

function isServiceCommandModulePath(relPath: string): boolean {
  const parts = relPath.split('/');
  return parts.length >= 4 && parts[0] === 'services' && parts[2] === 'commands' && relPath.endsWith('.mjs');
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
