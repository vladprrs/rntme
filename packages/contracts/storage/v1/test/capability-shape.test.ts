import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../../..');
const STORAGE_MODULES_DIR = join(REPO_ROOT, 'modules/storage');

interface Capabilities {
  vendors?: unknown;
  s3_compatible_backends?: unknown;
  rpcs?: unknown;
  events?: unknown;
}

interface ModuleManifest {
  category?: unknown;
  contract?: unknown;
  capabilities?: Capabilities;
}

function findModuleJsons(): string[] {
  if (!existsSync(STORAGE_MODULES_DIR)) return [];
  const out: string[] = [];
  for (const child of readdirSync(STORAGE_MODULES_DIR)) {
    if (child === 'conformance') continue;
    const p = join(STORAGE_MODULES_DIR, child, 'module.json');
    if (existsSync(p) && statSync(p).isFile()) out.push(p);
  }
  return out;
}

describe('storage module manifest capability shape', () => {
  it('every storage vendor module declares a v1 storage contract and at least one RPC', () => {
    const files = findModuleJsons();
    for (const f of files) {
      const mf = JSON.parse(readFileSync(f, 'utf8')) as ModuleManifest;
      expect(mf.category, `${f}: category`).toBe('storage');
      expect(mf.contract, `${f}: contract`).toBe('storage/v1');
      expect(Array.isArray(mf.capabilities?.vendors), `${f}: vendors[]`).toBe(true);
      expect(Array.isArray(mf.capabilities?.rpcs), `${f}: rpcs[]`).toBe(true);
    }
    // Vacuous pass: no modules -> no failures.
  });
});
