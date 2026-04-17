import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { parseAuthoringSpec } from '../parse/parse.js';
import { validateStructural } from '../validate/structural/index.js';
import { validateSemantic } from '../validate/semantic/index.js';
import { normalize } from '../canonical/normalize.js';
import { buildSemanticPlan } from '../semantic-plan/build.js';
import { buildRelational } from '../relational/build.js';
import { lowerToSqlite } from '../lower/sqlite/lower.js';
import { emitSql } from '../lower/sqlite/emit.js';
import { buildEmitPlans } from '../emit/plan.js';
import { inferRole } from '../role/infer.js';
import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
import type { CompiledCommand, ReadPreludeCompileResult } from '../types/command.js';

export function compileCommand(rawSpec: unknown, rawPdm: unknown, rawQsm: unknown): Result<CompiledCommand> {
  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return specR;

  const pdmParse = parsePdm(rawPdm);
  if (!pdmParse.ok)
    return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: 'PDM failed schema validation' }]);
  const pdmVal = validatePdm(pdmParse.value);
  if (!pdmVal.ok)
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: pdmVal.errors[0]?.message ?? 'PDM validation failed',
      },
    ]);

  const qsmParse = parseQsm(rawQsm);
  if (!qsmParse.ok)
    return err([{ layer: 'parse', code: ERROR_CODES.PARSE_SCHEMA_VIOLATION, message: 'QSM failed schema validation' }]);
  const qsmVal = validateQsm(qsmParse.value, createPdmResolver(pdmVal.value));
  if (!qsmVal.ok)
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: qsmVal.errors[0]?.message ?? 'QSM validation failed',
      },
    ]);

  const pdm = pdmVal.value;
  const qsm = qsmVal.value;

  const sv = validateStructural(specR.value, pdm, qsm);
  if (!sv.ok) return sv;

  const { graphs } = normalize(sv.value);
  const ids = Object.keys(graphs);
  if (ids.length !== 1)
    return err([
      {
        layer: 'canonical',
        code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID,
        message: 'compileCommand accepts exactly one graph',
      },
    ]);
  const graph = graphs[ids[0]!]!;

  const roleR = inferRole(graph);
  if (!roleR.ok) return roleR;
  if (roleR.value !== 'command')
    return err([
      {
        layer: 'structural',
        code: ERROR_CODES.GRAPH_MIXED_ROLE,
        message: `compileCommand called on non-command graph (role=${roleR.value})`,
      },
    ]);

  const semR = validateSemantic(graph, pdm, qsm, sv.value.shapes);
  if (!semR.ok) return semR;

  const emitPlans = buildEmitPlans(graph, pdm);
  const aggregates = new Set(emitPlans.map((e) => e.aggregate));
  if (aggregates.size !== 1)
    return err([
      {
        layer: 'semantic',
        code: ERROR_CODES.CMD_MULTI_AGGREGATE_NOT_ALLOWED,
        message: 'MVP: exactly one aggregate per command',
      },
    ]);
  const aggregate = [...aggregates][0]!;

  const readNodes = graph.nodes.filter((n) => n.kind !== 'emit');
  let readPrelude: ReadPreludeCompileResult | null = null;
  let readPreludeGuardNodeId: string | null = null;
  if (readNodes.length > 0) {
    const lastRead = readNodes[readNodes.length - 1]!;
    const readGraph = {
      ...graph,
      nodes: readNodes,
      outputFrom: lastRead.id,
      signature: {
        ...graph.signature,
        output: { type: 'rowset<GuardRow>', from: lastRead.id },
      },
    };
    const planR = buildSemanticPlan(readGraph, pdm, qsm);
    if (!planR.ok) return planR;
    const rel = buildRelational(planR.value);
    const predicateOptionalParams = new Set<string>(
      Object.entries(graph.signature.inputs)
        .filter(([, i]) => i.mode === 'predicate_optional')
        .map(([n]) => n),
    );
    const { ast, paramOrder } = lowerToSqlite(rel, { predicateOptionalParams, pdm, qsm });
    readPrelude = {
      sql: emitSql(ast),
      paramOrder,
      shape: { name: 'GuardRow' },
      optionalParams: [...predicateOptionalParams],
      paramDefaults: {},
    };
    readPreludeGuardNodeId = lastRead.id;
  }

  const optionalParams = Object.entries(graph.signature.inputs)
    .filter(([, i]) => i.mode === 'predicate_optional')
    .map(([n]) => n);
  const paramDefaults: Record<string, unknown> = {};
  for (const [n, d] of Object.entries(graph.signature.inputs)) {
    if (d.mode === 'defaulted' && d.default !== undefined) paramDefaults[n] = d.default;
  }

  return ok({
    graphId: graph.id,
    aggregate,
    emits: emitPlans,
    readPrelude,
    readPreludeGuardNodeId,
    paramOrder: Object.keys(graph.signature.inputs),
    optionalParams,
    paramDefaults,
  });
}
