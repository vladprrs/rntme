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

export function collectProvisionerAssets(
  root: string,
  bundleFiles: Readonly<Record<string, unknown>>,
): CollectAssetsResult {
  const out: Record<string, string> = {};
  let totalBytes = 0;

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

    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_ASSETS_BYTES) {
      return {
        ok: false,
        errors: [{
          code: 'CLI_BUNDLE_ASSETS_TOO_LARGE',
          message: `combined provisioner asset bytes exceed 10 MiB (got ${totalBytes})`,
        }],
      };
    }

    const safe = safeProvisionerName(name);
    out[`assets/provisioners/${safe}.entry.js`] = bytes.toString('base64');
  }

  return { ok: true, value: out };
}
