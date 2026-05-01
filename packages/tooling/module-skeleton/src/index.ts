export const VERSION = '0.0.0';

export { exampleHandlers } from './handlers.js';
export {
  ModuleCapabilitiesSchema,
  ModuleManifestSchema,
  ModuleSecretSchema,
  parseModuleManifest,
} from './manifest-shape.js';
export type {
  ClientBlock,
  ComponentDeclaration,
  ModuleCapabilities,
  ModuleManifest,
  ModuleManifestError,
  ModuleManifestResult,
  ModuleSecret,
  OperationDeclaration,
  PropSchema,
} from './manifest-shape.js';
