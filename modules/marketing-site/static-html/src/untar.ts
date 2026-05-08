import { mkdtempSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as tar from 'tar-stream';
import { err, ok, type Result } from './result-shim.js';
import type { ProvisionError } from './types.js';

export async function untarToDir(gz: Buffer): Promise<Result<{ dir: string; hasIndex: boolean }, ProvisionError>> {
  const tarBuf = gunzipSync(gz);
  const dir = mkdtempSync(join(tmpdir(), 'mksite-'));
  let hasIndex = false;

  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      if (header.type !== 'file') {
        stream.resume();
        stream.on('end', next);
        return;
      }

      const normalized = normalize(header.name).replace(/\\/g, '/');
      if (normalized.startsWith('../') || normalized.startsWith('/')) {
        stream.resume();
        stream.on('end', () => reject(new Error(`unsafe tar path: ${header.name}`)));
        return;
      }

      const target = join(dir, normalized);
      if (normalized === 'index.html') hasIndex = true;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on('end', () => {
        mkdir(dirname(target), { recursive: true })
          .then(() => writeFile(target, Buffer.concat(chunks)))
          .then(() => next())
          .catch(reject);
      });
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    extract.end(tarBuf);
  });

  if (!hasIndex) {
    return err({ code: 'MARKETING_SITE_PROVISION_INDEX_HTML_MISSING', message: 'bundle missing index.html' });
  }
  return ok({ dir, hasIndex });
}
