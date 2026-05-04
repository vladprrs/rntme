export { loadBlueprint } from './load/load-blueprint.js';
export {
  buildBindingRegistry,
  buildUiHttpMap,
  resolveProjectBindingRef,
} from './compose/binding-registry.js';
export { createServiceBindingResolvers } from './compose/binding-resolvers.js';
export { compileServiceUi } from './compose/compile-service-ui.js';
export { discoverServiceArtifacts } from './compose/discover-service-artifacts.js';
export { discoverModules, type DiscoveredModule } from './compose/modules.js';
export { loadComposedBlueprint } from './compose/load-composed-blueprint.js';
export { loadServiceMember } from './compose/load-service-member.js';
export { readServiceGraphSpec } from './compose/service-graphs.js';
export { eventTypesForService } from './compose/seed-scope.js';
export { safeProvisionerName } from './compose/safe-provisioner-name.js';
export { parseProjectBlueprint } from './parse/parse.js';
export { validateBlueprintComposition } from './validate/composition.js';
export { validateBlueprintStructural } from './validate/structural.js';
export { ERROR_CODES, ok, err, isOk, isErr } from './types/result.js';
export type {
  BlueprintError,
  BlueprintErrorCode,
  Result,
} from './types/result.js';
export type {
  ComposedBlueprint,
  CompositionService,
  GraphJson,
  LoadedBlueprint,
  ProjectBlueprint,
  ProjectRoutingContext,
  RoutedBindingEntry,
  ServiceArtifactPresence,
  ServiceDescriptor,
  ServiceGraphSpec,
  ServiceKind,
  ValidatedBlueprint,
  ValidatedServiceMember,
  CatalogManifest,
} from './types/artifact.js';
export type { VarsManifest, VarBinding } from './types/vars.js';
export { isKnownVarPath, extractPlaceholders } from './types/vars.js';
