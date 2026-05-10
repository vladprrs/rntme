import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { ProvisionerContract } from '@rntme/deploy-core';
import type { ResolveProvisioner } from '@rntme/deploy-runner';

export function createCliResolveProvisioner(): ResolveProvisioner {
  return async (packageName, entry, projectDir) => {
    const req = createRequire(`${projectDir}/package.json`);
    const resolved = req.resolve(`${packageName}/${entry}`.replace(/\\/g, '/'));
    const mod = (await import(pathToFileURL(resolved).href)) as { default?: ProvisionerContract } & ProvisionerContract;
    if (mod.default && typeof mod.default === 'object') return mod.default;
    return mod;
  };
}
