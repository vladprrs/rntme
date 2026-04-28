import { proto } from '@rntme/contracts-identity-v1';
import { fixtureRef } from './ref.js';

const id = proto.rntme.contracts.identity.v1;

export const fixtureOrganizations = {
  acme: id.Organization.create({
    ref: fixtureRef('org-acme', 'fixt_org_acme'),
    name: 'Acme',
    slug: 'acme',
    max_members: 50,
    status: id.OrgStatus.ORG_STATUS_ACTIVE,
  }),
  initech: id.Organization.create({
    ref: fixtureRef('org-initech', 'fixt_org_initech'),
    name: 'Initech',
    slug: 'initech',
    max_members: 0,
    status: id.OrgStatus.ORG_STATUS_ACTIVE,
  }),
} as const;
