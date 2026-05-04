import type { ModuleManifest } from '@rntme/module-skeleton';
import { DEPLOY_PROVISION_ERROR_CODES, type DeploymentProvisionError } from './errors-provision.js';
import type { ProvisionerContract, ProvisionerLog, ProvisionerOutput } from './provisioner-contract.js';
import { err, ok, type Result } from './result.js';

export type DiscoveredProvisionerModule = {
  readonly projectKey: string;
  readonly packageName: string;
  readonly manifest: ModuleManifest;
  readonly publicConfig: Readonly<Record<string, unknown>>;
  readonly priorOutputs?: ProvisionerOutput;
};

export type RunProvisionersInput = {
  readonly modules: readonly DiscoveredProvisionerModule[];
  readonly resolvedTargetSecrets: Readonly<Record<string, unknown>>;
  readonly projectDir: string;
  readonly resolveProvisioner: (
    packageName: string,
    entry: string,
    projectDir: string,
  ) => Promise<ProvisionerContract>;
  readonly log: ProvisionerLog;
  readonly defaultTimeoutMs?: number;
};

export type ProvisionedModule = {
  readonly projectKey: string;
  readonly packageName: string;
  readonly publicOutputs: Readonly<Record<string, unknown>>;
  readonly secretOutputs: Readonly<Record<string, unknown>>;
  readonly provisionedAt: string;
};

export type RunProvisionersValue = { readonly modules: readonly ProvisionedModule[] };
export type RunProvisionersResult = Result<RunProvisionersValue, DeploymentProvisionError>;

const DEFAULT_TIMEOUT_MS = 60_000;

function recoverErrorCode(
  message: string,
  defaultCode: 'DEPLOY_PROVISION_ENTRY_LOAD_FAILED',
): keyof typeof DEPLOY_PROVISION_ERROR_CODES {
  const known = ['DEPLOY_PROVISION_BUNDLE_ASSET_MISSING', 'DEPLOY_PROVISION_ENTRY_LOAD_FAILED'] as const;
  for (const code of known) {
    if (message.startsWith(`${code}:`)) return code;
  }
  return defaultCode;
}

export async function runProvisioners(input: RunProvisionersInput): Promise<RunProvisionersResult> {
  const errors: DeploymentProvisionError[] = [];
  const out: ProvisionedModule[] = [];

  for (const m of input.modules) {
    const block = m.manifest.provisioner;
    if (!block) continue;

    for (const required of block.requires ?? []) {
      if (!Object.prototype.hasOwnProperty.call(input.resolvedTargetSecrets, required.name)) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_TARGET_SECRET_MISSING,
          message: `module "${m.packageName}" requires target secret "${required.name}" (schema "${required.schema}"), but it is not configured on the deploy target`,
          module: m.packageName,
        });
      }
    }
    if (errors.length > 0) return err(errors);

    let contract: ProvisionerContract;
    try {
      contract = await input.resolveProvisioner(m.packageName, block.entry, input.projectDir);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      errors.push({
        code: DEPLOY_PROVISION_ERROR_CODES[recoverErrorCode(message, 'DEPLOY_PROVISION_ENTRY_LOAD_FAILED')],
        message,
        module: m.packageName,
      });
      return err(errors);
    }

    const requiredSecrets: Record<string, unknown> = {};
    for (const r of block.requires ?? []) {
      requiredSecrets[r.name] = (input.resolvedTargetSecrets as Record<string, unknown>)[r.name];
    }

    const timeoutMs = block.timeoutMs ?? input.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    let provisionResult: Awaited<ReturnType<ProvisionerContract['provision']>>;
    try {
      provisionResult = await Promise.race([
        contract.provision({
          publicConfig: m.publicConfig,
          targetSecrets: requiredSecrets,
          ...(m.priorOutputs !== undefined ? { priorOutputs: m.priorOutputs } : {}),
          log: (e) => input.log({ ...e, step: `provision/${m.projectKey}/${e.step}` }),
          signal: ctrl.signal,
        }),
        new Promise<never>((_, reject) => {
          ctrl.signal.addEventListener(
            'abort',
            () => reject(Object.assign(new Error('provision timed out'), { __timeout: true })),
            { once: true },
          );
        }),
      ]);
    } catch (cause) {
      const isTimeout = (cause as { __timeout?: boolean })?.__timeout === true;
      errors.push({
        code: isTimeout
          ? DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_TIMEOUT
          : DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_VENDOR_FAILED,
        message: cause instanceof Error ? cause.message : String(cause),
        module: m.packageName,
      });
      return err(errors);
    } finally {
      clearTimeout(timer);
    }

    if (!provisionResult.ok) {
      for (const e of provisionResult.errors) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_VENDOR_FAILED,
          message: `${e.code}: ${e.message}`,
          module: m.packageName,
        });
      }
      return err(errors);
    }

    const { publicOutputs, secretOutputs } = provisionResult.value;

    for (const p of block.produces) {
      const bucket = p.secret ? secretOutputs : publicOutputs;
      const wrongBucket = p.secret ? publicOutputs : secretOutputs;
      if (!(p.name in bucket)) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_OUTPUT_INVALID,
          message: `module "${m.packageName}" declared produces "${p.name}" (secret=${p.secret}) but value is missing from the ${p.secret ? 'secretOutputs' : 'publicOutputs'} bucket`,
          module: m.packageName,
        });
        continue;
      }
      if (p.name in wrongBucket) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_OUTPUT_INVALID,
          message: `module "${m.packageName}" produces "${p.name}" appears in both publicOutputs and secretOutputs; pick one bucket per produces declaration`,
          module: m.packageName,
        });
        continue;
      }
      const value = (bucket as Record<string, unknown>)[p.name];
      if (p.kind === 'many' && !Array.isArray(value)) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_OUTPUT_INVALID,
          message: `module "${m.packageName}" produces "${p.name}" declared kind=many but returned a non-array`,
          module: m.packageName,
        });
      }
      if (p.kind === 'single' && (value === null || typeof value !== 'object' || Array.isArray(value))) {
        errors.push({
          code: DEPLOY_PROVISION_ERROR_CODES.DEPLOY_PROVISION_OUTPUT_INVALID,
          message: `module "${m.packageName}" produces "${p.name}" declared kind=single but returned a non-object`,
          module: m.packageName,
        });
      }
    }

    if (errors.length > 0) return err(errors);

    out.push({
      projectKey: m.projectKey,
      packageName: m.packageName,
      publicOutputs,
      secretOutputs,
      provisionedAt: new Date().toISOString(),
    });
  }

  return ok({ modules: out });
}
