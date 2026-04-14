import type { AuthoringSpecOutput } from '../parse/schema.js';
import type {
  CanonicalGraph,
  CanonicalNode,
  CanonicalFindMany,
  CanonicalMeasure,
  CanonicalEmit,
} from '../types/canonical.js';
import type { Expr, FieldExpr } from '../types/authoring.js';

function camelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function sourceAlias(source: { entity: string } | { projection: string }): string {
  return camelCase('entity' in source ? source.entity : source.projection);
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
            source: n.config.source,
            alias: sourceAlias(n.config.source),
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
        case 'emit': {
          const out: CanonicalEmit = {
            kind: 'emit',
            id: n.id,
            scope,
            aggregate: n.config.aggregate,
            aggregateId: n.config.aggregateId as Expr,
            transition: n.config.transition,
            payload: n.config.payload as Record<string, Expr>,
          };
          if (n.config.actor !== undefined) out.actor = n.config.actor as Expr;
          return out;
        }
        default:
          throw new Error(`unsupported node type in canonical normalize: ${(n as { type: string }).type}`);
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
