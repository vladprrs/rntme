import { describe, expect, it } from 'bun:test';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..', '..');
const bundle = join(pkgRoot, 'build', 'main.js');

describe('ui-runtime production bundle', () => {
  it('does not contain react.development', () => {
    execSync('bun run build:client', { cwd: pkgRoot, stdio: 'inherit' });
    const src = readFileSync(bundle, 'utf8');
    expect(src.includes('react.development')).toBe(false);
    expect(src.includes('process.env.NODE_ENV')).toBe(false);
  }, 15_000);
});
