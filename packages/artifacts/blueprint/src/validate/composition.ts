import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintError,
  type Result,
} from '../types/result.js';
import { bindAsName } from '@rntme/bindings';
import type {
  CatalogManifest,
  CompositionService,
  MiddlewareDecl,
  ProjectBlueprint,
  ProjectRoutingContext,
  ServiceKind,
  ServiceGraphSpec,
} from '../types/artifact.js';
import type { ValidatedBindings } from '@rntme/bindings';
import type { DiscoveredModule } from '../compose/modules.js';

type CompositionServiceInput = CompositionService & {
  graphSpec?: ServiceGraphSpec | null;
  bindings?: ValidatedBindings | null;
};

function isIntegrationKind(kind: ServiceKind): boolean {
  return kind === 'integration' || kind === 'integration-module';
}

export function validateBlueprintComposition(input: {
  project: ProjectBlueprint;
  services: Record<string, CompositionServiceInput>;
  catalogManifest?: CatalogManifest | null;
  discoveredModules?: Record<string, DiscoveredModule> | null;
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
    const providerSlug = authModuleSlugForComposition(declaration);
    if (providerSlug === undefined) continue;

    const provider = input.services[providerSlug];
    if (provider === undefined) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE,
        message: `middleware "${name}" references unknown provider service "${providerSlug}"`,
        path: declaration.kind === 'auth' && declaration.moduleSlug !== undefined
          ? `project.middleware.${name}.moduleSlug`
          : `project.middleware.${name}.provider`,
      });
      continue;
    }

    if (!isIntegrationKind(provider.kind)) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
        message: `middleware "${name}" provider "${providerSlug}" must be an integration service`,
        path: declaration.kind === 'auth' && declaration.moduleSlug !== undefined
          ? `project.middleware.${name}.moduleSlug`
          : `project.middleware.${name}.provider`,
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

  errors.push(...checkMountedAuthAudiences(input.project, input.services));
  errors.push(...checkAuthModuleVendors(
    input.project,
    input.services,
    input.catalogManifest,
    input.discoveredModules,
  ));
  errors.push(...checkAuthModuleEdgeAuth(
    input.project,
    input.catalogManifest,
  ));
  errors.push(...checkGraphPreRefs(input.services));

  if (errors.length > 0) return err(errors);
  return ok({ httpBaseByService, uiPathsByService });
}

function checkAuthModuleVendors(
  project: ProjectBlueprint,
  services: Record<string, CompositionServiceInput>,
  catalogManifest?: CatalogManifest | null,
  discoveredModules?: Record<string, DiscoveredModule> | null,
): BlueprintError[] {
  if (catalogManifest == null || discoveredModules == null) return [];

  const errors: BlueprintError[] = [];
  for (const [middlewareName, declaration] of Object.entries(project.middleware ?? {})) {
    if (declaration.kind !== 'auth') continue;
    if (
      declaration.moduleSlug === undefined &&
      declaration.provider !== undefined &&
      services[declaration.provider] !== undefined
    ) {
      continue;
    }

    const identityModule = catalogManifest?.categoryToModule.identity;
    if (identityModule === undefined) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_MISMATCH,
        message: `auth middleware "${middlewareName}" requires a project.modules.identity module`,
        path: `project.middleware.${middlewareName}`,
      });
      continue;
    }

    const discovered = discoveredModules?.[identityModule];
    if (discovered === undefined) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_MISMATCH,
        message: `auth middleware "${middlewareName}" references identity module "${identityModule}" but it was not discovered`,
        path: `project.middleware.${middlewareName}`,
      });
      continue;
    }

    if (declaration.provider === undefined) continue;
    if (discovered.manifest.vendor !== declaration.provider) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_MISMATCH,
        message: `auth middleware "${middlewareName}" provider "${declaration.provider}" must match identity module vendor "${discovered.manifest.vendor}"`,
        path: `project.middleware.${middlewareName}.provider`,
      });
    }
  }
  return errors;
}

function checkAuthModuleEdgeAuth(
  project: ProjectBlueprint,
  catalogManifest?: CatalogManifest | null,
): BlueprintError[] {
  if (catalogManifest == null) return [];

  const errors: BlueprintError[] = [];
  for (const [middlewareName, declaration] of Object.entries(project.middleware ?? {})) {
    if (declaration.kind !== 'auth') continue;
    if (declaration.moduleSlug === undefined) continue;
    if (!authMiddlewareIsMounted(project, middlewareName)) continue;

    const canonicalModule = catalogManifest.categoryToModule.identity;
    if (canonicalModule === undefined) continue;

    const edgeAuth = catalogManifest.moduleEdgeAuth[canonicalModule];
    if (edgeAuth !== null && edgeAuth !== undefined) continue;

    errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING,
      message: `auth middleware "${middlewareName}" requires identity module "${canonicalModule}" to declare capabilities.edgeAuth`,
      path: `project.middleware.${middlewareName} -> ${canonicalModule}/module.json#capabilities.edgeAuth`,
    });
  }
  return errors;
}

function authMiddlewareIsMounted(project: ProjectBlueprint, middlewareName: string): boolean {
  return (project.mounts ?? []).some((mount) => mount.use.includes(middlewareName));
}

function authModuleSlugForComposition(declaration: MiddlewareDecl): string | undefined {
  if (declaration.kind === 'auth') {
    return declaration.moduleSlug ?? declaration.provider;
  }
  return declaration.provider;
}

function mountedServicesForMiddleware(project: ProjectBlueprint, middlewareName: string): Set<string> {
  const services = new Set<string>();
  for (const mount of project.mounts ?? []) {
    if (!mount.use.includes(middlewareName)) continue;
    const service = serviceForMountTarget(project, mount.target);
    if (service !== undefined) services.add(service);
  }
  return services;
}

function serviceForMountTarget(project: ProjectBlueprint, target: string): string | undefined {
  if (target.startsWith('http:')) {
    const route = target.slice('http:'.length);
    return project.routes?.http?.[route];
  }
  if (target.startsWith('ui:')) {
    const route = target.slice('ui:'.length);
    return project.routes?.ui?.[route];
  }
  return undefined;
}

function checkMountedAuthAudiences(
  project: ProjectBlueprint,
  services: Record<string, CompositionServiceInput>,
): BlueprintError[] {
  const errors: BlueprintError[] = [];
  for (const [middlewareName, declaration] of Object.entries(project.middleware ?? {})) {
    if (declaration.kind !== 'auth' || declaration.audience === undefined || declaration.moduleSlug === undefined) continue;
    for (const serviceSlug of mountedServicesForMiddleware(project, middlewareName)) {
      const bindings = services[serviceSlug]?.bindings;
      if (bindings === undefined || bindings === null) continue;
      for (const [bindingId, resolved] of Object.entries(bindings.resolved)) {
        for (const [idx, step] of (resolved.entry.pre ?? []).entries()) {
          if (step.kind !== 'module-rpc') continue;
          if (step.module !== declaration.moduleSlug || step.rpc !== 'IntrospectSession') continue;
          const input = step.input as Record<string, unknown>;
          const audience = typeof input.audience === 'string' ? input.audience : undefined;
          if (audience !== declaration.audience) {
            errors.push({
              layer: 'composition',
              code: ERROR_CODES.BLUEPRINT_AUTH_AUDIENCE_MISMATCH,
              message: `binding "${bindingId}" IntrospectSession pre[${idx}] audience must match auth middleware "${middlewareName}"`,
              path: `services.${serviceSlug}.bindings.${bindingId}.pre[${idx}].input.audience`,
            });
          }
        }
      }
    }
  }
  return errors;
}

function checkGraphPreRefs(services: Record<string, CompositionServiceInput>): BlueprintError[] {
  const errors: BlueprintError[] = [];
  for (const [serviceSlug, service] of Object.entries(services)) {
    if (service.graphSpec === undefined || service.graphSpec === null) continue;
    if (service.bindings === undefined || service.bindings === null) continue;
    for (const [bindingId, resolved] of Object.entries(service.bindings.resolved)) {
      const graph = service.graphSpec.graphs[resolved.entry.graph];
      if (graph === undefined) continue;
      const refs = collectPreRefHeads(graph);
      if (refs.size === 0) continue;
      const allowed = new Set((resolved.entry.pre ?? []).map((step) => bindAsName(step.bindAs)));
      for (const ref of refs) {
        if (allowed.has(ref)) continue;
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_GRAPH_PRE_REF_UNDEFINED_BINDING,
          message: `graph "${graph.id}" references $pre.${ref}, but binding "${bindingId}" has no pre[].bindAs "${ref}"`,
          path: `services.${serviceSlug}.graphs.${graph.id}`,
        });
      }
    }
  }
  return errors;
}

function collectPreRefHeads(value: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.$pre === 'string') {
      const head = obj.$pre.split('.')[0];
      if (head) out.add(head);
      return;
    }
    for (const child of Object.values(obj)) walk(child);
  };
  walk(value);
  return out;
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
