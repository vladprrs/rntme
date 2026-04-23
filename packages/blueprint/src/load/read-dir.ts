import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function readJsonFile<T = unknown>(dir: string, name: string): T {
  return JSON.parse(readFileSync(join(dir, name), 'utf8')) as T;
}

export function listServiceDirs(dir: string): string[] {
  const servicesDir = join(dir, 'services');
  if (!existsSync(servicesDir)) return [];
  return readdirSync(servicesDir).filter((name) =>
    statSync(join(servicesDir, name)).isDirectory(),
  );
}

export function serviceDirPath(rootDir: string, slug: string): string {
  return join(rootDir, 'services', slug);
}
