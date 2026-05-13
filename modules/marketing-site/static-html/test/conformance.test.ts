import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'bun:test';
import { buildDeterministicTarGz, hashBuffer } from '@rntme/bundle-publish';
import { runMarketingSiteConformance } from '@rntme/conformance-marketing-site';
import { provisioner } from '../src/provisioner.js';

describe('marketing-site-static conformance', () => {
  it('runs the conformance suite', async () => {
    await runMarketingSiteConformance(provisioner, {
      buildBundle: async (files) => {
        const folder = mkdtempSync(join(tmpdir(), 'mksite-conf-'));
        mkdirSync(folder, { recursive: true });
        for (const [name, contents] of Object.entries(files)) {
          writeFileSync(join(folder, name), contents);
        }
        const tarGz = await buildDeterministicTarGz(folder, [], 8 * 1024 * 1024);
        const sha256 = hashBuffer(tarGz);
        const tarDir = mkdtempSync(join(tmpdir(), 'mksite-conf-tar-'));
        const localPath = join(tarDir, 'bundle.tar.gz');
        writeFileSync(localPath, tarGz);
        return { bytes: tarGz, sha256, localPath };
      },
    });
  });
});
