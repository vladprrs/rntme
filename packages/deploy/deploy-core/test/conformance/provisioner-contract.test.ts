import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModuleManifest } from '@rntme/contracts-module-v1';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const MODULES_ROOT = join(HERE, '..', '..', '..', '..', '..', 'modules');

function listModules(): { dir: string; manifest: ReturnType<typeof parseModuleManifest> }[] {
  const out: { dir: string; manifest: ReturnType<typeof parseModuleManifest> }[] = [];
  if (!existsSync(MODULES_ROOT)) return out;
  for (const category of readdirSync(MODULES_ROOT)) {
    const categoryDir = join(MODULES_ROOT, category);
    let entries: string[];
    try {
      entries = readdirSync(categoryDir);
    } catch {
      continue;
    }
    for (const vendor of entries) {
      const moduleJson = join(categoryDir, vendor, 'module.json');
      if (!existsSync(moduleJson)) continue;
      const raw = JSON.parse(readFileSync(moduleJson, 'utf8'));
      out.push({ dir: join(categoryDir, vendor), manifest: parseModuleManifest(raw) });
    }
  }
  return out;
}

describe('Provisioner conformance', () => {
  const modules = listModules();
  const withProvisioner = modules.filter((m) => m.manifest.ok && m.manifest.value.provisioner);

  if (withProvisioner.length === 0) {
    it('no modules declare a provisioner block (suite is a no-op)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const m of withProvisioner) {
    if (!m.manifest.ok) continue;
    const manifest = m.manifest.value;
    const provisioner = manifest.provisioner;
    if (!provisioner) continue;

    it(`${manifest.name} exports a provision() function from its provisioner entry`, async () => {
      const entryPath = join(m.dir, provisioner.entry);
      expect(existsSync(entryPath), `provisioner entry must exist at ${entryPath}`).toBe(true);
      const moduleExports = (await import(entryPath)) as Record<string, unknown>;
      expect(typeof moduleExports.provision).toBe('function');
      if ('tearDown' in moduleExports) {
        expect(typeof moduleExports.tearDown).toBe('function');
      }
    });

    it(`${manifest.name} provision() returns a Result for invalid input rather than throwing`, async () => {
      const entryPath = join(m.dir, provisioner.entry);
      const moduleExports = (await import(entryPath)) as {
        provision: (input: unknown) => Promise<{ ok: boolean }>;
      };
      // Inject a stub fetch so the conformance test does not hit the network for
      // modules that talk to a third-party API. Stub returns 401 from any call,
      // which the provisioner should map to a Result Err rather than throwing.
      const stubFetch = async (): Promise<globalThis.Response> =>
        new globalThis.Response('{"error":"stub"}', { status: 401 });
      let result: unknown;
      try {
        result = await moduleExports.provision({
          publicConfig: {},
          targetSecrets: {},
          log: () => undefined,
          signal: new AbortController().signal,
          fetch: stubFetch,
        });
      } catch (cause) {
        throw new Error(`provision() threw instead of returning Result: ${String(cause)}`);
      }
      expect(result).toHaveProperty('ok');
      expect(typeof (result as { ok: unknown }).ok).toBe('boolean');
    });
  }
});
