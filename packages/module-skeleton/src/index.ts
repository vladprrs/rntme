export const VERSION = '0.0.0';

export { exampleHandlers } from './handlers.js';
export {
  ModuleManifestSchema,
  ModuleSecretSchema,
  parseModuleManifest,
} from './manifest-shape.js';
export type {
  ModuleManifest,
  ModuleManifestError,
  ModuleManifestResult,
  ModuleSecret,
} from './manifest-shape.js';
