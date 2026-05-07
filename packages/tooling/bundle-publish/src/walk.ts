import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

export type WalkEntry = {
  absPath: string;
  relPath: string;
  size: number;
};

export async function walkFolder(
  root: string,
  ignore: readonly string[],
  maxBytes: number,
): Promise<{ entries: WalkEntry[]; totalBytes: number }> {
  const matchers = ignore.map(toRegex);
  const entries: WalkEntry[] = [];
  let totalBytes = 0;

  async function recurse(dir: string): Promise<void> {
    const names = await readdir(dir);
    for (const name of names) {
      const absPath = join(dir, name);
      const relPath = relative(root, absPath).replace(/\\/g, '/');
      if (matchers.some((matcher) => matcher.test(relPath))) continue;

      const st = await stat(absPath);
      if (st.isDirectory()) {
        await recurse(absPath);
        continue;
      }
      if (!st.isFile()) continue;

      totalBytes += st.size;
      if (totalBytes > maxBytes) throw new Error('BUNDLE_PUBLISH_TOO_LARGE');
      entries.push({ absPath, relPath, size: st.size });
    }
  }

  await recurse(root);
  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { entries, totalBytes };
}

function toRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .replace(/\0/g, '.*');
  return new RegExp(`^${escaped}$`);
}
