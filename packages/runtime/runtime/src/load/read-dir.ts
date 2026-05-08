import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readTextFile(dir: string, name: string): string {
  try {
    return readFileSync(join(dir, name), 'utf8');
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') {
      throw new Error(`missing required file: ${name}`);
    }
    throw e;
  }
}

export function readJsonFile<T = unknown>(dir: string, name: string): T {
  return JSON.parse(readTextFile(dir, name)) as T;
}

export function readGraphsDir(dir: string): Record<string, unknown> {
  const graphsDir = join(dir, 'graphs');
  let entries: string[];
  try {
    entries = readdirSync(graphsDir);
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return {};
    throw e;
  }
  const out: Record<string, unknown> = {};
  for (const fname of entries) {
    if (!fname.endsWith('.json')) continue;
    const g = JSON.parse(readFileSync(join(graphsDir, fname), 'utf8')) as { id?: string };
    if (typeof g.id !== 'string') {
      throw new Error(`graphs/${fname}: missing string "id" field`);
    }
    out[g.id] = g;
  }
  return out;
}
