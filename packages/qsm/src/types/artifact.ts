/**
 * Backing strategies for a projection (spec §6.1).
 *  - `entity-mirror`: 1:1 current-state mirror of a PDM entity, auto-derived
 *    from PDM + stateMachine. Consumer applies envelope-events to maintain it.
 *    The only backing supported in MVP.
 *  - `derived`: aggregate/join projection with explicit materializer rules.
 *    Parser accepts the value; validator rejects it until tier 2.
 */
export type ProjectionBacking = 'entity-mirror' | 'derived';

/**
 * Source of a projection.
 * - For `entity-mirror`, only `entity` matters; `pathPrefix` is ignored.
 * - For `derived` (tier 2), `pathPrefix` narrows a relation chain.
 */
export type ProjectionSource = {
  entity: string;
  pathPrefix?: string;
};

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
