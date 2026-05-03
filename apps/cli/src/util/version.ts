import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function readPackageJsonVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, '..', '..', 'package.json');
  const raw = readFileSync(pkgPath, 'utf8');
  const parsed = JSON.parse(raw) as { version?: unknown };
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error('apps/cli/package.json has no version');
  }
  return parsed.version;
}

export const CLI_VERSION = readPackageJsonVersion();
