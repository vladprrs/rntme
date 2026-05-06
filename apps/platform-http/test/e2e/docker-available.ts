import { spawnSync } from 'node:child_process';

let cached: boolean | undefined;

/** True when a container runtime can actually start containers for testcontainers. */
export function e2eContainersAvailable(): boolean {
  if (process.env['PLATFORM_TEST_DATABASE_URL'] && hasExternalS3()) return true;
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

function hasExternalS3(): boolean {
  return Boolean(
    process.env['PLATFORM_TEST_S3_ENDPOINT'] &&
      process.env['PLATFORM_TEST_S3_BUCKET'] &&
      process.env['PLATFORM_TEST_S3_ACCESS_KEY_ID'] &&
      process.env['PLATFORM_TEST_S3_SECRET_ACCESS_KEY'],
  );
}
