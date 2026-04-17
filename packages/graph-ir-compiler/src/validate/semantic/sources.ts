import type { CanonicalGraph, CanonicalNode } from '../../types/canonical.js';
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
 * Dispatch dot-nav path collection to the appropriate node-kind collector.
 * Returns all dot-nav paths (>= 3 parts) found in the node's relevant expressions.
 */
function collectPathsFromNode(node: CanonicalNode): string[] {
  if (node.kind === 'map') return collectDotNavPaths(node.fields);
  if (node.kind === 'filter') return collectDotNavPaths(node.expr);
  if (node.kind === 'sort') return collectDotNavPaths(node.by);
  if (node.kind === 'reduce') return [
    ...collectDotNavPaths(node.group),
    ...collectDotNavPaths(node.measures),
  ];
  return [];
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
    const paths = collectPathsFromNode(node);
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

/**
 * Semantic validator: walks every dot-nav path (>= 3 parts) against QSM.relations and emits
 * NAV_NOT_ALLOWED (relation key missing) or NAV_FAN_OUT_NOT_ALLOWED (cardinality "many").
 *
 * Complements checkNavProjectionRequired: that check handles "no entity-mirror exists for the
 * scan's entity"; this check handles "mirror exists but a hop in the path is missing/fan-out".
 * Aliases that have no entity-mirror projection are skipped here to avoid double-reporting.
 */
export function checkNavRelations(
  graph: CanonicalGraph,
  qsm: ValidatedQsm,
  sources: SourceMap,
): GraphIrError[] {
  const qsmResolver = createQsmResolver(qsm);

  // Build alias → starting-projection-name map for aliases that HAVE an entity-mirror projection.
  // Aliases without a mirror are filtered out (checkNavProjectionRequired handles those).
  const aliasToStartProj = new Map<string, string>();
  for (const src of sources.values()) {
    if (src.kind === 'entity') {
      const mirror = qsmResolver.findEntityMirror(src.entity);
      if (mirror) {
        aliasToStartProj.set(src.alias, mirror.name);
      }
      // If no mirror: skip (checkNavProjectionRequired already handles this case)
    } else {
      // kind === 'projection': projection name is already known
      aliasToStartProj.set(src.alias, src.projection);
    }
  }

  if (aliasToStartProj.size === 0) return [];

  const errors: GraphIrError[] = [];

  for (const node of graph.nodes) {
    const paths = collectPathsFromNode(node);

    for (const path of paths) {
      const parts = path.split('.');
      const alias = parts[0]!;

      const startProjName = aliasToStartProj.get(alias);
      if (!startProjName) continue; // no entity-mirror for this alias — skip

      // Walk hops: parts[1] .. parts[length-2] are relation hops; parts[last] is the field name.
      // A path of length 3: [alias, relation, field] → one hop (parts[1]).
      // A path of length 4: [alias, rel1, rel2, field] → two hops (parts[1], parts[2]).
      let curProjName = startProjName;
      for (let i = 1; i <= parts.length - 2; i++) {
        const relName = parts[i]!;
        const key = `${curProjName}.${relName}`;
        const rel = qsm.relations[key];

        if (!rel) {
          errors.push({
            layer: 'semantic',
            code: ERROR_CODES.NAV_NOT_ALLOWED,
            message: `relation "${key}" not declared in QSM.relations`,
            hint: 'add a QSM.relations entry for this key, or correct the path',
            location: { graphId: graph.id, nodeId: node.id, path },
          });
          break;
        }

        if (rel.cardinality === 'many') {
          errors.push({
            layer: 'semantic',
            code: ERROR_CODES.NAV_FAN_OUT_NOT_ALLOWED,
            message: `relation "${key}" has cardinality "many"`,
            hint: 'dot-navigation requires cardinality "one"; use an explicit join for many-cardinality relations',
            location: { graphId: graph.id, nodeId: node.id, path },
          });
          break;
        }

        curProjName = rel.to;
      }
    }
  }

  return errors;
}

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
