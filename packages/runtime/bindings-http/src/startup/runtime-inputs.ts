import type {
  AuthoringSpecOutput,
  ValidatedPdm,
  ValidatedQsm,
} from '@rntme/graph-ir-compiler';

export type RuntimeGraphSpec = AuthoringSpecOutput;

export type BindingsGraphRuntimeInputs = Readonly<{
  graphSpec: RuntimeGraphSpec;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
}>;

export type { ValidatedPdm, ValidatedQsm };
