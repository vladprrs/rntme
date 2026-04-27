import { proto as common } from '@rntme/contracts-common-v1';
import { proto as identity, errorCodes } from '@rntme/contracts-identity-v1';

const ref = common.rntme.contracts.common.v1.CanonicalRef.create({
  canonical_id: '1',
  vendor_id: 'v',
  module_name: 'identity-clerk',
  module_version: '0.0.0',
  contract_version: 'v1',
});
const u = identity.rntme.contracts.identity.v1.User.create({
  ref,
  email: 'a@b',
  status: identity.rntme.contracts.identity.v1.UserStatus.USER_STATUS_ACTIVE,
});
const buf = identity.rntme.contracts.identity.v1.User.encode(u).finish();
console.log('encoded bytes:', buf.length);
console.log(
  'error code count:',
  errorCodes.structural.length + errorCodes.references.length + errorCodes.consistency.length + errorCodes.vendor.length,
);
