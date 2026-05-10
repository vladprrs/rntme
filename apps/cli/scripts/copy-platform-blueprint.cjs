#!/usr/bin/env bun
/* eslint-env node */
const { cpSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const repoRoot = join(root, '..', '..');
const src = join(repoRoot, 'apps', 'platform', 'blueprint');
const dest = join(root, 'dist', 'platform-blueprint');

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
console.log(`copied ${src} → ${dest}`);
