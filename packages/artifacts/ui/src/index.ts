export { ok, err, isOk, isErr } from './types/result.js';
export type { Result, UiError, UiErrorCode, UiErrorLayer } from './types/result.js';

export type {
  SourceManifest, RouteEntry, ScreenDescriptor, DataBinding,
  ActionDef, NavigationAction, CommandAction, RefetchAction, ModuleActionDef, ParamValue, StateRef,
  SpecJson, ElementJson, RefElement, ResolvedSource,
  FragmentSourceKind, ExternalFragment, ExternalFragmentResolverContext, ExternalFragmentResolver,
} from './types/source.js';
export { isRefElement } from './types/source.js';

export type {
  CompiledManifest, CompiledRouteEntry, CompiledScreen, CompiledSpec,
  CompiledElement, CompiledDataEndpoint, CompiledAction, CompiledArtifact, CompiledModuleAction,
} from './types/compiled.js';

export { compile } from './compile.js';
export type { CompileOptions } from './compile.js';
export { resolve } from './resolve/resolve.js';
export type { ResolveOptions } from './resolve/resolve.js';
export { expand } from './expand/expand.js';
export type { ExpandedSource } from './expand/expand.js';
export { validate } from './validate/index.js';
export type { ValidateResolvers, OperationDescriptor, ComponentInfo, PropSchema } from './validate/index.js';
export type { EmitModuleContext } from './emit/http-map.js';
export { emit } from './emit/emit.js';
export type { HttpEntry } from './emit/http-map.js';
export { SpecJsonSchema } from './parse/schema.js';
