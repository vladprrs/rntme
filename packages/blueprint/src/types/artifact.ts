import type { ValidatedPdm } from '@rntme/pdm';
import type { QsmArtifact } from '@rntme/qsm';

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
