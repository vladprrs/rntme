import { proto as common } from '@rntme/contracts-common-v1';
import { proto as crm, errorCodes } from '@rntme/contracts-crm-v1';

const ref = common.rntme.contracts.common.v1.CanonicalRef.create({
  canonical_id: 'deal_01',
  vendor_id: 'v',
  module_name: 'module-crm-bitrix24',
  module_version: '0.0.0',
  contract_version: 'v1',
});

const deal = crm.rntme.contracts.crm.v1.Deal.create({
  ref,
  name: 'Import smoke',
  status: crm.rntme.contracts.crm.v1.DealStatus.DEAL_STATUS_OPEN,
});
const buf = crm.rntme.contracts.crm.v1.Deal.encode(deal).finish();
console.log('encoded bytes:', buf.length);
console.log('error code count:', Object.values(errorCodes).reduce((sum, codes) => sum + codes.length, 0));
