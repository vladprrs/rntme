/** _manifest.json — loaded by runtime at startup */
export type CompiledManifest = {
  version: '2.0';
  metadata: { title: string; description?: string };
  routes: Record<string, CompiledRouteEntry>;
};

export type CompiledRouteEntry = {
  layout: string;                        // layout name (matches key in _layouts/)
  screen: string;                        // screen name (matches key in _screens/)
};

/** _screens/*.json or _layouts/*.json */
export type CompiledScreen = {
  spec: CompiledSpec;
  data?: Record<string, CompiledDataEndpoint>;
  actions?: Record<string, CompiledAction>;
};

/** Pure json-render Spec — no $ref, no $param */
export type CompiledSpec = {
  root: string;
  elements: Record<string, CompiledElement>;
};

export type CompiledElement = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  visible?: unknown;
  on?: Record<string, unknown>;
  watch?: Record<string, unknown>;
  repeat?: { statePath: string; key?: string };
};

/** Data binding resolved to HTTP endpoint */
export type CompiledDataEndpoint = {
  method: 'GET' | 'POST';
  path: string;                          // e.g. "/api/issues"
  params?: Record<string, unknown>;
  refetchOn?: Array<'mount' | 'params'>;
};

export type CompiledAction =
  | { kind: 'navigation'; navigateTo: string; paramsFromState?: Record<string, string> }
  | {
      kind: 'command';
      method: 'POST';
      path: string;
      paramsFromState: Record<string, string>;
      onSuccess?: { navigateTo?: string; refetchData?: string[]; clearFormState?: string[] };
      onError?: { showAlert?: boolean };
    }
  | { kind: 'refetch'; targets: string[] };

/** Full compiled artifact — all files in one structure (used by compiler internally) */
export type CompiledArtifact = {
  manifest: CompiledManifest;
  layouts: Record<string, CompiledScreen>;
  screens: Record<string, CompiledScreen>;
};
