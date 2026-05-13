import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintError,
  type Result,
} from '../types/result.js';
import { extractPlaceholders } from '../types/vars.js';
import type {
  AuthProviderDecl,
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

  for (const [slug, service] of Object.entries(input.services)) {
    if (service.kind === 'domain' && service.artifacts.hasCommandHandlers) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN,
        message: `domain service "${slug}" must not include executable command handler files`,
        path: `services/${slug}/commands/handlers.mjs`,
      });
    }
  }

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
    if (declaration.kind === 'auth') {
      for (const [providerIndex, providerDecl] of declaration.providers.entries()) {
        const providerSlug = providerDecl.moduleSlug;
        const provider = input.services[providerSlug];
        const providerPath = `project.middleware.${name}.providers.${providerIndex}.moduleSlug`;
        if (provider === undefined) {
          errors.push({
            layer: 'composition',
            code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE,
            message: `middleware "${name}" provider[${providerIndex}] references unknown service "${providerSlug}"`,
            path: providerPath,
          });
          continue;
        }
        if (isPlatformTokensProvider(providerDecl)) {
          if (provider.kind !== 'domain') {
            errors.push({
              layer: 'composition',
              code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
              message: `middleware "${name}" provider[${providerIndex}] "${providerSlug}" must be a domain service for platform-tokens`,
              path: providerPath,
            });
          }
          continue;
        }
        if (!isIntegrationKind(provider.kind)) {
          errors.push({
            layer: 'composition',
            code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
            message: `middleware "${name}" provider[${providerIndex}] "${providerSlug}" must be an integration service`,
            path: providerPath,
          });
        }
      }
      continue;
    }
    const providerSlug = declaration.provider;
    if (providerSlug === undefined) continue;
    const provider = input.services[providerSlug];
    if (provider === undefined) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE,
        message: `middleware "${name}" references unknown provider service "${providerSlug}"`,
        path: `project.middleware.${name}.provider`,
      });
      continue;
    }
    if (!isIntegrationKind(provider.kind)) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
        message: `middleware "${name}" provider "${providerSlug}" must be an integration service`,
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
  errors.push(...validateVars(input.project));

  if (errors.length > 0) return err(errors);
  return ok({ httpBaseByService, uiPathsByService });
}

function validateVars(project: ProjectBlueprint): BlueprintError[] {
  const errors: BlueprintError[] = [];
  const declared = new Set(Object.keys(project.vars ?? {}));
  const used = new Set<string>();

  for (const [moduleKey, mod] of Object.entries(project.modules ?? {})) {
    for (const placeholder of extractPlaceholders(mod.publicConfig ?? {})) {
      used.add(placeholder);
      if (!declared.has(placeholder)) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_CONSISTENCY_VAR_UNDECLARED,
          message: `placeholder "${placeholder}" used in modules.${moduleKey}.publicConfig is not declared in project.vars`,
          path: `project.modules.${moduleKey}.publicConfig`,
        });
      }
    }
  }

  for (const [name, middleware] of Object.entries(project.middleware ?? {})) {
    for (const placeholder of extractPlaceholders(middleware)) {
      used.add(placeholder);
      if (!declared.has(placeholder)) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_CONSISTENCY_VAR_UNDECLARED,
          message: `placeholder "${placeholder}" used in middleware.${name} is not declared in project.vars`,
          path: `project.middleware.${name}`,
        });
      }
    }
  }

  for (const name of declared) {
    if (!used.has(name)) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_CONSISTENCY_VAR_UNUSED,
        message: `vars.${name} is declared but never referenced as \${${name}}`,
        path: `project.vars.${name}`,
      });
    }
  }

  return errors;
}

function checkAuthModuleVendors(
  project: ProjectBlueprint,
  _services: Record<string, CompositionServiceInput>,
  catalogManifest?: CatalogManifest | null,
  discoveredModules?: Record<string, DiscoveredModule> | null,
): BlueprintError[] {
  if (catalogManifest == null || discoveredModules == null) return [];

  const errors: BlueprintError[] = [];
  for (const [middlewareName, declaration] of Object.entries(project.middleware ?? {})) {
    for (const [providerIndex, providerDecl] of authProvidersForComposition(declaration).entries()) {
      // platform-tokens provider is satisfied by an in-project domain service, so it does not
      // need an identity vendor module to be discovered or vendor-matched.
      if (isPlatformTokensProvider(providerDecl)) continue;

      const identityModule = catalogManifest.categoryToModule.identity;
      if (identityModule === undefined) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_MISMATCH,
          message: `auth middleware "${middlewareName}" provider[${providerIndex}] requires a project.modules.identity module`,
          path: `project.middleware.${middlewareName}.providers.${providerIndex}`,
        });
        continue;
      }

      const discovered = discoveredModules[identityModule];
      if (discovered === undefined) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_MISMATCH,
          message: `auth middleware "${middlewareName}" provider[${providerIndex}] references identity module "${identityModule}" but it was not discovered`,
          path: `project.middleware.${middlewareName}.providers.${providerIndex}`,
        });
        continue;
      }

      if (discovered.manifest.vendor !== providerDecl.provider) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_MISMATCH,
          message: `auth middleware "${middlewareName}" provider[${providerIndex}] "${providerDecl.provider}" must match identity module vendor "${discovered.manifest.vendor}"`,
          path: `project.middleware.${middlewareName}.providers.${providerIndex}.provider`,
        });
      }
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
    if (!authMiddlewareIsMounted(project, middlewareName)) continue;

    for (const [providerIndex, providerDecl] of declaration.providers.entries()) {
      // platform-tokens provider authenticates via a domain service, not an identity module —
      // the introspect path/port come from the provider decl itself, not from a module manifest.
      if (isPlatformTokensProvider(providerDecl)) continue;

      const canonicalModule = catalogManifest.categoryToModule.identity;
      if (canonicalModule === undefined) continue;

      const edgeAuth = catalogManifest.moduleEdgeAuth[canonicalModule];
      if (edgeAuth !== null && edgeAuth !== undefined) continue;

      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_AUTH_MODULE_EDGE_AUTH_MISSING,
        message: `auth middleware "${middlewareName}" provider[${providerIndex}] requires identity module "${canonicalModule}" to declare capabilities.edgeAuth`,
        path: `project.middleware.${middlewareName} -> ${canonicalModule}/module.json#capabilities.edgeAuth`,
      });
    }
  }
  return errors;
}

function authMiddlewareIsMounted(project: ProjectBlueprint, middlewareName: string): boolean {
  return (project.mounts ?? []).some((mount) => mount.use.includes(middlewareName));
}

function authProvidersForComposition(declaration: MiddlewareDecl): readonly AuthProviderDecl[] {
  return declaration.kind === 'auth' ? declaration.providers : [];
}

function isPlatformTokensProvider(provider: AuthProviderDecl): boolean {
  return provider.provider === 'platform-tokens';
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
