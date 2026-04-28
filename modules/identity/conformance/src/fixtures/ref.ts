import { proto } from '@rntme/contracts-identity-v1';

const common = proto.rntme.contracts.common.v1;

export const CONFORMANCE_IDENTITY_MODULE_VERSION = '1.0.0';

export function fixtureRef(canonicalId: string, vendorId: string) {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'identity-fixture',
    module_version: CONFORMANCE_IDENTITY_MODULE_VERSION,
    contract_version: 'v1',
  });
}
