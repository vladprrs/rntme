import type { CanonicalGraph } from '../types/canonical.js';
import { err, ok, ERROR_CODES, type Result } from '../types/result.js';

export type GraphRole = 'predicate' | 'mapper' | 'reducer' | 'query' | 'command' | 'projection';

export function inferRole(graph: CanonicalGraph): Result<GraphRole> {
  const hasEmit = graph.nodes.some((n) => n.kind === 'emit');
  const hasReduce = graph.nodes.some((n) => n.kind === 'reduce');
  const outputType = graph.signature.output.type;
  const outputIsRowset = outputType.startsWith('rowset<');
  const outputIsRow = outputType.startsWith('row<');
  const outputIsBoolean = outputType === 'boolean';

  const rootEntry = Object.entries(graph.signature.inputs).find(([, i]) => i.mode === 'root');
  const rootType = rootEntry?.[1].type;
  const rootIsRow = typeof rootType === 'object' && rootType !== null && 'row' in rootType;
  const rootIsRowset = typeof rootType === 'object' && rootType !== null && 'rowset' in rootType;

  const rootFindMany = graph.nodes.find(
    (n) => n.kind === 'findMany' && 'eventType' in n.source,
  );

  if (rootFindMany && hasReduce && outputIsRowset && !hasEmit) return ok('projection');

  if (rootIsRow && outputIsBoolean) return ok('predicate');
  if (rootIsRow && outputIsRow) return ok('mapper');
  if (rootIsRowset && outputIsRowset && hasReduce) return ok('reducer');
  if (!rootEntry && outputIsRowset && !hasEmit) return ok('query');
  if (!rootEntry && hasEmit && !outputIsRowset) return ok('command');

  if (outputIsRowset && hasEmit) {
    return err([
      {
        layer: 'structural',
        code: ERROR_CODES.GRAPH_MIXED_ROLE,
        message: 'graph has both rowset<T> output and >=1 emit node; pick one',
        location: { graphId: graph.id },
      },
    ]);
  }
  return err([
    {
      layer: 'structural',
      code: ERROR_CODES.GRAPH_MIXED_ROLE,
      message: `graph role cannot be inferred from signature/nodes; output=${outputType}, rootInput=${rootEntry?.[0] ?? 'none'}, hasEmit=${hasEmit}`,
      location: { graphId: graph.id },
    },
  ]);
}
