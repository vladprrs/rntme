import type { NormalizedDeployTarget } from '@rntme/deploy-runner';
import type { SecretRef } from './target-schema.js';

export type LoadedTarget = {
  readonly target: NormalizedDeployTarget;
  readonly secretRefs: { readonly apiToken: SecretRef; readonly extras: Readonly<Record<string, SecretRef>> };
};

export type LoadTargetDeps = {
  readonly readFile?: (path: string) => Promise<string>;
};
