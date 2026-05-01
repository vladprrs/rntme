import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function readTextFile(dir: string, name: string): string {
  const path = join(dir, name);
  if (!existsSync(path)) {
    throw new Error(`missing required file: ${name}`);
  }
  return readFileSync(path, 'utf8');
}

export function readJsonFile<T = unknown>(dir: string, name: string): T {
  return JSON.parse(readTextFile(dir, name)) as T;
}

export function readGraphsDir(dir: string): Record<string, unknown> {
  const graphsDir = join(dir, 'graphs');
  if (!existsSync(graphsDir)) return {};
  const out: Record<string, unknown> = {};
  for (const fname of readdirSync(graphsDir)) {
    if (!fname.endsWith('.json')) continue;
    const g = JSON.parse(readFileSync(join(graphsDir, fname), 'utf8')) as { id?: string };
    if (typeof g.id !== 'string') {
      throw new Error(`graphs/${fname}: missing string "id" field`);
    }
    out[g.id] = g;
  }
  return out;
}
