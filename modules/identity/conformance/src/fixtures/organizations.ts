import { proto } from '@rntme/contracts-identity-v1';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

function ref(canonicalId: string, vendorId: string) {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'identity-fixture',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

export const fixtureOrganizations = {
  acme: id.Organization.create({
    ref: ref('org-acme', 'fixt_org_acme'),
    name: 'Acme',
    slug: 'acme',
    max_members: 50,
    status: id.OrgStatus.ORG_STATUS_ACTIVE,
  }),
  initech: id.Organization.create({
    ref: ref('org-initech', 'fixt_org_initech'),
    name: 'Initech',
    slug: 'initech',
    max_members: 0,
    status: id.OrgStatus.ORG_STATUS_ACTIVE,
  }),
} as const;
