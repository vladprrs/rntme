import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { isDerivedSource } from '@rntme/qsm';
import {
  compileProjectionGraphFromValidated,
  type AuthoringSpecOutput,
  type DerivedCompileResult,
  type GraphIrError,
} from '@rntme/graph-ir-compiler';

/**
 * Runtime-local error codes for cross-artifact validation of `backing: 'derived'`
 * projections. Emitted by `crossValidateDerivedProjections`.
 *
 * - `QSM_DERIVED_UNKNOWN_GRAPH`       — projection.source.graph references a graphId
 *                                       not present in the authoring spec's `graphs`.
 * - `QSM_DERIVED_GRAPH_NOT_PROJECTION`— graph-ir compile reported PROJ_ROLE_UNINFERRABLE;
 *                                       original code preserved in `hint`.
 * - `QSM_DERIVED_KEYS_MISMATCH`       — projection.keys (sorted) differ from the graph's
 *                                       reduce group-column names (sorted).
 * - `QSM_DERIVED_EXPOSED_OUT_OF_RANGE`— projection.exposed contains a name that is
 *                                       neither a group column nor a measure column.
 */
export const DERIVED_PROJECTION_ERROR_CODES = {
  QSM_DERIVED_UNKNOWN_GRAPH: 'QSM_DERIVED_UNKNOWN_GRAPH',
  QSM_DERIVED_GRAPH_NOT_PROJECTION: 'QSM_DERIVED_GRAPH_NOT_PROJECTION',
  QSM_DERIVED_KEYS_MISMATCH: 'QSM_DERIVED_KEYS_MISMATCH',
  QSM_DERIVED_EXPOSED_OUT_OF_RANGE: 'QSM_DERIVED_EXPOSED_OUT_OF_RANGE',
} as const;

export type DerivedProjectionErrorCode =
  keyof typeof DERIVED_PROJECTION_ERROR_CODES;

export type CrossValidateError = {
  layer: 'cross-ref';
  code: DerivedProjectionErrorCode | string;
  message: string;
  projection?: string;
  graphId?: string;
  hint?: string;
};

export type CrossValidateResult =
  | { ok: true; value: Map<string, DerivedCompileResult> }
  | { ok: false; errors: CrossValidateError[] };

export type CrossValidateInput = {
  qsm: ValidatedQsm;
  authoringSpec: AuthoringSpecOutput;
  pdm: ValidatedPdm;
};

/**
 * For each projection in `qsm.projections` with `backing === 'derived'`, locate
 * its graph in `authoringSpec.graphs[graphId]`, compile it via
 * `compileProjectionGraph`, and verify that the projection's declared `keys` /
 * `exposed` align with the compiled table schema.
 *
 * Returns a map keyed by projection name; each entry is the graph-ir compile
 * result (UPSERT / bootstrap SQL + table schema + event/aggregate metadata) that
 * the runtime feeds into `generateProjectionDdl` (via `derivedSchemas`) and
 * `compileApplyPlan` (via `derivedHandlers`).
 *
 * On the first graph-level error for a projection, subsequent structural checks
 * (keys / exposed) are skipped for that projection — we cannot verify schema
 * alignment without a successful compile. Other projections are still processed.
 */
export function crossValidateDerivedProjections(
  input: CrossValidateInput,
): CrossValidateResult {
  const errors: CrossValidateError[] = [];
  const out = new Map<string, DerivedCompileResult>();

  const specGraphs = input.authoringSpec.graphs;

  for (const [projName, proj] of Object.entries(input.qsm.projections)) {
    const backing = proj.backing ?? 'entity-mirror';
    if (backing !== 'derived') continue;
    if (!isDerivedSource(proj.source)) {
      // Invariant: structural validator in @rntme/qsm enforces this; guarding
      // defensively so a validator-bug does not surface as an uncaught throw.
      errors.push({
        layer: 'cross-ref',
        code: DERIVED_PROJECTION_ERROR_CODES.QSM_DERIVED_UNKNOWN_GRAPH,
        message: `projection "${projName}" backing=derived without a graph source (qsm validator bug)`,
        projection: projName,
      });
      continue;
    }

    const graphId = proj.source.graph;
    if (!(graphId in specGraphs)) {
      errors.push({
        layer: 'cross-ref',
        code: DERIVED_PROJECTION_ERROR_CODES.QSM_DERIVED_UNKNOWN_GRAPH,
        message: `projection "${projName}" references graph "${graphId}" not present in authoring spec`,
        projection: projName,
        graphId,
        hint: `available graphs: ${Object.keys(specGraphs).join(', ') || '(none)'}`,
      });
      continue;
    }

    const tableName = proj.table;
    if (tableName === undefined) {
      errors.push({
        layer: 'cross-ref',
        code: DERIVED_PROJECTION_ERROR_CODES.QSM_DERIVED_UNKNOWN_GRAPH,
        message: `derived projection "${projName}" missing required "table" (qsm validator bug)`,
        projection: projName,
        graphId,
      });
      continue;
    }

    const compiled = compileProjectionGraphFromValidated(
      input.authoringSpec,
      input.pdm,
      input.qsm,
      { graphId, projectionTable: tableName },
    );

    if (!compiled.ok) {
      for (const e of compiled.errors) {
        if (e.code === 'PROJ_ROLE_UNINFERRABLE') {
          errors.push({
            layer: 'cross-ref',
            code: DERIVED_PROJECTION_ERROR_CODES.QSM_DERIVED_GRAPH_NOT_PROJECTION,
            message: `graph "${graphId}" bound to derived projection "${projName}" is not a projection-role graph`,
            projection: projName,
            graphId,
            hint: formatOriginalGraphIrError(e),
          });
        } else {
          const bubbled: CrossValidateError = {
            layer: 'cross-ref',
            code: e.code,
            message: e.message,
            projection: projName,
            graphId,
          };
          if (e.hint !== undefined) bubbled.hint = e.hint;
          errors.push(bubbled);
        }
      }
      continue;
    }

    const schema = compiled.value.tableSchema;
    const graphKeys = schema.groupColumns.map((c) => c.name).slice().sort();
    const projKeys = proj.keys.slice().sort();
    if (!arraysEqual(graphKeys, projKeys)) {
      errors.push({
        layer: 'cross-ref',
        code: DERIVED_PROJECTION_ERROR_CODES.QSM_DERIVED_KEYS_MISMATCH,
        message:
          `projection "${projName}" keys=[${projKeys.join(', ')}] do not match graph "${graphId}" group keys=[${graphKeys.join(', ')}]`,
        projection: projName,
        graphId,
      });
      continue;
    }

    const allowed = new Set<string>([
      ...schema.groupColumns.map((c) => c.name),
      ...schema.measureColumns.map((c) => c.name),
    ]);
    const outOfRange = proj.exposed.filter((c) => !allowed.has(c));
    if (outOfRange.length > 0) {
      errors.push({
        layer: 'cross-ref',
        code: DERIVED_PROJECTION_ERROR_CODES.QSM_DERIVED_EXPOSED_OUT_OF_RANGE,
        message:
          `projection "${projName}" exposes unknown column(s) [${outOfRange.join(', ')}]; graph "${graphId}" produces [${[...allowed].join(', ')}]`,
        projection: projName,
        graphId,
        hint: `exposed must be a subset of group-column ∪ measure-column names`,
      });
      continue;
    }

    out.set(projName, compiled.value);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: out };
}

function formatOriginalGraphIrError(e: GraphIrError): string {
  const parts = [`${e.code}`];
  if (e.message) parts.push(e.message);
  if (e.hint) parts.push(`(hint: ${e.hint})`);
  return parts.join(' — ');
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
