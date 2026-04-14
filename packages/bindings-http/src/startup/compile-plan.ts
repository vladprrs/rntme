import { compile, type CompileResult } from '@rntme/graph-ir-compiler';
import type { Result } from '@rntme/graph-ir-compiler';
import type {
  ValidatedBindings,
  BindingEntry,
  GraphSignature,
  ResolvedShape,
  InputType,
  HttpParameter,
} from '@rntme/bindings';
import { BindingsRuntimeError, type RuntimeErrorEntry } from '../errors.js';
import { buildSchemas, type BuiltSchemas } from './zod-schema.js';
import { buildBindToMap, type BindToMap } from '../runtime/remap.js';

export function compileForGraph(
  rawSpec: unknown,
  graphId: string,
  pdm: unknown,
  qsm: unknown,
): Result<CompileResult> {
  const spec = rawSpec as { graphs?: Record<string, unknown>; [k: string]: unknown };
  const graphs = spec?.graphs ?? {};
  const target = graphs[graphId];
  const singleGraphSpec = {
    ...spec,
    graphs: target === undefined ? {} : { [graphId]: target },
  };
  return compile(singleGraphSpec, pdm, qsm);
}

export type BindingPlan = {
  bindingId: string;
  entry: BindingEntry;
  signature: GraphSignature;
  outputShape: ResolvedShape;
  schemas: BuiltSchemas;
  bindToMap: BindToMap;
  listParamNames: Set<string>;
  pathParamNames: string[];
  bodyParamNames: string[];
  compiled: CompileResult;
};

export function buildPlan(
  validated: ValidatedBindings,
  graphSpec: unknown,
  pdm: unknown,
  qsm: unknown,
): Record<string, BindingPlan> {
  const uniqueGraphIds = new Set<string>();
  for (const r of Object.values(validated.resolved)) {
    uniqueGraphIds.add(r.entry.graph);
  }

  const compileCache = new Map<string, CompileResult>();
  const errors: RuntimeErrorEntry[] = [];

  for (const graphId of uniqueGraphIds) {
    const r = compileForGraph(graphSpec, graphId, pdm, qsm);
    if (r.ok) {
      compileCache.set(graphId, r.value);
    } else {
      for (const cause of r.errors) {
        errors.push({ graphId, cause });
      }
    }
  }

  if (errors.length > 0) {
    throw new BindingsRuntimeError(errors);
  }

  const plan: Record<string, BindingPlan> = {};
  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const { entry, signature, outputShape } = resolved;
    const schemas = buildSchemas(entry.http.parameters, signature);
    plan[bindingId] = {
      bindingId,
      entry,
      signature,
      outputShape,
      schemas,
      bindToMap: buildBindToMap(entry.http.parameters),
      listParamNames: collectListParams(entry.http.parameters, signature),
      pathParamNames: entry.http.parameters.filter((p) => p.in === 'path').map((p) => p.name),
      bodyParamNames: entry.http.parameters.filter((p) => p.in === 'body').map((p) => p.name),
      compiled: compileCache.get(entry.graph)!,
    };
  }
  return plan;
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
