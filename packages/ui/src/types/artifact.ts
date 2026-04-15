export type StateRef = { $state: string };
export type Literal = string | number | boolean | null;
export type ParamValue = Literal | StateRef;

export type JsonRenderElement = {
  type: string;
  props: Record<string, unknown>;
  children: string[];
  visible?: unknown;
  watch?: Record<string, { action: string; params?: Record<string, unknown> }>;
};

export type JsonRenderSpec = {
  root: string;
  elements: Record<string, JsonRenderElement>;
};

export type DatasetDef = {
  binding: string;
  params?: Record<string, ParamValue>;
  refetchOn?: Array<'mount' | 'params'>;
};

export type CommandActionDef = {
  kind: 'command';
  binding: string;
  paramsFromState: Record<string, string>;
  onSuccess?: {
    navigateTo?: string;
    clearFormState?: string[];
    refetchData?: string[];
  };
  onError?: { showAlert?: boolean };
};

export type NavigationActionDef = {
  kind: 'navigation';
  navigateTo: string;
  paramsFromState?: Record<string, string>;
};

export type ActionDef = CommandActionDef | NavigationActionDef;

export type LayoutSpec = { spec: JsonRenderSpec };

export type RouteSpec = {
  layout?: string;
  metadata?: { title?: string };
  page: JsonRenderSpec;
  data?: Record<string, DatasetDef>;
  actions?: Record<string, ActionDef>;
};

export type UiArtifact = {
  version: '1.0-rc1';
  pdmRef: string;
  qsmRef: string;
  graphSpecRef: string;
  bindingsRef: string;
  metadata: { title: { default: string; template?: string }; description?: string };
  layouts: Record<string, LayoutSpec>;
  routes: Record<string, RouteSpec>;
};

declare const __validated: unique symbol;
export type ValidatedUiArtifact = UiArtifact & { readonly [__validated]: true };
