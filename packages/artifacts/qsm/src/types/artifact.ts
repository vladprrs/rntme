/**
 * Backing strategies for a projection (spec §6.1).
 *  - `entity-mirror`: 1:1 current-state mirror of a PDM entity, auto-derived
 *    from PDM + stateMachine. Consumer applies envelope-events to maintain it.
 *  - `derived`: aggregate/join projection materialised via a graph-IR spec
 *    (D5). Consumer applies a compiled UPSERT per envelope using deltaSql
 *    derived from the graph.
 */
export type ProjectionBacking = 'entity-mirror' | 'derived';

/**
 * Source of a projection.
 * - For `entity-mirror`, `{ entity }` (with optional `pathPrefix`) is used.
 * - For `derived`, `{ graph }` references a graph-IR spec declared elsewhere
 *   in the service manifest; `@rntme/runtime` compiles it via
 *   `compileProjectionGraph` and supplies the resulting table schema and
 *   deltas to this package's DDL derivation and to the projection-consumer's
 *   apply plan.
 *
 * The discrimination between the two shapes is enforced by validators (so
 * the structural layer can emit readable error codes), not by type-level
 * discriminators on `Projection`.
 */
export type ProjectionSource =
  | { entity: string; pathPrefix?: string }
  | { graph: string };

export function isEntityMirrorSource(
  source: ProjectionSource,
): source is { entity: string; pathPrefix?: string } {
  return 'entity' in source;
}

export function isDerivedSource(
  source: ProjectionSource,
): source is { graph: string } {
  return 'graph' in source;
}

export type Projection = {
  backing?: ProjectionBacking;
  source: ProjectionSource;
  keys: readonly string[];
  grain: readonly string[];
  exposed: readonly string[];
  table?: string;
};

/**
 * Read-side relation roles (spec §6 / rc7 §8).
 * `fact` / `dimension` are annotations only — they do NOT drive compiler behavior.
 */
export const RELATION_ROLE_VALUES = ['fact', 'dimension'] as const;
export type RelationRole = (typeof RELATION_ROLE_VALUES)[number];

export const CARDINALITY_VALUES = ['one', 'many'] as const;
export type Cardinality = (typeof CARDINALITY_VALUES)[number];

/**
 * Structural relation metadata for read-side compilation.
 * Key format in `QsmArtifact.relations`: `"<ProjectionName>.<relationName>"`.
 * - `to` is a projection name in this same QSM.
 * - `localKey`/`foreignKey` are FIELD names (not columns). Column resolution
 *   happens at compile time via PDM.
 * - `cardinality` must match the corresponding PDM relation (B2).
 * - `role` is optional annotation; compiler does not consult it.
 */
export type QsmRelation = {
  to: string;
  localKey: string;
  foreignKey: string;
  cardinality: Cardinality;
  role?: RelationRole;
};

export type QsmArtifact = {
  projections: Readonly<Record<string, Projection>>;
  relations: Readonly<Record<string, QsmRelation>>;
};

declare const StructurallyValidBrand: unique symbol;
declare const ValidatedBrand: unique symbol;

export type StructurallyValidQsm = QsmArtifact & {
  readonly [StructurallyValidBrand]: true;
};

export type ValidatedQsm = StructurallyValidQsm & {
  readonly [ValidatedBrand]: true;
};
