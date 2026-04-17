import type {
  Projection,
  ValidatedQsm,
} from '../types/artifact.js';
import type {
  QsmResolver,
  ResolvedProjection,
  ResolvedRelation,
} from '../types/resolvers.js';
import { defaultTableName } from '../validate/structural.js';
import { invariantViolated } from '../common/invariant.js';

export function createQsmResolver(artifact: ValidatedQsm): QsmResolver {
  const resolvedByName = new Map<string, ResolvedProjection>();
  for (const [name, proj] of Object.entries(artifact.projections)) {
    resolvedByName.set(name, toResolvedProjection(name, proj));
  }
  const projectionNames = Array.from(resolvedByName.keys());

  const mirrorByEntity = new Map<string, ResolvedProjection>();
  for (const rp of resolvedByName.values()) {
    if (rp.backing !== 'entity-mirror') continue;
    if (mirrorByEntity.has(rp.source.entity)) {
      throw invariantViolated(
        `multiple entity-mirror projections on "${rp.source.entity}" — cross-ref validator should have rejected this`,
      );
    }
    mirrorByEntity.set(rp.source.entity, rp);
  }

  const relations: ResolvedRelation[] = Object.entries(artifact.relations).flatMap(
    ([key, rel]) => {
      const [sourceProjection, relationName] = key.split('.');
      if (!sourceProjection || !relationName) return [];
      return [{
        sourceProjection,
        relationName,
        to: rel.to,
        localKey: rel.localKey,
        foreignKey: rel.foreignKey,
        cardinality: rel.cardinality,
        ...(rel.role !== undefined ? { role: rel.role } : {}),
      }];
    },
  );
  const relationsByKey = new Map(
    relations.map((r) => [`${r.sourceProjection}.${r.relationName}`, r]),
  );

  return {
    listProjections: () => projectionNames,
    resolveProjection: (name) => resolvedByName.get(name) ?? null,
    findEntityMirror: (entityName) => mirrorByEntity.get(entityName) ?? null,
    listRelations: () => relations,
    resolveRelation: (sourceProjection, relationName) =>
      relationsByKey.get(`${sourceProjection}.${relationName}`) ?? null,
  };
}

function toResolvedProjection(name: string, p: Projection): ResolvedProjection {
  return {
    name,
    backing: p.backing ?? 'entity-mirror',
    table: p.table ?? defaultTableName(name),
    source:
      p.source.pathPrefix !== undefined
        ? { entity: p.source.entity, pathPrefix: p.source.pathPrefix }
        : { entity: p.source.entity },
    keys: p.keys,
    grain: p.grain,
    exposed: p.exposed,
  };
}
