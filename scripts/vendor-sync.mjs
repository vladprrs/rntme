#!/usr/bin/env node
// Copies module.json + package.json from modules/<cat>/<vendor>/ to demo/<bp>/node_modules/<pkg>/.
// Idempotent. dist/ is gitignored and not synced.

import { copyFile, readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(process.cwd());
const MODULES_DIR = join(ROOT, 'modules');
const DEMOS_DIR = join(ROOT, 'demo');
const TRACKED_FILES = ['module.json', 'package.json'];

async function listSourceOfTruthModules() {
  const out = new Map();
  if (!existsSync(MODULES_DIR)) return out;
  for (const cat of await readdir(MODULES_DIR)) {
    const catPath = join(MODULES_DIR, cat);
    if (!(await stat(catPath)).isDirectory()) continue;
    for (const vendor of await readdir(catPath)) {
      const vendorPath = join(catPath, vendor);
      const pkgPath = join(vendorPath, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      out.set(pkg.name, vendorPath);
    }
  }
  return out;
}

async function listVendoredCopies() {
  const out = [];
  if (!existsSync(DEMOS_DIR)) return out;
  for (const demo of await readdir(DEMOS_DIR)) {
    const nm = join(DEMOS_DIR, demo, 'node_modules');
    if (!existsSync(nm)) continue;
    for (const dir of await readdir(nm)) {
      const dirPath = join(nm, dir);
      if (!(await stat(dirPath)).isDirectory()) continue;
      const pkgPath = join(dirPath, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      out.push({ demo, pkgName: pkg.name, vendoredPath: dirPath });
    }
  }
  return out;
}

async function main() {
  if (!existsSync(MODULES_DIR) || !existsSync(DEMOS_DIR)) {
    console.error('vendor:sync: must be run from workspace root (modules/ or demo/ not found)');
    process.exit(2);
  }

  const sourceMap = await listSourceOfTruthModules();
  const vendored = await listVendoredCopies();
  let synced = 0;

  for (const v of vendored) {
    const sotPath = sourceMap.get(v.pkgName);
    if (!sotPath) {
      console.warn(`skip demo/${v.demo}: ${v.pkgName} — no source-of-truth in modules/`);
      continue;
    }
    for (const file of TRACKED_FILES) {
      const sotFile = join(sotPath, file);
      const venFile = join(v.vendoredPath, file);
      if (!existsSync(sotFile)) {
        console.warn(`skip demo/${v.demo}: ${v.pkgName} — source ${file} missing`);
        continue;
      }
      await copyFile(sotFile, venFile);
      synced++;
    }
    console.log(`synced demo/${v.demo}: ${v.pkgName}`);
  }

  console.log(`vendor:sync done — ${synced} file(s) updated`);
}

main().catch((e) => {
  console.error('vendor:sync crashed:', e);
  process.exit(2);
});
