import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintError,
  type Result,
} from '../types/result.js';
import type {
  CompositionService,
  ProjectBlueprint,
  ProjectRoutingContext,
} from '../types/artifact.js';

export function validateBlueprintComposition(input: {
  project: ProjectBlueprint;
  services: Record<string, CompositionService>;
}): Result<ProjectRoutingContext> {
  const errors: BlueprintError[] = [];
  const httpBaseByService: Record<string, string> = {};
  const uiPathsByService: Record<string, string[]> = {};

  const routeTargets = collectRouteTargets(input.project);

  for (const [routePath, slug] of Object.entries(input.project.routes?.http ?? {})) {
    const service = input.services[slug];
    if (service === undefined) {
      errors.push(routeUnknownService(routePath, slug, 'http'));
      continue;
    }

    if (!service.artifacts.hasBindings) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_HTTP_ROUTE_TARGET_MISSING_BINDINGS,
        message: `http route "${routePath}" targets service "${slug}" without bindings`,
        path: `project.routes.http.${routePath}`,
      });
    }

    if (httpBaseByService[slug] !== undefined) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_HTTP_ROUTE_DUPLICATE_SERVICE,
        message: `service "${slug}" is mounted on more than one http route`,
        path: `project.routes.http.${routePath}`,
      });
      continue;
    }

    httpBaseByService[slug] = routePath;
  }

  for (const [routePath, slug] of Object.entries(input.project.routes?.ui ?? {})) {
    const service = input.services[slug];
    if (service === undefined) {
      errors.push(routeUnknownService(routePath, slug, 'ui'));
      continue;
    }

    if (service.kind !== 'domain') {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_NOT_DOMAIN,
        message: `ui route "${routePath}" targets non-domain service "${slug}"`,
        path: `project.routes.ui.${routePath}`,
      });
    }

    if (!service.artifacts.hasUi) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_MISSING_UI,
        message: `ui route "${routePath}" targets service "${slug}" without ui`,
        path: `project.routes.ui.${routePath}`,
      });
    }

    const paths = uiPathsByService[slug] ?? [];
    paths.push(routePath);
    uiPathsByService[slug] = paths;
  }

  for (const [name, declaration] of Object.entries(input.project.middleware ?? {})) {
    if (declaration.provider === undefined) continue;

    const provider = input.services[declaration.provider];
    if (provider === undefined) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE,
        message: `middleware "${name}" references unknown provider service "${declaration.provider}"`,
        path: `project.middleware.${name}.provider`,
      });
      continue;
    }

    if (provider.kind !== 'integration') {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
        message: `middleware "${name}" provider "${declaration.provider}" must be an integration service`,
        path: `project.middleware.${name}.provider`,
      });
    }
  }

  for (const [index, mount] of (input.project.mounts ?? []).entries()) {
    if (!routeTargets.has(mount.target)) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_TARGET,
        message: `middleware mount target "${mount.target}" does not refer to a project route`,
        path: `project.mounts.${index}.target`,
      });
    }

    for (const middlewareName of mount.use) {
      if (input.project.middleware?.[middlewareName] === undefined) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_MIDDLEWARE,
          message: `middleware mount references unknown middleware "${middlewareName}"`,
          path: `project.mounts.${index}.use`,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok({ httpBaseByService, uiPathsByService });
}

function collectRouteTargets(project: ProjectBlueprint): Set<string> {
  const targets = new Set<string>();
  for (const routePath of Object.keys(project.routes?.http ?? {})) {
    targets.add(`http:${routePath}`);
  }
  for (const routePath of Object.keys(project.routes?.ui ?? {})) {
    targets.add(`ui:${routePath}`);
  }
  return targets;
}

function routeUnknownService(
  routePath: string,
  slug: string,
  kind: 'http' | 'ui',
): BlueprintError {
  return {
    layer: 'composition',
    code: ERROR_CODES.BLUEPRINT_COMPOSE_ROUTE_UNKNOWN_SERVICE,
    message: `${kind} route "${routePath}" targets unknown service "${slug}"`,
    path: `project.routes.${kind}.${routePath}`,
  };
}
