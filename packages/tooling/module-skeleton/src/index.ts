export const VERSION = '0.0.0';

export { exampleHandlers } from './handlers.js';
export {
  EdgeAuthDescriptorSchema,
  ModuleCapabilitiesSchema,
  ModuleManifestSchema,
  ModuleSecretSchema,
  parseModuleManifest,
} from './manifest-shape.js';
export type {
  ClientBlock,
  ComponentDeclaration,
  EdgeAuthDescriptor,
  ModuleCapabilities,
  ModuleManifest,
  ModuleManifestError,
  ModuleManifestResult,
  ModuleSecret,
  OperationDeclaration,
  PropSchema,
} from './manifest-shape.js';
