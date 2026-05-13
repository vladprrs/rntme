import { err, ok, type Result } from './result-shim.js';
import type { ProvisionError, TargetSecrets } from './types.js';

export type DokployUpsertInput = {
  readonly appName: string;
  readonly imageRef: string;
  readonly primaryDomain: string;
  readonly ssl: 'auto' | 'manual' | 'none';
  readonly client: NonNullable<TargetSecrets['dokploy']>;
};

export async function upsertDokployApp(
  input: DokployUpsertInput,
): Promise<Result<{ appId: string; url: string }, ProvisionError>> {
  try {
    const { appId } = await input.client.upsertDockerApp({
      name: input.appName,
      image: input.imageRef,
      domain: input.primaryDomain,
      ssl: input.ssl,
    });
    return ok({ appId, url: `https://${input.primaryDomain}` });
  } catch (cause) {
    return err({
      code: 'MARKETING_SITE_PROVISION_DOMAIN_BIND_FAILED',
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    });
  }
}
