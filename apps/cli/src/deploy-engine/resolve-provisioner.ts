import { buildResolveProvisioner, type ResolveProvisioner } from '@rntme/deploy-runner';

export function createCliResolveProvisioner(): ResolveProvisioner {
  return buildResolveProvisioner({
    manifestPath: '.provisioners/manifest.json',
    errorCodePrefix: 'CLI_DEPLOY_PROVISIONER',
  });
}
