import type { StructurallyValidWorkflows, ValidatedWorkflows } from '../types/artifact.js';
import type { WorkflowCrossRefContext } from '../types/context.js';
import { ERROR_CODES, err, ok, type Result, type WorkflowError } from '../types/result.js';

export function validateWorkflowCrossRef(
  artifact: StructurallyValidWorkflows,
  ctx: WorkflowCrossRefContext,
): Result<ValidatedWorkflows> {
  const errors: WorkflowError[] = [];
  const serviceSet = new Set(ctx.services);

  for (const [idx, definition] of artifact.definitions.entries()) {
    if (ctx.fileExists !== undefined && !ctx.fileExists(definition.bpmnFile)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_BPMN_FILE_MISSING,
        message: `BPMN file "${definition.bpmnFile}" does not exist under workflows/`,
        path: `definitions.${idx}.bpmnFile`,
      });
    }
  }

  for (const [idx, start] of artifact.messageStarts.entries()) {
    if (!serviceSet.has(start.event.service)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_EVENT_UNKNOWN_SERVICE,
        message: `messageStart "${start.id}" references unknown service "${start.event.service}"`,
        path: `messageStarts.${idx}.event.service`,
      });
      continue;
    }
    if (ctx.resolveEvent(start.event) === null) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_EVENT_UNKNOWN_TYPE,
        message: `messageStart "${start.id}" references unknown event ${start.event.service}.${start.event.aggregateType}.${start.event.eventType}`,
        path: `messageStarts.${idx}.event`,
      });
    }
  }

  for (const [idx, task] of artifact.serviceTasks.entries()) {
    const resolved = ctx.resolveBindingRef(task.bindingRef);
    if (resolved === null) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_BINDING_REF_UNKNOWN,
        message: `serviceTask "${task.taskId}" references unknown binding "${task.bindingRef}"`,
        path: `serviceTasks.${idx}.bindingRef`,
      });
      continue;
    }
    if (resolved.kind !== 'command') {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_BINDING_NOT_COMMAND,
        message: `serviceTask "${task.taskId}" binding "${task.bindingRef}" must be a command binding`,
        path: `serviceTasks.${idx}.bindingRef`,
      });
    }
    const serviceFromRef = task.bindingRef.split('.')[0];
    if (serviceFromRef !== undefined && serviceFromRef !== resolved.service) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.WORKFLOWS_XREF_BINDING_SERVICE_MISMATCH,
        message: `serviceTask "${task.taskId}" binding service "${serviceFromRef}" resolved to "${resolved.service}"`,
        path: `serviceTasks.${idx}.bindingRef`,
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as ValidatedWorkflows);
}
