import type { AuthoringSpecOutput } from '../parse/schema.js';
import type { CanonicalGraph } from '../types/canonical.js';
import type { SemanticPlan } from '../types/semantic-plan.js';
import type { RelOp } from '../types/relational.js';
import type { GraphIrError } from '../types/result.js';

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
  errors: GraphIrError[];
};

export type ExplainOutput = ExplainOk | ExplainErr;
