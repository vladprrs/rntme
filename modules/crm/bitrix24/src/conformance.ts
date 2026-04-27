import { suite as crmConformanceSuite } from '@rntme/conformance-crm';
import { BITRIX24_SUPPORTED_RPCS } from './capabilities.js';
import type { CategoryConformanceSuite } from '@rntme/conformance-crm';

export const bitrix24MockConformanceSuite: CategoryConformanceSuite = {
  category: crmConformanceSuite.category,
  contract_version: crmConformanceSuite.contract_version,
  scenarios: Object.fromEntries(BITRIX24_SUPPORTED_RPCS.map((rpc) => [rpc, crmConformanceSuite.scenarios[rpc] ?? []])),
};
