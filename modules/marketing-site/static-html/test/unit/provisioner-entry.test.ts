import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY_PATH = resolve(__dirname, '../../dist/provisioner.entry.js');

describe('provisioner.entry.js (built artifact)', () => {
  it('exists', () => {
    expect(statSync(ENTRY_PATH).isFile()).toBe(true);
  });

  it('weighs less than 3 MB', () => {
    const size = statSync(ENTRY_PATH).size;
    expect(size).toBeLessThan(3 * 1024 * 1024);
  });

  it('contains no @rntme imports (everything inlined)', () => {
    const text = readFileSync(ENTRY_PATH, 'utf8');
    expect(text).not.toMatch(/from\s+['"]@rntme\//);
    expect(text).not.toMatch(/require\(['"]@rntme\//);
  });

  it('exports the provisioner contract', async () => {
    const mod = await import(ENTRY_PATH);
    expect(typeof mod.provisioner.provision).toBe('function');
    expect(typeof mod.provisioner.tearDown).toBe('function');
  });
});
