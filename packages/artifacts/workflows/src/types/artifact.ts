export type WorkflowVersion = 1;

export type WorkflowEventRef = {
  readonly service: string;
  readonly aggregateType: string;
  readonly eventType: string;
};

export type WorkflowDefinition = {
  readonly id: string;
  readonly bpmnFile: string;
  readonly processId: string;
};

export type WorkflowMappingValue =
  | string
  | number
  | boolean
  | null
  | readonly WorkflowMappingValue[]
  | { readonly [key: string]: WorkflowMappingValue };

export type WorkflowMessageStart = {
  readonly id: string;
  readonly definition: string;
  readonly messageName: string;
  readonly event: WorkflowEventRef;
  readonly businessKey: string;
  readonly variables?: Readonly<Record<string, WorkflowMappingValue>>;
};

export type WorkflowServiceTask = {
  readonly definition: string;
  readonly taskId: string;
  readonly bindingRef: string;
  readonly input?: Readonly<Record<string, WorkflowMappingValue>>;
  readonly resultVariable?: string;
};

export type NativeTaskHandlerRef = {
  readonly module: string;
  readonly export: string;
};

export type NativeTaskMapping = {
  readonly definition: string;
  readonly taskId: string;
  readonly handler: NativeTaskHandlerRef;
  readonly input?: Readonly<Record<string, WorkflowMappingValue>>;
  readonly resultVariable?: string;
};

export type WorkflowArtifact = {
  readonly workflowVersion: WorkflowVersion;
  readonly definitions: readonly WorkflowDefinition[];
  readonly messageStarts: readonly WorkflowMessageStart[];
  readonly serviceTasks: readonly WorkflowServiceTask[];
  readonly nativeTasks: readonly NativeTaskMapping[];
};

declare const StructurallyValidBrand: unique symbol;
declare const ValidatedBrand: unique symbol;

export type StructurallyValidWorkflows = WorkflowArtifact & {
  readonly [StructurallyValidBrand]: true;
};

export type ValidatedWorkflows = StructurallyValidWorkflows & {
  readonly [ValidatedBrand]: true;
};
