import { rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { discoverModules } from '@rntme/blueprint';
import type {
  BlobStore,
  CanonicalBundle,
  DeploymentWithProvision,
  ProjectVersion,
  SecretCipher,
} from '@rntme/platform-core';
import { isOk } from '@rntme/platform-core';
import type { ProvisionerContract } from '@rntme/deploy-core';
import { materializeBundle } from './executor.js';

export type TearDownDeps = {
  readonly blob: BlobStore;
  readonly secretCipher: SecretCipher;
  readonly resolveProvisioner: (
    packageName: string,
    entry: string,
    projectDir: string,
  ) => Promise<ProvisionerContract>;
};

/**
 * For each module entry in `deployment.provisionResult`, resolve the provisioner
 * and call `contract.tearDown`. Runs BEFORE Dokploy resource deletion so that
 * external state (e.g. Auth0 clients) is cleaned up before infra is removed.
 *
 * Returns `{ ok: true }` when all tearDowns succeed (or there is nothing to tear down).
 * Returns `{ ok: false; errors }` when one or more tearDowns fail; callers should
 * treat this as a failure and skip Dokploy deletion for the affected target.
 */
export async function runTearDownsForDeployment(input: {
  deployment: DeploymentWithProvision;
  projectVersion: Pick<ProjectVersion, 'bundleBlobKey'>;
  deps: TearDownDeps;
}): Promise<{ ok: true } | { ok: false; errors: Array<{ message: string }> }> {
  const { deployment, projectVersion, deps } = input;

  // Nothing to tear down — skip.
  if (deployment.provisionResult === null) return { ok: true };

  const moduleEntries = Object.entries(deployment.provisionResult.modules);
  if (moduleEntries.length === 0) return { ok: true };

  // Fetch the bundle blob and decompress.
  const rawResult = await deps.blob.getRaw(projectVersion.bundleBlobKey);
  if (!isOk(rawResult)) {
    return {
      ok: false,
      errors: [{ message: `tearDown: failed to fetch bundle blob: ${rawResult.errors[0]?.message ?? 'unknown'}` }],
    };
  }

  let bundle: CanonicalBundle;
  try {
    bundle = JSON.parse(gunzipSync(rawResult.value).toString('utf8')) as CanonicalBundle;
  } catch (cause) {
    return {
      ok: false,
      errors: [{ message: `tearDown: failed to parse bundle: ${(cause as Error).message}` }],
    };
  }

  let tmpDir: string | null = null;
  try {
    tmpDir = await materializeBundle(bundle);

    // Discover modules from the materialized project directory.
    const discovered = discoverModules({ projectDir: tmpDir });
    if (!discovered.ok) {
      // No provisioner modules found — nothing to tear down.
      return { ok: true };
    }

    // Decrypt secret outputs envelope if present.
    let secretEnvelope: { modules: Record<string, { secretOutputs: Record<string, unknown> }> } = { modules: {} };
    if (
      deployment.provisionResultCiphertext !== null &&
      deployment.provisionResultNonce !== null &&
      deployment.provisionResultKeyVersion !== null
    ) {
      try {
        const decrypted = deps.secretCipher.decrypt({
          ciphertext: deployment.provisionResultCiphertext,
          nonce: deployment.provisionResultNonce,
          keyVersion: deployment.provisionResultKeyVersion,
        });
        secretEnvelope = JSON.parse(decrypted) as typeof secretEnvelope;
      } catch {
        // Non-fatal: proceed with empty secret outputs.
        secretEnvelope = { modules: {} };
      }
    }

    const errors: Array<{ message: string }> = [];
    const signal = new AbortController().signal;

    for (const [moduleKey, moduleResult] of moduleEntries) {
      // Find the matching discovered module for this project key.
      const discoveredEntry = Object.values(discovered.value).find((d) => d.projectKey === moduleKey);
      if (!discoveredEntry) continue;

      const provisioner = discoveredEntry.manifest.provisioner;
      if (!provisioner) continue;

      let contract: ProvisionerContract;
      try {
        contract = await deps.resolveProvisioner(
          discoveredEntry.manifest.name,
          provisioner.entry,
          tmpDir,
        );
      } catch (cause) {
        errors.push({ message: `tearDown[${moduleKey}]: resolveProvisioner failed: ${(cause as Error).message}` });
        continue;
      }

      if (typeof contract.tearDown !== 'function') {
        // Module does not implement tearDown — skip.
        continue;
      }

      const publicOutputs = moduleResult.publicOutputs ?? {};
      const secretOutputs = secretEnvelope.modules[moduleKey]?.secretOutputs ?? {};

      try {
        const result = await contract.tearDown({
          publicConfig: discoveredEntry.publicConfig,
          targetSecrets: {},
          priorOutputs: { publicOutputs, secretOutputs },
          log: () => undefined,
          signal,
        });
        if (!result.ok) {
          errors.push({ message: `tearDown[${moduleKey}]: ${result.errors[0]?.code ?? 'TEARDOWN_FAILED'}: ${result.errors[0]?.message ?? ''}` });
        }
      } catch (cause) {
        errors.push({ message: `tearDown[${moduleKey}]: threw: ${(cause as Error).message}` });
      }
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true };
  } finally {
    if (tmpDir !== null) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
