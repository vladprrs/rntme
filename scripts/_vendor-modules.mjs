// Shared helpers for vendor-check.mjs and vendor-sync.mjs.
// Discovers source-of-truth modules under modules/ and vendored copies under
// demo/<bp>/node_modules/, plus content normalization for byte-stable diffs.

import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

export const ROOT = resolve(process.cwd());
export const MODULES_DIR = join(ROOT, 'modules');
export const DEMOS_DIR = join(ROOT, 'demo');
export const TRACKED_FILES = ['module.json', 'package.json'];

export function vendoredDirName(pkgName) {
  // "@rntme/identity-auth0" -> "rntme_identity_auth0"
  return pkgName.replace(/^@/, '').replaceAll('/', '_').replaceAll('-', '_');
}

export async function listSourceOfTruthModules() {
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

export async function listVendoredCopies() {
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

export function normalize(text) {
  // Strip BOM, normalize CRLF→LF, drop trailing whitespace.
  return text.replace(/^﻿/, '').replaceAll('\r\n', '\n').replace(/[ \t]+$/gm, '');
}
