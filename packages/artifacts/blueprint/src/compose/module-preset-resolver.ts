import { readFileSync } from 'node:fs';
import type { ExternalFragmentResolver, ExternalFragmentResolverContext, SpecJson } from '@rntme/ui';
import { SpecJsonSchema } from '@rntme/ui';
import type { UiPresetExport } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type BlueprintError, type Result } from '../types/result.js';

type ResolverBuildInput = {
  readonly presets: readonly UiPresetExport[];
};

export function createModulePresetExternalResolver(input: ResolverBuildInput): ExternalFragmentResolver {
  const byModuleAndPath = new Map<string, UiPresetExport>();
  for (const preset of input.presets) {
    byModuleAndPath.set(`${preset.moduleKey}/${preset.path}`, preset);
  }

  return (requestedRef: string, context: ExternalFragmentResolverContext) => {
    const normalized = normalizeModuleRef(requestedRef, context);
    if (normalized === null) return ok(null);
    const preset = byModuleAndPath.get(normalized.lookupKey);
    if (preset === undefined) return ok(null);
    const parsed = readPresetSpec(preset);
    if (!parsed.ok) {
      return err(parsed.errors.map((error) => ({
        code: 'EXTERNAL_REF_UNRESOLVED' as const,
        message: error.message,
        path: normalized.canonicalRef,
      })));
    }
    return ok({ ref: normalized.canonicalRef, source: 'external', spec: parsed.value });
  };
}

function normalizeModuleRef(
  requestedRef: string,
  context: ExternalFragmentResolverContext,
): { lookupKey: string; canonicalRef: string } | null {
  if (requestedRef.startsWith('module:')) {
    const body = requestedRef.slice('module:'.length);
    return { lookupKey: body, canonicalRef: `module:${body}` };
  }
  if (context.referrerSource === 'external' && context.referrer?.startsWith('module:')) {
    const referrerBody = context.referrer.slice('module:'.length);
    const moduleKey = referrerBody.split('/')[0];
    if (!moduleKey) return null;
    const body = `${moduleKey}/${requestedRef}`;
    return { lookupKey: body, canonicalRef: `module:${body}` };
  }
  return null;
}

function readPresetSpec(preset: UiPresetExport): Result<SpecJson> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(preset.sourcePath, 'utf8'));
  } catch (cause) {
    return err([{
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_MISSING,
      message: `cannot read module preset "${preset.moduleKey}/${preset.path}": ${cause instanceof Error ? cause.message : String(cause)}`,
      path: preset.sourcePath,
    } satisfies BlueprintError]);
  }
  const parsed = SpecJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return err([{
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_MISSING,
      message: `module preset "${preset.moduleKey}/${preset.path}" is not a valid SpecJson`,
      path: preset.sourcePath,
      cause: parsed.error.issues,
    } satisfies BlueprintError]);
  }
  return ok(parsed.data as SpecJson);
}
