import type { Buffer } from 'node:buffer';
import { rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { materializeBundle } from '@rntme/blueprint';
import type {
  BlobStore,
  DeploymentWithProvision,
  ProjectVersion,
  SecretCipher,
} from '@rntme/platform-core';
import { isOk, parseCanonicalBundle } from '@rntme/platform-core';
import type { ProvisionerContract } from '@rntme/deploy-core';
import { runTearDownsForDeployment as runnerRunTearDowns } from '@rntme/deploy-runner';

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
 * Platform-http adapter for runTearDownsForDeployment.
 *
 * Keeps the DB-bound signature (`deployment`, `projectVersion`, `deps`) so that
 * `project-delete-executor.ts` does not need to change. Internally it:
 *   1. Fetches the bundle blob.
 *   2. Decompresses and parses the canonical bundle.
 *   3. Materializes the bundle to a temp directory.
 *   4. Decrypts the secret envelope (if present).
 *   5. Delegates to the pure runner function in @rntme/deploy-runner.
 *   6. Removes the temp directory in a finally block.
 */
export async function runTearDownsForDeployment(input: {
  deployment: DeploymentWithProvision;
  projectVersion: Pick<ProjectVersion, 'bundleBlobKey'>;
  deps: TearDownDeps;
}): Promise<{ ok: true } | { ok: false; errors: ReadonlyArray<{ message: string }> }> {
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

  let bundleBytes: Buffer;
  try {
    bundleBytes = gunzipSync(rawResult.value);
  } catch (cause) {
    return {
      ok: false,
      errors: [{ message: `tearDown: failed to decompress bundle: ${(cause as Error).message}` }],
    };
  }

  const parsedBundle = parseCanonicalBundle(bundleBytes);
  if (!isOk(parsedBundle)) {
    return {
      ok: false,
      errors: [{
        message: `tearDown: invalid bundle: ${parsedBundle.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`,
      }],
    };
  }

  let tmpDir: string | null = null;
  try {
    try {
      tmpDir = await materializeBundle(parsedBundle.value.bundle);
    } catch (cause) {
      return {
        ok: false,
        errors: [{ message: `tearDown: failed to materialize bundle: ${(cause as Error).message}` }],
      };
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
      } catch (cause) {
        return {
          ok: false,
          errors: [{ message: `tearDown: secret envelope decryption failed: ${(cause as Error).message}` }],
        };
      }
    }

    return await runnerRunTearDowns({
      bundleDir: tmpDir,
      priorProvisionPublic: deployment.provisionResult.modules,
      priorProvisionSecrets: secretEnvelope.modules,
      deps: { resolveProvisioner: deps.resolveProvisioner },
    });
  } finally {
    if (tmpDir !== null) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
