import { runHappyPath } from './scenarios/happy-path.js';
import { runHashMismatch } from './scenarios/hash-mismatch.js';
import { runIdempotency } from './scenarios/idempotency.js';
import type { MarketingSiteV1Config } from '@rntme/contracts-marketing-site-v1';
import type { ProvisionerContract, ProvisionerVendorError } from '@rntme/contracts-provisioner-v1';

export type BuiltBundle = {
  bytes: Buffer;
  sha256: string;
  bucket: string;
  key: string;
};

export type ConformanceDeps = {
  buildBundle: (files: Record<string, string>) => Promise<BuiltBundle> | BuiltBundle;
  fakeRegistry: { url: string };
  fakeDokploy: {
    upsertDockerApp: (cfg: { name: string; image: string; domain: string; ssl: 'auto' | 'manual' | 'none' }) => Promise<{ appId: string }>;
    deleteApplication?: (id: string) => Promise<void>;
  };
};

export type MarketingSiteProvisioner = ProvisionerContract<MarketingSiteV1Config>;
export type MarketingSiteProvisionError = ProvisionerVendorError;

export async function runMarketingSiteConformance(
  provisioner: MarketingSiteProvisioner,
  deps: ConformanceDeps,
): Promise<void> {
  await runHappyPath(provisioner, deps);
  await runIdempotency(provisioner, deps);
  await runHashMismatch(provisioner, deps);
}
