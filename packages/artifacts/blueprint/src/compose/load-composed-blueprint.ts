import { createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { loadBlueprint } from '../load/load-blueprint.js';
import type {
  CatalogManifest,
  ComposedBlueprint,
  CompositionService,
  UiAssetManifest,
  UiAssetSource,
  UiPresetExport,
  ValidatedServiceMember,
} from '../types/artifact.js';
import { ok, type Result } from '../types/result.js';
import { validateBlueprintComposition } from '../validate/composition.js';
import { buildBindingRegistry } from './binding-registry.js';
import { compileServiceUi } from './compile-service-ui.js';
import { buildCatalog } from './catalog.js';
import { discoverModules, type DiscoveredModule } from './modules.js';
import { renderVirtualEntry } from './virtual-entry.js';
import {
  buildPublicConfigSidecar,
  validateModuleClientExports,
  validateModulePublicConfigs,
} from './validate-modules.js';
import { discoverServiceArtifacts } from './discover-service-artifacts.js';
import { loadServiceMember } from './load-service-member.js';
import { loadProjectWorkflows } from './project-workflows.js';
import { loadProjectInit } from './project-init.js';
import { buildModuleClientSurfaces, emptyUiAssetManifest } from './module-client-assets.js';

export async function loadComposedBlueprint(
  dir: string,
): Promise<Result<ComposedBlueprint>> {
  const loaded = await loadBlueprint(dir);
  if (!loaded.ok) return loaded;

  const services: Record<string, CompositionService> = {};
  for (const [slug, service] of Object.entries(loaded.value.services)) {
    services[slug] = {
      ...service,
      artifacts: discoverServiceArtifacts(dir, slug),
    };
  }

  // Module discovery runs before service load so the final composition
  // validation can see the catalog/discovered modules. We don't gate this
  // with an early validateBlueprintComposition call — the single call after
  // services load covers every check the early ones did, plus the
  // bindings/graphSpec checks that require validatedServices.
  const hasModules =
    loaded.value.project.modules !== undefined &&
    Object.keys(loaded.value.project.modules).length > 0;

  let catalogManifest: CatalogManifest | null = null;
  let publicConfigJson: string | null = null;
  let virtualEntrySource: string | null = null;
  let discoveredModulesValue: Record<string, DiscoveredModule> | null = null;
  let uiAssetManifest: UiAssetManifest = emptyUiAssetManifest();
  let uiAssetSources: readonly UiAssetSource[] = [];
  let uiPresetExports: readonly UiPresetExport[] = [];

  if (hasModules) {
    const discovered = await discoverModules({ projectDir: dir });
    if (!discovered.ok) return discovered;

    const catalog = buildCatalog(discovered.value);
    if (!catalog.ok) return catalog;

    const pub = validateModulePublicConfigs(discovered.value);
    if (!pub.ok) return pub;

    const exp = validateModuleClientExports(discovered.value, catalog.value);
    if (!exp.ok) return exp;

    const virtualResult = renderVirtualEntry(catalog.value);
    if (!virtualResult.ok) return virtualResult;
    catalogManifest = catalog.value;
    publicConfigJson = buildPublicConfigSidecar(discovered.value);
    virtualEntrySource = virtualResult.value;
    discoveredModulesValue = discovered.value;

    const clientSurfaces = buildModuleClientSurfaces(discovered.value);
    if (!clientSurfaces.ok) return clientSurfaces;
    uiAssetManifest = clientSurfaces.value.manifest;
    uiAssetSources = clientSurfaces.value.sources;
    uiPresetExports = clientSurfaces.value.presets;
  }

  const pdmResolver = createPdmResolver(loaded.value.pdm);
  const allEventTypes = deriveEventTypes(loaded.value.pdm);
  const validatedServices: Record<string, ValidatedServiceMember> = {};
  const declaredModules = new Set(
    Object.values(services)
      .filter((service) => service.kind === 'integration' || service.kind === 'integration-module')
      .map((service) => service.slug),
  );

  // Load each declared service member in parallel.
  const orderedServiceSlugs = loaded.value.project.services.filter(
    (slug) => services[slug] !== undefined,
  );
  const loadedServiceResults = await Promise.all(
    orderedServiceSlugs.map((slug) =>
      loadServiceMember({
        rootDir: dir,
        service: services[slug]!,
        pdm: loaded.value.pdm,
        pdmResolver,
        allEventTypes,
        declaredModules,
      }),
    ),
  );

  for (let i = 0; i < orderedServiceSlugs.length; i += 1) {
    const result = loadedServiceResults[i]!;
    if (!result.ok) return result;
    validatedServices[orderedServiceSlugs[i]!] = result.value;
  }

  const composedValidation = validateBlueprintComposition({
    project: loaded.value.project,
    services: validatedServices,
    catalogManifest,
    discoveredModules: discoveredModulesValue,
  });
  if (!composedValidation.ok) return composedValidation;

  const bindingRegistry = buildBindingRegistry({
    httpBaseByService: composedValidation.value.httpBaseByService,
    bindingsByService: collectServiceBindings(validatedServices),
  });

  const workflows = loadProjectWorkflows({
    rootDir: dir,
    services: validatedServices,
    bindingRegistry,
  });
  if (!workflows.ok) return workflows;

  const eventsByService = Object.fromEntries(
    Object.entries(validatedServices).map(([slug, service]) => [slug, service.eventTypes]),
  );
  const init = loadProjectInit({
    rootDir: dir,
    services: Object.keys(validatedServices),
    pdm: pdmResolver,
    eventsByService,
  });
  if (!init.ok) return init;

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
    workflows: workflows.value,
    init: init.value,
    services: validatedServices,
    catalogManifest,
    publicConfigJson,
    virtualEntrySource,
    varsManifest: loaded.value.project.vars ?? {},
    uiAssetManifest,
    uiAssetSources,
    uiPresetExports,
  });
}

function collectServiceBindings(
  services: Record<string, ValidatedServiceMember>,
): Record<
  string,
  ReadonlyArray<{
    bindingId: string;
    method: 'GET' | 'POST';
    path: string;
    kind?: 'query' | 'command';
  }>
> {
  const bindingsByService: Record<
    string,
    Array<{
      bindingId: string;
      method: 'GET' | 'POST';
      path: string;
      kind?: 'query' | 'command';
    }>
  > = {};

  for (const [slug, service] of Object.entries(services)) {
    if (service.bindings === null) continue;

    bindingsByService[slug] = Object.entries(service.bindings.resolved).map(
      ([bindingId, binding]) => {
        const entry: {
          bindingId: string;
          method: 'GET' | 'POST';
          path: string;
          kind?: 'query' | 'command';
        } = {
          bindingId,
          method: binding.entry.http.method,
          path: binding.entry.http.path,
        };
        entry.kind = binding.entry.exposure === 'action' ? 'command' : 'query';
        return entry;
      },
    );
  }

  return bindingsByService;
}
