import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import * as tar from 'tar-stream';

export async function makeBundle(files: Record<string, string>): Promise<{ bytes: Buffer; sha256: string }> {
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  pack.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  for (const [name, contents] of Object.entries(files)) {
    await new Promise<void>((resolve, reject) => {
      pack.entry({ name, mtime: new Date(0), mode: 0o644 }, contents, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  pack.finalize();
  await new Promise<void>((resolve, reject) => {
    pack.on('end', resolve);
    pack.on('error', reject);
  });
  const bytes = gzipSync(Buffer.concat(chunks), { level: 9 });
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}
