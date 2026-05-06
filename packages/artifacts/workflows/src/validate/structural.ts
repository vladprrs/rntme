import type {
  StructurallyValidWorkflows,
  WorkflowArtifact,
  WorkflowMappingValue,
} from '../types/artifact.js';
import { ERROR_CODES, err, ok, type Result, type WorkflowError } from '../types/result.js';

const PATH_EXPR_RE = /^\$(event|process)(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const URL_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export function validateWorkflowStructural(
  artifact: WorkflowArtifact,
): Result<StructurallyValidWorkflows> {
  const errors: WorkflowError[] = [];
  const definitionIds = new Set<string>();
  const bpmnFiles = new Map<string, string>();

  for (const [idx, definition] of artifact.definitions.entries()) {
    if (definitionIds.has(definition.id)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_DEFINITION_ID_DUPLICATE,
        message: `duplicate workflow definition id "${definition.id}"`,
        path: `definitions.${idx}.id`,
      });
    }
    definitionIds.add(definition.id);

    const prior = bpmnFiles.get(definition.bpmnFile);
    if (prior !== undefined) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_BPMN_FILE_DUPLICATE,
        message: `definitions "${prior}" and "${definition.id}" both use BPMN file "${definition.bpmnFile}"`,
        path: `definitions.${idx}.bpmnFile`,
      });
    }
    bpmnFiles.set(definition.bpmnFile, definition.id);

    if (!isValidBpmnPath(definition.bpmnFile)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_MAPPING_PATH_INVALID,
        message: `definition "${definition.id}" bpmnFile must be a relative .bpmn path inside workflows/`,
        path: `definitions.${idx}.bpmnFile`,
      });
    }
  }

  const messageStartIds = new Set<string>();
  for (const [idx, start] of artifact.messageStarts.entries()) {
    if (messageStartIds.has(start.id)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_MESSAGE_START_ID_DUPLICATE,
        message: `duplicate messageStart id "${start.id}"`,
        path: `messageStarts.${idx}.id`,
      });
    }
    messageStartIds.add(start.id);
    if (!definitionIds.has(start.definition)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_UNKNOWN_DEFINITION,
        message: `messageStart "${start.id}" references unknown definition "${start.definition}"`,
        path: `messageStarts.${idx}.definition`,
      });
    }
    checkPathExpression(start.businessKey, `messageStarts.${idx}.businessKey`, errors);
    for (const [name, value] of Object.entries(start.variables ?? {})) {
      checkMappingValue(value, `messageStarts.${idx}.variables.${name}`, errors);
    }
  }

  const taskIdsByDefinition = new Map<string, Set<string>>();
  for (const [idx, task] of artifact.serviceTasks.entries()) {
    const taskIds = taskIdsByDefinition.get(task.definition) ?? new Set<string>();
    if (taskIds.has(task.taskId)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_SERVICE_TASK_ID_DUPLICATE,
        message: `duplicate service task "${task.taskId}" in definition "${task.definition}"`,
        path: `serviceTasks.${idx}.taskId`,
      });
    }
    taskIds.add(task.taskId);
    taskIdsByDefinition.set(task.definition, taskIds);
    if (!definitionIds.has(task.definition)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.WORKFLOWS_STRUCT_UNKNOWN_DEFINITION,
        message: `serviceTask "${task.taskId}" references unknown definition "${task.definition}"`,
        path: `serviceTasks.${idx}.definition`,
      });
    }
    for (const [name, value] of Object.entries(task.input ?? {})) {
      checkMappingValue(value, `serviceTasks.${idx}.input.${name}`, errors);
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as StructurallyValidWorkflows);
}

function isValidBpmnPath(path: string): boolean {
  if (!path.endsWith('.bpmn')) return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (URL_SCHEME_RE.test(path)) return false;

  const segments = path.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function checkPathExpression(value: string, path: string, errors: WorkflowError[]): void {
  if (PATH_EXPR_RE.test(value)) return;

  errors.push({
    layer: 'structural',
    code: ERROR_CODES.WORKFLOWS_STRUCT_MAPPING_PATH_INVALID,
    message: `mapping expression "${value}" must start with $event or $process and use dot paths`,
    path,
  });
}

function checkMappingValue(value: WorkflowMappingValue, path: string, errors: WorkflowError[]): void {
  if (typeof value === 'string') {
    if (value.startsWith('$')) checkPathExpression(value, path, errors);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => checkMappingValue(item, `${path}.${idx}`, errors));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      checkMappingValue(nested, `${path}.${key}`, errors);
    }
  }
}
