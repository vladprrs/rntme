import type { AuthoringSpecOutput } from '../parse/schema.js';
import type {
  CanonicalGraph,
  CanonicalNode,
  CanonicalFindMany,
  CanonicalMeasure,
  CanonicalEmit,
  CanonicalFindOne,
} from '../types/canonical.js';
import type { CallPolicy, Expr, FieldExpr } from '../types/authoring.js';
import { internalError } from '../types/errors.js';
import { camelCase } from '../types/strings.js';

function sourceAlias(source: { entity?: unknown; projection?: unknown; eventType?: unknown }): string {
  if ('entity' in source && typeof source.entity === 'string') return camelCase(source.entity);
  if ('projection' in source && typeof source.projection === 'string') return camelCase(source.projection);
  if ('eventType' in source && typeof source.eventType === 'string') return camelCase(source.eventType);
  throw internalError('canonical', `unsupported source in canonical normalize: ${JSON.stringify(source)}`);
}

export function normalize(
  spec: AuthoringSpecOutput,
): { graphs: Record<string, CanonicalGraph> } {
  let scopeCounter = 0;
  const freshScope = (): string => `s${++scopeCounter}`;
  const out: Record<string, CanonicalGraph> = {};

  for (const [key, graph] of Object.entries(spec.graphs)) {
    const rootEntry = Object.entries(graph.signature.inputs).find(([, i]) => i.mode === 'root');
    const rootScope = rootEntry ? freshScope() : undefined;

    const nodes: CanonicalNode[] = graph.nodes.map((n): CanonicalNode => {
      const scope = freshScope();
      switch (n.type) {
        case 'findMany': {
          const node: CanonicalFindMany = {
            kind: 'findMany',
            id: n.id,
            scope,
            source: n.config.source as { entity: string } | { projection: string } | { eventType: string },
            alias: sourceAlias(n.config.source),
          };
          return node;
        }
        case 'findOne': {
          const node: CanonicalFindOne = {
            kind: 'findOne',
            id: n.id,
            scope,
            source: n.config.source as { entity: string } | { projection: string } | { eventType: string },
            alias: sourceAlias(n.config.source),
            where: n.config.where as Expr,
          };
          return node;
        }
        case 'filter':
          return {
            kind: 'filter',
            id: n.id,
            scope,
            input: n.config.input,
            expr: (n.config.expr ?? null) as Expr,
          };
        case 'map':
          return {
            kind: 'map',
            id: n.id,
            scope,
            input: n.config.input,
            into: n.config.into,
            fields: n.config.fields as Record<string, FieldExpr>,
          };
        case 'reduce': {
          const measures: Record<string, CanonicalMeasure> = {};
          for (const [k, m] of Object.entries(n.config.measures)) {
            measures[k] = m.expr !== undefined ? { fn: m.fn, expr: m.expr as Expr } : { fn: m.fn };
          }
          return {
            kind: 'reduce',
            id: n.id,
            scope,
            input: n.config.input,
            into: n.config.into,
            group: n.config.group,
            measures,
          };
        }
        case 'sort':
          return {
            kind: 'sort',
            id: n.id,
            scope,
            input: n.config.input,
            by: n.config.by.map((k) => ({
              field: k.field,
              dir: k.dir ?? 'asc',
              nulls: k.nulls ?? 'last',
            })),
          };
        case 'limit':
          return { kind: 'limit', id: n.id, scope, input: n.config.input, count: n.config.count };
        case 'uuid':
          return { kind: 'uuid', id: n.id, scope };
        case 'emit': {
          const out: CanonicalEmit = {
            kind: 'emit',
            id: n.id,
            scope,
            aggregate: n.config.aggregate,
            aggregateId: n.config.aggregateId as Expr,
            transition: n.config.transition as string,
            payload: n.config.payload as Record<string, Expr>,
          };
          if (n.config.actor !== undefined) out.actor = n.config.actor as Expr;
          return out;
        }
        case 'call':
          return {
            kind: 'call',
            id: n.id,
            scope,
            target: n.target,
            input: n.input as Record<string, Expr>,
            policy: n.policy as CallPolicy,
          };
        case 'branch':
          return {
            kind: 'branch',
            id: n.id,
            scope,
            cases: n.cases as Array<{ when: Expr; then: string } | { default: true; then: string }>,
          };
        case 'result':
          return {
            kind: 'result',
            id: n.id,
            scope,
            value: n.value as Record<string, Expr> | Expr,
          };
        default:
          throw internalError('canonical', `unsupported node type in canonical normalize: ${(n as { type: string }).type}`);
      }
    });

    out[key] = {
      id: graph.id,
      signature: graph.signature,
      ...(rootScope !== undefined ? { rootScope } : {}),
      nodes,
      outputFrom: graph.signature.output.from,
    };
  }

  return { graphs: out };
}
