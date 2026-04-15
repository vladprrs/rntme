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

    for (const [actionId, action] of Object.entries(route.actions ?? {})) {
      if (action.kind !== 'command') continue;
      const binding = a.resolved.bindings[`${path}#action#${actionId}`]?.binding;
      if (!binding) continue;

      // coverage: every required input must appear in paramsFromState
      const covered = new Set(Object.keys(action.paramsFromState));
      for (const input of binding.inputs) {
        if (OPTIONAL_MODES.has(input.mode)) continue;
        if (FORBIDDEN_MODES.has(input.mode)) continue;
        if (!covered.has(input.name)) {
          errors.push({
            layer: 'consistency',
            code: UI_ERROR_CODES.UI_UNCOVERED_COMMAND_INPUT,
            message: `Command action "${actionId}" is missing paramsFromState entry for required input "${input.name}"`,
            path: `routes["${path}"].actions.${actionId}.paramsFromState`,
          });
        }
      }
      checkForbiddenModes(binding, errors, `routes["${path}"].actions.${actionId}.binding`);

      // typed state-path checks for paramsFromState
      for (const [inputName, sp] of Object.entries(action.paramsFromState)) {
        const input = binding.inputs.find((i) => i.name === inputName);
        if (!input) continue;
        const resolvedPathType = resolveStatePathType(sp, path, a);
        if (resolvedPathType && !typesCompatible(resolvedPathType, input.type)) {
          errors.push({
            layer: 'consistency',
            code: UI_ERROR_CODES.UI_TYPE_MISMATCH,
            message: `paramsFromState "${inputName}" <- "${sp}" has type ${formatInputType(resolvedPathType)}, binding expects ${formatInputType(input.type)}`,
            path: `routes["${path}"].actions.${actionId}.paramsFromState.${inputName}`,
          });
        }
      }
    }

    // component prop shape for $state refs to datasets used in known list props
    for (const [elId, el] of Object.entries(route.page.elements)) {
      const comp = a.resolved.components[el.type];
      if (!comp || !comp.knownListProps) continue;
      for (const lp of comp.knownListProps) {
        const v = (el.props as Record<string, unknown>)[lp];
        if (!v || typeof v !== 'object') continue;
        const ref = (v as { $state?: string }).$state;
        if (!ref) continue;
        const dm = /^\/data\/([^/]+)$/.exec(ref);
        if (!dm) continue;
        const datasetId = dm[1];
        if (!datasetId) continue;
        const binding = a.resolved.bindings[`${path}#data#${datasetId}`]?.binding;
        if (!binding) continue;
        if (binding.outputShape.kind !== 'list') {
          errors.push({
            layer: 'consistency',
            code: UI_ERROR_CODES.UI_TYPE_MISMATCH,
            message: `Element "${elId}" prop "${lp}" expects a list; dataset "${datasetId}" returns ${binding.outputShape.kind}`,
            path: `routes["${path}"].page.elements.${elId}.props.${lp}`,
          });
        }
      }
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

function resolveStatePathType(
  sp: string,
  routePath: string,
  a: ResolvedUi,
): InputType | undefined {
  // only /data/<ds>/<field> is typed today; /form/* etc. are dynamic
  const m = /^\/data\/([^/]+)\/([^/]+)$/.exec(sp);
  if (!m) return undefined;
  const datasetId = m[1];
  const fieldName = m[2];
  if (!datasetId || !fieldName) return undefined;
  const binding = a.resolved.bindings[`${routePath}#data#${datasetId}`]?.binding;
  if (!binding) return undefined;
  const shape = binding.outputShape.kind === 'list' ? binding.outputShape.element : binding.outputShape;
  if (!shape || !shape.fields) return undefined;
  return shape.fields.find((f) => f.name === fieldName)?.type;
}

function typesCompatible(a: InputType, b: InputType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'scalar' && b.kind === 'scalar') return a.primitive === b.primitive;
  if (a.kind === 'enum' && b.kind === 'enum') return a.variants.every((v) => (b as Extract<InputType, { kind: 'enum' }>).variants.includes(v));
  if (a.kind === 'ref' && b.kind === 'ref') return (a as Extract<InputType, { kind: 'ref' }>).shapeId === (b as Extract<InputType, { kind: 'ref' }>).shapeId;
  return false;
}
