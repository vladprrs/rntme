import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runMarketingSiteConformance } from '@rntme/conformance-marketing-site';
import { provisioner } from '../src/provisioner.js';
import { makeBundle } from './unit/helpers.js';

describe('marketing-site-static conformance', () => {
  it('runs the conformance suite', async () => {
    const upserts: Array<{ name: string; image: string; domain: string }> = [];
    await runMarketingSiteConformance(provisioner, {
      buildBundle: async (files) => {
        const { bytes, sha256 } = await makeBundle(files);
        return { bytes, sha256, bucket: 'test-bucket', key: `bundles/${sha256}.tar.gz` };
      },
      fakeRegistry: { url: 'localhost:5000' },
      fakeDokploy: {
        upsertDockerApp: async (cfg) => {
          upserts.push(cfg);
          return { appId: createHash('sha1').update(cfg.name).digest('hex').slice(0, 8) };
        },
        deleteApplication: async () => {},
      },
    });

    expect(upserts.length).toBeGreaterThan(0);
  });
});
