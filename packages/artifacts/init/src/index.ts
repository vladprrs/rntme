export { parseInitArtifact } from './parse/parse.js';
export { validateInitCrossRef, validateInitStructural } from './validate/index.js';
export type {
  InitArtifact,
  InitMode,
  InitProcess,
  InitProvider,
  InitStep,
  InitStepInput,
  InitStepType,
  InitVersion,
  StructurallyValidInitArtifact,
  ValidatedInitArtifact,
} from './types/artifact.js';
export {
  ERROR_CODES,
  err,
  isErr,
  isOk,
  ok,
  type InitError,
  type InitErrorCode,
  type Result,
} from './types/result.js';
export type { InitCrossRefContext } from './types/context.js';
