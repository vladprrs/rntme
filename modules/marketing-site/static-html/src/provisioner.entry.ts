import type { ProvisionerEnvMapping } from '@rntme/contracts-provisioner-v1';

export { provisioner } from './provisioner.js';

export const ENV_MAPPINGS: ProvisionerEnvMapping = {
  'marketing-site': [
    { from: 'url', envName: 'MARKETING_URL', secret: false, target: 'app' },
  ],
};
