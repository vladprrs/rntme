import type { CanonicalGraph } from '../../types/canonical.js';
import type { Expr } from '../../types/authoring.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

/**
 * Walk an EXPR tree and yield each `{ $param: string }` name encountered.
 * This is a depth-first recursive generator over the EXPR grammar.
 */
function* walkExprParams(expr: unknown): Generator<string> {
  if (expr === null || typeof expr !== 'object') return;

  const obj = expr as Record<string, unknown>;

  if ('$param' in obj && typeof obj['$param'] === 'string') {
    yield obj['$param'] as string;
    return; // $param nodes have no sub-expressions
  }

  if ('$list' in obj && Array.isArray(obj['$list'])) {
    for (const item of obj['$list']) yield* walkExprParams(item);
    return;
  }

  if ('between' in obj && Array.isArray(obj['between'])) {
    for (const item of obj['between']) yield* walkExprParams(item);
    return;
  }

  if ('case' in obj && obj['case'] !== null && typeof obj['case'] === 'object') {
    const c = obj['case'] as { when?: unknown[]; else?: unknown };
    if (Array.isArray(c.when)) {
      for (const [cond, val] of c.when as [unknown, unknown][]) {
        yield* walkExprParams(cond);
        yield* walkExprParams(val);
      }
    }
    if (c.else !== undefined) yield* walkExprParams(c.else);
    return;
  }

  if ('exists' in obj && obj['exists'] !== null && typeof obj['exists'] === 'object') {
    const e = obj['exists'] as { where?: unknown };
    if (e.where !== undefined) yield* walkExprParams(e.where);
    return;
  }

  // Operator node: { [op]: Expr[] }
  const opEntry = Object.entries(obj)[0];
  if (opEntry) {
    const [, args] = opEntry;
    if (Array.isArray(args)) {
      for (const arg of args) yield* walkExprParams(arg);
    } else {
      yield* walkExprParams(args);
    }
  }
}

/**
 * Check that `predicate_optional` params are only used inside filter.expr nodes.
 * Using them in map.fields, reduce.measures, or limit.count is a semantic error.
 */
export function checkParamContext(graph: CanonicalGraph): GraphIrError[] {
  const errs: GraphIrError[] = [];

  // Collect the set of predicate_optional param names
  const predicateOptional = new Set<string>();
  for (const [name, decl] of Object.entries(graph.signature.inputs)) {
    if (decl.mode === 'predicate_optional') predicateOptional.add(name);
  }
  if (predicateOptional.size === 0) return errs;

  for (const node of graph.nodes) {
    // filter.expr is the designated context — skip it entirely
    if (node.kind === 'filter') continue;

    if (node.kind === 'map') {
      for (const [fieldName, fieldExpr] of Object.entries(node.fields)) {
        for (const paramName of walkExprParams(fieldExpr as Expr)) {
          if (predicateOptional.has(paramName)) {
            errs.push({
              layer: 'semantic',
              code: ERROR_CODES.SEM_PARAM_CONTEXT,
              message: `predicate_optional param "${paramName}" used outside a filter predicate`,
              location: { graphId: graph.id, nodeId: node.id, path: `fields.${fieldName}` },
            });
          }
        }
      }
      continue;
    }

    if (node.kind === 'reduce') {
      for (const [measureKey, measure] of Object.entries(node.measures)) {
        if (measure.expr !== undefined) {
          for (const paramName of walkExprParams(measure.expr as Expr)) {
            if (predicateOptional.has(paramName)) {
              errs.push({
                layer: 'semantic',
                code: ERROR_CODES.SEM_PARAM_CONTEXT,
                message: `predicate_optional param "${paramName}" used outside a filter predicate`,
                location: { graphId: graph.id, nodeId: node.id, path: `measures.${measureKey}` },
              });
            }
          }
        }
      }
      continue;
    }

    if (node.kind === 'limit') {
      const count = node.count;
      if (typeof count === 'object' && count !== null && '$param' in count) {
        const paramName = (count as { $param: string }).$param;
        if (predicateOptional.has(paramName)) {
          errs.push({
            layer: 'semantic',
            code: ERROR_CODES.SEM_PARAM_CONTEXT,
            message: `predicate_optional param "${paramName}" used outside a filter predicate`,
            location: { graphId: graph.id, nodeId: node.id, path: 'count' },
          });
        }
      }
      continue;
    }
  }

  return errs;
}
