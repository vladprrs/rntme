import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cliPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'bin', 'cli.js');

describe('rntme deploy/platform usage', () => {
  it('lists `deploy` in the top-level USAGE', () => {
    const result = spawnSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('deploy <blueprint-dir>');
    expect(result.stdout).toContain('platform up');
    expect(result.stdout).toContain('platform down');
  });

  it('errors with usage when `deploy` is given without --target', () => {
    const result = spawnSync(process.execPath, [cliPath, 'deploy', '/tmp/x'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--target');
  });
});
