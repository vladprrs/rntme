import type { ValidatedWorkflows, WorkflowArtifact } from '../types/artifact.js';
import type { WorkflowCrossRefContext } from '../types/context.js';
import type { Result } from '../types/result.js';
import { validateWorkflowCrossRef } from './cross-ref.js';
import { validateWorkflowStructural } from './structural.js';

export { validateWorkflowCrossRef, validateWorkflowStructural };

export function validateWorkflows(
  artifact: WorkflowArtifact,
  ctx: WorkflowCrossRefContext,
): Result<ValidatedWorkflows> {
  const structural = validateWorkflowStructural(artifact);
  if (!structural.ok) return structural;
  return validateWorkflowCrossRef(structural.value, ctx);
}
