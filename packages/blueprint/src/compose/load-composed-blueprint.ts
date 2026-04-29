import { createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { loadBlueprint } from '../load/load-blueprint.js';
import type {
  ComposedBlueprint,
  CompositionService,
  ValidatedServiceMember,
} from '../types/artifact.js';
import { ok, type Result } from '../types/result.js';
import { validateBlueprintComposition } from '../validate/composition.js';
import { buildBindingRegistry } from './binding-registry.js';
import { compileServiceUi } from './compile-service-ui.js';
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

  const pdmResolver = createPdmResolver(loaded.value.pdm);
  const allEventTypes = deriveEventTypes(loaded.value.pdm);
  const validatedServices: Record<string, ValidatedServiceMember> = {};

  for (const slug of loaded.value.project.services) {
    const service = services[slug];
    if (service === undefined) continue;

    const loadedService = loadServiceMember({
      rootDir: dir,
      service,
      pdm: loaded.value.pdm,
      pdmResolver,
      allEventTypes,
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
