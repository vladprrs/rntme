#!/usr/bin/env bun
// Verifies that demo blueprint vendored modules match their source-of-truth in modules/<cat>/<vendor>/.
// Compared files: module.json, package.json. dist/ is gitignored and not checked.
// Also schema-validates every discovered module.json via @rntme/contracts-module-v1.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { parseModuleManifest } from '@rntme/contracts-module-v1';

import {
  DEMOS_DIR,
  MODULES_DIR,
  TRACKED_FILES,
  listSourceOfTruthModules,
  listVendoredCopies,
  normalize,
  vendoredDirName,
} from './_vendor-modules.mjs';

function summarizeManifestErrors(errors) {
  return errors.map((e) => `${e.path}: ${e.message}`).join('; ');
}

async function validateManifest(manifestPath, { requireExists = false } = {}) {
  // Returns null when valid or (when not required) absent;
  // returns a human-readable reason string when invalid.
  if (!existsSync(manifestPath)) {
    return requireExists ? 'module.json missing' : null;
  }
  let raw;
  try {
    raw = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (e) {
    return `module.json not valid JSON: ${e.message}`;
  }
  const result = parseModuleManifest(raw);
  if (result.ok) return null;
  return `module.json invalid: ${summarizeManifestErrors(result.errors)}`;
}

async function main() {
  if (!existsSync(MODULES_DIR) || !existsSync(DEMOS_DIR)) {
    console.error('vendor:check: must be run from workspace root (modules/ or demo/ not found)');
    process.exit(2);
  }
  const sourceMap = await listSourceOfTruthModules();
  const vendored = await listVendoredCopies();
  const drift = [];

  // Schema-validate every source-of-truth module.json.
  for (const [pkgName, sotPath] of sourceMap) {
    const reason = await validateManifest(join(sotPath, 'module.json'));
    if (reason) {
      drift.push({
        demo: '<source>',
        pkg: pkgName,
        reason,
      });
    }
  }

  for (const v of vendored) {
    const expectedDirName = vendoredDirName(v.pkgName);
    if (v.dirName !== expectedDirName) {
      drift.push({
        demo: v.demo,
        pkg: v.pkgName,
        reason: `dir name "${v.dirName}" expected "${expectedDirName}"`,
      });
      continue;
    }
    // Schema-validate the vendored module.json too — required since the
    // vendoring system exists to ship manifests into demo node_modules.
    const venManifestReason = await validateManifest(join(v.vendoredPath, 'module.json'), {
      requireExists: true,
    });
    if (venManifestReason) {
      drift.push({
        demo: v.demo,
        pkg: v.pkgName,
        reason: venManifestReason,
      });
      // Keep checking other tracked files; manifest invalidity is independent of diff drift.
    }
    const sotPath = sourceMap.get(v.pkgName);
    if (!sotPath) {
      drift.push({
        demo: v.demo,
        pkg: v.pkgName,
        reason: `no source-of-truth in modules/ for package ${v.pkgName}`,
      });
      continue;
    }
    for (const file of TRACKED_FILES) {
      const sotFile = join(sotPath, file);
      const venFile = join(v.vendoredPath, file);
      if (!existsSync(sotFile) || !existsSync(venFile)) {
        drift.push({
          demo: v.demo,
          pkg: v.pkgName,
          reason: `${file} missing on ${existsSync(sotFile) ? 'vendored' : 'source'} side`,
        });
        continue;
      }
      const sotText = normalize(await readFile(sotFile, 'utf8'));
      const venText = normalize(await readFile(venFile, 'utf8'));
      if (sotText !== venText) {
        drift.push({
          demo: v.demo,
          pkg: v.pkgName,
          reason: `${file} content differs`,
        });
      }
    }
  }

  if (drift.length === 0) {
    console.log('vendor:check ok — all vendored copies in sync');
    return;
  }
  console.error('vendor:check failed:');
  for (const d of drift) {
    console.error(`  demo/${d.demo}: ${d.pkg} — ${d.reason}`);
  }
  console.error('\nrun `bun run vendor:sync` to update vendored copies.');
  process.exit(1);
}

main().catch((e) => {
  console.error('vendor:check crashed:', e);
  process.exit(2);
});
