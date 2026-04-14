import type { CanonicalGraph } from '../../types/canonical.js';
import type { Pdm } from '../../types/pdm.js';
import type { Qsm } from '../../types/qsm.js';
import { err, ok, ERROR_CODES, type GraphIrError, type Result } from '../../types/result.js';

export type EntitySource = { kind: 'entity'; entity: string; table: string; alias: string };
export type ProjectionSource = {
  kind: 'projection';
  projection: string;
  entity: string;
  table: string;
  alias: string;
};
export type ResolvedSource = EntitySource | ProjectionSource;

export type SourceMap = Map<string, ResolvedSource>;

export function resolveSources(graph: CanonicalGraph, pdm: Pdm, qsm: Qsm): Result<SourceMap> {
  const errors: GraphIrError[] = [];
  const map: SourceMap = new Map();

  for (const node of graph.nodes) {
    if (node.kind !== 'findMany') continue;
    if ('entity' in node.source) {
      const entity = pdm.entities[node.source.entity];
      if (!entity) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_SOURCE_NOT_FOUND,
          message: `entity "${node.source.entity}" not found in PDM`,
          location: { graphId: graph.id, nodeId: node.id },
        });
        continue;
      }
      map.set(node.id, { kind: 'entity', entity: node.source.entity, table: entity.table, alias: node.alias });
    } else {
      const proj = qsm.projections[node.source.projection];
      if (!proj) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_SOURCE_NOT_FOUND,
          message: `projection "${node.source.projection}" not found in QSM`,
          location: { graphId: graph.id, nodeId: node.id },
        });
        continue;
      }
      const entity = pdm.entities[proj.source.entity];
      if (!entity) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_SOURCE_NOT_FOUND,
          message: `projection "${node.source.projection}" refers to missing entity "${proj.source.entity}"`,
          location: { graphId: graph.id, nodeId: node.id },
        });
        continue;
      }
      map.set(node.id, {
        kind: 'projection',
        projection: node.source.projection,
        entity: proj.source.entity,
        table: entity.table,
        alias: node.alias,
      });
    }
  }

  return errors.length ? err(errors) : ok(map);
}
