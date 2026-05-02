import type {
  RenderedDokployProject,
  RenderedDokployResource,
  RenderedEnvVar,
} from './render.js';

export type DokployProjectRef = RenderedDokployProject;

export type DokployApplication = {
  readonly id: string;
  readonly name: string;
  readonly appName?: string;
  readonly image?: string;
  readonly build?: Extract<RenderedDokployResource, { kind: 'application' }>['build'];
  readonly ports?: Extract<RenderedDokployResource, { kind: 'application' }>['ports'];
  readonly ingress?: Extract<RenderedDokployResource, { kind: 'application' }>['ingress'];
  readonly env?: readonly RenderedEnvVar[];
  readonly labels?: Readonly<Record<string, string>>;
  readonly files?: Readonly<Record<string, string>>;
};

export type DokployCompose = {
  readonly id: string;
  readonly name: string;
  readonly appName?: string;
  readonly image?: string;
  readonly composeFile?: string;
  readonly env?: readonly RenderedEnvVar[];
  readonly labels?: Readonly<Record<string, string>>;
};

export type DokployClient = {
  ensureEnvironment(ref: DokployProjectRef, environmentName: string): Promise<{ environmentId: string }>;
  findApplicationByName(environmentId: string, name: string): Promise<DokployApplication | null>;
  createApplication(
    environmentId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<DokployApplication>;
  updateApplication(
    applicationId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<DokployApplication>;
  configureApplication(
    applicationId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<void>;
  deployApplication(applicationId: string): Promise<void>;
  startApplication(applicationId: string): Promise<void>;
  findComposeByName(environmentId: string, name: string): Promise<DokployCompose | null>;
  createCompose(
    environmentId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<DokployCompose>;
  updateCompose(
    composeId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<DokployCompose>;
  configureCompose(
    composeId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<void>;
  deployCompose(composeId: string): Promise<void>;
};
