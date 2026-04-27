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

export const fixtureUsers = {
  ada: id.User.create({
    ref: ref('user-ada', 'fixt_user_ada'),
    email: 'ada@example.com',
    email_verified: true,
    name: common.Name.create({ given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' }),
    status: id.UserStatus.USER_STATUS_ACTIVE,
  }),
  bob: id.User.create({
    ref: ref('user-bob', 'fixt_user_bob'),
    email: 'bob@example.com',
    email_verified: false,
    status: id.UserStatus.USER_STATUS_PENDING,
  }),
} as const;
