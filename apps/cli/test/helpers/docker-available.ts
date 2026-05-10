import { spawnSync } from 'node:child_process';

let cached: boolean | undefined;

export function dockerAvailable(): boolean {
  if (process.env['SKIP_TESTCONTAINERS'] === '1') return false;
  if (cached !== undefined) return cached;
  const info = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (info.status !== 0) {
    cached = false;
    return cached;
  }
  const run = spawnSync('docker', ['run', '--rm', 'hello-world'], { stdio: 'ignore' });
  cached = run.status === 0;
  return cached;
}
