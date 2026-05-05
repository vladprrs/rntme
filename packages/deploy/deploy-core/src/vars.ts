import { err, ok, type Result } from './result.js';
import type { DeploymentPlanError } from './errors.js';
import type { ProjectDeploymentConfig } from './config.js';

export type VarBinding = Readonly<{ from: string; required: boolean }>;
export type VarsManifest = Readonly<Record<string, VarBinding>>;
export type ResolvedVars = Readonly<Record<string, string>>;

export type TargetForVars = {
  readonly slug: string;
  readonly auth?: Record<string, Record<string, unknown>>;
  readonly modules?: Record<string, Record<string, unknown>>;
  readonly eventBus?: Record<string, unknown>;
};

export function targetForVars(
  config: ProjectDeploymentConfig,
  fallbackSlug: string,
): TargetForVars {
  return {
    slug: config.targetSlug ?? fallbackSlug,
    ...(config.auth === undefined ? {} : { auth: config.auth }),
    ...(config.modules === undefined ? {} : { modules: config.modules }),
    ...(config.eventBus === undefined ? {} : { eventBus: config.eventBus }),
  };
}

export type ProvisionResultForVars = {
  readonly modules: Readonly<Record<string, {
    readonly publicOutputs: Readonly<Record<string, unknown>>;
  }>>;
};

export type DiscoveredModulesForVars = Readonly<Record<string, {
  /** module.json `provisioner.produces[*].name` whitelist for validation. */
  readonly producesNames: readonly string[];
}>>;

export type ResolveVarsOptions = {
  readonly provisionResult?: ProvisionResultForVars;
  readonly discoveredModules?: DiscoveredModulesForVars;
};

const PLACEHOLDER_RE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

export function resolveVars(
  manifest: VarsManifest,
  target: TargetForVars,
  options: ResolveVarsOptions = {},
): Result<ResolvedVars> {
  const errors: DeploymentPlanError[] = [];
  const out: Record<string, string> = {};

  for (const [name, binding] of Object.entries(manifest)) {
    const r = readPath(target, binding.from, name, options);
    if (r.kind === 'error') {
      errors.push(r.error);
      continue;
    }
    const value = r.value;
    if (value === undefined || value === '') {
      if (binding.required) {
        errors.push({
          code: 'DEPLOY_PLAN_TARGET_VAR_MISSING',
          message: `vars.${name}: target ${target.slug} does not provide "${binding.from}"`,
          varName: name,
          fromPath: binding.from,
          targetSlug: target.slug,
        });
      }
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      errors.push({
        code: 'DEPLOY_PLAN_VAR_FROM_PATH_INVALID',
        message: `vars.${name}: target ${target.slug} value at "${binding.from}" is not a primitive`,
        varName: name,
        fromPath: binding.from,
        targetSlug: target.slug,
      });
      continue;
    }
    out[name] = String(value);
  }

  if (errors.length > 0) return err(errors);
  return ok(out);
}

type ReadPathResult =
  | { kind: 'value'; value: unknown }
  | { kind: 'error'; error: DeploymentPlanError };

function readPath(
  target: TargetForVars,
  path: string,
  varName: string,
  options: ResolveVarsOptions,
): ReadPathResult {
  const segments = path.split('.');

  if (segments[0] === 'target') {
    let cursor: unknown = target;
    for (const seg of segments.slice(1)) {
      if (cursor === null || typeof cursor !== 'object') {
        return { kind: 'value', value: undefined };
      }
      cursor = (cursor as Record<string, unknown>)[seg];
    }
    return { kind: 'value', value: cursor };
  }

  if (segments[0] === 'provision') {
    if (segments.length < 3) {
      return {
        kind: 'error',
        error: {
          code: 'BLUEPRINT_VAR_PROVISION_PATH_INVALID',
          message: `vars.${varName}: provision path must be "provision.<moduleKey>.<output>[.<...>]", got "${path}"`,
          varName,
          fromPath: path,
          targetSlug: target.slug,
        },
      };
    }
    const moduleKey = segments[1]!;
    const outputName = segments[2]!;
    const jsonPointer = segments.slice(3);

    const discoveredEntry = options.discoveredModules?.[moduleKey];
    if (options.discoveredModules !== undefined && discoveredEntry === undefined) {
      return {
        kind: 'error',
        error: {
          code: 'BLUEPRINT_VAR_PROVISION_MODULE_MISSING',
          message: `vars.${varName}: module key "${moduleKey}" is not declared in project.json#modules`,
          varName,
          fromPath: path,
          targetSlug: target.slug,
        },
      };
    }

    if (
      discoveredEntry !== undefined &&
      !discoveredEntry.producesNames.includes(outputName)
    ) {
      return {
        kind: 'error',
        error: {
          code: 'BLUEPRINT_VAR_PROVISION_OUTPUT_NOT_DECLARED',
          message: `vars.${varName}: module "${moduleKey}" provisioner does not declare output "${outputName}"`,
          varName,
          fromPath: path,
          targetSlug: target.slug,
        },
      };
    }

    const moduleResult = options.provisionResult?.modules[moduleKey];
    if (moduleResult === undefined) {
      return {
        kind: 'error',
        error: {
          code: 'BLUEPRINT_VAR_PROVISION_OUTPUT_MISSING',
          message: `vars.${varName}: provisioner did not run or produced no output for module "${moduleKey}"`,
          varName,
          fromPath: path,
          targetSlug: target.slug,
        },
      };
    }

    let cursor: unknown = moduleResult.publicOutputs[outputName];
    for (const seg of jsonPointer) {
      if (cursor === null || typeof cursor !== 'object') {
        return {
          kind: 'error',
          error: {
            code: 'BLUEPRINT_VAR_PROVISION_PATH_NOT_FOUND',
            message: `vars.${varName}: pointer "${jsonPointer.join('.')}" did not resolve in publicOutputs.${outputName}`,
            varName,
            fromPath: path,
            targetSlug: target.slug,
          },
        };
      }
      cursor = (cursor as Record<string, unknown>)[seg];
    }

    return { kind: 'value', value: cursor };
  }

  return { kind: 'value', value: undefined };
}

/**
 * Resolve only `target.*` var bindings. `provision.*` bindings are filtered
 * out — their placeholders remain as `${VAR}` literals in any subsequent
 * `applyVars` call. Used pre-provision to substitute target-derived values
 * (e.g. AUTH0_REDIRECT_URI from `target.auth.auth0.redirectUri`) into module
 * `publicConfig` before passing it to provisioners. provision-derived
 * placeholders cannot be resolved before provision runs, so leaving them
 * as literals is the only correct option; provisioner implementations that
 * read those fields must tolerate it (or not declare them as inputs).
 *
 * Errors on missing required `target.*` paths are returned with the same
 * shape `resolveVars` produces, so callers can fail-fast pre-provision and
 * surface meaningful errors.
 */
export function resolveTargetVarsOnly(
  manifest: VarsManifest,
  target: TargetForVars,
): Result<ResolvedVars> {
  const targetOnly: Record<string, VarBinding> = {};
  for (const [name, binding] of Object.entries(manifest)) {
    if (binding.from.startsWith('target.')) targetOnly[name] = binding;
  }
  return resolveVars(targetOnly, target);
}

export function applyVars<T>(value: T, vars: ResolvedVars): T {
  if (typeof value === 'string') {
    return value.replace(PLACEHOLDER_RE, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : match,
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).map((v) => applyVars(v, vars)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = applyVars(v, vars);
    }
    return out as unknown as T;
  }
  return value;
}
