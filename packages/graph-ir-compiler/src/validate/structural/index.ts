import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { ok, err, type Result } from '../../types/result.js';
import { checkIds } from './ids.js';
import { checkRefs } from './refs.js';
import { checkDag } from './dag.js';
import { checkOutputFrom } from './output-from.js';
import { checkInputs } from './inputs.js';
import { checkShapes } from './shapes.js';
import { checkMapReduceCoverage } from './map-reduce.js';
import { checkTier1Nodes } from './tier1-nodes.js';
import { checkTier1Expr } from './tier1-expr.js';

export function validateStructural(
  spec: AuthoringSpecOutput,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): Result<AuthoringSpecOutput> {
  const errors = [
    ...checkIds(spec),
    ...checkRefs(spec),
    ...checkDag(spec),
    ...checkOutputFrom(spec),
    ...checkInputs(spec),
    ...checkShapes(spec, pdm, qsm),
    ...checkMapReduceCoverage(spec, pdm, qsm),
    ...checkTier1Nodes(spec),
    ...checkTier1Expr(spec),
  ];
  return errors.length ? err(errors) : ok(spec);
}
