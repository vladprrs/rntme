import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import * as tar from 'tar-stream';
import { walkFolder } from './walk.js';

export async function buildDeterministicTarGz(
  folder: string,
  ignore: readonly string[],
  maxBytes = 50 * 1024 * 1024,
): Promise<Buffer> {
  const { entries } = await walkFolder(folder, ignore, maxBytes);
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  pack.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

  for (const entry of entries) {
    const contents = await readFile(entry.absPath);
    await new Promise<void>((resolve, reject) => {
      pack.entry(
        {
          name: entry.relPath,
          size: contents.length,
          mtime: new Date(0),
          mode: 0o644,
          uid: 0,
          gid: 0,
          uname: '',
          gname: '',
          type: 'file',
        },
        contents,
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
    });
  }

  pack.finalize();
  await new Promise<void>((resolve, reject) => {
    pack.on('end', resolve);
    pack.on('error', reject);
  });

  return gzipSync(Buffer.concat(chunks), { level: 9 });
}
