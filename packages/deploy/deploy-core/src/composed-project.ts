import type { EdgeAuthDescriptor } from '@rntme/contracts-module-v1';
import type { VarsManifest } from './vars.js';

export type ServiceKind = 'domain' | 'integration';

export type { EdgeAuthDescriptor };

export type ComposedProjectModuleInfo = {
  readonly edgeAuth?: EdgeAuthDescriptor | null;
};

export type ComposedProjectService = {
  readonly slug: string;
  readonly kind: ServiceKind;
  readonly runtimeFiles?: Readonly<Record<string, string>>;
};

export type ProjectRouteMap = {
  readonly ui?: Readonly<Record<string, string>>;
  readonly http?: Readonly<Record<string, string>>;
};

export type ProjectMiddlewareDecl = {
  readonly kind: string;
  readonly provider?: string;
  readonly audience?: string;
  readonly moduleSlug?: string;
  readonly policy?: string;
  readonly config?: unknown;
};

export type ProjectMountDecl = {
  readonly target: string;
  readonly use: readonly string[];
};

export type ComposedProjectInput = {
  readonly name: string;
  readonly services: Readonly<Record<string, ComposedProjectService>>;
  readonly publicConfigJson?: string | null;
  readonly routes?: ProjectRouteMap;
  readonly middleware?: Readonly<Record<string, ProjectMiddlewareDecl>>;
  readonly mounts?: readonly ProjectMountDecl[];
  readonly modules?: Readonly<Record<string, ComposedProjectModuleInfo>>;
  readonly varsManifest?: VarsManifest;
};
