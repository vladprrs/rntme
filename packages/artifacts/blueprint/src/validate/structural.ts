import {
  err,
  ok,
  ERROR_CODES,
  type BlueprintError,
  type Result,
} from '../types/result.js';
import { isKnownTargetPath } from '../types/vars.js';
import type {
  ProjectBlueprint,
  ServiceDescriptor,
  ServiceKind,
} from '../types/artifact.js';

function isIntegrationKind(kind: ServiceKind): boolean {
  return kind === 'integration' || kind === 'integration-module';
}

export function validateBlueprintStructural(input: {
  project: ProjectBlueprint;
  serviceDirs: readonly string[];
  services: Record<string, ServiceDescriptor>;
}): Result<void> {
  const errors: BlueprintError[] = [];

  for (const slug of input.project.services) {
    if (!input.serviceDirs.includes(slug)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BLUEPRINT_STRUCT_DECLARED_SERVICE_DIR_MISSING,
        message: `declared service "${slug}" has no matching directory`,
        path: `project.services.${slug}`,
      });
    }
  }

  for (const slug of input.serviceDirs) {
    if (!input.project.services.includes(slug)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BLUEPRINT_STRUCT_UNDECLARED_SERVICE_DIR,
        message: `service directory "${slug}" is not declared in project.json`,
        path: `services/${slug}`,
      });
    }

    const service = input.services[slug];
    if (service === undefined) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BLUEPRINT_STRUCT_SERVICE_JSON_MISSING,
        message: `service "${slug}" is missing service.json`,
        path: `services/${slug}/service.json`,
      });
      continue;
    }

    const isMod = slug.startsWith('mod-');
    if (isMod && !isIntegrationKind(service.kind)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BLUEPRINT_STRUCT_MOD_KIND_MISMATCH,
        message: `service "${slug}" must use an integration kind`,
        path: `services/${slug}/service.json.kind`,
      });
    }
    if (!isMod && service.kind === 'integration') {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BLUEPRINT_STRUCT_MOD_KIND_MISMATCH,
        message: `integration service "${slug}" must use slug prefix "mod-"`,
        path: `services/${slug}`,
      });
    }
  }

  if (input.project.vars) {
    for (const [name, binding] of Object.entries(input.project.vars)) {
      if (!isKnownTargetPath(binding.from)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.BLUEPRINT_VARS_FROM_UNKNOWN_ROOT,
          message: `vars.${name}.from "${binding.from}" does not match a known target.* root`,
          path: `project.vars.${name}.from`,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(undefined);
}
