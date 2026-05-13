import type { InputMode, ValidatedBindings } from '@rntme/bindings';
import type { EdgeAuthDescriptor } from '@rntme/contracts-module-v1';
import type { EventTypeSpec, ValidatedPdm } from '@rntme/pdm';
import type { QsmArtifact, ValidatedQsm } from '@rntme/qsm';
import type { ValidatedSeed } from '@rntme/seed';
import type { CompiledArtifact } from '@rntme/ui';
import type { ValidatedInitArtifact } from '@rntme/init';
import type { ValidatedWorkflows } from '@rntme/workflows';
import type { PropSchema } from './result.js';
import type { ValidatedStorageJson } from './storage-json.js';

export type ServiceKind = 'domain' | 'integration' | 'integration-module';

export type ProjectRouteMap = {
  ui?: Readonly<Record<string, string>>;
  http?: Readonly<Record<string, string>>;
};

export type MiddlewareDecl = {
  kind: 'auth' | string;
  provider?: string;
  policy?: string;
  audience?: string;
  moduleSlug?: string;
};

export type MountDecl = {
  target: string;
  use: readonly string[];
};


export type ModuleProjectRef = {
  readonly package: string;
  readonly publicConfig?: Readonly<Record<string, unknown>>;
};

export type UiAssetManifest = {
  readonly stylesheets: readonly UiStylesheetAsset[];
  readonly fonts: readonly UiFontAsset[];
  readonly icons: readonly UiImageAsset[];
  readonly images: readonly UiImageAsset[];
  readonly staticFiles: readonly UiStaticAsset[];
  readonly preloads: readonly UiPreloadAsset[];
};

export type UiAssetBase = {
  readonly id: string;
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly href: string;
};

export type UiStylesheetAsset = UiAssetBase & {
  readonly order: number;
  readonly media: string;
  readonly scope: 'document';
};

export type UiFontAsset = UiAssetBase & {
  readonly family: string;
  readonly weight?: string;
  readonly style?: string;
  readonly preload: boolean;
};

export type UiImageAsset = UiAssetBase & {
  readonly alt?: string;
};

export type UiStaticAsset = UiAssetBase;

export type UiPreloadAsset = {
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly href: string;
  readonly as: 'style' | 'font' | 'image' | 'fetch';
  readonly type?: string;
  readonly crossorigin?: 'anonymous' | 'use-credentials';
};

export type UiAssetSource = {
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
  readonly runtimePath: string;
  readonly href: string;
};

export type UiPresetExport = {
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly name: string;
  readonly kind: 'fragment';
  readonly path: string;
  readonly description?: string;
  readonly inputs: Readonly<Record<string, PropSchema>>;
  readonly sourcePath: string;
};

/** Catalog union built from resolved UI modules (spec §10.1). */
export type CatalogManifest = {
  readonly components: ReadonlyArray<{
    readonly type: string;
    readonly module: string;
    readonly props: Readonly<Record<string, PropSchema>>;
  }>;
  readonly operations: ReadonlyArray<{
    readonly name: string;
    readonly module: string;
    readonly appliesTo: readonly string[] | null;
    readonly params: Readonly<Record<string, PropSchema>>;
    readonly category: string | null;
  }>;
  readonly modulesWithBoot: readonly Readonly<{
    name: string;
    contract?: 'identity';
  }>[];
  readonly categoryToModule: Readonly<Record<string, string>>;
  readonly publicConfig: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly moduleEdgeAuth: Readonly<Record<string, EdgeAuthDescriptor | null>>;
};

export type ProjectWorkflowsDecl = {
  readonly manifest: string;
};

export type ProjectBlueprint = {
  name: string;
  services: readonly string[];
  routes?: ProjectRouteMap;
  middleware?: Readonly<Record<string, MiddlewareDecl>>;
  mounts?: readonly MountDecl[];
  modules?: Readonly<Record<string, ModuleProjectRef>>;
  vars?: Readonly<Record<string, { from: string; required: boolean }>>;
  workflows?: ProjectWorkflowsDecl;
};

export type ServiceDescriptor = {
  slug: string;
  kind: ServiceKind;
  moduleKey?: string;
};

export type LoadedBlueprint = {
  project: ProjectBlueprint;
  pdm: ValidatedPdm;
  services: Record<string, ServiceDescriptor & { qsm: QsmArtifact | null }>;
};

declare const BlueprintValidatedBrand: unique symbol;

export type ValidatedBlueprint = LoadedBlueprint & {
  readonly [BlueprintValidatedBrand]: true;
};

export type ServiceArtifactPresence = {
  hasGraphs: boolean;
  hasBindings: boolean;
  hasUi: boolean;
  hasSeed: boolean;
  hasQsm: boolean;
  hasStorage: boolean;
  hasCommandHandlers: boolean;
};

export type CompositionService = ServiceDescriptor & {
  qsm: QsmArtifact | null;
  artifacts: ServiceArtifactPresence;
};

export type ProjectRoutingContext = {
  httpBaseByService: Record<string, string>;
  uiPathsByService: Record<string, string[]>;
};

export type GraphJson = {
  id: string;
  signature: {
    inputs: Record<
      string,
      { type: string; mode: InputMode; default?: unknown }
    >;
    output: { type: string; from: string };
  };
  nodes: unknown[];
};

export type ServiceGraphSpec = {
  version: '1.0-rc7';
  shapes: Record<
    string,
    { fields: Record<string, { type: string; nullable: boolean }> }
  >;
  graphs: Record<string, GraphJson>;
};

export type ValidatedServiceMember = CompositionService & {
  graphSpec: ServiceGraphSpec | null;
  qsmValidated: ValidatedQsm | null;
  bindings: ValidatedBindings | null;
  seed: ValidatedSeed | null;
  storage: ValidatedStorageJson | null;
  compiledUi: CompiledArtifact | null;
  eventTypes: readonly EventTypeSpec[];
};

export type RoutedBindingEntry = {
  service: string;
  bindingId: string;
  qualifiedId: string;
  method: 'GET' | 'POST';
  path: string;
  kind?: 'query' | 'command';
};

export type ComposedBlueprint = {
  project: ProjectBlueprint;
  pdm: ValidatedPdm;
  services: Record<string, ValidatedServiceMember>;
  routing: ProjectRoutingContext;
  bindingRegistry: Record<string, RoutedBindingEntry>;
  workflows?: ValidatedWorkflows | null;
  init?: ValidatedInitArtifact | null;
  catalogManifest?: CatalogManifest | null;
  /** Serialized JSON object: module package name → public config slice (spec §10.4). */
  publicConfigJson?: string | null;
  /** Deterministic virtual entry TypeScript source (spec §10.2). */
  virtualEntrySource?: string | null;
  varsManifest: Readonly<Record<string, { from: string; required: boolean }>>;
  uiAssetManifest?: UiAssetManifest | null;
  uiAssetSources?: readonly UiAssetSource[] | null;
  uiPresetExports?: readonly UiPresetExport[] | null;
};
