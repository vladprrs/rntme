import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { ok, err, type Result } from '../../types/result.js';
import { runStructuralVisitor } from './visitor.js';
import { idsBundle } from './ids.js';
import { refsBundle } from './refs.js';
import { dagBundle } from './dag.js';
import { outputFromBundle } from './output-from.js';
import { inputsBundle } from './inputs.js';
import { shapesBundle } from './shapes.js';
import { mapReduceBundle } from './map-reduce.js';
import { tier1NodesBundle } from './tier1-nodes.js';
import { tier1ExprBundle } from './tier1-expr.js';
import { commandShapeBundle } from './command-shape.js';
import { roleBundle } from './role.js';

/**
 * Runs every structural rule with a single per-node walk per graph.
 *
 * Bundles are passed in the same order the previous orchestrator chained
 * `checkX(spec)` calls, so error ordering within a graph stays stable for
 * any rule that fires multiple times in the same phase. Cross-rule ordering
 * within a graph is interleaved (per-node, then post-walk) — no test relies
 * on it.
 */
export function validateStructural(
  spec: AuthoringSpecOutput,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): Result<AuthoringSpecOutput> {
  const errors = runStructuralVisitor(spec, pdm, qsm, [
    idsBundle,
    refsBundle,
    dagBundle,
    outputFromBundle,
    inputsBundle,
    shapesBundle,
    mapReduceBundle,
    tier1NodesBundle,
    tier1ExprBundle,
    commandShapeBundle,
    roleBundle,
  ]);
  return errors.length ? err(errors) : ok(spec);
}
