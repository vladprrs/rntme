import type { CanonicalGraph } from '../../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import { createQsmResolver, type ValidatedQsm } from '@rntme/qsm';
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

export function resolveSources(graph: CanonicalGraph, pdm: ValidatedPdm, qsm: ValidatedQsm): Result<SourceMap> {
  const errors: GraphIrError[] = [];
  const map: SourceMap = new Map();
  const qsmResolver = createQsmResolver(qsm);

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
      const mirror = qsmResolver.findEntityMirror(node.source.entity);
      const table = mirror ? mirror.table : entity.table;
      map.set(node.id, { kind: 'entity', entity: node.source.entity, table, alias: node.alias });
    } else {
      const rp = qsmResolver.resolveProjection(node.source.projection);
      if (!rp) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_SOURCE_NOT_FOUND,
          message: `projection "${node.source.projection}" not found in QSM`,
          location: { graphId: graph.id, nodeId: node.id },
        });
        continue;
      }
      const entity = pdm.entities[rp.source.entity];
      if (!entity) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_SOURCE_NOT_FOUND,
          message: `projection "${node.source.projection}" refers to missing entity "${rp.source.entity}"`,
          location: { graphId: graph.id, nodeId: node.id },
        });
        continue;
      }
      map.set(node.id, {
        kind: 'projection',
        projection: node.source.projection,
        entity: rp.source.entity,
        table: entity.table,
        alias: node.alias,
      });
    }
  }

  return errors.length ? err(errors) : ok(map);
}
