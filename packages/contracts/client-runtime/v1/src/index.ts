export const VERSION = '1.0.0';

export {
  createOperationRegistry,
  type OperationRegistry,
  type OperationHandler,
  type Unregister,
} from './operation-registry.js';
export {
  createLifecycleBus,
  type LifecycleBus,
  type LifecycleEvents,
} from './lifecycle-bus.js';
export {
  createTransportChain,
  type TransportChain,
  type TransportMiddleware,
} from './transport-chain.js';
export { evaluateVisible, type Visible } from './visibility.js';
export { createModuleBootContext, type ModuleBootContext } from './module-context.js';
export {
  useTransport,
  useStateStore,
  useOperationRegistry,
  useModuleAction,
  TransportProvider,
  StoreProvider,
  RegistryProvider,
} from './hooks.js';
export { matchRoute, expandTemplate, type RouteMatch } from './router.js';
