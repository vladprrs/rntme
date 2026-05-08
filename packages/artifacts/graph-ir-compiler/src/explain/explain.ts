import type { AuthoringSpecOutput } from '../parse/schema.js';
import type { CanonicalGraph } from '../types/canonical.js';
import type { SemanticPlan } from '../types/semantic-plan.js';
import type { RelOp } from '../types/relational.js';
import type { GraphIrError, Result } from '../types/result.js';
import { err, ok, ERROR_CODES } from '../types/result.js';
import { createPdmResolver, parsePdm, validatePdm, type ValidatedPdm } from '@rntme/pdm';
import { parseQsm, validateQsm, type ValidatedQsm } from '@rntme/qsm';

export type ExplainArtifacts = {
  parsed?: AuthoringSpecOutput;
  canonical?: { graphs: Record<string, CanonicalGraph> };
  semanticPlan?: SemanticPlan;
  relational?: RelOp;
};

export type ExplainOk = {
  ok: true;
  value: {
    parsed: AuthoringSpecOutput;
    canonical: { graphs: Record<string, CanonicalGraph> };
    semanticPlan: SemanticPlan;
    relational: RelOp;
    sql: string;
    paramOrder: string[];
  };
};

export type ExplainErr = {
  ok: false;
  artifacts: ExplainArtifacts;
  errors: readonly GraphIrError[];
};

export type ExplainOutput = ExplainOk | ExplainErr;

export type ParsedGraphIrArtifacts = { pdm: ValidatedPdm; qsm: ValidatedQsm };

/** Parse and validate PDM + QSM using @rntme/pdm / @rntme/qsm (graph-ir error shape). */
export function parseGraphIrArtifacts(rawPdm: unknown, rawQsm: unknown): Result<ParsedGraphIrArtifacts> {
  const pdmParse = parsePdm(rawPdm);
  if (!pdmParse.ok) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: 'PDM failed schema validation',
      },
    ]);
  }
  const pdmVal = validatePdm(pdmParse.value);
  if (!pdmVal.ok) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: pdmVal.errors[0]?.message ?? 'PDM validation failed',
      },
    ]);
  }
  const pdm: ValidatedPdm = pdmVal.value;

  const qsmParse = parseQsm(rawQsm);
  if (!qsmParse.ok) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: 'QSM failed schema validation',
      },
    ]);
  }
  const qsmVal = validateQsm(qsmParse.value, createPdmResolver(pdm));
  if (!qsmVal.ok) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: qsmVal.errors[0]?.message ?? 'QSM validation failed',
      },
    ]);
  }
  const qsm: ValidatedQsm = qsmVal.value;

  return ok({ pdm, qsm });
}
