import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function readJsonFile<T = unknown>(dir: string, name: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, name), 'utf8')) as T;
}

export async function listServiceDirs(dir: string): Promise<string[]> {
  const servicesDir = join(dir, 'services');
  let entries: string[];
  try {
    entries = await readdir(servicesDir);
  } catch {
    return [];
  }
  const stats = await Promise.all(
    entries.map(async (name) => {
      try {
        const s = await stat(join(servicesDir, name));
        return { name, isDir: s.isDirectory() };
      } catch {
        return { name, isDir: false };
      }
    }),
  );
  return stats.filter((entry) => entry.isDir).map((entry) => entry.name);
}

export function serviceDirPath(rootDir: string, slug: string): string {
  return join(rootDir, 'services', slug);
}
