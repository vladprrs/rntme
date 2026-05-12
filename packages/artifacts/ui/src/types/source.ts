/** manifest.json — root of a UI application */
export type SourceManifest = {
  version: '2.0';
  pdmRef: string;
  qsmRef: string;
  graphSpecRef: string;
  bindingsRef: string;
  metadata: {
    title: string;
    description?: string;
  };
  layouts: Record<string, string>;       // layout name → base path (e.g. "layouts/main")
  routes: Record<string, RouteEntry>;    // route pattern → screen config
};

export type RouteEntry = {
  layout: string;                        // layout name (key in manifest.layouts)
  screen: string;                        // base path (e.g. "screens/issues-home")
};

/** *.screen.json — data fetching, actions, metadata for a screen or layout */
export type ScreenDescriptor = {
  metadata?: { title?: string };
  data?: Record<string, DataBinding>;    // state path → data source
  actions?: Record<string, ActionDef>;
};

export type DataBinding = {
  binding: string;                       // binding ID from bindings artifact
  params?: Record<string, ParamValue>;
  refetchOn?: Array<'mount' | 'params'>;
};

export type ParamValue = string | number | boolean | StateRef;
export type StateRef = { $state: string };

export type NavigationAction = {
  kind: 'navigation';
  navigateTo: string;
  paramsFromState?: Record<string, string>;
};

export type CommandAction = {
  kind: 'command';
  binding: string;
  paramsFromState: Record<string, string>;
  onSuccess?: { navigateTo?: string; refetchData?: string[]; clearFormState?: string[] };
  onError?: { showAlert?: boolean };
};

export type RefetchAction = {
  kind: 'refetch';
  targets: string[];
};

export type ModuleActionDef = {
  kind: 'module-action';
  target?: string;
  module?: string;
  category?: string;
  name: string;
  params?: Record<string, ParamValue>;
  onSuccess?: { showAlert?: string; navigateTo?: string };
  onError?: { showAlert?: string };
};

export type ActionDef = NavigationAction | CommandAction | RefetchAction | ModuleActionDef;

/**
 * A json-render Spec. The `elements` map can include regular elements
 * or $ref elements (fragment references, resolved at compile time).
 */
export type SpecJson = {
  root: string;
  elements: Record<string, ElementJson | RefElement>;
};

export type ElementJson = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  visible?: unknown;
  on?: Record<string, unknown>;
  watch?: Record<string, unknown>;
  repeat?: { statePath: string; key?: string };
};

export type RefElement = {
  $ref: string;                          // base path to fragment (e.g. "fragments/issue-card")
  bind: Record<string, unknown>;         // param name → value (literal, $state, etc.)
};

export function isRefElement(el: ElementJson | RefElement): el is RefElement {
  return '$ref' in el;
}

export type FragmentSourceKind = 'local' | 'external';

export type ExternalFragment = {
  readonly ref: string;
  readonly source: 'external';
  readonly spec: SpecJson;
};

export type ExternalFragmentResolverContext = {
  readonly referrer: string | null;
  readonly referrerSource: FragmentSourceKind;
};

export type ExternalFragmentResolver = (
  ref: string,
  context: ExternalFragmentResolverContext,
) => import('./result.js').Result<ExternalFragment | null>;

/**
 * Resolved source — after Phase 1 (Resolve), all files have been read
 * and assembled into this structure.
 */
export type ResolvedSource = {
  manifest: SourceManifest;
  baseDir: string;
  layouts: Record<string, { spec: SpecJson; screen: ScreenDescriptor }>;
  screens: Record<string, { spec: SpecJson; screen: ScreenDescriptor }>;
  fragments: Map<string, SpecJson>;      // base path → parsed fragment spec
  fragmentSources: Map<string, FragmentSourceKind>;
};
