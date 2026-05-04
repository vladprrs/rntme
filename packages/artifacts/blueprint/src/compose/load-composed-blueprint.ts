import { createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { loadBlueprint } from '../load/load-blueprint.js';
import type {
  CatalogManifest,
  ComposedBlueprint,
  CompositionService,
  ValidatedServiceMember,
} from '../types/artifact.js';
import { ok, type Result } from '../types/result.js';
import { validateBlueprintComposition } from '../validate/composition.js';
import { buildBindingRegistry } from './binding-registry.js';
import { compileServiceUi } from './compile-service-ui.js';
import { buildCatalog } from './catalog.js';
import { discoverModules } from './modules.js';
import { renderVirtualEntry } from './virtual-entry.js';
import {
  buildPublicConfigSidecar,
  validateModuleClientExports,
  validateModulePublicConfigs,
} from './validate-modules.js';
import { discoverServiceArtifacts } from './discover-service-artifacts.js';
import { loadServiceMember } from './load-service-member.js';

export function loadComposedBlueprint(dir: string): Result<ComposedBlueprint> {
  const loaded = loadBlueprint(dir);
  if (!loaded.ok) return loaded;

  const services: Record<string, CompositionService> = {};
  for (const [slug, service] of Object.entries(loaded.value.services)) {
    services[slug] = {
      ...service,
      artifacts: discoverServiceArtifacts(dir, slug),
    };
  }

  const routing = validateBlueprintComposition({
    project: loaded.value.project,
    services,
  });
  if (!routing.ok) return routing;

  const hasModules =
    loaded.value.project.modules !== undefined &&
    Object.keys(loaded.value.project.modules).length > 0;

  let catalogManifest: CatalogManifest | null = null;
  let publicConfigJson: string | null = null;
  let virtualEntrySource: string | null = null;

  if (hasModules) {
    const discovered = discoverModules({ projectDir: dir });
    if (!discovered.ok) return discovered;

    const catalog = buildCatalog(discovered.value);
    if (!catalog.ok) return catalog;

    const moduleComposition = validateBlueprintComposition({
      project: loaded.value.project,
      services,
      catalogManifest: catalog.value,
      discoveredModules: discovered.value,
    });
    if (!moduleComposition.ok) return moduleComposition;

    const pub = validateModulePublicConfigs(discovered.value);
    if (!pub.ok) return pub;

    const exp = validateModuleClientExports(discovered.value, catalog.value);
    if (!exp.ok) return exp;

    const virtualResult = renderVirtualEntry(catalog.value);
    if (!virtualResult.ok) return virtualResult;
    catalogManifest = catalog.value;
    publicConfigJson = buildPublicConfigSidecar(discovered.value);
    virtualEntrySource = virtualResult.value;
  }

  const pdmResolver = createPdmResolver(loaded.value.pdm);
  const allEventTypes = deriveEventTypes(loaded.value.pdm);
  const validatedServices: Record<string, ValidatedServiceMember> = {};
  const declaredModules = new Set(
    Object.values(services)
      .filter((service) => service.kind === 'integration' || service.kind === 'integration-module')
      .map((service) => service.slug),
  );

  for (const slug of loaded.value.project.services) {
    const service = services[slug];
    if (service === undefined) continue;

    const loadedService = loadServiceMember({
      rootDir: dir,
      service,
      pdm: loaded.value.pdm,
      pdmResolver,
      allEventTypes,
      declaredModules,
    });
    if (!loadedService.ok) return loadedService;

    validatedServices[slug] = loadedService.value;
  }

  const composedValidation = validateBlueprintComposition({
    project: loaded.value.project,
    services: validatedServices,
  });
  if (!composedValidation.ok) return composedValidation;

  const bindingRegistry = buildBindingRegistry({
    httpBaseByService: composedValidation.value.httpBaseByService,
    bindingsByService: collectServiceBindings(validatedServices),
  });

  for (const [slug, service] of Object.entries(validatedServices)) {
    const compiledUi = compileServiceUi({
      rootDir: dir,
      serviceSlug: slug,
      bindingRegistry,
      uiRoutePatterns: composedValidation.value.uiPathsByService[slug] ?? [],
      catalogManifest,
    });
    if (!compiledUi.ok) return compiledUi;

    validatedServices[slug] = {
      ...service,
      compiledUi: compiledUi.value,
    };
  }

  return ok({
    project: loaded.value.project,
    pdm: loaded.value.pdm,
    routing: composedValidation.value,
    bindingRegistry,
    services: validatedServices,
    catalogManifest,
    publicConfigJson,
    virtualEntrySource,
    varsManifest: loaded.value.project.vars ?? {},
  });
}

function collectServiceBindings(
  services: Record<string, ValidatedServiceMember>,
): Record<
  string,
  ReadonlyArray<{ bindingId: string; method: 'GET' | 'POST'; path: string }>
> {
  const bindingsByService: Record<
    string,
    Array<{ bindingId: string; method: 'GET' | 'POST'; path: string }>
  > = {};

  for (const [slug, service] of Object.entries(services)) {
    if (service.bindings === null) continue;

    bindingsByService[slug] = Object.entries(service.bindings.resolved).map(
      ([bindingId, binding]) => ({
        bindingId,
        method: binding.entry.http.method,
        path: binding.entry.http.path,
      }),
    );
  }

  return bindingsByService;
}
