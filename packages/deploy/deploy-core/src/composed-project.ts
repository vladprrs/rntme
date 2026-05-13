import type { EdgeAuthDescriptor } from '@rntme/contracts-module-v1';
import type { ValidatedWorkflows } from '@rntme/workflows';
import type { VarsManifest } from './vars.js';

export type ServiceKind = 'domain' | 'integration' | 'integration-module';

export type { EdgeAuthDescriptor };

export type ComposedProjectModuleInfo = {
  readonly packageName?: string;
  readonly edgeAuth?: EdgeAuthDescriptor | null;
};

export type ComposedProjectService = {
  readonly slug: string;
  readonly kind: ServiceKind;
  readonly moduleKey?: string;
  readonly runtimeFiles?: Readonly<Record<string, string>>;
};

export type WorkflowGrpcServiceConfig = {
  readonly packageName: string;
  readonly serviceName: string;
  readonly protoSource: string;
};

export type ProjectRouteMap = {
  readonly ui?: Readonly<Record<string, string>>;
  readonly http?: Readonly<Record<string, string>>;
};

export type ProjectAuthProviderDecl =
  | {
      readonly provider: 'auth0';
      readonly audience: string;
      readonly moduleSlug: string;
    }
  | {
      readonly provider: 'platform-tokens';
      readonly moduleSlug: string;
      readonly introspectPath: string;
      readonly introspectPort: number;
    };

export type ProjectAuthMiddlewareDecl = {
  readonly kind: 'auth';
  readonly providers: readonly ProjectAuthProviderDecl[];
  readonly policy?: string;
  readonly config?: unknown;
};

export type ProjectGenericMiddlewareDecl = {
  readonly kind: string;
  readonly provider?: string;
  readonly policy?: string;
  readonly config?: unknown;
};

export type ProjectMiddlewareDecl = ProjectAuthMiddlewareDecl | ProjectGenericMiddlewareDecl;

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
  readonly workflows?: ValidatedWorkflows | null;
  readonly workflowFiles?: Readonly<Record<string, string>>;
  readonly workflowGrpcServices?: Readonly<Record<string, WorkflowGrpcServiceConfig>>;
  readonly varsManifest?: VarsManifest;
};
