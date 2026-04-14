import type { ProjectionBacking, RelationRole } from './artifact.js';

export type ResolvedProjection = Readonly<{
  name: string;
  backing: ProjectionBacking; // defaulted
  table: string; // defaulted when unspecified
  source: Readonly<{ entity: string; pathPrefix?: string }>;
  keys: readonly string[];
  grain: readonly string[];
  exposed: readonly string[];
}>;

export type ResolvedRelationRole = Readonly<{
  entity: string;
  relation: string;
  role: RelationRole;
}>;

export type QsmResolver = {
  listProjections(): readonly string[];
  resolveProjection(name: string): ResolvedProjection | null;
  /**
   * Entity-mirror lookup: returns the unique entity-mirror projection for
   * `entityName`, or null if the entity has no mirror. Used by read-graph
   * compilers to map `findMany.source.entity = "Issue"` → SELECT from
   * `projection_issue`.
   */
  findEntityMirror(entityName: string): ResolvedProjection | null;
  listRelationRoles(): readonly ResolvedRelationRole[];
  resolveRelationRole(entity: string, relation: string): RelationRole | null;
};
