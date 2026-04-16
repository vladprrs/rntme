export { ok, err, isOk, isErr } from './types/result.js';
export type { Result, UiError, UiErrorCode } from './types/result.js';

export type {
  SourceManifest, RouteEntry, ScreenDescriptor, DataBinding,
  ActionDef, NavigationAction, CommandAction, ParamValue, StateRef,
  SpecJson, ElementJson, RefElement, ResolvedSource,
} from './types/source.js';
export { isRefElement } from './types/source.js';

export type {
  CompiledManifest, CompiledRouteEntry, CompiledScreen, CompiledSpec,
  CompiledElement, CompiledDataEndpoint, CompiledAction, CompiledArtifact,
} from './types/compiled.js';
