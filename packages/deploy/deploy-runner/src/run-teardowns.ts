import { discoverModules } from '@rntme/blueprint';
import type { ProvisionerContract } from '@rntme/deploy-core';

type ResolveProvisionerFn = (
  packageName: string,
  entry: string,
  projectDir: string,
) => Promise<ProvisionerContract>;

export type TearDownDeps = {
  readonly resolveProvisioner: ResolveProvisionerFn;
};

export type TearDownInput = {
  /** Already-materialized bundle directory on disk. */
  readonly bundleDir: string;
  /** Public provision outputs keyed by module project key. */
  readonly priorProvisionPublic: Readonly<
    Record<string, { publicOutputs: Readonly<Record<string, unknown>> }>
  >;
  /** Decrypted secret provision outputs keyed by module project key. */
  readonly priorProvisionSecrets: Readonly<
    Record<string, { secretOutputs: Readonly<Record<string, unknown>> }>
  >;
  readonly deps: TearDownDeps;
  readonly abortSignal?: AbortSignal;
};

/**
 * For each module entry in `priorProvisionPublic`, resolve the provisioner
 * and call `contract.tearDown`. Operates on a pre-materialized bundle directory
 * with pre-decrypted secret data — all I/O (blob fetch, decompress, parse,
 * materialize, decrypt) is handled by the caller.
 *
 * Returns `{ ok: true }` when all tearDowns succeed (or there is nothing to tear down).
 * Returns `{ ok: false; errors }` when one or more tearDowns fail.
 */
export async function runTearDownsForDeployment(
  input: TearDownInput,
): Promise<{ ok: true } | { ok: false; errors: ReadonlyArray<{ message: string }> }> {
  const moduleEntries = Object.entries(input.priorProvisionPublic);
  if (moduleEntries.length === 0) return { ok: true };

  // Discover modules from the materialized project directory.
  const discovered = await discoverModules({ projectDir: input.bundleDir });
  if (!discovered.ok) {
    return {
      ok: false,
      errors: [
        {
          message: `tearDown: module discovery failed: ${discovered.errors[0]?.code ?? 'unknown'}: ${discovered.errors[0]?.message ?? ''}`,
        },
      ],
    };
  }

  const errors: Array<{ message: string }> = [];
  const signal = input.abortSignal ?? new AbortController().signal;

  for (const [moduleKey, moduleResult] of moduleEntries) {
    // Find the matching discovered module for this project key.
    const discoveredEntry = Object.values(discovered.value).find((d) => d.projectKey === moduleKey);
    if (!discoveredEntry) continue;

    const provisioner = discoveredEntry.manifest.provisioner;
    if (!provisioner) continue;

    let contract: ProvisionerContract;
    try {
      contract = await input.deps.resolveProvisioner(
        discoveredEntry.manifest.name,
        provisioner.entry,
        input.bundleDir,
      );
    } catch (cause) {
      errors.push({
        message: `tearDown[${moduleKey}]: resolveProvisioner failed: ${(cause as Error).message}`,
      });
      continue;
    }

    if (typeof contract.tearDown !== 'function') {
      // Module does not implement tearDown — skip.
      continue;
    }

    const publicOutputs = moduleResult.publicOutputs ?? {};
    const secretOutputs = input.priorProvisionSecrets[moduleKey]?.secretOutputs ?? {};

    try {
      const result = await contract.tearDown({
        publicConfig: discoveredEntry.publicConfig,
        targetSecrets: {},
        priorOutputs: { publicOutputs, secretOutputs },
        log: () => undefined,
        signal,
      });
      if (!result.ok) {
        errors.push({
          message: `tearDown[${moduleKey}]: ${result.errors[0]?.code ?? 'TEARDOWN_FAILED'}: ${result.errors[0]?.message ?? ''}`,
        });
      }
    } catch (cause) {
      errors.push({ message: `tearDown[${moduleKey}]: threw: ${(cause as Error).message}` });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
