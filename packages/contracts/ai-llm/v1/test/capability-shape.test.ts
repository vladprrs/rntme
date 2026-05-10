import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const AI_LLM_MODULES_DIR = join(REPO_ROOT, 'modules/ai-llm');

interface Capabilities {
  vendors?: unknown;
  gateway_upstreams?: unknown;
  rpcs?: unknown;
}

interface ModuleManifest {
  category?: unknown;
  capabilities?: Capabilities;
}

function discoverAiLlmModuleManifests(): { path: string; manifest: ModuleManifest }[] {
  const manifests: { path: string; manifest: ModuleManifest }[] = [];
  let entries: string[];
  try {
    entries = readdirSync(AI_LLM_MODULES_DIR);
  } catch {
    return manifests;
  }
  for (const entry of entries) {
    if (entry === 'conformance') continue;
    const entryPath = join(AI_LLM_MODULES_DIR, entry);
    let st;
    try {
      st = statSync(entryPath);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const manifestPath = join(entryPath, 'module.json');
    try {
      const raw = readFileSync(manifestPath, 'utf8');
      manifests.push({ path: manifestPath, manifest: JSON.parse(raw) as ModuleManifest });
    } catch {
      // module.json missing in some scaffold-in-progress dir — skip
    }
  }
  return manifests;
}

describe('AI/LLM module manifest capability shape', () => {
  const manifests = discoverAiLlmModuleManifests();

  it('every AI/LLM module declares category=ai-llm', () => {
    for (const { path, manifest } of manifests) {
      expect(manifest.category, `${path}: category`).toBe('ai-llm');
    }
  });

  it('vendors[] is non-empty and single-element for every AI/LLM module', () => {
    for (const { path, manifest } of manifests) {
      const vendors = manifest.capabilities?.vendors;
      expect(Array.isArray(vendors), `${path}: vendors must be array`).toBe(true);
      expect((vendors as unknown[]).length, `${path}: vendors must have exactly one element`).toBe(1);
      expect(typeof (vendors as unknown[])[0], `${path}: vendors[0] must be string`).toBe('string');
    }
  });

  it('gateway_upstreams[] is optional; when present, an array of strings', () => {
    for (const { path, manifest } of manifests) {
      const upstreams = manifest.capabilities?.gateway_upstreams;
      if (upstreams === undefined) continue;
      expect(Array.isArray(upstreams), `${path}: gateway_upstreams must be array`).toBe(true);
      for (const u of upstreams as unknown[]) {
        expect(typeof u, `${path}: gateway_upstreams entry must be string`).toBe('string');
      }
    }
  });

  it('Complete in rpcs[] implies GetCompletion in rpcs[]', () => {
    for (const { path, manifest } of manifests) {
      const rpcs = manifest.capabilities?.rpcs;
      if (!Array.isArray(rpcs)) continue;
      const set = new Set(rpcs as string[]);
      if (set.has('Complete')) {
        expect(set.has('GetCompletion'), `${path}: Complete in rpcs[] requires GetCompletion`).toBe(true);
      }
    }
  });
});
