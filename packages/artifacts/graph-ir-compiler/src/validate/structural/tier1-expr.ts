import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx, type Node } from './visitor.js';

function scanExpr(node: unknown, onBad: (what: string) => void): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((c) => scanExpr(c, onBad));
    return;
  }
  const obj = node as Record<string, unknown>;
  if ('exists' in obj) {
    onBad('exists');
    return;
  }
  if ('$list' in obj) {
    onBad('$list');
    return;
  }
  if ('in' in obj) {
    onBad('in');
    return;
  }
  for (const v of Object.values(obj)) scanExpr(v, onBad);
}

function record(ctx: GraphCtx, nodeId: string, what: string): void {
  ctx.errors.push({
    layer: 'structural',
    code: ERROR_CODES.TIER1_UNSUPPORTED_EXPR,
    message: `EXPR operator "${what}" is not supported in MVP Tier 1`,
    location: { graphId: ctx.graph.id, nodeId },
    hint: 'Planned for Tier 2.',
  });
}

const filterExprScan = (node: Node, ctx: GraphCtx): void => {
  if (node.type === 'filter' && node.config.expr !== undefined) {
    scanExpr(node.config.expr, (w) => record(ctx, node.id, w));
  }
};

const mapFieldsScan = (node: Node, ctx: GraphCtx): void => {
  if (node.type !== 'map') return;
  for (const [field, value] of Object.entries(node.config.fields)) {
    if (typeof value === 'object' && value !== null && 'lookup' in value) {
      ctx.errors.push({
        layer: 'structural',
        code: ERROR_CODES.TIER1_UNSUPPORTED_EXPR,
        message: `lookup in map.fields is not supported in MVP Tier 1`,
        location: { graphId: ctx.graph.id, nodeId: node.id, path: `fields.${field}` },
        hint: 'Planned for Tier 2.',
      });
      continue;
    }
    scanExpr(value, (w) => record(ctx, node.id, w));
  }
};

const reduceMeasuresScan = (node: Node, ctx: GraphCtx): void => {
  if (node.type !== 'reduce') return;
  for (const m of Object.values(node.config.measures)) {
    if (m.expr !== undefined) scanExpr(m.expr, (w) => record(ctx, node.id, w));
  }
};

export const tier1ExprBundle: CheckBundle = {
  nodeByKind: {
    filter: [filterExprScan],
    map: [mapFieldsScan],
    reduce: [reduceMeasuresScan],
  },
};

export function checkTier1Expr(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [tier1ExprBundle]);
}
