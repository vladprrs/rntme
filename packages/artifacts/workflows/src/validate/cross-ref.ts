import type { StructurallyValidWorkflows, ValidatedWorkflows } from '../types/artifact.js';
import type { WorkflowCrossRefContext } from '../types/context.js';
import { ok, type Result } from '../types/result.js';

export function validateWorkflowCrossRef(
  artifact: StructurallyValidWorkflows,
  _ctx: WorkflowCrossRefContext,
): Result<ValidatedWorkflows> {
  return ok(artifact as ValidatedWorkflows);
}
