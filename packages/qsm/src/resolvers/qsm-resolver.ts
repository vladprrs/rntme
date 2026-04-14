import type {
  Projection,
  RelationRole,
  ValidatedQsm,
} from '../types/artifact.js';
import type {
  QsmResolver,
  ResolvedProjection,
  ResolvedRelationRole,
} from '../types/resolvers.js';
import { defaultTableName } from '../validate/structural.js';

export function createQsmResolver(artifact: ValidatedQsm): QsmResolver {
  const projectionNames = Object.keys(artifact.projections);
  const resolvedByName = new Map<string, ResolvedProjection>();
  for (const name of projectionNames) {
    resolvedByName.set(name, toResolvedProjection(name, artifact.projections[name]!));
  }

  const mirrorByEntity = new Map<string, ResolvedProjection>();
  for (const rp of resolvedByName.values()) {
    if (rp.backing === 'entity-mirror') {
      mirrorByEntity.set(rp.source.entity, rp);
    }
  }

  const roles: ResolvedRelationRole[] = Object.entries(artifact.relationRoles).flatMap(
    ([key, role]) => {
      const [entity, relation] = key.split('.');
      if (!entity || !relation) return [];
      return [{ entity, relation, role: role as RelationRole }];
    },
  );
  const rolesByKey = new Map(roles.map((r) => [`${r.entity}.${r.relation}`, r.role]));

  return {
    listProjections: () => projectionNames,
    resolveProjection: (name) => resolvedByName.get(name) ?? null,
    findEntityMirror: (entityName) => mirrorByEntity.get(entityName) ?? null,
    listRelationRoles: () => roles,
    resolveRelationRole: (entity, relation) =>
      rolesByKey.get(`${entity}.${relation}`) ?? null,
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
