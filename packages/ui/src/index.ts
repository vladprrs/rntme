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

export { compile } from './compile.js';
export type { CompileOptions } from './compile.js';
export { resolve } from './resolve/resolve.js';
export { expand } from './expand/expand.js';
export type { ExpandedSource } from './expand/expand.js';
export { validate } from './validate/index.js';
export type { ValidateResolvers } from './validate/index.js';
export { emit } from './emit/emit.js';
export type { HttpEntry } from './emit/http-map.js';
