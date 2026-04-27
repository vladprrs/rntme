/**
 * URLs for the local binary fixtures. The mock-vendor accepts file:// URLs;
 * live-vendor runs upload via vendor file APIs and substitute the vendor_file_id.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export const samplePngPath = resolve(here, 'sample.png');
export const sampleMp3Path = resolve(here, 'sample.mp3');
export const samplePdfPath = resolve(here, 'sample.pdf');

export const samplePngUrl = `file://${samplePngPath}`;
export const sampleMp3Url = `file://${sampleMp3Path}`;
export const samplePdfUrl = `file://${samplePdfPath}`;
