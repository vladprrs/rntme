#!/usr/bin/env bun
// Verifies that demo blueprint vendored modules match their source-of-truth in modules/<cat>/<vendor>/.
// Compared files: module.json, package.json. dist/ is gitignored and not checked.

import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(process.cwd());
const MODULES_DIR = join(ROOT, 'modules');
const DEMOS_DIR = join(ROOT, 'demo');
const TRACKED_FILES = ['module.json', 'package.json'];

function vendoredDirName(pkgName) {
  // "@rntme/identity-auth0" -> "rntme_identity_auth0"
  return pkgName.replace(/^@/, '').replaceAll('/', '_').replaceAll('-', '_');
}

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
      const dirStat = await lstat(dirPath);
      if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) continue;
      const pkgPath = join(dirPath, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      out.push({ demo, dirName: dir, pkgName: pkg.name, vendoredPath: dirPath });
    }
  }
  return out;
}

function normalize(text) {
  // Strip BOM, normalize CRLF→LF, drop trailing whitespace.
  return text.replace(/^﻿/, '').replaceAll('\r\n', '\n').replace(/[ \t]+$/gm, '');
}

async function main() {
  if (!existsSync(MODULES_DIR) || !existsSync(DEMOS_DIR)) {
    console.error('vendor:check: must be run from workspace root (modules/ or demo/ not found)');
    process.exit(2);
  }
  const sourceMap = await listSourceOfTruthModules();
  const vendored = await listVendoredCopies();
  const drift = [];

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
