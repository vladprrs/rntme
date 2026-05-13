import {
  compileOperationFromValidated,
  parseAuthoringSpec,
  type CompiledOperation,
  type OperationRegistry,
  type Result,
} from '@rntme/graph-ir-compiler';
import type {
  ValidatedBindings,
  BindingEntry,
  GraphSignature,
  ResolvedShape,
  InputType,
  HttpParameter,
  InputFromMap,
  ResponseShape,
} from '@rntme/bindings';
import { BindingsRuntimeError, type RuntimeErrorEntry } from '../errors.js';
import { buildSchemas, type BuiltSchemas } from './zod-schema.js';
import { buildBindToMap, type BindToMap } from '../runtime/remap.js';
import type { RuntimeGraphSpec, ValidatedPdm, ValidatedQsm } from './runtime-inputs.js';

type SingleGraphSpec = RuntimeGraphSpec;

function sliceSpec(spec: SingleGraphSpec, graphId: string): RuntimeGraphSpec {
  const graphs = spec.graphs;
  const target = graphs[graphId];
  return {
    ...spec,
    graphs: target === undefined ? {} : { [graphId]: target },
  };
}

const emptyOperationRegistry: OperationRegistry = { resolve: () => null };

export function compileOperationForGraph(
  rawSpec: RuntimeGraphSpec,
  graphId: string,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
  exposure: 'read' | 'action',
  registry: OperationRegistry = emptyOperationRegistry,
): Result<CompiledOperation> {
  const specR = parseAuthoringSpec(sliceSpec(rawSpec, graphId));
  if (!specR.ok) return specR;
  return compileOperationFromValidated(specR.value, pdm, qsm, {
    registry,
    serviceName: '',
    ownedAggregates: ownedAggregatesFromPdm(pdm),
    exposure,
  });
}

type BindingPlanCommon = {
  bindingId: string;
  entry: BindingEntry;
  signature: GraphSignature;
  outputShape: ResolvedShape;
  schemas: BuiltSchemas;
  bindToMap: BindToMap;
  listParamNames: Set<string>;
  pathParamNames: string[];
  bodyParamNames: string[];
};

export type OperationBindingPlan = BindingPlanCommon & {
  exposure: 'read' | 'action';
  operationName: string;
  inputFrom: InputFromMap | null;
  response: ResponseShape | null;
};

export type BindingPlan = OperationBindingPlan;

export type GraphIrOperationMap = Record<string, CompiledOperation>;

export type BuildPlanResult = {
  plans: Record<string, BindingPlan>;
  compiledOperations: GraphIrOperationMap;
};

export type CompilePlanResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: RuntimeErrorEntry[] };

export function buildDefaultGraphIrOperationMap(
  validated: ValidatedBindings,
  graphSpec: RuntimeGraphSpec,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
  registry: OperationRegistry = emptyOperationRegistry,
): CompilePlanResult<GraphIrOperationMap> {
  try {
    return { ok: true, value: buildPlan(validated, graphSpec, pdm, qsm, { registry }).compiledOperations };
  } catch (e) {
    if (e instanceof BindingsRuntimeError) return { ok: false, errors: [...e.errors] };
    throw e;
  }
}

export type BuildPlanOptions = {
  readonly registry?: OperationRegistry;
};

export function buildPlan(
  validated: ValidatedBindings,
  graphSpec: RuntimeGraphSpec,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
  options: BuildPlanOptions = {},
): BuildPlanResult {
  const registry = options.registry ?? emptyOperationRegistry;
  const graphIds = new Set(
    Object.values(validated.resolved)
      .filter((r) => r.entry.target.engine !== 'native')
      .map((r) => r.entry.graph),
  );
  const operationCache = new Map<string, CompiledOperation>();
  const errors: RuntimeErrorEntry[] = [];

  for (const graphId of graphIds) {
    const exposure = resolvedExposureForGraph(validated, graphId);
    const r = compileOperationForGraph(graphSpec, graphId, pdm, qsm, exposure, registry);
    if (r.ok) operationCache.set(graphId, r.value);
    else for (const cause of r.errors) errors.push({ graphId, cause });
  }

  if (errors.length > 0) throw new BindingsRuntimeError(errors);

  const plans: Record<string, BindingPlan> = {};
  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const { entry, signature, outputShape } = resolved;
    const schemas = buildSchemas(entry.http.parameters, signature);
    const common: BindingPlanCommon = {
      bindingId,
      entry,
      signature,
      outputShape,
      schemas,
      bindToMap: buildBindToMap(entry.http.parameters),
      listParamNames: collectListParams(entry.http.parameters, signature),
      pathParamNames: entry.http.parameters.filter((p) => p.in === 'path').map((p) => p.name),
      bodyParamNames: entry.http.parameters.filter((p) => p.in === 'body').map((p) => p.name),
    };
    plans[bindingId] = {
      ...common,
      exposure: entry.exposure,
      operationName: entry.graph,
      inputFrom: entry.inputFrom ?? null,
      response: entry.response ?? null,
    };
  }

  return {
    plans,
    compiledOperations: Object.fromEntries(operationCache),
  };
}

function resolvedExposureForGraph(validated: ValidatedBindings, graphId: string): 'read' | 'action' {
  return Object.values(validated.resolved).some((r) => r.entry.graph === graphId && r.entry.exposure === 'action')
    ? 'action'
    : 'read';
}

function ownedAggregatesFromPdm(pdm: ValidatedPdm): Set<string> {
  const out = new Set<string>();
  const raw = pdm as { entities?: unknown };
  const entities = Array.isArray(raw.entities)
    ? (raw.entities as Array<{ name: string; ownerService?: string }>)
    : Object.entries((raw.entities as Record<string, unknown> | undefined) ?? {}).map(([name]) => ({ name }));
  for (const entity of entities) out.add(entity.name);
  return out;
}

function collectListParams(parameters: HttpParameter[], signature: GraphSignature): Set<string> {
  const listSet = new Set<string>();
  for (const p of parameters) {
    if (p.in !== 'query') continue;
    const t: InputType | undefined = signature.inputs[p.bindTo]?.type;
    if (t && t.kind === 'list') listSet.add(p.name);
  }
  return listSet;
}
