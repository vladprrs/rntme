import { runHappyPath } from './scenarios/happy-path.js';
import { runHashMismatch } from './scenarios/hash-mismatch.js';
import { runIdempotency } from './scenarios/idempotency.js';
import type { MarketingSiteV1Config } from '@rntme/contracts-marketing-site-v1';
import type { ProvisionerContract, ProvisionerVendorError } from '@rntme/contracts-provisioner-v1';

/**
 * BuiltBundle describes a materialized project-folder asset on disk. The
 * conformance suite no longer requires bucket/key — the canonical contract
 * path is target-agnostic and consumes a local tar.gz path that the
 * deploy-runner has already produced.
 */
export type BuiltBundle = {
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly localPath: string;
};

export type ConformanceDeps = {
  readonly buildBundle: (files: Record<string, string>) => Promise<BuiltBundle> | BuiltBundle;
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
