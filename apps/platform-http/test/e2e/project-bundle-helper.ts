import { Buffer } from 'node:buffer';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import {
  canonicalBundleDigest,
  canonicalize,
  type CanonicalBundle,
} from '@rntme/platform-core';

export function buildProjectBundleForE2e(root: string): { readonly bytes: string; readonly digest: string } {
  const files: Record<string, unknown> = {};
  const assets: Record<string, string> = {};
  for (const relPath of collectFiles(root)) {
    const abs = resolve(root, relPath);
    if (relPath.endsWith('.json')) {
      files[relPath] = JSON.parse(readFileSync(abs, 'utf8'));
    } else if (
      relPath.endsWith('.bpmn') ||
      relPath.endsWith('.mjs') ||
      relPath.endsWith('.js') ||
      relPath.endsWith('.ts') ||
      relPath.endsWith('.tsx') ||
      relPath.endsWith('.css')
    ) {
      assets[relPath] = Buffer.from(readFileSync(abs)).toString('base64');
    }
  }
  const bundle: CanonicalBundle = { version: 2, files, assets };
  return { bytes: canonicalize(bundle), digest: canonicalBundleDigest(bundle) };
}

function collectFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const name of readdirSync(dir).sort()) {
      const abs = resolve(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) out.push(relative(root, abs).split(sep).join('/'));
    }
  }
  walk(root);
  return out.sort();
}
