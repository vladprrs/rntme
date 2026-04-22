import {
  compile,
  compileCommand,
  type CompileResult as QueryCompileResult,
  type CompiledCommand,
} from '@rntme/graph-ir-compiler';
import type { Result } from '@rntme/graph-ir-compiler';
import type {
  ValidatedBindings,
  BindingEntry,
  GraphSignature,
  ResolvedShape,
  InputType,
  HttpParameter,
  PreStep,
} from '@rntme/bindings';
import { BindingsRuntimeError, type RuntimeErrorEntry } from '../errors.js';
import { buildSchemas, type BuiltSchemas } from './zod-schema.js';
import { buildBindToMap, type BindToMap } from '../runtime/remap.js';

type SingleGraphSpec = { graphs?: Record<string, unknown>; [k: string]: unknown };

function sliceSpec(rawSpec: unknown, graphId: string): unknown {
  const spec = rawSpec as SingleGraphSpec;
  const graphs = spec?.graphs ?? {};
  const target = graphs[graphId];
  return {
    ...spec,
    graphs: target === undefined ? {} : { [graphId]: target },
  };
}

export function compileForGraph(
  rawSpec: unknown,
  graphId: string,
  pdm: unknown,
  qsm: unknown,
): Result<QueryCompileResult> {
  return compile(sliceSpec(rawSpec, graphId), pdm, qsm);
}

export function compileCommandForGraph(
  rawSpec: unknown,
  graphId: string,
  pdm: unknown,
  qsm: unknown,
): Result<CompiledCommand> {
  return compileCommand(sliceSpec(rawSpec, graphId), pdm, qsm);
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

export type QueryBindingPlan = BindingPlanCommon & {
  kind: 'query';
  compiled: QueryCompileResult;
};

export type CommandBindingPlan = BindingPlanCommon & {
  kind: 'command';
  commandName: string;
  pre: PreStep[];
};

export type BindingPlan = QueryBindingPlan | CommandBindingPlan;

export type GraphIrCommandMap = Record<string, CompiledCommand>;

export type BuildPlanResult = {
  plans: Record<string, BindingPlan>;
  compiledCommands: GraphIrCommandMap;
};

export function buildDefaultGraphIrCommandMap(
  validated: ValidatedBindings,
  graphSpec: unknown,
  pdm: unknown,
  qsm: unknown,
): GraphIrCommandMap {
  return buildPlan(validated, graphSpec, pdm, qsm).compiledCommands;
}

export function buildPlan(
  validated: ValidatedBindings,
  graphSpec: unknown,
  pdm: unknown,
  qsm: unknown,
): BuildPlanResult {
  const queryGraphIds = new Set<string>();
  const commandGraphIds = new Set<string>();
  for (const r of Object.values(validated.resolved)) {
    const kind = r.entry.kind ?? 'query';
    if (kind === 'command') commandGraphIds.add(r.entry.graph);
    else queryGraphIds.add(r.entry.graph);
  }

  const queryCache = new Map<string, QueryCompileResult>();
  const commandCache = new Map<string, CompiledCommand>();
  const errors: RuntimeErrorEntry[] = [];

  for (const graphId of queryGraphIds) {
    const r = compileForGraph(graphSpec, graphId, pdm, qsm);
    if (r.ok) queryCache.set(graphId, r.value);
    else for (const cause of r.errors) errors.push({ graphId, cause });
  }
  for (const graphId of commandGraphIds) {
    const r = compileCommandForGraph(graphSpec, graphId, pdm, qsm);
    if (r.ok) commandCache.set(graphId, r.value);
    else for (const cause of r.errors) errors.push({ graphId, cause });
  }

  if (errors.length > 0) throw new BindingsRuntimeError(errors);

  const plans: Record<string, BindingPlan> = {};
  for (const [bindingId, resolved] of Object.entries(validated.resolved)) {
    const { entry, signature, outputShape } = resolved;
    const kind = entry.kind ?? 'query';
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
    plans[bindingId] =
      kind === 'command'
        ? { ...common, kind: 'command', commandName: entry.graph, pre: entry.pre ?? [] }
        : { ...common, kind: 'query', compiled: queryCache.get(entry.graph)! };
  }
  return {
    plans,
    compiledCommands: Object.fromEntries(commandCache),
  };
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
