import type { ValidatedStorageJson } from '../types/storage-json.js';

export interface EmittedStorageTypes {
  storageRouteIdUnion: string;
  routeAggregateMap: Record<string, string>;
}

export function emitStorageRouteIdTypes(
  servicesStorage: Record<string, ValidatedStorageJson | undefined>,
): EmittedStorageTypes {
  const routes = new Map<string, string>();
  for (const storage of Object.values(servicesStorage)) {
    if (storage === undefined) continue;
    for (const [id, route] of Object.entries(storage.routes)) {
      routes.set(id, route.owner.aggregate);
    }
  }

  const ids = [...routes.keys()].sort();
  return {
    storageRouteIdUnion: ids.length === 0 ? 'never' : ids.map((id) => JSON.stringify(id)).join(' | '),
    routeAggregateMap: Object.fromEntries(routes),
  };
}
