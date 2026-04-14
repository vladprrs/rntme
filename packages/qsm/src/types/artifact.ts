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
 * - For `derived` (tier 2), `pathPrefix` narrows a relation chain. Accepted by
 *   parser for forwards-compat; ignored by MVP validators.
 */
export type ProjectionSource = {
  entity: string;
  pathPrefix?: string;
};

export type Projection = {
  backing?: ProjectionBacking; // default "entity-mirror"
  source: ProjectionSource;
  keys: readonly string[];
  grain: readonly string[];
  exposed: readonly string[];
  table?: string; // default `projection_${lowercase(projectionName)}`
};

/**
 * Allowed relation-role values (spec §6 / rc7 §8).
 * `fact` / `dimension` are the only valid classifications; the QSM compiler
 * uses these to tag PDM relations for downstream query compilation.
 */
export const RELATION_ROLE_VALUES = ['fact', 'dimension'] as const;
export type RelationRole = (typeof RELATION_ROLE_VALUES)[number];

export type QsmArtifact = {
  projections: Readonly<Record<string, Projection>>;
  relationRoles: Readonly<Record<string, RelationRole>>;
};

/**
 * Branded validation states — enforce pipeline ordering at the type level.
 */
declare const StructurallyValidBrand: unique symbol;
declare const ValidatedBrand: unique symbol;

export type StructurallyValidQsm = QsmArtifact & {
  readonly [StructurallyValidBrand]: true;
};

export type ValidatedQsm = StructurallyValidQsm & {
  readonly [ValidatedBrand]: true;
};
