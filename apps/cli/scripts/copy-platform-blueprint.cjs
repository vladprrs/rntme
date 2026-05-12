#!/usr/bin/env bun
/* eslint-env node */
const { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const repoRoot = join(root, '..', '..');
const src = join(repoRoot, 'apps', 'platform', 'blueprint');
const dest = join(root, 'dist', 'platform-blueprint');
const provisionerDest = join(dest, '.provisioners');

if (!existsSync(src)) {
  console.error(`platform blueprint source not found: ${src}`);
  process.exit(1);
}

cpSync(src, dest, {
  recursive: true,
  filter: (entry) => {
    const rel = entry.slice(src.length + 1);
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
    if (rel === 'test' || rel.startsWith('test/')) return false;
    if (rel === 'dist' || rel.startsWith('dist/')) return false;
    return true;
  },
});
copyProvisionerEntries();
console.log(`copied ${src} → ${dest}`);

function copyProvisionerEntries() {
  rmSync(provisionerDest, { recursive: true, force: true });
  mkdirSync(provisionerDest, { recursive: true });

  const entries = {};
  const modulesRoot = join(src, 'node_modules');
  if (!existsSync(modulesRoot)) {
    writeManifest(entries);
    return;
  }

  const packageDirs = discoverWorkspacePackageDirs(repoRoot);
  for (const dirent of readdirSync(modulesRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const moduleJsonPath = join(modulesRoot, dirent.name, 'module.json');
    if (!existsSync(moduleJsonPath)) continue;

    const manifest = JSON.parse(readFileSync(moduleJsonPath, 'utf8'));
    const packageName = manifest.name;
    const entry = manifest.provisioner?.entry;
    if (typeof packageName !== 'string' || typeof entry !== 'string') continue;

    const packageDir = packageDirs.get(packageName);
    if (packageDir === undefined) {
      throw new Error(`workspace package not found for platform provisioner ${packageName}`);
    }

    const entryRel = entry.replace(/^\.\//, '');
    const source = join(packageDir, entryRel);
    if (!existsSync(source)) {
      throw new Error(`provisioner entry not built for ${packageName}: ${source}`);
    }

    const safePackage = packageName.replace(/^@/, '').replace(/[^\w.-]+/g, '__');
    const targetRel = `.provisioners/${safePackage}/${entryRel.split('/').pop()}`;
    const target = join(dest, targetRel);
    mkdirSync(join(provisionerDest, safePackage), { recursive: true });
    cpSync(source, target);
    entries[`${packageName}::${entry}`] = targetRel;
  }

  writeManifest(entries);
}

function writeManifest(entries) {
  writeFileSync(join(provisionerDest, 'manifest.json'), `${JSON.stringify({ entries }, null, 2)}\n`);
}

function discoverWorkspacePackageDirs(workspaceRoot) {
  const dirs = new Map();
  for (const parent of ['packages', 'modules']) {
    collectPackageDirs(join(workspaceRoot, parent), dirs);
  }
  return dirs;
}

function collectPackageDirs(dir, output) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    const packageJsonPath = join(path, 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (typeof pkg.name === 'string') output.set(pkg.name, path);
      continue;
    }
    collectPackageDirs(path, output);
  }
}
