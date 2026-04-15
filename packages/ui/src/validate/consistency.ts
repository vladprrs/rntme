import type { ResolvedUi } from './references.js';
import type { UiResolvers, ResolvedBinding, InputType } from '../types/resolvers.js';
import type { ValidatedUiArtifact, ParamValue, StateRef } from '../types/artifact.js';
import { err, ok, UI_ERROR_CODES, type Result, type UiError } from '../types/result.js';

const OPTIONAL_MODES = new Set(['nullable', 'defaulted']);
const FORBIDDEN_MODES = new Set(['root', 'predicate_optional']);

export function validateConsistency(a: ResolvedUi, _r: UiResolvers): Result<ValidatedUiArtifact> {
  const errors: UiError[] = [];

  for (const [path, route] of Object.entries(a.routes)) {
    for (const [datasetId, def] of Object.entries(route.data ?? {})) {
      const binding = a.resolved.bindings[`${path}#data#${datasetId}`]?.binding;
      if (!binding) continue; // references layer already reported
      checkInputsCovered(
        binding,
        def.params ?? {},
        errors,
        `routes["${path}"].data.${datasetId}`,
        UI_ERROR_CODES.UI_UNCOVERED_QUERY_INPUT,
      );
      checkLiteralTypes(binding, def.params ?? {}, errors, `routes["${path}"].data.${datasetId}`);
      checkForbiddenModes(binding, errors, `routes["${path}"].data.${datasetId}.binding`);
    }
  }

  if (errors.length) return err(errors);
  return ok(a as unknown as ValidatedUiArtifact);
}

function isStateRef(v: ParamValue): v is StateRef {
  return typeof v === 'object' && v !== null && typeof (v as StateRef).$state === 'string';
}

function checkInputsCovered(
  binding: ResolvedBinding,
  params: Record<string, ParamValue>,
  errors: UiError[],
  basePath: string,
  code: (typeof UI_ERROR_CODES)['UI_UNCOVERED_QUERY_INPUT'] | (typeof UI_ERROR_CODES)['UI_UNCOVERED_COMMAND_INPUT'],
): void {
  for (const input of binding.inputs) {
    if (OPTIONAL_MODES.has(input.mode)) continue;
    if (FORBIDDEN_MODES.has(input.mode)) continue;
    if (!(input.name in params)) {
      errors.push({
        layer: 'consistency',
        code,
        message: `Required input "${input.name}" is not covered by ${basePath}.params`,
        path: `${basePath}.params`,
      });
    }
  }
}

function checkLiteralTypes(
  binding: ResolvedBinding,
  params: Record<string, ParamValue>,
  errors: UiError[],
  basePath: string,
): void {
  for (const [paramName, value] of Object.entries(params)) {
    const input = binding.inputs.find((i) => i.name === paramName);
    if (!input) continue; // unknown input — orthogonal
    if (isStateRef(value)) continue; // dynamic — checked elsewhere
    const expected = input.type;
    if (!literalMatches(expected, value)) {
      errors.push({
        layer: 'consistency',
        code: UI_ERROR_CODES.UI_TYPE_MISMATCH,
        message: `Param "${paramName}" literal ${JSON.stringify(value)} does not match input type ${formatInputType(expected)}`,
        path: `${basePath}.params.${paramName}`,
      });
    }
  }
}

function checkForbiddenModes(binding: ResolvedBinding, errors: UiError[], bindingPath: string): void {
  for (const input of binding.inputs) {
    if (FORBIDDEN_MODES.has(input.mode)) {
      errors.push({
        layer: 'consistency',
        code: UI_ERROR_CODES.UI_UNSUPPORTED_INPUT_MODE,
        message: `Binding referenced from UI has input "${input.name}" with mode "${input.mode}" which is not allowed on UI`,
        path: bindingPath,
      });
    }
  }
}

function literalMatches(t: InputType, v: unknown): boolean {
  switch (t.kind) {
    case 'scalar':
      return (
        (t.primitive === 'string' && typeof v === 'string') ||
        (t.primitive === 'number' && typeof v === 'number') ||
        (t.primitive === 'boolean' && typeof v === 'boolean')
      );
    case 'enum':
      return typeof v === 'string' && t.variants.includes(v);
    case 'ref':
      return false;
  }
}

function formatInputType(t: InputType): string {
  switch (t.kind) {
    case 'scalar': return t.primitive;
    case 'enum': return `enum(${t.variants.join('|')})`;
    case 'ref': return `ref(${t.shapeId})`;
  }
}
