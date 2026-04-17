import type { CanonicalGraph } from '../../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import { createQsmResolver, type ValidatedQsm } from '@rntme/qsm';
import { err, ok, ERROR_CODES, type GraphIrError, type Result } from '../../types/result.js';

/**
 * Collect all string field-path references (recursively) from an expression value.
 * Returns only paths with >= 3 parts (alias + relation + field = dot-nav).
 */
function collectDotNavPaths(expr: unknown): string[] {
  const found: string[] = [];
  const walk = (e: unknown): void => {
    if (typeof e === 'string') {
      if (e.split('.').length >= 3) found.push(e);
      return;
    }
    if (e === null || typeof e !== 'object') return;
    if (Array.isArray(e)) {
      e.forEach(walk);
      return;
    }
    const obj = e as Record<string, unknown>;
    // $literal and $param carry non-path string values — skip entirely.
    if ('$literal' in obj) return;
    if ('$param' in obj) return;
    // lookup: entity/path/match/field/optional — no Expr sub-trees (matches walkExprParams pattern).
    if ('lookup' in obj) return;
    // exists.relation is a relation name (not a field path); exists.where IS a sub-expr.
    if ('exists' in obj) {
      const inner = obj.exists as Record<string, unknown> | undefined;
      if (inner && 'where' in inner) walk(inner.where);
      return;
    }
    for (const v of Object.values(obj)) walk(v);
  };
  walk(expr);
  return found;
}

/**
 * Gate: if a scan has no entity-mirror projection in QSM and any node in the graph
 * references a dot-nav path (>= 3 parts) scoped to that scan's alias, emit NAV_PROJECTION_REQUIRED.
 */
export function checkNavProjectionRequired(
  graph: CanonicalGraph,
  qsm: ValidatedQsm,
  sources: SourceMap,
): GraphIrError[] {
  // Build set of aliases that have no entity-mirror projection
  const projectionlessAliases = new Set<string>();
  for (const [, src] of sources) {
    if (src.kind !== 'entity') continue;
    const hasMirror = Object.values(qsm.projections).some(
      (p) => (p.backing ?? 'entity-mirror') === 'entity-mirror' && p.source.entity === src.entity,
    );
    if (!hasMirror) {
      projectionlessAliases.add(src.alias);
    }
  }

  if (projectionlessAliases.size === 0) return [];

  const errors: GraphIrError[] = [];
  for (const node of graph.nodes) {
    let paths: string[] = [];
    if (node.kind === 'map') {
      // canonical map = semantic-plan project; fields may be plain strings or
      // wrapped {expr} objects — collectDotNavPaths recurses into both forms.
      paths = collectDotNavPaths(node.fields);
    } else if (node.kind === 'filter') {
      paths = collectDotNavPaths(node.expr);
    } else if (node.kind === 'sort') {
      paths = collectDotNavPaths(node.by);
    } else if (node.kind === 'reduce') {
      // group cols are field-path strings that may cross relation boundaries
      // (e.g. "order.customer.region"); measures may also reference dot-nav exprs.
      paths = collectDotNavPaths(node.group);
      paths = paths.concat(collectDotNavPaths(node.measures));
    }
    for (const path of paths) {
      const alias = path.split('.')[0]!;
      if (projectionlessAliases.has(alias)) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.NAV_PROJECTION_REQUIRED,
          message: `dot-nav path "${path}" references scan alias "${alias}" which has no entity-mirror projection in QSM; declare one to enable dot-navigation`,
          location: { graphId: graph.id, nodeId: node.id, path },
        });
      }
    }
  }
  return errors;
}

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
