import type { GraphSignature, ResolvedShape } from './resolvers.js';
import type { InputFromMap, ResponseShape } from './input-from.js';

export type OperationPassthrough = Record<string, unknown>;
export type ParameterPassthrough = Record<string, unknown>;

export type HttpMethod = 'GET' | 'POST';
export type HttpParameterLocation = 'query' | 'path' | 'body';

export type HttpParameter = {
  name: string;
  in: HttpParameterLocation;
  bindTo: string;
  required: boolean;
  description?: string;
  openapi?: ParameterPassthrough;
};

export type HttpBinding = {
  method: HttpMethod;
  path: string;
  parameters: HttpParameter[];
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  openapi?: OperationPassthrough;
};

export type BindingExposure = 'read' | 'action';

export type BindingEntry = {
  exposure: BindingExposure;
  graph: string;
  target: { engine: string; dialect: string };
  http: HttpBinding;
  inputFrom?: InputFromMap;   // NEW plan 4
  response?: ResponseShape;   // NEW plan 4
  allowedRedirectHosts?: string[];
};

export type OpenApiDefaults = {
  info?: { title?: string; version?: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
};

export type BindingArtifact = {
  version: '1.0';
  graphSpecRef: string;
  pdmRef: string;
  qsmRef: string;
  openapi?: OpenApiDefaults;
  bindings: Record<string, BindingEntry>;
};

// Branded stages through the validation pipeline.

declare const __structural: unique symbol;
declare const __resolved: unique symbol;
declare const __validated: unique symbol;

export type StructurallyValid = BindingArtifact & { readonly [__structural]: true };

export type ResolvedBinding = {
  entry: BindingEntry;
  signature: GraphSignature;
  outputShape: ResolvedShape;
};

export type ResolvedBindings = {
  artifact: StructurallyValid;
  resolved: Record<string, ResolvedBinding>;
  readonly [__resolved]: true;
};

export type ValidatedBindings = ResolvedBindings & { readonly [__validated]: true };
