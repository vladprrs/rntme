export const VERSION = '0.0.0';
export { buildBindingResolver } from './resolvers/from-bindings.js';
export { buildComponentResolver } from './resolvers/from-shadcn.js';
export { buildResolvedHttp, type HttpBindingEntry } from './resolvers/http-map.js';
export { createUiApp } from './server/index.js';
export type { CreateUiAppOptions } from './server/index.js';
export { createUiDriver } from './client/driver.js';
export type { UiDriver, CreateUiDriverOptions } from './client/driver.js';
export { buildHandlers } from './client/handlers.js';
export { createStateStore } from './client/state-store.js';
export type { StateStore } from './client/state-store.js';
export {
  createRouter,
  matchRoute,
  expandTemplate,
  stripMountPath,
  fullMountPath,
} from './client/router.js';
export type { Router, RouterOptions, RouteMatch, RouteEvent } from './client/router.js';
