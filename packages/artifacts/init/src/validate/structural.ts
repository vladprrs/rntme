import type { InitArtifact, StructurallyValidInitArtifact } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type InitError, type Result } from '../types/result.js';

const URL_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const SUPPORTED_PROVIDERS = new Set(['seed-events']);
const SUPPORTED_MODES = new Set(['lifecycle']);

export function validateInitStructural(
  artifact: InitArtifact,
): Result<StructurallyValidInitArtifact> {
  const errors: InitError[] = [];

  if (!isSafeRelativePath(artifact.process.definition) || !artifact.process.definition.endsWith('.bpmn')) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.INIT_STRUCT_PROCESS_DEFINITION_PATH_INVALID,
      message: 'process.definition must be a relative .bpmn path inside init/',
      path: 'process.definition',
    });
  }

  const stepIds = new Set<string>();
  for (const [idx, step] of artifact.steps.entries()) {
    if (stepIds.has(step.id)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.INIT_STRUCT_STEP_ID_DUPLICATE,
        message: `duplicate init step id "${step.id}"`,
        path: `steps.${idx}.id`,
      });
    }
    stepIds.add(step.id);

    if (!SUPPORTED_PROVIDERS.has(step.provider)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.INIT_STRUCT_STEP_PROVIDER_UNSUPPORTED,
        message: `init step "${step.id}" uses unsupported provider "${step.provider}"`,
        path: `steps.${idx}.provider`,
      });
    }

    if (!SUPPORTED_MODES.has(step.mode)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.INIT_STRUCT_STEP_MODE_UNSUPPORTED,
        message: `init step "${step.id}" uses unsupported mode "${step.mode}"`,
        path: `steps.${idx}.mode`,
      });
    }

    if (!isSafeRelativePath(step.input.path)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.INIT_STRUCT_STEP_INPUT_PATH_INVALID,
        message: `init step "${step.id}" input.path must be relative inside init/`,
        path: `steps.${idx}.input.path`,
      });
    }
  }

  for (const [idx, step] of artifact.steps.entries()) {
    for (const dependency of step.dependsOn ?? []) {
      if (dependency === step.id) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.INIT_STRUCT_STEP_DEPENDS_ON_SELF,
          message: `init step "${step.id}" cannot depend on itself`,
          path: `steps.${idx}.dependsOn`,
        });
      } else if (!stepIds.has(dependency)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.INIT_STRUCT_STEP_DEPENDS_ON_UNKNOWN,
          message: `init step "${step.id}" depends on unknown step "${dependency}"`,
          path: `steps.${idx}.dependsOn`,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as StructurallyValidInitArtifact);
}

function isSafeRelativePath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (URL_SCHEME_RE.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}
