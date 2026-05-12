import type { NormalizedDeployTarget } from '@rntme/deploy-runner';
import type { ExtraSecretRef, SecretRef } from './target-schema.js';

export type LoadedTarget = {
  readonly target: NormalizedDeployTarget;
  readonly configOverrides: Readonly<Record<string, unknown>>;
  readonly secretRefs: {
    readonly apiToken: SecretRef;
    readonly extras: Readonly<Record<string, ExtraSecretRef>>;
  };
};

export type LoadTargetDeps = {
  readonly readFile?: (path: string) => Promise<string>;
};
