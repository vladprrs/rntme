import { err, ok, type Result } from './result.js';
import type { DeploymentPlanError } from './errors.js';

export type VarBinding = Readonly<{ from: string; required: boolean }>;
export type VarsManifest = Readonly<Record<string, VarBinding>>;
export type ResolvedVars = Readonly<Record<string, string>>;

export type TargetForVars = {
  readonly slug: string;
  readonly auth?: Record<string, Record<string, unknown>>;
  readonly modules?: Record<string, Record<string, unknown>>;
  readonly eventBus?: Record<string, unknown>;
};

const PLACEHOLDER_RE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

export function resolveVars(
  manifest: VarsManifest,
  target: TargetForVars,
): Result<ResolvedVars> {
  const errors: DeploymentPlanError[] = [];
  const out: Record<string, string> = {};

  for (const [name, binding] of Object.entries(manifest)) {
    const value = readPath(target, binding.from);
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

function readPath(target: TargetForVars, path: string): unknown {
  // Path is "target.<root>.<...>". Strip leading "target.".
  const segments = path.split('.');
  if (segments[0] !== 'target') return undefined;
  let cursor: unknown = target;
  for (const seg of segments.slice(1)) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
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
