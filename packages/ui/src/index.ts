export const VERSION = '0.0.0';

export {
  ok,
  err,
  isOk,
  isErr,
  UI_ERROR_CODES,
} from './types/result.js';
export type {
  Result,
  Layer,
  UiError,
  UiErrorCode,
} from './types/result.js';

export type {
  UiArtifact,
  ValidatedUiArtifact,
  RouteSpec,
  LayoutSpec,
  JsonRenderSpec,
  JsonRenderElement,
  DatasetDef,
  ActionDef,
  CommandActionDef,
  NavigationActionDef,
  ParamValue,
  StateRef,
  Literal,
} from './types/artifact.js';

export type {
  UiResolvers,
  ResolvedBinding,
  ResolvedComponent,
  ResolvedShape,
  ShapeField,
  InputType,
  InputMode,
} from './types/resolvers.js';

export { parseUiArtifact } from './parse/parse.js';
export { UiArtifactSchema } from './parse/schema.js';
export type { UiArtifactParsed } from './parse/schema.js';

export { validateStructural } from './validate/structural.js';
export type { StructurallyValid } from './validate/structural.js';
