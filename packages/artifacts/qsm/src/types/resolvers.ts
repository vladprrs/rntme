import type { ProjectionBacking, ProjectionSource, RelationRole, Cardinality } from './artifact.js';

export type ResolvedProjection = {
  name: string;
  backing: ProjectionBacking;
  table: string;
  source: ProjectionSource;
  keys: readonly string[];
  grain: readonly string[];
  exposed: readonly string[];
};

export type ResolvedRelation = {
  sourceProjection: string;
  relationName: string;
  to: string;
  localKey: string;
  foreignKey: string;
  cardinality: Cardinality;
  role?: RelationRole;
};

export type QsmResolver = {
  listProjections(): readonly string[];
  resolveProjection(name: string): ResolvedProjection | null;
  findEntityMirror(entityName: string): ResolvedProjection | null;
  listRelations(): readonly ResolvedRelation[];
  resolveRelation(sourceProjection: string, relationName: string): ResolvedRelation | null;
};
