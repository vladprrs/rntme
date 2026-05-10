import { describe, it, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');
const cli = join(here, '..', '..', 'dist', 'bin', 'runtime.js');

describe('rntme-runtime validate', () => {
  it('exits 0 on a valid fixture', () => {
    const r = spawnSync(process.execPath, [cli, 'validate', join(fixtures, 'issue-tracker')]);
    if (r.status !== 0) {
      // eslint-disable-next-line no-console
      console.error(r.stderr.toString());
    }
    expect(r.status).toBe(0);
  });

  it('exits 1 on broken manifest', () => {
    const r = spawnSync(process.execPath, [cli, 'validate', join(fixtures, 'broken-manifest')]);
    expect(r.status).toBe(1);
    expect(r.stderr.toString()).toContain('MANIFEST_INVALID');
  });
});
