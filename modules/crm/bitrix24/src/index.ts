export { createBitrix24Adapter, createBitrix24SdkAdapter } from './adapter.js';
export type { Bitrix24Adapter, Bitrix24HookLike, CreateBitrix24AdapterOptions } from './adapter.js';
export {
  BITRIX24_SUPPORTED_EVENTS,
  BITRIX24_SUPPORTED_RPCS,
  BITRIX24_UNSUPPORTED_RPCS,
  BITRIX24_LIMITATIONS,
} from './capabilities.js';
export {
  Bitrix24CrmError,
  GrpcStatus,
  invalidRequest,
  labelsNotSupported,
  mapBitrix24Error,
  notFound,
  unsupported,
} from './errors.js';
export { createBitrix24CrmModule } from './handlers.js';
export type { Bitrix24CrmModule, CreateBitrix24CrmModuleOptions } from './handlers.js';
export {
  association,
  bitrixEntityMethod,
  canonicalId,
  mapBitrix24Activity,
  mapBitrix24Company,
  mapBitrix24Contact,
  mapBitrix24Deal,
  mapBitrix24Field,
  mapBitrix24Note,
  mapBitrix24Owner,
  mapBitrix24Pipeline,
  ownerTypeIdFor,
  vendorIdFromCanonical,
} from './mapping.js';
export { bitrix24MockConformanceSuite } from './conformance.js';
