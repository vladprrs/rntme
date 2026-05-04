export const VERSION = '1.0.0';

export {
  EdgeAuthDescriptorSchema,
  ModuleCapabilitiesSchema,
  ModuleManifestSchema,
  ModuleSecretSchema,
  ProvisionerBlockSchema,
  ProvisionerProducesSchema,
  ProvisionerRequiresSchema,
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
  ProvisionerBlock,
  ProvisionerProduces,
  ProvisionerRequires,
} from './manifest-shape.js';
