import type { WorkflowEventRef } from './artifact.js';

export type WorkflowEventResolution = {
  readonly service: string;
  readonly aggregateType: string;
  readonly eventType: string;
};

export type WorkflowBindingResolution = {
  readonly service: string;
  readonly bindingId: string;
  readonly qualifiedId: string;
  readonly kind?: 'query' | 'command';
  readonly method?: 'GET' | 'POST';
  readonly path?: string;
};

export type WorkflowCrossRefContext = {
  readonly services: readonly string[];
  readonly fileExists?: (relativePath: string) => boolean;
  readonly resolveEvent: (ref: WorkflowEventRef) => WorkflowEventResolution | null;
  readonly resolveBindingRef: (ref: string) => WorkflowBindingResolution | null;
};
