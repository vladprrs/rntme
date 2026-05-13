import assert from 'node:assert/strict';
import type { MarketingSiteProvisioner } from '../index.js';

export async function provisionOrThrow(
  provisioner: MarketingSiteProvisioner,
  input: Parameters<MarketingSiteProvisioner['provision']>[0],
) {
  const result = await provisioner.provision(input);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.errors));
  return result.value;
}
