// test/unit/types/error-coverage.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERROR_CODES } from '../../../src/types/result.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..', '..', '..', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('error code coverage', () => {
  const allText = walk(srcRoot).map((p) => readFileSync(p, 'utf8')).join('\n');

  it('does not throw generic Error directly from src', () => {
    expect(allText).not.toContain('throw new Error');
    expect(allText).not.toContain('Object.assign(new Error');
  });

  for (const code of Object.keys(ERROR_CODES)) {
    it(`references ${code} somewhere in src`, () => {
      expect(allText.includes(code)).toBe(true);
    });
  }
});
