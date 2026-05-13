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
  ClientAssets,
  ClientBlock,
  ClientFontAsset,
  ClientImageAsset,
  ClientPreloadAsset,
  ClientPreset,
  ClientStaticFileAsset,
  ClientStylesheetAsset,
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
