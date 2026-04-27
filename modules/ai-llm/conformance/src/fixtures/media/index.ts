/**
 * URLs for the local binary fixtures. The mock-vendor accepts file:// URLs;
 * live-vendor runs upload via vendor file APIs and substitute the vendor_file_id.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function fixturePath(filename: string): string {
  const localPath = resolve(here, filename);
  if (existsSync(localPath)) return localPath;
  return resolve(here, '../../../src/fixtures/media', filename);
}

export const samplePngPath = fixturePath('sample.png');
export const sampleMp3Path = fixturePath('sample.mp3');
export const samplePdfPath = fixturePath('sample.pdf');

export const samplePngUrl = pathToFileURL(samplePngPath).href;
export const sampleMp3Url = pathToFileURL(sampleMp3Path).href;
export const samplePdfUrl = pathToFileURL(samplePdfPath).href;
