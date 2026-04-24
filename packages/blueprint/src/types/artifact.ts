import type { InputMode, ValidatedBindings } from '@rntme/bindings';
import type { EventTypeSpec, ValidatedPdm } from '@rntme/pdm';
import type { QsmArtifact, ValidatedQsm } from '@rntme/qsm';
import type { ValidatedSeed } from '@rntme/seed';
import type { CompiledArtifact } from '@rntme/ui';

export type ServiceKind = 'domain' | 'integration';

export type ProjectRouteMap = {
  ui?: Readonly<Record<string, string>>;
  http?: Readonly<Record<string, string>>;
};

export type MiddlewareDecl = {
  kind: string;
  provider?: string;
  policy?: string;
};

export type MountDecl = {
  target: string;
  use: readonly string[];
};

export type ProjectBlueprint = {
  name: string;
  services: readonly string[];
  routes?: ProjectRouteMap;
  middleware?: Readonly<Record<string, MiddlewareDecl>>;
  mounts?: readonly MountDecl[];
};

export type ServiceDescriptor = {
  slug: string;
  kind: ServiceKind;
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
  compiledUi: CompiledArtifact | null;
  eventTypes: readonly EventTypeSpec[];
};

export type RoutedBindingEntry = {
  service: string;
  bindingId: string;
  qualifiedId: string;
  method: 'GET' | 'POST';
  path: string;
};

export type ComposedBlueprint = {
  project: ProjectBlueprint;
  pdm: ValidatedPdm;
  services: Record<string, ValidatedServiceMember>;
  routing: ProjectRoutingContext;
  bindingRegistry: Record<string, RoutedBindingEntry>;
};
