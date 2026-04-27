import { identityConformanceSuite } from '@rntme/conformance-identity';
import { CLAIMED_RPCS } from './capabilities.js';
import type { CategoryConformanceSuite } from '@rntme/conformance-identity';

export const auth0MockConformanceSuite: CategoryConformanceSuite = {
  category: identityConformanceSuite.category,
  contractVersion: identityConformanceSuite.contractVersion,
  scenariosByRpc: Object.fromEntries(
    CLAIMED_RPCS.map((rpc) => [rpc, identityConformanceSuite.scenariosByRpc[rpc] ?? []]),
  ),
};
