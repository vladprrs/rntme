export type InitVersion = 1;
export type InitProcessKind = 'bpmn';
export type InitStepType = 'init';
export type InitProvider = 'seed-events';
export type InitMode = 'lifecycle';

export type InitProcess = {
  readonly kind: InitProcessKind;
  readonly definition: string;
  readonly processId: string;
};

export type InitStepInput = {
  readonly path: string;
};

export type InitStep = {
  readonly id: string;
  readonly type: InitStepType;
  readonly provider: InitProvider;
  readonly targetService: string;
  readonly mode: InitMode;
  readonly input: InitStepInput;
  readonly dependsOn?: readonly string[];
};

export type InitArtifact = {
  readonly initVersion: InitVersion;
  readonly process: InitProcess;
  readonly steps: readonly InitStep[];
};

declare const StructurallyValidBrand: unique symbol;
declare const ValidatedBrand: unique symbol;

export type StructurallyValidInitArtifact = InitArtifact & {
  readonly [StructurallyValidBrand]: true;
};

export type ValidatedInitArtifact = StructurallyValidInitArtifact & {
  readonly [ValidatedBrand]: true;
};
